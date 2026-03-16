/**
 * Seed SD Verified Complaint Overlay Fields + Link Library Template
 *
 * Creates overlay_fields (coordinate-based) for the South Dakota
 * UJS-112 Verified Complaint for Eviction (4-page flat PDF, no AcroForm).
 * Also links the library template to the output_template.
 *
 * Coordinates derived from pdftotext -bbox analysis of SD_verified_complaint.pdf.
 * Conversion: pdf_y = 792 - pdftotext_yMax  (PDF y=0 at bottom; pdftotext y=0 at top)
 *
 * Run: npx tsx server/scripts/seedSDOverlayFields.ts
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';

const OUTPUT_TEMPLATE_ID = 'f6bace86-81cd-4278-bef8-5fcc733b85b9';
const LIBRARY_TEMPLATE_ID = 'd92f5416-75fc-4889-8bec-a4c10ede1ad9';

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

// Coordinates verified against pdftotext -bbox output.
// Page numbering: page 1 = instructions (pre-printed), pages 2-4 = form body.
// All positions in PDF point space (72pt/inch); page size 612x792.
const OVERLAY_FIELDS: FieldDef[] = [
  // ── PAGE 2: Caption / header ──────────────────────────────────────────────
  // "COUNTY OF _____ [blank] _____ JUDICIAL CIRCUIT"
  // "COUNTY OF" ends at x≈127, baseline y=703 (pdftotext yMax=88.52 → 792-88.52=703.48)
  { fieldKey: 'county_name',         pageNumber: 2, x: 145,  y: 703, fontSize: 10, maxWidth: 200 },
  // Circuit number goes before "JUDICIAL CIRCUIT" (xMin=447.84); estimated x=355
  { fieldKey: 'judicial_circuit',    pageNumber: 2, x: 355,  y: 703, fontSize: 10, maxWidth: 80 },

  // Caption: blank line for plaintiff/defendant above their labels
  // "Plaintiff/Landlord" label at pdf_y=628; blank line ~20pt above
  { fieldKey: 'plaintiff_name',      pageNumber: 2, x: 63,   y: 648, fontSize: 10, maxWidth: 250 },
  // "Case No.:" at pdf_y=633; fill goes right after at x=390
  { fieldKey: 'case_number',         pageNumber: 2, x: 390,  y: 633, fontSize: 10, maxWidth: 140 },
  // "Defendant/Tenant(s)" label at pdf_y=538; blank line ~20pt above
  { fieldKey: 'defendant_names',     pageNumber: 2, x: 63,   y: 558, fontSize: 10, maxWidth: 450, wrap: true },

  // ── PAGE 2: Section 1 — Property address ─────────────────────────────────
  // After "1. The Plaintiff/Landlord is the owner of real property located at:"
  // Approximate position based on page layout (section starts ~pdf_y=466)
  { fieldKey: 'property_street',     pageNumber: 2, x: 152,  y: 445, fontSize: 10, maxWidth: 310 },
  { fieldKey: 'property_city_state_zip', pageNumber: 2, x: 152, y: 428, fontSize: 10, maxWidth: 310 },

  // ── PAGE 2: Section 2 — Lease dates ──────────────────────────────────────
  // "...leased the property described above to the Defendant/Tenant(s) beginning ___"
  { fieldKey: 'lease_start_date',    pageNumber: 2, x: 335,  y: 402, fontSize: 10, maxWidth: 120 },
  // "for a period of ___ months/years (circle one)"
  { fieldKey: 'lease_period_months', pageNumber: 2, x: 175,  y: 386, fontSize: 10, maxWidth: 70 },

  // ── PAGE 2: Section 4 — Rent amount (failure to pay) ─────────────────────
  // "☐ Failure to pay rent in the amount of $___"
  // "$" is at xMin=350.52, pdf_y=127 (pdftotext yMax=664.28 → 792-664.28=127.72)
  { fieldKey: 'rent_amount_monthly', pageNumber: 2, x: 360,  y: 128, fontSize: 10, maxWidth: 50 },

  // ── PAGE 4: Verification / signature ─────────────────────────────────────
  // "(Date)" at pdf_y=660 (pdftotext yMax=132.00 → 792-132=660)
  { fieldKey: 'signature_date',      pageNumber: 4, x: 63,   y: 660, fontSize: 10, maxWidth: 160 },
  // First "Plaintiff/Landlord's" label at pdf_y=596 (pdftotext yMax=195.32 → 792-195.32=596.68)
  { fieldKey: 'plaintiff_name_print',pageNumber: 4, x: 63,   y: 596, fontSize: 10, maxWidth: 240 },
];

async function seed() {
  console.log('Seeding SD overlay_fields for UJS-112 Verified Complaint...');

  // Check if already seeded
  const existing = await db.execute(sql`
    SELECT id FROM overlay_fields WHERE output_template_id = ${OUTPUT_TEMPLATE_ID} LIMIT 1
  `);
  if (existing.rows.length > 0) {
    console.log('SD overlay_fields already seeded. Clearing and reseeding...');
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

  console.log(`\nDone. ${OVERLAY_FIELDS.length} overlay_fields seeded for SD UJS-112.`);
  console.log('Note: Coordinates are derived from pdftotext bbox analysis and should be');
  console.log('validated by running a smoke test and visually inspecting the output PDF.');
  process.exit(0);
}

seed().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
