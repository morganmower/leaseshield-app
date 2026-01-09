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
  AlignmentType,
} from 'docx';
import { STATE_NAMES, H1, H2, H3, P, SignatureLine, HR, Footer, getStateDisclosures } from './docxBuilder';

interface FieldValue {
  [key: string]: string | number;
}

interface LandlordInfo {
  businessName?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

interface DocumentGenerationOptions {
  templateTitle: string;
  templateContent: string;
  fieldValues: FieldValue;
  stateId: string;
  version?: number;
  updatedAt?: Date;
  landlordInfo?: LandlordInfo;
}

// HTML escape function to prevent XSS/injection attacks
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/\//g, "&#x2F;");
}

export async function generateDocument(options: DocumentGenerationOptions): Promise<Buffer> {
  const { templateTitle, templateContent, fieldValues, stateId, version = 1, updatedAt = new Date(), landlordInfo } = options;

  // Create HTML content with filled fields
  const htmlContent = generateHTMLFromTemplate(templateTitle, templateContent, fieldValues, stateId, version, updatedAt, landlordInfo);

  // Launch headless browser
  // NOTE: Using system Chromium for stability in Replit environment.
  // Running in --no-sandbox mode for Replit environment compatibility.
  // Security is maintained through comprehensive HTML escaping of all user input.
  // All user input is HTML-escaped before rendering to prevent injection attacks.
  
  // Try to find Chromium executable dynamically
  let chromiumPath = '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium';
  try {
    chromiumPath = execSync('which chromium').toString().trim();
    console.log('📄 Using Chromium at:', chromiumPath);
  } catch (e) {
    console.log('📄 Falling back to default Chromium path');
  }
  
  console.log('📄 Launching Chromium browser...');
  const startTime = Date.now();
  
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: chromiumPath,
    timeout: 30000, // 30 second timeout for browser launch
    args: [
      '--no-sandbox', // Required for Replit containerized environment
      '--disable-setuid-sandbox', // Required for Replit containerized environment
      '--disable-dev-shm-usage', // Required for containerized environments
      '--disable-gpu', // Not needed for PDF generation
      '--single-process', // More stable in containerized environments
      '--no-zygote', // More stable in containerized environments
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
    
    // Set default timeouts for all operations
    page.setDefaultTimeout(30000); // 30 second default timeout
    page.setDefaultNavigationTimeout(15000); // 15 second navigation timeout
    
    // Set viewport for consistent rendering
    await page.setViewport({ width: 816, height: 1056 }); // Letter size at 96 DPI
    
    // Set content with faster loading - no external resources to wait for
    console.log('📄 Setting page content...');
    await page.setContent(htmlContent, { 
      waitUntil: 'domcontentloaded', // Faster than networkidle0 since we have no external resources
    });
    
    console.log(`📄 Page content set in ${Date.now() - startTime}ms`);

    // Generate PDF with professional attorney-quality margins (1 inch standard)
    const pdfBuffer = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: {
        top: '1in',
        right: '1in',
        bottom: '1in',
        left: '1in',
      },
    });
    
    console.log(`📄 PDF generated successfully in ${Date.now() - startTime}ms`);

    return Buffer.from(pdfBuffer);
  } catch (error) {
    console.error('📄 Error generating PDF:', error);
    throw error;
  } finally {
    await browser.close();
    console.log(`📄 Browser closed. Total time: ${Date.now() - startTime}ms`);
  }
}

export async function generateDocumentDOCX(options: DocumentGenerationOptions): Promise<Buffer> {
  const { templateTitle, templateContent, fieldValues, stateId, version = 1, updatedAt = new Date(), landlordInfo } = options;
  
  console.log('📝 Generating DOCX document with docx library...');
  const startTime = Date.now();
  
  const stateName = STATE_NAMES[stateId] || stateId;
  const formattedDate = updatedAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const getField = (key: string, defaultValue: string = '[_____________]'): string => {
    const value = fieldValues[key];
    if (value === undefined || value === null || value === '') {
      return defaultValue;
    }
    return String(value);
  };

  const children: Paragraph[] = [];

  if (landlordInfo?.businessName) {
    children.push(new Paragraph({
      children: [new TextRun({ text: landlordInfo.businessName, bold: true, size: 28 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
    }));
  }

  if (landlordInfo?.phoneNumber || landlordInfo?.email) {
    const contactParts: string[] = [];
    if (landlordInfo.phoneNumber) contactParts.push(landlordInfo.phoneNumber);
    if (landlordInfo.email) contactParts.push(landlordInfo.email);
    children.push(new Paragraph({
      children: [new TextRun({ text: contactParts.join(' | '), size: 20 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
    }));
  }

  children.push(H1(templateTitle.toUpperCase()));
  children.push(P(`State: ${stateName}`, { italic: true, center: true }));
  children.push(HR());

  children.push(P(`Document Version: ${version}`, { bold: true }));
  children.push(P(`Last Updated: ${formattedDate}`));
  children.push(P(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`));
  children.push(HR());

  children.push(H2("1. TERM OF LEASE"));
  children.push(P(`This Residential Lease Agreement ("Lease") is entered into as of ${getField('leaseStartDate', '[DATE]')} between the undersigned Landlord and Tenant(s) for the rental of the property located at ${getField('propertyAddress', '[ADDRESS]')}, ${getField('propertyCity', '[CITY]')}, ${stateId} ${getField('propertyZip', '[ZIP]')} ("Premises").`));
  children.push(P(`1.1 Lease Term: This Lease shall commence on ${getField('leaseStartDate', '[START DATE]')} and shall terminate on ${getField('leaseEndDate', '[END DATE]')}, unless earlier terminated or extended pursuant to the terms herein.`));
  children.push(P("1.2 Renewal Terms: Upon expiration of the initial term, this Lease shall convert to a month-to-month tenancy under the same terms and conditions until either party provides written notice of termination as required by applicable law."));

  children.push(H2("2. PARTIES"));
  children.push(P(`2.1 Landlord: ${getField('landlordName', '[LANDLORD NAME]')} ("Landlord") is the owner or authorized agent of the Premises and shall be responsible for all obligations of a landlord under applicable law.`));
  children.push(P(`2.2 Tenant(s): ${getField('tenantName', '[TENANT NAME]')} ("Tenant") shall be the only occupant(s) of the Premises unless otherwise agreed in writing. Tenant represents that all information provided in the rental application is true and accurate.`));
  children.push(P("2.3 Occupancy Limits: Total occupancy shall not exceed the maximum allowed by applicable housing codes. Unauthorized occupants may result in lease termination."));

  children.push(H2("3. RENT"));
  children.push(P(`3.1 Monthly Rent: Tenant agrees to pay Landlord the sum of $${getField('monthlyRent', '[AMOUNT]')} per month as rent for the Premises, due on the ${getField('rentDueDay', '1st')} day of each month.`));
  children.push(P(`3.2 Late Fee: If rent is not received by the ${getField('lateFeeDays', '5th')} day of the month, Tenant shall pay a late fee of $${getField('lateFeeAmount', '[AMOUNT]')} as additional rent. This late fee is a reasonable estimate of administrative costs incurred due to late payment.`));
  children.push(P("3.3 Payment Method: Rent shall be payable by check, money order, cashier's check, or electronic payment. Personal checks returned for insufficient funds shall incur a fee of $35 plus any bank charges."));
  children.push(P("3.4 Prorated Rent: If Tenant takes possession on a date other than the first of the month, rent shall be prorated on a daily basis."));

  children.push(H2("4. SECURITY DEPOSIT"));
  children.push(P(`4.1 Deposit Amount: Upon execution of this Lease, Tenant shall pay a security deposit in the amount of $${getField('securityDeposit', '[AMOUNT]')} to be held by Landlord as security for the faithful performance of Tenant's obligations under this Lease.`));
  children.push(P("4.2 Use of Deposit: The security deposit may be used for unpaid rent, cleaning, repairs for damages beyond normal wear and tear, and any other amounts owed under this Lease."));
  children.push(P("4.3 Return of Deposit: The deposit, less any lawful deductions, shall be returned within the time period required by applicable law after Tenant vacates the Premises."));
  children.push(P("4.4 Non-Refundable Fees: Any non-refundable fees shall be clearly identified in an addendum to this Lease."));

  children.push(H2("5. UTILITIES AND SERVICES"));
  children.push(P("5.1 Tenant Responsibilities: Unless otherwise agreed, Tenant shall be responsible for all utilities and services including electricity, gas, water, sewer, trash removal, internet, cable, and telephone."));
  children.push(P("5.2 Landlord Responsibilities: Landlord shall be responsible for the following utilities: [SPECIFY OR NONE]."));
  children.push(P("5.3 Utility Transfers: Tenant agrees to transfer utilities into Tenant's name within 3 days of move-in."));

  children.push(H2("6. USE OF PREMISES"));
  children.push(P("6.1 Residential Use Only: The Premises shall be used exclusively as a private residence for Tenant and approved occupants. No business, trade, or profession may be conducted on the Premises without prior written consent of Landlord."));
  children.push(P("6.2 Illegal Activities: Tenant shall not use the Premises for any illegal purpose. Any illegal activity may result in immediate lease termination."));
  children.push(P("6.3 Nuisance: Tenant shall not create or permit any nuisance on the Premises or interfere with the quiet enjoyment of other tenants or neighbors."));
  children.push(P("6.4 Compliance: Tenant shall comply with all applicable laws, ordinances, and rules of any homeowners' or condominium association."));

  children.push(H2("7. MAINTENANCE AND REPAIRS"));
  children.push(P("7.1 Landlord Obligations: Landlord shall maintain the Premises in habitable condition, including structural repairs, plumbing, electrical, heating, and common areas."));
  children.push(P("7.2 Tenant Obligations: Tenant shall maintain the Premises in clean and sanitary condition and promptly notify Landlord of any needed repairs within 48 hours of discovery."));
  children.push(P("7.3 Damage by Tenant: Tenant shall be responsible for repairs of damages caused by Tenant, household members, or guests."));
  children.push(P("7.4 Emergency Repairs: In case of emergency affecting health or safety, Tenant shall immediately notify Landlord and take reasonable steps to prevent further damage."));

  children.push(H2("8. ALTERATIONS"));
  children.push(P("8.1 No Alterations: Tenant shall not make any alterations, improvements, or additions to the Premises without prior written consent of Landlord."));
  children.push(P("8.2 Approved Changes: Any approved alterations become the property of Landlord unless otherwise agreed in writing."));

  children.push(H2("9. PETS"));
  children.push(P(`9.1 Pet Policy: Pets are ${getField('petsAllowed', '[ALLOWED/NOT ALLOWED]')} on the Premises. Any approved pet requires a separate pet agreement and additional deposit.`));
  children.push(P("9.2 Service Animals: This section does not apply to service animals or emotional support animals as required by law."));

  children.push(H2("10. ENTRY BY LANDLORD"));
  children.push(P("10.1 Right of Entry: Landlord may enter the Premises with reasonable notice for inspections, repairs, showings to prospective tenants or buyers, and emergencies."));
  children.push(P("10.2 Notice Period: Except in emergencies, Landlord shall provide notice as required by applicable state law before entering."));

  children.push(H2("11. INSURANCE"));
  children.push(P("11.1 Renter's Insurance: Tenant is strongly encouraged to obtain renter's insurance covering personal property and liability. Landlord's insurance does not cover Tenant's personal property."));
  children.push(P("11.2 Liability: Tenant assumes responsibility for damage or loss to personal property from any cause."));

  children.push(H2("12. SUBLETTING AND ASSIGNMENT"));
  children.push(P("12.1 Prohibition: Tenant shall not sublet the Premises or assign this Lease without prior written consent of Landlord."));
  children.push(P("12.2 Short-term Rentals: Tenant shall not use the Premises for short-term vacation rentals (Airbnb, VRBO, etc.) without express written permission."));

  children.push(H2("13. DEFAULT AND REMEDIES"));
  children.push(P("13.1 Default by Tenant: Failure to pay rent, violation of lease terms, or illegal activity constitutes default under this Lease."));
  children.push(P("13.2 Notice to Cure: Landlord shall provide notice as required by law before initiating eviction proceedings for curable defaults."));
  children.push(P("13.3 Remedies: Upon default, Landlord may pursue all legal remedies including eviction, recovery of unpaid rent, damages, and attorney's fees."));
  children.push(P("13.4 Acceleration: Upon default, all remaining rent for the lease term may become immediately due and payable."));

  children.push(H2("14. TERMINATION"));
  children.push(P("14.1 End of Term: This Lease terminates at the end of the lease term unless renewed in writing."));
  children.push(P("14.2 Early Termination: Early termination may be permitted with payment of an early termination fee equal to two months' rent plus forfeiture of security deposit."));
  children.push(P("14.3 Abandonment: If Tenant abandons the Premises, Landlord may retake possession and pursue all available remedies."));

  children.push(H2("15. MOVE-OUT PROCEDURES"));
  children.push(P("15.1 Notice Required: Tenant shall provide written notice of intent to vacate as required by applicable law."));
  children.push(P("15.2 Condition: The Premises shall be returned in the same condition as received, normal wear and tear excepted."));
  children.push(P("15.3 Cleaning: Tenant shall thoroughly clean the Premises including walls, floors, carpet, and appliances."));
  children.push(P("15.4 Keys and Access: All keys, remotes, and access devices shall be returned upon vacating."));

  children.push(H2("16. FAIR HOUSING"));
  children.push(P("Landlord shall not discriminate against Tenant based on protected class status including race, color, religion, sex, national origin, disability, familial status, or sexual orientation, in accordance with the Fair Housing Act and state laws."));

  children.push(H2("17. ENTIRE AGREEMENT"));
  children.push(P("This Lease constitutes the entire agreement between Landlord and Tenant and supersedes all prior negotiations and agreements, whether written or oral. This Lease may be modified only by written amendment signed by both parties."));

  children.push(H2("18. GOVERNING LAW"));
  children.push(P(`This Lease shall be governed by and construed in accordance with the laws of the State of ${stateName}.`));

  children.push(H2("19. DISPUTE RESOLUTION"));
  children.push(P("Any disputes arising from this Lease shall be resolved in the appropriate court of competent jurisdiction in the county where the Premises is located."));

  children.push(H2("20. SEVERABILITY"));
  children.push(P("If any provision of this Lease is found to be invalid or unenforceable, all other provisions shall remain in full force and effect."));

  children.push(H2("21. INDEMNIFICATION"));
  children.push(P("21.1 Tenant agrees to indemnify and hold harmless Landlord from and against any claims, actions, damages, and expenses arising from Tenant's use of the Premises or breach of this Lease."));
  children.push(P("21.2 Landlord's Limited Liability: Except as required by law, Landlord shall not be liable for injury or damage caused by theft, criminal activity, fire, water damage, or acts of God."));

  children.push(H2("22. ATTORNEY'S FEES"));
  children.push(P("In the event of any legal action arising out of this Lease, the prevailing party shall be entitled to recover reasonable attorneys' fees and court costs."));

  children.push(H2("23. NOTICES"));
  children.push(P("All notices required under this Lease shall be in writing and delivered personally, by certified mail, or by email with confirmed receipt."));

  children.push(H2("24. ADDITIONAL PROVISIONS"));
  children.push(P("24.1 Time is of the Essence: Time is of the essence with respect to all provisions of this Lease."));
  children.push(P("24.2 Waiver: No waiver by Landlord of any breach shall be construed as a waiver of subsequent breaches."));
  children.push(P("24.3 Joint and Several Liability: If multiple Tenants sign this Lease, each shall be jointly and severally liable."));
  children.push(P("24.4 Binding Effect: This Lease is binding upon the parties and their heirs, executors, and successors."));

  const stateDisclosures = getStateDisclosures(stateId);
  children.push(...stateDisclosures);

  children.push(HR());

  children.push(H2("SIGNATURES"));
  children.push(P("By signing below, the parties acknowledge that they have read, understand, and agree to be bound by all terms of this Lease."));

  children.push(P("LANDLORD:", { bold: true }));
  children.push(SignatureLine("Signature"));
  children.push(SignatureLine("Printed Name"));
  children.push(SignatureLine("Date"));

  children.push(P("TENANT:", { bold: true }));
  children.push(SignatureLine("Signature"));
  children.push(SignatureLine("Printed Name"));
  children.push(SignatureLine("Date"));

  children.push(Footer());

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        children,
      },
    ],
  });

  try {
    const buffer = await Packer.toBuffer(doc);
    console.log(`📝 DOCX generated successfully in ${Date.now() - startTime}ms (${buffer.length} bytes)`);
    return Buffer.from(buffer);
  } catch (error) {
    console.error('📝 Error generating DOCX:', error);
    throw error;
  }
}

function generateHTMLFromTemplate(
  templateTitle: string,
  templateContent: string,
  fieldValues: FieldValue,
  stateId: string,
  version: number = 1,
  updatedAt: Date = new Date(),
  landlordInfo?: LandlordInfo
): string {
  // SECURITY: For MVP, we ONLY use default template generation with fully escaped values.
  // templateContent should always be empty. If it's not empty, we ignore it to prevent injection.
  // Future custom templates must use a safe templating engine with auto-escaping.
  
  // Sanitize ALL inputs to prevent HTML injection
  const safeTitle = escapeHtml(templateTitle);
  const safeStateId = escapeHtml(stateId);
  
  // ALWAYS use default template generation (never trust templateContent from database)
  let filledContent = generateDefaultTemplateContent(safeTitle, fieldValues, safeStateId, version, updatedAt);
  
  // For safety, still escape any {{fieldId}} placeholders if they exist
  // (though default generator doesn't use this pattern)
  Object.entries(fieldValues).forEach(([fieldId, value]) => {
    const placeholder = new RegExp(`{{${fieldId}}}`, 'g');
    const escapedValue = escapeHtml(String(value));
    filledContent = filledContent.replace(placeholder, escapedValue);
  });

  // Add version and date info to document header
  const versionInfo = `
  <div class="version-info">
    <p style="margin: 3pt 0; text-align: left;"><strong>Document Version:</strong> ${version}</p>
    <p style="margin: 3pt 0; text-align: left;"><strong>Last Updated:</strong> ${new Date(updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
    <p style="margin: 3pt 0; text-align: left;"><strong>Generated:</strong> ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
  </div>
  `;
  
  const contentWithVersion = versionInfo + filledContent;

  // Wrap in proper HTML structure with professional attorney-quality styling
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
      margin: 1in 1in 1in 1in;
    }
    
    body {
      font-family: 'Times New Roman', 'Georgia', serif;
      font-size: 12pt;
      line-height: 1.8;
      color: #000;
      margin: 0;
      padding: 0;
    }
    
    .document-header {
      text-align: center;
      margin-bottom: 30pt;
      padding-bottom: 15pt;
      border-bottom: 2px solid #1a1a1a;
    }
    
    .document-header .firm-name {
      font-size: 16pt;
      font-weight: bold;
      letter-spacing: 1pt;
      margin-bottom: 6pt;
      color: #1a1a1a;
    }
    
    .document-header .tagline {
      font-size: 10pt;
      font-style: italic;
      color: #333;
      margin-bottom: 8pt;
    }
    
    .document-header .landlord-contact {
      font-size: 10pt;
      color: #333;
      margin-bottom: 8pt;
    }
    
    .document-header .state-info {
      font-size: 9pt;
      color: #555;
      margin-top: 6pt;
    }
    
    h1 {
      font-size: 16pt;
      font-weight: bold;
      text-align: center;
      margin: 24pt 0 20pt 0;
      text-transform: uppercase;
      letter-spacing: 1.5pt;
      color: #1a1a1a;
    }
    
    h2 {
      font-size: 13pt;
      font-weight: bold;
      margin-top: 24pt;
      margin-bottom: 12pt;
      padding-bottom: 6pt;
      border-bottom: 2px solid #2a2a2a;
      color: #1a1a1a;
    }
    
    h3 {
      font-size: 12pt;
      font-weight: bold;
      margin-top: 18pt;
      margin-bottom: 10pt;
      text-decoration: underline;
      color: #1a1a1a;
    }
    
    p {
      margin-bottom: 14pt;
      text-align: justify;
      text-indent: 0;
      line-height: 1.8;
    }
    
    .field-value {
      font-weight: 600;
      text-decoration: underline;
      padding: 0 2pt;
    }
    
    .signature-line {
      margin-top: 50pt;
      border-top: 2px solid #000;
      width: 350pt;
      display: inline-block;
    }
    
    .signature-block {
      margin-top: 40pt;
      page-break-inside: avoid;
    }
    
    .signature-section {
      margin-top: 30pt;
      margin-bottom: 30pt;
      page-break-inside: avoid;
    }
    
    .signature-section p {
      margin: 8pt 0;
      text-align: left;
    }
    
    .signature-section strong {
      font-weight: bold;
      font-size: 11pt;
      letter-spacing: 0.5pt;
    }
    
    .footer {
      margin-top: 50pt;
      font-size: 8pt;
      color: #666;
      text-align: center;
      border-top: 1px solid #bbb;
      padding-top: 12pt;
      font-style: italic;
    }
    
    .version-info {
      background-color: #f5f5f5;
      padding: 8pt;
      margin-bottom: 20pt;
      font-size: 8pt;
      border: 1px solid #ddd;
      text-align: left;
    }
    
    .version-info p {
      margin: 3pt 0;
      text-align: left;
      text-indent: 0;
    }
    
    .legal-notice {
      background-color: #fafafa;
      border-left: 4px solid #333;
      padding: 12pt;
      margin: 20pt 0;
      font-size: 10pt;
    }
    
    .legal-notice p {
      margin: 6pt 0;
      text-align: left;
    }
    
    strong {
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="document-header">
    ${landlordInfo?.businessName ? `<div class="firm-name">${escapeHtml(landlordInfo.businessName)}</div>` : ''}
    ${landlordInfo?.phoneNumber || landlordInfo?.email ? `
      <div class="landlord-contact">
        ${landlordInfo.phoneNumber ? `<span>${escapeHtml(landlordInfo.phoneNumber)}</span>` : ''}
        ${landlordInfo.phoneNumber && landlordInfo.email ? ' | ' : ''}
        ${landlordInfo.email ? `<span>${escapeHtml(landlordInfo.email)}</span>` : ''}
      </div>
    ` : ''}
    <div class="state-info">State-Specific Legal Forms for ${safeStateId}</div>
  </div>
  
  ${contentWithVersion}
  
  <div class="footer">
    State: ${safeStateId} | Version ${version}<br>
    <strong>Last Legal Review:</strong> ${new Date(updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}<br>
    For informational purposes only - Consult with a licensed attorney for legal advice
  </div>
</body>
</html>
  `;
}

function getComprehensiveLeaseContent(stateId: string, fieldValues: FieldValue): string {
  return `
    <h2>1. TERM OF LEASE</h2>
    <p>This Residential Lease Agreement ("Lease") is entered into as of ${escapeHtml(String(fieldValues.leaseStartDate) || '[DATE]')} ("Commencement Date") between the undersigned Landlord and Tenant(s) for the rental of the property located at ${escapeHtml(String(fieldValues.propertyAddress) || '[ADDRESS]')}, ${escapeHtml(String(fieldValues.propertyCity) || '[CITY]')}, ${stateId} ${escapeHtml(String(fieldValues.propertyZip) || '[ZIP]')} ("Premises"). This Lease shall commence on ${escapeHtml(String(fieldValues.leaseStartDate) || '[START DATE]')} and shall terminate at 11:59 PM on ${escapeHtml(String(fieldValues.leaseEndDate) || '[END DATE]')} unless sooner terminated or further extended in writing by mutual agreement of both parties.</p>

    <h2>2. PARTIES AND OCCUPANTS</h2>
    <p>Landlord: ${escapeHtml(String(fieldValues.landlordName) || '[LANDLORD NAME]')}, residing at ${escapeHtml(String(fieldValues.landlordAddress) || '[ADDRESS]')}. Tenant(s): ${escapeHtml(String(fieldValues.tenantName) || '[TENANT NAME]')}. All occupants of the Premises, whether family members, friends, or guests staying more than fourteen (14) consecutive days or thirty (30) days in any calendar year, must be approved in writing by Landlord. Unauthorized occupants shall constitute a material breach of this Lease.</p>

    <h2>3. RENT AND PAYMENT TERMS</h2>
    <p>3.1 Monthly Rent: Tenant agrees to pay Landlord the sum of $${escapeHtml(String(fieldValues.monthlyRent) || '[AMOUNT]')} per month as rent for the Premises, payable in advance on the ${escapeHtml(String(fieldValues.rentDueDay) || '1st')} day of each calendar month. Rent shall be paid to Landlord at the following address: ${escapeHtml(String(fieldValues.landlordAddress) || '[ADDRESS]')} or such other place as Landlord may designate in writing.</p>
    <p>3.2 Late Payment Charges: If rent is not received by Landlord on or before the 5th day of the month, a late fee of $${escapeHtml(String(fieldValues.lateFeeAmount) || '[AMOUNT]')} shall be assessed and added to the rent due. Any grace period of ${escapeHtml(String(fieldValues.lateFeeDays) || '5')} days as referenced herein is a courtesy only and shall not constitute a waiver of the timely payment requirement or waive Landlord's right to pursue any legal remedies for non-payment.</p>
    <p>3.3 NSF Checks: A charge of $35 shall be assessed for each check returned for insufficient funds.</p>
    <p>3.4 Payment Method: All payments shall be made via check, money order, electronic transfer, or other method acceptable to Landlord. All payments are non-refundable.</p>

    <h2>4. SECURITY DEPOSIT</h2>
    <p>4.1 Amount: Tenant shall deposit with Landlord the sum of $${escapeHtml(String(fieldValues.securityDeposit) || '[AMOUNT]')} as a security deposit to be held by Landlord for the faithful performance of all terms and conditions of this Lease.</p>
    <p>4.2 Deposit Use: The security deposit may be applied by Landlord to any unpaid rent, damages to the Premises beyond normal wear and tear, cleaning costs, or any other default under this Lease. The security deposit shall not be considered rent, though it may be applied toward rent if Tenant defaults.</p>
    <p>4.3 Return of Deposit: Within ${stateId === 'UT' ? '30' : stateId === 'TX' ? '30' : stateId === 'ND' ? '30' : '30'} days after termination of the Lease and vacancy of the Premises, Landlord shall return the security deposit less any lawful deductions for damages, unpaid rent, or lease violations, along with an itemized statement of any deductions.</p>
    <p>4.4 Non-Refundable Fee: The security deposit is refundable only for damages and lease violations; it is NOT a non-refundable cleaning or administrative fee.</p>

    <h2>5. MAINTENANCE AND REPAIRS</h2>
    <p>5.1 Tenant Responsibilities: Tenant shall maintain the Premises in a clean, sanitary, and good condition and shall be responsible for all interior maintenance and minor repairs, including but not limited to: light bulbs, air filters, clogged drains, and routine maintenance costing less than $75.</p>
    <p>5.2 Landlord Responsibilities: Landlord shall maintain the structure, exterior, roof, foundation, and major systems (electrical, plumbing, heating/cooling) in good repair and comply with all applicable building, housing, and health codes.</p>
    <p>5.3 Repair Request Procedures: Tenant shall notify Landlord in writing of any necessary repairs within 48 hours of discovery. Landlord shall make repairs within a reasonable timeframe not to exceed 14 days for non-emergency situations.</p>
    <p>5.4 Emergency Repairs: In case of emergency (fire, flooding, gas leak, etc.), Tenant may arrange repairs and provide receipt to Landlord for reimbursement of reasonable costs.</p>

    <h2>6. ALTERATIONS AND IMPROVEMENTS</h2>
    <p>Tenant shall not make any alterations, additions, modifications, or improvements to the Premises, including but not limited to painting, installing shelving, hanging pictures with nails, installing fixtures, or landscaping, without prior written consent from Landlord. All alterations made without consent shall be deemed a material breach. All approved alterations become the property of Landlord and shall remain at the Premises upon termination of this Lease unless otherwise agreed in writing.</p>

    <h2>7. USE OF PREMISES</h2>
    <p>7.1 Permitted Use: The Premises shall be used solely as a residential dwelling unit for Tenant and approved occupants only. No business, trade, or commercial activity shall be conducted on the Premises.</p>
    <p>7.2 Prohibited Activities: Tenant shall not: (a) engage in any illegal activity; (b) maintain a dangerous, hazardous, or explosive substance; (c) keep any animal except as permitted in writing; (d) operate any motorized vehicle, motorcycle, or recreational vehicle on the Premises; (e) conduct any business operation; (f) create excessive noise; (g) engage in disorderly conduct.</p>
    <p>7.3 Nuisance Clause: Tenant shall not use the Premises in any way that creates a nuisance or materially interferes with the quiet enjoyment of neighboring tenants or surrounding properties.</p>

    <h2>8. PETS</h2>
    <p>No pets or animals of any kind shall be kept on the Premises without prior written permission from Landlord. If permission is granted, Tenant shall pay a pet deposit of $[PET DEPOSIT] and a monthly pet fee of $[PET FEE]. Tenant shall be liable for any and all damage caused by any pet, including excessive odor, stains, or removal of odor-causing conditions.</p>

    <h2>9. UTILITIES AND SERVICES</h2>
    <p>Tenant shall be responsible for arranging and paying for all utilities including: electricity, gas, water, sewer, trash collection, telephone, cable, and internet service. Landlord shall provide: [SPECIFY]. Tenant shall not alter or tamper with utility meters, systems, or connections.</p>

    <h2>10. INSURANCE</h2>
    <p>10.1 Renter's Insurance: Tenant shall obtain and maintain renter's insurance with minimum coverage of $[AMOUNT] throughout the term of this Lease. Proof of insurance shall be provided to Landlord within 14 days of Lease execution.</p>
    <p>10.2 Landlord's Insurance: Landlord shall maintain property insurance on the building structure only. Landlord's insurance does not cover Tenant's personal property or liability.</p>
    <p>10.3 No Liability: Landlord shall not be liable for any loss, theft, damage, or destruction of Tenant's personal property, regardless of cause.</p>

    <h2>11. NOISE AND CONDUCT</h2>
    <p>Tenant shall maintain peaceful and quiet enjoyment of the Premises and shall not create excessive noise between 10:00 PM and 8:00 AM, nor at any time constitute a nuisance to neighbors. Tenant shall comply with all local ordinances regarding noise levels and shall not have loud parties, loud music, or gatherings that disturb neighbors.</p>

    <h2>12. ENTRY AND INSPECTION</h2>
    <p>Landlord may enter the Premises for purposes of inspection, repair, maintenance, showing to prospective tenants, emergency situations, or other legitimate purposes upon reasonable notice (${stateId === 'UT' ? '24' : stateId === 'TX' ? '24' : stateId === 'ND' ? '24' : '24'} hours unless emergency). Tenant shall provide Landlord with keys and access codes. Landlord shall not unreasonably interfere with Tenant's quiet enjoyment of the Premises.</p>

    <h2>13. YARD AND LANDSCAPING</h2>
    <p>Tenant shall maintain any yard, patio, or outdoor area in a neat and clean condition. Tenant shall not alter landscaping without written permission. Tenant shall water vegetation regularly and maintain the grounds during the lease term.</p>

    <h2>14. PARKING</h2>
    <p>Tenant shall park vehicles only in assigned parking areas. No commercial vehicles, recreational vehicles, or inoperable vehicles may be parked on the Premises. Tenant shall not park on the street, grass, or common areas without express written permission. Violators are subject to towing at Tenant's expense.</p>

    <h2>15. TERMINATION AND RENEWAL</h2>
    <p>15.1 End of Term: Upon expiration of this Lease, Tenant shall vacate the Premises completely and return all keys. The Premises shall be in clean, undamaged condition (normal wear and tear excepted) or Tenant shall be liable for cleaning and repairs.</p>
    <p>15.2 Notice to Vacate: If either party wishes to terminate this Lease at its expiration date, written notice shall be provided no less than ${stateId === 'UT' ? '30' : stateId === 'TX' ? '30' : stateId === 'ND' ? '60' : '30'} days prior to the end of the lease term. Failure to provide notice may result in automatic renewal.</p>
    <p>15.3 Early Termination: Termination prior to the lease end date shall be considered a material breach. Tenant shall remain liable for all remaining rent owed unless Landlord re-rents the Premises.</p>

    <h2>16. DEFAULT AND REMEDIES</h2>
    <p>16.1 Default Events: The following shall constitute material default: (a) non-payment of rent or fees; (b) unauthorized occupants; (c) pets without permission; (d) alterations without consent; (e) illegal activity; (f) property damage; (g) violation of any lease term.</p>
    <p>16.2 Cure Period: If Tenant is in default, Landlord shall provide written notice with a reasonable opportunity to cure (minimum 3 days for non-payment, 5 days for other breaches) unless the breach cannot be cured (illegal activity).</p>
    <p>16.3 Remedies: Upon default, Landlord may: (a) apply security deposit; (b) pursue eviction proceedings; (c) recover all unpaid rent, late fees, court costs, and attorney fees; (d) hold Tenant liable for all damages to the Premises.</p>

    <h2>17. MOVE-OUT REQUIREMENTS</h2>
    <p>17.1 Final Inspection: Prior to move-out, Tenant shall notify Landlord and schedule a final walk-through inspection.</p>
    <p>17.2 Condition: The Premises shall be returned in the same condition as received, normal wear and tear excepted. All repairs needed shall be itemized and provided to Tenant.</p>
    <p>17.3 Cleaning: Tenant shall thoroughly clean the Premises including walls, floors, carpet, appliances, and removal of all personal items and trash. Professional cleaning may be required if condition is unsatisfactory.</p>
    <p>17.4 Keys and Access: All keys, remotes, access codes, and devices shall be returned in working condition. Lost keys will result in rekeying costs of $[AMOUNT] being deducted from security deposit.</p>

    <h2>18. FAIR HOUSING AND ANTI-DISCRIMINATION</h2>
    <p>Landlord shall not discriminate against Tenant based on protected class status including race, color, religion, sex, national origin, disability, familial status, or sexual orientation, in accordance with the Fair Housing Act and state laws.</p>

    ${getStateDisclosuresExpanded(stateId)}

    <h2>20. ENTIRE AGREEMENT AND MODIFICATIONS</h2>
    <p>This Lease constitutes the entire agreement between Landlord and Tenant and supersedes all prior negotiations and agreements, whether written or oral. This Lease may be modified only by written amendment signed by both Landlord and Tenant.</p>

    <h2>21. GOVERNING LAW</h2>
    <p>This Lease shall be governed by and construed in accordance with the laws of the State of ${stateId === 'UT' ? 'Utah' : stateId === 'TX' ? 'Texas' : stateId === 'ND' ? 'North Dakota' : 'South Dakota'}, without regard to conflict of law principles.</p>

    <h2>22. DISPUTE RESOLUTION</h2>
    <p>Any disputes arising from this Lease shall be resolved in the appropriate court of competent jurisdiction in the county where the Premises is located. Prevailing party in any litigation shall be entitled to recover reasonable attorney fees and court costs.</p>

    <h2>23. SEVERABILITY</h2>
    <p>If any provision of this Lease is found to be invalid or unenforceable, all other provisions shall remain in full force and effect.</p>

    <h2>24. INDEMNIFICATION AND HOLD HARMLESS</h2>
    <p>24.1 Tenant Indemnification: Tenant agrees to indemnify, defend, and hold harmless Landlord, Landlord's agents, employees, and representatives from and against any and all claims, actions, damages, liability, cost, and expense, including but not limited to attorneys' fees and court costs, arising from or related to: (a) any breach of this Lease by Tenant; (b) any injury or death to any person or damage to any property occurring in or about the Premises resulting from the negligence or willful misconduct of Tenant, Tenant's guests, invitees, or occupants; (c) any nuisance made or suffered on the Premises by Tenant or persons under Tenant's control; (d) any failure by Tenant to comply with any law, statute, ordinance, or governmental requirement; (e) the use or occupancy of the Premises by Tenant or any persons under Tenant's control.</p>
    <p>24.2 Landlord's Limited Liability: Except as otherwise required by applicable law, Landlord shall not be liable to Tenant or any third party for any injury, loss, or damage to persons or property caused by: (a) theft, vandalism, burglary, or criminal activity; (b) fire, smoke, water damage, flooding, or any act of God; (c) electrical failure, equipment malfunction, or utility interruption; (d) actions of other tenants, neighbors, or third parties; (e) any defect in or failure of locks, latches, or security devices; (f) condition of common areas, sidewalks, parking areas, or grounds, except to the extent caused by Landlord's gross negligence.</p>
    <p>24.3 Waiver of Subrogation: Tenant releases Landlord from any claims for damage to Tenant's property or interruption of Tenant's business caused by any reason whatsoever, including negligent acts of Landlord (except for gross negligence or willful misconduct), and Tenant waives all rights of subrogation against Landlord.</p>
    <p>24.4 Survival: This indemnification provision shall survive the termination of this Lease and shall not be limited by any insurance carried by either party.</p>

    <h2>25. LIABILITY WAIVER AND ASSUMPTION OF RISK</h2>
    <p>25.1 Tenant acknowledges that Landlord is not liable for any loss, theft, damage, or destruction of Tenant's personal property, regardless of cause, except as required by law. Tenant assumes full responsibility for personal safety and security of the Premises.</p>
    <p>25.2 Tenant acknowledges that Landlord makes no representations or warranties regarding the safety or security of the Premises, neighborhood, or surrounding area. Tenant has independently investigated and is satisfied with the condition, safety, and suitability of the Premises.</p>
    <p>25.3 Tenant releases and discharges Landlord from any and all liability for injury, death, or property damage arising from Tenant's use of the Premises, common areas, amenities, or any equipment or appliances provided, except to the extent caused by Landlord's gross negligence or willful misconduct.</p>

    <h2>26. ATTORNEY'S FEES AND COSTS</h2>
    <p>In the event of any legal action or proceeding arising out of or relating to this Lease, the prevailing party shall be entitled to recover from the non-prevailing party all reasonable attorneys' fees, court costs, expert witness fees, and other costs and expenses incurred in connection with such action or proceeding, including any appeals.</p>

    <h2>27. NOTICES</h2>
    <p>All notices required or permitted under this Lease shall be in writing and shall be deemed delivered when: (a) personally delivered; (b) sent by certified mail, return receipt requested, to the addresses set forth herein; (c) sent by overnight delivery service; or (d) sent by email with confirmed receipt. Landlord may post notices on the Premises if Tenant cannot be reached by other means.</p>

    <h2>28. ADDITIONAL PROVISIONS</h2>
    <p>28.1 Time is of the Essence: Time is of the essence with respect to all provisions of this Lease.</p>
    <p>28.2 Waiver: No waiver by Landlord of any breach of this Lease shall be construed as a waiver of any subsequent breach. Landlord's acceptance of rent with knowledge of any breach shall not be deemed a waiver.</p>
    <p>28.3 Joint and Several Liability: If more than one person signs this Lease as Tenant, each shall be jointly and severally liable for all obligations under this Lease.</p>
    <p>28.4 Binding Effect: This Lease shall be binding upon and inure to the benefit of the parties and their respective heirs, executors, administrators, successors, and permitted assigns.</p>
    <p>28.5 Headings: Section headings are for convenience only and shall not affect the interpretation of this Lease.</p>
  `;
}

function getStateDisclosuresExpanded(stateId: string): string {
  const disclosures: Record<string, string> = {
    UT: `
      <h2>19. UTAH STATE-SPECIFIC PROVISIONS</h2>
      <h3>19.1 Fair Housing Disclosure</h3>
      <p>In accordance with the Utah Fair Housing Act (Utah Code § 57-21-1 et seq.), it is unlawful to refuse to rent, discriminate, or discriminate in advertising because of race, color, religion, sex, national origin, familial status, source of income, or disability.</p>
      <h3>19.2 Mold Prevention and Disclosure</h3>
      <p>Pursuant to the Utah Fit Premises Act (Utah Code § 57-22-4), Landlord discloses that there is no known mold contamination on the Premises. Tenant agrees to maintain adequate ventilation and promptly report any water leaks or visible mold within 48 hours of discovery.</p>
      <h3>19.3 Radon Gas Disclosure</h3>
      <p>Radon is a naturally occurring radioactive gas that may accumulate in buildings. Long-term exposure may pose health risks. Testing is recommended.</p>
      <h3>19.4 Lead-Based Paint Disclosure (Pre-1978 Properties)</h3>
      <p>If the property was built before January 1, 1978, Landlord has disclosed all known information regarding lead-based paint hazards.</p>
      <h3>19.5 Security Deposit (Utah Code § 57-17-3)</h3>
      <p>Landlord shall return the security deposit within 30 days of lease termination with an itemized statement of any deductions. Security deposit may not exceed the equivalent of two months' rent.</p>
      <h3>19.6 Entry Notice</h3>
      <p>Landlord shall provide at least 24 hours' notice before entering the Premises except in emergencies.</p>
    `,
    TX: `
      <h2>19. TEXAS STATE-SPECIFIC PROVISIONS</h2>
      <h3>19.1 Fair Housing Compliance</h3>
      <p>In accordance with the Texas Fair Housing Act and Texas Property Code § 92.001 et seq., it is unlawful to discriminate based on race, color, religion, sex, national origin, familial status, or disability.</p>
      <h3>19.2 Texas Property Code Compliance</h3>
      <p>This Lease is governed by Texas Property Code Chapter 92. Landlord must repair conditions that materially affect health and safety within a reasonable time after receiving written notice.</p>
      <h3>19.3 Security Deposit (Texas Property Code § 92.103-109)</h3>
      <p>Landlord shall return the security deposit within 30 days of lease termination with an itemized accounting. No statutory limit on security deposit amount.</p>
      <h3>19.4 Late Fees (Texas Property Code § 92.019)</h3>
      <p>Late fees cannot be charged until rent is at least one full day late. Late fees must be reasonable and specified in the lease.</p>
      <h3>19.5 Lead-Based Paint Disclosure</h3>
      <p>For properties built before 1978, Landlord certifies disclosure of all known lead-based paint hazards.</p>
      <h3>19.6 Entry Notice</h3>
      <p>Texas law does not specify a minimum notice period, but reasonable notice is required except in emergencies.</p>
    `,
    ND: `
      <h2>19. NORTH DAKOTA STATE-SPECIFIC PROVISIONS</h2>
      <h3>19.1 Fair Housing Notice</h3>
      <p>In accordance with North Dakota Fair Housing Act (N.D. Cent. Code § 14-02.4-01), discrimination is prohibited based on race, color, religion, sex, national origin, familial status, disability, age, or receipt of public assistance.</p>
      <h3>19.2 Security Deposit (N.D. Cent. Code § 47-16-07.1)</h3>
      <p>Landlord shall return the security deposit within 30 days of lease termination. Security deposit may not exceed one month's rent unless special conditions exist.</p>
      <h3>19.3 Lead-Based Paint Disclosure</h3>
      <p>For properties built before 1978, Landlord discloses all known lead-based paint conditions and hazards.</p>
      <h3>19.4 Landlord Lien</h3>
      <p>Pursuant to N.D. Cent. Code § 35-21, Landlord has a lien on Tenant's property for unpaid rent.</p>
      <h3>19.5 Entry Notice</h3>
      <p>Landlord shall provide reasonable notice before entering the Premises except in emergencies.</p>
    `,
    SD: `
      <h2>19. SOUTH DAKOTA STATE-SPECIFIC PROVISIONS</h2>
      <h3>19.1 Fair Housing Statement</h3>
      <p>In accordance with S.D. Codified Law § 20-13-1, discrimination is prohibited based on race, color, creed, religion, sex, ancestry, disability, familial status, or national origin.</p>
      <h3>19.2 Security Deposit (S.D. Codified Law § 43-32-6.1)</h3>
      <p>Landlord shall return the security deposit within 14 days of lease termination (or 45 days if tenancy is over one year) with an itemized statement. Security deposit may not exceed one month's rent.</p>
      <h3>19.3 Lead-Based Paint Disclosure</h3>
      <p>For properties built before 1978, Landlord certifies disclosure of all known lead-based paint hazards.</p>
      <h3>19.4 Entry Notice</h3>
      <p>Landlord shall provide at least 24 hours' notice before entering the Premises except in emergencies.</p>
    `,
    AZ: `
      <h2>19. ARIZONA STATE-SPECIFIC PROVISIONS</h2>
      <h3>19.1 Arizona Residential Landlord and Tenant Act</h3>
      <p>This Lease is governed by A.R.S. § 33-1301 et seq. (Arizona Residential Landlord and Tenant Act). Both parties acknowledge their rights and obligations under this Act.</p>
      <h3>19.2 Fair Housing Compliance</h3>
      <p>In accordance with the Arizona Fair Housing Act (A.R.S. § 41-1491), discrimination is prohibited based on race, color, religion, sex, familial status, national origin, or disability.</p>
      <h3>19.3 Security Deposit (A.R.S. § 33-1321)</h3>
      <p>Security deposit may not exceed one and one-half months' rent. Landlord shall return the deposit within 14 business days after termination with an itemized statement of deductions.</p>
      <h3>19.4 Pool/Spa Disclosure</h3>
      <p>If the property has a pool or spa, Tenant acknowledges receiving information about pool safety and barrier requirements per A.R.S. § 36-1681.</p>
      <h3>19.5 Lead-Based Paint Disclosure</h3>
      <p>For properties built before 1978, Landlord discloses all known lead-based paint hazards.</p>
      <h3>19.6 Entry Notice</h3>
      <p>Landlord shall provide at least 48 hours' notice before entering the Premises for non-emergency purposes.</p>
      <h3>19.7 Bed Bug Disclosure</h3>
      <p>Landlord discloses any known bed bug infestations within the last year per A.R.S. § 33-1319.</p>
    `,
    CA: `
      <h2>19. CALIFORNIA STATE-SPECIFIC PROVISIONS</h2>
      <h3>19.1 California Civil Code Compliance</h3>
      <p>This Lease is governed by California Civil Code § 1940 et seq. Both parties acknowledge their rights under California tenant protection laws.</p>
      <h3>19.2 Fair Housing (California Fair Employment and Housing Act)</h3>
      <p>Discrimination is prohibited based on race, color, religion, sex, sexual orientation, gender identity, national origin, disability, familial status, source of income, or other protected characteristics.</p>
      <h3>19.3 Security Deposit (Civil Code § 1950.5)</h3>
      <p>Security deposit may not exceed two months' rent (three months for furnished units). Landlord shall return the deposit within 21 days of move-out with an itemized statement.</p>
      <h3>19.4 Rent Control Notice</h3>
      <p>If the property is subject to local rent control or the California Tenant Protection Act (AB 1482), Tenant has been notified of applicable rent increase limits and just cause eviction protections.</p>
      <h3>19.5 Mold Disclosure (Health and Safety Code § 26147)</h3>
      <p>Landlord discloses any known mold contamination that exceeds permissible exposure limits.</p>
      <h3>19.6 Lead-Based Paint Disclosure</h3>
      <p>For properties built before 1978, Landlord discloses all known lead-based paint hazards.</p>
      <h3>19.7 Entry Notice</h3>
      <p>Landlord shall provide at least 24 hours' written notice before entering the Premises except in emergencies.</p>
      <h3>19.8 Pest Control Disclosure</h3>
      <p>Landlord discloses any pest control treatments within the property as required by Civil Code § 1940.8.5.</p>
    `,
    FL: `
      <h2>19. FLORIDA STATE-SPECIFIC PROVISIONS</h2>
      <h3>19.1 Florida Residential Landlord and Tenant Act</h3>
      <p>This Lease is governed by Florida Statutes Chapter 83 (Florida Residential Landlord and Tenant Act).</p>
      <h3>19.2 Fair Housing Compliance</h3>
      <p>In accordance with the Florida Fair Housing Act (F.S. § 760.20-760.37), discrimination is prohibited based on race, color, religion, sex, national origin, familial status, or disability.</p>
      <h3>19.3 Security Deposit (F.S. § 83.49)</h3>
      <p>Landlord shall hold the security deposit in a Florida banking institution. Within 30 days of receiving the deposit, Landlord shall notify Tenant in writing of where the deposit is held. Deposit shall be returned within 15-60 days after lease termination depending on claims.</p>
      <h3>19.4 Radon Gas Disclosure (F.S. § 404.056)</h3>
      <p>RADON GAS: Radon is a naturally occurring radioactive gas that, when accumulated in a building in sufficient quantities, may present health risks. Levels that reduce risk vary from building to building. Radon testing is encouraged.</p>
      <h3>19.5 Lead-Based Paint Disclosure</h3>
      <p>For properties built before 1978, Landlord discloses all known lead-based paint hazards.</p>
      <h3>19.6 Entry Notice</h3>
      <p>Landlord shall provide at least 12 hours' notice before entering the Premises except in emergencies.</p>
    `,
    ID: `
      <h2>19. IDAHO STATE-SPECIFIC PROVISIONS</h2>
      <h3>19.1 Idaho Landlord Tenant Law</h3>
      <p>This Lease is governed by Idaho Code Title 6, Chapter 3 and Title 55, Chapter 2. Both parties acknowledge their rights and obligations under Idaho law.</p>
      <h3>19.2 Fair Housing Compliance</h3>
      <p>In accordance with the Idaho Fair Housing Act (Idaho Code § 67-5909), discrimination is prohibited based on race, color, religion, sex, national origin, or disability.</p>
      <h3>19.3 Security Deposit (Idaho Code § 6-321)</h3>
      <p>Landlord shall return the security deposit within 21 days of lease termination (or 30 days if lease specifies) with an itemized statement. No statutory limit on security deposit amount.</p>
      <h3>19.4 Lead-Based Paint Disclosure</h3>
      <p>For properties built before 1978, Landlord discloses all known lead-based paint hazards.</p>
      <h3>19.5 Entry Notice</h3>
      <p>Idaho law does not specify minimum notice, but reasonable notice is required except in emergencies.</p>
    `,
    MI: `
      <h2>19. MICHIGAN STATE-SPECIFIC PROVISIONS</h2>
      <h3>19.1 Michigan Truth in Renting Act</h3>
      <p>This Lease complies with the Michigan Truth in Renting Act (MCL 554.631 et seq.). Provisions that violate tenant rights under this Act are unenforceable.</p>
      <h3>19.2 Fair Housing Compliance</h3>
      <p>In accordance with the Elliott-Larsen Civil Rights Act (MCL 37.2101), discrimination is prohibited based on religion, race, color, national origin, age, sex, familial status, or marital status.</p>
      <h3>19.3 Security Deposit (MCL 554.602-616)</h3>
      <p>Security deposit may not exceed one and one-half months' rent. Landlord shall return the deposit within 30 days of lease termination with an itemized statement. Deposit must be held in a regulated financial institution.</p>
      <h3>19.4 Lead-Based Paint Disclosure</h3>
      <p>For properties built before 1978, Landlord discloses all known lead-based paint hazards.</p>
      <h3>19.5 Entry Notice</h3>
      <p>Michigan law does not specify minimum notice, but reasonable notice is required except in emergencies.</p>
      <h3>19.6 Inventory Checklist</h3>
      <p>Landlord shall provide Tenant with an inventory checklist to document the condition of the Premises at move-in as required by MCL 554.608.</p>
    `,
    NC: `
      <h2>19. NORTH CAROLINA STATE-SPECIFIC PROVISIONS</h2>
      <h3>19.1 North Carolina Residential Rental Agreements Act</h3>
      <p>This Lease is governed by N.C. Gen. Stat. Chapter 42. Both parties acknowledge their rights and obligations under North Carolina law.</p>
      <h3>19.2 Fair Housing Compliance</h3>
      <p>In accordance with the North Carolina Fair Housing Act (N.C. Gen. Stat. § 41A-1), discrimination is prohibited based on race, color, religion, sex, national origin, familial status, or disability.</p>
      <h3>19.3 Security Deposit (N.C. Gen. Stat. § 42-50-56)</h3>
      <p>Security deposit may not exceed two months' rent. Landlord shall hold the deposit in a trust account and return it within 30 days of lease termination with an itemized statement. Landlord shall notify Tenant of the location of the deposit.</p>
      <h3>19.4 Lead-Based Paint Disclosure</h3>
      <p>For properties built before 1978, Landlord discloses all known lead-based paint hazards.</p>
      <h3>19.5 Entry Notice</h3>
      <p>North Carolina law does not specify minimum notice, but reasonable notice is required except in emergencies.</p>
    `,
    NV: `
      <h2>19. NEVADA STATE-SPECIFIC PROVISIONS</h2>
      <h3>19.1 Nevada Revised Statutes Compliance</h3>
      <p>This Lease is governed by NRS Chapter 118A (Landlord and Tenant: Dwellings). Both parties acknowledge their rights and obligations under Nevada law.</p>
      <h3>19.2 Fair Housing Compliance</h3>
      <p>In accordance with the Nevada Fair Housing Law (NRS 118.010-120), discrimination is prohibited based on race, religious creed, color, national origin, disability, ancestry, familial status, sex, sexual orientation, or gender identity.</p>
      <h3>19.3 Security Deposit (NRS 118A.242)</h3>
      <p>Security deposit may not exceed three months' rent. Landlord shall return the deposit within 30 days of lease termination with an itemized statement.</p>
      <h3>19.4 Lead-Based Paint Disclosure</h3>
      <p>For properties built before 1978, Landlord discloses all known lead-based paint hazards.</p>
      <h3>19.5 Entry Notice (NRS 118A.330)</h3>
      <p>Landlord shall provide at least 24 hours' notice before entering the Premises except in emergencies.</p>
      <h3>19.6 Foreclosure Disclosure</h3>
      <p>Landlord must disclose if the property is subject to a notice of default, notice of sale, or pending foreclosure per NRS 118A.275.</p>
    `,
    OH: `
      <h2>19. OHIO STATE-SPECIFIC PROVISIONS</h2>
      <h3>19.1 Ohio Landlord-Tenant Law</h3>
      <p>This Lease is governed by Ohio Revised Code Chapter 5321 (Landlords and Tenants). Both parties acknowledge their rights and obligations under Ohio law.</p>
      <h3>19.2 Fair Housing Compliance</h3>
      <p>In accordance with the Ohio Fair Housing Law (ORC 4112.02), discrimination is prohibited based on race, color, religion, sex, familial status, national origin, disability, ancestry, or military status.</p>
      <h3>19.3 Security Deposit (ORC 5321.16)</h3>
      <p>Landlord shall return the security deposit within 30 days of lease termination with an itemized statement. If Tenant fails to provide a forwarding address, Landlord must hold the deposit for the Tenant for a reasonable period. No statutory limit on deposit amount.</p>
      <h3>19.4 Lead-Based Paint Disclosure</h3>
      <p>For properties built before 1978, Landlord discloses all known lead-based paint hazards. Ohio has additional lead disclosure requirements under ORC 3742.</p>
      <h3>19.5 Entry Notice</h3>
      <p>Landlord shall provide at least 24 hours' notice before entering the Premises except in emergencies per ORC 5321.04.</p>
    `,
    VA: `
      <h2>19. VIRGINIA STATE-SPECIFIC PROVISIONS</h2>
      <h3>19.1 Virginia Residential Landlord and Tenant Act</h3>
      <p>This Lease is governed by Virginia Code § 55.1-1200 et seq. (Virginia Residential Landlord and Tenant Act). Both parties acknowledge their rights and obligations under this Act.</p>
      <h3>19.2 Fair Housing Compliance</h3>
      <p>In accordance with the Virginia Fair Housing Law (Va. Code § 36-96.1), discrimination is prohibited based on race, color, religion, national origin, sex, elderliness, familial status, source of funds, sexual orientation, gender identity, military status, or disability.</p>
      <h3>19.3 Security Deposit (Va. Code § 55.1-1226)</h3>
      <p>Security deposit may not exceed two months' rent. Landlord shall return the deposit within 45 days of lease termination with an itemized statement.</p>
      <h3>19.4 Lead-Based Paint Disclosure</h3>
      <p>For properties built before 1978, Landlord discloses all known lead-based paint hazards.</p>
      <h3>19.5 Mold Disclosure</h3>
      <p>Landlord shall disclose visible mold in areas readily accessible within the dwelling unit per Va. Code § 55.1-1215.</p>
      <h3>19.6 Entry Notice</h3>
      <p>Landlord shall provide at least 24 hours' notice before entering the Premises except in emergencies.</p>
      <h3>19.7 Military Personnel Rights</h3>
      <p>Members of the armed forces have additional termination rights under the federal Servicemembers Civil Relief Act and Virginia law.</p>
    `,
    WY: `
      <h2>19. WYOMING STATE-SPECIFIC PROVISIONS</h2>
      <h3>19.1 Wyoming Landlord Tenant Law</h3>
      <p>This Lease is governed by Wyoming Statutes Title 1, Chapter 21 (Forcible Entry and Detainer) and Title 34 (Property). Both parties acknowledge their rights under Wyoming law.</p>
      <h3>19.2 Fair Housing Compliance</h3>
      <p>In accordance with the Wyoming Fair Housing Act (Wyo. Stat. § 40-26-101), discrimination is prohibited based on race, color, religion, sex, national origin, familial status, or disability.</p>
      <h3>19.3 Security Deposit (Wyo. Stat. § 1-21-1207-1208)</h3>
      <p>Landlord shall return the security deposit within 30 days of lease termination (or 15 days if no deductions) with an itemized statement. Deposit may not exceed the equivalent of two months' rent unless agreed.</p>
      <h3>19.4 Lead-Based Paint Disclosure</h3>
      <p>For properties built before 1978, Landlord discloses all known lead-based paint hazards.</p>
      <h3>19.5 Entry Notice</h3>
      <p>Wyoming law does not specify minimum notice, but reasonable notice is required except in emergencies.</p>
    `
  };

  return disclosures[stateId] || `
    <h2>19. STANDARD STATE DISCLOSURES</h2>
    <h3>Fair Housing Notice</h3>
    <p>This rental is offered without discrimination based on protected class status under applicable federal and state fair housing laws.</p>
    <h3>Lead-Based Paint Disclosure</h3>
    <p>For properties built before 1978, Landlord has disclosed all known lead-based paint hazards.</p>
    <h3>Security Deposit</h3>
    <p>Security deposit shall be returned in accordance with applicable state law after lease termination with an itemized statement of any deductions.</p>
  `;
}

function getStateDisclosures(stateId: string, templateTitle: string): string {
  // Check if this is a lease agreement
  if (templateTitle && (templateTitle.toLowerCase().includes('lease') || templateTitle.toLowerCase().includes('agreement'))) {
    return getComprehensiveLeaseContent(stateId, {});
  }
  
  const disclosures: Record<string, string> = {
    UT: `
      <h2>State-Specific Disclosures - Utah</h2>
      <p><strong>Fair Housing Act:</strong> It is illegal to discriminate in housing based on protected class status.</p>
      <p><strong>Radon:</strong> Radon is a naturally occurring radioactive gas that may accumulate in buildings.</p>
      <p><strong>Lead-Based Paint:</strong> For properties built before 1978, landlord must disclose all known lead-based paint hazards.</p>
    `,
    TX: `
      <h2>State-Specific Disclosures - Texas</h2>
      <p><strong>Fair Housing:</strong> Texas Property Code § 92.001 prohibits discrimination in rental housing.</p>
      <p><strong>Lead-Based Paint:</strong> Pre-1978 properties require disclosure of lead-based paint hazards per federal law.</p>
      <p><strong>Rights and Duties:</strong> See Texas Property Code Chapter 92 for tenant and landlord rights.</p>
    `,
    ND: `
      <h2>State-Specific Disclosures - North Dakota</h2>
      <p><strong>Fair Housing:</strong> N.D. Cent. Code § 14-02.4-01 prohibits discrimination in housing.</p>
      <p><strong>Security Deposits:</strong> Must be returned within 30 days per N.D. Cent. Code § 47-16-01.</p>
      <p><strong>Lead-Based Paint:</strong> Pre-1978 properties must have disclosed lead hazards.</p>
    `,
    SD: `
      <h2>State-Specific Disclosures - South Dakota</h2>
      <p><strong>Fair Housing:</strong> S.D. Codified Law § 20-13-1 prohibits rental discrimination.</p>
      <p><strong>Security Deposits:</strong> Must be returned within 14 days per S.D. Codified Law § 43-32-6.</p>
      <p><strong>Lead-Based Paint:</strong> Pre-1978 properties require lead hazard disclosure.</p>
    `
  };

  return disclosures[stateId] || `
    <h2>Mandatory Disclosures</h2>
    <p><strong>Fair Housing:</strong> Housing offered without discrimination based on protected status.</p>
  `;
}

function generateSignaturePage(): string {
  return `
    <div style="page-break-before: always; padding-top: 50pt;">
      <h2 style="text-align: center; text-transform: uppercase; letter-spacing: 2pt; border-bottom: 3px double #1a1a1a; padding-bottom: 12pt;">SIGNATURE PAGE</h2>
      <p style="text-align: center; margin-top: 30pt; margin-bottom: 50pt; font-style: italic; font-size: 11pt;">
        IN WITNESS WHEREOF, the parties hereto have executed this document on the date(s) shown below.
      </p>
      
      <div class="signature-section" style="margin-top: 50pt; margin-bottom: 50pt; border: 2px solid #e0e0e0; padding: 20pt; background-color: #fafafa;">
        <p style="font-size: 11pt; font-weight: bold; letter-spacing: 1pt; margin-bottom: 20pt; text-transform: uppercase;">LANDLORD/PROPERTY OWNER:</p>
        <p style="margin-top: 40pt; border-bottom: 2px solid #000; width: 400pt; padding-bottom: 2pt;">Signature</p>
        <p style="margin-top: 20pt; border-bottom: 1px solid #666; width: 400pt; padding-bottom: 2pt;">Print Name</p>
        <p style="margin-top: 20pt; border-bottom: 1px solid #666; width: 250pt; padding-bottom: 2pt;">Date</p>
      </div>
      
      <div class="signature-section" style="margin-top: 50pt; margin-bottom: 50pt; border: 2px solid #e0e0e0; padding: 20pt; background-color: #fafafa;">
        <p style="font-size: 11pt; font-weight: bold; letter-spacing: 1pt; margin-bottom: 20pt; text-transform: uppercase;">TENANT/LESSEE:</p>
        <p style="margin-top: 40pt; border-bottom: 2px solid #000; width: 400pt; padding-bottom: 2pt;">Signature</p>
        <p style="margin-top: 20pt; border-bottom: 1px solid #666; width: 400pt; padding-bottom: 2pt;">Print Name</p>
        <p style="margin-top: 20pt; border-bottom: 1px solid #666; width: 250pt; padding-bottom: 2pt;">Date</p>
      </div>
      
      <div class="signature-section" style="margin-top: 50pt; margin-bottom: 50pt; border: 2px solid #e0e0e0; padding: 20pt; background-color: #fafafa;">
        <p style="font-size: 11pt; font-weight: bold; letter-spacing: 1pt; margin-bottom: 20pt; text-transform: uppercase;">ADDITIONAL OCCUPANT/CO-TENANT (if applicable):</p>
        <p style="margin-top: 40pt; border-bottom: 2px solid #000; width: 400pt; padding-bottom: 2pt;">Signature</p>
        <p style="margin-top: 20pt; border-bottom: 1px solid #666; width: 400pt; padding-bottom: 2pt;">Print Name</p>
        <p style="margin-top: 20pt; border-bottom: 1px solid #666; width: 250pt; padding-bottom: 2pt;">Date</p>
      </div>
      
      <div style="margin-top: 60pt; padding: 15pt; background-color: #f5f5f5; border: 1px solid #ccc;">
        <p style="text-align: center; font-size: 9pt; color: #555; line-height: 1.6; margin: 0;">
          <strong>EXECUTION IN COUNTERPARTS:</strong> This signature page may be executed in multiple counterparts, 
          each of which shall be deemed an original and all of which together shall constitute one and the same instrument. 
          Facsimile and electronic signatures shall have the same force and effect as original signatures.
        </p>
      </div>
    </div>
  `;
}

function getRentalApplicationContent(fieldValues: FieldValue, stateId: string): string {
  return `
    <h1>RENTAL APPLICATION</h1>
    
    <h2>1. APPLICANT INFORMATION</h2>
    <p><strong>Full Name:</strong> ${escapeHtml(String(fieldValues.applicantName) || '_____________________')}</p>
    <p><strong>Date of Birth:</strong> ${escapeHtml(String(fieldValues.applicantDOB) || '_____________________')}</p>
    <p><strong>Social Security Number:</strong> ${escapeHtml(String(fieldValues.applicantSSN) || '_____________________')}</p>
    <p><strong>Phone:</strong> ${escapeHtml(String(fieldValues.applicantPhone) || '_____________________')}</p>
    <p><strong>Email:</strong> ${escapeHtml(String(fieldValues.applicantEmail) || '_____________________')}</p>
    
    <h2>2. CURRENT RESIDENCE</h2>
    <p><strong>Current Address:</strong> ${escapeHtml(String(fieldValues.currentAddress) || '_____________________')}</p>
    <p><strong>Current Landlord:</strong> ${escapeHtml(String(fieldValues.currentLandlord) || '_____________________')}</p>
    <p><strong>Landlord Phone:</strong> ${escapeHtml(String(fieldValues.currentLandlordPhone) || '_____________________')}</p>
    <p><strong>Time at Current Address:</strong> ${escapeHtml(String(fieldValues.monthsAtCurrentAddress) || '_____')} months</p>
    
    <h2>3. EMPLOYMENT INFORMATION</h2>
    <p><strong>Current Employer:</strong> ${escapeHtml(String(fieldValues.employer) || '_____________________')}</p>
    <p><strong>Job Title:</strong> ${escapeHtml(String(fieldValues.jobTitle) || '_____________________')}</p>
    <p><strong>Employer Phone:</strong> ${escapeHtml(String(fieldValues.employerPhone) || '_____________________')}</p>
    <p><strong>Monthly Gross Income:</strong> $${escapeHtml(String(fieldValues.monthlyIncome) || '_____________________')}</p>
    
    <h2>4. EMERGENCY CONTACT</h2>
    <p><strong>Emergency Contact Name:</strong> ${escapeHtml(String(fieldValues.emergencyContact) || '_____________________')}</p>
    <p><strong>Emergency Contact Phone:</strong> ${escapeHtml(String(fieldValues.emergencyPhone) || '_____________________')}</p>
    
    <h2>5. BACKGROUND AUTHORIZATION AND ACKNOWLEDGMENTS</h2>
    <p>I/We authorize Landlord to conduct a comprehensive background investigation including but not limited to credit report, criminal background check, eviction history, and tenant history verification. I/We understand that false or misleading information on this application may result in immediate denial or termination of tenancy.</p>
    <p>I/We certify that all information provided is true and accurate. I/We acknowledge receipt of the Fair Housing Notice and agree to comply with all lease terms and applicable laws.</p>
    ${getStateDisclosuresExpanded(stateId)}
    
    ${generateSignaturePage()}
  `;
}

function getNoticeContent(fieldValues: FieldValue, stateId: string, noticeType: string): string {
  const titleLower = noticeType.toLowerCase();
  let noticeContent = '';
  
  // Late Rent / Pay or Quit Notices
  if (titleLower.includes('late rent') || titleLower.includes('pay or quit') || 
      titleLower.includes('notice to vacate') && titleLower.includes('3-day') || 
      titleLower.includes('demand for rent')) {
    const stateCitations: Record<string, string> = {
      UT: 'Utah Code § 78B-6-802',
      TX: 'Texas Property Code § 24.005',
      ND: 'North Dakota Century Code § 47-32-01',
      SD: 'South Dakota Codified Laws § 21-16'
    };
    const daysPeriod = titleLower.includes('3-day') ? 'three (3)' : 'three (3)';
    
    noticeContent = `
      <h2>NOTICE TO PAY RENT OR VACATE</h2>
      
      <p style="margin-top: 20pt;"><strong>TO:</strong> ${escapeHtml(String(fieldValues.tenantName) || '[TENANT NAME]')} and all other occupants</p>
      <p><strong>PROPERTY ADDRESS:</strong> ${escapeHtml(String(fieldValues.propertyAddress) || '[PROPERTY ADDRESS]')}</p>
      <p><strong>DATE OF NOTICE:</strong> ${escapeHtml(String(fieldValues.noticeDate) || '[DATE]')}</p>
      
      <p style="margin-top: 20pt;">NOTICE IS HEREBY GIVEN that you are in default of your rental obligations under the Lease Agreement for the above-referenced property. As of the date of this notice, you owe the following:</p>
      
      <h2>AMOUNT DUE</h2>
      <p><strong>Rent Due Date:</strong> ${escapeHtml(String(fieldValues.rentDueDate) || '[DUE DATE]')}</p>
      <p><strong>Monthly Rent Amount:</strong> $${escapeHtml(String(fieldValues.amountDue) || '[AMOUNT]')}</p>
      <p><strong>Late Fee (if applicable):</strong> $${escapeHtml(String(fieldValues.lateFeeAmount) || '0.00')}</p>
      <p><strong>TOTAL AMOUNT DUE:</strong> $${(parseFloat(String(fieldValues.amountDue) || '0') + parseFloat(String(fieldValues.lateFeeAmount) || '0')).toFixed(2)}</p>
      
      <h2>DEMAND FOR PAYMENT</h2>
      <p>You are hereby required to pay the full amount due stated above within ${daysPeriod} days from the date of this notice, or to vacate and deliver possession of the Premises on or before ${escapeHtml(String(fieldValues.payByDate) || '[PAY BY DATE]')}.  </p>
      
      <p>Payment must be made in full and tendered in the form of cashier's check, money order, or certified funds. Personal checks may not be accepted. Payment must be delivered to:</p>
      <p><strong>Payment Address:</strong> ${escapeHtml(String(fieldValues.landlordName) || '[LANDLORD NAME]')}<br/>
      ${escapeHtml(String(fieldValues.landlordAddress) || '[LANDLORD ADDRESS]')}</p>
      
      <h2>FAILURE TO COMPLY</h2>
      <p>If you fail to pay the total amount due OR fail to vacate the Premises within the time period stated above, Landlord will commence legal action to terminate your tenancy and seek possession of the Premises through eviction proceedings. You will be liable for court costs, attorney fees, and any additional rent and damages incurred.</p>
      
      <h2>NO WAIVER OF RIGHTS</h2>
      <p>This notice does not constitute a waiver of Landlord's right to pursue eviction or other legal remedies. Acceptance of partial payment does not waive Landlord's right to the full amount due or the right to terminate the tenancy.</p>
      
      <h2>LEGAL AUTHORITY</h2>
      <p>This notice is provided pursuant to ${stateCitations[stateId] || 'applicable state law'} and the terms of your Lease Agreement dated ${escapeHtml(String(fieldValues.leaseDate) || '[LEASE DATE]')}.</p>
      
      <h2>CONTACT INFORMATION</h2>
      <p>If you have questions about this notice, contact:</p>
      <p>${escapeHtml(String(fieldValues.landlordName) || '[LANDLORD]')}<br/>
      Phone: ${escapeHtml(String(fieldValues.landlordPhone) || '[PHONE]')}<br/>
      Email: ${escapeHtml(String(fieldValues.landlordEmail) || '[EMAIL]')}</p>
    `;
  } else if (titleLower.includes('lease violation') || titleLower.includes('cure or quit')) {
    const daysPeriod = titleLower.includes('5-day') ? 'five (5)' : titleLower.includes('3-day') ? 'three (3)' : 'five (5)';
    
    noticeContent = `
      <h2>NOTICE OF LEASE VIOLATION</h2>
      
      <p style="margin-top: 20pt;"><strong>TO:</strong> ${escapeHtml(String(fieldValues.tenantName) || '[TENANT NAME]')} and all other occupants</p>
      <p><strong>PROPERTY ADDRESS:</strong> ${escapeHtml(String(fieldValues.propertyAddress) || '[PROPERTY ADDRESS]')}</p>
      <p><strong>DATE OF NOTICE:</strong> ${escapeHtml(String(fieldValues.noticeDate) || '[DATE]')}</p>
      
      <p style="margin-top: 20pt;">NOTICE IS HEREBY GIVEN that you are in violation of your Lease Agreement for the above-referenced property. This notice serves as formal notification of said violation(s) and provides you the opportunity to cure as specified herein.</p>
      
      <h2>VIOLATION DETAILS</h2>
      <p><strong>Description of Violation:</strong></p>
      <p>${escapeHtml(String(fieldValues.violationDescription) || '[DESCRIBE THE SPECIFIC LEASE VIOLATION]')}</p>
      
      <p><strong>Violated Lease Provision:</strong> ${escapeHtml(String(fieldValues.leaseClause) || '[REFERENCE TO LEASE SECTION/CLAUSE]')}</p>
      
      <p><strong>Date(s) of Violation:</strong> ${escapeHtml(String(fieldValues.violationDate) || '[DATE OF VIOLATION]')}</p>
      
      <h2>REQUIRED CORRECTIVE ACTION</h2>
      <p>You are required to cure (correct) the above violation(s) within ${daysPeriod} days from the date of this notice. Specifically, you must:</p>
      <p>${escapeHtml(String(fieldValues.correctiveAction) || '[DESCRIBE WHAT TENANT MUST DO TO CURE THE VIOLATION]')}</p>
      
      <p><strong>Deadline to Cure:</strong> ${escapeHtml(String(fieldValues.correctionDeadline) || '[CORRECTION DEADLINE DATE]')} by 11:59 PM</p>
      
      <h2>FAILURE TO CURE</h2>
      <p>If you fail to cure the violation(s) described above within the specified time period, Landlord will proceed with legal action to terminate your tenancy and seek possession of the Premises through eviction proceedings. You will be liable for court costs, attorney fees, and any damages incurred.</p>
      
      <h2>DOCUMENTATION</h2>
      <p>Landlord may document compliance or non-compliance through inspections, photographs, witness statements, or other evidence as necessary to enforce the Lease Agreement and protect the Premises.</p>
      
      <h2>REPEATED VIOLATIONS</h2>
      <p>If this is a repeated violation of the same lease provision, Landlord reserves the right to proceed directly with eviction proceedings without opportunity to cure, as permitted by law and the Lease Agreement.</p>
      
      <h2>NO WAIVER OF RIGHTS</h2>
      <p>This notice does not constitute a waiver of Landlord's rights to enforce all provisions of the Lease Agreement or pursue other legal remedies. Landlord reserves all rights under the Lease Agreement and applicable law.</p>
      
      <h2>CONTACT INFORMATION</h2>
      <p>If you have questions about this notice or need clarification on how to cure the violation, contact:</p>
      <p>${escapeHtml(String(fieldValues.landlordName) || '[LANDLORD]')}<br/>
      Phone: ${escapeHtml(String(fieldValues.landlordPhone) || '[PHONE]')}<br/>
      Email: ${escapeHtml(String(fieldValues.landlordEmail) || '[EMAIL]')}</p>
    `;
  } else if (titleLower.includes('rent increase')) {
    const daysPeriod = titleLower.includes('30-day') ? 'thirty (30)' : 'thirty (30)';
    
    noticeContent = `
      <h2>NOTICE OF RENT INCREASE</h2>
      
      <p style="margin-top: 20pt;"><strong>TO:</strong> ${escapeHtml(String(fieldValues.tenantName) || '[TENANT NAME]')}</p>
      <p><strong>PROPERTY ADDRESS:</strong> ${escapeHtml(String(fieldValues.propertyAddress) || '[PROPERTY ADDRESS]')}</p>
      <p><strong>DATE OF NOTICE:</strong> ${escapeHtml(String(fieldValues.noticeDate) || '[DATE]')}</p>
      
      <p style="margin-top: 20pt;">NOTICE IS HEREBY GIVEN that your monthly rent will be increased effective ${escapeHtml(String(fieldValues.effectiveDate) || '[EFFECTIVE DATE]')}, in accordance with the terms of your month-to-month rental agreement.</p>
      
      <h2>RENT INCREASE DETAILS</h2>
      <p><strong>Current Monthly Rent:</strong> $${escapeHtml(String(fieldValues.currentRent) || '[CURRENT AMOUNT]')}</p>
      <p><strong>New Monthly Rent:</strong> $${escapeHtml(String(fieldValues.newRent) || '[NEW AMOUNT]')}</p>
      <p><strong>Increase Amount:</strong> $${(parseFloat(String(fieldValues.newRent) || '0') - parseFloat(String(fieldValues.currentRent) || '0')).toFixed(2)}</p>
      <p><strong>Effective Date:</strong> ${escapeHtml(String(fieldValues.effectiveDate) || '[EFFECTIVE DATE]')}</p>
      
      <h2>PAYMENT INFORMATION</h2>
      <p>Beginning ${escapeHtml(String(fieldValues.effectiveDate) || '[EFFECTIVE DATE]')}, your monthly rent payment of $${escapeHtml(String(fieldValues.newRent) || '[NEW AMOUNT]')} will be due on the ${escapeHtml(String(fieldValues.rentDueDay) || '1st')} day of each month.</p>
      
      <p>All other terms and conditions of your rental agreement remain in effect and unchanged.</p>
      
      <h2>YOUR OPTIONS</h2>
      <p>You have the following options:</p>
      <p><strong>1. Accept the Rent Increase:</strong> Continue your tenancy at the new rent amount beginning on the effective date specified above.</p>
      <p><strong>2. Terminate Tenancy:</strong> Provide ${daysPeriod} days written notice to terminate your month-to-month tenancy in accordance with your rental agreement.</p>
      
      <h2>REQUIRED NOTICE PERIOD</h2>
      <p>This notice is provided ${daysPeriod} days in advance of the effective date, in compliance with ${stateId} law and the terms of your rental agreement.</p>
      
      <h2>CONTACT INFORMATION</h2>
      <p>If you have questions about this rent increase, please contact:</p>
      <p>${escapeHtml(String(fieldValues.landlordName) || '[LANDLORD]')}<br/>
      Phone: ${escapeHtml(String(fieldValues.landlordPhone) || '[PHONE]')}<br/>
      Email: ${escapeHtml(String(fieldValues.landlordEmail) || '[EMAIL]')}</p>
    `;
  } else if (titleLower.includes('eviction') || titleLower.includes('notice to quit')) {
    noticeContent = `
      <h2>1. NOTICE TO VACATE</h2>
      <p>TO: ${escapeHtml(String(fieldValues.tenantName) || '[TENANT NAME]')} and all occupants</p>
      <p>AT: ${escapeHtml(String(fieldValues.propertyAddress) || '[ADDRESS]')}, ${escapeHtml(String(fieldValues.propertyCity) || '[CITY]')}, ${stateId} ${escapeHtml(String(fieldValues.propertyZip) || '[ZIP]')}</p>
      
      <p style="margin-top: 20pt;"><strong>NOTICE IS HEREBY GIVEN</strong> that Tenant is required to vacate the above-referenced Premises on or before ${escapeHtml(String(fieldValues.vacateDate) || '[DATE]')} at 11:59 PM, which is the expiration of the notice period required by law, or as provided in the Lease Agreement.</p>
      
      <h2>2. REASON FOR NOTICE TO VACATE</h2>
      <p>This notice is given for the following reason:</p>
      <p>☐ Non-payment of rent ☐ Lease violation ☐ End of lease term ☐ Other: _____________________</p>
      
      <h2>3. OUTSTANDING OBLIGATIONS</h2>
      <p>Tenant is responsible for all unpaid rent, utilities, damages, and other charges due under the Lease Agreement as of the date of this notice.</p>
      
      <h2>4. MOVE-OUT REQUIREMENTS</h2>
      <p>Upon vacating, Tenant shall: (a) remove all personal property; (b) clean the Premises thoroughly; (c) return all keys and access devices; (d) leave utilities in operational condition; and (e) comply with all move-out requirements specified in the Lease Agreement.</p>
      
      <h2>5. SECURITY DEPOSIT AND FINAL ACCOUNTING</h2>
      <p>Landlord shall return the security deposit within the time period required by ${stateId} law, less any lawful deductions, with an itemized accounting of any deductions.</p>
      
      <h2>6. FINAL WALK-THROUGH</h2>
      <p>Landlord shall conduct a final walk-through inspection. Tenant may be present during this inspection. Any damages or violations will be documented.</p>
      
      <h2>7. FAILURE TO VACATE</h2>
      <p>If Tenant fails to vacate the Premises by the date specified above, Landlord reserves all legal rights and remedies, including filing for eviction proceedings in court. Tenant shall be liable for all court costs, attorney fees, and additional rent for any days in which Tenant remains in occupancy.</p>
      
      <h2>8. DELIVERY OF NOTICE</h2>
      <p>This notice has been delivered to Tenant via: ☐ Personal delivery ☐ Certified mail ☐ Posted on door</p>
      <p>Date of Notice: _____________________ | Delivered By: _____________________</p>
    `;
  } else if (titleLower.includes('maintenance') || titleLower.includes('repair')) {
    noticeContent = `
      <h2>1. NOTICE OF MAINTENANCE OR REPAIR WORK</h2>
      <p>TO: ${escapeHtml(String(fieldValues.tenantName) || '[TENANT NAME]')} and all occupants</p>
      <p>AT: ${escapeHtml(String(fieldValues.propertyAddress) || '[ADDRESS]')}, ${escapeHtml(String(fieldValues.propertyCity) || '[CITY]')}, ${stateId} ${escapeHtml(String(fieldValues.propertyZip) || '[ZIP]')}</p>
      
      <p style="margin-top: 20pt;"><strong>NOTICE IS HEREBY GIVEN</strong> that Landlord or authorized contractors shall enter the Premises for the purpose of conducting maintenance, repairs, or inspections.</p>
      
      <h2>2. REPAIR DETAILS</h2>
      <p>Nature of Work: _________________________________________________________________________</p>
      <p>Scheduled Date(s): ${escapeHtml(String(fieldValues.repairDate) || '[DATE]')} | Estimated Duration: _____________________</p>
      <p>Contractor: _____________________ | Contact: _____________________</p>
      
      <h2>3. ENTRY NOTICE REQUIREMENTS</h2>
      <p>Landlord provides this notice in accordance with state law requirements. Entry shall be at a reasonable time during normal business hours, or as otherwise specified below.</p>
      <p>Proposed Entry Time: _____________________ | Access Instructions: _____________________</p>
      
      <h2>4. TENANT RESPONSIBILITIES</h2>
      <p>Tenant shall (a) ensure access to all areas requiring work; (b) secure personal items; (c) remove obstacles; and (d) be present if possible to grant access.</p>
      
      <h2>5. LIABILITY AND INSURANCE</h2>
      <p>Landlord maintains liability insurance for such repairs. Tenant should ensure personal items are protected. Tenant is advised to obtain renter's insurance for personal property protection.</p>
      
      <h2>6. EMERGENCY REPAIRS</h2>
      <p>In case of emergency affecting health or safety, Landlord or emergency responders may enter without prior notice to address the emergency.</p>
    `;
  } else if (titleLower.includes('security deposit') || titleLower.includes('deposit')) {
    noticeContent = `
      <h2>1. SECURITY DEPOSIT HANDLING NOTICE</h2>
      <p>TO: ${escapeHtml(String(fieldValues.tenantName) || '[TENANT NAME]')} and all occupants</p>
      <p>FROM: ${escapeHtml(String(fieldValues.landlordName) || '[LANDLORD NAME]')}</p>
      <p>RE: Security Deposit for ${escapeHtml(String(fieldValues.propertyAddress) || '[ADDRESS]')}</p>
      
      <h2>2. SECURITY DEPOSIT ACCOUNTING</h2>
      <p>Initial Security Deposit: $${escapeHtml(String(fieldValues.securityDeposit) || '[AMOUNT]')}</p>
      <p>Date Received: _____________________ | Amount Returned: $_____________________</p>
      <p>Deductions Itemized Below:</p>
      <p>• Unpaid Rent: $_____________________ • Damages: $_____________________ • Cleaning: $_____________________ • Other: $_____________________</p>
      <p>TOTAL DEDUCTIONS: $_____________________ | NET AMOUNT DUE TO TENANT: $_____________________</p>
      
      <h2>3. ITEMIZED DEDUCTIONS</h2>
      <p>Description of Deduction 1: _____________________ | Cost: $_____________________</p>
      <p>Description of Deduction 2: _____________________ | Cost: $_____________________</p>
      <p>Description of Deduction 3: _____________________ | Cost: $_____________________</p>
      
      <h2>4. DEPOSIT RETURN TIMELINE</h2>
      <p>Pursuant to ${stateId} law, the security deposit (or itemized deductions) shall be returned within the legally required timeframe from lease termination.</p>
      
      <h2>5. DISPUTE RESOLUTION</h2>
      <p>If Tenant disputes any deductions, Tenant shall notify Landlord in writing within the time period specified by state law. Disputes not timely raised shall be deemed accepted by Tenant.</p>
      
      <h2>6. STATUTORY COMPLIANCE</h2>
      <p>Landlord certifies that this accounting complies with all security deposit requirements under ${stateId} law regarding handling, accounting, and return of deposits.</p>
    `;
  }
  
  return noticeContent + getStateDisclosuresExpanded(stateId) + generateSignaturePage();
}

function getChecklistContent(fieldValues: FieldValue, stateId: string, checklistType: string): string {
  const titleLower = checklistType.toLowerCase();
  let checklistContent = '';
  
  if (titleLower.includes('move-in') || titleLower.includes('move in')) {
    checklistContent = `
      <h1>MOVE-IN INSPECTION CHECKLIST</h1>
      
      <h2>PROPERTY INFORMATION</h2>
      <p>Address: ${escapeHtml(String(fieldValues.propertyAddress) || '[ADDRESS]')}</p>
      <p>Tenant Name: ${escapeHtml(String(fieldValues.tenantName) || '[TENANT]')} | Move-In Date: ${escapeHtml(String(fieldValues.leaseStartDate) || '[DATE]')}</p>
      <p>Landlord/Inspector: ${escapeHtml(String(fieldValues.landlordName) || '[LANDLORD]')} | Inspection Date: _____________________</p>
      
      <h2>INSPECTION INSTRUCTIONS</h2>
      <p>This checklist documents the condition of the Premises at the time Tenant takes occupancy. Check boxes to indicate condition: G (Good), F (Fair), P (Poor), or D (Damaged). Write comments for any concerns.</p>
      <p>All parties acknowledge that this checklist accurately reflects the condition of the Premises at move-in. Tenant acknowledges receipt of the Premises in the condition documented herein.</p>
      
      <h2>INTERIOR INSPECTION</h2>
      <p><strong>Living Areas:</strong> ☐ Walls ☐ Flooring ☐ Ceiling ☐ Lighting ☐ Windows ☐ Doors</p>
      <p><strong>Kitchen:</strong> ☐ Appliances ☐ Cabinets ☐ Countertops ☐ Sink ☐ Faucet ☐ Flooring</p>
      <p><strong>Bedrooms:</strong> ☐ Walls ☐ Flooring ☐ Closets ☐ Windows ☐ Doors ☐ Ceiling</p>
      <p><strong>Bathrooms:</strong> ☐ Toilet ☐ Sink ☐ Tub/Shower ☐ Flooring ☐ Walls ☐ Lighting</p>
      <p><strong>Utilities:</strong> ☐ Heating ☐ Cooling ☐ Water Heater ☐ Electrical ☐ Gas ☐ Plumbing</p>
      
      <h2>EXTERIOR INSPECTION</h2>
      <p><strong>Exterior:</strong> ☐ Roof ☐ Siding ☐ Windows ☐ Doors ☐ Deck/Patio ☐ Landscaping ☐ Parking</p>
      
      <h2>COMMENTS AND CONDITIONS</h2>
      <p>_________________________________________________________________________________________</p>
      <p>_________________________________________________________________________________________</p>
      <p>_________________________________________________________________________________________</p>
      
      <h2>KEYS, REMOTES, AND ACCESS</h2>
      <p>Number of Keys Provided: _____ | Remote Controls: _____ | Access Codes: _____ | Garage Door Opener: _____</p>
      <p>Special Instructions: _______________________________________________________________________</p>
      
      <h2>UTILITY READINGS</h2>
      <p>Electricity Meter Reading: _____________________ | Gas Meter Reading: _____________________</p>
      <p>Water Meter Reading: _____________________ | Date/Time Read: _____________________</p>
      
      <h2>ACKNOWLEDGMENTS</h2>
      <p>Tenant acknowledges: (a) receipt of the Premises in the condition documented; (b) opportunity to inspect fully; (c) all existing damage has been noted; and (d) any damage not documented is considered pre-existing and Tenant accepts the Premises "AS-IS" for undocumented conditions.</p>
    `;
  } else if (titleLower.includes('move-out') || titleLower.includes('move out')) {
    checklistContent = `
      <h1>MOVE-OUT INSPECTION CHECKLIST</h1>
      
      <h2>PROPERTY INFORMATION</h2>
      <p>Address: ${escapeHtml(String(fieldValues.propertyAddress) || '[ADDRESS]')}</p>
      <p>Tenant Name: ${escapeHtml(String(fieldValues.tenantName) || '[TENANT]')} | Move-Out Date: ${escapeHtml(String(fieldValues.leaseEndDate) || '[DATE]')}</p>
      <p>Landlord/Inspector: ${escapeHtml(String(fieldValues.landlordName) || '[LANDLORD]')} | Inspection Date: _____________________</p>
      
      <h2>FINAL CONDITION ASSESSMENT</h2>
      <p>This checklist documents the condition of the Premises at move-out and identifies any deductions from security deposit. All damage beyond normal wear and tear will be noted and charged to Tenant.</p>
      
      <h2>INTERIOR INSPECTION</h2>
      <p><strong>Cleanliness:</strong> ☐ Walls (clean) ☐ Flooring (clean) ☐ Ceiling (clean) ☐ Windows (clean) ☐ Doors (clean)</p>
      <p><strong>Condition:</strong> ☐ Walls (no damage) ☐ Flooring (no damage) ☐ Ceiling (no damage) ☐ Fixtures (intact)</p>
      <p><strong>Kitchen:</strong> ☐ Appliances (clean) ☐ Cabinets (clean) ☐ Countertops (clean) ☐ No debris</p>
      <p><strong>Bathrooms:</strong> ☐ Fixtures (clean) ☐ Mold/mildew (none) ☐ Caulking (intact) ☐ Floors (clean)</p>
      
      <h2>DAMAGES AND DEDUCTIONS</h2>
      <p>Damage Description: ________________________________________________________________________</p>
      <p>Location: _____________________ | Estimated Repair Cost: $_____________________ </p>
      <p>Damage Description: ________________________________________________________________________</p>
      <p>Location: _____________________ | Estimated Repair Cost: $_____________________</p>
      
      <h2>KEYS AND ACCESS</h2>
      <p>☐ All keys returned ☐ Remotes returned ☐ Access codes disabled ☐ Garage openers returned</p>
      <p>Missing/Damaged Items: _____________________________________________________________________</p>
      
      <h2>UTILITY READINGS AT MOVE-OUT</h2>
      <p>Electricity Meter Reading: _____________________ | Gas Meter Reading: _____________________</p>
      <p>Water Meter Reading: _____________________ | Date/Time Read: _____________________</p>
      
      <h2>FINAL SETTLEMENT</h2>
      <p>Security Deposit Applied: $_____________________ | Total Deductions: $_____________________ </p>
      <p>Amount Due to Tenant: $_____________________ | Date Check Mailed: _____________________</p>
      
      <h2>NOTES</h2>
      <p>_________________________________________________________________________________________</p>
      <p>_________________________________________________________________________________________</p>
    `;
  }
  
  return checklistContent + getStateDisclosuresExpanded(stateId) + generateSignaturePage();
}

function generateDefaultTemplateContent(
  safeTitle: string,
  fieldValues: FieldValue,
  safeStateId: string,
  version: number = 1,
  updatedAt: Date = new Date()
): string {
  const titleLower = safeTitle.toLowerCase();
  
  // Route to comprehensive legal content based on template type
  if (titleLower.includes('lease') || titleLower.includes('agreement')) {
    return getComprehensiveLeaseContent(safeStateId, fieldValues) + generateSignaturePage();
  }
  
  if (titleLower.includes('rental application') || titleLower.includes('application')) {
    return getRentalApplicationContent(fieldValues, safeStateId);
  }
  
  if (titleLower.includes('notice') || titleLower.includes('eviction') || 
      titleLower.includes('maintenance') || titleLower.includes('repair') ||
      titleLower.includes('deposit') || titleLower.includes('vacate')) {
    return getNoticeContent(fieldValues, safeStateId, safeTitle);
  }
  
  if (titleLower.includes('checklist') || titleLower.includes('move-in') || 
      titleLower.includes('move-out') || titleLower.includes('inspection')) {
    return getChecklistContent(fieldValues, safeStateId, safeTitle);
  }
  
  // Fallback for any other document type
  const sections: string[] = [];
  sections.push(`<h1>${safeTitle}</h1>`);
  
  const categories = new Map<string, Array<[string, any]>>();
  Object.entries(fieldValues).forEach(([fieldId, value]) => {
    let category = 'General Information';
    if (fieldId.includes('landlord')) category = 'Landlord Information';
    else if (fieldId.includes('tenant')) category = 'Tenant Information';
    else if (fieldId.includes('property')) category = 'Property Details';
    else if (fieldId.includes('rent') || fieldId.includes('deposit') || fieldId.includes('fee')) category = 'Financial Terms';
    
    if (!categories.has(category)) {
      categories.set(category, []);
    }
    categories.get(category)!.push([fieldId, value]);
  });
  
  categories.forEach((fields, category) => {
    const safeCategory = escapeHtml(category);
    sections.push(`<h2>${safeCategory}</h2>`);
    fields.forEach(([fieldId, value]) => {
      const label = fieldIdToLabel(fieldId);
      const safeLabel = escapeHtml(label);
      const safeValue = escapeHtml(String(value));
      sections.push(`<p><strong>${safeLabel}:</strong> <span class="field-value">${safeValue}</span></p>`);
    });
  });
  
  sections.push(getStateDisclosures(safeStateId, safeTitle));
  sections.push(generateSignaturePage());
  
  return sections.join('\n');
}

function fieldIdToLabel(fieldId: string): string {
  // Convert camelCase to Title Case
  return fieldId
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}
