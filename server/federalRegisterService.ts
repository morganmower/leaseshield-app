// Federal Register API integration for tracking HUD housing regulations
// API Documentation: https://www.federalregister.gov/developers/documentation/api/v1

interface FederalRegisterDocument {
  document_number: string;
  title: string;
  type: string; // 'Rule', 'Proposed Rule', 'Notice', 'Presidential Document'
  abstract: string;
  html_url: string;
  pdf_url: string;
  publication_date: string;
  agencies: Array<{
    raw_name: string;
    name: string;
    id: number;
    parent_id: number | null;
    slug: string;
  }>;
  agency_names: string[];
  cfr_references: Array<{
    title: number;
    part: number;
  }>;
  action: string | null;
  dates: string | null;
  effective_on: string | null;
  comments_close_on: string | null;
  significant: boolean;
  subtype: string | null;
  topics: string[];
  excerpts: string;
  json_url: string;
}

interface FederalRegisterSearchResponse {
  count: number;
  description: string;
  total_pages: number;
  next_page_url: string | null;
  results: FederalRegisterDocument[];
}

const HOUSING_SEARCH_TERMS = [
  'landlord',
  'tenant',
  'eviction',
  'rental housing',
  'fair housing',
  'lease',
  'security deposit',
  'housing discrimination',
  'Section 8',
  'public housing',
];

const HUD_AGENCY_SLUGS = [
  'housing-and-urban-development-department',
];

class FederalRegisterService {
  private baseUrl = 'https://www.federalregister.gov/api/v1';
  private dataGovApiKey: string;

  constructor() {
    this.dataGovApiKey = process.env.DATA_GOV_API_KEY || '';
    if (!this.dataGovApiKey) {
      console.warn('⚠️ DATA_GOV_API_KEY not set. Federal Register integration may have limited access.');
    }
  }

  async searchDocuments(options: {
    searchTerm?: string;
    agencySlug?: string;
    documentTypes?: string[];
    publicationDateFrom?: string;
    publicationDateTo?: string;
    perPage?: number;
    page?: number;
  }): Promise<FederalRegisterSearchResponse | null> {
    const params = new URLSearchParams();

    if (options.searchTerm) {
      params.append('conditions[term]', options.searchTerm);
    }

    if (options.agencySlug) {
      params.append('conditions[agencies][]', options.agencySlug);
    }

    if (options.documentTypes && options.documentTypes.length > 0) {
      options.documentTypes.forEach(type => {
        params.append('conditions[type][]', type);
      });
    }

    if (options.publicationDateFrom) {
      params.append('conditions[publication_date][gte]', options.publicationDateFrom);
    }

    if (options.publicationDateTo) {
      params.append('conditions[publication_date][lte]', options.publicationDateTo);
    }

    params.append('per_page', String(options.perPage || 20));
    params.append('page', String(options.page || 1));
    params.append('order', 'newest');

    // Request specific fields to reduce response size
    const fields = [
      'document_number',
      'title',
      'type',
      'abstract',
      'html_url',
      'pdf_url',
      'publication_date',
      'agencies',
      'agency_names',
      'action',
      'dates',
      'effective_on',
      'comments_close_on',
      'significant',
      'topics',
      'excerpts',
    ];
    fields.forEach(field => params.append('fields[]', field));

    const url = `${this.baseUrl}/documents.json?${params.toString()}`;

    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          ...(this.dataGovApiKey && { 'X-Api-Key': this.dataGovApiKey }),
        },
      });

      if (!response.ok) {
        console.error(`Federal Register API error: ${response.status} ${response.statusText}`);
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('Federal Register API request failed:', error);
      return null;
    }
  }

  async getRecentHUDDocuments(daysBack: number = 30): Promise<FederalRegisterDocument[]> {
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - daysBack);

    const fromDateStr = fromDate.toISOString().split('T')[0];
    const toDateStr = toDate.toISOString().split('T')[0];

    console.log(`📜 Fetching Federal Register HUD documents from ${fromDateStr} to ${toDateStr}...`);

    const allDocuments: FederalRegisterDocument[] = [];

    // Search for HUD agency documents
    for (const agencySlug of HUD_AGENCY_SLUGS) {
      console.log(`  🔍 Searching Federal Register for agency: ${agencySlug}`);
      
      const result = await this.searchDocuments({
        agencySlug,
        documentTypes: ['RULE', 'PRORULE', 'NOTICE'],
        publicationDateFrom: fromDateStr,
        publicationDateTo: toDateStr,
        perPage: 50,
      });

      if (result && result.results) {
        for (const doc of result.results) {
          if (!allDocuments.some(d => d.document_number === doc.document_number)) {
            allDocuments.push(doc);
          }
        }
      }
    }

    // Also search by housing-related terms
    for (const term of HOUSING_SEARCH_TERMS.slice(0, 5)) { // Limit to avoid too many requests
      console.log(`  🔍 Searching Federal Register for term: "${term}"`);
      
      const result = await this.searchDocuments({
        searchTerm: term,
        documentTypes: ['RULE', 'PRORULE'],
        publicationDateFrom: fromDateStr,
        publicationDateTo: toDateStr,
        perPage: 20,
      });

      if (result && result.results) {
        for (const doc of result.results) {
          // Only include if HUD-related or housing-focused
          const isHUDRelated = doc.agency_names?.some(name => 
            name.toLowerCase().includes('housing') || 
            name.toLowerCase().includes('hud')
          );
          
          if (isHUDRelated && !allDocuments.some(d => d.document_number === doc.document_number)) {
            allDocuments.push(doc);
          }
        }
      }
    }

    console.log(`  ✅ Found ${allDocuments.length} federal housing documents`);
    return allDocuments;
  }

  async getDocument(documentNumber: string): Promise<FederalRegisterDocument | null> {
    const url = `${this.baseUrl}/documents/${documentNumber}.json`;

    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          ...(this.dataGovApiKey && { 'X-Api-Key': this.dataGovApiKey }),
        },
      });

      if (!response.ok) {
        console.error(`Federal Register API error: ${response.status}`);
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to fetch document:', error);
      return null;
    }
  }

  isLandlordTenantRelevant(doc: FederalRegisterDocument): boolean {
    const relevantTerms = [
      'landlord',
      'tenant',
      'eviction',
      'rental',
      'lease',
      'fair housing',
      'housing discrimination',
      'section 8',
      'voucher',
      'public housing',
      'security deposit',
      'habitability',
      'rent',
    ];

    const titleLower = (doc.title || '').toLowerCase();
    const abstractLower = (doc.abstract || '').toLowerCase();
    const topicsLower = (doc.topics || []).map(t => t.toLowerCase()).join(' ');
    const combinedText = `${titleLower} ${abstractLower} ${topicsLower}`;

    return relevantTerms.some(term => combinedText.includes(term));
  }

  getRelevanceLevel(doc: FederalRegisterDocument): 'high' | 'medium' | 'low' {
    const highPriorityTerms = ['eviction', 'tenant rights', 'fair housing', 'discrimination', 'section 8'];
    const mediumPriorityTerms = ['rental', 'lease', 'housing', 'landlord'];

    const combinedText = `${doc.title} ${doc.abstract || ''}`.toLowerCase();

    if (highPriorityTerms.some(term => combinedText.includes(term))) {
      return 'high';
    }
    if (mediumPriorityTerms.some(term => combinedText.includes(term))) {
      return 'medium';
    }
    return 'low';
  }

  getDocumentTypeLabel(type: string): string {
    const typeMap: Record<string, string> = {
      'Rule': 'Final Rule',
      'Proposed Rule': 'Proposed Rule',
      'Notice': 'Notice',
      'Presidential Document': 'Executive Order',
    };
    return typeMap[type] || type;
  }

  convertToStandardFormat(doc: FederalRegisterDocument): {
    billId: string;
    stateId: string;
    billNumber: string;
    title: string;
    description: string;
    status: string;
    lastActionDate: string | null;
    lastAction: string | null;
    billUrl: string;
    source: 'federal_register';
  } {
    return {
      billId: `fr_${doc.document_number}`,
      stateId: 'FED', // Federal designation
      billNumber: doc.document_number,
      title: doc.title || '',
      description: doc.abstract || doc.title || '',
      status: this.getDocumentTypeLabel(doc.type),
      lastActionDate: doc.publication_date || null,
      lastAction: doc.action || `Published: ${doc.publication_date}`,
      billUrl: doc.html_url || '',
      source: 'federal_register',
    };
  }
}

export const federalRegisterService = new FederalRegisterService();
