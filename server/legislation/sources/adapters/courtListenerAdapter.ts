/**
 * CourtListener Adapter
 * 
 * Wraps the existing CourtListener service for case law monitoring.
 */

import { 
  LegislationSourceAdapter, 
  NormalizedLegislationItem, 
  SourceFetchParams, 
  SourceFetchResult,
  TopicTag 
} from "../types";
import { registerAdapter } from "../registry";

interface CourtListenerCluster {
  id: number;
  absolute_url: string;
  case_name: string;
  case_name_full?: string;
  case_number?: string;
  date_filed: string;
  court?: string;
  court_id?: number;
  nature_of_suit?: string;
  precedential_status?: string;
}

const STATE_COURT_MAP: Record<string, string[]> = {
  UT: ['utah', 'tenth-circuit'],
  TX: ['texas', 'fifth-circuit'],
  ND: ['north-dakota', 'eighth-circuit'],
  SD: ['south-dakota', 'eighth-circuit'],
  NC: ['north-carolina', 'fourth-circuit'],
  OH: ['ohio', 'sixth-circuit'],
  MI: ['michigan', 'sixth-circuit'],
  ID: ['idaho', 'ninth-circuit'],
  WY: ['wyoming', 'tenth-circuit'],
  CA: ['california', 'ninth-circuit'],
  VA: ['virginia', 'fourth-circuit'],
  NV: ['nevada', 'ninth-circuit'],
  AZ: ['arizona', 'ninth-circuit'],
  FL: ['florida', 'eleventh-circuit'],
};

function classifyTopics(cluster: CourtListenerCluster): TopicTag[] {
  const topics: TopicTag[] = [];
  const searchText = `${cluster.case_name} ${cluster.case_name_full || ''} ${cluster.nature_of_suit || ''}`.toLowerCase();
  
  const keywords = ['landlord', 'tenant', 'eviction', 'lease', 'rental', 'housing'];
  if (keywords.some(kw => searchText.includes(kw))) {
    topics.push('landlord_tenant');
    if (searchText.includes('fair housing')) topics.push('fair_housing');
    if (searchText.includes('eviction')) topics.push('eviction');
  }
  
  if (topics.length === 0) {
    topics.push('not_relevant');
  }
  
  return topics;
}

function normalizeCase(cluster: CourtListenerCluster, state?: string): NormalizedLegislationItem {
  const topics = classifyTopics(cluster);
  
  return {
    source: "courtListener",
    sourceKey: String(cluster.id),
    type: "case",
    jurisdiction: {
      country: "US",
      level: "state",
      state,
    },
    title: cluster.case_name,
    summary: cluster.case_name_full,
    status: cluster.precedential_status || 'Unknown',
    publishedAt: cluster.date_filed,
    url: cluster.absolute_url ? `https://www.courtlistener.com${cluster.absolute_url}` : undefined,
    topics,
    severity: cluster.precedential_status === 'Published' ? "high" : "medium",
    crossRefKey: cluster.case_number ? `CASE-${cluster.case_number}` : `CASE-${cluster.id}`,
    raw: cluster,
  };
}

class CourtListenerAdapter implements LegislationSourceAdapter {
  id = "courtListener" as const;
  name = "CourtListener";
  type = "api" as const;
  defaultPollInterval = 10080;
  
  private baseUrl = 'https://www.courtlistener.com/api/rest/v4';
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.COURTLISTENER_API_KEY || '';
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }

  async fetch(params: SourceFetchParams): Promise<SourceFetchResult> {
    const items: NormalizedLegislationItem[] = [];
    const errors: string[] = [];
    
    if (!this.apiKey) {
      errors.push('COURTLISTENER_API_KEY not configured');
      return { items, errors };
    }

    const states = params.states || Object.keys(STATE_COURT_MAP);
    const searchTerms = ['landlord tenant', 'eviction', 'lease'];
    
    for (const state of states.slice(0, 5)) {
      try {
        const query = searchTerms.join(' OR ');
        
        const url = new URL(`${this.baseUrl}/search/`);
        url.searchParams.set('q', query);
        url.searchParams.set('format', 'json');
        url.searchParams.set('limit', '20');

        const response = await fetch(url.toString(), {
          headers: {
            'Authorization': `Token ${this.apiKey}`,
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          errors.push(`CourtListener error for ${state}: ${response.status}`);
          continue;
        }

        const data = await response.json();
        const results = data.results || data.data || [];
        
        for (const cluster of results) {
          const normalized = normalizeCase({
            id: cluster.cluster_id || cluster.id,
            absolute_url: cluster.absolute_url || '',
            case_name: cluster.caseName || cluster.case_name || '',
            case_name_full: cluster.caseNameFull || cluster.case_name_full || '',
            case_number: cluster.caseNumber || cluster.case_number || '',
            date_filed: cluster.dateFiled || cluster.date_filed || '',
            court: cluster.court || '',
            precedential_status: cluster.precedential_status || '',
          }, state);
          
          if (!normalized.topics.includes('not_relevant')) {
            items.push(normalized);
          }
        }
        
        console.log(`⚖️ CourtListener ${state}: Found ${results.length} cases`);
        
      } catch (error) {
        errors.push(`CourtListener fetch error for ${state}: ${error}`);
      }
    }

    return { items, errors };
  }
}

export const courtListenerAdapter = new CourtListenerAdapter();
registerAdapter(courtListenerAdapter);
