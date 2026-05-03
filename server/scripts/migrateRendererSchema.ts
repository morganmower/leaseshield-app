import { db } from '../db';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('Running renderer schema migration...');

  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE render_strategy AS ENUM ('form_fields', 'coordinates');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `);
  console.log('✓ render_strategy enum created (or already exists)');

  await db.execute(sql`
    ALTER TABLE output_templates
    ADD COLUMN IF NOT EXISTS render_strategy render_strategy DEFAULT 'form_fields'
  `);
  console.log('✓ output_templates.render_strategy added');

  await db.execute(sql`
    ALTER TABLE templates
    ADD COLUMN IF NOT EXISTS output_template_id varchar
  `);
  console.log('✓ templates.output_template_id added');

  await db.execute(sql`
    ALTER TABLE generated_notice_documents
    ADD COLUMN IF NOT EXISTS render_mode_used varchar,
    ADD COLUMN IF NOT EXISTS render_strategy_used varchar,
    ADD COLUMN IF NOT EXISTS base_pdf_sha256 varchar,
    ADD COLUMN IF NOT EXISTS output_pdf_sha256 varchar
  `);
  console.log('✓ generated_notice_documents provenance columns added');

  const mi_output_template = await db.execute(sql`
    SELECT ot.id
    FROM output_templates ot
    JOIN notice_form_versions nfv ON ot.form_version_id = nfv.id
    JOIN notice_forms nf ON nfv.form_id = nf.id
    WHERE nf.key = 'mi_dc_100a_demand_possession_nonpayment'
    AND ot.mode = 'official_pdf_overlay'
    LIMIT 1
  `);

  if (mi_output_template.rows.length > 0) {
    const outputTemplateId = (mi_output_template.rows[0] as any).id;

    await db.execute(sql`
      UPDATE templates
      SET output_template_id = ${outputTemplateId}
      WHERE state_id = 'MI'
      AND (
        LOWER(title) LIKE '%demand for possession%'
        OR (LOWER(title) LIKE '%seven%day%' AND LOWER(title) LIKE '%demand%')
      )
    `);
    console.log(`✓ MI Demand for Possession template linked to output_template ${outputTemplateId}`);
  } else {
    console.log('⚠ MI DC 100a output_template not found - skipping template link');
  }

  console.log('\nMigration complete.');
  process.exit(0);
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
