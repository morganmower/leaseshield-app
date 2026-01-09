/**
 * Congress.gov API Adapter
 * 
 * Monitors federal legislation for housing-related bills.
 * API: https://api.congress.gov/
 * 
 * Note: Requires a Congress.gov API key for full access.
 */

import { 
  LegislationSourceAdapter, 
  NormalizedLegislationItem, 
  SourceFetchParams, 
  SourceFetchResult,
  TopicTag 
} from "../types";
import { registerAdapter } from "../registry";

interface CongressBill {
  congress: number;
  type: string;
  number: number;
  title: string;
  introducedDate: string;
  updateDate: string;
  latestAction?: {
    actionDate: string;
    text: string;
  };
  sponsors?: Array<{
    bioguideId: string;
    fullName: string;
    party: string;
    state: string;
  }>;
  policyArea?: {
    name: string;
  };
  subjects?: {
    legislativeSubjects: Array<{
      name: string;
    }>;
  };
  url?: string;
}

interface CongressSearchResponse {
  bills?: CongressBill[];
  pagination?: {
    count: number;
    next?: string;
  };
}

const NAHASDA_KEYWORDS = [
  'native american housing',
  'nahasda',
  'indian housing',
  'tribal housing',
  'ihbg',
];

const HOUSING_KEYWORDS = [
  'housing',
  'landlord',
  'tenant',
  'rental',
  'fair housing',
  'section 8',
  'public housing',
  'hud',
];

function classifyTopics(bill: CongressBill): TopicTag[] {
  const topics: TopicTag[] = [];
  const searchText = `${bill.title} ${bill.policyArea?.name || ''} ${bill.subjects?.legislativeSubjects?.map(s => s.name).join(' ') || ''}`.toLowerCase();
  
  const hasNahasdaKeyword = NAHASDA_KEYWORDS.some(kw => searchText.includes(kw));
  if (hasNahasdaKeyword) {
    topics.push('nahasda_core');
    if (searchText.includes('ihbg') || searchText.includes('block grant')) {
      topics.push('ihbg');
    }
  }
  
  const hasHousingKeyword = HOUSING_KEYWORDS.some(kw => searchText.includes(kw));
  if (hasHousingKeyword) {
    topics.push('hud_general');
    topics.push('landlord_tenant');
    if (searchText.includes('fair housing')) topics.push('fair_housing');
  }
  
  if (topics.length === 0) {
    topics.push('not_relevant');
  }
  
  return topics;
}

function normalizeBill(bill: CongressBill): NormalizedLegislationItem {
  const topics = classifyTopics(bill);
  const billId = `${bill.type}${bill.number}`;
  
  return {
    source: "congressGov",
    sourceKey: `${bill.congress}-${billId}`,
    type: "bill",
    jurisdiction: {
      country: "US",
      level: "federal",
    },
    title: bill.title,
    summary: bill.latestAction?.text,
    status: bill.latestAction?.text || 'Introduced',
    introducedDate: bill.introducedDate,
    updatedAt: bill.updateDate,
    url: bill.url || `https://www.congress.gov/bill/${bill.congress}th-congress/${bill.type.toLowerCase()}-bill/${bill.number}`,
    topics,
    severity: "medium",
    crossRefKey: `CONGRESS-${bill.congress}-${billId}`,
    raw: bill,
  };
}

class CongressGovAdapter implements LegislationSourceAdapter {
  id = "congressGov" as const;
  name = "Congress.gov";
  type = "api" as const;
  defaultPollInterval = 1440;
  
  private baseUrl = 'https://api.congress.gov/v3';
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.CONGRESS_GOV_API_KEY || '';
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }

  async fetch(params: SourceFetchParams): Promise<SourceFetchResult> {
    const items: NormalizedLegislationItem[] = [];
    const errors: string[] = [];
    
    if (!this.apiKey) {
      errors.push('CONGRESS_GOV_API_KEY not configured - skipping');
      return { items, errors };
    }

    const searchTerms = params.includeTribal 
      ? [...NAHASDA_KEYWORDS.slice(0, 2), ...HOUSING_KEYWORDS.slice(0, 2)]
      : HOUSING_KEYWORDS.slice(0, 3);
    
    for (const term of searchTerms) {
      try {
        const congress = 119;
        const url = `${this.baseUrl}/bill/${congress}?` +
          `query=${encodeURIComponent(term)}&` +
          `format=json&` +
          `limit=20&` +
          `api_key=${this.apiKey}`;
        
        const response = await fetch(url, {
          headers: { 'Accept': 'application/json' },
        });

        if (!response.ok) {
          errors.push(`Congress.gov error for "${term}": ${response.status}`);
          continue;
        }

        const data: CongressSearchResponse = await response.json();
        
        for (const bill of data.bills || []) {
          const normalized = normalizeBill(bill);
          
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
        errors.push(`Congress.gov fetch error for "${term}": ${error}`);
      }
    }
    
    console.log(`🏛️ Congress.gov: Found ${items.length} federal bills`);
    
    return { items, errors };
  }
}

export const congressGovAdapter = new CongressGovAdapter();
registerAdapter(congressGovAdapter);
