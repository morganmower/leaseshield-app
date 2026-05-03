/**
 * UT 1100EVJ Overlay Smoke Test
 *
 * Verifies the official_pdf_overlay rendering for the Utah Courts
 * Complaint for Unlawful Detainer (Eviction) - coordinates strategy.
 *
 * Run: npx tsx server/scripts/testUTOverlayOutput.ts
 */

import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { renderOfficialOverlay, type OverlayField } from '../engine/officialOverlayRenderer';
import { runOfficialOverlayGuardrails } from '../engine/overlayGuardrails';

const BASE_PDF_PATH = path.resolve(process.cwd(), 'server/assets/court-forms/UT_complaint_unlawful_detainer.pdf');

function sha256(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

const TEST_OVERLAY_DATA: OverlayField[] = [
  // Page 1 - Filer info
  { fieldKey: 'filer_name',           value: 'John Landlord',              pageNumber: 1, x: 95,  y: 677, font: 'Helvetica', fontSize: 10, maxWidth: 230,  align: 'left', wrap: false },
  { fieldKey: 'filer_address',        value: '123 Owner Ave',              pageNumber: 1, x: 95,  y: 645, font: 'Helvetica', fontSize: 10, maxWidth: 230,  align: 'left', wrap: false },
  { fieldKey: 'filer_city_state_zip', value: 'Salt Lake City, UT 84101',   pageNumber: 1, x: 95,  y: 612, font: 'Helvetica', fontSize: 10, maxWidth: 230,  align: 'left', wrap: false },
  { fieldKey: 'filer_phone',          value: '(801) 555-0100',             pageNumber: 1, x: 95,  y: 580, font: 'Helvetica', fontSize: 10, maxWidth: 230,  align: 'left', wrap: false },
  { fieldKey: 'filer_email',          value: 'landlord@example.com',       pageNumber: 1, x: 95,  y: 560, font: 'Helvetica', fontSize: 10, maxWidth: 230,  align: 'left', wrap: false },
  // Page 1 - Court header
  { fieldKey: 'judicial_district',    value: '3rd',                        pageNumber: 1, x: 155, y: 420, font: 'Helvetica', fontSize: 10, maxWidth: 65,   align: 'left', wrap: false },
  { fieldKey: 'ut_county',            value: 'Salt Lake',                  pageNumber: 1, x: 310, y: 420, font: 'Helvetica', fontSize: 10, maxWidth: 100,  align: 'left', wrap: false },
  { fieldKey: 'court_address',        value: '450 S State St, SLC UT 84111', pageNumber: 1, x: 155, y: 402, font: 'Helvetica', fontSize: 10, maxWidth: 380, align: 'left', wrap: false },
  // Page 1 - Case caption
  { fieldKey: 'plaintiff_name',       value: 'John Landlord',              pageNumber: 1, x: 72,  y: 348, font: 'Helvetica', fontSize: 10, maxWidth: 380,  align: 'left', wrap: false },
  { fieldKey: 'case_number',          value: '',                           pageNumber: 1, x: 458, y: 305, font: 'Helvetica', fontSize: 10, maxWidth: 130,  align: 'left', wrap: false },
  { fieldKey: 'defendant_name',       value: 'Jane Tenant',                pageNumber: 1, x: 72,  y: 268, font: 'Helvetica', fontSize: 10, maxWidth: 380,  align: 'left', wrap: false },
  { fieldKey: 'judge',                value: '',                           pageNumber: 1, x: 458, y: 268, font: 'Helvetica', fontSize: 10, maxWidth: 130,  align: 'left', wrap: false },
  // Page 2 - Body fields
  { fieldKey: 'defendant_names',      value: 'Jane Tenant',                pageNumber: 2, x: 175, y: 705, font: 'Helvetica', fontSize: 10, maxWidth: 340,  align: 'left', wrap: true  },
  { fieldKey: 'property_address',     value: '789 Rental St, SLC, UT 84102', pageNumber: 2, x: 178, y: 684, font: 'Helvetica', fontSize: 10, maxWidth: 345, align: 'left', wrap: false },
  { fieldKey: 'lease_start_date',     value: '02/01/2025',                 pageNumber: 2, x: 318, y: 542, font: 'Helvetica', fontSize: 10, maxWidth: 130,  align: 'left', wrap: false },
  { fieldKey: 'rent_amount_monthly',  value: '1200.00',                    pageNumber: 2, x: 212, y: 498, font: 'Helvetica', fontSize: 10, maxWidth: 80,   align: 'left', wrap: false },
];

async function runTest() {
  console.log('=== UT 1100EVJ Overlay Smoke Test ===\n');

  if (!fs.existsSync(BASE_PDF_PATH)) {
    console.error(`FAIL: Base PDF not found at ${BASE_PDF_PATH}`);
    process.exit(1);
  }

  const basePdfBytes = fs.readFileSync(BASE_PDF_PATH);
  const baseSha256 = sha256(basePdfBytes);

  const basePdf = await PDFDocument.load(basePdfBytes);
  const EXPECTED_PAGES = basePdf.getPageCount();

  console.log(`Base PDF: UT_complaint_unlawful_detainer.pdf`);
  console.log(`Base SHA-256: ${baseSha256}`);
  console.log(`Base pages: ${EXPECTED_PAGES}, size: ${basePdfBytes.length} bytes\n`);

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
    console.log(`  ${icon} ${a.name}${a.detail ? ` - ${a.detail}` : ''}`);
    if (!a.ok) passed = false;
  }

  const outDir = path.resolve(process.cwd(), 'server/assets/test-outputs');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'UT_complaint_test.pdf');
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
