import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';

const BLACK = rgb(0, 0, 0);
const GRAY = rgb(0.4, 0.4, 0.4);
const LIGHT_GRAY = rgb(0.85, 0.85, 0.85);

async function generateBasePdf() {
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const timesRomanBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

  const W = 612;
  const H = 792;
  const page = pdfDoc.addPage([W, H]);

  const LM = 36;
  const RM = W - 36;
  const contentW = RM - LM;

  function drawLine(y: number, x1 = LM, x2 = RM) {
    page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: 0.5, color: BLACK });
  }

  function drawBox(x: number, y: number, w: number, h: number) {
    page.drawRectangle({ x, y, width: w, height: h, borderColor: BLACK, borderWidth: 0.75, color: rgb(1, 1, 1) });
  }

  function label(text: string, x: number, y: number, size = 8) {
    page.drawText(text, { x, y, size, font: helvetica, color: BLACK });
  }

  function labelBold(text: string, x: number, y: number, size = 8) {
    page.drawText(text, { x, y, size, font: helveticaBold, color: BLACK });
  }

  function fieldLine(x: number, y: number, w: number) {
    page.drawLine({ start: { x, y }, end: { x: x + w, y }, thickness: 0.5, color: GRAY });
  }

  function checkbox(x: number, y: number, size = 8) {
    page.drawRectangle({ x, y: y - 1, width: size, height: size, borderColor: BLACK, borderWidth: 0.5, color: rgb(1, 1, 1) });
  }

  let Y = H - 36;

  // === SCAO HEADER ===
  labelBold('STATE OF MICHIGAN', LM, Y, 7);
  labelBold('JUDICIAL DISTRICT', RM - 100, Y, 7);
  Y -= 10;
  labelBold('JUDICIAL CIRCUIT', LM, Y, 7);
  labelBold('COUNTY', RM - 100, Y, 7);
  Y -= 10;

  label('Court address', LM, Y, 6);
  fieldLine(LM + 55, Y - 1, 200);
  label('Court telephone no.', RM - 160, Y, 6);
  fieldLine(RM - 70, Y - 1, 70);
  Y -= 16;

  drawLine(Y);
  Y -= 4;

  // === CASE HEADER BOX ===
  const caseBoxTop = Y;
  const caseBoxH = 90;
  drawBox(LM, Y - caseBoxH, contentW, caseBoxH);

  const halfW = contentW / 2 - 10;
  page.drawLine({ start: { x: LM + halfW + 5, y: Y }, end: { x: LM + halfW + 5, y: Y - caseBoxH }, thickness: 0.5, color: BLACK });
  page.drawLine({ start: { x: LM, y: Y - caseBoxH / 2 }, end: { x: LM + halfW + 5, y: Y - caseBoxH / 2 }, thickness: 0.5, color: BLACK });

  label('Plaintiff name(s), address(es), and telephone no(s).', LM + 4, Y - 10, 6);
  fieldLine(LM + 4, Y - 22, halfW - 10);
  fieldLine(LM + 4, Y - 34, halfW - 10);

  const midX = LM + halfW + 15;
  label('Case No.', midX, Y - 10, 7);
  fieldLine(midX + 45, Y - 11, halfW - 55);
  label('Judge', midX, Y - 30, 7);
  fieldLine(midX + 30, Y - 31, halfW - 40);
  label('Bar no.', midX, Y - 50, 7);
  fieldLine(midX + 35, Y - 51, halfW - 45);

  label('Defendant name(s), address(es), and telephone no(s).', LM + 4, Y - caseBoxH / 2 - 10, 6);
  fieldLine(LM + 4, Y - caseBoxH / 2 - 22, halfW - 10);
  fieldLine(LM + 4, Y - caseBoxH / 2 - 34, halfW - 10);

  Y -= caseBoxH + 6;

  // === FORM TITLE ===
  const titleText = 'DEMAND FOR POSSESSION';
  const titleW = helveticaBold.widthOfTextAtSize(titleText, 14);
  page.drawText(titleText, { x: (W - titleW) / 2, y: Y, size: 14, font: helveticaBold, color: BLACK });
  Y -= 14;

  const subtitleText = 'NONPAYMENT OF RENT';
  const subtitleW = helveticaBold.widthOfTextAtSize(subtitleText, 11);
  page.drawText(subtitleText, { x: (W - subtitleW) / 2, y: Y, size: 11, font: helveticaBold, color: BLACK });
  Y -= 10;

  const formRef = 'MCL 600.5714(1)(a); MCR 4.201';
  const formRefW = helvetica.widthOfTextAtSize(formRef, 7);
  page.drawText(formRef, { x: (W - formRefW) / 2, y: Y, size: 7, font: helvetica, color: GRAY });
  Y -= 16;

  drawLine(Y);
  Y -= 14;

  // === PREMISES ===
  labelBold('PREMISES:', LM, Y, 9);
  Y -= 14;

  label('Address', LM, Y, 7);
  fieldLine(LM + 40, Y - 1, contentW - 40);
  Y -= 16;

  label('City', LM, Y, 7);
  fieldLine(LM + 22, Y - 1, 180);
  label('County', LM + 220, Y, 7);
  fieldLine(LM + 255, Y - 1, 140);
  label('Michigan', LM + 410, Y, 7);
  Y -= 18;

  drawLine(Y);
  Y -= 14;

  // === DEMAND BODY ===
  labelBold('TO THE TENANT(S) AND ALL OTHER OCCUPANTS:', LM, Y, 9);
  Y -= 14;

  const demandLines = [
    'DEMAND IS MADE that you deliver up possession of the above-described premises within SEVEN (7) DAYS',
    'after service of this demand on the ground that rent due has not been paid.',
  ];
  for (const line of demandLines) {
    page.drawText(line, { x: LM, y: Y, size: 9, font: timesRoman, color: BLACK });
    Y -= 12;
  }
  Y -= 4;

  const demandLines2 = [
    'If you fail to deliver up possession within the time stated above, proceedings will be commenced against',
    'you to recover possession of the premises, the rent due, and other sums required under the lease or',
    'rental agreement, plus costs and attorney fees as allowed by law.',
  ];
  for (const line of demandLines2) {
    page.drawText(line, { x: LM, y: Y, size: 9, font: timesRoman, color: BLACK });
    Y -= 12;
  }
  Y -= 4;

  const cureLine = 'You may avoid this proceeding by paying the full amount of rent due within the seven (7) day period.';
  page.drawText(cureLine, { x: LM, y: Y, size: 9, font: timesRomanBold, color: BLACK });
  Y -= 16;

  drawLine(Y);
  Y -= 14;

  // === RENT ARREARAGE ===
  labelBold('RENT ARREARAGE:', LM, Y, 9);
  Y -= 16;

  label('Rent period from', LM, Y, 8);
  fieldLine(LM + 80, Y - 1, 110);
  label('through', LM + 200, Y, 8);
  fieldLine(LM + 235, Y - 1, 110);
  Y -= 16;

  label('Monthly rent amount  $', LM, Y, 8);
  fieldLine(LM + 110, Y - 1, 120);
  Y -= 16;

  label('Total rent due and unpaid  $', LM, Y, 8);
  fieldLine(LM + 135, Y - 1, 120);
  Y -= 20;

  drawLine(Y);
  Y -= 14;

  // === CERTIFICATE OF SERVICE ===
  labelBold('CERTIFICATE OF SERVICE', LM, Y, 9);
  Y -= 14;

  page.drawText('I certify that on this date I served a copy of this demand on the above-named tenant(s) by:', { x: LM, y: Y, size: 8, font: timesRoman, color: BLACK });
  Y -= 16;

  checkbox(LM + 10, Y);
  label('Personal service', LM + 22, Y, 8);
  Y -= 14;

  checkbox(LM + 10, Y);
  label('First-class mail to the tenant\'s last known address', LM + 22, Y, 8);
  Y -= 14;

  checkbox(LM + 10, Y);
  label('Tacking and first-class mail (after unsuccessful attempt at personal service)', LM + 22, Y, 8);
  Y -= 20;

  label('Date of service', LM, Y, 8);
  fieldLine(LM + 70, Y - 1, 130);
  label('Served by (print name)', LM + 270, Y, 8);
  fieldLine(LM + 380, Y - 1, 156);
  Y -= 22;

  drawLine(Y);
  Y -= 14;

  // === SIGNATURE ===
  labelBold('SIGNATURE', LM, Y, 9);
  Y -= 22;

  label('Signature of landlord/authorized agent', LM, Y, 8);
  fieldLine(LM + 190, Y - 1, 200);
  label('Date', LM + 410, Y, 8);
  fieldLine(LM + 430, Y - 1, 106);
  Y -= 16;

  label('Print name', LM, Y, 8);
  fieldLine(LM + 55, Y - 1, 200);
  label('Telephone no.', LM + 280, Y, 8);
  fieldLine(LM + 350, Y - 1, 186);
  Y -= 16;

  label('Address', LM, Y, 8);
  fieldLine(LM + 40, Y - 1, contentW - 40);
  Y -= 22;

  // === FOOTER ===
  drawLine(Y);
  Y -= 10;

  const footerLeft = 'DC 100a  (6/04)  DEMAND FOR POSSESSION, Nonpayment of Rent';
  page.drawText(footerLeft, { x: LM, y: Y, size: 6, font: helvetica, color: GRAY });

  const footerRight = 'MCL 600.5714(1)(a); MCR 4.201';
  const footerRightW = helvetica.widthOfTextAtSize(footerRight, 6);
  page.drawText(footerRight, { x: RM - footerRightW, y: Y, size: 6, font: helvetica, color: GRAY });

  // === LOG FIELD POSITIONS FOR OVERLAY MAPPING ===
  console.log('--- OVERLAY FIELD COORDINATES ---');
  {
    let y = H - 36;
    y -= 10; y -= 10; y -= 16; y -= 4;
    const cbt = y;
    const hw = contentW / 2 - 10;
    const cbH = 90;
    console.log(`plaintiff_name: x=${LM + 4}, y=${cbt - 20}`);
    console.log(`plaintiff_address: x=${LM + 4}, y=${cbt - 32}`);
    console.log(`plaintiff_phone: x=${LM + 4 + 120}, y=${cbt - 32}`);
    const mx = LM + hw + 15;
    console.log(`case_number: x=${mx + 45}, y=${cbt - 9}`);
    console.log(`defendant_name: x=${LM + 4}, y=${cbt - cbH / 2 - 20}`);
    console.log(`defendant_address: x=${LM + 4}, y=${cbt - cbH / 2 - 32}`);
    y -= cbH + 6;
    y -= 14; // title
    y -= 10; // subtitle
    y -= 16; // form ref + spacing
    // drawLine
    y -= 14; // past line
    // PREMISES label
    y -= 14;
    // Address field
    console.log(`premises_address: x=${LM + 40}, y=${y - 1}`);
    y -= 16;
    // City field
    console.log(`premises_city: x=${LM + 22}, y=${y - 1}`);
    console.log(`premises_county: x=${LM + 255}, y=${y - 1}`);
    y -= 18;
    // drawLine
    y -= 14;
    // DEMAND header
    y -= 14;
    // 2 demand lines
    y -= 12; y -= 12; y -= 4;
    // 3 more lines
    y -= 12; y -= 12; y -= 12; y -= 4;
    // cure line
    y -= 16;
    // drawLine
    y -= 14;
    // RENT ARREARAGE label
    y -= 16;
    // rent period from
    console.log(`rent_period_from: x=${LM + 80}, y=${y - 1}`);
    console.log(`rent_period_to: x=${LM + 235}, y=${y - 1}`);
    y -= 16;
    console.log(`monthly_rent_amount: x=${LM + 110}, y=${y - 1}`);
    y -= 16;
    console.log(`rent_amount_due: x=${LM + 135}, y=${y - 1}`);
    y -= 20;
    // drawLine
    y -= 14;
    // CERTIFICATE OF SERVICE
    y -= 14;
    // certify text
    y -= 16;
    // checkbox 1 - personal
    console.log(`service_checkbox_personal: x=${LM + 12}, y=${y + 1}`);
    y -= 14;
    // checkbox 2 - mail
    console.log(`service_checkbox_first_class_mail: x=${LM + 12}, y=${y + 1}`);
    y -= 14;
    // checkbox 3 - posting
    console.log(`service_checkbox_posting: x=${LM + 12}, y=${y + 1}`);
    y -= 20;
    // service date / server name
    console.log(`service_date: x=${LM + 70}, y=${y - 1}`);
    console.log(`server_name: x=${LM + 380}, y=${y - 1}`);
    y -= 22;
    // drawLine
    y -= 14;
    // SIGNATURE label
    y -= 22;
    // signature line
    console.log(`signature_date: x=${LM + 430}, y=${y - 1}`);
    y -= 16;
    console.log(`plaintiff_name_print: x=${LM + 55}, y=${y - 1}`);
    console.log(`plaintiff_phone_sig: x=${LM + 350}, y=${y - 1}`);
    y -= 16;
    console.log(`plaintiff_address_sig: x=${LM + 40}, y=${y - 1}`);
  }
  console.log('--- END COORDINATES ---');

  // === SAVE ===
  const pdfBytes = await pdfDoc.save();
  const outPath = path.resolve(process.cwd(), 'server/assets/court-forms/MI_DC_100a.pdf');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, pdfBytes);
  console.log(`Base SCAO DC 100a PDF written to: ${outPath}`);
  console.log(`File size: ${pdfBytes.length} bytes`);
  console.log(`Pages: ${pdfDoc.getPageCount()}`);
}

generateBasePdf().catch(err => {
  console.error('Failed to generate base PDF:', err);
  process.exit(1);
});
