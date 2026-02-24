import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const pdfPath = process.argv[2];

  if (!pdfPath) {
    console.error('Usage: npx tsx server/scripts/inspectPdfFields.ts <path-to-pdf>');
    process.exit(1);
  }

  const resolvedPath = path.resolve(pdfPath);

  if (!fs.existsSync(resolvedPath)) {
    console.error(`File not found: ${resolvedPath}`);
    process.exit(1);
  }

  const pdfBytes = fs.readFileSync(resolvedPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);

  const pages = pdfDoc.getPages();
  console.log(`\nPDF: ${resolvedPath}`);
  console.log(`Pages: ${pages.length}`);
  pages.forEach((p, i) => {
    const { width, height } = p.getSize();
    console.log(`  Page ${i + 1}: ${width.toFixed(1)} x ${height.toFixed(1)} pts`);
  });

  let hasFormFields = false;
  try {
    const form = pdfDoc.getForm();
    const fields = form.getFields();
    hasFormFields = fields.length > 0;

    if (!hasFormFields) {
      console.log('\nNo AcroForm fields detected.');
      console.log('Recommendation: Use render_strategy = "coordinates" for this PDF.');
      return;
    }

    console.log(`\nAcroForm fields (${fields.length} total):`);
    console.log('Recommendation: Use render_strategy = "form_fields" for this PDF.\n');

    for (const field of fields) {
      const name = field.getName();
      const type = field.constructor.name.replace('PDF', '');

      process.stdout.write(`  [${type.padEnd(12)}] "${name}"`);

      try {
        const widgets = field.acroField.getWidgets();
        if (widgets.length > 0) {
          const rect = widgets[0].getRectangle();
          process.stdout.write(
            `  → page rect: x=${rect.x.toFixed(1)}, y=${rect.y.toFixed(1)}, w=${rect.width.toFixed(1)}, h=${rect.height.toFixed(1)}`
          );
        }
      } catch {}

      process.stdout.write('\n');
    }

    console.log('\nField name mapping template (copy to your seed script):');
    console.log('const FIELD_MAP: Record<string, string> = {');
    for (const field of fields) {
      const name = field.getName();
      const type = field.constructor.name;
      if (type.includes('Button') && !type.includes('CheckBox')) continue;
      const safeKey = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 50);
      console.log(`  '${safeKey}': '${name}',`);
    }
    console.log('};');
  } catch (e: any) {
    console.log('\nNo AcroForm detected (or error reading form):', e.message);
    console.log('Recommendation: Use render_strategy = "coordinates" for this PDF.');
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
