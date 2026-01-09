import puppeteer from 'puppeteer';
import { execSync } from 'child_process';
import HTMLtoDOCX from 'html-to-docx';

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

export async function generateBlankApplicationDocx(options: BlankApplicationOptions): Promise<Buffer> {
  const { templateTitle, stateId, version = 1, updatedAt = new Date() } = options;

  console.log('📝 Generating blank application DOCX...');
  const startTime = Date.now();

  // Use simplified HTML for DOCX (no complex CSS like flexbox)
  const htmlContent = generateSimplifiedApplicationHTMLForDOCX(templateTitle, stateId, version, updatedAt);

  try {
    const docxBuffer = await HTMLtoDOCX(htmlContent, null, {
      table: { row: { cantSplit: true } },
      margins: {
        top: 720,
        right: 720,
        bottom: 720,
        left: 720,
      },
    });

    console.log(`📝 Blank application DOCX generated successfully in ${Date.now() - startTime}ms`);
    return Buffer.from(docxBuffer);
  } catch (error) {
    console.error('📝 Error generating blank application DOCX:', error);
    throw error;
  }
}

// Simplified HTML for DOCX that avoids complex CSS (no flex, uses tables instead)
function generateSimplifiedApplicationHTMLForDOCX(
  templateTitle: string,
  stateId: string,
  version: number,
  updatedAt: Date
): string {
  const safeTitle = escapeHtml(templateTitle);
  const stateName = STATE_NAMES[stateId] || stateId;
  const formattedDate = updatedAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${safeTitle}</title>
</head>
<body style="font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.5;">
  <h1 style="text-align: center; text-transform: uppercase;">RENTAL APPLICATION</h1>
  <p style="text-align: center;">${stateName} - Version ${version}</p>
  <p style="text-align: center; font-size: 9pt;">Last Updated: ${formattedDate}</p>
  
  <hr>
  
  <p style="font-size: 9pt;"><strong>Instructions:</strong> Please complete all sections. Incomplete applications may delay processing. All information will be verified.</p>
  
  <h2 style="background-color: #f0f0f0; padding: 5px;">PROPERTY INFORMATION</h2>
  <table style="width: 100%;">
    <tr><td>Property Address: _________________________________________________________________</td></tr>
    <tr><td>Unit #: _________________ Desired Move-In Date: _________________ Monthly Rent: $_________________</td></tr>
  </table>
  
  <h2 style="background-color: #f0f0f0; padding: 5px;">APPLICANT INFORMATION</h2>
  <table style="width: 100%;">
    <tr><td>Full Legal Name: _________________________________________________________________</td></tr>
    <tr><td>Date of Birth: _________________ Social Security Number: _________________ Driver's License #: _________________</td></tr>
    <tr><td>Phone: _________________ Email: _________________________________________________________________</td></tr>
  </table>
  
  <h2 style="background-color: #f0f0f0; padding: 5px;">CURRENT RESIDENCE</h2>
  <table style="width: 100%;">
    <tr><td>Current Address: _________________________________________________________________</td></tr>
    <tr><td>City: _________________________ State: _________ ZIP: _________________</td></tr>
    <tr><td>Monthly Rent: $_________________ Length of Residency: _________________</td></tr>
    <tr><td>Landlord Name: _________________________________ Phone: _________________________________</td></tr>
    <tr><td>Reason for Leaving: _________________________________________________________________</td></tr>
  </table>
  
  <h2 style="background-color: #f0f0f0; padding: 5px;">PREVIOUS RESIDENCE</h2>
  <table style="width: 100%;">
    <tr><td>Previous Address: _________________________________________________________________</td></tr>
    <tr><td>City: _________________________ State: _________ ZIP: _________________</td></tr>
    <tr><td>Monthly Rent: $_________________ Length of Residency: _________________</td></tr>
    <tr><td>Landlord Name: _________________________________ Phone: _________________________________</td></tr>
  </table>
  
  <h2 style="background-color: #f0f0f0; padding: 5px;">EMPLOYMENT INFORMATION</h2>
  <table style="width: 100%;">
    <tr><td>Current Employer: _________________________________________________________________</td></tr>
    <tr><td>Employer Address: _________________________________________________________________</td></tr>
    <tr><td>Position/Title: _________________________________ Length of Employment: _________________</td></tr>
    <tr><td>Supervisor Name: _________________________________ Phone: _________________________________</td></tr>
    <tr><td>Monthly Gross Income: $_________________ Additional Income (if any): $_________________</td></tr>
  </table>
  
  <h2 style="background-color: #f0f0f0; padding: 5px;">EMERGENCY CONTACT</h2>
  <table style="width: 100%;">
    <tr><td>Name: _________________________________ Relationship: _________________________________</td></tr>
    <tr><td>Phone: _________________________________ Address: _________________________________</td></tr>
  </table>
  
  <h2 style="background-color: #f0f0f0; padding: 5px;">ADDITIONAL OCCUPANTS</h2>
  <table style="width: 100%; border-collapse: collapse;">
    <tr style="background-color: #e0e0e0;">
      <th style="border: 1px solid #ccc; padding: 5px;">Name</th>
      <th style="border: 1px solid #ccc; padding: 5px;">Relationship</th>
      <th style="border: 1px solid #ccc; padding: 5px;">Age</th>
    </tr>
    <tr><td style="border: 1px solid #ccc; padding: 5px;"></td><td style="border: 1px solid #ccc; padding: 5px;"></td><td style="border: 1px solid #ccc; padding: 5px;"></td></tr>
    <tr><td style="border: 1px solid #ccc; padding: 5px;"></td><td style="border: 1px solid #ccc; padding: 5px;"></td><td style="border: 1px solid #ccc; padding: 5px;"></td></tr>
    <tr><td style="border: 1px solid #ccc; padding: 5px;"></td><td style="border: 1px solid #ccc; padding: 5px;"></td><td style="border: 1px solid #ccc; padding: 5px;"></td></tr>
  </table>
  
  <h2 style="background-color: #f0f0f0; padding: 5px;">PETS</h2>
  <p>Do you have pets? [ ] Yes [ ] No</p>
  <p>If yes, describe (type, breed, weight): _________________________________________________________________</p>
  
  <h2 style="background-color: #f0f0f0; padding: 5px;">BACKGROUND QUESTIONS</h2>
  <p>Have you ever been evicted? [ ] Yes [ ] No &nbsp;&nbsp; If yes, explain: _________________________________</p>
  <p>Have you ever filed for bankruptcy? [ ] Yes [ ] No</p>
  <p>Have you ever been convicted of a felony? [ ] Yes [ ] No</p>
  
  <h2 style="background-color: #f0f0f0; padding: 5px;">REFERENCES</h2>
  <table style="width: 100%;">
    <tr><td>Reference 1: _________________________________ Phone: _________________________________ Relationship: _____________</td></tr>
    <tr><td>Reference 2: _________________________________ Phone: _________________________________ Relationship: _____________</td></tr>
  </table>
  
  <h2 style="background-color: #f0f0f0; padding: 5px;">AUTHORIZATION & CERTIFICATION</h2>
  <p style="font-size: 9pt;">I certify that all information provided is true and complete. I authorize the landlord and their agents to verify all information, including obtaining credit reports, criminal background checks, and contacting employers and references. I understand that providing false information is grounds for rejection or termination of tenancy.</p>
  
  <table style="width: 100%; margin-top: 30px;">
    <tr>
      <td style="width: 50%;">
        <p>Applicant Signature: _________________________</p>
        <p>Print Name: _________________________</p>
        <p>Date: _________________________</p>
      </td>
      <td>
        <p>Co-Applicant Signature: _________________________</p>
        <p>Print Name: _________________________</p>
        <p>Date: _________________________</p>
      </td>
    </tr>
  </table>
  
  <hr style="margin-top: 20px;">
  <p style="font-size: 9pt; text-align: center;">Generated by LeaseShield - Protecting Landlords with State-Compliant Documents</p>
</body>
</html>
`;
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
