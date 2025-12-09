import puppeteer from 'puppeteer';
import { execSync } from 'child_process';

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
    @page {
      size: Letter;
      margin: 0.5in;
    }
    
    * {
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Arial', 'Helvetica', sans-serif;
      font-size: 10pt;
      line-height: 1.4;
      color: #000;
      margin: 0;
      padding: 0;
    }
    
    .header {
      text-align: center;
      border-bottom: 2px solid #1a1a1a;
      padding-bottom: 12pt;
      margin-bottom: 16pt;
    }
    
    .header h1 {
      font-size: 16pt;
      font-weight: bold;
      margin: 0 0 4pt 0;
      text-transform: uppercase;
      letter-spacing: 1pt;
    }
    
    .header .subtitle {
      font-size: 11pt;
      color: #333;
      margin: 0;
    }
    
    .header .state-info {
      font-size: 9pt;
      color: #666;
      margin-top: 6pt;
    }
    
    .section {
      margin-bottom: 16pt;
    }
    
    .section-title {
      font-size: 11pt;
      font-weight: bold;
      background-color: #f0f0f0;
      padding: 6pt 8pt;
      margin: 0 0 8pt 0;
      border-left: 3pt solid #333;
    }
    
    .field-row {
      display: flex;
      margin-bottom: 8pt;
      align-items: flex-end;
    }
    
    .field-row-2 {
      display: flex;
      gap: 16pt;
      margin-bottom: 8pt;
    }
    
    .field-row-3 {
      display: flex;
      gap: 12pt;
      margin-bottom: 8pt;
    }
    
    .field {
      flex: 1;
    }
    
    .field-label {
      font-size: 9pt;
      color: #333;
      margin-bottom: 2pt;
    }
    
    .field-line {
      border-bottom: 1pt solid #000;
      height: 18pt;
      min-width: 100pt;
    }
    
    .field-line-short {
      border-bottom: 1pt solid #000;
      height: 18pt;
      width: 80pt;
    }
    
    .field-line-long {
      border-bottom: 1pt solid #000;
      height: 18pt;
      flex: 1;
    }
    
    .checkbox-group {
      display: flex;
      gap: 16pt;
      flex-wrap: wrap;
    }
    
    .checkbox-item {
      display: flex;
      align-items: center;
      gap: 4pt;
    }
    
    .checkbox {
      width: 12pt;
      height: 12pt;
      border: 1pt solid #000;
      display: inline-block;
    }
    
    .instructions {
      font-size: 9pt;
      color: #555;
      font-style: italic;
      margin-bottom: 12pt;
      padding: 8pt;
      background-color: #f9f9f9;
      border: 1pt solid #ddd;
    }
    
    .signature-section {
      margin-top: 24pt;
      page-break-inside: avoid;
    }
    
    .signature-line {
      border-bottom: 1pt solid #000;
      height: 30pt;
      margin-top: 24pt;
    }
    
    .signature-label {
      font-size: 9pt;
      color: #333;
      margin-top: 2pt;
    }
    
    .footer {
      margin-top: 20pt;
      padding-top: 8pt;
      border-top: 1pt solid #ccc;
      font-size: 8pt;
      color: #666;
      text-align: center;
    }
    
    .text-area {
      border: 1pt solid #000;
      min-height: 60pt;
      margin-top: 4pt;
    }
    
    .disclosure {
      font-size: 8pt;
      color: #444;
      margin-top: 16pt;
      padding: 8pt;
      background-color: #fafafa;
      border: 1pt solid #eee;
    }

    .inline-field {
      display: inline-flex;
      align-items: flex-end;
      gap: 4pt;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Rental Application</h1>
    <p class="subtitle">${escapeHtml(stateName)} State-Specific Form</p>
    <p class="state-info">Version ${version} | Last Updated: ${formattedDate}</p>
  </div>

  <div class="instructions">
    <strong>Instructions:</strong> Complete all sections. Provide accurate information. False statements may result in denial of application or termination of tenancy. This application will be used to obtain a consumer credit report and/or background check.
  </div>

  <div class="section">
    <h2 class="section-title">Property Information</h2>
    <div class="field-row-2">
      <div class="field">
        <div class="field-label">Property Address</div>
        <div class="field-line"></div>
      </div>
      <div class="field" style="flex: 0.4;">
        <div class="field-label">Unit #</div>
        <div class="field-line"></div>
      </div>
    </div>
    <div class="field-row-3">
      <div class="field">
        <div class="field-label">City</div>
        <div class="field-line"></div>
      </div>
      <div class="field" style="flex: 0.3;">
        <div class="field-label">State</div>
        <div class="field-line"></div>
      </div>
      <div class="field" style="flex: 0.4;">
        <div class="field-label">ZIP Code</div>
        <div class="field-line"></div>
      </div>
    </div>
    <div class="field-row-2">
      <div class="field">
        <div class="field-label">Monthly Rent Amount</div>
        <div class="field-line"></div>
      </div>
      <div class="field">
        <div class="field-label">Desired Move-In Date</div>
        <div class="field-line"></div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">Applicant Information</h2>
    <div class="field-row-3">
      <div class="field">
        <div class="field-label">First Name</div>
        <div class="field-line"></div>
      </div>
      <div class="field" style="flex: 0.5;">
        <div class="field-label">Middle</div>
        <div class="field-line"></div>
      </div>
      <div class="field">
        <div class="field-label">Last Name</div>
        <div class="field-line"></div>
      </div>
    </div>
    <div class="field-row-3">
      <div class="field">
        <div class="field-label">Date of Birth</div>
        <div class="field-line"></div>
      </div>
      <div class="field">
        <div class="field-label">Social Security Number</div>
        <div class="field-line"></div>
      </div>
      <div class="field">
        <div class="field-label">Driver's License # / State</div>
        <div class="field-line"></div>
      </div>
    </div>
    <div class="field-row-2">
      <div class="field">
        <div class="field-label">Phone Number</div>
        <div class="field-line"></div>
      </div>
      <div class="field">
        <div class="field-label">Email Address</div>
        <div class="field-line"></div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">Current Residence</h2>
    <div class="field-row">
      <div class="field">
        <div class="field-label">Current Address</div>
        <div class="field-line"></div>
      </div>
    </div>
    <div class="field-row-3">
      <div class="field">
        <div class="field-label">City</div>
        <div class="field-line"></div>
      </div>
      <div class="field" style="flex: 0.3;">
        <div class="field-label">State</div>
        <div class="field-line"></div>
      </div>
      <div class="field" style="flex: 0.4;">
        <div class="field-label">ZIP Code</div>
        <div class="field-line"></div>
      </div>
    </div>
    <div class="field-row-3">
      <div class="field">
        <div class="field-label">Monthly Rent/Mortgage</div>
        <div class="field-line"></div>
      </div>
      <div class="field">
        <div class="field-label">Move-In Date</div>
        <div class="field-line"></div>
      </div>
      <div class="field">
        <div class="field-label">Move-Out Date</div>
        <div class="field-line"></div>
      </div>
    </div>
    <div class="field-row-2">
      <div class="field">
        <div class="field-label">Landlord/Property Manager Name</div>
        <div class="field-line"></div>
      </div>
      <div class="field">
        <div class="field-label">Landlord Phone</div>
        <div class="field-line"></div>
      </div>
    </div>
    <div class="field-row">
      <div class="field">
        <div class="field-label">Reason for Leaving</div>
        <div class="field-line"></div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">Previous Residence (if less than 2 years at current address)</h2>
    <div class="field-row">
      <div class="field">
        <div class="field-label">Previous Address</div>
        <div class="field-line"></div>
      </div>
    </div>
    <div class="field-row-3">
      <div class="field">
        <div class="field-label">City</div>
        <div class="field-line"></div>
      </div>
      <div class="field" style="flex: 0.3;">
        <div class="field-label">State</div>
        <div class="field-line"></div>
      </div>
      <div class="field" style="flex: 0.4;">
        <div class="field-label">ZIP Code</div>
        <div class="field-line"></div>
      </div>
    </div>
    <div class="field-row-2">
      <div class="field">
        <div class="field-label">Landlord/Property Manager Name</div>
        <div class="field-line"></div>
      </div>
      <div class="field">
        <div class="field-label">Landlord Phone</div>
        <div class="field-line"></div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">Employment Information</h2>
    <div class="field-row-2">
      <div class="field">
        <div class="field-label">Current Employer</div>
        <div class="field-line"></div>
      </div>
      <div class="field">
        <div class="field-label">Position/Title</div>
        <div class="field-line"></div>
      </div>
    </div>
    <div class="field-row">
      <div class="field">
        <div class="field-label">Employer Address</div>
        <div class="field-line"></div>
      </div>
    </div>
    <div class="field-row-3">
      <div class="field">
        <div class="field-label">Supervisor Name</div>
        <div class="field-line"></div>
      </div>
      <div class="field">
        <div class="field-label">Supervisor Phone</div>
        <div class="field-line"></div>
      </div>
      <div class="field">
        <div class="field-label">Employment Start Date</div>
        <div class="field-line"></div>
      </div>
    </div>
    <div class="field-row-2">
      <div class="field">
        <div class="field-label">Gross Monthly Income</div>
        <div class="field-line"></div>
      </div>
      <div class="field">
        <div class="field-label">Other Income (Source & Amount)</div>
        <div class="field-line"></div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">Emergency Contact</h2>
    <div class="field-row-3">
      <div class="field">
        <div class="field-label">Name</div>
        <div class="field-line"></div>
      </div>
      <div class="field">
        <div class="field-label">Relationship</div>
        <div class="field-line"></div>
      </div>
      <div class="field">
        <div class="field-label">Phone</div>
        <div class="field-line"></div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">Additional Occupants</h2>
    <div class="field-row-3">
      <div class="field">
        <div class="field-label">Name</div>
        <div class="field-line"></div>
      </div>
      <div class="field">
        <div class="field-label">Relationship</div>
        <div class="field-line"></div>
      </div>
      <div class="field" style="flex: 0.4;">
        <div class="field-label">Age</div>
        <div class="field-line"></div>
      </div>
    </div>
    <div class="field-row-3">
      <div class="field">
        <div class="field-label">Name</div>
        <div class="field-line"></div>
      </div>
      <div class="field">
        <div class="field-label">Relationship</div>
        <div class="field-line"></div>
      </div>
      <div class="field" style="flex: 0.4;">
        <div class="field-label">Age</div>
        <div class="field-line"></div>
      </div>
    </div>
    <div class="field-row-3">
      <div class="field">
        <div class="field-label">Name</div>
        <div class="field-line"></div>
      </div>
      <div class="field">
        <div class="field-label">Relationship</div>
        <div class="field-line"></div>
      </div>
      <div class="field" style="flex: 0.4;">
        <div class="field-label">Age</div>
        <div class="field-line"></div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">Pets</h2>
    <div style="margin-bottom: 8pt;">
      <span style="margin-right: 16pt;"><span class="checkbox"></span> No pets</span>
      <span><span class="checkbox"></span> Yes, I have pets (describe below)</span>
    </div>
    <div class="field-row-3">
      <div class="field">
        <div class="field-label">Pet Type/Breed</div>
        <div class="field-line"></div>
      </div>
      <div class="field" style="flex: 0.4;">
        <div class="field-label">Weight</div>
        <div class="field-line"></div>
      </div>
      <div class="field" style="flex: 0.4;">
        <div class="field-label">Age</div>
        <div class="field-line"></div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">Vehicle Information</h2>
    <div class="field-row-3">
      <div class="field">
        <div class="field-label">Make/Model</div>
        <div class="field-line"></div>
      </div>
      <div class="field" style="flex: 0.4;">
        <div class="field-label">Year</div>
        <div class="field-line"></div>
      </div>
      <div class="field">
        <div class="field-label">License Plate / State</div>
        <div class="field-line"></div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">Background Questions</h2>
    <div style="margin-bottom: 6pt; font-size: 9pt;">
      Have you ever been evicted or asked to leave a rental property? <span style="margin-left: 12pt;"><span class="checkbox"></span> Yes <span style="margin-left: 8pt;"><span class="checkbox"></span> No</span></span>
    </div>
    <div style="margin-bottom: 6pt; font-size: 9pt;">
      Have you ever filed for bankruptcy? <span style="margin-left: 12pt;"><span class="checkbox"></span> Yes <span style="margin-left: 8pt;"><span class="checkbox"></span> No</span></span>
    </div>
    <div style="margin-bottom: 6pt; font-size: 9pt;">
      Have you ever been convicted of a felony? <span style="margin-left: 12pt;"><span class="checkbox"></span> Yes <span style="margin-left: 8pt;"><span class="checkbox"></span> No</span></span>
    </div>
    <div style="margin-top: 8pt;">
      <div class="field-label">If you answered "Yes" to any question above, please explain:</div>
      <div class="text-area"></div>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">References</h2>
    <div class="field-row-3">
      <div class="field">
        <div class="field-label">Reference Name</div>
        <div class="field-line"></div>
      </div>
      <div class="field">
        <div class="field-label">Relationship</div>
        <div class="field-line"></div>
      </div>
      <div class="field">
        <div class="field-label">Phone</div>
        <div class="field-line"></div>
      </div>
    </div>
    <div class="field-row-3">
      <div class="field">
        <div class="field-label">Reference Name</div>
        <div class="field-line"></div>
      </div>
      <div class="field">
        <div class="field-label">Relationship</div>
        <div class="field-line"></div>
      </div>
      <div class="field">
        <div class="field-label">Phone</div>
        <div class="field-line"></div>
      </div>
    </div>
  </div>

  <div class="disclosure">
    <strong>Authorization and Consent:</strong> I hereby authorize the landlord/property manager to obtain a consumer credit report, criminal background check, eviction history, and to verify employment, rental history, and references. I understand that false or misleading information may result in denial of this application or termination of any resulting tenancy. I certify that all information provided is true and complete.
  </div>

  <div class="signature-section">
    <div class="field-row-2">
      <div class="field" style="flex: 2;">
        <div class="signature-line"></div>
        <div class="signature-label">Applicant Signature</div>
      </div>
      <div class="field" style="flex: 1;">
        <div class="signature-line"></div>
        <div class="signature-label">Date</div>
      </div>
    </div>
    <div class="field-row-2" style="margin-top: 16pt;">
      <div class="field" style="flex: 2;">
        <div class="signature-line"></div>
        <div class="signature-label">Printed Name</div>
      </div>
      <div class="field" style="flex: 1;">
        <div class="signature-line"></div>
        <div class="signature-label">Application Fee Paid</div>
      </div>
    </div>
  </div>

  <div class="footer">
    <p>LeaseShield | State-Compliant ${escapeHtml(stateName)} Rental Application | Version ${version}</p>
    <p>This form is provided for informational purposes. Consult with a licensed attorney for legal advice.</p>
  </div>
</body>
</html>
`;
}
