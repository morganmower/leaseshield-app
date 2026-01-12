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

// Shared rate limiter for all Plural Policy API calls
let globalLastRequestTime = 0;
const GLOBAL_MIN_INTERVAL = 2500; // 2.5 seconds between any Plural Policy request

async function globalRateLimitedDelay(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - globalLastRequestTime;
  
  if (timeSinceLastRequest < GLOBAL_MIN_INTERVAL) {
    const waitTime = GLOBAL_MIN_INTERVAL - timeSinceLastRequest;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  globalLastRequestTime = Date.now();
}

class PluralPolicyAdapter implements LegislationSourceAdapter {
  id = "pluralPolicy" as const;
  name = "Plural Policy (Open States)";
  type = "api" as const;
  defaultPollInterval = 1440;
  
  private baseUrl = 'https://v3.openstates.org';
  private apiKey: string;
  private dailyLimitExhausted = false;

  constructor() {
    this.apiKey = process.env.PLURAL_POLICY_API_KEY || '';
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }

  private async rateLimitedFetch(url: string): Promise<Response | 'rate_limited' | null> {
    // Use global rate limiter to ensure all calls are properly spaced
    await globalRateLimitedDelay();

    const response = await fetch(url, {
      headers: {
        'X-API-KEY': this.apiKey,
        'Accept': 'application/json',
      },
    });

    if (response.status === 429) {
      // Return special marker instead of retrying - daily limit likely exhausted
      return 'rate_limited';
    }

    return response.ok ? response : null;
  }

  async fetch(params: SourceFetchParams): Promise<SourceFetchResult> {
    const items: NormalizedLegislationItem[] = [];
    const errors: string[] = [];
    
    // Reset daily limit flag at start of each fetch cycle
    this.dailyLimitExhausted = false;
    
    if (!this.apiKey) {
      errors.push('PLURAL_POLICY_API_KEY not configured');
      return { items, errors };
    }

    if (!params.states || params.states.length === 0) {
      errors.push('Plural Policy requires states to be provided via params.states (no hardcoded fallback)');
      return { items, errors };
    }
    const states = params.states;
    const searchTerms = ['landlord tenant', 'eviction'];
    
    for (const state of states) {
      // Early exit if daily limit is exhausted
      if (this.dailyLimitExhausted) {
        break;
      }
      
      const jurisdiction = STATE_JURISDICTION_MAP[state];
      if (!jurisdiction) continue;

      for (const searchTerm of searchTerms) {
        try {
          const urlParams = new URLSearchParams({
            jurisdiction,
            q: searchTerm,
            per_page: '20',
          });

          const response = await this.rateLimitedFetch(`${this.baseUrl}/bills?${urlParams}`);
          
          // Check for rate limit - if hit, skip entire source
          if (response === 'rate_limited') {
            console.warn(`⏸️ Plural Policy daily limit exhausted - skipping remaining states (will retry tomorrow)`);
            this.dailyLimitExhausted = true;
            errors.push('Plural Policy daily rate limit exhausted - skipped remaining states');
            break;
          }
          
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
      
      if (!this.dailyLimitExhausted) {
        console.log(`🔍 Plural Policy ${state}: Processed`);
      }
    }

    return { items, errors };
  }
}

export const pluralPolicyAdapter = new PluralPolicyAdapter();
registerAdapter(pluralPolicyAdapter);
