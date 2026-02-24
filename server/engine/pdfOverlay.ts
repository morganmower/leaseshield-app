import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';

export type OverlayFieldData = {
  fieldKey: string;
  value: string;
  pageNumber: number;
  x: number;
  y: number;
  font: string;
  fontSize: number;
  maxWidth: number | null;
  align: string;
  wrap: boolean;
};

const FORM_FIELD_MAP: Record<string, string> = {
  'plaintiff_name': 'First Middle and Last Name',
  'plaintiff_address': 'Address',
  'plaintiff_city_state_zip': 'City  State  Zip ',
  'plaintiff_phone': 'Telephone Number',
  'defendant_name': 'Tenant\'s Name And Address',
  'premises_address': 'Address or description of premises rented (if different from mailing address)',
  'rent_amount_due': 'says that you owe In Dollars for rent',
  'service_date': 'Date of Certificate Of Service',
  'server_name': 'I served this notice on Name',
  'signature_date': 'Date',
  'plaintiff_name_print': 'Signature of owner of premises or agent',
  'plaintiff_address_sig': 'Address',
  'service_checkbox_personal': 'delivering it personally to the person in possession',
  'service_checkbox_first_class_mail': 'first class mail addressed to the person in possession',
  'service_checkbox_posting': 'delivering it on the premises to a member of his/her family or household or an employee ',
};

export async function generateOverlayPdf(
  basePdfPath: string,
  overlayData: OverlayFieldData[]
): Promise<Buffer> {
  const resolvedPath = path.resolve(basePdfPath);
  const pdfBytes = fs.readFileSync(resolvedPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);

  let hasFormFields = false;
  try {
    const form = pdfDoc.getForm();
    const fields = form.getFields();
    hasFormFields = fields.length > 0;
  } catch (e) {
    hasFormFields = false;
  }

  if (hasFormFields) {
    return fillFormFields(pdfDoc, overlayData);
  }

  return drawOverlayText(pdfDoc, overlayData);
}

async function fillFormFields(
  pdfDoc: PDFDocument,
  overlayData: OverlayFieldData[]
): Promise<Buffer> {
  const form = pdfDoc.getForm();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const valueMap: Record<string, string> = {};
  for (const field of overlayData) {
    if (field.value && field.value.trim()) {
      valueMap[field.fieldKey] = field.value;
    }
  }

  const tenantParts: string[] = [];
  if (valueMap['defendant_name']) tenantParts.push(valueMap['defendant_name']);
  if (valueMap['defendant_address']) tenantParts.push(valueMap['defendant_address']);
  if (valueMap['defendant_city_state_zip']) tenantParts.push(valueMap['defendant_city_state_zip']);
  const tenantBlock = tenantParts.join('\n');

  const signatureParts: string[] = [];
  if (valueMap['plaintiff_name_print']) signatureParts.push(valueMap['plaintiff_name_print']);
  const sigBlock = signatureParts.join('');

  const addressSigParts: string[] = [];
  if (valueMap['plaintiff_address_sig']) {
    addressSigParts.push(valueMap['plaintiff_address_sig']);
  } else {
    if (valueMap['plaintiff_address']) addressSigParts.push(valueMap['plaintiff_address']);
  }
  const addressSig = addressSigParts.join('');

  const premisesParts: string[] = [];
  if (valueMap['premises_address']) premisesParts.push(valueMap['premises_address']);
  if (valueMap['premises_city']) premisesParts.push(valueMap['premises_city']);
  if (valueMap['premises_county']) premisesParts.push(valueMap['premises_county'] + ' County');
  const premisesBlock = premisesParts.join(', ');

  const textFieldMappings: Array<{ formFieldName: string; value: string }> = [
    { formFieldName: 'First Middle and Last Name', value: valueMap['plaintiff_name'] || '' },
    { formFieldName: 'Address', value: addressSig },
    { formFieldName: 'City  State  Zip ', value: valueMap['plaintiff_city_state_zip'] || '' },
    { formFieldName: 'Telephone Number', value: valueMap['plaintiff_phone'] || valueMap['plaintiff_phone_sig'] || '' },
    { formFieldName: 'Tenant\'s Name And Address', value: tenantBlock },
    { formFieldName: 'Address or description of premises rented (if different from mailing address)', value: premisesBlock },
    { formFieldName: 'says that you owe In Dollars for rent', value: valueMap['rent_amount_due'] || '' },
    { formFieldName: 'Date of Certificate Of Service', value: valueMap['service_date'] || '' },
    { formFieldName: 'I served this notice on Name', value: valueMap['server_name'] || '' },
    { formFieldName: 'Date', value: valueMap['signature_date'] || '' },
    { formFieldName: 'Signature of owner of premises or agent', value: sigBlock },
  ];

  for (const mapping of textFieldMappings) {
    if (!mapping.value) continue;
    try {
      const textField = form.getTextField(mapping.formFieldName);
      textField.setText(mapping.value);
      textField.defaultUpdateAppearances(helvetica);
    } catch (e: any) {
      console.warn(`[PdfOverlay] Could not fill field "${mapping.formFieldName}": ${e.message}`);
    }
  }

  const checkboxMappings: Array<{ formFieldName: string; overlayKey: string }> = [
    { formFieldName: 'delivering it personally to the person in possession', overlayKey: 'service_checkbox_personal' },
    { formFieldName: 'first class mail addressed to the person in possession', overlayKey: 'service_checkbox_first_class_mail' },
    { formFieldName: 'delivering it on the premises to a member of his/her family or household or an employee ', overlayKey: 'service_checkbox_posting' },
  ];

  for (const cb of checkboxMappings) {
    if (valueMap[cb.overlayKey] === 'X' || valueMap[cb.overlayKey] === 'x') {
      try {
        const checkbox = form.getCheckBox(cb.formFieldName);
        checkbox.check();
      } catch (e: any) {
        console.warn(`[PdfOverlay] Could not check "${cb.formFieldName}": ${e.message}`);
      }
    }
  }

  try {
    const sevenDaysCheckbox = form.getCheckBox('7 days');
    sevenDaysCheckbox.check();
  } catch (e: any) {
    console.warn(`[PdfOverlay] Could not check "7 days": ${e.message}`);
  }

  form.flatten();

  const resultBytes = await pdfDoc.save();
  return Buffer.from(resultBytes);
}

async function drawOverlayText(
  pdfDoc: PDFDocument,
  overlayData: OverlayFieldData[]
): Promise<Buffer> {
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pages = pdfDoc.getPages();

  for (const field of overlayData) {
    if (!field.value || field.value.trim() === '') continue;

    const pageIndex = field.pageNumber - 1;
    if (pageIndex < 0 || pageIndex >= pages.length) continue;

    const page = pages[pageIndex];
    const font = field.font === 'HelveticaBold' ? helveticaBold : helvetica;
    const fontSize = field.fontSize || 10;
    const color = rgb(0, 0, 0);

    if (field.value === 'X' || field.value === 'x') {
      page.drawText('X', {
        x: field.x,
        y: field.y,
        size: fontSize,
        font: helveticaBold,
        color,
      });
      continue;
    }

    const textWidth = font.widthOfTextAtSize(field.value, fontSize);

    let drawX = field.x;
    if (field.align === 'center' && field.maxWidth) {
      drawX = field.x + (field.maxWidth - textWidth) / 2;
    } else if (field.align === 'right' && field.maxWidth) {
      drawX = field.x + field.maxWidth - textWidth;
    }

    if (field.wrap && field.maxWidth && textWidth > field.maxWidth) {
      const words = field.value.split(' ');
      let lines: string[] = [];
      let currentLine = '';

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const testWidth = font.widthOfTextAtSize(testLine, fontSize);
        if (testWidth > field.maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);

      const lineHeight = fontSize * 1.2;
      for (let i = 0; i < lines.length; i++) {
        page.drawText(lines[i], {
          x: field.x,
          y: field.y - (i * lineHeight),
          size: fontSize,
          font,
          color,
        });
      }
    } else {
      const displayValue = field.maxWidth && textWidth > field.maxWidth
        ? truncateToFit(field.value, font, fontSize, field.maxWidth)
        : field.value;

      page.drawText(displayValue, {
        x: drawX,
        y: field.y,
        size: fontSize,
        font,
        color,
      });
    }
  }

  const resultBytes = await pdfDoc.save();
  return Buffer.from(resultBytes);
}

function truncateToFit(
  text: string,
  font: any,
  fontSize: number,
  maxWidth: number
): string {
  let truncated = text;
  while (font.widthOfTextAtSize(truncated, fontSize) > maxWidth && truncated.length > 1) {
    truncated = truncated.slice(0, -1);
  }
  return truncated;
}
