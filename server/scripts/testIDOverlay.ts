/**
 * Smoke test: Idaho Complaint for Eviction (Expedited Proceeding)
 * CAO_UD_1-1 form from courtselfhelp.idaho.gov
 *
 * Run: npx tsx server/scripts/testIDOverlay.ts
 */

import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';
import { renderOfficialOverlay } from '../engine/officialOverlayRenderer';
import { computeSha256 } from '../engine/overlayGuardrails';

const BASE_PDF_PATH = path.resolve(process.cwd(), 'server/assets/court-forms/ID_CAO_UD_1-1.pdf');

const BANNED_STRINGS = [
  'LeaseShield',
  'State-Specific Legal Forms',
  'Document Version',
  'Generated:',
  'For informational purposes',
  'leaseshield',
];

const FIELD_MAP: Record<string, string> = {
  plaintiffName:        'Full Name of Plaintiff 1',
  plaintiffAddress:     'Mailing Address Street or Post Office Box',
  plaintiffCityStateZip:'City State and Zip Code',
  plaintiffPhone:       'Telephone',
  plaintiffEmail:       'Email Address',
  defendantName:        'Full Name of Defendant 1',
  defendantName2:       'Full Name of Defendant 2',
  propertyAddress:      'Street address',
  propertyCity:         'Name of the city',
  monthlyRent:          'Rental fee',
  amountOwed:           'Total Default',
  plaintiffSignature:   'Full Name of the Person Completing the Form',
  noticeGivenDate:      'mm/dd/year',
  fullNameFiling:       'Full Name of Party Filing',
};

const TEST_INPUTS: Record<string, string> = {
  plaintiffName:         'ROBERT LANDLORD',
  plaintiffAddress:      '100 Owner Street',
  plaintiffCityStateZip: 'Boise, ID 83701',
  plaintiffPhone:        '(208) 555-0100',
  plaintiffEmail:        'landlord@example.com',
  defendantName:         'ALICE TENANT',
  defendantName2:        'BOB TENANT',
  propertyAddress:       '456 Rental Ave',
  propertyCity:          'Nampa',
  monthlyRent:           '1200.00',
  amountOwed:            '3600.00',
  noticeGivenDate:       '04/10/2026',
  plaintiffSignature:    'Robert Landlord',
  fullNameFiling:        'Robert Landlord',
};

const EXPECTED_STRINGS = ['ROBERT LANDLORD', 'ALICE TENANT', 'BOB TENANT', 'Nampa', '1200.00'];

function overlayFields() {
  return Object.keys(FIELD_MAP).map(key => ({
    fieldKey: key,
    value: TEST_INPUTS[key] || '',
    pageNumber: 1,
    x: 0,
    y: 0,
    font: 'Helvetica',
    fontSize: 9,
    maxWidth: null,
    align: 'left',
    wrap: false,
  }));
}

function bufferContainsUtf16(buf: Buffer, str: string): boolean {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    bytes.push((code >> 8) & 0xff, code & 0xff);
  }
  return buf.indexOf(Buffer.from(bytes)) !== -1;
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
  console.log('=== ID CAO UD 1-1 Overlay Smoke Test ===\n');

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
      overlayData: overlayFields(),
      renderStrategy: 'form_fields',
      fieldNameMap: FIELD_MAP,
    });
    outputBuffer = result.buffer;
    console.log(`Strategy used: ${result.strategyUsed}`);
    console.log(`Output pages: ${result.pageCount}`);
    console.log(`Output SHA-256: ${computeSha256(outputBuffer)}\n`);

    assert('Render completed without error', true);
    assert('Strategy is form_fields', result.strategyUsed === 'form_fields', `got: ${result.strategyUsed}`);
    assert(`Page count preserved (${basePageCount})`, result.pageCount === basePageCount, `got: ${result.pageCount}`);
    assert('Output differs from base (fields filled)', !outputBuffer.equals(basePdfBytes));
  } catch (e: any) {
    console.error('FATAL: Render threw:', e.message);
    process.exit(1);
  }

  console.log('\n--- Banned string scan ---');
  for (const banned of BANNED_STRINGS) {
    const inUtf8 = outputBuffer.indexOf(banned) !== -1;
    const inUtf16 = bufferContainsUtf16(outputBuffer, banned);
    assert(`No "${banned}" in output`, !inUtf8 && !inUtf16, inUtf8 ? 'found in UTF-8' : inUtf16 ? 'found in UTF-16' : '');
  }

  console.log('\n--- Expected field value assertions (pre-flatten readback) ---');
  // Set known values on a fresh load of the base PDF and confirm they round-trip correctly.
  const { StandardFonts: SF } = await import('pdf-lib');
  const basePdfForCheck = await PDFDocument.load(fs.readFileSync(BASE_PDF_PATH));
  const checkForm = basePdfForCheck.getForm();
  const checkFont = await basePdfForCheck.embedFont(SF.Helvetica);

  const assertions: Array<{ pdfFieldName: string; setValue: string; expectFragment: string }> = [
    { pdfFieldName: 'Full Name of Plaintiff 1',            setValue: 'ROBERT LANDLORD', expectFragment: 'ROBERT LANDLORD' },
    { pdfFieldName: 'Full Name of Defendant 1',            setValue: 'ALICE TENANT',    expectFragment: 'ALICE TENANT' },
    { pdfFieldName: 'Full Name of Defendant 2',            setValue: 'BOB TENANT',      expectFragment: 'BOB TENANT' },
    { pdfFieldName: 'Street address',                      setValue: '456 Rental Ave',  expectFragment: '456 Rental Ave' },
    { pdfFieldName: 'Rental fee',                          setValue: '1200.00',         expectFragment: '1200.00' },
  ];

  for (const a of assertions) {
    try {
      const tf = checkForm.getTextField(a.pdfFieldName);
      tf.setText(a.setValue);
      tf.defaultUpdateAppearances(checkFont);
    } catch (e: any) {
      assert(`Field "${a.pdfFieldName}" is settable`, false, e.message);
    }
  }

  const preFlattenBytes = await basePdfForCheck.save();
  const preFlattenDoc = await PDFDocument.load(preFlattenBytes);
  const preFlattenForm = preFlattenDoc.getForm();

  for (const a of assertions) {
    try {
      const val = preFlattenForm.getTextField(a.pdfFieldName).getText() || '';
      assert(`"${a.expectFragment}" readable from field "${a.pdfFieldName.slice(0, 40)}"`,
        val.includes(a.expectFragment), `got "${val.slice(0, 60)}"`);
    } catch (e: any) {
      assert(`Field "${a.pdfFieldName.slice(0, 40)}" readable`, false, e.message);
    }
  }

  // Save output for manual inspection
  const outPath = '/tmp/ID_CAO_UD_1-1_test_output.pdf';
  fs.writeFileSync(outPath, outputBuffer);
  console.log(`\nTest output saved: ${outPath}`);

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
