import { db } from '../db';
import { legalUpdates, normalizedUpdates } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

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

    await db.insert(legalUpdates).values({
      stateId,
      title: item.title,
      summary: item.summary || item.title,
      whyItMatters: item.aiAnalysis || 'This legislative update may affect your rental properties. Review for potential impact on your lease agreements and compliance requirements.',
      impactLevel: item.severity || 'medium',
      category,
      sourceBillId: item.id,
      affectedTemplateIds: item.affectedTemplateIds || [],
      isActive: true,
      effectiveDate: item.effectiveDate,
    });

    publishedCount++;
    stateStats[stateId] = (stateStats[stateId] || 0) + 1;
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
