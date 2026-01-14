/**
 * Nightly Ingest Service
 * 
 * Runs daily at 1:30am to pull updates from all 8 legislative sources.
 * Stores raw + normalized updates but NEVER touches templates.
 * The monthly publish job processes these accumulated updates.
 */

import { db } from "../db";
import { 
  sourceRuns, 
  rawLegislationItems, 
  normalizedUpdates,
  legislationSources,
  type InsertSourceRun,
  type InsertRawLegislationItem,
  type InsertNormalizedUpdate,
} from "../../shared/schema";
import { eq, and, desc, isNull } from "drizzle-orm";
import { 
  getAllAdapters, 
  getAdapter,
  NormalizedLegislationItem, 
  SourceFetchParams,
  TopicTag,
  SourceId,
} from "./sources";
import crypto from "crypto";

export interface IngestRunResult {
  runId: string;
  status: 'success' | 'partial' | 'failed';
  sourcesProcessed: number;
  totalItemsFetched: number;
  newItemsStored: number;
  duplicatesSkipped: number;
  errors: string[];
  sourceResults: Array<{
    sourceKey: string;
    status: 'success' | 'partial' | 'failed';
    itemsFetched: number;
    newItems: number;
    error?: string;
  }>;
}

function generateContentHash(item: NormalizedLegislationItem): string {
  const content = `${item.title}|${item.summary || ''}|${item.status || ''}`;
  return crypto.createHash('sha256').update(content).digest('hex').substring(0, 32);
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
  item: NormalizedLegislationItem
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
    isDuplicate: false,
    isProcessed: false,
  };
  
  const [inserted] = await db.insert(normalizedUpdates).values(normalizedItem).returning({ id: normalizedUpdates.id });
  return inserted.id;
}

async function createSourceRun(sourceKey: string, cursorBefore?: string): Promise<string> {
  const run: InsertSourceRun = {
    sourceKey,
    cursorBefore,
    status: 'running',
  };
  
  const [inserted] = await db.insert(sourceRuns).values(run).returning({ id: sourceRuns.id });
  return inserted.id;
}

async function updateSourceRun(
  runId: string, 
  status: 'success' | 'partial' | 'failed',
  newItemsCount: number,
  cursorAfter?: string,
  error?: string
): Promise<void> {
  await db.update(sourceRuns)
    .set({
      status,
      newItemsCount,
      cursorAfter,
      errorMessage: error,
      finishedAt: new Date(),
    })
    .where(eq(sourceRuns.id, runId));
}

async function getLastCursor(sourceKey: string): Promise<string | undefined> {
  const lastRun = await db.select({ cursorAfter: sourceRuns.cursorAfter })
    .from(sourceRuns)
    .where(and(
      eq(sourceRuns.sourceKey, sourceKey),
      eq(sourceRuns.status, 'success')
    ))
    .orderBy(desc(sourceRuns.finishedAt))
    .limit(1);
  
  return lastRun[0]?.cursorAfter || undefined;
}

export async function runNightlyIngest(): Promise<IngestRunResult> {
  const overallRunId = crypto.randomUUID();
  const errors: string[] = [];
  const sourceResults: IngestRunResult['sourceResults'] = [];
  let sourcesProcessed = 0;
  let totalItemsFetched = 0;
  let newItemsStored = 0;
  let duplicatesSkipped = 0;
  
  console.log(`\n🌙 Starting Nightly Ingest (Run ID: ${overallRunId})`);
  console.log(`   Time: ${new Date().toISOString()}\n`);
  
  try {
    const enabledSources = await db.select()
      .from(legislationSources)
      .where(eq(legislationSources.enabled, true));
    
    console.log(`📊 Processing ${enabledSources.length} enabled sources\n`);
    
    for (const source of enabledSources) {
      console.log(`\n━━━ Ingesting source: ${source.name} (${source.id}) ━━━`);
      
      const adapter = getAdapter(source.id as SourceId);
      if (!adapter) {
        const err = `No adapter found for source: ${source.id}`;
        console.warn(`⚠️ ${err}`);
        errors.push(err);
        sourceResults.push({
          sourceKey: source.id,
          status: 'failed',
          itemsFetched: 0,
          newItems: 0,
          error: err,
        });
        continue;
      }
      
      const lastCursor = await getLastCursor(source.id);
      const sourceRunId = await createSourceRun(source.id, lastCursor);
      
      try {
        const isAvailable = await adapter.isAvailable();
        if (!isAvailable) {
          console.log(`⏭️ Skipping ${source.id} - not available (missing API key?)`);
          await updateSourceRun(sourceRunId, 'failed', 0, undefined, 'Source not available');
          sourceResults.push({
            sourceKey: source.id,
            status: 'failed',
            itemsFetched: 0,
            newItems: 0,
            error: 'Source not available',
          });
          continue;
        }
        
        const fetchParams: SourceFetchParams = {
          states: source.stateFilter || undefined,
          topics: source.topicFilter as TopicTag[] || undefined,
          since: source.lastSeenDate?.toISOString(),
          includeTribal: source.topicFilter?.some(t => 
            ['nahasda_core', 'ihbg', 'tribal_adjacent'].includes(t)
          ),
        };
        
        console.log(`   Fetch params: ${JSON.stringify(fetchParams)}`);
        
        const result = await adapter.fetch(fetchParams);
        
        if (result.errors && result.errors.length > 0) {
          errors.push(...result.errors.map(e => `[${source.id}] ${e}`));
        }
        
        const itemsFetched = result.items.length;
        totalItemsFetched += itemsFetched;
        console.log(`   Fetched ${itemsFetched} items`);
        
        let sourceNewItems = 0;
        let sourceDuplicates = 0;
        
        for (const item of result.items) {
          const duplicateId = await checkDuplicate(item.crossRefKey);
          
          if (duplicateId) {
            sourceDuplicates++;
            duplicatesSkipped++;
            continue;
          }
          
          const rawItemId = await storeRawItem(source.id, item);
          await storeNormalizedItem(source.id, rawItemId, item);
          sourceNewItems++;
          newItemsStored++;
        }
        
        await db.update(legislationSources)
          .set({
            lastRunAt: new Date(),
            lastRunStatus: result.errors?.length ? 'partial' : 'success',
            lastSeenDate: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(legislationSources.id, source.id));
        
        await updateSourceRun(
          sourceRunId, 
          result.errors?.length ? 'partial' : 'success',
          sourceNewItems,
          result.cursor
        );
        
        sourceResults.push({
          sourceKey: source.id,
          status: result.errors?.length ? 'partial' : 'success',
          itemsFetched,
          newItems: sourceNewItems,
        });
        
        sourcesProcessed++;
        console.log(`   ✅ Stored ${sourceNewItems} new items, skipped ${sourceDuplicates} duplicates`);
        
      } catch (error) {
        const err = `Source ${source.id} failed: ${error}`;
        console.error(`   ❌ ${err}`);
        errors.push(err);
        
        await updateSourceRun(sourceRunId, 'failed', 0, undefined, String(error));
        
        await db.update(legislationSources)
          .set({
            lastRunAt: new Date(),
            lastRunStatus: 'failed',
            lastRunError: String(error),
            updatedAt: new Date(),
          })
          .where(eq(legislationSources.id, source.id));
        
        sourceResults.push({
          sourceKey: source.id,
          status: 'failed',
          itemsFetched: 0,
          newItems: 0,
          error: String(error),
        });
      }
    }
    
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✅ Nightly Ingest Complete`);
    console.log(`   Sources processed: ${sourcesProcessed}/${enabledSources.length}`);
    console.log(`   Total items fetched: ${totalItemsFetched}`);
    console.log(`   New items stored: ${newItemsStored}`);
    console.log(`   Duplicates skipped: ${duplicatesSkipped}`);
    console.log(`   Errors: ${errors.length}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    return {
      runId: overallRunId,
      status: errors.length === 0 ? 'success' : sourcesProcessed > 0 ? 'partial' : 'failed',
      sourcesProcessed,
      totalItemsFetched,
      newItemsStored,
      duplicatesSkipped,
      errors,
      sourceResults,
    };
    
  } catch (error) {
    console.error(`\n❌ Nightly ingest failed: ${error}`);
    errors.push(`Ingest error: ${error}`);
    
    return {
      runId: overallRunId,
      status: 'failed',
      sourcesProcessed,
      totalItemsFetched,
      newItemsStored,
      duplicatesSkipped,
      errors,
      sourceResults,
    };
  }
}
