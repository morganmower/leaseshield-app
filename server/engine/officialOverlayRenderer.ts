import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';

export type RenderStrategy = 'form_fields' | 'coordinates';

export type OverlayField = {
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

export type OfficialOverlayConfig = {
  basePdfPath: string;
  overlayData: OverlayField[];
  renderStrategy?: RenderStrategy;
  fieldNameMap?: Record<string, string>;
};

export type OfficialOverlayResult = {
  buffer: Buffer;
  strategyUsed: RenderStrategy;
  pageCount: number;
  basePdfPageCount: number;
};

const MI_DC100A_FIELD_MAP: Record<string, string> = {
  plaintiff_name: 'First Middle and Last Name',
  plaintiff_city_state_zip: 'City  State  Zip ',
  plaintiff_phone: 'Telephone Number',
  defendant_name: 'Tenant\'s Name And Address',
  premises_address: 'Address or description of premises rented (if different from mailing address)',
  rent_amount_due: 'says that you owe In Dollars for rent',
  service_date: 'Date of Certificate Of Service',
  server_name: 'I served this notice on Name',
  signature_date: 'Date',
  plaintiff_name_print: 'Signature of owner of premises or agent',
  plaintiff_address_sig: 'Address',
  service_checkbox_personal: 'delivering it personally to the person in possession',
  service_checkbox_first_class_mail: 'first class mail addressed to the person in possession',
  service_checkbox_posting: 'delivering it on the premises to a member of his/her family or household or an employee ',
  seven_days_checkbox: '7 days',
};

export async function renderOfficialOverlay(
  config: OfficialOverlayConfig
): Promise<OfficialOverlayResult> {
  const resolvedPath = path.resolve(config.basePdfPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`[OfficialOverlay] Base PDF not found: ${resolvedPath}`);
  }

  const pdfBytes = fs.readFileSync(resolvedPath);
  const basePdfDoc = await PDFDocument.load(pdfBytes);
  const basePdfPageCount = basePdfDoc.getPageCount();

  let strategyToUse: RenderStrategy = config.renderStrategy || 'form_fields';

  if (strategyToUse === 'form_fields') {
    let hasAcroFields = false;
    try {
      const form = basePdfDoc.getForm();
      hasAcroFields = form.getFields().length > 0;
    } catch {
      hasAcroFields = false;
    }
    if (!hasAcroFields) {
      strategyToUse = 'coordinates';
    }
  }

  let resultBuffer: Buffer;

  if (strategyToUse === 'form_fields') {
    resultBuffer = await fillFormFieldStrategy(basePdfDoc, config);
  } else {
    resultBuffer = await coordinateStrategy(basePdfDoc, config);
  }

  const outputDoc = await PDFDocument.load(resultBuffer);
  const outputPageCount = outputDoc.getPageCount();

  if (outputPageCount !== basePdfPageCount) {
    throw new Error(
      `[OfficialOverlay] Page count mismatch: base PDF has ${basePdfPageCount} page(s) but output has ${outputPageCount} page(s). Overlay must not add or remove pages.`
    );
  }

  return {
    buffer: resultBuffer,
    strategyUsed: strategyToUse,
    pageCount: outputPageCount,
    basePdfPageCount,
  };
}

async function fillFormFieldStrategy(
  pdfDoc: PDFDocument,
  config: OfficialOverlayConfig
): Promise<Buffer> {
  const form = pdfDoc.getForm();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const valueMap: Record<string, string> = {};
  for (const field of config.overlayData) {
    if (field.value && field.value.trim()) {
      valueMap[field.fieldKey] = field.value;
    }
  }

  if (config.fieldNameMap) {
    // Generic path: DB field_map_json drives all field fills.
    // Each entry: field_key (matches overlayData value) → exact pdf AcroForm field name.
    // Text fields: set text. CheckBox fields: check when value is 'X' / 'x' / 'true' / '1'.
    for (const [fieldKey, pdfFieldName] of Object.entries(config.fieldNameMap)) {
      const value = valueMap[fieldKey];
      if (!value) continue;

      let handled = false;

      try {
        const textField = form.getTextField(pdfFieldName);
        textField.setText(value);
        textField.defaultUpdateAppearances(helvetica);
        handled = true;
      } catch { /* not a text field */ }

      if (!handled) {
        try {
          const checkbox = form.getCheckBox(pdfFieldName);
          if (value === 'X' || value === 'x' || value === 'true' || value === '1') {
            checkbox.check();
          }
          handled = true;
        } catch { /* not a checkbox either */ }
      }

      if (!handled) {
        console.warn(`[OfficialOverlay] Field "${pdfFieldName}" not found as text or checkbox in PDF AcroForm`);
      }
    }
  } else {
    // Legacy path: MI DC 100a hardcoded logic (kept for backward compatibility).
    // Only runs when no fieldNameMap is provided (DB value takes precedence).
    const fieldMap = MI_DC100A_FIELD_MAP;

    const tenantParts: string[] = [];
    if (valueMap['defendant_name']) tenantParts.push(valueMap['defendant_name']);
    if (valueMap['defendant_address']) tenantParts.push(valueMap['defendant_address']);
    if (valueMap['defendant_city_state_zip']) tenantParts.push(valueMap['defendant_city_state_zip']);
    const tenantBlock = tenantParts.join('\n');

    const premisesParts: string[] = [];
    if (valueMap['premises_address']) premisesParts.push(valueMap['premises_address']);
    if (valueMap['premises_city']) premisesParts.push(valueMap['premises_city']);
    if (valueMap['premises_county']) premisesParts.push(valueMap['premises_county'] + ' County');
    const premisesBlock = premisesParts.join(', ');

    const addressSig = valueMap['plaintiff_address_sig']
      || (valueMap['plaintiff_address'] || '') + (valueMap['plaintiff_city_state_zip'] ? ', ' + valueMap['plaintiff_city_state_zip'] : '');

    const textFieldValues: Record<string, string> = {
      plaintiff_name: valueMap['plaintiff_name'] || '',
      plaintiff_city_state_zip: valueMap['plaintiff_city_state_zip'] || '',
      plaintiff_phone: valueMap['plaintiff_phone'] || valueMap['plaintiff_phone_sig'] || '',
      defendant_name: tenantBlock,
      premises_address: premisesBlock,
      rent_amount_due: valueMap['rent_amount_due'] || '',
      service_date: valueMap['service_date'] || '',
      server_name: valueMap['server_name'] || '',
      signature_date: valueMap['signature_date'] || '',
      plaintiff_name_print: valueMap['plaintiff_name_print'] || valueMap['plaintiff_name'] || '',
      plaintiff_address_sig: addressSig,
    };

    for (const [fieldKey, value] of Object.entries(textFieldValues)) {
      if (!value) continue;
      const pdfFieldName = fieldMap[fieldKey];
      if (!pdfFieldName) continue;
      try {
        const textField = form.getTextField(pdfFieldName);
        textField.setText(value);
        textField.defaultUpdateAppearances(helvetica);
      } catch (e: any) {
        console.warn(`[OfficialOverlay] Could not fill text field "${pdfFieldName}": ${e.message}`);
      }
    }

    const checkboxFields: Record<string, string> = {
      service_checkbox_personal: 'delivering it personally to the person in possession',
      service_checkbox_first_class_mail: 'first class mail addressed to the person in possession',
      service_checkbox_posting: 'delivering it on the premises to a member of his/her family or household or an employee ',
    };

    for (const [fieldKey, pdfFieldName] of Object.entries(checkboxFields)) {
      if (valueMap[fieldKey] === 'X' || valueMap[fieldKey] === 'x') {
        try {
          form.getCheckBox(pdfFieldName).check();
        } catch (e: any) {
          console.warn(`[OfficialOverlay] Could not check "${pdfFieldName}": ${e.message}`);
        }
      }
    }

    try {
      form.getCheckBox('7 days').check();
    } catch (e: any) {
      console.warn(`[OfficialOverlay] Could not check "7 days": ${e.message}`);
    }
  }

  form.flatten();

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

async function coordinateStrategy(
  pdfDoc: PDFDocument,
  config: OfficialOverlayConfig
): Promise<Buffer> {
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();
  const black = rgb(0, 0, 0);

  for (const field of config.overlayData) {
    if (!field.value || field.value.trim() === '') continue;

    const pageIndex = field.pageNumber - 1;
    if (pageIndex < 0 || pageIndex >= pages.length) continue;

    const page = pages[pageIndex];
    const font = field.font === 'HelveticaBold' ? helveticaBold : helvetica;
    const fontSize = field.fontSize || 10;

    if (field.value === 'X' || field.value === 'x') {
      page.drawText('X', { x: field.x, y: field.y, size: fontSize, font: helveticaBold, color: black });
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
      const lines: string[] = [];
      let currentLine = '';
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (font.widthOfTextAtSize(testLine, fontSize) > field.maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);
      const lineHeight = fontSize * 1.2;
      for (let i = 0; i < lines.length; i++) {
        page.drawText(lines[i], { x: field.x, y: field.y - i * lineHeight, size: fontSize, font, color: black });
      }
    } else {
      const displayValue = field.maxWidth && textWidth > field.maxWidth
        ? truncateToFit(field.value, font, fontSize, field.maxWidth)
        : field.value;
      page.drawText(displayValue, { x: drawX, y: field.y, size: fontSize, font, color: black });
    }
  }

  pdfDoc.getForm().flatten();

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

function truncateToFit(text: string, font: any, fontSize: number, maxWidth: number): string {
  let t = text;
  while (font.widthOfTextAtSize(t, fontSize) > maxWidth && t.length > 1) {
    t = t.slice(0, -1);
  }
  return t;
}
