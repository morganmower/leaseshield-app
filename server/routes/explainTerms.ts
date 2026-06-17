import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { isAuthenticated, requireAccess } from "../jwtAuth";
import { asyncHandler } from "../utils/validation";
import { openai, chatRateLimiter, getUserId, getClientIp } from "./_shared";

export async function registerExplainTermsRoutes(app: Express) {
  // Credit Report Helper - explain credit terms using AI
  app.post('/api/explain-credit-term', isAuthenticated, requireAccess, asyncHandler(async (req, res) => {
    // Rate limiting (same as chat)
    const clientIp = getClientIp(req);
    if (!chatRateLimiter.check(clientIp)) {
      return res.status(429).json({
        explanation: "You're asking questions too quickly. Please wait a moment and try again."
      });
    }

    const { term } = req.body;

    if (!term || typeof term !== 'string') {
      return res.status(400).json({ 
        explanation: "Please provide a valid credit report term." 
      });
    }

    const trimmedTerm = term.trim();

    // Privacy and safety checks
    // Block Social Security Numbers (various formats)
    if (/\b\d{3}-\d{2}-\d{4}\b/.test(trimmedTerm) || 
        /\b\d{9}\b/.test(trimmedTerm) ||
        /\bssn\b/i.test(trimmedTerm)) {
      return res.json({
        explanation: "For your safety, please do not enter Social Security numbers or personal identifiers. Just type the WORD or PHRASE you'd like explained (for example: 'charge-off' or 'collection')."
      });
    }

    // Block long numbers that look like account numbers (10+ consecutive digits)
    if (/\d{10,}/.test(trimmedTerm)) {
      return res.json({
        explanation: "This looks like an account number. For privacy reasons, please remove specific account numbers before submitting."
      });
    }

    // Length check - allow longer inputs for multi-item credit analysis
    if (trimmedTerm.length > 2000) {
      return res.status(400).json({ 
        explanation: "Please keep your input under 2000 characters. You can describe multiple credit items but try to be concise." 
      });
    }

    // Get user's preferred state for state-specific notes
    const userId = getUserId(req);
    let userState: string | null = null;
    let userStateName: string | null = null;
    if (userId) {
      const user = await storage.getUser(userId);
      if (user?.preferredState) {
        userState = user.preferredState;
        const stateNames: Record<string, string> = {
          UT: "Utah", TX: "Texas", ND: "North Dakota", SD: "South Dakota", NC: "North Carolina",
          OH: "Ohio", MI: "Michigan", ID: "Idaho", WY: "Wyoming", CA: "California",
          VA: "Virginia", NV: "Nevada", AZ: "Arizona", FL: "Florida", IL: "Illinois",
        };
        userStateName = stateNames[userState] || userState;
      }
    }

    try {
      // Import state law helpers and caution level detector
      const { classifyTopic } = await import("../decoders/topicClassifier");
      const { isStateSpecificQuestion, extractStateFromQuestion, shouldTriggerStateLawFallback, STATE_LAW_FALLBACK_TEXT } = await import("../decoders/stateLawFallback");
      const { detectCautionLevel, getFieldGuide, formatFieldGuideForPrompt, getSafeFollowUps } = await import("../decoders/cautionLevelDetector");

      // Classify topic for potential state note lookup
      const topicMatch = await classifyTopic(trimmedTerm, 'credit', openai);
      
      // Detect caution level based on keywords in the question
      const cautionResult = detectCautionLevel(trimmedTerm, 'credit');
      
      // Get field reference guide for this topic
      const fieldGuide = getFieldGuide(topicMatch?.topic || null, 'credit');
      const fieldGuideText = formatFieldGuideForPrompt(fieldGuide);
      
      // Get safe follow-up questions
      const followUps = getSafeFollowUps('credit');
      
      // Check if question references state law or mentions specific state
      const asksAboutStateLaw = isStateSpecificQuestion(trimmedTerm);
      const mentionedState = extractStateFromQuestion(trimmedTerm);
      
      // Determine which state to use for snippet lookup
      const lookupState = mentionedState || userState;
      
      // Fetch vetted state note if we have a topic and state
      let stateNote = null;
      let fallbackText = null;
      if (lookupState && topicMatch) {
        stateNote = await storage.getApprovedStateNote(lookupState, 'credit', topicMatch.topic);
      }
      
      // Determine if fallback is needed using full fallback logic
      if (shouldTriggerStateLawFallback(trimmedTerm, stateNote, topicMatch)) {
        fallbackText = STATE_LAW_FALLBACK_TEXT;
      }

      // Build tone guidance based on caution level
      const toneInstruction = cautionResult.level === 'high' 
        ? 'IMPORTANT: This appears to be a higher-risk situation based on the keywords detected. Be direct about potential concerns while remaining balanced. Include a clear caution note in "What This Does NOT Mean".'
        : cautionResult.level === 'medium'
        ? 'This appears to be a moderate concern. Be balanced - acknowledge the risk signal while providing context. Include appropriate caution in "What This Does NOT Mean".'
        : 'This appears to be a routine inquiry. Provide helpful context while maintaining professional balance.';

      const completion = await openai.chat.completions.create({
        model: "gpt-5-mini",
        messages: [
          {
            role: "system",
            content: `You are a helpful assistant that explains credit report information to landlords reviewing tenant applications. You help them UNDERSTAND, not DECIDE. You never recommend approving or denying - you inform.

CAUTION LEVEL FOR THIS QUESTION: ${cautionResult.level.toUpperCase()}
${toneInstruction}
${cautionResult.triggers.length > 0 ? `Detected keywords: ${cautionResult.triggers.slice(0, 5).join(', ')}` : ''}

STATE-SPECIFIC LAW GUARDRAILS:
- Do NOT generate or infer state or local laws.
- Do NOT include a "State-Specific Notes" section - state-specific guidance will be provided separately by the system.
- If the user asks about a specific state or local law, do NOT attempt to explain it.
- Focus only on explaining the credit item itself in general terms.

${fieldGuideText}

REQUIRED RESPONSE STRUCTURE (use these exact headers):

**WHAT THIS MEANS**
[2-3 sentences in plain English explaining what this credit item is and why it appears on reports. Be specific about what landlords should look at on the report.]

**WHERE TO LOOK ON YOUR REPORT**
• [Reference the specific field name from the guide above and what to look for]
• [Another field and what it tells you]
• [Include the general tip about patterns]

**HOW LANDLORDS TYPICALLY WEIGH THIS**
Factors that increase weight:
• [Factor that makes this more concerning - e.g., recency, amount, multiple occurrences]
• [Another factor - be specific about what to look for on the report]
Factors that reduce weight:
• [Factor that makes this less concerning - e.g., age, medical-related, evidence of recovery]
• [Another factor]

**WHAT THIS DOES NOT MEAN**
${cautionResult.level === 'high' ? `• CAUTION: ${cautionResult.toneGuidance}
• This doesn't automatically require denial, but this pattern is a real risk flag-don't ignore it
• [Specific clarification based on the credit item]
• Apply your written criteria consistently to reduce fair-housing risk` : 
cautionResult.level === 'medium' ? `• This is a real risk flag-don't ignore it, but context matters
• [Clarification to prevent over-reaction while acknowledging the concern]
• Apply your written criteria consistently to reduce fair-housing risk` :
`• [Clarification to prevent over-reaction - e.g., "Does not automatically mean they will miss rent"]
• [Another clarification - e.g., "Older items may have limited relevance"]
• Apply your written criteria consistently`}

**COMMON SCREENING APPROACHES**
• Some landlords require higher income ratios when this appears
• Some landlords allow a qualified co-signer to offset credit risk
• Some landlords apply stricter criteria only if the item is recent
• [Add 1-2 more relevant approaches based on the specific item]

**CONSISTENCY CHECK**
Before relying on this information, confirm that:
• This factor is addressed in your written screening criteria
• You apply the same standards to all applicants
• Any exceptions are documented consistently
• You have not made exceptions based on protected characteristics

**DOCUMENTATION HELPER**
Neutral language (use whether approving or denying):
"Application reviewed using standard screening criteria. Credit report reflects [item type] dated [MM/YYYY]. Applicant was evaluated using the same criteria applied to all applicants."

**OPTIONAL FOLLOW-UP QUESTIONS**
1. "[Conversational question about context]"
2. "[Question about what's changed since]"
3. "[Question about current stability]"

**WHAT LANDLORDS OFTEN CONSIDER NEXT**
• Review your written screening criteria to confirm this factor is addressed
• Compare to your established thresholds (income ratio, credit score minimum, etc.)
• If uncertain, document your reasoning before making any decision
• Consider whether the applicant's current situation differs from the past

CRITICAL RULES:
- NEVER say "approve" or "deny" - you inform, landlords decide
- Use "Some landlords..." phrasing for actions - describe industry behavior, don't prescribe
- Always include the "What This Does NOT Mean" section to prevent over-reaction
- Always include the Consistency Check - this is critical for Fair Housing compliance
- Use bullet points and short sentences - easy to scan quickly
- Be balanced - risks AND context that reduces weight
- NEVER generate state-specific legal content

TONE: Calm, structured, and confidence-building. Help landlords feel informed and capable, not anxious. You are a knowledgeable colleague who explains things simply and reassures them that understanding this is straightforward. Avoid alarm language. Use phrases like "This is common" and "Many landlords handle this by..." Premium and legally sophisticated, but accessible.`
          },
          {
            role: "user",
            content: `Explain this credit report information for a landlord: "${trimmedTerm}"`
          }
        ],
        max_completion_tokens: 1500,
      });

      const explanation = completion.choices[0]?.message?.content || 
        "I couldn't generate an explanation. Please try rephrasing your question.";

      // Track credit helper usage
      if (userId) {
        await storage.trackEvent({
          userId,
          eventType: 'credit_helper_use',
          eventData: { termLength: trimmedTerm.length, cautionLevel: cautionResult.level },
        });
      }

      res.json({ 
        explanation,
        userState: userState || null,
        userStateName: userStateName || null,
        stateNote: stateNote || null,
        fallbackText: fallbackText || null,
        classifiedTopic: topicMatch?.topic || null,
        cautionLevel: cautionResult.level,
        followUpQuestions: followUps.slice(0, 3).map(f => ({
          question: f.question,
          yesImplication: f.yesImplication,
          noImplication: f.noImplication
        })),
      });
    } catch (error) {
      console.error('Error explaining credit term:', error);
      res.status(500).json({
        explanation: "Sorry, something went wrong. Please try again in a moment."
      });
    }
  }));

  // Criminal & Eviction Screening Helper - explain terms using AI
  app.post('/api/explain-criminal-eviction-term', isAuthenticated, requireAccess, asyncHandler(async (req, res) => {
    // Rate limiting (same as chat and credit helper)
    const clientIp = getClientIp(req);
    if (!chatRateLimiter.check(clientIp)) {
      return res.status(429).json({
        explanation: "You're asking questions too quickly. Please wait a moment and try again."
      });
    }

    const { term } = req.body;

    if (!term || typeof term !== 'string') {
      return res.status(400).json({ 
        explanation: "Please provide a valid term or question." 
      });
    }

    const trimmedTerm = term.trim();

    // Privacy and safety checks
    // Block Social Security Numbers (XXX-XX-XXXX format or 9 consecutive digits NOT in date format)
    // SSN format: 3 digits, hyphen, 2 digits, hyphen, 4 digits
    if (/\b\d{3}-\d{2}-\d{4}\b/.test(trimmedTerm) || 
        /\bssn\b/i.test(trimmedTerm)) {
      return res.json({
        explanation: "For your safety, please do not enter Social Security numbers or personal identifiers. Just type the term or concept you'd like explained (for example: 'felony' or 'eviction record')."
      });
    }
    
    // Check for 9 consecutive digits that are NOT dates (MMDDYYYY or similar)
    // Remove dates (MM/DD/YYYY, MM-DD-YYYY) before checking for long number sequences
    const textWithoutDates = trimmedTerm.replace(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g, '');
    // Also remove statute numbers like "76-6-301" which are legal codes, not personal info
    const textWithoutStatutes = textWithoutDates.replace(/\b\d{1,3}-\d{1,3}-\d{1,4}\b/g, '');
    // Check for remaining 9+ consecutive digits that could be SSNs or account numbers
    if (/\d{9,}/.test(textWithoutStatutes)) {
      return res.json({
        explanation: "This appears to contain a long number that could be a personal identifier. For privacy, please remove any account numbers, case numbers, or other long numeric identifiers."
      });
    }

    // Block specific full names (first + last name patterns like "John Smith" or "Jane Doe")
    // Only block if it looks like a person's name with legal suffixes or in case format
    const namePatterns = [
      /\b[A-Z][a-z]+\s+[A-Z][a-z]+\s+(Jr\.?|Sr\.?|III?|IV)\b/, // Name with suffix
      /\b(defendant|plaintiff|vs\.?|versus)\s+[A-Z][a-z]+/i,    // Legal case name format
    ];
    if (namePatterns.some(pattern => pattern.test(trimmedTerm))) {
      return res.json({
        explanation: "For privacy reasons, please remove specific names before submitting. You can describe the charges/offenses without including names."
      });
    }

    // Length check - allow longer inputs for multi-charge analysis
    if (trimmedTerm.length > 2000) {
      return res.status(400).json({ 
        explanation: "Please keep your input under 2000 characters. You can describe multiple charges but try to be concise." 
      });
    }

    // Get user's preferred state for state-specific notes
    const userId = getUserId(req);
    let userState: string | null = null;
    let userStateName: string | null = null;
    if (userId) {
      const user = await storage.getUser(userId);
      if (user?.preferredState) {
        userState = user.preferredState;
        const stateNames: Record<string, string> = {
          UT: "Utah", TX: "Texas", ND: "North Dakota", SD: "South Dakota", NC: "North Carolina",
          OH: "Ohio", MI: "Michigan", ID: "Idaho", WY: "Wyoming", CA: "California",
          VA: "Virginia", NV: "Nevada", AZ: "Arizona", FL: "Florida", IL: "Illinois",
        };
        userStateName = stateNames[userState] || userState;
      }
    }

    try {
      // Import state law helpers and caution level detector
      const { classifyTopic } = await import("../decoders/topicClassifier");
      const { isStateSpecificQuestion, extractStateFromQuestion, shouldTriggerStateLawFallback, STATE_LAW_FALLBACK_TEXT } = await import("../decoders/stateLawFallback");
      const { detectCautionLevel, getFieldGuide, formatFieldGuideForPrompt, getSafeFollowUps } = await import("../decoders/cautionLevelDetector");

      // Classify topic for potential state note lookup
      const topicMatch = await classifyTopic(trimmedTerm, 'criminal_eviction', openai);
      
      // Detect caution level based on keywords in the question
      const cautionResult = detectCautionLevel(trimmedTerm, 'criminal_eviction');
      
      // Get field reference guide for this topic
      const fieldGuide = getFieldGuide(topicMatch?.topic || null, 'criminal_eviction');
      const fieldGuideText = formatFieldGuideForPrompt(fieldGuide);
      
      // Get safe follow-up questions
      const followUps = getSafeFollowUps('criminal_eviction');
      
      // Check if question references state law or mentions specific state
      const asksAboutStateLaw = isStateSpecificQuestion(trimmedTerm);
      const mentionedState = extractStateFromQuestion(trimmedTerm);
      
      // Determine which state to use for snippet lookup
      const lookupState = mentionedState || userState;
      
      // Fetch vetted state note if we have a topic and state
      let stateNote = null;
      let fallbackText = null;
      if (lookupState && topicMatch) {
        stateNote = await storage.getApprovedStateNote(lookupState, 'criminal_eviction', topicMatch.topic);
      }
      
      // Determine if fallback is needed using full fallback logic
      if (shouldTriggerStateLawFallback(trimmedTerm, stateNote, topicMatch)) {
        fallbackText = STATE_LAW_FALLBACK_TEXT;
      }

      // Build tone guidance based on caution level
      const toneInstruction = cautionResult.level === 'high' 
        ? 'IMPORTANT: This appears to be a higher-risk situation based on the keywords detected (e.g., violent offense, recent record, multiple occurrences). Be direct about potential concerns while remaining balanced. Include a clear caution note in "What This Does NOT Mean". Emphasize individualized assessment is critical.'
        : cautionResult.level === 'medium'
        ? 'This appears to be a moderate concern. Be balanced - acknowledge the significance while providing context about outcomes and rehabilitation. Include appropriate caution in "What This Does NOT Mean".'
        : 'This appears to be a routine inquiry. Provide helpful context while maintaining professional balance.';

      const completion = await openai.chat.completions.create({
        model: "gpt-5-mini",
        messages: [
          {
            role: "system",
            content: `You are a helpful assistant that explains criminal background and eviction screening findings to landlords. You help them UNDERSTAND, not DECIDE. You never recommend approving or denying - you inform and emphasize individualized assessment.

CAUTION LEVEL FOR THIS QUESTION: ${cautionResult.level.toUpperCase()}
${toneInstruction}
${cautionResult.triggers.length > 0 ? `Detected keywords: ${cautionResult.triggers.slice(0, 5).join(', ')}` : ''}

STATE-SPECIFIC LAW GUARDRAILS:
- Do NOT generate or infer state or local laws.
- Do NOT include a "State-Specific Notes" section - state-specific guidance will be provided separately by the system.
- If the user asks about a specific state or local law, do NOT attempt to explain it.
- Focus only on explaining the criminal/eviction item itself in general terms.

${fieldGuideText}

REQUIRED RESPONSE STRUCTURE (use these exact headers):

**WHAT THIS MEANS**
[2-3 sentences explaining what this criminal/eviction record means. Be specific about what landlords should look at on the record. Note: Criminal and eviction records reflect information from public court sources. Their relevance depends on type, outcome, timing, and behavior since.]

**WHERE TO LOOK ON THE RECORD**
• [Reference the specific field name from the guide above and what to look for]
• [Another field and what it tells you]
• [Include the general tip about outcomes vs filings]

**HOW THIS IS COMMONLY EVALUATED**
Factors that increase weight:
• [Factor - e.g., record is recent, involves violence/property damage, multiple occurrences]
• [Another factor - be specific about what to look for on the record]
Factors that reduce weight:
• [Factor - e.g., record is older, was dismissed, followed by stable housing/employment]
• [Another factor]

**WHAT THIS DOES NOT MEAN**
${cautionResult.level === 'high' ? `• CAUTION: ${cautionResult.toneGuidance}
• A criminal or eviction record does not automatically require denial, but this appears to be a significant concern-individualized assessment is critical
• [Specific clarification based on the record type]
• Apply your written criteria consistently and document your reasoning` : 
cautionResult.level === 'medium' ? `• This is a real consideration-don't ignore it, but context and outcomes matter
• A criminal or eviction record does not automatically require denial
• [Specific clarification based on the record type]
• Apply your written criteria consistently` :
`• A criminal or eviction record does not require denial
• [Specific clarification - e.g., "Arrests without conviction are not equivalent to convictions"]
• Older records may have limited relevance
• Apply your written criteria consistently`}

**COMMON SCREENING APPROACHES**
• Some landlords distinguish between arrests and convictions
• Some landlords focus on completed evictions vs. filings
• Some landlords apply defined look-back periods
• Some landlords place greater emphasis on recent rental references
• Some landlords consider post-event stability more heavily than the event itself

**CONSISTENCY CHECK**
Before relying on criminal or eviction history, confirm that:
• Your written screening criteria address criminal and eviction records
• The same standards are applied to all applicants
• Arrest-only records are not treated the same as convictions
• Eviction filings and judgments are evaluated differently
• Reviews are individualized, not automatic

**DOCUMENTATION HELPER**
Neutral language (use whether approving or denying):
"Application reviewed using standard screening criteria. Public record information reflects prior criminal and/or eviction history dated [MM/YYYY]. The application was evaluated using the same criteria applied to all applicants."

**WHAT LANDLORDS OFTEN CONSIDER NEXT**
• Review your written screening criteria to confirm criminal/eviction records are addressed
• Apply individualized assessment: nature, severity, time elapsed, and relevance to tenancy
• Document your reasoning before making any decision
• Consider evidence of rehabilitation or stable housing since the record

CRITICAL RULES:
- NEVER say "approve" or "deny" - you inform, landlords decide
- Use "Some landlords..." phrasing - describe industry behavior, don't prescribe
- Always emphasize individualized assessment per HUD 2016 guidance
- Always include "What This Does NOT Mean" section with appropriate caution level
- Always include Consistency Check - critical for Fair Housing compliance
- NEVER suggest blanket bans - these violate Fair Housing
- Be balanced - concerns AND context that reduces weight
- NEVER generate state-specific legal content

TONE: Calm, structured, and confidence-building. Help landlords feel informed and capable, not anxious. You are a knowledgeable colleague who explains things simply and reassures them that handling this correctly is straightforward. ${cautionResult.level === 'high' ? 'Be direct about serious concerns while remaining professional.' : 'Avoid alarm language.'} Use phrases like "This is manageable" and "Many landlords approach this by..." Premium and legally sophisticated, but accessible. Focus on Fair Housing.`
          },
          {
            role: "user",
            content: `Explain this criminal/eviction screening information for a landlord: "${trimmedTerm}"`
          }
        ],
        max_completion_tokens: 1800,
      });

      const explanation = completion.choices[0]?.message?.content || 
        "I couldn't generate an explanation. Please try rephrasing your question.";

      // Track criminal/eviction helper usage
      if (userId) {
        await storage.trackEvent({
          userId,
          eventType: 'criminal_helper_use',
          eventData: { termLength: trimmedTerm.length, cautionLevel: cautionResult.level },
        });
      }

      res.json({ 
        explanation,
        userState: userState || null,
        userStateName: userStateName || null,
        stateNote: stateNote || null,
        fallbackText: fallbackText || null,
        classifiedTopic: topicMatch?.topic || null,
        cautionLevel: cautionResult.level,
        followUpQuestions: followUps.slice(0, 3).map(f => ({
          question: f.question,
          yesImplication: f.yesImplication,
          noImplication: f.noImplication
        })),
      });
    } catch (error) {
      console.error('Error explaining criminal/eviction term:', error);
      res.status(500).json({
        explanation: "Sorry, something went wrong. Please try again in a moment."
      });
    }
  }));
}
