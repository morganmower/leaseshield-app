// LegiScan API integration for tracking landlord-tenant legislation
// API Documentation: https://legiscan.com/legiscan

interface LegiScanBill {
  bill_id: number;
  change_hash: string;
  session_id: number;
  session: {
    session_id: number;
    state_id: number;
    year_start: number;
    year_end: number;
    special: number;
    session_name: string;
  };
  url: string;
  state_link: string;
  completed: number;
  status: number;
  status_date: string;
  progress: Array<{
    date: string;
    event: number;
  }>;
  state: string;
  state_id: number;
  bill_number: string;
  bill_type: string;
  bill_type_id: string;
  body: string;
  body_id: number;
  current_body: string;
  current_body_id: number;
  title: string;
  description: string;
  pending_committee_id: number;
  committee: {
    committee_id: number;
    chamber: string;
    chamber_id: number;
    name: string;
  };
  history: Array<{
    date: string;
    action: string;
    chamber: string;
    chamber_id: number;
    importance: number;
  }>;
  sponsors: Array<{
    people_id: number;
    person_hash: string;
    party_id: string;
    party: string;
    role_id: number;
    role: string;
    name: string;
    first_name: string;
    middle_name: string;
    last_name: string;
    suffix: string;
    nickname: string;
    district: string;
    ftm_eid: number;
    votesmart_id: number;
    opensecrets_id: string;
    ballotpedia: string;
    sponsor_type_id: number;
    sponsor_order: number;
    committee_sponsor: number;
    committee_id: number;
  }>;
  sasts: Array<any>;
  subjects: Array<{
    subject_id: number;
    subject_name: string;
  }>;
  texts: Array<{
    doc_id: number;
    date: string;
    type: string;
    type_id: number;
    mime: string;
    mime_id: number;
    url: string;
    state_link: string;
    text_size: number;
  }>;
  votes: Array<any>;
  amendments: Array<any>;
  supplements: Array<any>;
  calendar: Array<any>;
}

interface LegiScanSearchResponse {
  status: string;
  searchresult: {
    summary: {
      count: number;
      page_current: number;
      page_total: number;
      relevance_map: {
        [key: string]: string;
      };
    };
    [key: string]: any;
  };
}

interface LegiScanBillResponse {
  status: string;
  bill: LegiScanBill;
}

export class LegiScanService {
  private apiKey: string;
  private baseUrl = 'https://api.legiscan.com';

  constructor() {
    this.apiKey = process.env.LEGISCAN_API_KEY || '';
    if (!this.apiKey) {
      console.warn('⚠️ LEGISCAN_API_KEY not set. Legislative monitoring will not work.');
    }
  }

  /**
   * Search for bills related to landlord-tenant law in a specific state
   */
  async searchBills(stateAbbrev: string, year: number): Promise<LegiScanSearchResponse | null> {
    try {
      // Search for bills with landlord/tenant/rental/eviction keywords
      const keywords = [
        'landlord',
        'tenant',
        'rental',
        'eviction',
        'lease',
        'housing',
        'residential tenancy',
      ];

      const query = keywords.join(' OR ');
      const url = new URL(`${this.baseUrl}/`);
      url.searchParams.set('key', this.apiKey);
      url.searchParams.set('op', 'getSearch');
      url.searchParams.set('state', stateAbbrev);
      url.searchParams.set('query', query);
      url.searchParams.set('year', year.toString());

      console.log(`🔍 Searching LegiScan for ${stateAbbrev} ${year} bills...`);
      const response = await fetch(url.toString());

      if (!response.ok) {
        console.error(`LegiScan API error: ${response.status} ${response.statusText}`);
        return null;
      }

      const data: LegiScanSearchResponse = await response.json();

      if (data.status === 'ERROR') {
        console.error('LegiScan search error:', data);
        return null;
      }

      console.log(`✅ Found ${data.searchresult.summary.count} bills for ${stateAbbrev}`);
      return data;
    } catch (error) {
      console.error('Error searching LegiScan:', error);
      return null;
    }
  }

  /**
   * Get detailed information about a specific bill
   */
  async getBill(billId: number): Promise<LegiScanBill | null> {
    try {
      const url = new URL(`${this.baseUrl}/`);
      url.searchParams.set('key', this.apiKey);
      url.searchParams.set('op', 'getBill');
      url.searchParams.set('id', billId.toString());

      const response = await fetch(url.toString());

      if (!response.ok) {
        console.error(`LegiScan API error: ${response.status} ${response.statusText}`);
        return null;
      }

      const data: LegiScanBillResponse = await response.json();

      if (data.status === 'ERROR') {
        console.error('LegiScan bill fetch error:', data);
        return null;
      }

      return data.bill;
    } catch (error) {
      console.error(`Error fetching bill ${billId}:`, error);
      return null;
    }
  }

  /**
   * Get bill text content
   */
  async getBillText(billId: number): Promise<string | null> {
    try {
      const url = new URL(`${this.baseUrl}/`);
      url.searchParams.set('key', this.apiKey);
      url.searchParams.set('op', 'getBillText');
      url.searchParams.set('id', billId.toString());

      const response = await fetch(url.toString());

      if (!response.ok) {
        console.error(`LegiScan API error: ${response.status} ${response.statusText}`);
        return null;
      }

      const data = await response.json();

      if (data.status === 'ERROR') {
        console.error('LegiScan text fetch error:', data);
        return null;
      }

      // The text comes base64 encoded
      if (data.text && data.text.doc) {
        return Buffer.from(data.text.doc, 'base64').toString('utf-8');
      }

      return null;
    } catch (error) {
      console.error(`Error fetching bill text ${billId}:`, error);
      return null;
    }
  }

  /**
   * Map LegiScan bill status to our internal status
   */
  mapBillStatus(statusCode: number): 'introduced' | 'in_committee' | 'passed_chamber' | 'passed_both' | 'signed' | 'vetoed' | 'dead' {
    // LegiScan status codes:
    // 1 = Introduced
    // 2 = Engrossed (passed first chamber)
    // 3 = Enrolled (passed both chambers)
    // 4 = Passed (sent to executive)
    // 5 = Vetoed
    // 6 = Failed/Dead
    // 7 = Override (veto overridden)

    switch (statusCode) {
      case 1:
        return 'introduced';
      case 2:
        return 'passed_chamber';
      case 3:
      case 4:
        return 'passed_both';
      case 5:
        return 'vetoed';
      case 6:
        return 'dead';
      case 7:
        return 'signed'; // Veto overridden becomes law
      default:
        return 'introduced';
    }
  }

  /**
   * Extract the most recent action from bill history
   */
  getLastAction(bill: LegiScanBill): { action: string; date: string } {
    if (bill.history && bill.history.length > 0) {
      const latest = bill.history[bill.history.length - 1];
      return {
        action: latest.action,
        date: latest.date,
      };
    }
    return {
      action: 'Unknown',
      date: new Date().toISOString(),
    };
  }

  /**
   * Check if a bill is relevant to landlord-tenant law based on keywords
   */
  isRelevantBill(bill: LegiScanBill): boolean {
    const relevantKeywords = [
      'landlord',
      'tenant',
      'rental',
      'eviction',
      'lease',
      'rent',
      'housing',
      'residential',
      'security deposit',
      'notice to quit',
      'habitability',
      'renters',
    ];

    const searchText = `${bill.title} ${bill.description}`.toLowerCase();

    return relevantKeywords.some(keyword => searchText.includes(keyword.toLowerCase()));
  }
}

export const legiscanService = new LegiScanService();
