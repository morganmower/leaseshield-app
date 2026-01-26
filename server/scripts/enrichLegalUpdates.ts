import { db } from '../db';
import { legalUpdates, normalizedUpdates } from '@shared/schema';
import { eq, isNull, or, sql } from 'drizzle-orm';
import OpenAI from 'openai';

const openai = new OpenAI();

interface EnrichmentResult {
  beforeText: string;
  afterText: string;
  whyItMatters: string;
  effectiveDate: Date | null;
}

async function generateEnrichment(
  title: string,
  summary: string,
  stateId: string,
  category: string
): Promise<EnrichmentResult> {
  const stateName = stateId === 'US' ? 'Federal' : stateId;
  
  const prompt = `You are a legal analyst helping landlords understand new housing legislation.

Title: ${title}
Summary: ${summary || title}
State: ${stateName}
Category: ${category}

Generate a brief, landlord-friendly analysis with these 4 parts:

1. BEFORE: What was the law/situation BEFORE this change? (1-2 sentences, start with "Previously..." or "Under the old law...")

2. AFTER: What is the NEW requirement or change? (1-2 sentences, start with "Now..." or "The new law...")

3. WHY_IT_MATTERS: Why should a landlord care about this? What action might they need to take? (1-2 sentences)

4. EFFECTIVE_DATE: Based on the title/summary, estimate when this might take effect. If a bill is being introduced, assume 6-12 months from now. If it mentions a specific date, use that. Format as YYYY-MM-DD. If truly unknown, respond with "unknown".

Respond in this exact JSON format:
{
  "beforeText": "...",
  "afterText": "...",
  "whyItMatters": "...",
  "effectiveDate": "YYYY-MM-DD or unknown"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    
    let effectiveDate: Date | null = null;
    if (parsed.effectiveDate && parsed.effectiveDate !== 'unknown') {
      const dateObj = new Date(parsed.effectiveDate);
      if (!isNaN(dateObj.getTime())) {
        effectiveDate = dateObj;
      }
    }

    return {
      beforeText: parsed.beforeText || '',
      afterText: parsed.afterText || '',
      whyItMatters: parsed.whyItMatters || '',
      effectiveDate,
    };
  } catch (error) {
    console.error(`  ⚠️ AI generation failed:`, error);
    return {
      beforeText: 'Previous regulations applied to this area.',
      afterText: 'New requirements may be in effect. Review the full legislation for details.',
      whyItMatters: 'This legislative update may affect your rental properties. Review for potential impact on your lease agreements and compliance requirements.',
      effectiveDate: null,
    };
  }
}

async function enrichLegalUpdates() {
  console.log('🔄 Enriching legal updates with AI-generated content...\n');

  const updatesToEnrich = await db.select()
    .from(legalUpdates)
    .where(
      or(
        isNull(legalUpdates.beforeText),
        eq(legalUpdates.beforeText, ''),
        isNull(legalUpdates.afterText),
        eq(legalUpdates.afterText, '')
      )
    );

  console.log(`Found ${updatesToEnrich.length} updates needing enrichment\n`);

  let enrichedCount = 0;
  let errorCount = 0;
  const stateStats: Record<string, number> = {};

  for (const update of updatesToEnrich) {
    process.stdout.write(`Processing: ${update.title.substring(0, 50)}...`);

    try {
      const enrichment = await generateEnrichment(
        update.title,
        update.summary || '',
        update.stateId,
        update.category || 'general'
      );

      await db.update(legalUpdates)
        .set({
          beforeText: enrichment.beforeText,
          afterText: enrichment.afterText,
          whyItMatters: enrichment.whyItMatters,
          effectiveDate: enrichment.effectiveDate || update.effectiveDate,
          updatedAt: new Date(),
        })
        .where(eq(legalUpdates.id, update.id));

      enrichedCount++;
      stateStats[update.stateId] = (stateStats[update.stateId] || 0) + 1;
      console.log(' ✓');

      // Pause between AI calls to avoid hitting rate limits
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (error: any) {
      if (error?.status === 429) {
        console.log(' ⏳ rate limited, waiting 5s...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        // Retry this item
        const retryEnrichment = await generateEnrichment(
          update.title,
          update.summary || '',
          update.stateId,
          update.category || 'general'
        );
        await db.update(legalUpdates)
          .set({
            beforeText: retryEnrichment.beforeText,
            afterText: retryEnrichment.afterText,
            whyItMatters: retryEnrichment.whyItMatters,
            effectiveDate: retryEnrichment.effectiveDate || update.effectiveDate,
            updatedAt: new Date(),
          })
          .where(eq(legalUpdates.id, update.id));
        enrichedCount++;
        stateStats[update.stateId] = (stateStats[update.stateId] || 0) + 1;
        console.log(' ✓ (retry)');
      } else {
        errorCount++;
        console.log(' ✗');
        console.error(`  Error:`, error);
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
