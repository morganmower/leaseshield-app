// Controlled topic lists for state notes - prevents random topic strings in DB
// Only topics in these lists can have state-specific notes

export const CREDIT_TOPICS = [
  "security_deposit_limits",
  "application_fees",
  "source_of_income",
  "late_fees_rules",
  "adverse_action_state_addons",
] as const;

export const CRIMINAL_EVICTION_TOPICS = [
  "fair_chance_housing",
  "individualized_assessment",
  "eviction_record_sealing",
  "local_overrides_present",
  "eviction_filing_vs_judgment",
  "criminal_lookback_limits",
  "arrest_vs_conviction_rules",
] as const;

export type CreditTopic = typeof CREDIT_TOPICS[number];
export type CriminalEvictionTopic = typeof CRIMINAL_EVICTION_TOPICS[number];
export type DecoderTopic = CreditTopic | CriminalEvictionTopic;

export const ALL_TOPICS = [...CREDIT_TOPICS, ...CRIMINAL_EVICTION_TOPICS] as const;

// Human-readable labels for admin UI
export const TOPIC_LABELS: Record<DecoderTopic, string> = {
  // Credit topics
  security_deposit_limits: "Security Deposit Limits",
  application_fees: "Application Fees",
  source_of_income: "Source of Income Protections",
  late_fees_rules: "Late Fee Rules",
  adverse_action_state_addons: "Adverse Action (State Add-ons)",
  // Criminal/Eviction topics
  fair_chance_housing: "Fair Chance Housing",
  individualized_assessment: "Individualized Assessment",
  eviction_record_sealing: "Eviction Record Sealing",
  local_overrides_present: "Local Overrides Present",
  eviction_filing_vs_judgment: "Eviction Filing vs Judgment",
  criminal_lookback_limits: "Criminal Lookback Limits",
  arrest_vs_conviction_rules: "Arrest vs Conviction Rules",
};

// High-risk topics that should trigger stronger warnings when missing
export const HIGH_RISK_TOPICS: DecoderTopic[] = [
  "fair_chance_housing",
  "individualized_assessment",
  "local_overrides_present",
  "source_of_income",
];

// Required topics per decoder - minimum to mark state as "decoder-ready"
// Criminal/Eviction required first (legal risk), Credit is phase 2
export const REQUIRED_CRIMINAL_EVICTION_TOPICS: CriminalEvictionTopic[] = [
  "fair_chance_housing",
  "individualized_assessment",
  "local_overrides_present",
];

export const REQUIRED_CREDIT_TOPICS: CreditTopic[] = [
  "source_of_income", // Only required if state has SOI protections
];

// Get required topics for a decoder
export function getRequiredTopicsForDecoder(decoder: "credit" | "criminal_eviction"): readonly string[] {
  return decoder === "credit" ? REQUIRED_CREDIT_TOPICS : REQUIRED_CRIMINAL_EVICTION_TOPICS;
}

// Helper to check if a topic belongs to a decoder
export function isTopicForDecoder(topic: string, decoder: "credit" | "criminal_eviction"): boolean {
  if (decoder === "credit") {
    return (CREDIT_TOPICS as readonly string[]).includes(topic);
  }
  return (CRIMINAL_EVICTION_TOPICS as readonly string[]).includes(topic);
}

// Get all topics for a specific decoder
export function getTopicsForDecoder(decoder: "credit" | "criminal_eviction"): readonly string[] {
  return decoder === "credit" ? CREDIT_TOPICS : CRIMINAL_EVICTION_TOPICS;
}
