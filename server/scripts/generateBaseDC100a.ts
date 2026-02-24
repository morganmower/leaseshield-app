import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';

const BLACK = rgb(0, 0, 0);
const GRAY = rgb(0.4, 0.4, 0.4);

interface OverlayCoord {
  fieldKey: string;
  x: number;
  y: number;
  pageNumber: number;
}

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

  const coords: OverlayCoord[] = [];

  function drawHLine(y: number, x1 = LM, x2 = RM) {
    page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: 0.5, color: BLACK });
  }

  function drawBox(x: number, y: number, w: number, h: number) {
    page.drawRectangle({ x, y, width: w, height: h, borderColor: BLACK, borderWidth: 0.75, color: rgb(1, 1, 1) });
  }

  function text(str: string, x: number, y: number, size: number, font = helvetica, color = BLACK) {
    page.drawText(str, { x, y, size, font, color });
  }

  function fieldLine(x: number, y: number, w: number) {
    page.drawLine({ start: { x, y }, end: { x: x + w, y }, thickness: 0.5, color: GRAY });
  }

  function checkbox(x: number, y: number, size = 8) {
    page.drawRectangle({ x, y, width: size, height: size, borderColor: BLACK, borderWidth: 0.5, color: rgb(1, 1, 1) });
  }

  function track(fieldKey: string, x: number, y: number) {
    coords.push({ fieldKey, x, y, pageNumber: 1 });
  }

  let Y = H - 36;

  // === SCAO HEADER ===
  text('STATE OF MICHIGAN', LM, Y, 7, helveticaBold);
  text('JUDICIAL DISTRICT', RM - 100, Y, 7, helveticaBold);
  Y -= 10;
  text('JUDICIAL CIRCUIT', LM, Y, 7, helveticaBold);
  text('COUNTY', RM - 55, Y, 7, helveticaBold);
  Y -= 10;
  text('Court address', LM, Y, 6);
  fieldLine(LM + 55, Y - 1, 220);
  text('Court telephone no.', RM - 160, Y, 6);
  fieldLine(RM - 70, Y - 1, 70);
  Y -= 14;

  drawHLine(Y);
  Y -= 2;

  // === CASE HEADER BOX ===
  const caseBoxH = 100;
  const leftColW = contentW * 0.55;
  const dividerX = LM + leftColW;

  drawBox(LM, Y - caseBoxH, contentW, caseBoxH);
  page.drawLine({ start: { x: dividerX, y: Y }, end: { x: dividerX, y: Y - caseBoxH }, thickness: 0.5, color: BLACK });
  page.drawLine({ start: { x: LM, y: Y - caseBoxH / 2 }, end: { x: dividerX, y: Y - caseBoxH / 2 }, thickness: 0.5, color: BLACK });

  const pLabelY = Y - 9;
  text('Plaintiff name(s), address(es), and telephone no(s).', LM + 4, pLabelY, 6);

  const pLine1Y = Y - 21;
  fieldLine(LM + 4, pLine1Y, leftColW - 12);
  track('plaintiff_name', LM + 4, pLine1Y + 2);

  const pLine2Y = Y - 33;
  fieldLine(LM + 4, pLine2Y, leftColW - 12);
  track('plaintiff_address', LM + 4, pLine2Y + 2);
  track('plaintiff_phone', LM + 4 + 150, pLine2Y + 2);

  const pLine3Y = Y - 45;
  fieldLine(LM + 4, pLine3Y, leftColW - 12);
  track('plaintiff_city_state_zip', LM + 4, pLine3Y + 2);

  const rightX = dividerX + 8;
  const rightFieldW = contentW - leftColW - 16;
  text('Case No.', rightX, Y - 12, 7, helveticaBold);
  fieldLine(rightX + 45, Y - 13, rightFieldW - 45);

  text('Judge', rightX, Y - 35, 7);
  fieldLine(rightX + 30, Y - 36, rightFieldW - 30);

  text('Bar no.', rightX, Y - 58, 7);
  fieldLine(rightX + 35, Y - 59, rightFieldW - 35);

  const midLineY = Y - caseBoxH / 2;
  const dLabelY = midLineY - 9;
  text('Defendant name(s), address(es), and telephone no(s).', LM + 4, dLabelY, 6);

  const dLine1Y = midLineY - 21;
  fieldLine(LM + 4, dLine1Y, leftColW - 12);
  track('defendant_name', LM + 4, dLine1Y + 2);

  const dLine2Y = midLineY - 33;
  fieldLine(LM + 4, dLine2Y, leftColW - 12);
  track('defendant_address', LM + 4, dLine2Y + 2);

  const dLine3Y = midLineY - 45;
  fieldLine(LM + 4, dLine3Y, leftColW - 12);
  track('defendant_city_state_zip', LM + 4, dLine3Y + 2);

  Y -= caseBoxH + 4;

  // === FORM TITLE ===
  const titleText = 'DEMAND FOR POSSESSION';
  const titleW = helveticaBold.widthOfTextAtSize(titleText, 14);
  text(titleText, (W - titleW) / 2, Y, 14, helveticaBold);
  Y -= 15;

  const subtitleText = 'NONPAYMENT OF RENT';
  const subtitleW = helveticaBold.widthOfTextAtSize(subtitleText, 10);
  text(subtitleText, (W - subtitleW) / 2, Y, 10, helveticaBold);
  Y -= 11;

  const formRef = 'MCL 600.5714(1)(a); MCR 4.201';
  const formRefW = helvetica.widthOfTextAtSize(formRef, 7);
  text(formRef, (W - formRefW) / 2, Y, 7, helvetica, GRAY);
  Y -= 12;

  drawHLine(Y);
  Y -= 12;

  // === PREMISES ===
  text('PREMISES:', LM, Y, 9, helveticaBold);
  Y -= 14;

  text('Address', LM + 4, Y, 7);
  const addrFieldX = LM + 44;
  const addrFieldW = contentW - 48;
  fieldLine(addrFieldX, Y - 1, addrFieldW);
  track('premises_address', addrFieldX, Y + 1);
  Y -= 16;

  text('City', LM + 4, Y, 7);
  const cityFieldX = LM + 26;
  fieldLine(cityFieldX, Y - 1, 190);
  track('premises_city', cityFieldX, Y + 1);

  const countyLabelX = LM + 230;
  text('County', countyLabelX, Y, 7);
  const countyFieldX = LM + 268;
  fieldLine(countyFieldX, Y - 1, 130);
  track('premises_county', countyFieldX, Y + 1);

  text('Michigan', RM - 46, Y, 7);
  Y -= 16;

  drawHLine(Y);
  Y -= 14;

  // === DEMAND BODY ===
  text('TO THE TENANT(S) AND ALL OTHER OCCUPANTS:', LM, Y, 9, helveticaBold);
  Y -= 16;

  const indent = LM + 16;
  const bodyLines1 = [
    'DEMAND IS MADE that you deliver up possession of the above-described premises within SEVEN (7) DAYS',
    'after service of this demand on the ground that rent due has not been paid.',
  ];
  for (const line of bodyLines1) {
    text(line, indent, Y, 8.5, timesRoman);
    Y -= 11;
  }
  Y -= 4;

  const bodyLines2 = [
    'If you fail to deliver up possession within the time stated above, proceedings will be commenced against',
    'you to recover possession of the premises, the rent due, and other sums required under the lease or',
    'rental agreement, plus costs and attorney fees as allowed by law.',
  ];
  for (const line of bodyLines2) {
    text(line, LM, Y, 8.5, timesRoman);
    Y -= 11;
  }
  Y -= 6;

  const cureLine = 'You may avoid this proceeding by paying the full amount of rent due within the seven (7) day period.';
  text(cureLine, LM, Y, 8.5, timesRomanBold);
  Y -= 16;

  drawHLine(Y);
  Y -= 14;

  // === RENT ARREARAGE ===
  text('RENT ARREARAGE:', LM, Y, 9, helveticaBold);
  Y -= 16;

  text('Rent period from', LM + 4, Y, 8);
  const rpFromX = LM + 84;
  fieldLine(rpFromX, Y - 1, 120);
  track('rent_period_from', rpFromX, Y + 1);

  text('through', LM + 214, Y, 8);
  const rpToX = LM + 250;
  fieldLine(rpToX, Y - 1, 120);
  track('rent_period_to', rpToX, Y + 1);
  Y -= 16;

  text('Monthly rent amount  $', LM + 4, Y, 8);
  const mraX = LM + 118;
  fieldLine(mraX, Y - 1, 140);
  track('monthly_rent_amount', mraX, Y + 1);
  Y -= 16;

  text('Total rent due and unpaid  $', LM + 4, Y, 8);
  const trdX = LM + 145;
  fieldLine(trdX, Y - 1, 140);
  track('rent_amount_due', trdX, Y + 1);
  Y -= 18;

  drawHLine(Y);
  Y -= 14;

  // === CERTIFICATE OF SERVICE ===
  text('CERTIFICATE OF SERVICE', LM, Y, 9, helveticaBold);
  Y -= 14;

  text('I certify that on this date I served a copy of this demand on the above-named tenant(s) by:', LM + 4, Y, 8, timesRoman);
  Y -= 16;

  checkbox(LM + 12, Y);
  text('Personal service', LM + 24, Y + 1, 8);
  track('service_checkbox_personal', LM + 14, Y + 2);
  Y -= 13;

  checkbox(LM + 12, Y);
  text('First-class mail to the tenant\'s last known address', LM + 24, Y + 1, 8);
  track('service_checkbox_first_class_mail', LM + 14, Y + 2);
  Y -= 13;

  checkbox(LM + 12, Y);
  text('Tacking and first-class mail (after unsuccessful attempt at personal service)', LM + 24, Y + 1, 8);
  track('service_checkbox_posting', LM + 14, Y + 2);
  Y -= 18;

  text('Date of service', LM + 4, Y, 8);
  const sdX = LM + 78;
  fieldLine(sdX, Y - 1, 140);
  track('service_date', sdX, Y + 1);

  text('Served by (print name)', LM + 290, Y, 8);
  const snX = LM + 400;
  fieldLine(snX, Y - 1, contentW - 404);
  track('server_name', snX, Y + 1);
  Y -= 20;

  drawHLine(Y);
  Y -= 14;

  // === SIGNATURE ===
  text('SIGNATURE', LM, Y, 9, helveticaBold);
  Y -= 20;

  text('Signature of landlord/authorized agent', LM + 4, Y, 8);
  fieldLine(LM + 195, Y - 1, 210);
  text('Date', LM + 420, Y, 8);
  const sigDateX = LM + 440;
  fieldLine(sigDateX, Y - 1, RM - sigDateX);
  track('signature_date', sigDateX, Y + 1);
  Y -= 16;

  text('Print name', LM + 4, Y, 8);
  const pnX = LM + 60;
  fieldLine(pnX, Y - 1, 210);
  track('plaintiff_name_print', pnX, Y + 1);

  text('Telephone no.', LM + 290, Y, 8);
  const ptX = LM + 358;
  fieldLine(ptX, Y - 1, RM - ptX);
  track('plaintiff_phone_sig', ptX, Y + 1);
  Y -= 16;

  text('Address', LM + 4, Y, 8);
  const paX = LM + 44;
  fieldLine(paX, Y - 1, RM - paX);
  track('plaintiff_address_sig', paX, Y + 1);
  Y -= 20;

  // === FOOTER ===
  drawHLine(Y);
  Y -= 10;

  const footerLeft = 'DC 100a  (6/04)  DEMAND FOR POSSESSION, Nonpayment of Rent';
  text(footerLeft, LM, Y, 6, helvetica, GRAY);

  const footerRight = 'MCL 600.5714(1)(a); MCR 4.201';
  const footerRightW = helvetica.widthOfTextAtSize(footerRight, 6);
  text(footerRight, RM - footerRightW, Y, 6, helvetica, GRAY);

  // === OUTPUT COORDINATES ===
  console.log('--- OVERLAY FIELD COORDINATES ---');
  for (const c of coords) {
    console.log(`${c.fieldKey}: x=${c.x}, y=${c.y}, page=${c.pageNumber}`);
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

  const coordJson = JSON.stringify(coords, null, 2);
  const coordPath = path.resolve(process.cwd(), 'server/assets/court-forms/MI_DC_100a_coords.json');
  fs.writeFileSync(coordPath, coordJson);
  console.log(`Coordinates written to: ${coordPath}`);
}

generateBasePdf().catch(err => {
  console.error('Failed to generate base PDF:', err);
  process.exit(1);
});
