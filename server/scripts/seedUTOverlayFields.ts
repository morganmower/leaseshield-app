/**
 * Seed UT Complaint for Unlawful Detainer Overlay Fields + Link Library Template
 *
 * Creates overlay_fields (coordinate-based) for the Utah Courts
 * Form 1100EVJ - Complaint for Unlawful Detainer (Eviction), 9-page flat PDF.
 * Also links the library template to the output_template.
 *
 * Coordinates derived from pdftotext -bbox analysis of UT_complaint_unlawful_detainer.pdf.
 * Conversion: pdf_y = 792 - pdftotext_yMax
 *
 * Run: npx tsx server/scripts/seedUTOverlayFields.ts
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';

const OUTPUT_TEMPLATE_ID = 'eb444241-1205-4309-abcc-fd95d2f3ef99';
const LIBRARY_TEMPLATE_ID = '31e92a29-0232-460c-976c-caf5b7d993fc';

type FieldDef = {
  fieldKey: string;
  pageNumber: number;
  x: number;
  y: number;
  font?: string;
  fontSize?: number;
  maxWidth?: number | null;
  align?: string;
  wrap?: boolean;
};

// UT form 1100EVJ - 9 pages (612x792 each).
// Page 1: Filer info (top-left box) + Court header + Case caption
// Page 2: Items 2–5 (defendants, property, agreement, notices)
// Pages 3–9: Additional claims, relief, signature, etc.
//
// Coordinates verified against pdftotext -bbox output.
// NOTE: All positions are ESTIMATED from bbox analysis and require visual
// calibration by opening the output PDF and checking field placement.
const OVERLAY_FIELDS: FieldDef[] = [
  // ── PAGE 1: Filer info box (top-left) ────────────────────────────────────
  // "Name" label at yMax=115.15 → pdf_y=676.85; fill extends right of label
  { fieldKey: 'filer_name',          pageNumber: 1, x: 95,  y: 677, fontSize: 10, maxWidth: 230 },
  // "Address" label at yMax=147.43 → pdf_y=644.57
  { fieldKey: 'filer_address',       pageNumber: 1, x: 95,  y: 645, fontSize: 10, maxWidth: 230 },
  // "City, State, Zip" label at yMax=179.71 → pdf_y=612.29
  { fieldKey: 'filer_city_state_zip',pageNumber: 1, x: 95,  y: 612, fontSize: 10, maxWidth: 230 },
  // "Phone" label at yMax=212.05 → pdf_y=579.95
  { fieldKey: 'filer_phone',         pageNumber: 1, x: 95,  y: 580, fontSize: 10, maxWidth: 230 },
  // Email area (below Phone, above "I am [ ] Plaintiff..." checkbox line)
  { fieldKey: 'filer_email',         pageNumber: 1, x: 95,  y: 560, fontSize: 10, maxWidth: 230 },

  // ── PAGE 1: Court header ──────────────────────────────────────────────────
  // "__________ Judicial District" - blank before "Judicial"
  // "Judicial District" label at xMin=224.82, yMax=372.42 → pdf_y=419.58
  { fieldKey: 'judicial_district',   pageNumber: 1, x: 155, y: 420, fontSize: 10, maxWidth: 65 },
  // "________________ County" - blank before "County" at xMin=418.20
  { fieldKey: 'ut_county',           pageNumber: 1, x: 310, y: 420, fontSize: 10, maxWidth: 100 },
  // "Court Address ______" - estimate after court header line
  { fieldKey: 'court_address',       pageNumber: 1, x: 155, y: 402, fontSize: 10, maxWidth: 380 },

  // ── PAGE 1: Case caption ──────────────────────────────────────────────────
  // Form has: [long blank for plaintiff] / "Plaintiff" label / "v." /
  //           [long blank for defendant] / "Defendant" label / Case No. / Judge
  // Plaintiff blank is above "Plaintiff" label (~pdf_y=330); estimated at pdf_y=348
  { fieldKey: 'plaintiff_name',      pageNumber: 1, x: 72,  y: 348, fontSize: 10, maxWidth: 380 },
  // Case Number - right column, estimated x=460, same y as "v." area (~pdf_y=305)
  { fieldKey: 'case_number',         pageNumber: 1, x: 458, y: 305, fontSize: 10, maxWidth: 130 },
  // Defendant blank above "Defendant" label (~pdf_y=252); estimated at pdf_y=268
  { fieldKey: 'defendant_name',      pageNumber: 1, x: 72,  y: 268, fontSize: 10, maxWidth: 380 },
  // Judge - right column, same y as defendant area
  { fieldKey: 'judge',               pageNumber: 1, x: 458, y: 268, fontSize: 10, maxWidth: 130 },

  // ── PAGE 2: Item 2 - Defendants and property ─────────────────────────────
  // "2. Defendants, _______________ (names) are"
  // "Defendants," ends at xMax=172.18, baseline yMax=87.18 → pdf_y=704.82
  { fieldKey: 'defendant_names',     pageNumber: 2, x: 175, y: 705, fontSize: 10, maxWidth: 340, wrap: true },
  // "residents at: ___________________" (property address)
  // "at:" ends at xMax=172.84, yMax=107.88 → pdf_y=684.12
  { fieldKey: 'property_address',    pageNumber: 2, x: 178, y: 684, fontSize: 10, maxWidth: 345 },

  // ── PAGE 2: Item 4b - Rent amount ─────────────────────────────────────────
  // "b. To pay rent of $______" - estimated position
  { fieldKey: 'rent_amount_monthly', pageNumber: 2, x: 212, y: 498, fontSize: 10, maxWidth: 80 },
  // Rent start date for lease "starting on ___"
  { fieldKey: 'lease_start_date',    pageNumber: 2, x: 318, y: 542, fontSize: 10, maxWidth: 130 },
];

async function seed() {
  console.log('Seeding UT overlay_fields for Complaint for Unlawful Detainer (1100EVJ)...');

  // Check if already seeded
  const existing = await db.execute(sql`
    SELECT id FROM overlay_fields WHERE output_template_id = ${OUTPUT_TEMPLATE_ID} LIMIT 1
  `);
  if (existing.rows.length > 0) {
    console.log('UT overlay_fields already seeded. Clearing and reseeding...');
    await db.execute(sql`
      DELETE FROM overlay_fields WHERE output_template_id = ${OUTPUT_TEMPLATE_ID}
    `);
  }

  for (const f of OVERLAY_FIELDS) {
    await db.execute(sql`
      INSERT INTO overlay_fields (
        id, output_template_id, field_key, page_number, x, y,
        font, font_size, max_width, align, wrap
      ) VALUES (
        ${randomUUID()},
        ${OUTPUT_TEMPLATE_ID},
        ${f.fieldKey},
        ${f.pageNumber},
        ${f.x},
        ${f.y},
        ${'Helvetica'},
        ${f.fontSize ?? 10},
        ${f.maxWidth ?? null},
        ${f.align ?? 'left'},
        ${f.wrap ?? false}
      )
    `);
    console.log(`  Inserted: ${f.fieldKey} (page ${f.pageNumber}, x=${f.x}, y=${f.y})`);
  }

  // Link library template to output_template
  const linked = await db.execute(sql`
    SELECT output_template_id FROM templates WHERE id = ${LIBRARY_TEMPLATE_ID}
  `);
  const currentLink = (linked.rows[0] as any)?.output_template_id;
  if (!currentLink) {
    await db.execute(sql`
      UPDATE templates SET output_template_id = ${OUTPUT_TEMPLATE_ID}
      WHERE id = ${LIBRARY_TEMPLATE_ID}
    `);
    console.log(`Linked library template ${LIBRARY_TEMPLATE_ID} → output_template ${OUTPUT_TEMPLATE_ID}`);
  } else {
    console.log(`Library template already linked to: ${currentLink}`);
  }

  console.log(`\nDone. ${OVERLAY_FIELDS.length} overlay_fields seeded for UT 1100EVJ.`);
  console.log('Note: Coordinates are derived from pdftotext bbox analysis.');
  console.log('Visual calibration recommended: run smoke test and inspect output PDF.');
  process.exit(0);
}

seed().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
