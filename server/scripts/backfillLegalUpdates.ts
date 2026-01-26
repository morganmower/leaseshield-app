import { db } from '../db';
import { legalUpdates, normalizedUpdates } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
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

async function backfillLegalUpdates() {
  console.log('🔄 Starting backfill of legal updates from normalized_updates...\n');

  const HOUSING_TOPICS = [
    'landlord_tenant',
    'eviction', 
    'security_deposit',
    'fair_housing',
    'nahasda_core',
    'ihbg',
    'tribal_adjacent',
    'hud_general',
  ];

  const unpublishedItems = await db.select()
    .from(normalizedUpdates)
    .where(
      sql`${normalizedUpdates.topics} && ARRAY[${sql.join(HOUSING_TOPICS.map(t => sql`${t}`), sql`, `)}]::text[]`
    );

  console.log(`Found ${unpublishedItems.length} housing-related items in normalized_updates\n`);

  let publishedCount = 0;
  let skippedCount = 0;
  const stateStats: Record<string, number> = {};

  for (const item of unpublishedItems) {
    const [existing] = await db.select({ id: legalUpdates.id })
      .from(legalUpdates)
      .where(eq(legalUpdates.sourceBillId, item.id))
      .limit(1);

    if (existing) {
      skippedCount++;
      continue;
    }

    const topics = item.topics || [];
    let category = 'general';

    if (topics.includes('nahasda_core') || topics.includes('ihbg') || topics.includes('tribal_adjacent')) {
      category = 'tribal';
    } else if (topics.includes('hud_general')) {
      category = 'section8';
    } else if (topics.includes('eviction')) {
      category = 'eviction';
    } else if (topics.includes('security_deposit')) {
      category = 'deposits';
    } else if (topics.includes('fair_housing')) {
      category = 'fair_housing';
    } else if (topics.includes('landlord_tenant')) {
      category = 'landlord_tenant';
    }

    const titleLower = (item.title || '').toLowerCase();
    const summaryLower = (item.summary || '').toLowerCase();
    if (titleLower.includes('section 8') || titleLower.includes('housing choice voucher') || 
        titleLower.includes('hcv') || summaryLower.includes('section 8') ||
        summaryLower.includes('housing assistance') || summaryLower.includes('subsidized housing')) {
      category = 'section8';
    }

    const stateId = item.jurisdictionState || (item.jurisdictionLevel === 'federal' ? 'US' : 'US');

    process.stdout.write(`  Publishing: ${item.title?.substring(0, 40)}...`);

    const enrichment = await generateEnrichment(
      item.title || '',
      item.summary || '',
      stateId,
      category
    );

    await db.insert(legalUpdates).values({
      stateId,
      title: item.title,
      summary: item.summary || item.title,
      beforeText: enrichment.beforeText,
      afterText: enrichment.afterText,
      whyItMatters: enrichment.whyItMatters || item.aiAnalysis || 'This legislative update may affect your rental properties.',
      impactLevel: item.severity || 'medium',
      category,
      sourceBillId: item.id,
      affectedTemplateIds: item.affectedTemplateIds || [],
      isActive: true,
      effectiveDate: enrichment.effectiveDate || item.effectiveDate,
    });

    console.log(' ✓');
    publishedCount++;
    stateStats[stateId] = (stateStats[stateId] || 0) + 1;

    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log(`\n✅ Backfill complete!`);
  console.log(`   Published: ${publishedCount} new items`);
  console.log(`   Skipped: ${skippedCount} (already published)`);
  console.log(`\n📊 Items by state:`);
  for (const [state, count] of Object.entries(stateStats).sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`   ${state}: ${count} updates`);
  }

  process.exit(0);
}

backfillLegalUpdates().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
