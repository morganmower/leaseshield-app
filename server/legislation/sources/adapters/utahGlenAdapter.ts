/**
 * Utah GLEN API Adapter
 * 
 * Utah Government Legislative Electronic Network
 * Provides access to Utah state bills and legislation.
 * API: https://glen.le.utah.gov/
 */

import { 
  LegislationSourceAdapter, 
  NormalizedLegislationItem, 
  SourceFetchParams, 
  SourceFetchResult,
  TopicTag 
} from "../types";
import { registerAdapter } from "../registry";

interface UtahGlenBill {
  bill: string;
  billNumber: string;
  generalSessionYear: string;
  shortTitle: string;
  lastAction: string;
  lastActionDate: string;
  lastActionOwner: string;
  sponsor: string;
  floorSponsor?: string;
  subject?: string;
  code?: string;
}

interface UtahGlenSearchResponse {
  bills?: UtahGlenBill[];
  error?: string;
}

const NAHASDA_KEYWORDS = [
  'native american',
  'indian',
  'tribal',
  'tribe',
  'nahasda',
  'housing authority',
  'reservation',
];

const LANDLORD_TENANT_KEYWORDS = [
  'landlord',
  'tenant',
  'eviction',
  'rental',
  'lease',
  'housing',
  'security deposit',
  'fair housing',
];

function classifyTopics(bill: UtahGlenBill): TopicTag[] {
  const topics: TopicTag[] = [];
  const searchText = `${bill.shortTitle} ${bill.subject || ''} ${bill.code || ''}`.toLowerCase();
  
  const hasNahasdaKeyword = NAHASDA_KEYWORDS.some(kw => searchText.includes(kw));
  if (hasNahasdaKeyword) {
    topics.push('nahasda_core');
    topics.push('tribal_adjacent');
  }
  
  const hasLandlordTenantKeyword = LANDLORD_TENANT_KEYWORDS.some(kw => searchText.includes(kw));
  if (hasLandlordTenantKeyword) {
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

function normalizeBill(bill: UtahGlenBill): NormalizedLegislationItem {
  const topics = classifyTopics(bill);
  const year = bill.generalSessionYear || new Date().getFullYear().toString();
  
  return {
    source: "utahGlen",
    sourceKey: bill.bill || bill.billNumber,
    type: "bill",
    jurisdiction: {
      country: "US",
      level: "state",
      state: "UT",
    },
    title: bill.shortTitle,
    summary: bill.subject,
    status: bill.lastAction,
    updatedAt: bill.lastActionDate,
    url: `https://le.utah.gov/~${year}/bills/static/${bill.billNumber}.html`,
    topics,
    severity: "medium",
    crossRefKey: `UT-${bill.billNumber}-${year}`,
    raw: bill,
  };
}

class UtahGlenAdapter implements LegislationSourceAdapter {
  id = "utahGlen" as const;
  name = "Utah GLEN";
  type = "api" as const;
  defaultPollInterval = 60;
  
  private baseUrl = 'https://glen.le.utah.gov';

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async fetch(params: SourceFetchParams): Promise<SourceFetchResult> {
    const items: NormalizedLegislationItem[] = [];
    const errors: string[] = [];
    
    const searchTerms = [
      ...LANDLORD_TENANT_KEYWORDS.slice(0, 3),
      ...(params.includeTribal ? NAHASDA_KEYWORDS.slice(0, 2) : []),
    ];
    
    for (const term of searchTerms) {
      try {
        const year = new Date().getFullYear();
        const url = `${this.baseUrl}/bills.json?year=${year}&search=${encodeURIComponent(term)}`;
        
        const response = await fetch(url, {
          headers: { 'Accept': 'application/json' },
        });

        if (!response.ok) {
          errors.push(`Utah GLEN error for "${term}": ${response.status}`);
          continue;
        }

        const data: UtahGlenSearchResponse = await response.json();
        
        if (data.error) {
          errors.push(`Utah GLEN error for "${term}": ${data.error}`);
          continue;
        }
        
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
        errors.push(`Utah GLEN fetch error for "${term}": ${error}`);
      }
    }
    
    console.log(`🏔️ Utah GLEN: Found ${items.length} relevant bills`);
    
    return { items, errors };
  }
}

export const utahGlenAdapter = new UtahGlenAdapter();
registerAdapter(utahGlenAdapter);
