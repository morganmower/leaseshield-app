/**
 * Normalized Legislative Source Adapter Types
 * 
 * All legislative data sources must output NormalizedLegislationItem objects.
 * This ensures the downstream pipeline (AI analysis, review queue, publish, notify)
 * remains unchanged regardless of how many sources are added.
 */

export type SourceId =
  | "legiscan"
  | "pluralPolicy"
  | "federalRegister"
  | "courtListener"
  | "utahGlen"
  | "congressGov"
  | "hudOnap"
  | "ecfr";

export type NormalizedItemType = "bill" | "regulation" | "case" | "notice" | "cfr_change";

export type TopicTag =
  | "landlord_tenant"
  | "nahasda_core"
  | "tribal_adjacent"
  | "ihbg"
  | "hud_general"
  | "fair_housing"
  | "security_deposit"
  | "eviction"
  | "environmental"
  | "procurement"
  | "income_limits"
  | "not_relevant";

export type Jurisdiction = {
  country: "US";
  level: "federal" | "state" | "tribal" | "local";
  state?: string;
  locality?: string;
  tribe?: string;
};

export type NormalizedLegislationItem = {
  source: SourceId;
  sourceKey: string;
  type: NormalizedItemType;
  jurisdiction: Jurisdiction;
  
  title: string;
  summary?: string;
  status?: string;
  
  introducedDate?: string;
  effectiveDate?: string;
  updatedAt?: string;
  publishedAt?: string;
  
  url?: string;
  pdfUrl?: string;
  
  topics: TopicTag[];
  severity?: "low" | "medium" | "high" | "critical";
  
  cfrReferences?: Array<{ title: number; part: number; section?: string }>;
  
  crossRefKey?: string;
  
  raw: unknown;
  text?: string;
};

export type SourceFetchParams = {
  states?: string[];
  since?: string;
  topics?: TopicTag[];
  includeTribal?: boolean;
};

export type SourceFetchResult = {
  items: NormalizedLegislationItem[];
  cursor?: string;
  hasMore?: boolean;
  errors?: string[];
};

export interface LegislationSourceAdapter {
  id: SourceId;
  name: string;
  type: "api" | "page_poll";
  defaultPollInterval: number;
  
  fetch(params: SourceFetchParams): Promise<SourceFetchResult>;
  
  isAvailable(): Promise<boolean>;
}

export type SourceConfig = {
  id: SourceId;
  enabled: boolean;
  pollIntervalMinutes: number;
  lastCursor?: string;
  lastSeenDate?: string;
  topicFilter?: TopicTag[];
  stateFilter?: string[];
};
