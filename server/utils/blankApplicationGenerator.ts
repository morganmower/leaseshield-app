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
} from 'docx';

interface BlankApplicationOptions {
  templateTitle: string;
  stateId: string;
  version?: number;
  updatedAt?: Date;
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
      new TextRun({ text: "_".repeat(50), size: 20 }),
    ],
    spacing: { after: 80 },
  });

const MultiFieldLine = (fields: string[]): Paragraph =>
  new Paragraph({
    children: fields.flatMap((field, i) => [
      new TextRun({ text: field + " ", size: 20 }),
      new TextRun({ text: "_".repeat(20) + (i < fields.length - 1 ? "   " : ""), size: 20 }),
    ]),
    spacing: { after: 80 },
  });

const CheckboxLine = (text: string): Paragraph =>
  new Paragraph({
    children: [
      new TextRun({ text: "[ ] Yes  [ ] No   ", size: 20 }),
      new TextRun({ text: text, size: 20 }),
    ],
    spacing: { after: 80 },
  });

const SignatureLine = (label: string): Paragraph =>
  new Paragraph({
    children: [
      new TextRun({ text: label + " ", size: 20 }),
      new TextRun({ text: "_".repeat(40), size: 20 }),
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

export async function generateBlankApplicationDocx(options: BlankApplicationOptions): Promise<Buffer> {
  const { templateTitle, stateId, version = 1, updatedAt = new Date() } = options;

  console.log('📝 Generating blank application DOCX with docx library...');
  const startTime = Date.now();

  const stateName = STATE_NAMES[stateId] || stateId;
  const formattedDate = updatedAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const children: Paragraph[] = [];

  children.push(H1("RENTAL APPLICATION"));
  children.push(P(`${stateName} - Version ${version}`, { italic: true }));
  children.push(P(`Last Updated: ${formattedDate}`, { size: 18 }));
  children.push(HR());

  children.push(P("Instructions: Please complete all sections. Incomplete applications may delay processing. All information will be verified.", { italic: true, size: 18 }));

  children.push(H2("PROPERTY INFORMATION"));
  children.push(FieldLine("Property Address:"));
  children.push(MultiFieldLine(["Unit #:", "Desired Move-In Date:", "Monthly Rent: $"]));

  children.push(H2("APPLICANT INFORMATION"));
  children.push(FieldLine("Full Legal Name:"));
  children.push(MultiFieldLine(["Date of Birth:", "SSN:", "Driver's License #:"]));
  children.push(MultiFieldLine(["Phone:", "Email:"]));

  children.push(H2("CURRENT RESIDENCE"));
  children.push(FieldLine("Current Address:"));
  children.push(MultiFieldLine(["City:", "State:", "ZIP:"]));
  children.push(MultiFieldLine(["Monthly Rent: $", "Length of Residency:"]));
  children.push(MultiFieldLine(["Landlord Name:", "Phone:"]));
  children.push(FieldLine("Reason for Leaving:"));

  children.push(H2("PREVIOUS RESIDENCE"));
  children.push(FieldLine("Previous Address:"));
  children.push(MultiFieldLine(["City:", "State:", "ZIP:"]));
  children.push(MultiFieldLine(["Monthly Rent: $", "Length of Residency:"]));
  children.push(MultiFieldLine(["Landlord Name:", "Phone:"]));

  children.push(H2("EMPLOYMENT INFORMATION"));
  children.push(FieldLine("Current Employer:"));
  children.push(FieldLine("Employer Address:"));
  children.push(MultiFieldLine(["Position/Title:", "Length of Employment:"]));
  children.push(MultiFieldLine(["Supervisor Name:", "Phone:"]));
  children.push(MultiFieldLine(["Monthly Gross Income: $", "Additional Income: $"]));

  children.push(H2("EMERGENCY CONTACT"));
  children.push(MultiFieldLine(["Name:", "Relationship:"]));
  children.push(MultiFieldLine(["Phone:", "Address:"]));

  children.push(H2("ADDITIONAL OCCUPANTS"));
  children.push(P("List all persons who will occupy the premises:", { size: 18 }));
  children.push(MultiFieldLine(["Name:", "Relationship:", "Age:"]));
  children.push(MultiFieldLine(["Name:", "Relationship:", "Age:"]));
  children.push(MultiFieldLine(["Name:", "Relationship:", "Age:"]));

  children.push(H2("PETS"));
  children.push(CheckboxLine("Do you have pets?"));
  children.push(FieldLine("If yes, describe (type, breed, weight):"));

  children.push(H2("BACKGROUND QUESTIONS"));
  children.push(CheckboxLine("Have you ever been evicted?"));
  children.push(FieldLine("If yes, explain:"));
  children.push(CheckboxLine("Have you ever filed for bankruptcy?"));
  children.push(CheckboxLine("Have you ever been convicted of a felony?"));

  children.push(H2("REFERENCES"));
  children.push(MultiFieldLine(["Reference 1:", "Phone:", "Relationship:"]));
  children.push(MultiFieldLine(["Reference 2:", "Phone:", "Relationship:"]));

  children.push(H2("AUTHORIZATION & CERTIFICATION"));
  children.push(P("I certify that all information provided is true and complete. I authorize the landlord and their agents to verify all information, including obtaining credit reports, criminal background checks, and contacting employers and references. I understand that providing false information is grounds for rejection or termination of tenancy.", { size: 18 }));

  children.push(HR());

  children.push(P("APPLICANT:", { bold: true }));
  children.push(SignatureLine("Signature:"));
  children.push(SignatureLine("Print Name:"));
  children.push(SignatureLine("Date:"));

  children.push(P("CO-APPLICANT:", { bold: true }));
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
    console.log(`📝 Blank application DOCX generated successfully in ${Date.now() - startTime}ms (${buffer.length} bytes)`);
    return Buffer.from(buffer);
  } catch (error) {
    console.error('📝 Error generating blank application DOCX:', error);
    throw error;
  }
}

export async function generateBlankApplicationPdf(options: BlankApplicationOptions): Promise<Buffer> {
  const { templateTitle, stateId, version = 1, updatedAt = new Date() } = options;

  const htmlContent = generateBlankApplicationHTML(templateTitle, stateId, version, updatedAt);

  let chromiumPath = '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium';
  try {
    chromiumPath = execSync('which chromium').toString().trim();
    console.log('📄 Using Chromium at:', chromiumPath);
  } catch (e) {
    console.log('📄 Falling back to default Chromium path');
  }

  console.log('📄 Launching Chromium browser for blank application...');
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
      margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' },
    });

    console.log(`📄 PDF generated successfully in ${Date.now() - startTime}ms`);
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

function generateBlankApplicationHTML(
  templateTitle: string,
  stateId: string,
  version: number,
  updatedAt: Date
): string {
  const safeTitle = escapeHtml(templateTitle);
  const stateName = STATE_NAMES[stateId] || stateId;
  const formattedDate = updatedAt.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
  <style>
    @page { size: Letter; margin: 0.5in; }
    * { box-sizing: border-box; }
    body { font-family: 'Arial', 'Helvetica', sans-serif; font-size: 10pt; line-height: 1.4; color: #000; margin: 0; padding: 0; }
    .header { text-align: center; border-bottom: 2px solid #1a1a1a; padding-bottom: 12pt; margin-bottom: 16pt; }
    .header h1 { font-size: 16pt; font-weight: bold; margin: 0 0 4pt 0; text-transform: uppercase; letter-spacing: 1pt; }
    .header .subtitle { font-size: 11pt; color: #333; margin: 0; }
    .header .state-info { font-size: 9pt; color: #666; margin-top: 6pt; }
    .section { margin-bottom: 16pt; }
    .section-title { font-size: 11pt; font-weight: bold; background-color: #f0f0f0; padding: 6pt 8pt; margin: 0 0 8pt 0; border-left: 3pt solid #333; }
    .field-row { display: flex; margin-bottom: 8pt; align-items: flex-end; }
    .field-row-2 { display: flex; gap: 16pt; margin-bottom: 8pt; }
    .field-row-3 { display: flex; gap: 12pt; margin-bottom: 8pt; }
    .field { flex: 1; }
    .field-label { font-size: 9pt; color: #333; margin-bottom: 2pt; }
    .field-line { border-bottom: 1pt solid #000; height: 18pt; min-width: 100pt; }
    .instructions { font-size: 9pt; color: #555; font-style: italic; margin-bottom: 12pt; padding: 8pt; background-color: #f9f9f9; border: 1pt solid #ddd; }
    .signature-section { margin-top: 24pt; page-break-inside: avoid; }
    .signature-line { border-bottom: 1pt solid #000; height: 30pt; margin-top: 24pt; }
    .signature-label { font-size: 9pt; color: #333; margin-top: 2pt; }
    .footer { margin-top: 20pt; padding-top: 8pt; border-top: 1pt solid #ccc; font-size: 8pt; color: #666; text-align: center; }
    .checkbox { width: 12pt; height: 12pt; border: 1pt solid #000; display: inline-block; margin-right: 3pt; vertical-align: middle; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Rental Application</h1>
    <p class="subtitle">${escapeHtml(stateName)} State-Specific Form</p>
    <p class="state-info">Version ${version} | Last Updated: ${formattedDate}</p>
  </div>

  <div class="instructions">
    <strong>Instructions:</strong> Please complete all sections. Incomplete applications may delay processing. All information will be verified.
  </div>

  <div class="section">
    <h2 class="section-title">PROPERTY INFORMATION</h2>
    <div class="field-row"><div class="field"><div class="field-label">Property Address:</div><div class="field-line"></div></div></div>
    <div class="field-row-3">
      <div class="field" style="flex: 0.4;"><div class="field-label">Unit #:</div><div class="field-line"></div></div>
      <div class="field"><div class="field-label">Desired Move-In Date:</div><div class="field-line"></div></div>
      <div class="field"><div class="field-label">Monthly Rent: $</div><div class="field-line"></div></div>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">APPLICANT INFORMATION</h2>
    <div class="field-row"><div class="field"><div class="field-label">Full Legal Name:</div><div class="field-line"></div></div></div>
    <div class="field-row-3">
      <div class="field"><div class="field-label">Date of Birth:</div><div class="field-line"></div></div>
      <div class="field"><div class="field-label">SSN:</div><div class="field-line"></div></div>
      <div class="field"><div class="field-label">Driver's License #:</div><div class="field-line"></div></div>
    </div>
    <div class="field-row-2">
      <div class="field"><div class="field-label">Phone:</div><div class="field-line"></div></div>
      <div class="field"><div class="field-label">Email:</div><div class="field-line"></div></div>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">CURRENT RESIDENCE</h2>
    <div class="field-row"><div class="field"><div class="field-label">Current Address:</div><div class="field-line"></div></div></div>
    <div class="field-row-3">
      <div class="field"><div class="field-label">City:</div><div class="field-line"></div></div>
      <div class="field" style="flex: 0.3;"><div class="field-label">State:</div><div class="field-line"></div></div>
      <div class="field" style="flex: 0.4;"><div class="field-label">ZIP:</div><div class="field-line"></div></div>
    </div>
    <div class="field-row-2">
      <div class="field"><div class="field-label">Monthly Rent: $</div><div class="field-line"></div></div>
      <div class="field"><div class="field-label">Length of Residency:</div><div class="field-line"></div></div>
    </div>
    <div class="field-row-2">
      <div class="field"><div class="field-label">Landlord Name:</div><div class="field-line"></div></div>
      <div class="field"><div class="field-label">Phone:</div><div class="field-line"></div></div>
    </div>
    <div class="field-row"><div class="field"><div class="field-label">Reason for Leaving:</div><div class="field-line"></div></div></div>
  </div>

  <div class="section">
    <h2 class="section-title">PREVIOUS RESIDENCE</h2>
    <div class="field-row"><div class="field"><div class="field-label">Previous Address:</div><div class="field-line"></div></div></div>
    <div class="field-row-3">
      <div class="field"><div class="field-label">City:</div><div class="field-line"></div></div>
      <div class="field" style="flex: 0.3;"><div class="field-label">State:</div><div class="field-line"></div></div>
      <div class="field" style="flex: 0.4;"><div class="field-label">ZIP:</div><div class="field-line"></div></div>
    </div>
    <div class="field-row-2">
      <div class="field"><div class="field-label">Monthly Rent: $</div><div class="field-line"></div></div>
      <div class="field"><div class="field-label">Length of Residency:</div><div class="field-line"></div></div>
    </div>
    <div class="field-row-2">
      <div class="field"><div class="field-label">Landlord Name:</div><div class="field-line"></div></div>
      <div class="field"><div class="field-label">Phone:</div><div class="field-line"></div></div>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">EMPLOYMENT INFORMATION</h2>
    <div class="field-row"><div class="field"><div class="field-label">Current Employer:</div><div class="field-line"></div></div></div>
    <div class="field-row"><div class="field"><div class="field-label">Employer Address:</div><div class="field-line"></div></div></div>
    <div class="field-row-2">
      <div class="field"><div class="field-label">Position/Title:</div><div class="field-line"></div></div>
      <div class="field"><div class="field-label">Length of Employment:</div><div class="field-line"></div></div>
    </div>
    <div class="field-row-2">
      <div class="field"><div class="field-label">Supervisor Name:</div><div class="field-line"></div></div>
      <div class="field"><div class="field-label">Phone:</div><div class="field-line"></div></div>
    </div>
    <div class="field-row-2">
      <div class="field"><div class="field-label">Monthly Gross Income: $</div><div class="field-line"></div></div>
      <div class="field"><div class="field-label">Additional Income: $</div><div class="field-line"></div></div>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">EMERGENCY CONTACT</h2>
    <div class="field-row-2">
      <div class="field"><div class="field-label">Name:</div><div class="field-line"></div></div>
      <div class="field"><div class="field-label">Relationship:</div><div class="field-line"></div></div>
    </div>
    <div class="field-row-2">
      <div class="field"><div class="field-label">Phone:</div><div class="field-line"></div></div>
      <div class="field"><div class="field-label">Address:</div><div class="field-line"></div></div>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">ADDITIONAL OCCUPANTS</h2>
    <p style="font-size: 9pt; margin-bottom: 6pt;">List all persons who will occupy the premises:</p>
    <div class="field-row-3">
      <div class="field"><div class="field-label">Name:</div><div class="field-line"></div></div>
      <div class="field"><div class="field-label">Relationship:</div><div class="field-line"></div></div>
      <div class="field" style="flex: 0.4;"><div class="field-label">Age:</div><div class="field-line"></div></div>
    </div>
    <div class="field-row-3">
      <div class="field"><div class="field-label">Name:</div><div class="field-line"></div></div>
      <div class="field"><div class="field-label">Relationship:</div><div class="field-line"></div></div>
      <div class="field" style="flex: 0.4;"><div class="field-label">Age:</div><div class="field-line"></div></div>
    </div>
    <div class="field-row-3">
      <div class="field"><div class="field-label">Name:</div><div class="field-line"></div></div>
      <div class="field"><div class="field-label">Relationship:</div><div class="field-line"></div></div>
      <div class="field" style="flex: 0.4;"><div class="field-label">Age:</div><div class="field-line"></div></div>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">PETS</h2>
    <div class="field-row">
      <div>[ ] Yes  [ ] No   Do you have pets?</div>
    </div>
    <div class="field-row"><div class="field"><div class="field-label">If yes, describe (type, breed, weight):</div><div class="field-line"></div></div></div>
  </div>

  <div class="section">
    <h2 class="section-title">BACKGROUND QUESTIONS</h2>
    <div class="field-row">
      <div>[ ] Yes  [ ] No   Have you ever been evicted?</div>
    </div>
    <div class="field-row"><div class="field"><div class="field-label">If yes, explain:</div><div class="field-line"></div></div></div>
    <div class="field-row">
      <div>[ ] Yes  [ ] No   Have you ever filed for bankruptcy?</div>
    </div>
    <div class="field-row">
      <div>[ ] Yes  [ ] No   Have you ever been convicted of a felony?</div>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">REFERENCES</h2>
    <div class="field-row-3">
      <div class="field"><div class="field-label">Reference 1:</div><div class="field-line"></div></div>
      <div class="field"><div class="field-label">Phone:</div><div class="field-line"></div></div>
      <div class="field"><div class="field-label">Relationship:</div><div class="field-line"></div></div>
    </div>
    <div class="field-row-3">
      <div class="field"><div class="field-label">Reference 2:</div><div class="field-line"></div></div>
      <div class="field"><div class="field-label">Phone:</div><div class="field-line"></div></div>
      <div class="field"><div class="field-label">Relationship:</div><div class="field-line"></div></div>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">AUTHORIZATION & CERTIFICATION</h2>
    <p style="font-size: 9pt;">I certify that all information provided is true and complete. I authorize the landlord and their agents to verify all information, including obtaining credit reports, criminal background checks, and contacting employers and references. I understand that providing false information is grounds for rejection or termination of tenancy.</p>
  </div>

  <div class="signature-section">
    <p style="font-size: 9pt; font-weight: bold; margin-bottom: 4pt;">APPLICANT:</p>
    <div class="field-row-2">
      <div class="field" style="flex: 2;"><div class="signature-line"></div><div class="signature-label">Signature:</div></div>
      <div class="field" style="flex: 1;"><div class="signature-line"></div><div class="signature-label">Date:</div></div>
    </div>
    <div class="field-row">
      <div class="field"><div class="signature-line"></div><div class="signature-label">Print Name:</div></div>
    </div>
    <p style="font-size: 9pt; font-weight: bold; margin-top: 12pt; margin-bottom: 4pt;">CO-APPLICANT:</p>
    <div class="field-row-2">
      <div class="field" style="flex: 2;"><div class="signature-line"></div><div class="signature-label">Signature:</div></div>
      <div class="field" style="flex: 1;"><div class="signature-line"></div><div class="signature-label">Date:</div></div>
    </div>
    <div class="field-row">
      <div class="field"><div class="signature-line"></div><div class="signature-label">Print Name:</div></div>
    </div>
  </div>

  <div class="footer">For informational purposes only. Consult with a licensed attorney for legal advice.</div>
</body>
</html>`;
}
