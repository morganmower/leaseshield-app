// Topic classifier for decoder state notes
// Uses keyword matching first, then falls back to GPT classification if ambiguous

import { CREDIT_TOPICS, CRIMINAL_EVICTION_TOPICS, type CreditTopic, type CriminalEvictionTopic } from '@shared/decoderTopics';

type Decoder = 'credit' | 'criminal_eviction';

interface TopicMatch {
  topic: string;
  confidence: 'high' | 'medium' | 'low';
  decoder: Decoder;
}

// Keyword patterns for credit decoder topics
const CREDIT_KEYWORD_PATTERNS: Record<CreditTopic, RegExp[]> = {
  security_deposit_limits: [
    /\bsecurity deposit\b/i,
    /\bdeposit limit\b/i,
    /\bdeposit cap\b/i,
    /\bdeposit amount\b/i,
    /\bdeposit return\b/i,
    /\bdeposit timing\b/i,
  ],
  application_fees: [
    /\bapplication fee\b/i,
    /\bscreening fee\b/i,
    /\bbackground check fee\b/i,
    /\bcredit check fee\b/i,
    /\bfee cap\b/i,
    /\bfee limit\b/i,
  ],
  source_of_income: [
    /\bsource of income\b/i,
    /\bincome source\b/i,
    /\bsection 8\b/i,
    /\bhousing voucher\b/i,
    /\bhousing choice voucher\b/i,
    /\bvoucher holder\b/i,
    /\bsubsidy\b/i,
    /\bpublic assistance\b/i,
  ],
  late_fees_rules: [
    /\blate fee\b/i,
    /\blate payment\b/i,
    /\blate rent\b/i,
    /\bpenalty fee\b/i,
    /\bgrace period\b/i,
  ],
  adverse_action_state_addons: [
    /\badverse action\b/i,
    /\bdenial letter\b/i,
    /\bdenial notice\b/i,
    /\brejection letter\b/i,
  ],
};

// Keyword patterns for criminal/eviction decoder topics
const CRIMINAL_EVICTION_KEYWORD_PATTERNS: Record<CriminalEvictionTopic, RegExp[]> = {
  fair_chance_housing: [
    /\bfair chance\b/i,
    /\bban the box\b/i,
    /\bban-the-box\b/i,
    /\bcriminal history restriction\b/i,
    /\bcriminal background restriction\b/i,
  ],
  individualized_assessment: [
    /\bindividualized assessment\b/i,
    /\bindividual assessment\b/i,
    /\bcase.by.case\b/i,
    /\bhud guidance\b/i,
    /\bhud 2016\b/i,
    /\bmitigating factor\b/i,
    /\brehabilitation\b/i,
  ],
  eviction_record_sealing: [
    /\beviction seal\b/i,
    /\bsealed record\b/i,
    /\bexpunge\b/i,
    /\brecord restriction\b/i,
    /\beviction record access\b/i,
  ],
  local_overrides_present: [
    /\blocal ordinance\b/i,
    /\bcity ordinance\b/i,
    /\blocal law\b/i,
    /\bmunicipal\b/i,
    /\bchicago\b/i,
    /\bnyc\b/i,
    /\bnew york city\b/i,
    /\bsan francisco\b/i,
    /\bseattle\b/i,
    /\bportland\b/i,
  ],
  eviction_filing_vs_judgment: [
    /\beviction filing\b/i,
    /\beviction judgment\b/i,
    /\bfiling vs judgment\b/i,
    /\bdismissed eviction\b/i,
    /\beviction outcome\b/i,
  ],
  criminal_lookback_limits: [
    /\blookback\b/i,
    /\blook.back\b/i,
    /\byear limit\b/i,
    /\btime limit\b/i,
    /\bhow far back\b/i,
    /\bhow long ago\b/i,
  ],
  arrest_vs_conviction_rules: [
    /\barrest\b/i,
    /\bconviction\b/i,
    /\barrest record\b/i,
    /\bpending charge\b/i,
    /\bnot convicted\b/i,
    /\bacquit\b/i,
    /\bdismissed charge\b/i,
  ],
};

/**
 * Classify a user's question into a topic using keyword matching.
 * Returns null if no confident match is found.
 */
export function classifyTopicByKeywords(
  question: string,
  decoder: Decoder
): TopicMatch | null {
  const patterns = decoder === 'credit' 
    ? CREDIT_KEYWORD_PATTERNS 
    : CRIMINAL_EVICTION_KEYWORD_PATTERNS;

  const matches: Array<{ topic: string; matchCount: number }> = [];

  for (const [topic, regexList] of Object.entries(patterns)) {
    let matchCount = 0;
    for (const regex of regexList) {
      if (regex.test(question)) {
        matchCount++;
      }
    }
    if (matchCount > 0) {
      matches.push({ topic, matchCount });
    }
  }

  if (matches.length === 0) {
    return null;
  }

  // Sort by match count descending
  matches.sort((a, b) => b.matchCount - a.matchCount);

  const best = matches[0];
  
  // Determine confidence based on match count and whether there's ambiguity
  let confidence: 'high' | 'medium' | 'low';
  if (best.matchCount >= 2 && (matches.length === 1 || best.matchCount > matches[1].matchCount)) {
    confidence = 'high';
  } else if (best.matchCount >= 1 && matches.length === 1) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  return {
    topic: best.topic,
    confidence,
    decoder,
  };
}

/**
 * Classify topic using GPT as fallback.
 * Only call this when keyword matching returns null or low confidence.
 */
export async function classifyTopicWithAI(
  question: string,
  decoder: Decoder,
  openai: any
): Promise<TopicMatch | null> {
  const topics = decoder === 'credit' ? CREDIT_TOPICS : CRIMINAL_EVICTION_TOPICS;
  
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a topic classifier for a landlord screening decoder. 
Given a user's question about ${decoder === 'credit' ? 'credit reports' : 'criminal/eviction records'}, classify it into ONE of these topics:

${topics.map(t => `- ${t}`).join('\n')}

If the question doesn't clearly relate to any of these topics, respond with "none".
Respond with ONLY the topic name or "none". No explanation.`
        },
        {
          role: "user",
          content: question
        }
      ],
      temperature: 0,
      max_tokens: 50,
    });

    const response = completion.choices[0]?.message?.content?.trim().toLowerCase() || 'none';
    
    // Use type-safe check by converting to array and using includes
    const topicsArray = [...topics] as string[];
    if (response === 'none' || !topicsArray.includes(response)) {
      return null;
    }

    return {
      topic: response,
      confidence: 'medium',
      decoder,
    };
  } catch (error) {
    console.error('Error classifying topic with AI:', error);
    return null;
  }
}

/**
 * Main entry point: classify a question into a topic.
 * Uses keyword matching first, then AI fallback if confidence is low.
 */
export async function classifyTopic(
  question: string,
  decoder: Decoder,
  openai?: any
): Promise<TopicMatch | null> {
  // First try keyword matching
  const keywordMatch = classifyTopicByKeywords(question, decoder);
  
  // If high or medium confidence, return immediately
  if (keywordMatch && keywordMatch.confidence !== 'low') {
    return keywordMatch;
  }
  
  // If low confidence or no match, try AI fallback (if openai client provided)
  if (openai) {
    const aiMatch = await classifyTopicWithAI(question, decoder, openai);
    if (aiMatch) {
      return aiMatch;
    }
  }
  
  // Return the low-confidence keyword match if we have one
  return keywordMatch;
}

/**
 * Detect which decoder is most relevant for the question.
 * Returns 'credit' for credit-related questions, 'criminal_eviction' for criminal/eviction.
 */
export function detectDecoder(question: string): Decoder {
  const q = question.toLowerCase();
  
  const creditSignals = [
    'credit', 'score', 'charge-off', 'collection', 'bankruptcy',
    'late payment', 'utilization', 'debt', 'loan', 'credit card',
    'payment history', 'credit report', 'fico', 'credit bureau',
    'experian', 'equifax', 'transunion', 'delinquent', 'default'
  ];
  
  const criminalSignals = [
    'criminal', 'eviction', 'arrest', 'conviction', 'felony',
    'misdemeanor', 'background check', 'court record', 'judgment',
    'sex offender', 'drug', 'assault', 'theft', 'dui', 'dwi',
    'unlawful detainer', 'forcible entry', 'dispossess'
  ];
  
  let creditScore = 0;
  let criminalScore = 0;
  
  for (const signal of creditSignals) {
    if (q.includes(signal)) creditScore++;
  }
  
  for (const signal of criminalSignals) {
    if (q.includes(signal)) criminalScore++;
  }
  
  return criminalScore > creditScore ? 'criminal_eviction' : 'credit';
}
