/**
 * Caution Level Detector for Screening Decoder
 * 
 * Analyzes user questions to determine appropriate tone/caution level
 * and provides field reference guidance for credit reports and criminal/eviction records.
 * 
 * This does NOT analyze actual report data - it only looks at the user's question
 * to calibrate the response tone appropriately.
 */

export type CautionLevel = 'low' | 'medium' | 'high';

export interface CautionResult {
  level: CautionLevel;
  score: number;
  triggers: string[];
  toneGuidance: string;
}

// Keywords that indicate higher risk situations
const CREDIT_HIGH_RISK_KEYWORDS = [
  'multiple', 'several', '3', '4', '5', '6', '7', '8', '9', '10',
  'recent', 'this year', '2024', '2025', '2026',
  'unpaid', 'open', 'active', 'still owe',
  'pattern', 'repeated', 'keeps happening',
  'large', 'high balance', 'thousands',
  'judgment', 'lawsuit', 'garnishment',
  'fraud', 'identity theft',
  'bankruptcy', 'chapter 7', 'chapter 13'
];

const CREDIT_MEDIUM_RISK_KEYWORDS = [
  'collection', 'collections', 'charge-off', 'charge off', 'charged off',
  'late payment', 'late payments', 'delinquent', 'past due',
  'closed', 'settled', 'paid',
  'old', 'years ago', 'from 2020', 'from 2019', 'from 2018',
  'medical', 'hospital', 'doctor',
  'student loan', 'student loans'
];

const CRIMINAL_HIGH_RISK_KEYWORDS = [
  'felony', 'violent', 'violence', 'assault', 'battery',
  'weapon', 'gun', 'firearm', 'knife',
  'domestic', 'dv', 'abuse',
  'sexual', 'sex offense', 'registered',
  'drug trafficking', 'distribution', 'intent to sell',
  'murder', 'manslaughter', 'homicide',
  'arson', 'robbery', 'burglary',
  'recent', 'this year', '2024', '2025', '2026',
  'currently on', 'probation', 'parole',
  'multiple', 'several', 'pattern', 'repeat'
];

const CRIMINAL_MEDIUM_RISK_KEYWORDS = [
  'misdemeanor', 'minor', 'petty',
  'possession', 'drug', 'marijuana', 'dui', 'dwi',
  'theft', 'shoplifting', 'trespassing',
  'disorderly', 'public intoxication',
  'years ago', 'old', 'dismissed', 'expunged',
  'completed', 'finished probation'
];

const EVICTION_HIGH_RISK_KEYWORDS = [
  'multiple', 'several', '2', '3', '4', '5',
  'recent', 'this year', '2024', '2025', '2026',
  'judgment', 'writ', 'possession',
  'owed money', 'owes', 'unpaid rent',
  'evicted', 'removed', 'locked out',
  'pattern', 'repeated', 'keeps getting evicted'
];

const EVICTION_MEDIUM_RISK_KEYWORDS = [
  'eviction', 'ud', 'unlawful detainer',
  'filing', 'filed', 'case',
  'dismissed', 'settled', 'resolved',
  'years ago', 'old',
  'landlord dispute', 'habitability'
];

/**
 * Detects caution level based on question text and topic
 */
export function detectCautionLevel(
  questionText: string,
  decoderType: 'credit' | 'criminal_eviction'
): CautionResult {
  const lowerQuestion = questionText.toLowerCase();
  const triggers: string[] = [];
  let score = 0;

  if (decoderType === 'credit') {
    // Check high-risk keywords (+3 each)
    for (const keyword of CREDIT_HIGH_RISK_KEYWORDS) {
      if (lowerQuestion.includes(keyword.toLowerCase())) {
        score += 3;
        triggers.push(keyword);
      }
    }
    // Check medium-risk keywords (+1 each)
    for (const keyword of CREDIT_MEDIUM_RISK_KEYWORDS) {
      if (lowerQuestion.includes(keyword.toLowerCase())) {
        score += 1;
        triggers.push(keyword);
      }
    }
  } else {
    // Criminal/Eviction
    // Check high-risk criminal keywords (+3 each)
    for (const keyword of CRIMINAL_HIGH_RISK_KEYWORDS) {
      if (lowerQuestion.includes(keyword.toLowerCase())) {
        score += 3;
        triggers.push(keyword);
      }
    }
    // Check medium-risk criminal keywords (+1 each)
    for (const keyword of CRIMINAL_MEDIUM_RISK_KEYWORDS) {
      if (lowerQuestion.includes(keyword.toLowerCase())) {
        score += 1;
        triggers.push(keyword);
      }
    }
    // Check high-risk eviction keywords (+3 each)
    for (const keyword of EVICTION_HIGH_RISK_KEYWORDS) {
      if (lowerQuestion.includes(keyword.toLowerCase())) {
        score += 3;
        triggers.push(keyword);
      }
    }
    // Check medium-risk eviction keywords (+1 each)
    for (const keyword of EVICTION_MEDIUM_RISK_KEYWORDS) {
      if (lowerQuestion.includes(keyword.toLowerCase())) {
        score += 1;
        triggers.push(keyword);
      }
    }
  }

  // Deduplicate triggers
  const uniqueTriggers = Array.from(new Set(triggers));

  // Determine level
  let level: CautionLevel;
  let toneGuidance: string;

  if (score >= 6) {
    level = 'high';
    toneGuidance = 'This is a higher-risk indicator. Be measured, verify carefully, and apply your written criteria consistently.';
  } else if (score >= 3) {
    level = 'medium';
    toneGuidance = 'This is a real risk flag—don\'t ignore it, but context matters. Verify and apply consistent standards.';
  } else {
    level = 'low';
    toneGuidance = 'This is generally manageable. Many landlords handle this routinely with consistent criteria.';
  }

  return {
    level,
    score,
    triggers: uniqueTriggers,
    toneGuidance
  };
}

/**
 * Field Reference Guide - tells landlords WHERE to look on reports
 * These are static mappings that get injected into prompts
 */
export interface FieldReference {
  fieldName: string;
  whatItTells: string;
  lookFor: string;
}

export interface TopicFieldGuide {
  topic: string;
  fields: FieldReference[];
  generalTip: string;
}

export const CREDIT_FIELD_GUIDES: Record<string, TopicFieldGuide> = {
  collections: {
    topic: 'collections',
    fields: [
      {
        fieldName: 'Placed/Clsd or Date Opened',
        whatItTells: 'When the account was sent to collections',
        lookFor: 'Recent dates (last 12-24 months) indicate current financial stress; older dates may be less relevant'
      },
      {
        fieldName: 'Status',
        whatItTells: 'Whether the collection is still active',
        lookFor: '"Open", "Active", or "Unpaid" vs "Paid", "Settled", or "Closed"'
      },
      {
        fieldName: 'Balance/Amount',
        whatItTells: 'Size of the debt',
        lookFor: 'Larger balances ($500+) may indicate more significant issues; small balances might be oversight'
      },
      {
        fieldName: 'Creditor Type or Original Creditor',
        whatItTells: 'What kind of debt it was',
        lookFor: 'Medical/hospital collections often have different context than utility, telecom, or credit card debt'
      }
    ],
    generalTip: 'Look at the overall pattern: one old paid collection differs significantly from multiple recent open collections.'
  },
  charge_off: {
    topic: 'charge_off',
    fields: [
      {
        fieldName: 'Date Closed or Charge-Off Date',
        whatItTells: 'When the creditor gave up on collecting',
        lookFor: 'Recent charge-offs (last 2 years) are more concerning than older ones'
      },
      {
        fieldName: 'Balance',
        whatItTells: 'Amount that was written off',
        lookFor: 'Higher balances suggest larger financial difficulties'
      },
      {
        fieldName: 'Account Type',
        whatItTells: 'What type of credit was charged off',
        lookFor: 'Credit cards vs auto loans vs other installment accounts'
      }
    ],
    generalTip: 'A charge-off means the creditor gave up, but it doesn\'t mean the debt disappeared—it may have been sold to collections.'
  },
  late_payments: {
    topic: 'late_payments',
    fields: [
      {
        fieldName: 'Payment History Grid',
        whatItTells: 'Month-by-month payment status',
        lookFor: '"30", "60", "90", "120" indicate days late; look for patterns vs one-time events'
      },
      {
        fieldName: 'Most Recent Late',
        whatItTells: 'When the last late payment occurred',
        lookFor: 'Recent lates are more concerning; older lates with current good history show improvement'
      },
      {
        fieldName: 'Account Status',
        whatItTells: 'Current standing of the account',
        lookFor: '"Current" or "Pays as Agreed" vs "Delinquent" or "Past Due"'
      }
    ],
    generalTip: 'One late payment from years ago differs from a pattern of recent 60-90 day lates.'
  },
  bankruptcy: {
    topic: 'bankruptcy',
    fields: [
      {
        fieldName: 'Chapter (7/11/13)',
        whatItTells: 'Type of bankruptcy',
        lookFor: 'Chapter 7 liquidates assets; Chapter 13 is a repayment plan'
      },
      {
        fieldName: 'Date Filed and Date Discharged',
        whatItTells: 'Timeline of the bankruptcy',
        lookFor: 'Discharged bankruptcies are complete; active ones may have ongoing obligations'
      },
      {
        fieldName: 'Status',
        whatItTells: 'Whether it\'s resolved',
        lookFor: '"Discharged" means complete; "Active" or "Open" means still in process'
      }
    ],
    generalTip: 'Bankruptcies stay on reports 7-10 years. Focus on what happened after—has credit behavior improved?'
  },
  credit_score: {
    topic: 'credit_score',
    fields: [
      {
        fieldName: 'Score Number',
        whatItTells: 'Overall creditworthiness summary',
        lookFor: 'Compare to your written minimum threshold'
      },
      {
        fieldName: 'Score Factors or Reason Codes',
        whatItTells: 'What\'s affecting the score',
        lookFor: 'These tell you the "why" behind the number—look for patterns'
      }
    ],
    generalTip: 'The score is a summary. The factors tell you the story. Don\'t stop at just the number.'
  },
  default: {
    topic: 'general',
    fields: [
      {
        fieldName: 'Date/Timeline',
        whatItTells: 'When the event occurred',
        lookFor: 'Recent vs old events have different weight'
      },
      {
        fieldName: 'Status',
        whatItTells: 'Current standing',
        lookFor: 'Open/active vs resolved/closed'
      },
      {
        fieldName: 'Balance/Amount',
        whatItTells: 'Size of any outstanding obligation',
        lookFor: 'Large outstanding amounts vs small or zero balances'
      }
    ],
    generalTip: 'Look for patterns, not just individual items. One issue differs from repeated behavior.'
  }
};

export const CRIMINAL_EVICTION_FIELD_GUIDES: Record<string, TopicFieldGuide> = {
  criminal: {
    topic: 'criminal',
    fields: [
      {
        fieldName: 'Charge/Offense Type',
        whatItTells: 'Nature and severity of the alleged offense',
        lookFor: 'Felony vs misdemeanor; violent vs non-violent; relevance to tenancy'
      },
      {
        fieldName: 'Disposition/Outcome',
        whatItTells: 'How the case was resolved',
        lookFor: '"Convicted", "Guilty Plea" vs "Dismissed", "Not Guilty", "Nolle Pros", "Deferred"'
      },
      {
        fieldName: 'Date',
        whatItTells: 'When this occurred',
        lookFor: 'Recent cases vs older cases; time elapsed matters for rehabilitation evidence'
      },
      {
        fieldName: 'Sentence/Status',
        whatItTells: 'Current obligations',
        lookFor: 'Completed sentence vs active probation/parole'
      }
    ],
    generalTip: 'Arrests are not convictions. Dismissed cases are not convictions. Focus on outcomes, not just charges filed.'
  },
  eviction: {
    topic: 'eviction',
    fields: [
      {
        fieldName: 'Case Type',
        whatItTells: 'What kind of eviction case',
        lookFor: '"Unlawful Detainer", "Eviction", "Possession"—different names for similar proceedings'
      },
      {
        fieldName: 'Outcome/Judgment',
        whatItTells: 'How the case was resolved',
        lookFor: '"Judgment for Plaintiff" (landlord won) vs "Dismissed", "Settled", "Judgment for Defendant" (tenant won or case dropped)'
      },
      {
        fieldName: 'Date Filed and Date Resolved',
        whatItTells: 'Timeline of the case',
        lookFor: 'Recent filings are more concerning; older resolved cases may have context'
      },
      {
        fieldName: 'Money Judgment',
        whatItTells: 'Whether rent/damages were owed',
        lookFor: 'Cases with money judgments suggest actual unpaid rent vs technical disputes'
      }
    ],
    generalTip: 'An eviction filing is not the same as being evicted. Many cases are dismissed or settled. Look at the outcome.'
  },
  default: {
    topic: 'general',
    fields: [
      {
        fieldName: 'Type/Category',
        whatItTells: 'Nature of the record',
        lookFor: 'Severity and relevance to housing'
      },
      {
        fieldName: 'Outcome/Disposition',
        whatItTells: 'How it was resolved',
        lookFor: 'Conviction/judgment vs dismissed/resolved'
      },
      {
        fieldName: 'Date',
        whatItTells: 'When it occurred',
        lookFor: 'Recent vs older; pattern vs one-time'
      }
    ],
    generalTip: 'Focus on outcomes and patterns, not just the presence of records.'
  }
};

/**
 * Get field reference guide for a topic
 */
export function getFieldGuide(
  topic: string | null,
  decoderType: 'credit' | 'criminal_eviction'
): TopicFieldGuide {
  const guides = decoderType === 'credit' ? CREDIT_FIELD_GUIDES : CRIMINAL_EVICTION_FIELD_GUIDES;
  
  if (topic && guides[topic]) {
    return guides[topic];
  }
  
  // Check if the topic contains keywords we can match
  if (topic) {
    const lowerTopic = topic.toLowerCase();
    if (lowerTopic.includes('collection')) return guides.collections || guides.default;
    if (lowerTopic.includes('charge') || lowerTopic.includes('chargeoff')) return guides.charge_off || guides.default;
    if (lowerTopic.includes('late') || lowerTopic.includes('payment')) return guides.late_payments || guides.default;
    if (lowerTopic.includes('bankrupt')) return guides.bankruptcy || guides.default;
    if (lowerTopic.includes('score')) return guides.credit_score || guides.default;
    if (lowerTopic.includes('criminal') || lowerTopic.includes('felony') || lowerTopic.includes('misdemeanor')) return guides.criminal || guides.default;
    if (lowerTopic.includes('eviction') || lowerTopic.includes('unlawful')) return guides.eviction || guides.default;
  }
  
  return guides.default;
}

/**
 * Format field guide for injection into AI prompt
 */
export function formatFieldGuideForPrompt(guide: TopicFieldGuide): string {
  let output = `WHERE TO LOOK ON THE REPORT:\n`;
  
  for (const field of guide.fields) {
    output += `• ${field.fieldName}: ${field.whatItTells}. Look for: ${field.lookFor}\n`;
  }
  
  output += `\nTIP: ${guide.generalTip}`;
  
  return output;
}

/**
 * Safe follow-up questions that don't require sensitive data
 */
export interface SafeFollowUp {
  question: string;
  yesImplication: string;
  noImplication: string;
}

export const CREDIT_FOLLOW_UPS: SafeFollowUp[] = [
  {
    question: 'Are the dates mostly within the last 12 months?',
    yesImplication: 'Recent issues are generally weighted more heavily',
    noImplication: 'Older issues may have less relevance, especially with improvement since'
  },
  {
    question: 'Do any accounts show as still open or unpaid?',
    yesImplication: 'Open/unpaid accounts suggest ongoing financial stress',
    noImplication: 'Resolved accounts show the applicant addressed the issue'
  },
  {
    question: 'Is there anything else negative on the report besides this?',
    yesImplication: 'A pattern of issues may be more concerning than an isolated event',
    noImplication: 'An isolated issue with otherwise good history provides context'
  },
  {
    question: 'Is their income comfortably above your rent-to-income requirement?',
    yesImplication: 'Strong income can offset some credit concerns for some landlords',
    noImplication: 'Tight income combined with credit issues may increase risk'
  }
];

export const CRIMINAL_EVICTION_FOLLOW_UPS: SafeFollowUp[] = [
  {
    question: 'Does the record show a conviction or guilty plea?',
    yesImplication: 'Convictions carry more weight than arrests or dismissed cases',
    noImplication: 'Dismissed or not-guilty outcomes have much less relevance'
  },
  {
    question: 'Is this from more than 7 years ago?',
    yesImplication: 'Older records with evidence of stability since may carry less weight',
    noImplication: 'Recent records are generally weighted more heavily'
  },
  {
    question: 'For evictions: Was there a money judgment against the tenant?',
    yesImplication: 'Money judgments suggest actual unpaid rent, not just a dispute',
    noImplication: 'Cases without money judgments may have been technical or disputed'
  },
  {
    question: 'Has the applicant shown stable housing or employment since?',
    yesImplication: 'Evidence of rehabilitation and stability is relevant',
    noImplication: 'Lack of stability since may increase concern'
  }
];

/**
 * Get follow-up questions for decoder type
 */
export function getSafeFollowUps(decoderType: 'credit' | 'criminal_eviction'): SafeFollowUp[] {
  return decoderType === 'credit' ? CREDIT_FOLLOW_UPS : CRIMINAL_EVICTION_FOLLOW_UPS;
}
