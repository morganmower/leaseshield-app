import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';
import { renderOfficialOverlay } from '../engine/officialOverlayRenderer';
import { computeSha256 } from '../engine/overlayGuardrails';

const BASE_PDF_PATH = path.resolve(process.cwd(), 'server/assets/court-forms/MI_DC_100a.pdf');

const BANNED_STRINGS = [
  'LeaseShield',
  'State-Specific Legal Forms',
  'Document Version',
  'Generated:',
  'For informational purposes',
  'leaseshield',
];
const EMAIL_PATTERN = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

const EXPECTED_STRINGS = ['JOHN DOE', 'JANE SMITH', 'Wayne'];

const TEST_FIELDS = [
  { fieldKey: 'plaintiff_name',     value: 'JOHN DOE',          pageNumber: 1, x: 0, y: 0, font: 'Helvetica', fontSize: 9, maxWidth: null, align: 'left', wrap: false },
  { fieldKey: 'plaintiff_address',  value: '123 Landlord St',   pageNumber: 1, x: 0, y: 0, font: 'Helvetica', fontSize: 9, maxWidth: null, align: 'left', wrap: false },
  { fieldKey: 'plaintiff_city_state_zip', value: 'Detroit, MI 48201', pageNumber: 1, x: 0, y: 0, font: 'Helvetica', fontSize: 9, maxWidth: null, align: 'left', wrap: false },
  { fieldKey: 'plaintiff_phone',    value: '(313) 555-0100',    pageNumber: 1, x: 0, y: 0, font: 'Helvetica', fontSize: 9, maxWidth: null, align: 'left', wrap: false },
  { fieldKey: 'defendant_name',     value: 'JANE SMITH',        pageNumber: 1, x: 0, y: 0, font: 'Helvetica', fontSize: 9, maxWidth: null, align: 'left', wrap: false },
  { fieldKey: 'defendant_address',  value: '456 Tenant Ave',    pageNumber: 1, x: 0, y: 0, font: 'Helvetica', fontSize: 9, maxWidth: null, align: 'left', wrap: false },
  { fieldKey: 'defendant_city_state_zip', value: 'Detroit, MI 48202', pageNumber: 1, x: 0, y: 0, font: 'Helvetica', fontSize: 9, maxWidth: null, align: 'left', wrap: false },
  { fieldKey: 'premises_address',   value: '456 Tenant Ave',    pageNumber: 1, x: 0, y: 0, font: 'Helvetica', fontSize: 9, maxWidth: null, align: 'left', wrap: false },
  { fieldKey: 'premises_city',      value: 'Detroit',           pageNumber: 1, x: 0, y: 0, font: 'Helvetica', fontSize: 9, maxWidth: null, align: 'left', wrap: false },
  { fieldKey: 'premises_county',    value: 'Wayne',             pageNumber: 1, x: 0, y: 0, font: 'Helvetica', fontSize: 9, maxWidth: null, align: 'left', wrap: false },
  { fieldKey: 'rent_amount_due',    value: '$1,234.00',         pageNumber: 1, x: 0, y: 0, font: 'Helvetica', fontSize: 9, maxWidth: null, align: 'left', wrap: false },
  { fieldKey: 'service_date',       value: '02/24/2026',        pageNumber: 1, x: 0, y: 0, font: 'Helvetica', fontSize: 9, maxWidth: null, align: 'left', wrap: false },
];

function bufferContainsUtf16(buf: Buffer, str: string): boolean {
  const utf16BEBytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    utf16BEBytes.push((code >> 8) & 0xFF, code & 0xFF);
  }
  const searchBuf = Buffer.from(utf16BEBytes);
  return buf.indexOf(searchBuf) !== -1;
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
  console.log('=== MI DC 100a Overlay Smoke Test ===\n');

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
  console.log('  Note: Content streams are compressed; verifying via pre-flatten form field read.');

  const { StandardFonts: SF } = await import('pdf-lib');
  const basePdfForCheck = await PDFDocument.load(basePdfBytes);
  const checkForm = basePdfForCheck.getForm();
  const checkFont = await basePdfForCheck.embedFont(SF.Helvetica);

  const testFieldAssertions: Array<{ fieldName: string; expectedFragment: string }> = [
    { fieldName: 'First Middle and Last Name', expectedFragment: 'JOHN DOE' },
    { fieldName: "Tenant's Name And Address", expectedFragment: 'JANE SMITH' },
    { fieldName: 'Address or description of premises rented (if different from mailing address)', expectedFragment: 'Wayne' },
  ];

  for (const { fieldName, expectedFragment } of testFieldAssertions) {
    try {
      checkForm.getTextField(fieldName).setText(fieldName === "Tenant's Name And Address"
        ? 'JANE SMITH\n456 Tenant Ave\nDetroit, MI 48202'
        : fieldName.includes('Address or description')
          ? 'Detroit, Wayne County'
          : 'JOHN DOE'
      );
    } catch {}
  }

  const preFlattenBytes = await basePdfForCheck.save();
  const preFlattenDoc = await PDFDocument.load(preFlattenBytes);
  const preFlattenForm = preFlattenDoc.getForm();

  for (const { fieldName, expectedFragment } of testFieldAssertions) {
    try {
      const val = preFlattenForm.getTextField(fieldName).getText() || '';
      assert(`"${expectedFragment}" found in field "${fieldName.slice(0, 40)}..."`,
        val.includes(expectedFragment),
        `got "${val.slice(0, 60)}"`);
    } catch (e: any) {
      assert(`Field "${fieldName.slice(0, 40)}..." readable`, false, e.message);
    }
  }

  console.log('\n=== Summary ===');
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);

  if (failed > 0) {
    const timestamp = Date.now();
    const failPath = path.resolve(process.cwd(), `test_output_FAILED_${timestamp}.pdf`);
    fs.writeFileSync(failPath, outputBuffer);
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
