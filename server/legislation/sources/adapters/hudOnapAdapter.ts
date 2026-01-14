/**
 * HUD ONAP/PIH Adapter
 * 
 * Monitors HUD Office of Native American Programs (ONAP) and
 * Public and Indian Housing (PIH) notices via page polling.
 * 
 * Sources:
 * - HUD ONAP: https://www.hud.gov/program_offices/public_indian_housing/ih
 * - PIH Notices: https://www.hud.gov/program_offices/public_indian_housing/publications/notices
 */

import { 
  LegislationSourceAdapter, 
  NormalizedLegislationItem, 
  SourceFetchParams, 
  SourceFetchResult,
  TopicTag 
} from "../types";
import { registerAdapter } from "../registry";

interface HudNotice {
  id: string;
  title: string;
  date: string;
  url: string;
  pdfUrl?: string;
  type: 'pih' | 'onap' | 'guidance';
}

const NAHASDA_KEYWORDS = [
  'nahasda',
  'native american',
  'indian housing',
  'ihbg',
  'tribal',
  'tribe',
  'title vi',
  'part 1000',
];

const PIH_KEYWORDS = [
  'public housing',
  'section 8',
  'voucher',
  'housing choice',
  'admissions',
  'occupancy',
];

function classifyTopics(notice: HudNotice): TopicTag[] {
  const topics: TopicTag[] = [];
  const searchText = notice.title.toLowerCase();
  
  const hasNahasdaKeyword = NAHASDA_KEYWORDS.some(kw => searchText.includes(kw));
  if (hasNahasdaKeyword) {
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
  
  const hasPihKeyword = PIH_KEYWORDS.some(kw => searchText.includes(kw));
  if (hasPihKeyword) {
    topics.push('hud_general');
    topics.push('landlord_tenant');
  }
  
  if (notice.type === 'onap' && topics.length === 0) {
    topics.push('tribal_adjacent');
  }
  
  if (topics.length === 0) {
    topics.push('not_relevant');
  }
  
  return topics;
}

function determineSeverity(notice: HudNotice): "low" | "medium" | "high" | "critical" {
  const title = notice.title.toLowerCase();
  
  if (title.includes('final rule') || title.includes('effective')) return "high";
  if (title.includes('proposed') || title.includes('comment')) return "medium";
  if (title.includes('guidance') || title.includes('notice')) return "medium";
  return "low";
}

function normalizeNotice(notice: HudNotice): NormalizedLegislationItem {
  const topics = classifyTopics(notice);
  
  return {
    source: "hudOnap",
    sourceKey: notice.id,
    type: "notice",
    jurisdiction: {
      country: "US",
      level: "federal",
    },
    title: notice.title,
    status: notice.type === 'pih' ? 'PIH Notice' : 'ONAP Guidance',
    publishedAt: notice.date,
    url: notice.url,
    pdfUrl: notice.pdfUrl,
    topics,
    severity: determineSeverity(notice),
    crossRefKey: `HUD-${notice.type.toUpperCase()}-${notice.id}`,
    raw: notice,
  };
}

class HudOnapAdapter implements LegislationSourceAdapter {
  id = "hudOnap" as const;
  name = "HUD ONAP/PIH Notices";
  type = "page_poll" as const;
  defaultPollInterval = 1440;
  
  private pihNoticesUrl = 'https://www.hud.gov/program_offices/public_indian_housing/publications/notices';
  private onapUrl = 'https://www.hud.gov/program_offices/public_indian_housing/ih';

  async isAvailable(): Promise<boolean> {
    return true;
  }

  private async fetchPihNotices(): Promise<HudNotice[]> {
    const notices: HudNotice[] = [];
    
    try {
      const response = await fetch(this.pihNoticesUrl);
      if (!response.ok) return notices;
      
      const html = await response.text();
      
      const linkRegex = /href="([^"]*PIH[^"]*\.pdf)"/gi;
      const titleRegex = /PIH\s*[\d-]+/gi;
      
      let match;
      const year = new Date().getFullYear();
      
      while ((match = linkRegex.exec(html)) !== null) {
        const pdfUrl = match[1];
        const id = pdfUrl.match(/PIH[\d-]+/i)?.[0] || `pih-${Date.now()}`;
        
        if (pdfUrl.includes(year.toString()) || pdfUrl.includes((year - 1).toString())) {
          notices.push({
            id,
            title: `PIH Notice ${id}`,
            date: new Date().toISOString().split('T')[0],
            url: this.pihNoticesUrl,
            pdfUrl: pdfUrl.startsWith('http') ? pdfUrl : `https://www.hud.gov${pdfUrl}`,
            type: 'pih',
          });
        }
      }
      
    } catch (error) {
      console.error('Error fetching PIH notices:', error);
    }
    
    return notices;
  }

  async fetch(params: SourceFetchParams): Promise<SourceFetchResult> {
    const items: NormalizedLegislationItem[] = [];
    const errors: string[] = [];
    
    try {
      const pihNotices = await this.fetchPihNotices();
      
      for (const notice of pihNotices) {
        const normalized = normalizeNotice(notice);
        
        if (params.topics && params.topics.length > 0) {
          const hasMatchingTopic = normalized.topics.some(t => params.topics!.includes(t));
          if (!hasMatchingTopic) continue;
        }
        
        if (!normalized.topics.includes('not_relevant')) {
          items.push(normalized);
        }
      }
      
    } catch (error) {
      errors.push(`HUD ONAP fetch error: ${error}`);
    }
    
    console.log(`🏛️ HUD ONAP/PIH: Found ${items.length} notices`);
    
    return { items, errors };
  }
}

export const hudOnapAdapter = new HudOnapAdapter();
registerAdapter(hudOnapAdapter);
