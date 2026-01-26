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
    const currentYear = new Date().getFullYear();
    
    // Determine years to fetch based on since date:
    // - First run (no since date): fetch 2 years of history
    // - Subsequent runs: only fetch years from since date to current year
    //   (LegiScan API only supports year-based queries, not exact dates)
    const isFirstRun = !params.since;
    let yearsToFetch: number[];
    
    if (isFirstRun) {
      // First run: fetch current year and previous year
      yearsToFetch = [currentYear, currentYear - 1];
      console.log(`📅 First run detected - fetching ${yearsToFetch.length} years of history: ${yearsToFetch.join(', ')}`);
    } else {
      // Subsequent runs: only fetch years from since date to current year
      // This minimizes API calls while still catching updates from the since year
      const sinceDate = new Date(params.since!);
      const sinceYear = sinceDate.getFullYear();
      yearsToFetch = [];
      for (let year = sinceYear; year <= currentYear; year++) {
        yearsToFetch.push(year);
      }
      // Cap at 2 years max to conserve API credits
      if (yearsToFetch.length > 2) {
        yearsToFetch = yearsToFetch.slice(-2);
      }
      console.log(`📅 Fetching years since ${params.since!.split('T')[0]}: ${yearsToFetch.join(', ')}`);
    }
    
    // Parse since date for post-fetch filtering (LegiScan API doesn't support date filtering)
    const sinceDate = params.since ? new Date(params.since) : null;
    let totalFetched = 0;
    let afterSinceCount = 0;
    
    for (const state of states) {
      for (const year of yearsToFetch) {
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
            errors.push(`LegiScan error for ${state} (${year}): ${response.status}`);
            continue;
          }

          const data = await response.json();
          
          if (data.status === 'ERROR') {
            errors.push(`LegiScan error for ${state} (${year}): ${JSON.stringify(data)}`);
            continue;
          }

          const results = data.searchresult || {};
          let stateYearCount = 0;
          for (const key of Object.keys(results)) {
            if (key === 'summary') continue;
            const bill = results[key];
            if (bill && bill.bill_id) {
              totalFetched++;
              
              // Post-fetch filtering: only include bills updated since last run
              if (sinceDate && bill.status_date) {
                const billDate = new Date(bill.status_date);
                if (billDate < sinceDate) {
                  continue; // Skip bills that haven't been updated since last run
                }
                afterSinceCount++;
              }
              
              const normalized = normalizeBill({ ...bill, state });
              if (!normalized.topics.includes('not_relevant')) {
                items.push(normalized);
                stateYearCount++;
              }
            }
          }
          
          console.log(`🔍 LegiScan ${state} (${year}): Found ${stateYearCount} relevant bills`);
          
        } catch (error) {
          errors.push(`LegiScan fetch error for ${state} (${year}): ${error}`);
        }
      }
    }
    
    if (sinceDate) {
      console.log(`📊 LegiScan filtering: ${totalFetched} total → ${afterSinceCount} since ${sinceDate.toISOString().split('T')[0]} → ${items.length} relevant`);
    }

    return { items, errors };
  }
}

export const legiscanAdapter = new LegiScanAdapter();
registerAdapter(legiscanAdapter);
