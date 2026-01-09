/**
 * Plural Policy (Open States) Adapter
 * 
 * Wraps the existing Plural Policy service with rate limiting.
 */

import { 
  LegislationSourceAdapter, 
  NormalizedLegislationItem, 
  SourceFetchParams, 
  SourceFetchResult,
  TopicTag 
} from "../types";
import { registerAdapter } from "../registry";

interface PluralBill {
  id: string;
  identifier: string;
  title: string;
  session: string;
  jurisdiction: {
    id: string;
    name: string;
    classification: string;
  };
  abstracts?: Array<{ abstract: string }>;
  actions?: Array<{ date: string; description: string }>;
  sources?: Array<{ url: string }>;
  created_at: string;
  updated_at: string;
  openstates_url: string;
}

const STATE_JURISDICTION_MAP: Record<string, string> = {
  UT: 'ocd-jurisdiction/country:us/state:ut/government',
  TX: 'ocd-jurisdiction/country:us/state:tx/government',
  ND: 'ocd-jurisdiction/country:us/state:nd/government',
  SD: 'ocd-jurisdiction/country:us/state:sd/government',
  NC: 'ocd-jurisdiction/country:us/state:nc/government',
  OH: 'ocd-jurisdiction/country:us/state:oh/government',
  MI: 'ocd-jurisdiction/country:us/state:mi/government',
  ID: 'ocd-jurisdiction/country:us/state:id/government',
  WY: 'ocd-jurisdiction/country:us/state:wy/government',
  CA: 'ocd-jurisdiction/country:us/state:ca/government',
  VA: 'ocd-jurisdiction/country:us/state:va/government',
  NV: 'ocd-jurisdiction/country:us/state:nv/government',
  AZ: 'ocd-jurisdiction/country:us/state:az/government',
  FL: 'ocd-jurisdiction/country:us/state:fl/government',
};

function extractStateFromJurisdiction(jurisdictionId: string): string | undefined {
  const match = jurisdictionId.match(/state:(\w+)/);
  return match ? match[1].toUpperCase() : undefined;
}

function classifyTopics(bill: PluralBill): TopicTag[] {
  const topics: TopicTag[] = [];
  const searchText = `${bill.title} ${bill.abstracts?.map(a => a.abstract).join(' ') || ''}`.toLowerCase();
  
  const keywords = ['landlord', 'tenant', 'rental', 'eviction', 'lease', 'housing', 'security deposit'];
  if (keywords.some(kw => searchText.includes(kw))) {
    topics.push('landlord_tenant');
    if (searchText.includes('fair housing')) topics.push('fair_housing');
    if (searchText.includes('security deposit')) topics.push('security_deposit');
    if (searchText.includes('eviction')) topics.push('eviction');
  }
  
  if (topics.length === 0) {
    topics.push('not_relevant');
  }
  
  return topics;
}

function normalizeBill(bill: PluralBill): NormalizedLegislationItem {
  const state = extractStateFromJurisdiction(bill.jurisdiction.id);
  const topics = classifyTopics(bill);
  const sessionYear = parseInt(bill.session) || new Date().getFullYear();
  
  return {
    source: "pluralPolicy",
    sourceKey: bill.id,
    type: "bill",
    jurisdiction: {
      country: "US",
      level: "state",
      state,
    },
    title: bill.title,
    summary: bill.abstracts?.[0]?.abstract,
    status: bill.actions?.[0]?.description || 'Unknown',
    updatedAt: bill.updated_at,
    url: bill.openstates_url || bill.sources?.[0]?.url,
    topics,
    severity: "medium",
    crossRefKey: state ? `${state}-${bill.identifier}-${sessionYear}` : undefined,
    raw: bill,
  };
}

class PluralPolicyAdapter implements LegislationSourceAdapter {
  id = "pluralPolicy" as const;
  name = "Plural Policy (Open States)";
  type = "api" as const;
  defaultPollInterval = 1440;
  
  private baseUrl = 'https://v3.openstates.org';
  private apiKey: string;
  private lastRequestTime = 0;
  private minRequestInterval = 1100;

  constructor() {
    this.apiKey = process.env.PLURAL_POLICY_API_KEY || '';
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }

  private async rateLimitedFetch(url: string): Promise<Response | null> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minRequestInterval) {
      await new Promise(resolve => setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest));
    }
    
    this.lastRequestTime = Date.now();

    const response = await fetch(url, {
      headers: {
        'X-API-KEY': this.apiKey,
        'Accept': 'application/json',
      },
    });

    if (response.status === 429) {
      console.warn('⚠️ Plural Policy rate limit exceeded, waiting 60s...');
      await new Promise(resolve => setTimeout(resolve, 60000));
      return this.rateLimitedFetch(url);
    }

    return response.ok ? response : null;
  }

  async fetch(params: SourceFetchParams): Promise<SourceFetchResult> {
    const items: NormalizedLegislationItem[] = [];
    const errors: string[] = [];
    
    if (!this.apiKey) {
      errors.push('PLURAL_POLICY_API_KEY not configured');
      return { items, errors };
    }

    const states = params.states || Object.keys(STATE_JURISDICTION_MAP);
    const searchTerms = ['landlord tenant', 'eviction', 'rental property', 'security deposit'];
    
    for (const state of states) {
      const jurisdiction = STATE_JURISDICTION_MAP[state];
      if (!jurisdiction) continue;

      for (const searchTerm of searchTerms.slice(0, 2)) {
        try {
          const urlParams = new URLSearchParams({
            jurisdiction,
            q: searchTerm,
            per_page: '20',
          });

          const response = await this.rateLimitedFetch(`${this.baseUrl}/bills?${urlParams}`);
          
          if (!response) {
            errors.push(`Plural Policy error for ${state}: no response`);
            continue;
          }

          const data = await response.json();
          
          for (const bill of data.results || []) {
            const normalized = normalizeBill(bill);
            if (!normalized.topics.includes('not_relevant')) {
              const exists = items.some(i => i.crossRefKey === normalized.crossRefKey);
              if (!exists) {
                items.push(normalized);
              }
            }
          }
          
        } catch (error) {
          errors.push(`Plural Policy fetch error for ${state}: ${error}`);
        }
      }
      
      console.log(`🔍 Plural Policy ${state}: Processed`);
    }

    return { items, errors };
  }
}

export const pluralPolicyAdapter = new PluralPolicyAdapter();
registerAdapter(pluralPolicyAdapter);
