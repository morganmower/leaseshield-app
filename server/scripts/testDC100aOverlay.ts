import { resolveForm, getOverlayData } from "../engine";
import { generateOverlayPdf } from "../engine/pdfOverlay";
import * as path from "path";
import * as fs from "fs";

async function test() {
  console.log('Testing MI DC 100a overlay PDF generation...');
  
  const def = await resolveForm('mi_dc_100a_demand_possession_nonpayment');
  console.log(`Form: ${def.form.displayName}`);
  console.log(`Output mode: ${def.outputTemplate?.mode}`);
  console.log(`Base PDF: ${def.outputTemplate?.basePdfAttachmentPath}`);
  console.log(`Overlay fields: ${def.outputTemplate?.overlayFields?.length || 0}`);
  
  if (def.outputTemplate?.mode !== 'official_pdf_overlay') {
    console.error('ERROR: Output mode is not official_pdf_overlay');
    process.exit(1);
  }

  const testInputs: Record<string, string | number | boolean> = {
    plaintiff_name: 'JOHN DOE',
    plaintiff_address: '123 Main St',
    plaintiff_city_state_zip: 'Lansing, MI 48901',
    plaintiff_phone: '(517) 555-1234',
    defendant_name: 'JANE SMITH',
    defendant_address: '456 Oak Ave, Apt 2B',
    defendant_city_state_zip: 'Detroit, MI 48201',
    premises_address: '456 Oak Ave, Apt 2B',
    premises_city: 'Detroit',
    premises_county: 'Wayne',
    rent_amount_due: '1,234.00',
    rent_period_from: '01/01/2026',
    rent_period_to: '01/31/2026',
    monthly_rent_amount: '1,234.00',
    service_date: '02/24/2026',
    server_name: 'JOHN DOE',
    plaintiff_name_print: 'JOHN DOE',
    plaintiff_phone_sig: '(517) 555-1234',
    plaintiff_address_sig: '123 Main St, Lansing, MI 48901',
    signature_date: '02/24/2026',
  };

  const testServiceSelection: Record<string, boolean> = {};
  for (const rule of def.serviceRules) {
    if (rule.methodKey === 'personal') {
      testServiceSelection[rule.methodId] = true;
    }
  }

  const overlayData = getOverlayData({
    def,
    inputs: testInputs,
    serviceSelection: testServiceSelection,
    dateCalc: null,
  });

  console.log('\nOverlay data:');
  for (const field of overlayData) {
    if (field.value) {
      console.log(`  ${field.fieldKey}: "${field.value}" at (${field.x}, ${field.y}) page ${field.pageNumber}`);
    }
  }

  const basePdfPath = path.resolve(process.cwd(), def.outputTemplate!.basePdfAttachmentPath!);
  console.log(`\nLoading base PDF from: ${basePdfPath}`);
  
  const pdfBuffer = await generateOverlayPdf(basePdfPath, overlayData);
  
  const outPath = path.resolve(process.cwd(), 'test_DC100a_filled.pdf');
  fs.writeFileSync(outPath, pdfBuffer);
  console.log(`\nTest PDF written to: ${outPath}`);
  console.log(`File size: ${pdfBuffer.length} bytes`);
  console.log('\nTest PASSED - overlay PDF generated successfully');
  
  process.exit(0);
}

test().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
