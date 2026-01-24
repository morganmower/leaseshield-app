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
  id?: number;
  url?: string;
  absolute_url?: string;
  case_name?: string;
  case_name_full?: string;
  case_name_short?: string;
  case_number?: string;
  date_filed?: string;
  date_filed_is_approximate?: boolean;
  slug?: string;
  citations?: Array<{
    id: number;
    volume: number;
    reporter: string;
    page: number;
    type: string;
  }>;
  source?: string;
  court?: string;
  court_id?: number;
  judges?: string[];
  nature_of_suit?: string;
  precedential_status?: string;
  date_last_filing?: string;
  date_last_index?: string;
  // v4 API fields
  [key: string]: any;
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
    // State to CourtListener court IDs mapping - all 16 supported states
    // Format: state supreme court, state appeals court, federal circuit court
    AZ: ['supreme-court-of-arizona', 'court-of-appeals-of-arizona', 'court-of-appeals-of-the-united-states-ninth-circuit'],
    CA: ['supreme-court-of-california', 'court-of-appeals-of-california', 'court-of-appeals-of-the-united-states-ninth-circuit'],
    FL: ['supreme-court-of-florida', 'district-court-of-appeal-of-florida', 'court-of-appeals-of-the-united-states-eleventh-circuit'],
    ID: ['supreme-court-of-idaho', 'court-of-appeals-of-idaho', 'court-of-appeals-of-the-united-states-ninth-circuit'],
    IL: ['supreme-court-of-illinois', 'appellate-court-of-illinois', 'court-of-appeals-of-the-united-states-seventh-circuit'],
    MI: ['supreme-court-of-michigan', 'court-of-appeals-of-michigan', 'court-of-appeals-of-the-united-states-sixth-circuit'],
    NC: ['supreme-court-of-north-carolina', 'court-of-appeals-of-north-carolina', 'court-of-appeals-of-the-united-states-fourth-circuit'],
    ND: ['supreme-court-of-north-dakota', 'court-of-appeals-of-north-dakota', 'court-of-appeals-of-the-united-states-eighth-circuit'],
    NM: ['supreme-court-of-new-mexico', 'court-of-appeals-of-new-mexico', 'court-of-appeals-of-the-united-states-tenth-circuit'],
    NV: ['supreme-court-of-nevada', 'court-of-appeals-of-nevada', 'court-of-appeals-of-the-united-states-ninth-circuit'],
    OH: ['supreme-court-of-ohio', 'court-of-appeals-of-ohio', 'court-of-appeals-of-the-united-states-sixth-circuit'],
    SD: ['supreme-court-of-south-dakota', 'court-of-appeals-of-south-dakota', 'court-of-appeals-of-the-united-states-eighth-circuit'],
    TX: ['supreme-court-of-texas', 'court-of-appeals-of-texas', 'court-of-appeals-of-the-united-states-fifth-circuit'],
    UT: ['supreme-court-of-utah', 'court-of-appeals-of-utah', 'court-of-appeals-of-the-united-states-tenth-circuit'],
    VA: ['supreme-court-of-virginia', 'court-of-appeals-of-virginia', 'court-of-appeals-of-the-united-states-fourth-circuit'],
    WY: ['supreme-court-of-wyoming', 'court-of-appeals-of-the-united-states-tenth-circuit'],
  };

  constructor() {
    this.apiKey = process.env.COURTLISTENER_API_KEY || '';
    if (!this.apiKey) {
      console.warn('⚠️ COURTLISTENER_API_KEY not set. Case law monitoring will not work.');
    }
  }

  /**
   * Search for case law related to landlord-tenant law
   * @param stateId - The state to search for (e.g., 'UT', 'TX')
   * @param keywords - Optional custom keywords (defaults to landlord-tenant terms)
   * @param daysBack - How many days back to search (default 60)
   */
  async searchCases(stateId: string, keywords: string[] = [], daysBack: number = 60): Promise<CourtListenerSearchResponse | null> {
    if (!this.apiKey) {
      console.warn(`⚠️ COURTLISTENER_API_KEY not set, skipping search for ${stateId}`);
      return null;
    }

    try {
      // Default landlord-tenant keywords for v4 API
      const searchTerms = keywords.length > 0 ? keywords : [
        'landlord tenant',
        'eviction',
        'lease agreement',
        'security deposit',
        'unlawful detainer',
        'fair housing',
      ];

      // Calculate date range for recent cases
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      // Get state courts for filtering
      const stateCourts = this.stateCourtMap[stateId] || [];

      // v4 API search endpoint
      const url = new URL(`${this.baseUrl}/search/`);
      
      // Build query with date filter and keywords
      const query = `(${searchTerms.join(' OR ')}) AND filed_after:${startDateStr} AND filed_before:${endDateStr}`;
      url.searchParams.set('q', query);
      url.searchParams.set('type', 'o'); // opinions only
      url.searchParams.set('format', 'json');
      url.searchParams.set('order_by', 'dateFiled desc');
      url.searchParams.set('limit', '25');
      
      // Add court filter if we have courts mapped for this state
      if (stateCourts.length > 0) {
        url.searchParams.set('court', stateCourts.join(','));
      }

      const headers: HeadersInit = {
        'Authorization': `Token ${this.apiKey}`,
        'Accept': 'application/json',
      };

      console.log(`🔍 Searching CourtListener for ${stateId} case law (${startDateStr} to ${endDateStr})`);
      console.log(`   Query: "${query.substring(0, 80)}..."`);
      const response = await fetch(url.toString(), { headers });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`CourtListener API error: ${response.status} ${response.statusText}`);
        console.error(`Response: ${errorText}`);
        return null;
      }

      const data = await response.json();
      
      // Handle v4 API response structure
      if (!data || (!data.results && !data.data)) {
        console.log(`⚠️ Invalid response structure from CourtListener`);
        return null;
      }

      // Transform v4 response to match our expected format
      const rawResults = data.results || data.data || [];
      const totalCount = data.count || data.total_count || rawResults.length;

      // Convert camelCase API response to snake_case for our schema
      const results = rawResults.map((item: any) => ({
        id: item.cluster_id || item.id,
        url: item.url || `https://www.courtlistener.com${item.absolute_url}`,
        absolute_url: item.absolute_url || '',
        case_name: item.caseName || item.case_name || '',
        case_name_full: item.caseNameFull || item.case_name_full || '',
        case_name_short: item.caseNameShort || item.case_name_short || '',
        case_number: item.caseNumber || item.case_number || '',
        date_filed: item.dateFiled || item.date_filed || '',
        date_filed_is_approximate: item.dateFiledIsApproximate || item.date_filed_is_approximate || false,
        slug: item.slug || '',
        citations: item.citation || item.citations || [],
        source: item.source || '',
        court: item.court || item.court_id || '',
        court_id: item.court_id || 0,
        judges: item.judges || [],
        nature_of_suit: item.nature_of_suit || '',
        precedential_status: item.precedential_status || '',
        date_last_filing: item.date_last_filing || '',
        date_last_index: item.date_last_index || '',
      }));

      const transformedResponse: CourtListenerSearchResponse = {
        meta: {
          limit: 20,
          next: data.next || null,
          offset: 0,
          previous: data.previous || null,
          total_count: totalCount,
        },
        results: results,
      };

      console.log(`✅ Found ${totalCount} case law matches for ${stateId}`);
      return transformedResponse;
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
      title: caseData.case_name_full || caseData.case_name || '',
      citation: this.formatCitation(caseData),
      court: caseData.court || '',
      dateFiled: caseData.date_filed || '',
      caseNumber: caseData.case_number || '',
      url: `https://www.courtlistener.com${caseData.absolute_url || ''}`,
    };
  }
}

export const courtListenerService = new CourtListenerService();
