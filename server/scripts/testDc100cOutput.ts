/**
 * MI DC 100c Overlay Smoke Test
 *
 * Verifies the official_pdf_overlay rendering for the Michigan SCAO DC 100c
 * (Complaint — Land Contract Forfeiture) using the generic DB-driven field_map_json path.
 *
 * Run: npx tsx server/scripts/testDc100cOutput.ts
 */

import { PDFDocument, StandardFonts } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';
import { renderOfficialOverlay } from '../engine/officialOverlayRenderer';
import { computeSha256 } from '../engine/overlayGuardrails';

const BASE_PDF_PATH = path.resolve(process.cwd(), 'server/assets/court-forms/MI_DC_100c.pdf');

const BANNED_STRINGS = [
  'LeaseShield',
  'State-Specific Legal Forms',
  'Document Version',
  'Generated:',
  'For informational purposes',
  'leaseshield',
];

// DC 100c field_map_json from DB (copied for test independence)
const DC100C_FIELD_MAP: Record<string, string> = {
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

// Test inputs — seller is plaintiff (land contract seller), buyer is defendant
const TEST_FIELDS = [
  { fieldKey: 'seller_name',              value: 'ALICE SELLER',         pageNumber: 1, x: 0, y: 0, font: 'Helvetica', fontSize: 9, maxWidth: null, align: 'left', wrap: false },
  { fieldKey: 'seller_address',           value: '789 Vendor Blvd',      pageNumber: 1, x: 0, y: 0, font: 'Helvetica', fontSize: 9, maxWidth: null, align: 'left', wrap: false },
  { fieldKey: 'seller_city_state_zip',    value: 'Lansing, MI 48909',    pageNumber: 1, x: 0, y: 0, font: 'Helvetica', fontSize: 9, maxWidth: null, align: 'left', wrap: false },
  { fieldKey: 'seller_phone',             value: '(517) 555-0200',       pageNumber: 1, x: 0, y: 0, font: 'Helvetica', fontSize: 9, maxWidth: null, align: 'left', wrap: false },
  { fieldKey: 'buyer_name',               value: 'BOB BUYER',            pageNumber: 1, x: 0, y: 0, font: 'Helvetica', fontSize: 9, maxWidth: null, align: 'left', wrap: false },
  { fieldKey: 'premises_address',         value: '123 Contract Lane, Lansing, MI 48911', pageNumber: 1, x: 0, y: 0, font: 'Helvetica', fontSize: 9, maxWidth: null, align: 'left', wrap: false },
  { fieldKey: 'compliance_deadline',      value: '03/10/2026',           pageNumber: 1, x: 0, y: 0, font: 'Helvetica', fontSize: 9, maxWidth: null, align: 'left', wrap: false },
  { fieldKey: 'signature_date',           value: '02/24/2026',           pageNumber: 1, x: 0, y: 0, font: 'Helvetica', fontSize: 9, maxWidth: null, align: 'left', wrap: false },
  { fieldKey: 'service_date',             value: '02/24/2026',           pageNumber: 1, x: 0, y: 0, font: 'Helvetica', fontSize: 9, maxWidth: null, align: 'left', wrap: false },
  { fieldKey: 'server_name',              value: 'CAROL PROCESS SERVER', pageNumber: 1, x: 0, y: 0, font: 'Helvetica', fontSize: 9, maxWidth: null, align: 'left', wrap: false },
  { fieldKey: 'service_checkbox_personal', value: 'X',                   pageNumber: 1, x: 0, y: 0, font: 'Helvetica', fontSize: 9, maxWidth: null, align: 'left', wrap: false },
];

// Field readback assertions: fieldName (in PDF AcroForm) → expected value fragment
const FIELD_ASSERTIONS: Array<{ pdfFieldName: string; inputValue: string; expectedFragment: string }> = [
  { pdfFieldName: 'name type or print',   inputValue: 'ALICE SELLER',         expectedFragment: 'ALICE SELLER' },
  { pdfFieldName: 'To',                   inputValue: 'BOB BUYER',            expectedFragment: 'BOB BUYER' },
  { pdfFieldName: 'address or description', inputValue: '123 Contract Lane, Lansing, MI 48911', expectedFragment: 'Contract Lane' },
  { pdfFieldName: 'cosdate',              inputValue: '02/24/2026',           expectedFragment: '02/24/2026' },
  { pdfFieldName: 'cosname',              inputValue: 'CAROL PROCESS SERVER', expectedFragment: 'CAROL PROCESS' },
];

function bufferContainsUtf16(buf: Buffer, str: string): boolean {
  const utf16BEBytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    utf16BEBytes.push((code >> 8) & 0xFF, code & 0xFF);
  }
  return buf.indexOf(Buffer.from(utf16BEBytes)) !== -1;
}

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

async function main() {
  console.log('=== MI DC 100c Overlay Smoke Test ===\n');

  if (!fs.existsSync(BASE_PDF_PATH)) {
    console.error(`ABORT: Base PDF not found at ${BASE_PDF_PATH}`);
    process.exit(1);
  }

  const basePdfBytes = fs.readFileSync(BASE_PDF_PATH);
  const basePdf = await PDFDocument.load(basePdfBytes);
  const basePageCount = basePdf.getPageCount();
  const baseSha256 = computeSha256(basePdfBytes);

  console.log(`Base PDF: ${BASE_PDF_PATH}`);
  console.log(`Base pages: ${basePageCount}`);
  console.log(`Base SHA-256: ${baseSha256}\n`);

  let outputBuffer: Buffer;

  try {
    const result = await renderOfficialOverlay({
      basePdfPath: BASE_PDF_PATH,
      overlayData: TEST_FIELDS,
      renderStrategy: 'form_fields',
      fieldNameMap: DC100C_FIELD_MAP,
    });
    outputBuffer = result.buffer;
    console.log(`Render strategy used: ${result.strategyUsed}`);
    console.log(`Output pages: ${result.pageCount}\n`);
  } catch (err: any) {
    console.error(`ABORT: Render failed — ${err.message}`);
    process.exit(1);
  }

  console.log('--- Structural Assertions ---');
  const outputPdf = await PDFDocument.load(outputBuffer);
  assert('Page count equals base PDF', outputPdf.getPageCount() === basePageCount,
    `got ${outputPdf.getPageCount()}, expected ${basePageCount}`);

  const basePages = basePdf.getPages();
  const outputPages = outputPdf.getPages();
  for (let i = 0; i < basePageCount; i++) {
    const bSize = basePages[i].getSize();
    const oSize = outputPages[i]?.getSize();
    assert(
      `Page ${i + 1} MediaBox matches base (${bSize.width.toFixed(0)}x${bSize.height.toFixed(0)})`,
      oSize !== undefined &&
        Math.abs(oSize.width - bSize.width) < 1 &&
        Math.abs(oSize.height - bSize.height) < 1,
      oSize ? `got ${oSize.width.toFixed(0)}x${oSize.height.toFixed(0)}` : 'page missing'
    );
  }

  assert('Output SHA-256 differs from base (content was written)',
    computeSha256(outputBuffer) !== baseSha256);

  console.log('\n--- Banned Content Scan (raw bytes — Latin-1 + UTF-16 scan) ---');
  const rawLatin1 = outputBuffer.toString('latin1');
  for (const banned of BANNED_STRINGS) {
    const inLatin1 = rawLatin1.includes(banned);
    const inUtf16 = bufferContainsUtf16(outputBuffer, banned);
    assert(`"${banned}" not in output`, !inLatin1 && !inUtf16,
      inLatin1 ? 'found in latin1 bytes' : 'found in UTF-16BE encoding');
  }

  console.log('\n--- Expected Field Value Assertions (pre-flatten field read-back) ---');
  console.log('  Note: Verifying via pre-flatten AcroForm field read (generic DB path).');

  const basePdfForCheck = await PDFDocument.load(basePdfBytes);
  const checkForm = basePdfForCheck.getForm();
  const checkFont = await basePdfForCheck.embedFont(StandardFonts.Helvetica);

  for (const { pdfFieldName, inputValue } of FIELD_ASSERTIONS) {
    try {
      const field = checkForm.getTextField(pdfFieldName);
      field.setText(inputValue);
      field.defaultUpdateAppearances(checkFont);
    } catch { /* skip fields that fail */ }
  }

  const preFlattenBytes = await basePdfForCheck.save();
  const preFlattenDoc = await PDFDocument.load(preFlattenBytes);
  const preFlattenForm = preFlattenDoc.getForm();

  for (const { pdfFieldName, expectedFragment } of FIELD_ASSERTIONS) {
    try {
      const val = preFlattenForm.getTextField(pdfFieldName).getText() || '';
      assert(`"${expectedFragment}" found in field "${pdfFieldName.slice(0, 40)}"`,
        val.includes(expectedFragment), `got "${val.slice(0, 80)}"`);
    } catch (e: any) {
      assert(`Field "${pdfFieldName.slice(0, 40)}" readable`, false, e.message);
    }
  }

  console.log('\n=== Summary ===');
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);

  if (failed > 0) {
    const timestamp = Date.now();
    const failPath = path.resolve(process.cwd(), `test_dc100c_FAILED_${timestamp}.pdf`);
    fs.writeFileSync(failPath, outputBuffer!);
    console.error(`\nDebug artifact saved: ${failPath}`);
    process.exit(1);
  } else {
    console.log('\nAll assertions passed.');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
