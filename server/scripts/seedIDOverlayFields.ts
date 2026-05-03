/**
 * Seed script: Wire Idaho Complaint for Eviction (Expedited Proceeding)
 * to official PDF overlay using CAO_UD_1-1.pdf from courtselfhelp.idaho.gov
 *
 * PDF: server/assets/court-forms/ID_CAO_UD_1-1.pdf
 * Strategy: form_fields (PDF has 25 AcroForm fields)
 * Pages: 2
 *
 * Field keys use camelCase to match the existing fillable_form_data IDs in the
 * library template - no frontend wizard changes needed.
 *
 * Run: npx tsx server/scripts/seedIDOverlayFields.ts
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';

const LIBRARY_TEMPLATE_ID = 'e0019043-64e1-4f83-b8ba-bb6ed3baa621';
const NOTICE_FORM_KEY = 'id_complaint_forcible_detainer';
const STATE_ID = 'ID';
const PDF_PATH = 'server/assets/court-forms/ID_CAO_UD_1-1.pdf';

// Maps field_key (from inputs / overlay_fields) → exact AcroForm field name in PDF
// Dropdown fields (Select Your County, Select Your Judicial District) are omitted
// because pdf-lib cannot set dropdown values to arbitrary text.
const FIELD_MAP: Record<string, string> = {
  plaintiffName:       'Full Name of Plaintiff 1',
  plaintiffAddress:    'Mailing Address Street or Post Office Box',
  plaintiffCityStateZip: 'City State and Zip Code',
  plaintiffPhone:      'Telephone',
  plaintiffEmail:      'Email Address',
  defendantName:       'Full Name of Defendant 1',
  defendantName2:      'Full Name of Defendant 2',
  propertyAddress:     'Street address',
  propertyCity:        'Name of the city',
  monthlyRent:         'Rental fee',
  amountOwed:          'Total Default',
  plaintiffSignature:  'Full Name of the Person Completing the Form',
  noticeGivenDate:     'mm/dd/year',
  fullNameFiling:      'Full Name of Party Filing',
};

// Overlay field metadata - coordinates are placeholders (form_fields strategy
// uses AcroForm fill, not coordinate-based drawing)
const OVERLAY_FIELDS = Object.keys(FIELD_MAP).map((key, i) => ({
  fieldKey: key,
  pageNumber: 1,
  x: 0,
  y: 0,
  fontSize: 9,
  maxWidth: null as number | null,
}));

async function main() {
  console.log('=== Idaho Complaint for Eviction - Official Overlay Seed ===');

  // 1. Check if notice_form already exists (idempotent)
  const existing = await db.execute(sql`SELECT id FROM notice_forms WHERE key = ${NOTICE_FORM_KEY}`);

  let formId: string;
  let versionId: string;
  let outputTemplateId: string;

  if (existing.rows.length) {
    console.log('  notice_form already exists - looking up IDs...');
    formId = (existing.rows[0] as any).id;

    const ver = await db.execute(sql`SELECT id FROM notice_form_versions WHERE form_id = ${formId} LIMIT 1`);
    if (!ver.rows.length) throw new Error('notice_form_version missing');
    versionId = (ver.rows[0] as any).id;

    const ot = await db.execute(sql`SELECT id FROM output_templates WHERE form_version_id = ${versionId} LIMIT 1`);
    if (!ot.rows.length) throw new Error('output_template missing');
    outputTemplateId = (ot.rows[0] as any).id;

    console.log(`  Re-seeding output_template ${outputTemplateId} with updated field_map_json`);
  } else {
    // Create notice_form
    const formResult = await db.execute(sql`
      INSERT INTO notice_forms (id, state_id, key, display_name, notice_category, local_overlay_risk, is_active)
      VALUES (gen_random_uuid(), ${STATE_ID}, ${NOTICE_FORM_KEY},
              'Complaint for Eviction - Expedited Proceeding (Idaho CAO UD 1-1)',
              'eviction', 'low', true)
      RETURNING id
    `);
    formId = (formResult.rows[0] as any).id;
    console.log(`  Created notice_form: ${formId}`);

    // Create notice_form_version
    const verResult = await db.execute(sql`
      INSERT INTO notice_form_versions (id, form_id, version_number, status, effective_start)
      VALUES (gen_random_uuid(), ${formId}, 1, 'approved', '2021-07-01')
      RETURNING id
    `);
    versionId = (verResult.rows[0] as any).id;
    console.log(`  Created notice_form_version: ${versionId}`);

    // Create output_template
    const otResult = await db.execute(sql`
      INSERT INTO output_templates (id, form_version_id, mode, render_strategy, base_pdf_attachment_path, page_count, field_map_json)
      VALUES (gen_random_uuid(), ${versionId}, 'official_pdf_overlay', 'form_fields',
              ${PDF_PATH}, 2, ${JSON.stringify(FIELD_MAP)}::jsonb)
      RETURNING id
    `);
    outputTemplateId = (otResult.rows[0] as any).id;
    console.log(`  Created output_template: ${outputTemplateId}`);
  }

  // 2. Update field_map_json on output_template (always refresh)
  await db.execute(sql`
    UPDATE output_templates SET
      field_map_json = ${JSON.stringify(FIELD_MAP)}::jsonb,
      mode = 'official_pdf_overlay',
      render_strategy = 'form_fields',
      base_pdf_attachment_path = ${PDF_PATH},
      page_count = 2
    WHERE id = ${outputTemplateId}
  `);
  console.log('  output_template refreshed');

  // 3. Create form_fields (idempotent - skip if already exist for this version)
  const FORM_FIELDS = [
    { key: 'plaintiffName',        label: 'Plaintiff/Landlord Name',         type: 'text',     required: true,  sortOrder: 1  },
    { key: 'plaintiffAddress',     label: 'Plaintiff Mailing Address',        type: 'text',     required: true,  sortOrder: 2  },
    { key: 'plaintiffCityStateZip',label: 'Plaintiff City, State, Zip',       type: 'text',     required: true,  sortOrder: 3  },
    { key: 'plaintiffPhone',       label: 'Plaintiff Phone',                  type: 'text',     required: true,  sortOrder: 4  },
    { key: 'plaintiffEmail',       label: 'Plaintiff Email',                  type: 'text',     required: false, sortOrder: 5  },
    { key: 'fullNameFiling',       label: 'Full Name of Party Filing (Same as Plaintiff)', type: 'text', required: false, sortOrder: 6 },
    { key: 'defendantName',        label: 'Defendant/Tenant Name',            type: 'text',     required: true,  sortOrder: 7  },
    { key: 'defendantName2',       label: 'Defendant/Tenant 2 Name (if any)', type: 'text',     required: false, sortOrder: 8  },
    { key: 'propertyAddress',      label: 'Property Street Address',          type: 'text',     required: true,  sortOrder: 9  },
    { key: 'propertyCity',         label: 'Property City',                    type: 'text',     required: true,  sortOrder: 10 },
    { key: 'monthlyRent',          label: 'Monthly Rent Amount',              type: 'money',    required: true,  sortOrder: 11 },
    { key: 'amountOwed',           label: 'Total Rent Owed',                  type: 'money',    required: true,  sortOrder: 12 },
    { key: 'noticeGivenDate',      label: 'Date Tenant Must Pay or Vacate By', type: 'date',   required: true,  sortOrder: 13 },
    { key: 'plaintiffSignature',   label: 'Landlord/Plaintiff Printed Name',  type: 'text',     required: false, sortOrder: 14 },
  ];

  let fieldsCreated = 0;
  for (const f of FORM_FIELDS) {
    const exists = await db.execute(sql`
      SELECT id FROM form_fields WHERE form_version_id = ${versionId} AND key = ${f.key}
    `);
    if (!exists.rows.length) {
      await db.execute(sql`
        INSERT INTO form_fields (id, form_version_id, key, label, type, required, sort_order)
        VALUES (gen_random_uuid(), ${versionId}, ${f.key}, ${f.label}, ${f.type}, ${f.required}, ${f.sortOrder})
      `);
      fieldsCreated++;
    }
  }
  console.log(`  form_fields: ${fieldsCreated} created (${FORM_FIELDS.length - fieldsCreated} already existed)`);

  // 4. Re-seed overlay_fields (clear + insert)
  await db.execute(sql`DELETE FROM overlay_fields WHERE output_template_id = ${outputTemplateId}`);
  let overlayInserted = 0;
  for (const f of OVERLAY_FIELDS) {
    await db.execute(sql`
      INSERT INTO overlay_fields (id, output_template_id, field_key, page_number, x, y, font, font_size, max_width, align, wrap)
      VALUES (gen_random_uuid(), ${outputTemplateId}, ${f.fieldKey}, ${f.pageNumber},
              ${f.x}, ${f.y}, 'Helvetica', ${f.fontSize}, ${f.maxWidth}, 'left', false)
    `);
    overlayInserted++;
  }
  console.log(`  overlay_fields: ${overlayInserted} rows seeded`);

  // 5. Link library template to output_template
  await db.execute(sql`
    UPDATE templates SET output_template_id = ${outputTemplateId}
    WHERE id = ${LIBRARY_TEMPLATE_ID}
  `);
  console.log(`  Library template ${LIBRARY_TEMPLATE_ID} linked to output_template ${outputTemplateId}`);

  console.log('\n=== Idaho seed complete ===');
  console.log(`  PDF:              ${PDF_PATH}`);
  console.log(`  notice_form key:  ${NOTICE_FORM_KEY}`);
  console.log(`  output_template:  ${outputTemplateId}`);
  console.log(`  strategy:         form_fields (25 AcroForm fields)`);
  console.log(`  pages:            2`);
  console.log('');
  console.log('Next: run smoke test');
  console.log('  npx tsx server/scripts/testIDOverlay.ts');
}

main().catch(console.error).finally(() => process.exit(0));
