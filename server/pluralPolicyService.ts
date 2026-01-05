// Plural Policy (Open States) API v3 integration for tracking landlord-tenant legislation
// API Documentation: https://v3.openstates.org/docs/

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
  from_organization: {
    name: string;
    classification: string;
  };
  classification: string[];
  subject: string[];
  abstracts: Array<{
    abstract: string;
    note: string;
  }>;
  other_titles: Array<{
    title: string;
    note: string;
  }>;
  other_identifiers: Array<{
    identifier: string;
    scheme: string;
  }>;
  actions: Array<{
    date: string;
    description: string;
    classification: string[];
    order: number;
    organization: {
      name: string;
      classification: string;
    };
  }>;
  sponsorships: Array<{
    name: string;
    entity_type: string;
    primary: boolean;
    classification: string;
    person: {
      id: string;
      name: string;
    } | null;
  }>;
  sources: Array<{
    url: string;
    note: string;
  }>;
  versions: Array<{
    note: string;
    date: string;
    links: Array<{
      url: string;
      media_type: string;
    }>;
  }>;
  created_at: string;
  updated_at: string;
  extras: Record<string, any>;
  openstates_url: string;
}

interface PluralBillsResponse {
  results: PluralBill[];
  pagination: {
    per_page: number;
    page: number;
    max_page: number;
    total_items: number;
  };
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

const LANDLORD_TENANT_SEARCH_TERMS = [
  'landlord tenant',
  'rental property',
  'eviction',
  'lease agreement',
  'security deposit',
  'tenant rights',
  'housing rental',
  'residential lease',
];

class PluralPolicyService {
  private baseUrl = 'https://v3.openstates.org';
  private apiKey: string;
  private requestQueue: Array<() => Promise<any>> = [];
  private lastRequestTime = 0;
  private minRequestInterval = 1100; // 1 request per second + buffer

  constructor() {
    this.apiKey = process.env.PLURAL_POLICY_API_KEY || '';
    if (!this.apiKey) {
      console.warn('⚠️ PLURAL_POLICY_API_KEY not set. Plural Policy integration will not work.');
    }
  }

  private async rateLimitedFetch(url: string): Promise<Response | null> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minRequestInterval) {
      await new Promise(resolve => setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest));
    }
    
    this.lastRequestTime = Date.now();

    try {
      const response = await fetch(url, {
        headers: {
          'X-API-KEY': this.apiKey,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 429) {
          console.warn('⚠️ Plural Policy rate limit exceeded, waiting 60s...');
          await new Promise(resolve => setTimeout(resolve, 60000));
          return this.rateLimitedFetch(url);
        }
        console.error(`Plural Policy API error: ${response.status} ${response.statusText}`);
        return null;
      }

      return response;
    } catch (error) {
      console.error('Plural Policy API request failed:', error);
      return null;
    }
  }

  async searchBills(stateId: string, year?: number): Promise<PluralBillsResponse | null> {
    if (!this.apiKey) {
      console.warn('Plural Policy API key not configured');
      return null;
    }

    const jurisdiction = STATE_JURISDICTION_MAP[stateId];
    if (!jurisdiction) {
      console.warn(`No Plural Policy jurisdiction mapping for state: ${stateId}`);
      return null;
    }

    const sessionYear = year || new Date().getFullYear();
    const allResults: PluralBill[] = [];

    for (const searchTerm of LANDLORD_TENANT_SEARCH_TERMS) {
      const params = new URLSearchParams({
        jurisdiction: jurisdiction,
        q: searchTerm,
        session: sessionYear.toString(),
        per_page: '20',
        page: '1',
      });

      const url = `${this.baseUrl}/bills?${params.toString()}`;
      console.log(`  🔍 Plural Policy searching ${stateId}: "${searchTerm}"`);
      
      const response = await this.rateLimitedFetch(url);
      if (!response) continue;

      try {
        const data: PluralBillsResponse = await response.json();
        
        for (const bill of data.results) {
          if (!allResults.some(b => b.id === bill.id)) {
            allResults.push(bill);
          }
        }
      } catch (error) {
        console.error('Failed to parse Plural Policy response:', error);
      }
    }

    return {
      results: allResults,
      pagination: {
        per_page: allResults.length,
        page: 1,
        max_page: 1,
        total_items: allResults.length,
      },
    };
  }

  async getBill(billId: string): Promise<PluralBill | null> {
    if (!this.apiKey) return null;

    const url = `${this.baseUrl}/bills/${billId}`;
    const response = await this.rateLimitedFetch(url);
    
    if (!response) return null;

    try {
      return await response.json();
    } catch (error) {
      console.error('Failed to parse bill details:', error);
      return null;
    }
  }

  async getBillByJurisdiction(stateId: string, session: string, billNumber: string): Promise<PluralBill | null> {
    if (!this.apiKey) return null;

    const jurisdiction = STATE_JURISDICTION_MAP[stateId];
    if (!jurisdiction) return null;

    const url = `${this.baseUrl}/bills/${encodeURIComponent(jurisdiction)}/${encodeURIComponent(session)}/${encodeURIComponent(billNumber)}`;
    const response = await this.rateLimitedFetch(url);
    
    if (!response) return null;

    try {
      return await response.json();
    } catch (error) {
      console.error('Failed to parse bill details:', error);
      return null;
    }
  }

  isRelevantBill(bill: PluralBill): boolean {
    const relevantSubjects = [
      'housing',
      'landlord',
      'tenant',
      'rental',
      'eviction',
      'lease',
      'property',
      'security deposit',
      'fair housing',
      'residential',
    ];

    const titleLower = (bill.title || '').toLowerCase();
    const abstractText = (bill.abstracts || []).map(a => a.abstract?.toLowerCase() || '').join(' ');
    const subjects = (bill.subject || []).map(s => s.toLowerCase());
    const combinedText = `${titleLower} ${abstractText} ${subjects.join(' ')}`;

    return relevantSubjects.some(term => combinedText.includes(term));
  }

  getLastAction(bill: PluralBill): { date: string; description: string } | null {
    if (!bill.actions || bill.actions.length === 0) return null;
    
    const sortedActions = [...bill.actions].sort((a, b) => b.order - a.order);
    const lastAction = sortedActions[0];
    
    return {
      date: lastAction.date,
      description: lastAction.description,
    };
  }

  getBillUrl(bill: PluralBill): string {
    if (bill.openstates_url) return bill.openstates_url;
    const sources = bill.sources || [];
    if (sources.length > 0 && sources[0].url) return sources[0].url;
    return `https://open.pluralpolicy.com/`;
  }

  getBillText(bill: PluralBill): string | null {
    if (!bill.versions || bill.versions.length === 0) return null;
    
    const latestVersion = bill.versions[bill.versions.length - 1];
    if (latestVersion.links && latestVersion.links.length > 0) {
      return latestVersion.links[0].url;
    }
    
    return null;
  }

  convertToStandardFormat(bill: PluralBill, stateId: string): {
    billId: string;
    stateId: string;
    billNumber: string;
    title: string;
    description: string;
    status: string;
    lastActionDate: string | null;
    lastAction: string | null;
    billUrl: string;
    source: 'plural_policy';
  } {
    const lastAction = this.getLastAction(bill);
    const abstracts = bill.abstracts || [];
    
    return {
      billId: `pp_${bill.id}`,
      stateId: stateId,
      billNumber: bill.identifier || '',
      title: bill.title || '',
      description: abstracts[0]?.abstract || bill.title || '',
      status: lastAction?.description || 'Unknown',
      lastActionDate: lastAction?.date || null,
      lastAction: lastAction?.description || null,
      billUrl: this.getBillUrl(bill),
      source: 'plural_policy',
    };
  }
}

export const pluralPolicyService = new PluralPolicyService();
