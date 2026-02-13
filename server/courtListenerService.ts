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
      const searchTerms = keywords.length > 0 ? keywords : [
        'landlord tenant',
        'eviction',
        'lease agreement',
        'security deposit',
        'unlawful detainer',
        'fair housing',
      ];

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      const stateNames: { [key: string]: string } = {
        AZ: 'arizona', CA: 'california', FL: 'florida', ID: 'idaho',
        IL: 'illinois', MI: 'michigan', NC: 'north carolina', ND: 'north dakota',
        NM: 'new mexico', NV: 'nevada', OH: 'ohio', SD: 'south dakota',
        TX: 'texas', UT: 'utah', VA: 'virginia', WY: 'wyoming',
      };

      const stateCourts: { [key: string]: string[] } = {
        AZ: ['ariz'],
        CA: ['cal', 'cacd', 'caeb', 'canb', 'casb'],
        FL: ['fla', 'flmd', 'flnd', 'flsd'],
        ID: ['id', 'idaho'],
        IL: ['ill', 'ilcd', 'ilnd', 'ilsd'],
        MI: ['mich', 'mied', 'miwd'],
        NC: ['nc', 'nceb', 'ncmd', 'ncwb'],
        ND: ['nd'],
        NM: ['nm'],
        NV: ['nev'],
        OH: ['ohio', 'ohnd', 'ohsd'],
        SD: ['sd'],
        TX: ['tex', 'txed', 'txnd', 'txsd', 'txwd'],
        UT: ['utah', 'utd'],
        VA: ['va', 'vaeb', 'vawb'],
        WY: ['wyo'],
      };

      const url = new URL(`${this.baseUrl}/search/`);

      const keywordPart = `(${searchTerms.join(' OR ')})`;
      const query = keywordPart;
      url.searchParams.set('q', query);
      url.searchParams.set('type', 'o');
      url.searchParams.set('format', 'json');
      url.searchParams.set('order_by', 'dateFiled desc');
      url.searchParams.set('filed_after', startDateStr);
      url.searchParams.set('filed_before', endDateStr);

      const courts = stateCourts[stateId];
      if (courts && courts.length > 0) {
        url.searchParams.set('court', courts.join(' '));
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

      // Convert camelCase API response to snake_case for our schema
      let results = rawResults.map((item: any) => ({
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

      results = results.filter((item: CourtListenerCluster) => {
        if (!item.date_filed) return false;
        const filed = new Date(item.date_filed);
        return filed >= startDate && filed <= endDate;
      });

      const transformedResponse: CourtListenerSearchResponse = {
        meta: {
          limit: 50,
          next: data.next || null,
          offset: 0,
          previous: data.previous || null,
          total_count: results.length,
        },
        results: results,
      };

      console.log(`✅ Found ${results.length} case law matches for ${stateId} (filtered from ${rawResults.length} total)`);
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
      if (typeof citation === 'string') return citation;
      if (citation.volume && citation.reporter && citation.page) {
        return `${citation.volume} ${citation.reporter} ${citation.page}`;
      }
    }
    if (caseData.case_number) return caseData.case_number;
    const name = caseData.case_name_short || caseData.case_name || '';
    const year = caseData.date_filed ? new Date(caseData.date_filed).getFullYear() : '';
    if (name && year) return `${name} (${year})`;
    return name || `Case ${caseData.id}`;
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

  async refreshCaseLaw(options?: { daysBack?: number; states?: string[] }): Promise<{
    searched: number;
    newCases: number;
    updatedCases: number;
    errors: string[];
  }> {
    const { db } = await import('./db');
    const { caseLawMonitoring } = await import('@shared/schema');
    const { eq } = await import('drizzle-orm');
    const { getActiveStateIds } = await import('./states/getActiveStates');

    const daysBack = options?.daysBack ?? 180;
    const stateIds = options?.states ?? await getActiveStateIds();
    const errors: string[] = [];
    let searched = 0;
    let newCases = 0;
    let updatedCases = 0;

    if (!this.apiKey) {
      errors.push('COURTLISTENER_API_KEY not configured');
      return { searched, newCases, updatedCases, errors };
    }

    console.log(`⚖️ Refreshing case law for ${stateIds.length} states (${daysBack} days back)...`);

    for (const stateId of stateIds) {
      try {
        const results = await this.searchCases(stateId, [], daysBack);
        searched++;

        if (!results || results.results.length === 0) {
          continue;
        }

        for (const cluster of results.results) {
          const caseIdStr = String(cluster.id);
          const caseName = cluster.case_name || cluster.case_name_full || '';
          if (!caseName) continue;

          const citation = this.formatCitation(cluster);
          const courtName = cluster.court || '';
          const dateFiled = cluster.date_filed ? new Date(cluster.date_filed) : null;
          const caseUrl = cluster.absolute_url
            ? `https://www.courtlistener.com${cluster.absolute_url}`
            : cluster.url || '';

          const relevance = this.isRelevantCase(cluster) ? 'high' : 'medium';

          const [existing] = await db
            .select({ id: caseLawMonitoring.id })
            .from(caseLawMonitoring)
            .where(eq(caseLawMonitoring.caseId, caseIdStr))
            .limit(1);

          if (existing) {
            await db
              .update(caseLawMonitoring)
              .set({
                caseName,
                citation,
                court: courtName,
                dateFiled,
                url: caseUrl,
                updatedAt: new Date(),
              })
              .where(eq(caseLawMonitoring.id, existing.id));
            updatedCases++;
          } else {
            await db.insert(caseLawMonitoring).values({
              caseId: caseIdStr,
              stateId,
              caseName,
              caseNameFull: cluster.case_name_full || null,
              citation,
              court: courtName,
              dateFiled,
              caseNumber: cluster.case_number || null,
              url: caseUrl,
              relevanceLevel: relevance as any,
              isMonitored: true,
              isReviewed: false,
            });
            newCases++;
          }
        }

        if (stateIds.indexOf(stateId) < stateIds.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error: any) {
        errors.push(`${stateId}: ${error.message || error}`);
        console.error(`❌ Error refreshing case law for ${stateId}:`, error);
      }
    }

    console.log(`✅ Case law refresh complete: ${searched} states searched, ${newCases} new, ${updatedCases} updated`);
    if (errors.length > 0) {
      console.log(`   ⚠️ Errors: ${errors.join('; ')}`);
    }

    return { searched, newCases, updatedCases, errors };
  }
}

export const courtListenerService = new CourtListenerService();
