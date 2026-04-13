/**
 * Seed script: Update DB records for official court form overlays.
 *
 * Covers:
 *  1. MI DC 100c — Complaint for Land Contract Forfeiture (form_fields strategy)
 *  2. SD UJS 112  — Verified Complaint for Eviction (coordinates strategy — infrastructure only)
 *  3. UT 1100EV   — Complaint for Unlawful Detainer (coordinates strategy — infrastructure only)
 *
 * OH has no statewide standardized eviction complaint form (county-level only).
 * ID: now implemented via seedIDOverlayFields.ts (courtselfhelp.idaho.gov CAO UD 1-1).
 *
 * Run: npx tsx server/scripts/seedOfficialForms.ts
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// MI DC 100c field map: field_key (matches form_fields.key) → pdf AcroForm field name
// ---------------------------------------------------------------------------
const MI_DC100C_FIELD_MAP: Record<string, string> = {
  seller_name: 'name type or print',
  seller_address: 'address',
  seller_city_state_zip: 'city state zip',
  seller_phone: 'telephone no',
  buyer_name: 'To',
  premises_address: 'address or description',
  compliance_deadline: 'you must move by date',
  signature_date: 'date',
  service_date: 'cosdate',
  server_name: 'cosname',
  cos_signature: 'signature',
  service_checkbox_personal: 'delivering it personally',
  service_checkbox_posting: 'delivering it on the premises',
  service_checkbox_first_class_mail: 'first class mail',
  service_checkbox_electronic: 'electronic service',
  electronic_service_address: 'electronic service address',
  legal_basis_mcl_554: 'MCL 554.134 1 or 3 see instructions',
  other_reason_checkbox: 'other',
  other_reason_fill: 'other fill',
};

// overlay_fields rows for DC 100c — field_key list (x/y are placeholders for form_fields strategy;
// they are not used for drawing but are required by the schema).
const DC100C_OVERLAY_FIELDS = [
  { fieldKey: 'seller_name', pageNumber: 1, x: 168, y: 528, fontSize: 9, maxWidth: 153 },
  { fieldKey: 'seller_address', pageNumber: 1, x: 66, y: 269, fontSize: 9, maxWidth: 273 },
  { fieldKey: 'seller_city_state_zip', pageNumber: 1, x: 66, y: 245, fontSize: 9, maxWidth: 201 },
  { fieldKey: 'seller_phone', pageNumber: 1, x: 271, y: 245, fontSize: 9, maxWidth: 68 },
  { fieldKey: 'buyer_name', pageNumber: 1, x: 75, y: 548, fontSize: 9, maxWidth: 266 },
  { fieldKey: 'premises_address', pageNumber: 1, x: 80, y: 433, fontSize: 9, maxWidth: 494 },
  { fieldKey: 'compliance_deadline', pageNumber: 1, x: 150, y: 413, fontSize: 9, maxWidth: 162 },
  { fieldKey: 'signature_date', pageNumber: 1, x: 66, y: 317, fontSize: 9, maxWidth: 120 },
  { fieldKey: 'service_date', pageNumber: 1, x: 121, y: 197, fontSize: 9, maxWidth: 112 },
  { fieldKey: 'server_name', pageNumber: 1, x: 334, y: 197, fontSize: 9, maxWidth: 242 },
  { fieldKey: 'cos_signature', pageNumber: 1, x: 321, y: 89, fontSize: 9, maxWidth: 255 },
  { fieldKey: 'service_checkbox_personal', pageNumber: 1, x: 78, y: 173, fontSize: 9, maxWidth: null },
  { fieldKey: 'service_checkbox_posting', pageNumber: 1, x: 78, y: 161, fontSize: 9, maxWidth: null },
  { fieldKey: 'service_checkbox_first_class_mail', pageNumber: 1, x: 78, y: 137, fontSize: 9, maxWidth: null },
  { fieldKey: 'service_checkbox_electronic', pageNumber: 1, x: 78, y: 125, fontSize: 9, maxWidth: null },
  { fieldKey: 'electronic_service_address', pageNumber: 1, x: 211, y: 113, fontSize: 9, maxWidth: 266 },
  { fieldKey: 'legal_basis_mcl_554', pageNumber: 1, x: 66, y: 504, fontSize: 9, maxWidth: null },
  { fieldKey: 'other_reason_checkbox', pageNumber: 1, x: 265, y: 504, fontSize: 9, maxWidth: null },
  { fieldKey: 'other_reason_fill', pageNumber: 1, x: 302, y: 504, fontSize: 9, maxWidth: 155 },
];

async function seedMiDc100c() {
  console.log('\n=== MI DC 100c — Complaint: Land Contract Forfeiture ===');

  const OUTPUT_TEMPLATE_ID = '65e4bfa5-3fe5-4852-825e-86c2e6510c57';
  const FORM_VERSION_ID = '047db11e-b296-4dc4-a6be-44db433520f3';

  // 1. Update output_template: flip to official_pdf_overlay
  await db.execute(sql`
    UPDATE output_templates SET
      mode               = 'official_pdf_overlay',
      render_strategy    = 'form_fields',
      base_pdf_attachment_path = 'server/assets/court-forms/MI_DC_100c.pdf',
      page_count         = 2,
      field_map_json     = ${JSON.stringify(MI_DC100C_FIELD_MAP)}::jsonb
    WHERE id = ${OUTPUT_TEMPLATE_ID}
  `);
  console.log('  output_template updated → official_pdf_overlay / form_fields / 2 pages');

  // 2. Add signature_date form field (if missing) to DC 100c form_version
  const existing = await db.execute(sql`
    SELECT id FROM form_fields WHERE form_version_id = ${FORM_VERSION_ID} AND key = 'signature_date'
  `);
  if (!existing.rows.length) {
    await db.execute(sql`
      INSERT INTO form_fields (id, form_version_id, key, label, type, required, sort_order, field_group)
      VALUES (gen_random_uuid(), ${FORM_VERSION_ID}, 'signature_date', 'Signature Date', 'date', false, 20, 'Service')
    `);
    console.log('  Added form field: signature_date');
  } else {
    console.log('  form field signature_date already exists');
  }

  // 3. Clear existing overlay_fields for this template, then re-seed
  await db.execute(sql`DELETE FROM overlay_fields WHERE output_template_id = ${OUTPUT_TEMPLATE_ID}`);
  let inserted = 0;
  for (const f of DC100C_OVERLAY_FIELDS) {
    await db.execute(sql`
      INSERT INTO overlay_fields (id, output_template_id, field_key, page_number, x, y, font, font_size, max_width, align, wrap)
      VALUES (gen_random_uuid(), ${OUTPUT_TEMPLATE_ID}, ${f.fieldKey}, ${f.pageNumber},
              ${f.x}, ${f.y}, 'Helvetica', ${f.fontSize}, ${f.maxWidth}, 'left', false)
    `);
    inserted++;
  }
  console.log(`  Seeded ${inserted} overlay_fields rows`);
  console.log('  MI DC 100c ready: form_fields strategy, field_map_json in DB ✓');
}

async function seedSdVerifiedComplaint() {
  console.log('\n=== SD UJS 112 — Verified Complaint for Eviction ===');

  const FORM_ID_KEY = 'sd_verified_complaint_eviction';
  const STATE_ID = 'SD';
  const LIBRARY_TEMPLATE_ID = 'd92f5416-75fc-4889-8bec-a4c10ede1ad9';

  // Check if notice_form already exists
  const existing = await db.execute(sql`
    SELECT id FROM notice_forms WHERE key = ${FORM_ID_KEY}
  `);

  let formId: string;
  let versionId: string;
  let outputTemplateId: string;

  if (existing.rows.length) {
    console.log('  notice_form already exists, verifying output_template...');
    formId = (existing.rows[0] as any).id;
    const ver = await db.execute(sql`SELECT id FROM notice_form_versions WHERE form_id = ${formId} LIMIT 1`);
    versionId = (ver.rows[0] as any).id;
    const ot = await db.execute(sql`SELECT id FROM output_templates WHERE form_version_id = ${versionId} LIMIT 1`);
    outputTemplateId = (ot.rows[0] as any).id;
  } else {
    // Create notice_form
    const formResult = await db.execute(sql`
      INSERT INTO notice_forms (id, state_id, key, display_name, notice_category, local_overlay_risk, is_active)
      VALUES (gen_random_uuid(), ${STATE_ID}, ${FORM_ID_KEY}, 'Verified Complaint for Eviction (SD UJS 112)', 'eviction', 'low', true)
      RETURNING id
    `);
    formId = (formResult.rows[0] as any).id;
    console.log(`  Created notice_form: ${formId}`);

    // Create notice_form_version
    const verResult = await db.execute(sql`
      INSERT INTO notice_form_versions (id, form_id, version_number, status, effective_start)
      VALUES (gen_random_uuid(), ${formId}, 1, 'approved', '2025-07-01')
      RETURNING id
    `);
    versionId = (verResult.rows[0] as any).id;
    console.log(`  Created form_version: ${versionId}`);

    // Create output_template
    const otResult = await db.execute(sql`
      INSERT INTO output_templates (id, form_version_id, mode, render_strategy, base_pdf_attachment_path, page_count)
      VALUES (gen_random_uuid(), ${versionId}, 'official_pdf_overlay', 'coordinates',
              'server/assets/court-forms/SD_verified_complaint.pdf', 4)
      RETURNING id
    `);
    outputTemplateId = (otResult.rows[0] as any).id;
    console.log(`  Created output_template: ${outputTemplateId}`);
  }

  // NOTE: overlay_fields (coordinates) for SD are NOT seeded here.
  // The SD UJS 112 PDF has no AcroForm fields; pixel-accurate coordinates
  // require visual inspection of the PDF. Until calibrated, the library
  // template is NOT linked to this output_template (output_template_id stays null).
  // To link: UPDATE templates SET output_template_id = '<outputTemplateId>' WHERE id = '<LIBRARY_TEMPLATE_ID>'
  console.log(`  SD infrastructure ready. output_template_id = ${outputTemplateId}`);
  console.log(`  PENDING: overlay_fields calibration needed before linking library template ${LIBRARY_TEMPLATE_ID}`);
  console.log('  SD UJS 112 ✓ (infrastructure created — coordinates pending)');
}

async function seedUtComplaint() {
  console.log('\n=== UT 1100EV — Complaint for Unlawful Detainer ===');

  const FORM_ID_KEY = 'ut_complaint_unlawful_detainer';
  const STATE_ID = 'UT';
  const LIBRARY_TEMPLATE_ID = '31e92a29-0232-460c-976c-caf5b7d993fc';

  const existing = await db.execute(sql`
    SELECT id FROM notice_forms WHERE key = ${FORM_ID_KEY}
  `);

  let formId: string;
  let versionId: string;
  let outputTemplateId: string;

  if (existing.rows.length) {
    console.log('  notice_form already exists, verifying output_template...');
    formId = (existing.rows[0] as any).id;
    const ver = await db.execute(sql`SELECT id FROM notice_form_versions WHERE form_id = ${formId} LIMIT 1`);
    versionId = (ver.rows[0] as any).id;
    const ot = await db.execute(sql`SELECT id FROM output_templates WHERE form_version_id = ${versionId} LIMIT 1`);
    outputTemplateId = (ot.rows[0] as any).id;
  } else {
    const formResult = await db.execute(sql`
      INSERT INTO notice_forms (id, state_id, key, display_name, notice_category, local_overlay_risk, is_active)
      VALUES (gen_random_uuid(), ${STATE_ID}, ${FORM_ID_KEY}, 'Complaint for Unlawful Detainer (UT 1100EV)', 'eviction', 'low', true)
      RETURNING id
    `);
    formId = (formResult.rows[0] as any).id;
    console.log(`  Created notice_form: ${formId}`);

    const verResult = await db.execute(sql`
      INSERT INTO notice_form_versions (id, form_id, version_number, status, effective_start)
      VALUES (gen_random_uuid(), ${formId}, 1, 'approved', '2025-04-14')
      RETURNING id
    `);
    versionId = (verResult.rows[0] as any).id;
    console.log(`  Created form_version: ${versionId}`);

    const otResult = await db.execute(sql`
      INSERT INTO output_templates (id, form_version_id, mode, render_strategy, base_pdf_attachment_path, page_count)
      VALUES (gen_random_uuid(), ${versionId}, 'official_pdf_overlay', 'coordinates',
              'server/assets/court-forms/UT_complaint_unlawful_detainer.pdf', 9)
      RETURNING id
    `);
    outputTemplateId = (otResult.rows[0] as any).id;
    console.log(`  Created output_template: ${outputTemplateId}`);
  }

  console.log(`  UT infrastructure ready. output_template_id = ${outputTemplateId}`);
  console.log(`  PENDING: overlay_fields calibration needed before linking library template ${LIBRARY_TEMPLATE_ID}`);
  console.log('  UT 1100EV ✓ (infrastructure created — coordinates pending)');
}

async function main() {
  console.log('=== Official Court Form Seed Script ===');
  console.log('OH: no statewide eviction form (county-level only) — remains leaseshield_formatted');
  console.log('ID: implemented separately — run seedIDOverlayFields.ts\n');

  await seedMiDc100c();
  await seedSdVerifiedComplaint();
  await seedUtComplaint();

  console.log('\n=== Seed complete ===');
  console.log('Next: run smoke test for MI DC 100c');
  console.log('      npx tsx server/scripts/testOverlayOutput.ts');
}

main().catch(console.error).finally(() => process.exit(0));
