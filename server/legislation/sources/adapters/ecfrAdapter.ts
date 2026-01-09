/**
 * eCFR API Adapter
 * 
 * Electronic Code of Federal Regulations
 * Monitors changes to Title 24 (Housing) / Part 1000 (NAHASDA)
 * API: https://www.ecfr.gov/api/versioner/v1
 */

import { 
  LegislationSourceAdapter, 
  NormalizedLegislationItem, 
  SourceFetchParams, 
  SourceFetchResult,
  TopicTag 
} from "../types";
import { registerAdapter } from "../registry";

interface EcfrVersionChange {
  date: string;
  amendment_date?: string;
  effective_date?: string;
  title: number;
  part?: number;
  section?: string;
  type?: string;
  identifier?: string;
  content_versions?: Array<{
    date: string;
    version?: string;
  }>;
}

interface EcfrSearchResponse {
  results?: EcfrVersionChange[];
  meta?: {
    total_count: number;
  };
}

const NAHASDA_PARTS = [1000];
const LANDLORD_TENANT_PARTS = [5, 8, 35, 200, 982, 983];

function classifyTopics(change: EcfrVersionChange): TopicTag[] {
  const topics: TopicTag[] = [];
  
  if (change.part === 1000) {
    topics.push('nahasda_core');
    topics.push('ihbg');
    return topics;
  }
  
  if (LANDLORD_TENANT_PARTS.includes(change.part || 0)) {
    topics.push('hud_general');
    topics.push('landlord_tenant');
  }
  
  if (topics.length === 0) {
    topics.push('not_relevant');
  }
  
  return topics;
}

function determineSeverity(change: EcfrVersionChange): "low" | "medium" | "high" | "critical" {
  if (change.part === 1000) return "high";
  if (LANDLORD_TENANT_PARTS.includes(change.part || 0)) return "medium";
  return "low";
}

function normalizeChange(change: EcfrVersionChange): NormalizedLegislationItem {
  const topics = classifyTopics(change);
  const partStr = change.part ? ` Part ${change.part}` : '';
  const sectionStr = change.section ? `.${change.section}` : '';
  
  return {
    source: "ecfr",
    sourceKey: `${change.title}-${change.part || 0}-${change.section || 'all'}-${change.date}`,
    type: "cfr_change",
    jurisdiction: {
      country: "US",
      level: "federal",
    },
    title: `24 CFR${partStr}${sectionStr} - Amendment ${change.date}`,
    summary: `Code of Federal Regulations Title ${change.title}${partStr} was amended`,
    status: change.type || 'amended',
    effectiveDate: change.effective_date || change.date,
    publishedAt: change.date,
    url: `https://www.ecfr.gov/current/title-${change.title}/part-${change.part || ''}`,
    topics,
    severity: determineSeverity(change),
    cfrReferences: [{ title: change.title, part: change.part || 0, section: change.section }],
    crossRefKey: `CFR-${change.title}-${change.part}-${change.date}`,
    raw: change,
  };
}

class EcfrAdapter implements LegislationSourceAdapter {
  id = "ecfr" as const;
  name = "eCFR (Code of Federal Regulations)";
  type = "api" as const;
  defaultPollInterval = 1440;
  
  private baseUrl = 'https://www.ecfr.gov/api/versioner/v1';

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async fetch(params: SourceFetchParams): Promise<SourceFetchResult> {
    const items: NormalizedLegislationItem[] = [];
    const errors: string[] = [];
    
    const partsToMonitor = params.includeTribal 
      ? NAHASDA_PARTS 
      : LANDLORD_TENANT_PARTS;
    
    for (const part of partsToMonitor) {
      try {
        const toDate = new Date();
        const fromDate = params.since ? new Date(params.since) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        
        const url = `${this.baseUrl}/versions/title-24/part-${part}.json?` + 
          `on_or_after=${fromDate.toISOString().split('T')[0]}&` +
          `on_or_before=${toDate.toISOString().split('T')[0]}`;
        
        const response = await fetch(url, {
          headers: { 'Accept': 'application/json' },
        });

        if (!response.ok) {
          if (response.status === 404) {
            continue;
          }
          errors.push(`eCFR error for Part ${part}: ${response.status}`);
          continue;
        }

        const data = await response.json();
        const versions = data.content_versions || data.results || [];
        
        for (const version of versions) {
          const change: EcfrVersionChange = {
            date: version.date || version.effective_date,
            effective_date: version.effective_date,
            title: 24,
            part: part,
            type: 'amendment',
          };
          
          const normalized = normalizeChange(change);
          
          if (params.topics && params.topics.length > 0) {
            const hasMatchingTopic = normalized.topics.some(t => params.topics!.includes(t));
            if (!hasMatchingTopic) continue;
          }
          
          const exists = items.some(i => i.crossRefKey === normalized.crossRefKey);
          if (!exists && !normalized.topics.includes('not_relevant')) {
            items.push(normalized);
          }
        }
        
      } catch (error) {
        errors.push(`eCFR fetch error for Part ${part}: ${error}`);
      }
    }
    
    console.log(`📜 eCFR: Found ${items.length} CFR changes`);
    
    return { items, errors };
  }
}

export const ecfrAdapter = new EcfrAdapter();
registerAdapter(ecfrAdapter);
