/**
 * Seed MI DC 100c Library Template
 *
 * Creates the library template row in the `templates` table for the
 * Michigan SCAO DC 100c (Complaint - Land Contract Forfeiture / Termination)
 * and links it to the existing output_template row.
 *
 * Run: npx tsx server/scripts/seedMiDC100cLibraryTemplate.ts
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';

const OUTPUT_TEMPLATE_ID = '65e4bfa5-3fe5-4852-825e-86c2e6510c57';

async function seed() {
  console.log('Seeding MI DC 100c library template...');

  const existing = await db.execute(sql`
    SELECT id FROM templates WHERE key = 'evictions_mi_dc_100c_land_contract_complaint'
  `);
  if (existing.rows.length > 0) {
    console.log('MI DC 100c library template already exists. Checking output_template_id link...');
    const row = existing.rows[0] as any;
    if (!row.output_template_id) {
      await db.execute(sql`
        UPDATE templates SET output_template_id = ${OUTPUT_TEMPLATE_ID}
        WHERE id = ${row.id}
      `);
      console.log('Linked output_template_id on existing template.');
    } else {
      console.log('output_template_id already set. No changes needed.');
    }
    process.exit(0);
  }

  const id = randomUUID();
  await db.execute(sql`
    INSERT INTO templates (
      id, title, description, category, template_type, state_id,
      key, generation_mode, output_template_id, is_active, version, sort_order
    ) VALUES (
      ${id},
      'Complaint - Land Contract Forfeiture (MI DC 100c)',
      'Official Michigan SCAO DC 100c form. Used by land contract sellers (landlords) to initiate forfeiture proceedings when the buyer defaults on payments. Fills the official court form directly - zero LeaseShield branding.',
      'evictions',
      'eviction_complaint',
      'MI',
      'evictions_mi_dc_100c_land_contract_complaint',
      'wizard',
      ${OUTPUT_TEMPLATE_ID},
      true,
      1,
      100
    )
  `);

  console.log(`MI DC 100c library template created: ${id}`);
  console.log('Done.');
  process.exit(0);
}

seed().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
