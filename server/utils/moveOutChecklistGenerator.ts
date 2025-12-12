import puppeteer from 'puppeteer';
import { execSync } from 'child_process';

interface MoveOutChecklistOptions {
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

export async function generateMoveOutChecklistPdf(options: MoveOutChecklistOptions): Promise<Buffer> {
  const { templateTitle, stateId, version = 1, updatedAt = new Date() } = options;

  const htmlContent = generateMoveOutChecklistHTML(templateTitle, stateId, version, updatedAt);

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
      margin: 0.4in;
    }
    
    * {
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Arial', 'Helvetica', sans-serif;
      font-size: 9pt;
      line-height: 1.3;
      color: #000;
      margin: 0;
      padding: 0;
    }
    
    .header {
      text-align: center;
      border-bottom: 2px solid #1a1a1a;
      padding-bottom: 10pt;
      margin-bottom: 12pt;
    }
    
    .header h1 {
      font-size: 14pt;
      font-weight: bold;
      margin: 0 0 4pt 0;
      text-transform: uppercase;
      letter-spacing: 1pt;
    }
    
    .header .subtitle {
      font-size: 10pt;
      color: #333;
      margin: 0;
    }
    
    .header .state-info {
      font-size: 8pt;
      color: #666;
      margin-top: 4pt;
    }
    
    .section {
      margin-bottom: 12pt;
    }
    
    .section-title {
      font-size: 10pt;
      font-weight: bold;
      background-color: #f0f0f0;
      padding: 5pt 6pt;
      margin: 0 0 6pt 0;
      border-left: 3pt solid #333;
    }
    
    .field-row {
      display: flex;
      margin-bottom: 6pt;
      align-items: flex-end;
      gap: 8pt;
    }
    
    .field {
      flex: 1;
    }
    
    .field-label {
      font-size: 8pt;
      color: #333;
      margin-bottom: 2pt;
    }
    
    .field-line {
      border-bottom: 1pt solid #000;
      height: 16pt;
      min-width: 80pt;
    }
    
    .instructions {
      font-size: 8pt;
      color: #444;
      margin-bottom: 10pt;
      padding: 6pt;
      background-color: #f9f9f9;
      border: 1pt solid #ddd;
    }
    
    .room-section {
      margin-bottom: 10pt;
      border: 1pt solid #ccc;
      padding: 6pt;
    }
    
    .room-title {
      font-size: 9pt;
      font-weight: bold;
      margin-bottom: 6pt;
      padding-bottom: 3pt;
      border-bottom: 1pt solid #ddd;
    }
    
    .checklist-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8pt;
    }
    
    .checklist-table th {
      background-color: #f5f5f5;
      padding: 4pt;
      text-align: left;
      border: 1pt solid #ccc;
      font-weight: bold;
    }
    
    .checklist-table td {
      padding: 4pt;
      border: 1pt solid #ccc;
      vertical-align: top;
    }
    
    .checklist-table .item-col {
      width: 30%;
    }
    
    .checklist-table .condition-col {
      width: 15%;
      text-align: center;
    }
    
    .checklist-table .notes-col {
      width: 40%;
    }
    
    .checkbox {
      width: 10pt;
      height: 10pt;
      border: 1pt solid #000;
      display: inline-block;
      margin-right: 3pt;
      vertical-align: middle;
    }
    
    .condition-options {
      display: flex;
      justify-content: space-around;
      font-size: 7pt;
    }
    
    .condition-option {
      text-align: center;
    }
    
    .signature-section {
      margin-top: 16pt;
      page-break-inside: avoid;
    }
    
    .signature-line {
      border-bottom: 1pt solid #000;
      height: 24pt;
      margin-top: 16pt;
    }
    
    .signature-label {
      font-size: 8pt;
      color: #333;
      margin-top: 2pt;
    }
    
    .footer {
      margin-top: 14pt;
      padding-top: 6pt;
      border-top: 1pt solid #ccc;
      font-size: 7pt;
      color: #666;
      text-align: center;
    }
    
    .legend {
      font-size: 7pt;
      color: #444;
      margin-bottom: 8pt;
      padding: 4pt 6pt;
      background-color: #fafafa;
      border: 1pt solid #eee;
    }
    
    .notes-area {
      border: 1pt solid #000;
      min-height: 40pt;
      margin-top: 4pt;
    }
    
    .compact-table td, .compact-table th {
      padding: 3pt 4pt;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Move-Out Inspection Checklist</h1>
    <p class="subtitle">${escapeHtml(stateName)} Property Inspection Form</p>
    <p class="state-info">Version ${version} | Last Updated: ${formattedDate}</p>
  </div>

  <div class="instructions">
    <strong>Instructions:</strong> Complete this checklist during the final walkthrough before tenant move-out. Document the condition of each area and note any damages beyond normal wear and tear. Both landlord and tenant should sign upon completion.
  </div>

  <div class="section">
    <h2 class="section-title">Property Information</h2>
    <div class="field-row">
      <div class="field" style="flex: 2;">
        <div class="field-label">Property Address</div>
        <div class="field-line"></div>
      </div>
      <div class="field" style="flex: 0.5;">
        <div class="field-label">Unit #</div>
        <div class="field-line"></div>
      </div>
    </div>
    <div class="field-row">
      <div class="field">
        <div class="field-label">Tenant Name(s)</div>
        <div class="field-line"></div>
      </div>
      <div class="field">
        <div class="field-label">Inspection Date</div>
        <div class="field-line"></div>
      </div>
      <div class="field">
        <div class="field-label">Move-Out Date</div>
        <div class="field-line"></div>
      </div>
    </div>
  </div>

  <div class="legend">
    <strong>Condition Rating:</strong> G = Good (clean, no damage) | F = Fair (minor wear, normal use) | P = Poor (damage beyond normal wear) | N/A = Not Applicable
  </div>

  <!-- Living Room -->
  <div class="room-section">
    <div class="room-title">Living Room / Common Areas</div>
    <table class="checklist-table compact-table">
      <tr>
        <th class="item-col">Item</th>
        <th class="condition-col">Move-In</th>
        <th class="condition-col">Move-Out</th>
        <th class="notes-col">Damage/Notes</th>
      </tr>
      <tr><td>Walls & Paint</td><td></td><td></td><td></td></tr>
      <tr><td>Ceiling</td><td></td><td></td><td></td></tr>
      <tr><td>Flooring/Carpet</td><td></td><td></td><td></td></tr>
      <tr><td>Windows & Screens</td><td></td><td></td><td></td></tr>
      <tr><td>Window Coverings</td><td></td><td></td><td></td></tr>
      <tr><td>Light Fixtures</td><td></td><td></td><td></td></tr>
      <tr><td>Electrical Outlets</td><td></td><td></td><td></td></tr>
      <tr><td>Doors & Locks</td><td></td><td></td><td></td></tr>
    </table>
  </div>

  <!-- Kitchen -->
  <div class="room-section">
    <div class="room-title">Kitchen</div>
    <table class="checklist-table compact-table">
      <tr>
        <th class="item-col">Item</th>
        <th class="condition-col">Move-In</th>
        <th class="condition-col">Move-Out</th>
        <th class="notes-col">Damage/Notes</th>
      </tr>
      <tr><td>Walls & Paint</td><td></td><td></td><td></td></tr>
      <tr><td>Flooring</td><td></td><td></td><td></td></tr>
      <tr><td>Countertops</td><td></td><td></td><td></td></tr>
      <tr><td>Cabinets & Drawers</td><td></td><td></td><td></td></tr>
      <tr><td>Sink & Faucet</td><td></td><td></td><td></td></tr>
      <tr><td>Refrigerator</td><td></td><td></td><td></td></tr>
      <tr><td>Stove/Oven</td><td></td><td></td><td></td></tr>
      <tr><td>Dishwasher</td><td></td><td></td><td></td></tr>
      <tr><td>Microwave</td><td></td><td></td><td></td></tr>
      <tr><td>Exhaust Fan/Hood</td><td></td><td></td><td></td></tr>
    </table>
  </div>

  <!-- Bathroom(s) -->
  <div class="room-section">
    <div class="room-title">Bathroom(s)</div>
    <table class="checklist-table compact-table">
      <tr>
        <th class="item-col">Item</th>
        <th class="condition-col">Move-In</th>
        <th class="condition-col">Move-Out</th>
        <th class="notes-col">Damage/Notes</th>
      </tr>
      <tr><td>Walls & Paint</td><td></td><td></td><td></td></tr>
      <tr><td>Flooring</td><td></td><td></td><td></td></tr>
      <tr><td>Toilet</td><td></td><td></td><td></td></tr>
      <tr><td>Sink & Vanity</td><td></td><td></td><td></td></tr>
      <tr><td>Bathtub/Shower</td><td></td><td></td><td></td></tr>
      <tr><td>Faucets</td><td></td><td></td><td></td></tr>
      <tr><td>Mirror & Medicine Cabinet</td><td></td><td></td><td></td></tr>
      <tr><td>Exhaust Fan</td><td></td><td></td><td></td></tr>
      <tr><td>Towel Bars/Hardware</td><td></td><td></td><td></td></tr>
    </table>
  </div>

  <!-- Bedroom(s) -->
  <div class="room-section">
    <div class="room-title">Bedroom(s)</div>
    <table class="checklist-table compact-table">
      <tr>
        <th class="item-col">Item</th>
        <th class="condition-col">Move-In</th>
        <th class="condition-col">Move-Out</th>
        <th class="notes-col">Damage/Notes</th>
      </tr>
      <tr><td>Walls & Paint</td><td></td><td></td><td></td></tr>
      <tr><td>Ceiling</td><td></td><td></td><td></td></tr>
      <tr><td>Flooring/Carpet</td><td></td><td></td><td></td></tr>
      <tr><td>Windows & Screens</td><td></td><td></td><td></td></tr>
      <tr><td>Window Coverings</td><td></td><td></td><td></td></tr>
      <tr><td>Closet & Doors</td><td></td><td></td><td></td></tr>
      <tr><td>Light Fixtures</td><td></td><td></td><td></td></tr>
      <tr><td>Electrical Outlets</td><td></td><td></td><td></td></tr>
    </table>
  </div>

  <!-- Other Areas -->
  <div class="room-section">
    <div class="room-title">Other Areas (Garage, Patio, Storage, etc.)</div>
    <table class="checklist-table compact-table">
      <tr>
        <th class="item-col">Item</th>
        <th class="condition-col">Move-In</th>
        <th class="condition-col">Move-Out</th>
        <th class="notes-col">Damage/Notes</th>
      </tr>
      <tr><td>Garage Door/Opener</td><td></td><td></td><td></td></tr>
      <tr><td>Patio/Balcony</td><td></td><td></td><td></td></tr>
      <tr><td>Storage Areas</td><td></td><td></td><td></td></tr>
      <tr><td>Exterior Doors</td><td></td><td></td><td></td></tr>
      <tr><td>Mailbox</td><td></td><td></td><td></td></tr>
    </table>
  </div>

  <!-- General Items -->
  <div class="room-section">
    <div class="room-title">General Items</div>
    <table class="checklist-table compact-table">
      <tr>
        <th class="item-col">Item</th>
        <th class="condition-col">Move-In</th>
        <th class="condition-col">Move-Out</th>
        <th class="notes-col">Damage/Notes</th>
      </tr>
      <tr><td>HVAC System/Thermostat</td><td></td><td></td><td></td></tr>
      <tr><td>Water Heater</td><td></td><td></td><td></td></tr>
      <tr><td>Smoke Detectors</td><td></td><td></td><td></td></tr>
      <tr><td>Carbon Monoxide Detectors</td><td></td><td></td><td></td></tr>
      <tr><td>Keys Returned</td><td>N/A</td><td></td><td># of keys: ___</td></tr>
      <tr><td>Garage Remotes Returned</td><td>N/A</td><td></td><td># of remotes: ___</td></tr>
    </table>
  </div>

  <!-- Summary -->
  <div class="section">
    <h2 class="section-title">Inspection Summary</h2>
    <div style="margin-bottom: 6pt;">
      <div class="field-label">Additional Damages or Notes:</div>
      <div class="notes-area"></div>
    </div>
    <div class="field-row" style="margin-top: 8pt;">
      <div class="field">
        <div class="field-label">Estimated Repair/Cleaning Costs</div>
        <div class="field-line"></div>
      </div>
      <div class="field">
        <div class="field-label">Security Deposit Amount</div>
        <div class="field-line"></div>
      </div>
    </div>
    <div class="field-row">
      <div class="field">
        <div class="field-label">Deductions from Deposit</div>
        <div class="field-line"></div>
      </div>
      <div class="field">
        <div class="field-label">Amount to be Returned</div>
        <div class="field-line"></div>
      </div>
    </div>
  </div>

  <div class="signature-section">
    <div class="field-row">
      <div class="field" style="flex: 2;">
        <div class="signature-line"></div>
        <div class="signature-label">Landlord/Agent Signature</div>
      </div>
      <div class="field" style="flex: 1;">
        <div class="signature-line"></div>
        <div class="signature-label">Date</div>
      </div>
    </div>
    <div class="field-row" style="margin-top: 12pt;">
      <div class="field" style="flex: 2;">
        <div class="signature-line"></div>
        <div class="signature-label">Tenant Signature</div>
      </div>
      <div class="field" style="flex: 1;">
        <div class="signature-line"></div>
        <div class="signature-label">Date</div>
      </div>
    </div>
    <div style="margin-top: 8pt; font-size: 7pt; color: #666;">
      <span class="checkbox"></span> Tenant agrees with inspection findings
      <span style="margin-left: 16pt;"><span class="checkbox"></span> Tenant disagrees (see notes above)</span>
    </div>
  </div>

  <div class="footer">
    <p>LeaseShield | State-Compliant ${escapeHtml(stateName)} Move-Out Inspection Form | Version ${version}</p>
    <p>This form is provided for informational purposes. Consult with a licensed attorney for legal advice.</p>
  </div>
</body>
</html>
`;
}
