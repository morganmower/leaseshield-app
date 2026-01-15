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

// Field guides based on actual Western Verify / TransUnion report format
export const CREDIT_FIELD_GUIDES: Record<string, TopicFieldGuide> = {
  collections: {
    topic: 'collections',
    fields: [
      {
        fieldName: 'Placed/CLSD column',
        whatItTells: 'When the account was placed in collections and when/if it closed',
        lookFor: 'Recent "Placed" dates (last 12-24 months) indicate current financial stress; check if "CLSD" date exists showing resolution'
      },
      {
        fieldName: '$PLCD/$BAL columns',
        whatItTells: 'Original amount placed vs current balance',
        lookFor: 'If $BAL is lower than $PLCD, payments were made; if $BAL equals $PLCD, no payments made'
      },
      {
        fieldName: 'Remarks column',
        whatItTells: 'Current status of the collection',
        lookFor: '"Placed for collection" (active) vs no remarks or "Paid" (resolved)'
      },
      {
        fieldName: 'Creditor Name',
        whatItTells: 'Who the original debt was with',
        lookFor: 'Medical providers, utilities, phone carriers, or credit cards each have different context'
      }
    ],
    generalTip: 'In the Collection Accounts table, pink/highlighted rows indicate active negative items. Check both the dates AND the balance—a $0 balance means it was paid.'
  },
  charge_off: {
    topic: 'charge_off',
    fields: [
      {
        fieldName: 'Remarks column',
        whatItTells: 'Shows "Profit and loss writeoff" when charged off',
        lookFor: 'This phrase confirms the creditor gave up collecting; often combined with closed date'
      },
      {
        fieldName: 'Opened/Clsd PD columns',
        whatItTells: 'When account opened and when it was charged off',
        lookFor: 'The "Clsd" date shows when the charge-off occurred—recent is more concerning'
      },
      {
        fieldName: '$Bal column',
        whatItTells: 'Outstanding balance at time of charge-off',
        lookFor: 'Higher amounts indicate larger financial difficulties'
      },
      {
        fieldName: 'Rating column (far right)',
        whatItTells: 'Account rating code',
        lookFor: 'Codes like "I9" or "O9" indicate serious derogatory status'
      }
    ],
    generalTip: 'Look for "Profit and loss writeoff" in Remarks. The Rating column shows severity—I9 is a charge-off. Check the Hist Status columns (30 60 90) for payment history leading up to it.'
  },
  late_payments: {
    topic: 'late_payments',
    fields: [
      {
        fieldName: 'Hist Status columns (Date Mths 30 60 90)',
        whatItTells: 'Payment history—how many months at each delinquency level',
        lookFor: 'Numbers in the 30, 60, 90 columns show how many times payments were that many days late'
      },
      {
        fieldName: '$Past Due column',
        whatItTells: 'Current amount past due',
        lookFor: '$0 means currently on time; any amount means currently behind'
      },
      {
        fieldName: 'Pmt Term column',
        whatItTells: 'Monthly payment amount and term',
        lookFor: 'Shows like "006MO" for 6-month term—helps understand payment obligations'
      },
      {
        fieldName: 'Rating column',
        whatItTells: 'Current account status code',
        lookFor: 'I1 = current; I2-I4 = 30-90 days late; I5+ = serious delinquency'
      }
    ],
    generalTip: 'The Hist Status columns are key—they show the pattern. One "1" in the 30 column is minor; multiple across 60/90 shows a pattern. Pink highlighting means current problems.'
  },
  repossession: {
    topic: 'repossession',
    fields: [
      {
        fieldName: 'Remarks column',
        whatItTells: 'Shows "Repossession" when vehicle was taken back',
        lookFor: 'This confirms the vehicle was repossessed—usually after 90+ days late'
      },
      {
        fieldName: 'Loan Type column',
        whatItTells: 'Type of loan that was repossessed',
        lookFor: '"Automobile" or "Auto Lease" indicates a vehicle repo'
      },
      {
        fieldName: '$Bal column',
        whatItTells: 'Deficiency balance after vehicle sale',
        lookFor: 'High remaining balance means they may still owe after repo; $0 means settled'
      },
      {
        fieldName: 'Opened/Clsd dates',
        whatItTells: 'When the loan started and when repo occurred',
        lookFor: 'Recent repos are more concerning; older repos with no other issues show recovery'
      }
    ],
    generalTip: 'Look for "Repossession" in Remarks under Installment Accounts. Check if there\'s a remaining balance—many repos leave a deficiency the borrower still owes.'
  },
  credit_score: {
    topic: 'credit_score',
    fields: [
      {
        fieldName: 'Score Model line',
        whatItTells: 'Score type and number (e.g., "VANTAGESCORE 4.0 +592")',
        lookFor: 'Compare to your written minimum; scores below 550 are typically concerning'
      },
      {
        fieldName: 'Factor codes (numbered list)',
        whatItTells: 'What\'s hurting/helping the score',
        lookFor: 'Common factors: 68 = limited real estate history, 22 = few high-limit cards, 87 = too many collections, 07 = delinquencies'
      },
      {
        fieldName: 'Scorecard number',
        whatItTells: 'Risk category the person falls into',
        lookFor: 'Lower scorecard numbers generally indicate lower risk profiles'
      }
    ],
    generalTip: 'The Scoring section shows both the number AND the factors. Factor 87 "Too many unpaid agency collections accounts" is a major red flag. Read the factor descriptions—they tell you exactly what\'s wrong.'
  },
  inquiries: {
    topic: 'inquiries',
    fields: [
      {
        fieldName: 'Inquiries section at end of report',
        whatItTells: 'Who has pulled their credit recently',
        lookFor: 'Many inquiries in short time may indicate desperation for credit; auto/mortgage shopping is normal'
      },
      {
        fieldName: 'Date column',
        whatItTells: 'When each inquiry was made',
        lookFor: 'Recent clusters of inquiries may indicate current financial stress'
      },
      {
        fieldName: 'Type Inq/Loan column',
        whatItTells: 'What type of credit they were seeking',
        lookFor: '"I" usually means installment (auto, personal); multiple types may indicate shopping around'
      }
    ],
    generalTip: 'The Inquiries table shows who pulled credit. Many recent inquiries from lenders (not landlords) may indicate they\'re actively seeking credit—which could mean financial pressure.'
  },
  default: {
    topic: 'general',
    fields: [
      {
        fieldName: 'Placed/CLSD and Opened/Clsd dates',
        whatItTells: 'When issues started and if/when they were resolved',
        lookFor: 'Recent dates (last 1-2 years) vs older dates; closed vs still open'
      },
      {
        fieldName: '$Bal and $Past Due columns',
        whatItTells: 'Current amounts owed',
        lookFor: '$0 balance = resolved; high $Past Due = current problem'
      },
      {
        fieldName: 'Remarks column',
        whatItTells: 'Plain-English status of each account',
        lookFor: '"Placed for collection", "Profit and loss writeoff", "Repossession", "Closed" etc.'
      },
      {
        fieldName: 'Pink/highlighted rows',
        whatItTells: 'Accounts with current negative status',
        lookFor: 'Highlighted rows in the tables indicate active problems vs resolved history'
      }
    ],
    generalTip: 'Read the Remarks column first—it tells you in plain English what happened. Then check dates and balances. Pink highlighting = current problem.'
  }
};

// Field guides based on actual Western Verify criminal report format
export const CRIMINAL_EVICTION_FIELD_GUIDES: Record<string, TopicFieldGuide> = {
  criminal: {
    topic: 'criminal',
    fields: [
      {
        fieldName: 'COUNT sections (COUNT 1, COUNT 2, etc.)',
        whatItTells: 'Each separate charge in the case',
        lookFor: 'Multiple counts can indicate severity; each count has its own offense level and disposition'
      },
      {
        fieldName: 'Offense Level field',
        whatItTells: 'Severity classification',
        lookFor: '"FELONY" is more serious than "MISDEMEANOR"—directly impacts your screening criteria'
      },
      {
        fieldName: 'Disposition field',
        whatItTells: 'How the case was resolved',
        lookFor: '"GUILTY" = conviction; "DISMISSED", "NOT GUILTY", "DEFERRED" = no conviction'
      },
      {
        fieldName: 'Offense Date and Disposition Date',
        whatItTells: 'When the offense occurred and when resolved',
        lookFor: 'Calculate time elapsed—7+ years is often a relevant threshold; recent is more concerning'
      },
      {
        fieldName: 'Sentence field',
        whatItTells: 'What punishment was given',
        lookFor: '"Jail X DAYS", "Prison X YEARS, SUSPENDED", "Probation X MONTHS"—shows severity and if they served time'
      },
      {
        fieldName: 'Statute field',
        whatItTells: 'The specific law violated',
        lookFor: 'Statute numbers like "76-5-103(1)" identify the exact offense under state law'
      }
    ],
    generalTip: 'Focus on Disposition first—"GUILTY" is a conviction, anything else is not. Then check Offense Level (felony vs misdemeanor) and calculate how long ago using the Disposition Date. "SUSPENDED" sentences mean prison time was given but not served.'
  },
  eviction: {
    topic: 'eviction',
    fields: [
      {
        fieldName: 'Case Type field',
        whatItTells: 'What kind of civil case',
        lookFor: '"Unlawful Detainer", "Eviction", "Forcible Entry" all mean eviction proceedings'
      },
      {
        fieldName: 'Disposition/Judgment field',
        whatItTells: 'How the case ended',
        lookFor: '"Judgment for Plaintiff" = landlord won; "Dismissed", "Judgment for Defendant" = tenant won or case dropped'
      },
      {
        fieldName: 'File Date and Disposition Date',
        whatItTells: 'Timeline of the eviction case',
        lookFor: 'Recent filings (last 1-3 years) are more concerning; quick dismissals may indicate disputes not actual evictions'
      },
      {
        fieldName: 'Amount/Damages field',
        whatItTells: 'Whether money was owed',
        lookFor: 'Money judgments suggest unpaid rent; cases without money amounts may have been technical or disputed'
      }
    ],
    generalTip: 'An eviction FILING is not the same as being evicted. Look at the Disposition—only "Judgment for Plaintiff" means the landlord won. Dismissed cases often mean the tenant paid or the landlord made errors.'
  },
  felony: {
    topic: 'felony',
    fields: [
      {
        fieldName: 'Offense Level: FELONY',
        whatItTells: 'This is a serious crime',
        lookFor: 'Felonies are more serious than misdemeanors—but still check disposition, nature, and time elapsed'
      },
      {
        fieldName: 'Disposition field',
        whatItTells: 'Whether there was a conviction',
        lookFor: '"GUILTY" = convicted; anything else = not convicted (arrests are not convictions)'
      },
      {
        fieldName: 'Sentence field',
        whatItTells: 'Severity of punishment',
        lookFor: 'Actual prison time vs "SUSPENDED" (given but not served) vs probation-only'
      },
      {
        fieldName: 'Disposition Date',
        whatItTells: 'When the case concluded',
        lookFor: 'Calculate years elapsed—more time with no new offenses shows stability'
      }
    ],
    generalTip: 'Felony = serious, but HUD guidance requires individualized assessment. Check: Was there a conviction? How long ago? Was it violent? Is the person on active probation/parole? What evidence of rehabilitation exists?'
  },
  misdemeanor: {
    topic: 'misdemeanor',
    fields: [
      {
        fieldName: 'Offense Level: MISDEMEANOR',
        whatItTells: 'This is a less serious crime',
        lookFor: 'Misdemeanors are generally minor offenses—context and pattern matter more'
      },
      {
        fieldName: 'Disposition field',
        whatItTells: 'Whether there was a conviction',
        lookFor: '"GUILTY" = convicted; "DISMISSED" = no conviction'
      },
      {
        fieldName: 'COUNT descriptions',
        whatItTells: 'What the actual offense was',
        lookFor: 'DUI, disorderly conduct, petty theft have different implications than assault'
      },
      {
        fieldName: 'Sentence field',
        whatItTells: 'Punishment given',
        lookFor: 'Jail days (usually served), fines, probation—shows how seriously court treated it'
      }
    ],
    generalTip: 'Single old misdemeanors are often routine. Focus on: Is it relevant to being a tenant? Is there a pattern of similar charges? Was it recent? Many landlords treat old misdemeanors as minor factors.'
  },
  default: {
    topic: 'general',
    fields: [
      {
        fieldName: 'Disposition field',
        whatItTells: 'Whether there was a conviction or judgment',
        lookFor: '"GUILTY" or "Judgment for Plaintiff" = adverse finding; "DISMISSED" = case dropped'
      },
      {
        fieldName: 'Offense Level field',
        whatItTells: 'Severity of the charge',
        lookFor: 'FELONY vs MISDEMEANOR—directly impacts how to weigh it'
      },
      {
        fieldName: 'Dates (Offense Date, File Date, Disposition Date)',
        whatItTells: 'Timeline of events',
        lookFor: 'Calculate time elapsed; look for patterns of recent vs old isolated events'
      },
      {
        fieldName: 'Sentence field',
        whatItTells: 'What consequences were given',
        lookFor: 'Jail/prison time, probation, fines—indicates how seriously the court treated the offense'
      }
    ],
    generalTip: 'Always check Disposition first—only convictions/judgments should factor heavily. Then consider: How long ago? How serious? Is there a pattern? What does the Sentence tell you about severity?'
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
