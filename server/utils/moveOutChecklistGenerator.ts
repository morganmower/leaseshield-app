// NOTE: DOCX generation must use `docx` library only.
// HTML → DOCX conversion (html-to-docx) caused Word corruption issues.
// PDF = delivery / legal / courts (uses Puppeteer)
// DOCX = editable / customer convenience (uses docx library)
import puppeteer from 'puppeteer';
import { execSync } from 'child_process';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
  TableLayoutType,
} from 'docx';

interface MoveOutChecklistOptions {
  templateTitle: string;
  stateId: string;
  version?: number;
  updatedAt?: Date;
  checklistType?: 'move_in' | 'move_out';
}

const STATE_NAMES: Record<string, string> = {
  UT: 'Utah',
  TX: 'Texas',
  ND: 'North Dakota',
  SD: 'South Dakota',
  NC: 'North Carolina',
  OH: 'Ohio',
  MI: 'Michigan',
  ID: 'Idaho',
  WY: 'Wyoming',
  CA: 'California',
  VA: 'Virginia',
  NV: 'Nevada',
  AZ: 'Arizona',
  FL: 'Florida',
};

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/\//g, "&#x2F;");
}

const H1 = (text: string): Paragraph =>
  new Paragraph({
    children: [new TextRun({ text, bold: true, size: 28 })],
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    spacing: { after: 100 },
  });

const H2 = (text: string): Paragraph =>
  new Paragraph({
    children: [new TextRun({ text, bold: true, size: 22 })],
    heading: HeadingLevel.HEADING_2,
    shading: { fill: "f0f0f0" },
    spacing: { before: 200, after: 100 },
  });

const H3 = (text: string): Paragraph =>
  new Paragraph({
    children: [new TextRun({ text, bold: true, size: 20 })],
    shading: { fill: "e8e8e8" },
    spacing: { before: 150, after: 80 },
  });

const P = (text: string, options?: { bold?: boolean; italic?: boolean; size?: number }): Paragraph =>
  new Paragraph({
    children: [
      new TextRun({
        text,
        size: options?.size || 20,
        bold: options?.bold,
        italics: options?.italic,
      }),
    ],
    spacing: { after: 80 },
  });

const FieldLine = (label: string): Paragraph =>
  new Paragraph({
    children: [
      new TextRun({ text: label + " ", size: 20 }),
      new TextRun({ text: "_".repeat(40), size: 20 }),
    ],
    spacing: { after: 80 },
  });

const SignatureLine = (label: string): Paragraph =>
  new Paragraph({
    children: [
      new TextRun({ text: label + " ", size: 20 }),
      new TextRun({ text: "_".repeat(35), size: 20 }),
    ],
    spacing: { before: 150, after: 80 },
  });

const HR = (): Paragraph =>
  new Paragraph({
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
    },
    spacing: { before: 150, after: 150 },
  });

function createChecklistTable(items: string[]): Table {
  const headerRow = new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: "Item", bold: true, size: 18 })] })],
        width: { size: 30, type: WidthType.PERCENTAGE },
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: "Condition", bold: true, size: 18 })] })],
        width: { size: 15, type: WidthType.PERCENTAGE },
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: "Notes/Damage Description", bold: true, size: 18 })] })],
        width: { size: 55, type: WidthType.PERCENTAGE },
      }),
    ],
  });

  const dataRows = items.map(item => 
    new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: item, size: 18 })] })],
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: "", size: 18 })] })],
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: "", size: 18 })] })],
        }),
      ],
    })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [headerRow, ...dataRows],
  });
}

export async function generateMoveOutChecklistDocx(options: MoveOutChecklistOptions): Promise<Buffer> {
  const { templateTitle, stateId, version = 1, updatedAt = new Date(), checklistType = 'move_out' } = options;

  console.log('📝 Generating checklist DOCX with docx library...');
  const startTime = Date.now();

  const stateName = STATE_NAMES[stateId] || stateId;
  const formattedDate = updatedAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const isMoveIn = checklistType === 'move_in';
  const checklistLabel = isMoveIn ? 'Move-In' : 'Move-Out';
  const dateLabel = isMoveIn ? 'Move-In Date' : 'Move-Out Date';
  const instructionsText = isMoveIn 
    ? 'Complete this checklist during the initial walkthrough before tenant move-in. Document the condition of each area to establish baseline condition. Both landlord and tenant should sign upon completion.'
    : 'Complete this checklist during the final walkthrough before tenant move-out. Document the condition of each area and note any damages beyond normal wear and tear. Both landlord and tenant should sign upon completion.';

  const rooms = [
    { name: 'LIVING ROOM', items: ['Walls/Paint', 'Ceiling', 'Flooring/Carpet', 'Windows/Screens', 'Blinds/Curtains', 'Light Fixtures', 'Electrical Outlets', 'Doors/Locks'] },
    { name: 'KITCHEN', items: ['Walls/Paint', 'Flooring', 'Countertops', 'Cabinets/Drawers', 'Sink/Faucet', 'Stove/Oven', 'Refrigerator', 'Dishwasher', 'Microwave', 'Exhaust Fan/Hood'] },
    { name: 'BEDROOM(S)', items: ['Walls/Paint', 'Ceiling', 'Flooring/Carpet', 'Windows/Screens', 'Blinds/Curtains', 'Closet Doors', 'Light Fixtures', 'Electrical Outlets'] },
    { name: 'BATHROOM(S)', items: ['Walls/Paint', 'Flooring', 'Toilet', 'Sink/Vanity', 'Bathtub/Shower', 'Faucets/Fixtures', 'Mirror/Cabinet', 'Exhaust Fan', 'Towel Bars'] },
    { name: 'OTHER AREAS', items: ['Hallways', 'Stairs/Railings', 'Garage', 'Patio/Balcony', 'HVAC System', 'Water Heater', 'Smoke Detectors', 'CO Detectors'] }
  ];

  const children: (Paragraph | Table)[] = [];

  children.push(H1(`${checklistLabel.toUpperCase()} INSPECTION CHECKLIST`));
  children.push(P(`${stateName} - Version ${version}`, { italic: true }));
  children.push(P(`Last Updated: ${formattedDate}`, { size: 18 }));
  children.push(HR());

  children.push(P(`Instructions: ${instructionsText}`, { italic: true, size: 18 }));
  children.push(P("Condition Rating Guide: E = Excellent, G = Good, F = Fair, P = Poor, N/A = Not Applicable", { bold: true, size: 18 }));
  children.push(HR());

  children.push(FieldLine("Property Address:"));
  children.push(FieldLine("Unit #:"));
  children.push(FieldLine("Tenant Name:"));
  children.push(FieldLine(`${dateLabel}:`));
  children.push(HR());

  for (const room of rooms) {
    children.push(H3(room.name));
    children.push(createChecklistTable(room.items));
  }

  children.push(H2("ADDITIONAL NOTES"));
  children.push(P("_".repeat(80)));
  children.push(P("_".repeat(80)));
  children.push(P("_".repeat(80)));

  children.push(H2("SIGNATURES"));
  children.push(P("LANDLORD/AGENT:", { bold: true }));
  children.push(SignatureLine("Signature:"));
  children.push(SignatureLine("Print Name:"));
  children.push(SignatureLine("Date:"));

  children.push(P("TENANT:", { bold: true }));
  children.push(SignatureLine("Signature:"));
  children.push(SignatureLine("Print Name:"));
  children.push(SignatureLine("Date:"));

  children.push(HR());
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "For informational purposes only. Consult with a licensed attorney for legal advice.",
          size: 16,
          italics: true,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 200 },
    })
  );

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720,
              right: 720,
              bottom: 720,
              left: 720,
            },
          },
        },
        children,
      },
    ],
  });

  try {
    const buffer = await Packer.toBuffer(doc);
    console.log(`📝 Checklist DOCX generated successfully in ${Date.now() - startTime}ms (${buffer.length} bytes)`);
    return Buffer.from(buffer);
  } catch (error) {
    console.error('📝 Error generating checklist DOCX:', error);
    throw error;
  }
}

export async function generateMoveOutChecklistPdf(options: MoveOutChecklistOptions): Promise<Buffer> {
  const { templateTitle, stateId, version = 1, updatedAt = new Date(), checklistType = 'move_out' } = options;

  const htmlContent = generateMoveOutChecklistHTML(templateTitle, stateId, version, updatedAt, checklistType);

  let chromiumPath = '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium';
  try {
    chromiumPath = execSync('which chromium').toString().trim();
    console.log('📄 Using Chromium at:', chromiumPath);
  } catch (e) {
    console.log('📄 Falling back to default Chromium path');
  }

  console.log('📄 Launching Chromium browser for move-out checklist...');
  const startTime = Date.now();

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: chromiumPath,
    timeout: 30000,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--single-process',
      '--no-zygote',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-sync',
      '--disable-translate',
      '--mute-audio',
      '--hide-scrollbars',
    ]
  });

  console.log(`📄 Browser launched in ${Date.now() - startTime}ms`);

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(15000);
    await page.setViewport({ width: 816, height: 1056 });

    console.log('📄 Setting page content...');
    await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });

    console.log('📄 Generating PDF...');
    const pdfBuffer = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: '0.4in', right: '0.4in', bottom: '0.4in', left: '0.4in' },
    });

    console.log(`📄 Move-out checklist PDF generated successfully in ${Date.now() - startTime}ms`);
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

function generateMoveOutChecklistHTML(
  templateTitle: string,
  stateId: string,
  version: number,
  updatedAt: Date,
  checklistType: 'move_in' | 'move_out' = 'move_out'
): string {
  const safeTitle = escapeHtml(templateTitle);
  const stateName = STATE_NAMES[stateId] || stateId;
  const formattedDate = updatedAt.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  const isMoveIn = checklistType === 'move_in';
  const checklistLabel = isMoveIn ? 'Move-In' : 'Move-Out';
  const dateLabel = isMoveIn ? 'Move-In Date' : 'Move-Out Date';
  const instructionsText = isMoveIn 
    ? 'Complete this checklist during the initial walkthrough before tenant move-in. Document the condition of each area to establish baseline condition. Both landlord and tenant should sign upon completion.'
    : 'Complete this checklist during the final walkthrough before tenant move-out. Document the condition of each area and note any damages beyond normal wear and tear. Both landlord and tenant should sign upon completion.';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
  <style>
    @page { size: Letter; margin: 0.4in; }
    * { box-sizing: border-box; }
    body { font-family: 'Arial', 'Helvetica', sans-serif; font-size: 9pt; line-height: 1.3; color: #000; margin: 0; padding: 0; }
    .header { text-align: center; border-bottom: 2px solid #1a1a1a; padding-bottom: 10pt; margin-bottom: 12pt; }
    .header h1 { font-size: 14pt; font-weight: bold; margin: 0 0 4pt 0; text-transform: uppercase; letter-spacing: 1pt; }
    .header .subtitle { font-size: 10pt; color: #333; margin: 0; }
    .header .state-info { font-size: 8pt; color: #666; margin-top: 4pt; }
    .section { margin-bottom: 12pt; }
    .section-title { font-size: 10pt; font-weight: bold; background-color: #f0f0f0; padding: 5pt 6pt; margin: 0 0 6pt 0; border-left: 3pt solid #333; }
    .field-row { display: flex; margin-bottom: 6pt; align-items: flex-end; gap: 8pt; }
    .field { flex: 1; }
    .field-label { font-size: 8pt; color: #333; margin-bottom: 2pt; }
    .field-line { border-bottom: 1pt solid #000; height: 16pt; min-width: 80pt; }
    .instructions { font-size: 8pt; color: #444; margin-bottom: 10pt; padding: 6pt; background-color: #f9f9f9; border: 1pt solid #ddd; }
    .room-section { margin-bottom: 10pt; border: 1pt solid #ccc; padding: 6pt; }
    .room-title { font-size: 9pt; font-weight: bold; margin-bottom: 6pt; padding-bottom: 3pt; border-bottom: 1pt solid #ddd; }
    .checklist-table { width: 100%; border-collapse: collapse; font-size: 8pt; }
    .checklist-table th { background-color: #f5f5f5; padding: 4pt; text-align: left; border: 1pt solid #ccc; font-weight: bold; }
    .checklist-table td { padding: 4pt; border: 1pt solid #ccc; vertical-align: top; }
    .signature-line { border-bottom: 1pt solid #000; height: 24pt; margin-top: 16pt; }
    .signature-label { font-size: 8pt; color: #333; margin-top: 2pt; }
    .footer { margin-top: 14pt; padding-top: 6pt; border-top: 1pt solid #ccc; font-size: 7pt; color: #666; text-align: center; }
    .legend { font-size: 7pt; color: #444; margin-bottom: 8pt; padding: 4pt 6pt; background-color: #fafafa; border: 1pt solid #eee; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${checklistLabel} Inspection Checklist</h1>
    <p class="subtitle">${escapeHtml(stateName)} Property Inspection Form</p>
    <p class="state-info">Version ${version} | Last Updated: ${formattedDate}</p>
  </div>

  <div class="instructions">
    <strong>Instructions:</strong> ${instructionsText}
  </div>

  <div class="section">
    <h2 class="section-title">Property Information</h2>
    <div class="field-row">
      <div class="field" style="flex: 2;"><div class="field-label">Property Address</div><div class="field-line"></div></div>
      <div class="field" style="flex: 0.5;"><div class="field-label">Unit #</div><div class="field-line"></div></div>
    </div>
    <div class="field-row">
      <div class="field"><div class="field-label">Tenant Name(s)</div><div class="field-line"></div></div>
      <div class="field"><div class="field-label">Inspection Date</div><div class="field-line"></div></div>
      <div class="field"><div class="field-label">${dateLabel}</div><div class="field-line"></div></div>
    </div>
  </div>

  <div class="legend">
    <strong>Condition Rating:</strong> G = Good (clean, no damage) | F = Fair (minor wear, normal use) | P = Poor (damage beyond normal wear) | N/A = Not Applicable
  </div>

  <div class="room-section">
    <div class="room-title">Living Room / Common Areas</div>
    <table class="checklist-table">
      <tr><th>Item</th><th>Move-In</th><th>Move-Out</th><th>Damage/Notes</th></tr>
      <tr><td>Walls & Paint</td><td></td><td></td><td></td></tr>
      <tr><td>Ceiling</td><td></td><td></td><td></td></tr>
      <tr><td>Flooring/Carpet</td><td></td><td></td><td></td></tr>
      <tr><td>Windows & Screens</td><td></td><td></td><td></td></tr>
      <tr><td>Light Fixtures</td><td></td><td></td><td></td></tr>
      <tr><td>Doors & Locks</td><td></td><td></td><td></td></tr>
    </table>
  </div>

  <div class="room-section">
    <div class="room-title">Kitchen</div>
    <table class="checklist-table">
      <tr><th>Item</th><th>Move-In</th><th>Move-Out</th><th>Damage/Notes</th></tr>
      <tr><td>Walls & Paint</td><td></td><td></td><td></td></tr>
      <tr><td>Countertops</td><td></td><td></td><td></td></tr>
      <tr><td>Cabinets & Drawers</td><td></td><td></td><td></td></tr>
      <tr><td>Sink & Faucet</td><td></td><td></td><td></td></tr>
      <tr><td>Refrigerator</td><td></td><td></td><td></td></tr>
      <tr><td>Stove/Oven</td><td></td><td></td><td></td></tr>
      <tr><td>Dishwasher</td><td></td><td></td><td></td></tr>
    </table>
  </div>

  <div class="room-section">
    <div class="room-title">Bathroom(s)</div>
    <table class="checklist-table">
      <tr><th>Item</th><th>Move-In</th><th>Move-Out</th><th>Damage/Notes</th></tr>
      <tr><td>Toilet</td><td></td><td></td><td></td></tr>
      <tr><td>Sink & Vanity</td><td></td><td></td><td></td></tr>
      <tr><td>Bathtub/Shower</td><td></td><td></td><td></td></tr>
      <tr><td>Faucets</td><td></td><td></td><td></td></tr>
      <tr><td>Mirror & Medicine Cabinet</td><td></td><td></td><td></td></tr>
    </table>
  </div>

  <div class="room-section">
    <div class="room-title">Bedroom(s)</div>
    <table class="checklist-table">
      <tr><th>Item</th><th>Move-In</th><th>Move-Out</th><th>Damage/Notes</th></tr>
      <tr><td>Walls & Paint</td><td></td><td></td><td></td></tr>
      <tr><td>Flooring/Carpet</td><td></td><td></td><td></td></tr>
      <tr><td>Windows & Screens</td><td></td><td></td><td></td></tr>
      <tr><td>Closet & Doors</td><td></td><td></td><td></td></tr>
      <tr><td>Light Fixtures</td><td></td><td></td><td></td></tr>
    </table>
  </div>

  <div class="room-section">
    <div class="room-title">General Items</div>
    <table class="checklist-table">
      <tr><th>Item</th><th>Move-In</th><th>Move-Out</th><th>Damage/Notes</th></tr>
      <tr><td>HVAC System/Thermostat</td><td></td><td></td><td></td></tr>
      <tr><td>Smoke Detectors</td><td></td><td></td><td></td></tr>
      <tr><td>CO Detectors</td><td></td><td></td><td></td></tr>
      <tr><td>Keys Returned</td><td>N/A</td><td></td><td># of keys: ___</td></tr>
    </table>
  </div>

  <div class="section">
    <h2 class="section-title">Signatures</h2>
    <div class="field-row">
      <div class="field" style="flex: 2;"><div class="signature-line"></div><div class="signature-label">Landlord/Agent Signature</div></div>
      <div class="field" style="flex: 1;"><div class="signature-line"></div><div class="signature-label">Date</div></div>
    </div>
    <div class="field-row" style="margin-top: 12pt;">
      <div class="field" style="flex: 2;"><div class="signature-line"></div><div class="signature-label">Tenant Signature</div></div>
      <div class="field" style="flex: 1;"><div class="signature-line"></div><div class="signature-label">Date</div></div>
    </div>
  </div>

  <div class="footer">For informational purposes only. Consult with a licensed attorney for legal advice.</div>
</body>
</html>`;
}
