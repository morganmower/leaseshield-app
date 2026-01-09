/**
 * Federal Register Adapter
 * 
 * Wraps the existing FederalRegisterService to output normalized items.
 * Supports both landlord-tenant and tribal housing (NAHASDA) topics.
 */

import { 
  LegislationSourceAdapter, 
  NormalizedLegislationItem, 
  SourceFetchParams, 
  SourceFetchResult,
  TopicTag 
} from "../types";
import { registerAdapter } from "../registry";

interface FederalRegisterDocument {
  document_number: string;
  title: string;
  type: string;
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
}

const NAHASDA_KEYWORDS = [
  'NAHASDA',
  'Native American Housing',
  'Indian Housing Block Grant',
  'IHBG',
  'tribal housing',
  'Title VI',
  '24 CFR 1000',
  'Indian Housing Plan',
  'IHP',
  'TDHE',
  'tribally designated housing entity',
];

const LANDLORD_TENANT_KEYWORDS = [
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

function classifyTopics(doc: FederalRegisterDocument): TopicTag[] {
  const topics: TopicTag[] = [];
  const searchText = `${doc.title} ${doc.abstract || ''} ${doc.topics?.join(' ') || ''}`.toLowerCase();
  
  const hasNahasdaKeyword = NAHASDA_KEYWORDS.some(kw => searchText.includes(kw.toLowerCase()));
  const hasCfr1000 = doc.cfr_references?.some(ref => ref.title === 24 && ref.part === 1000);
  
  if (hasNahasdaKeyword || hasCfr1000) {
    topics.push('nahasda_core');
    
    if (searchText.includes('ihbg') || searchText.includes('block grant')) {
      topics.push('ihbg');
    }
    if (searchText.includes('environmental')) {
      topics.push('environmental');
    }
    if (searchText.includes('procurement')) {
      topics.push('procurement');
    }
    if (searchText.includes('income') && searchText.includes('limit')) {
      topics.push('income_limits');
    }
  }
  
  const hasLandlordTenantKeyword = LANDLORD_TENANT_KEYWORDS.some(kw => searchText.includes(kw.toLowerCase()));
  if (hasLandlordTenantKeyword) {
    topics.push('landlord_tenant');
    
    if (searchText.includes('fair housing')) {
      topics.push('fair_housing');
    }
    if (searchText.includes('security deposit')) {
      topics.push('security_deposit');
    }
    if (searchText.includes('eviction')) {
      topics.push('eviction');
    }
  }
  
  const isHudDocument = doc.agencies?.some(a => 
    a.slug === 'housing-and-urban-development-department' || 
    a.name?.toLowerCase().includes('hud')
  );
  if (isHudDocument && topics.length === 0) {
    topics.push('hud_general');
  }
  
  if (topics.length === 0) {
    topics.push('not_relevant');
  }
  
  return topics;
}

function determineSeverity(doc: FederalRegisterDocument): "low" | "medium" | "high" | "critical" {
  if (doc.significant) return "high";
  if (doc.type === 'Rule') return "high";
  if (doc.type === 'Proposed Rule') return "medium";
  return "low";
}

function normalizeDocument(doc: FederalRegisterDocument): NormalizedLegislationItem {
  const topics = classifyTopics(doc);
  
  return {
    source: "federalRegister",
    sourceKey: doc.document_number,
    type: "regulation",
    jurisdiction: {
      country: "US",
      level: "federal",
    },
    title: doc.title,
    summary: doc.abstract,
    status: doc.type,
    publishedAt: doc.publication_date,
    effectiveDate: doc.effective_on || undefined,
    url: doc.html_url,
    pdfUrl: doc.pdf_url,
    topics,
    severity: determineSeverity(doc),
    cfrReferences: doc.cfr_references,
    crossRefKey: `FR-${doc.document_number}`,
    raw: doc,
  };
}

class FederalRegisterAdapter implements LegislationSourceAdapter {
  id = "federalRegister" as const;
  name = "Federal Register";
  type = "api" as const;
  defaultPollInterval = 720;
  
  private baseUrl = 'https://www.federalregister.gov/api/v1';
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.DATA_GOV_API_KEY || '';
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async fetch(params: SourceFetchParams): Promise<SourceFetchResult> {
    const items: NormalizedLegislationItem[] = [];
    const errors: string[] = [];
    
    try {
      const toDate = new Date();
      const fromDate = params.since ? new Date(params.since) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const searchParams = new URLSearchParams();
      searchParams.append('conditions[agencies][]', 'housing-and-urban-development-department');
      searchParams.append('conditions[publication_date][gte]', fromDate.toISOString().split('T')[0]);
      searchParams.append('conditions[publication_date][lte]', toDate.toISOString().split('T')[0]);
      searchParams.append('conditions[type][]', 'RULE');
      searchParams.append('conditions[type][]', 'PRORULE');
      searchParams.append('conditions[type][]', 'NOTICE');
      searchParams.append('per_page', '50');
      searchParams.append('order', 'newest');
      
      const fields = [
        'document_number', 'title', 'type', 'abstract', 'html_url', 'pdf_url',
        'publication_date', 'agencies', 'agency_names', 'action', 'dates',
        'effective_on', 'comments_close_on', 'significant', 'topics', 'cfr_references'
      ];
      fields.forEach(f => searchParams.append('fields[]', f));

      const url = `${this.baseUrl}/documents.json?${searchParams.toString()}`;
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          ...(this.apiKey && { 'X-Api-Key': this.apiKey }),
        },
      });

      if (!response.ok) {
        errors.push(`Federal Register API error: ${response.status}`);
        return { items, errors };
      }

      const data = await response.json();
      
      for (const doc of data.results || []) {
        const normalized = normalizeDocument(doc);
        
        if (params.topics && params.topics.length > 0) {
          const hasMatchingTopic = normalized.topics.some(t => params.topics!.includes(t));
          if (!hasMatchingTopic) continue;
        }
        
        if (!normalized.topics.includes('not_relevant')) {
          items.push(normalized);
        }
      }
      
      console.log(`📜 Federal Register: Found ${items.length} relevant documents`);
      
    } catch (error) {
      errors.push(`Federal Register fetch error: ${error}`);
    }

    return { items, errors };
  }
}

export const federalRegisterAdapter = new FederalRegisterAdapter();
registerAdapter(federalRegisterAdapter);
