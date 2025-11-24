// CourtListener API integration for tracking case law changes
// API Documentation: https://www.courtlistener.com/help/api/rest/
// Free tier: 5,000 queries/hour for authenticated users

interface CourtListenerOpinion {
  id: number;
  url: string;
  absolute_url: string;
  cluster_id: number;
  resource_uri: string;
  judge_id: number;
  opinion_type: string;
  date_filed: string;
  page_count: number;
  download_url: string;
  plain_text: string;
  html: string;
  per_curiam: boolean;
  joined_by: number[];
}

interface CourtListenerCluster {
  id: number;
  url: string;
  absolute_url: string;
  case_name: string;
  case_name_full: string;
  case_name_short: string;
  case_number: string;
  date_filed: string;
  date_filed_is_approximate: boolean;
  slug: string;
  citations: Array<{
    id: number;
    volume: number;
    reporter: string;
    page: number;
    type: string;
  }>;
  source: string;
  court: string;
  court_id: number;
  judges: string[];
  nature_of_suit: string;
  precedential_status: string;
  date_last_filing: string;
  date_last_index: string;
}

interface CourtListenerSearchResponse {
  meta: {
    limit: number;
    next: string | null;
    offset: number;
    previous: string | null;
    total_count: number;
  };
  results: CourtListenerCluster[];
}

export class CourtListenerService {
  private apiKey: string;
  private baseUrl = 'https://www.courtlistener.com/api/rest/v4';
  private stateCourtMap: { [key: string]: string[] } = {
    // State to CourtListener court IDs mapping
    UT: ['court-of-appeals-of-utah', 'supreme-court-of-utah', 'court-of-appeals-of-the-united-states-tenth-circuit'],
    TX: ['court-of-appeals-of-texas', 'supreme-court-of-texas', 'court-of-appeals-of-the-united-states-fifth-circuit'],
    ND: ['court-of-appeals-of-north-dakota', 'supreme-court-of-north-dakota', 'court-of-appeals-of-the-united-states-eighth-circuit'],
    SD: ['court-of-appeals-of-south-dakota', 'supreme-court-of-south-dakota', 'court-of-appeals-of-the-united-states-eighth-circuit'],
  };

  constructor() {
    this.apiKey = process.env.COURTLISTENER_API_KEY || '';
    if (!this.apiKey) {
      console.warn('⚠️ COURTLISTENER_API_KEY not set. Case law monitoring will not work.');
    }
  }

  /**
   * Search for case law related to landlord-tenant law
   */
  async searchCases(stateId: string, keywords: string[] = []): Promise<CourtListenerSearchResponse | null> {
    try {
      // Default landlord-tenant keywords for v4 API
      const searchTerms = keywords.length > 0 ? keywords : [
        'landlord tenant',
        'eviction',
        'lease',
        'rental',
      ];

      // v4 API uses simpler query format - just search terms, no complex syntax
      const query = searchTerms.join(' OR ');

      const url = new URL(`${this.baseUrl}/search/`);
      url.searchParams.set('q', query);
      url.searchParams.set('type', 'case');
      url.searchParams.set('format', 'json');
      url.searchParams.set('limit', '20');

      const headers: HeadersInit = {
        'Authorization': `Token ${this.apiKey}`,
        'Accept': 'application/json',
      };

      console.log(`🔍 Searching CourtListener for ${stateId} case law with query: "${query}"`);
      const response = await fetch(url.toString(), { headers });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`CourtListener API error: ${response.status} ${response.statusText}`);
        console.error(`Response: ${errorText}`);
        return null;
      }

      const data: CourtListenerSearchResponse = await response.json();

      console.log(`✅ Found ${data.meta.total_count} case law matches for ${stateId}`);
      return data;
    } catch (error) {
      console.error('Error searching CourtListener:', error);
      return null;
    }
  }

  /**
   * Get detailed information about a specific case
   */
  async getCase(clusterId: number): Promise<CourtListenerCluster | null> {
    try {
      const url = new URL(`${this.baseUrl}/clusters/${clusterId}/`);
      url.searchParams.set('format', 'json');

      const headers: HeadersInit = {
        'Authorization': `Token ${this.apiKey}`,
        'Accept': 'application/json',
      };

      const response = await fetch(url.toString(), { headers });

      if (!response.ok) {
        console.error(`CourtListener API error: ${response.status} ${response.statusText}`);
        return null;
      }

      const data: CourtListenerCluster = await response.json();
      return data;
    } catch (error) {
      console.error(`Error fetching case ${clusterId}:`, error);
      return null;
    }
  }

  /**
   * Get opinion text for a specific case
   */
  async getCaseOpinion(opinionId: number): Promise<CourtListenerOpinion | null> {
    try {
      const url = new URL(`${this.baseUrl}/opinions/${opinionId}/`);
      url.searchParams.set('format', 'json');

      const headers: HeadersInit = {
        'Authorization': `Token ${this.apiKey}`,
        'Accept': 'application/json',
      };

      const response = await fetch(url.toString(), { headers });

      if (!response.ok) {
        console.error(`CourtListener API error: ${response.status} ${response.statusText}`);
        return null;
      }

      const data: CourtListenerOpinion = await response.json();
      return data;
    } catch (error) {
      console.error(`Error fetching opinion ${opinionId}:`, error);
      return null;
    }
  }

  /**
   * Check if a case is relevant to landlord-tenant law
   */
  isRelevantCase(caseData: CourtListenerCluster): boolean {
    const relevantKeywords = [
      'landlord',
      'tenant',
      'lease',
      'eviction',
      'security deposit',
      'rental',
      'residential',
      'housing',
      'rent',
      'deposit',
      'notice',
      'occupancy',
    ];

    const textToCheck = [
      caseData.case_name,
      caseData.case_name_full,
      caseData.case_name_short,
      caseData.nature_of_suit || '',
    ]
      .join(' ')
      .toLowerCase();

    return relevantKeywords.some(keyword => textToCheck.includes(keyword));
  }

  /**
   * Format case citation for display
   */
  formatCitation(caseData: CourtListenerCluster): string {
    if (caseData.citations && caseData.citations.length > 0) {
      const citation = caseData.citations[0];
      return `${citation.volume} ${citation.reporter} ${citation.page}`;
    }
    return caseData.case_number || `Cluster ID: ${caseData.id}`;
  }

  /**
   * Get case details formatted for storage
   */
  getCaseDetails(caseData: CourtListenerCluster): {
    title: string;
    citation: string;
    court: string;
    dateFiled: string;
    caseNumber: string;
    url: string;
  } {
    return {
      title: caseData.case_name_full || caseData.case_name,
      citation: this.formatCitation(caseData),
      court: caseData.court,
      dateFiled: caseData.date_filed,
      caseNumber: caseData.case_number,
      url: `https://www.courtlistener.com${caseData.absolute_url}`,
    };
  }
}

export const courtListenerService = new CourtListenerService();
