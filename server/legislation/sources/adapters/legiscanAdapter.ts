/**
 * LegiScan Adapter
 * 
 * Wraps the existing LegiScan service to output normalized items.
 */

import { 
  LegislationSourceAdapter, 
  NormalizedLegislationItem, 
  SourceFetchParams, 
  SourceFetchResult,
  TopicTag 
} from "../types";
import { registerAdapter } from "../registry";

interface LegiScanBill {
  bill_id: number;
  state: string;
  bill_number: string;
  title: string;
  description: string;
  status: number;
  status_date: string;
  url: string;
  session?: {
    year_start: number;
    year_end: number;
    session_name: string;
  };
  subjects?: Array<{ subject_name: string }>;
}

const STATUS_MAP: Record<number, string> = {
  1: 'Introduced',
  2: 'Engrossed',
  3: 'Enrolled',
  4: 'Passed',
  5: 'Vetoed',
  6: 'Failed',
};

const LANDLORD_TENANT_SUBJECTS = [
  'landlord',
  'tenant',
  'rental',
  'eviction',
  'lease',
  'housing',
  'residential tenancy',
  'security deposit',
];

function classifyTopics(bill: LegiScanBill): TopicTag[] {
  const topics: TopicTag[] = [];
  const searchText = `${bill.title} ${bill.description || ''} ${bill.subjects?.map(s => s.subject_name).join(' ') || ''}`.toLowerCase();
  
  const hasLandlordTenantKeyword = LANDLORD_TENANT_SUBJECTS.some(kw => searchText.includes(kw));
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

function normalizeBill(bill: LegiScanBill): NormalizedLegislationItem {
  const topics = classifyTopics(bill);
  const sessionYear = bill.session?.year_start || new Date().getFullYear();
  
  return {
    source: "legiscan",
    sourceKey: String(bill.bill_id),
    type: "bill",
    jurisdiction: {
      country: "US",
      level: "state",
      state: bill.state,
    },
    title: bill.title,
    summary: bill.description,
    status: STATUS_MAP[bill.status] || 'Unknown',
    updatedAt: bill.status_date,
    url: bill.url,
    topics,
    severity: bill.status >= 3 ? "high" : "medium",
    crossRefKey: `${bill.state}-${bill.bill_number}-${sessionYear}`,
    raw: bill,
  };
}

class LegiScanAdapter implements LegislationSourceAdapter {
  id = "legiscan" as const;
  name = "LegiScan";
  type = "api" as const;
  defaultPollInterval = 1440;
  
  private baseUrl = 'https://api.legiscan.com';
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.LEGISCAN_API_KEY || '';
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }

  async fetch(params: SourceFetchParams): Promise<SourceFetchResult> {
    const items: NormalizedLegislationItem[] = [];
    const errors: string[] = [];
    
    if (!this.apiKey) {
      throw new Error('LEGISCAN_API_KEY not configured - cannot proceed with legislative monitoring');
    }

    if (!params.states || params.states.length === 0) {
      throw new Error('LegiScan requires states to be provided via params.states (no hardcoded fallback)');
    }
    const states = params.states;
    const year = new Date().getFullYear();
    
    for (const state of states) {
      try {
        const keywords = ['landlord', 'tenant', 'rental', 'eviction', 'lease', 'housing'];
        const query = keywords.join(' OR ');
        
        const url = new URL(this.baseUrl);
        url.searchParams.set('key', this.apiKey);
        url.searchParams.set('op', 'getSearch');
        url.searchParams.set('state', state);
        url.searchParams.set('query', query);
        url.searchParams.set('year', year.toString());

        const response = await fetch(url.toString());
        
        if (!response.ok) {
          errors.push(`LegiScan error for ${state}: ${response.status}`);
          continue;
        }

        const data = await response.json();
        
        if (data.status === 'ERROR') {
          errors.push(`LegiScan error for ${state}: ${JSON.stringify(data)}`);
          continue;
        }

        const results = data.searchresult || {};
        for (const key of Object.keys(results)) {
          if (key === 'summary') continue;
          const bill = results[key];
          if (bill && bill.bill_id) {
            const normalized = normalizeBill({ ...bill, state });
            if (!normalized.topics.includes('not_relevant')) {
              items.push(normalized);
            }
          }
        }
        
        console.log(`🔍 LegiScan ${state}: Found ${Object.keys(results).length - 1} bills`);
        
      } catch (error) {
        errors.push(`LegiScan fetch error for ${state}: ${error}`);
      }
    }

    return { items, errors };
  }
}

export const legiscanAdapter = new LegiScanAdapter();
registerAdapter(legiscanAdapter);
