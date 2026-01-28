import { db } from '../db';
import { legalUpdates, rawLegislationItems, normalizedUpdates, legislativeMonitoring } from '@shared/schema';
import { eq, or, like, and, isNull, sql } from 'drizzle-orm';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

interface EnrichmentResult {
  summary: string;
  beforeText: string;
  afterText: string;
  whyItMatters: string;
  effectiveDate: Date | null;
  billStatus: string;
  actionItems: string;
  expectedTimeline: string;
}

const STATE_NAMES: Record<string, string> = {
  'US': 'Federal (applies to all states)',
  'UT': 'Utah',
  'TX': 'Texas',
  'ND': 'North Dakota',
  'SD': 'South Dakota',
  'NC': 'North Carolina',
  'OH': 'Ohio',
  'MI': 'Michigan',
  'ID': 'Idaho',
  'WY': 'Wyoming',
  'CA': 'California',
  'VA': 'Virginia',
  'NV': 'Nevada',
  'AZ': 'Arizona',
  'FL': 'Florida',
  'IL': 'Illinois',
  'NM': 'New Mexico',
};

async function generateEnrichment(
  title: string,
  summary: string,
  stateId: string,
  category: string,
  rawData: any,
  sourceUrl: string | null
): Promise<EnrichmentResult> {
  const stateName = STATE_NAMES[stateId] || stateId;
  
  const billContext = rawData ? `
Additional Context:
- Bill Number: ${rawData.bill_number || rawData.identifier || 'N/A'}
- Status: ${rawData.status || rawData.last_action || 'Unknown'}
- Last Action: ${rawData.last_action || rawData.latest_action_description || 'N/A'}
- Last Action Date: ${rawData.last_action_date || rawData.latest_action_date || 'N/A'}
- Bill URL: ${sourceUrl || rawData.url || rawData.openstates_url || 'N/A'}
${rawData.abstract ? `- Abstract: ${rawData.abstract}` : ''}
${rawData.description ? `- Description: ${rawData.description}` : ''}
` : '';

  const prompt = `You are a legal analyst helping landlords understand new housing legislation. Your audience is small and midsize landlords who need practical, actionable information.

Title: ${title}
Summary: ${summary || title}
State: ${stateName}
Category: ${category || 'housing legislation'}
${billContext}

Generate a comprehensive, landlord-friendly analysis. Be SPECIFIC - mention actual requirements, dollar amounts, timeframes, and consequences where available.

Respond in this exact JSON format:
{
  "summary": "A clear 2-3 sentence summary explaining what this bill/regulation does in plain English. Be specific about requirements.",
  "beforeText": "What was the law/situation BEFORE this change? Start with 'Previously' or 'Under current law'. Be specific about what landlords could or couldn't do.",
  "afterText": "What is the NEW requirement? Start with 'Now' or 'This law would'. Include specific requirements, amounts, or deadlines if mentioned.",
  "whyItMatters": "Why should a ${stateName} landlord care? What's the financial or legal impact? What could happen if they don't comply?",
  "billStatus": "One of: introduced, in_committee, passed_house, passed_senate, passed_legislature, sent_to_governor, signed, enacted, vetoed, or unknown",
  "actionItems": "What should landlords do NOW? List 1-3 specific actions they should take today.",
  "expectedTimeline": "When will this take effect or when is the next milestone? Be specific with dates if available, or estimate based on typical legislative timelines."
}

IMPORTANT: Do NOT use generic placeholder text. If you don't have specific information, make reasonable inferences based on the bill title and category, clearly noting any assumptions.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 800,
    });

    const content = response.choices[0]?.message?.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    
    let effectiveDate: Date | null = null;
    if (rawData?.effective_date || rawData?.effectiveDate) {
      const dateStr = rawData.effective_date || rawData.effectiveDate;
      const dateObj = new Date(dateStr);
      if (!isNaN(dateObj.getTime())) {
        effectiveDate = dateObj;
      }
    }

    return {
      summary: parsed.summary || summary || title,
      beforeText: parsed.beforeText || '',
      afterText: parsed.afterText || '',
      whyItMatters: parsed.whyItMatters || '',
      effectiveDate,
      billStatus: parsed.billStatus || 'unknown',
      actionItems: parsed.actionItems || '',
      expectedTimeline: parsed.expectedTimeline || '',
    };
  } catch (error) {
    console.error(`  ⚠️ AI generation failed:`, error);
    throw error;
  }
}

function isPlaceholderText(text: string | null | undefined): boolean {
  if (!text) return true;
  const placeholders = [
    'Previous regulations applied to this area',
    'New requirements may be in effect',
    'This legislative update may affect your rental properties',
    'Review for potential impact',
    'See full legislation for details',
  ];
  return placeholders.some(p => text.includes(p));
}

async function enrichLegalUpdates() {
  console.log('🔄 Enriching legal updates with AI-generated content...\n');

  const allUpdates = await db.select()
    .from(legalUpdates)
    .where(eq(legalUpdates.isActive, true));

  const updatesToEnrich = allUpdates.filter(update => 
    isPlaceholderText(update.whyItMatters) ||
    isPlaceholderText(update.beforeText) ||
    isPlaceholderText(update.afterText) ||
    !(update as any).aiEnriched
  );

  console.log(`Found ${updatesToEnrich.length} of ${allUpdates.length} updates needing enrichment\n`);

  if (updatesToEnrich.length === 0) {
    console.log('✅ All updates are already enriched!');
    process.exit(0);
  }

  let enrichedCount = 0;
  let errorCount = 0;
  const stateStats: Record<string, number> = {};

  for (const update of updatesToEnrich) {
    const shortTitle = update.title.length > 60 ? update.title.substring(0, 57) + '...' : update.title;
    process.stdout.write(`[${update.stateId}] ${shortTitle}`);

    try {
      let rawData: any = null;
      let sourceUrl: string | null = null;

      if (update.sourceBillId) {
        const monitoring = await db.select()
          .from(legislativeMonitoring)
          .where(eq(legislativeMonitoring.id, update.sourceBillId))
          .limit(1);
        
        if (monitoring[0]) {
          rawData = monitoring[0];
          sourceUrl = monitoring[0].url;
        }
      }

      if (!rawData) {
        const normalized = await db.select()
          .from(normalizedUpdates)
          .where(like(normalizedUpdates.title, `%${update.title.substring(0, 30)}%`))
          .limit(1);
        
        if (normalized[0]) {
          sourceUrl = normalized[0].url;
          if (normalized[0].rawItemId) {
            const raw = await db.select()
              .from(rawLegislationItems)
              .where(eq(rawLegislationItems.id, normalized[0].rawItemId))
              .limit(1);
            if (raw[0]?.rawData) {
              rawData = raw[0].rawData;
            }
          }
        }
      }

      const enrichment = await generateEnrichment(
        update.title,
        update.summary || '',
        update.stateId,
        update.category || 'general',
        rawData,
        sourceUrl
      );

      await db.update(legalUpdates)
        .set({
          summary: enrichment.summary,
          beforeText: enrichment.beforeText,
          afterText: enrichment.afterText,
          whyItMatters: enrichment.whyItMatters,
          effectiveDate: enrichment.effectiveDate || update.effectiveDate,
          billStatus: enrichment.billStatus,
          actionItems: enrichment.actionItems,
          expectedTimeline: enrichment.expectedTimeline,
          sourceUrl: sourceUrl,
          aiEnriched: true,
          updatedAt: new Date(),
        })
        .where(eq(legalUpdates.id, update.id));

      enrichedCount++;
      stateStats[update.stateId] = (stateStats[update.stateId] || 0) + 1;
      console.log(' ✓');

      await new Promise(resolve => setTimeout(resolve, 1500));
    } catch (error: any) {
      if (error?.status === 429 || error?.message?.includes('rate')) {
        console.log(' ⏳ rate limited, waiting 10s...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        try {
          const retryEnrichment = await generateEnrichment(
            update.title,
            update.summary || '',
            update.stateId,
            update.category || 'general',
            null,
            null
          );
          await db.update(legalUpdates)
            .set({
              summary: retryEnrichment.summary,
              beforeText: retryEnrichment.beforeText,
              afterText: retryEnrichment.afterText,
              whyItMatters: retryEnrichment.whyItMatters,
              billStatus: retryEnrichment.billStatus,
              actionItems: retryEnrichment.actionItems,
              expectedTimeline: retryEnrichment.expectedTimeline,
              aiEnriched: true,
              updatedAt: new Date(),
            })
            .where(eq(legalUpdates.id, update.id));
          enrichedCount++;
          stateStats[update.stateId] = (stateStats[update.stateId] || 0) + 1;
          console.log(' ✓ (retry)');
        } catch (retryError) {
          errorCount++;
          console.log(' ✗ (retry failed)');
        }
      } else {
        errorCount++;
        console.log(' ✗');
        console.error(`  Error:`, error?.message || error);
      }
    }
  }

  console.log(`\n✅ Enrichment complete!`);
  console.log(`   Enriched: ${enrichedCount} updates`);
  console.log(`   Errors: ${errorCount}`);
  console.log(`\n📊 Enriched by state:`);
  for (const [state, count] of Object.entries(stateStats).sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`   ${state}: ${count} updates`);
  }

  process.exit(0);
}

enrichLegalUpdates().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
