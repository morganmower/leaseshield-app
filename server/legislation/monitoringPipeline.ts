/**
 * Legislative Monitoring Pipeline
 * 
 * Orchestrates the complete flow:
 * Sources → Normalize → Dedupe → Store → AI Analysis → Review Queue → Notify
 * 
 * Topic-based routing ensures tribal updates only affect tribal templates.
 */

import { db } from "../db";
import { 
  legislationSources, 
  rawLegislationItems, 
  normalizedUpdates,
  templateTopicRouting,
  templateReviewQueue,
  monitoringRuns,
  type LegislationSource,
  type InsertRawLegislationItem,
  type InsertNormalizedUpdate,
} from "../../shared/schema";
import { eq, and, inArray, isNull } from "drizzle-orm";
import { 
  getAllAdapters, 
  getAdapter,
  NormalizedLegislationItem, 
  SourceFetchParams,
  TopicTag,
  SourceId,
} from "./sources";
import crypto from "crypto";

export interface MonitoringRunResult {
  runId: string;
  status: 'success' | 'partial' | 'failed';
  sourcesProcessed: number;
  itemsFetched: number;
  itemsStored: number;
  duplicatesSkipped: number;
  errors: string[];
}

export interface PipelineOptions {
  sourceIds?: SourceId[];
  topics?: TopicTag[];
  states?: string[];
  includeTribal?: boolean;
  since?: string;
  dryRun?: boolean;
}

function generateContentHash(item: NormalizedLegislationItem): string {
  const content = `${item.title}|${item.summary || ''}|${item.status || ''}`;
  return crypto.createHash('sha256').update(content).digest('hex').substring(0, 32);
}

async function getEnabledSources(): Promise<LegislationSource[]> {
  return db.select().from(legislationSources).where(eq(legislationSources.enabled, true));
}

async function checkDuplicate(crossRefKey: string | undefined): Promise<string | null> {
  if (!crossRefKey) return null;
  
  const existing = await db.select({ id: normalizedUpdates.id })
    .from(normalizedUpdates)
    .where(eq(normalizedUpdates.crossRefKey, crossRefKey))
    .limit(1);
  
  return existing.length > 0 ? existing[0].id : null;
}

async function storeRawItem(
  sourceId: string, 
  item: NormalizedLegislationItem
): Promise<string> {
  const rawItem: InsertRawLegislationItem = {
    sourceId,
    externalId: item.sourceKey,
    url: item.url,
    publishedAt: item.publishedAt ? new Date(item.publishedAt) : undefined,
    title: item.title,
    body: item.summary,
    rawData: item.raw as Record<string, unknown>,
    contentHash: generateContentHash(item),
  };
  
  const [inserted] = await db.insert(rawLegislationItems).values(rawItem).returning({ id: rawLegislationItems.id });
  return inserted.id;
}

async function storeNormalizedItem(
  sourceId: string,
  rawItemId: string,
  item: NormalizedLegislationItem,
  duplicateOfId: string | null
): Promise<string> {
  const normalizedItem: InsertNormalizedUpdate = {
    sourceId,
    rawItemId,
    sourceKey: item.sourceKey,
    crossRefKey: item.crossRefKey,
    itemType: item.type as 'bill' | 'regulation' | 'case' | 'notice' | 'cfr_change',
    jurisdictionLevel: item.jurisdiction.level as 'federal' | 'state' | 'tribal' | 'local',
    jurisdictionState: item.jurisdiction.state,
    jurisdictionTribe: item.jurisdiction.tribe,
    title: item.title,
    summary: item.summary,
    status: item.status,
    introducedDate: item.introducedDate ? new Date(item.introducedDate) : undefined,
    effectiveDate: item.effectiveDate ? new Date(item.effectiveDate) : undefined,
    publishedAt: item.publishedAt ? new Date(item.publishedAt) : undefined,
    url: item.url,
    pdfUrl: item.pdfUrl,
    topics: item.topics,
    severity: item.severity as 'low' | 'medium' | 'high' | 'critical' | undefined,
    cfrReferences: item.cfrReferences as unknown as Record<string, unknown>,
    isDuplicate: !!duplicateOfId,
    duplicateOfId,
  };
  
  const [inserted] = await db.insert(normalizedUpdates).values(normalizedItem).returning({ id: normalizedUpdates.id });
  return inserted.id;
}

async function updateSourceStatus(
  sourceId: string, 
  status: 'success' | 'partial' | 'failed', 
  error?: string
): Promise<void> {
  await db.update(legislationSources)
    .set({
      lastRunAt: new Date(),
      lastRunStatus: status,
      lastRunError: error,
      updatedAt: new Date(),
    })
    .where(eq(legislationSources.id, sourceId));
}

async function getAffectedTemplates(topics: TopicTag[], jurisdictionState?: string): Promise<string[]> {
  const conditions = [];
  
  if (topics.length > 0) {
    conditions.push(inArray(templateTopicRouting.topic, topics as any[]));
  }
  
  conditions.push(eq(templateTopicRouting.isActive, true));
  
  const routings = await db.select({ templateId: templateTopicRouting.templateId })
    .from(templateTopicRouting)
    .where(and(...conditions));
  
  return Array.from(new Set(routings.map(r => r.templateId)));
}

export async function runMonitoringPipeline(options: PipelineOptions = {}): Promise<MonitoringRunResult> {
  const runId = crypto.randomUUID();
  const errors: string[] = [];
  let sourcesProcessed = 0;
  let itemsFetched = 0;
  let itemsStored = 0;
  let duplicatesSkipped = 0;
  
  console.log(`\n🚀 Starting Legislative Monitoring Pipeline (Run ID: ${runId})`);
  console.log(`   Options: ${JSON.stringify(options)}\n`);
  
  try {
    const enabledSources = await getEnabledSources();
    const sourcesToProcess = options.sourceIds 
      ? enabledSources.filter(s => options.sourceIds!.includes(s.id as SourceId))
      : enabledSources;
    
    console.log(`📊 Processing ${sourcesToProcess.length} sources\n`);
    
    for (const source of sourcesToProcess) {
      console.log(`\n━━━ Processing source: ${source.name} (${source.id}) ━━━`);
      
      const adapter = getAdapter(source.id as SourceId);
      if (!adapter) {
        const err = `No adapter found for source: ${source.id}`;
        console.warn(`⚠️ ${err}`);
        errors.push(err);
        continue;
      }
      
      try {
        const isAvailable = await adapter.isAvailable();
        if (!isAvailable) {
          console.log(`⏭️ Skipping ${source.id} - not available (missing API key?)`);
          continue;
        }
        
        const fetchParams: SourceFetchParams = {
          states: options.states || source.stateFilter || undefined,
          topics: options.topics || source.topicFilter as TopicTag[] || undefined,
          since: options.since || source.lastSeenDate?.toISOString(),
          includeTribal: options.includeTribal,
        };
        
        console.log(`   Fetch params: ${JSON.stringify(fetchParams)}`);
        
        const result = await adapter.fetch(fetchParams);
        
        if (result.errors && result.errors.length > 0) {
          errors.push(...result.errors.map(e => `[${source.id}] ${e}`));
        }
        
        itemsFetched += result.items.length;
        console.log(`   Fetched ${result.items.length} items`);
        
        if (!options.dryRun) {
          for (const item of result.items) {
            const duplicateId = await checkDuplicate(item.crossRefKey);
            
            if (duplicateId) {
              duplicatesSkipped++;
              console.log(`   ⏭️ Duplicate skipped: ${item.crossRefKey}`);
              continue;
            }
            
            const rawItemId = await storeRawItem(source.id, item);
            await storeNormalizedItem(source.id, rawItemId, item, duplicateId);
            itemsStored++;
          }
          
          await updateSourceStatus(source.id, result.errors?.length ? 'partial' : 'success');
        }
        
        sourcesProcessed++;
        console.log(`   ✅ Processed successfully`);
        
      } catch (error) {
        const err = `Source ${source.id} failed: ${error}`;
        console.error(`   ❌ ${err}`);
        errors.push(err);
        
        if (!options.dryRun) {
          await updateSourceStatus(source.id, 'failed', String(error));
        }
      }
    }
    
    if (!options.dryRun) {
      await db.insert(monitoringRuns).values({
        statesChecked: options.states || [],
        billsFound: itemsFetched,
        relevantBills: itemsStored,
        templatesQueued: 0,
        status: errors.length === 0 ? 'success' : 'partial',
        errorMessage: errors.length > 0 ? errors.join('; ') : undefined,
        summaryReport: `Processed ${sourcesProcessed} sources, found ${itemsFetched} items, stored ${itemsStored} new items, skipped ${duplicatesSkipped} duplicates`,
      });
    }
    
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✅ Pipeline Complete`);
    console.log(`   Sources processed: ${sourcesProcessed}`);
    console.log(`   Items fetched: ${itemsFetched}`);
    console.log(`   Items stored: ${itemsStored}`);
    console.log(`   Duplicates skipped: ${duplicatesSkipped}`);
    console.log(`   Errors: ${errors.length}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    return {
      runId,
      status: errors.length === 0 ? 'success' : 'partial',
      sourcesProcessed,
      itemsFetched,
      itemsStored,
      duplicatesSkipped,
      errors,
    };
    
  } catch (error) {
    console.error(`\n❌ Pipeline failed: ${error}`);
    errors.push(`Pipeline error: ${error}`);
    
    return {
      runId,
      status: 'failed',
      sourcesProcessed,
      itemsFetched,
      itemsStored,
      duplicatesSkipped,
      errors,
    };
  }
}

export async function runTribalMonitoring(): Promise<MonitoringRunResult> {
  console.log('\n🏠 Starting Tribal Housing Monitoring (NAHASDA/IHBG focused)\n');
  
  return runMonitoringPipeline({
    sourceIds: ['federalRegister', 'ecfr', 'hudOnap', 'utahGlen'],
    topics: ['nahasda_core', 'ihbg', 'tribal_adjacent'],
    includeTribal: true,
  });
}

export async function runLandlordTenantMonitoring(): Promise<MonitoringRunResult> {
  console.log('\n🏘️ Starting Landlord-Tenant Monitoring (14 states)\n');
  
  return runMonitoringPipeline({
    sourceIds: ['legiscan', 'pluralPolicy', 'federalRegister', 'courtListener'],
    topics: ['landlord_tenant', 'fair_housing', 'security_deposit', 'eviction'],
    states: ['UT', 'TX', 'ND', 'SD', 'NC', 'OH', 'MI', 'ID', 'WY', 'CA', 'VA', 'NV', 'AZ', 'FL'],
    includeTribal: false,
  });
}
