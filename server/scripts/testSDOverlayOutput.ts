/**
 * SD UJS-112 Overlay Smoke Test
 *
 * Verifies the official_pdf_overlay rendering for the South Dakota
 * Verified Complaint for Eviction (UJS-112) using the coordinates strategy.
 *
 * Run: npx tsx server/scripts/testSDOverlayOutput.ts
 */

import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { renderOfficialOverlay, type OverlayField } from '../engine/officialOverlayRenderer';
import { runOfficialOverlayGuardrails } from '../engine/overlayGuardrails';

const BASE_PDF_PATH = path.resolve(process.cwd(), 'server/assets/court-forms/SD_verified_complaint.pdf');
const EXPECTED_PAGES = 4;

const TEST_OVERLAY_DATA: OverlayField[] = [
  { fieldKey: 'county_name',             value: 'Minnehaha',              pageNumber: 2, x: 145,  y: 703, font: 'Helvetica', fontSize: 10, maxWidth: 200,  align: 'left', wrap: false },
  { fieldKey: 'judicial_circuit',        value: '2nd',                    pageNumber: 2, x: 355,  y: 703, font: 'Helvetica', fontSize: 10, maxWidth: 80,   align: 'left', wrap: false },
  { fieldKey: 'plaintiff_name',          value: 'JOHN LANDLORD',          pageNumber: 2, x: 63,   y: 648, font: 'Helvetica', fontSize: 10, maxWidth: 250,  align: 'left', wrap: false },
  { fieldKey: 'case_number',             value: '',                        pageNumber: 2, x: 390,  y: 633, font: 'Helvetica', fontSize: 10, maxWidth: 140,  align: 'left', wrap: false },
  { fieldKey: 'defendant_names',         value: 'JANE TENANT',            pageNumber: 2, x: 63,   y: 558, font: 'Helvetica', fontSize: 10, maxWidth: 450,  align: 'left', wrap: true  },
  { fieldKey: 'property_street',         value: '456 Main St',            pageNumber: 2, x: 152,  y: 445, font: 'Helvetica', fontSize: 10, maxWidth: 310,  align: 'left', wrap: false },
  { fieldKey: 'property_city_state_zip', value: 'Sioux Falls, SD 57101',  pageNumber: 2, x: 152,  y: 428, font: 'Helvetica', fontSize: 10, maxWidth: 310,  align: 'left', wrap: false },
  { fieldKey: 'lease_start_date',        value: '01/01/2025',             pageNumber: 2, x: 335,  y: 402, font: 'Helvetica', fontSize: 10, maxWidth: 120,  align: 'left', wrap: false },
  { fieldKey: 'lease_period_months',     value: '12',                     pageNumber: 2, x: 175,  y: 386, font: 'Helvetica', fontSize: 10, maxWidth: 70,   align: 'left', wrap: false },
  { fieldKey: 'rent_amount_monthly',     value: '950.00',                 pageNumber: 2, x: 360,  y: 128, font: 'Helvetica', fontSize: 10, maxWidth: 50,   align: 'left', wrap: false },
  { fieldKey: 'signature_date',          value: '03/16/2026',             pageNumber: 4, x: 63,   y: 660, font: 'Helvetica', fontSize: 10, maxWidth: 160,  align: 'left', wrap: false },
  { fieldKey: 'plaintiff_name_print',    value: 'John Landlord',          pageNumber: 4, x: 63,   y: 596, font: 'Helvetica', fontSize: 10, maxWidth: 240,  align: 'left', wrap: false },
];

function sha256(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

async function runTest() {
  console.log('=== SD UJS-112 Overlay Smoke Test ===\n');

  if (!fs.existsSync(BASE_PDF_PATH)) {
    console.error(`FAIL: Base PDF not found at ${BASE_PDF_PATH}`);
    process.exit(1);
  }

  const basePdfBytes = fs.readFileSync(BASE_PDF_PATH);
  const baseSha256 = sha256(basePdfBytes);
  console.log(`Base PDF: SD_verified_complaint.pdf`);
  console.log(`Base SHA-256: ${baseSha256}`);
  console.log(`Base size: ${basePdfBytes.length} bytes\n`);

  let result: Awaited<ReturnType<typeof renderOfficialOverlay>>;
  try {
    result = await renderOfficialOverlay({
      basePdfPath: BASE_PDF_PATH,
      overlayData: TEST_OVERLAY_DATA,
      renderStrategy: 'coordinates',
    });
  } catch (e: any) {
    console.error(`FAIL: renderOfficialOverlay threw: ${e.message}`);
    process.exit(1);
  }

  const assertions: Array<{ name: string; ok: boolean; detail?: string }> = [];

  assertions.push({
    name: `Page count = ${EXPECTED_PAGES}`,
    ok: result.pageCount === EXPECTED_PAGES,
    detail: `got ${result.pageCount}`,
  });

  assertions.push({
    name: 'strategyUsed = coordinates',
    ok: result.strategyUsed === 'coordinates',
    detail: result.strategyUsed,
  });

  assertions.push({
    name: 'Output buffer non-empty',
    ok: result.buffer.length > 0,
    detail: `${result.buffer.length} bytes`,
  });

  assertions.push({
    name: 'Output SHA-256 differs from base (overlay applied)',
    ok: sha256(result.buffer) !== baseSha256,
  });

  const guardrailResult = await runOfficialOverlayGuardrails({
    outputBuffer: result.buffer,
    basePdfPath: BASE_PDF_PATH,
    strict: false,
  });

  assertions.push({
    name: 'Guardrails: no violations',
    ok: guardrailResult.passed,
    detail: guardrailResult.violations.map(v => v.detail).join('; ') || 'clean',
  });

  const reloaded = await PDFDocument.load(result.buffer);
  assertions.push({
    name: 'Output PDF re-loads cleanly',
    ok: reloaded.getPageCount() === EXPECTED_PAGES,
    detail: `${reloaded.getPageCount()} page(s)`,
  });

  console.log('Assertions:');
  let passed = true;
  for (const a of assertions) {
    const icon = a.ok ? '✓' : '✗';
    console.log(`  ${icon} ${a.name}${a.detail ? ` — ${a.detail}` : ''}`);
    if (!a.ok) passed = false;
  }

  const outDir = path.resolve(process.cwd(), 'server/assets/test-outputs');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'SD_complaint_test.pdf');
  fs.writeFileSync(outPath, result.buffer);
  console.log(`\nTest output: ${outPath}`);
  console.log('Open this PDF to visually verify coordinate placement.\n');
  console.log(passed ? '✓ ALL ASSERTIONS PASSED' : '✗ SOME ASSERTIONS FAILED');
  process.exit(passed ? 0 : 1);
}

runTest().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
