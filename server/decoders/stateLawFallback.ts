// State law fallback helper for decoder safety
// Pure functions for testing and deterministic behavior

// All 15 supported states plus common city references
const STATE_SIGNALS = [
  // Full state names
  "california", "texas", "illinois", "new york", "utah", "north dakota", "south dakota",
  "north carolina", "ohio", "michigan", "idaho", "wyoming", "virginia", "nevada",
  "arizona", "florida",
  // State abbreviations (with space after to avoid false positives like "ca" in "car")
  "ca ", "tx ", "il ", "ny ", "ut ", "nd ", "sd ", "nc ", "oh ", "mi ", "id ", "wy ",
  "va ", "nv ", "az ", "fl ",
  // Major cities with local ordinances
  "nyc", "new york city", "chicago", "los angeles", "san francisco", "seattle",
  "portland", "denver", "austin", "philadelphia", "boston", "miami", "las vegas",
  // Generic law references
  "state law", "local law", "local ordinance", "under the law", "legal in",
  "in my state", "in this state", "my jurisdiction", "local rules"
];

/**
 * Detects if the user's question explicitly references a state or local law.
 * This is used to determine if the fallback text should be shown when no snippet exists.
 */
export function isStateSpecificQuestion(question: string): boolean {
  const q = question.toLowerCase();
  return STATE_SIGNALS.some(signal => q.includes(signal));
}

/**
 * Determines if the state law fallback should be triggered.
 * Fallback fires when: user asks about state/local law AND no approved snippet exists.
 * 
 * @param question - The user's question text
 * @param stateNote - The fetched state note (or null if not found)
 * @param topicMatch - The classified topic match (or null if not classified)
 * @returns true if fallback text should be shown
 */
export function shouldTriggerStateLawFallback(
  question: string,
  stateNote: any | null,
  topicMatch: { topic: string; confidence: string } | null
): boolean {
  // Check if the question references state/local law
  const asksAboutStateLaw = isStateSpecificQuestion(question);
  
  // Fallback triggers when:
  // 1. User asks about state law but no approved snippet exists, OR
  // 2. A topic was classified (implying state-specific content) but no snippet exists
  if (asksAboutStateLaw && !stateNote) {
    return true;
  }
  
  // If topic was classified with high confidence but no snippet, also fallback
  if (topicMatch && topicMatch.confidence === 'high' && !stateNote) {
    // Only fallback if the topic is high-risk
    const HIGH_RISK_TOPICS = [
      'fair_chance_housing',
      'individualized_assessment',
      'local_overrides_present',
      'source_of_income',
    ];
    if (HIGH_RISK_TOPICS.includes(topicMatch.topic)) {
      return true;
    }
  }
  
  return false;
}

/**
 * The exact fallback text to show when state-specific law is asked but no snippet exists.
 * This is the ONLY state-law related statement the decoder should make when snippets are missing.
 */
export const STATE_LAW_FALLBACK_TEXT =
  "State-specific rules may apply — check your local requirements.";

/**
 * Extracts the state code from a user's question if explicitly mentioned.
 * Returns null if no state is clearly referenced.
 */
export function extractStateFromQuestion(question: string): string | null {
  const q = question.toLowerCase();
  
  const statePatterns: Array<{ pattern: RegExp | string; code: string }> = [
    { pattern: /\b(california|ca)\b/, code: "CA" },
    { pattern: /\b(texas|tx)\b/, code: "TX" },
    { pattern: /\b(illinois|il)\b/, code: "IL" },
    { pattern: /\b(new york|ny|nyc)\b/, code: "NY" },
    { pattern: /\b(utah|ut)\b/, code: "UT" },
    { pattern: /\b(north dakota|nd)\b/, code: "ND" },
    { pattern: /\b(south dakota|sd)\b/, code: "SD" },
    { pattern: /\b(north carolina|nc)\b/, code: "NC" },
    { pattern: /\b(ohio|oh)\b/, code: "OH" },
    { pattern: /\b(michigan|mi)\b/, code: "MI" },
    { pattern: /\b(idaho|id)\b/, code: "ID" },
    { pattern: /\b(wyoming|wy)\b/, code: "WY" },
    { pattern: /\b(virginia|va)\b/, code: "VA" },
    { pattern: /\b(nevada|nv)\b/, code: "NV" },
    { pattern: /\b(arizona|az)\b/, code: "AZ" },
    { pattern: /\b(florida|fl)\b/, code: "FL" },
    // Cities map to their states
    { pattern: /\bchicago\b/, code: "IL" },
    { pattern: /\b(los angeles|san francisco)\b/, code: "CA" },
    { pattern: /\blas vegas\b/, code: "NV" },
    { pattern: /\bmiami\b/, code: "FL" },
    { pattern: /\baustin\b/, code: "TX" },
  ];

  for (const { pattern, code } of statePatterns) {
    if (typeof pattern === "string" ? q.includes(pattern) : pattern.test(q)) {
      return code;
    }
  }

  return null;
}
