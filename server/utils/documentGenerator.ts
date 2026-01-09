import puppeteer from 'puppeteer';
import { execSync } from 'child_process';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, PageBreak } from 'docx';

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
  const { templateTitle, fieldValues, stateId, version = 1, updatedAt = new Date(), landlordInfo } = options;
  
  console.log('📝 Generating DOCX document...');
  const startTime = Date.now();
  
  // Build document sections
  const sections: Paragraph[] = [];
  
  // Add header with landlord info
  if (landlordInfo?.businessName) {
    sections.push(new Paragraph({
      children: [new TextRun({ text: landlordInfo.businessName, bold: true, size: 32 })],
      alignment: AlignmentType.CENTER,
    }));
  }
  
  // Add contact info
  const contactParts: string[] = [];
  if (landlordInfo?.phoneNumber) contactParts.push(landlordInfo.phoneNumber);
  if (landlordInfo?.email) contactParts.push(landlordInfo.email);
  if (contactParts.length > 0) {
    sections.push(new Paragraph({
      children: [new TextRun({ text: contactParts.join(' | '), size: 20 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }));
  }
  
  // Add document title
  sections.push(new Paragraph({
    children: [new TextRun({ text: templateTitle.toUpperCase(), bold: true, size: 28 })],
    alignment: AlignmentType.CENTER,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200 },
  }));
  
  // Add state badge
  sections.push(new Paragraph({
    children: [new TextRun({ text: `State: ${stateId}`, size: 22 })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
  }));
  
  // Add version info
  sections.push(new Paragraph({
    children: [
      new TextRun({ text: 'Document Version: ', bold: true, size: 20 }),
      new TextRun({ text: String(version), size: 20 }),
    ],
  }));
  sections.push(new Paragraph({
    children: [
      new TextRun({ text: 'Last Updated: ', bold: true, size: 20 }),
      new TextRun({ text: new Date(updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), size: 20 }),
    ],
  }));
  sections.push(new Paragraph({
    children: [
      new TextRun({ text: 'Generated: ', bold: true, size: 20 }),
      new TextRun({ text: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), size: 20 }),
    ],
    spacing: { after: 400 },
  }));
  
  // Add field values as sections
  const fieldOrder = [
    { key: 'landlordName', label: 'Landlord' },
    { key: 'tenantName', label: 'Tenant(s)' },
    { key: 'propertyAddress', label: 'Property Address' },
    { key: 'leaseStartDate', label: 'Lease Start Date' },
    { key: 'leaseEndDate', label: 'Lease End Date' },
    { key: 'monthlyRent', label: 'Monthly Rent' },
    { key: 'securityDeposit', label: 'Security Deposit' },
    { key: 'petDeposit', label: 'Pet Deposit' },
    { key: 'lateFee', label: 'Late Fee' },
    { key: 'rentDueDay', label: 'Rent Due Day' },
    { key: 'gracePeriodDays', label: 'Grace Period (days)' },
    { key: 'occupants', label: 'Additional Occupants' },
    { key: 'petPolicy', label: 'Pet Policy' },
    { key: 'utilitiesIncluded', label: 'Utilities Included' },
    { key: 'utilitiesTenantPays', label: 'Utilities Tenant Pays' },
    { key: 'parkingDetails', label: 'Parking' },
    { key: 'additionalTerms', label: 'Additional Terms' },
  ];
  
  sections.push(new Paragraph({
    children: [new TextRun({ text: 'AGREEMENT TERMS', bold: true, size: 24 })],
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 400, after: 200 },
  }));
  
  // Add known fields in order
  for (const { key, label } of fieldOrder) {
    const value = fieldValues[key];
    if (value !== undefined && value !== '') {
      sections.push(new Paragraph({
        children: [
          new TextRun({ text: `${label}: `, bold: true, size: 24 }),
          new TextRun({ text: String(value), size: 24 }),
        ],
        spacing: { after: 120 },
      }));
    }
  }
  
  // Add any remaining fields not in the standard order
  const handledKeys = new Set(fieldOrder.map(f => f.key));
  for (const [key, value] of Object.entries(fieldValues)) {
    if (!handledKeys.has(key) && value !== undefined && value !== '') {
      const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
      sections.push(new Paragraph({
        children: [
          new TextRun({ text: `${label}: `, bold: true, size: 24 }),
          new TextRun({ text: String(value), size: 24 }),
        ],
        spacing: { after: 120 },
      }));
    }
  }
  
  // Add signature section
  sections.push(new Paragraph({
    children: [new TextRun({ text: 'SIGNATURES', bold: true, size: 24 })],
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 600, after: 200 },
  }));
  
  sections.push(new Paragraph({
    children: [new TextRun({ text: '_________________________________', size: 24 })],
    spacing: { before: 400, after: 80 },
  }));
  sections.push(new Paragraph({
    children: [new TextRun({ text: 'Landlord Signature                    Date', size: 20 })],
    spacing: { after: 300 },
  }));
  
  sections.push(new Paragraph({
    children: [new TextRun({ text: '_________________________________', size: 24 })],
    spacing: { before: 200, after: 80 },
  }));
  sections.push(new Paragraph({
    children: [new TextRun({ text: 'Tenant Signature                       Date', size: 20 })],
    spacing: { after: 200 },
  }));
  
  // Create the document
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: 1440,    // 1 inch in twips
            right: 1440,
            bottom: 1440,
            left: 1440,
          },
        },
      },
      children: sections,
    }],
  });
  
  const buffer = await Packer.toBuffer(doc);
  
  console.log(`📝 DOCX generated successfully in ${Date.now() - startTime}ms`);
  
  return Buffer.from(buffer);
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
    ${landlordInfo?.businessName ? `<div class="firm-name">${escapeHtml(landlordInfo.businessName)}</div>` : '<div class="firm-name">LEASESHIELD LEGAL DOCUMENTS</div>'}
    ${landlordInfo?.phoneNumber || landlordInfo?.email ? `
      <div class="landlord-contact">
        ${landlordInfo.phoneNumber ? `<span>${escapeHtml(landlordInfo.phoneNumber)}</span>` : ''}
        ${landlordInfo.phoneNumber && landlordInfo.email ? ' | ' : ''}
        ${landlordInfo.email ? `<span>${escapeHtml(landlordInfo.email)}</span>` : ''}
      </div>
    ` : '<div class="tagline">Professional Landlord Protection Services</div>'}
    <div class="state-info">State-Specific Legal Forms for ${safeStateId}</div>
  </div>
  
  ${contentWithVersion}
  
  <div class="footer">
    This document was generated by LeaseShield App on ${new Date().toLocaleDateString()} | State: ${safeStateId}<br>
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

    <h2>24. LIABILITY WAIVER</h2>
    <p>Tenant acknowledges that Landlord is not liable for any loss of personal property, injury, or damage, regardless of cause, except as required by law. Tenant assumes full responsibility for all personal safety and security of the Premises.</p>
  `;
}

function getStateDisclosuresExpanded(stateId: string): string {
  const disclosures: Record<string, string> = {
    UT: `
      <h2>19. UTAH STATE-SPECIFIC PROVISIONS</h2>
      <h3>19.1 Fair Housing Disclosure</h3>
      <p>In accordance with the Utah Fair Housing Act (Utah Code § 34-42-1 et seq.), it is unlawful to refuse to rent, discriminate, or discriminate in advertising because of protected class status.</p>
      <h3>19.2 Mold Prevention and Disclosure Addendum</h3>
      <p><strong>PURPOSE:</strong> This Mold Prevention Addendum establishes responsibilities for maintaining a healthy living environment and preventing mold growth, consistent with the Utah Fit Premises Act (Utah Code § 57-22-4).</p>
      <p><strong>Landlord Disclosure:</strong> Landlord discloses that: (a) there is no known mold contamination on the premises that exceeds permissible exposure limits per Utah Administrative Code R392-105; (b) all known mold issues have been remediated according to professional standards; (c) Landlord has provided information about mold prevention to Tenant.</p>
      <p><strong>Tenant Responsibilities:</strong> Tenant agrees to: (a) maintain adequate ventilation by using exhaust fans and opening windows when possible; (b) promptly report any water leaks, moisture problems, or visible mold to Landlord in writing within 48 hours of discovery; (c) avoid blocking air vents or creating conditions that promote moisture buildup; (d) use heating and cooling systems appropriately to control humidity levels.</p>
      <p><strong>Landlord Responsibilities:</strong> Under Utah Code § 57-22-4, upon receiving written notice of water intrusion or mold, Landlord shall take substantial action within 10 days, including: (a) inspecting the affected area; (b) remediating any mold issues using qualified professionals if necessary; (c) addressing the source of moisture to prevent recurrence; (d) providing Tenant with written notice of remediation completion.</p>
      <p><strong>Health Advisory:</strong> Mold exposure may cause health effects in some individuals, including allergic reactions, respiratory issues, and other symptoms. Individuals with respiratory conditions, allergies, or compromised immune systems may be more susceptible. Consult a healthcare provider if you experience symptoms you believe may be related to mold exposure.</p>
      <h3>19.3 Radon Gas Disclosure</h3>
      <p>Radon is a naturally occurring radioactive gas that may accumulate in buildings in Utah. Long-term exposure may pose health risks. Testing for radon is recommended. Information about radon is available from the Utah Department of Environmental Quality.</p>
      <h3>19.4 Lead-Based Paint Disclosure (Pre-1978 Properties)</h3>
      <p>If the property was built before January 1, 1978, Landlord has disclosed all known information regarding lead-based paint and lead-based paint hazards. Tenant has been provided with the pamphlet "Protect Your Family from Lead in Your Home." Tenant acknowledges receipt of this disclosure.</p>
      <h3>19.5 Security Deposit Laws (Utah Code § 57-17)</h3>
      <p>Landlord shall return the security deposit within 30 days of lease termination with an itemized accounting of any deductions.</p>
    `,
    TX: `
      <h2>19. TEXAS STATE-SPECIFIC PROVISIONS</h2>
      <h3>19.1 Fair Housing Compliance</h3>
      <p>In accordance with the Texas Fair Housing Act and Texas Property Code § 92.001 et seq., it is unlawful to refuse to rent, negotiate, discriminate, or discriminate in advertising because of protected characteristics.</p>
      <h3>19.2 Lead-Based Paint Disclosure (Pre-1978 Properties)</h3>
      <p>If built before January 1, 1978, Landlord certifies disclosure of all known lead-based paint and lead-based paint hazards. Tenant has received the EPA pamphlet and has had 10 days to conduct an inspection.</p>
      <h3>19.3 Texas Property Code Compliance</h3>
      <p>This Lease is governed by Texas Property Code Chapter 92 (Residential Tenancies). Tenant rights and Landlord duties are established in this statutory framework. Both parties acknowledge familiarity with these rights and duties.</p>
      <h3>19.4 Security Deposit Handling (Texas Property Code § 92.103)</h3>
      <p>Landlord shall return the security deposit or provide an itemized accounting within 30 days of lease termination.</p>
      <h3>19.5 Mandatory Lease Language</h3>
      <p>Tenant is advised that Section 92.001, Texas Property Code grants certain rights and responsibilities to both Tenant and Landlord.</p>
    `,
    ND: `
      <h2>19. NORTH DAKOTA STATE-SPECIFIC PROVISIONS</h2>
      <h3>19.1 Fair Housing Notice</h3>
      <p>In accordance with North Dakota Fair Housing Act (N.D. Cent. Code § 14-02.4-01), it is unlawful to refuse to rent or discriminate because of protected status.</p>
      <h3>19.2 Security Deposit Requirements (N.D. Cent. Code § 47-16-01)</h3>
      <p>Landlord shall return the security deposit with interest within 30 days of lease termination. Deductions may only be made for damages beyond normal wear and tear, unpaid rent, or lease violations.</p>
      <h3>19.3 Lead-Based Paint Disclosure (Pre-1978 Properties)</h3>
      <p>If the property was built before January 1, 1978, Landlord discloses all known lead-based paint conditions and hazards in writing.</p>
      <h3>19.4 Right to Counsel</h3>
      <p>Tenant has the right to be represented by an attorney in any legal proceedings regarding this lease or tenancy.</p>
      <h3>19.5 Century Code Compliance</h3>
      <p>This Lease complies with North Dakota Century Code Chapter 47-16 (Residential Tenancies).</p>
    `,
    SD: `
      <h2>19. SOUTH DAKOTA STATE-SPECIFIC PROVISIONS</h2>
      <h3>19.1 Fair Housing Statement</h3>
      <p>Fair housing is a right guaranteed by state law (S.D. Codified Law § 20-13-1). It is unlawful to discriminate in rental housing based on protected characteristics.</p>
      <h3>19.2 Security Deposit Laws (S.D. Codified Law § 43-32-6)</h3>
      <p>Landlord shall return the security deposit within 14 days of lease termination with an accounting of any deductions for damages, cleaning, or unpaid rent.</p>
      <h3>19.3 Lead-Based Paint Disclosure (Pre-1978 Properties)</h3>
      <p>For properties built before January 1, 1978, Landlord certifies disclosure of all known lead-based paint hazards and has provided the EPA pamphlet to Tenant.</p>
      <h3>19.4 Codified Law Compliance</h3>
      <p>This Lease complies with South Dakota Codified Law Chapter 43-32 (Residential Tenancies).</p>
      <h3>19.5 Landlord Remedies</h3>
      <p>Landlord has the right to pursue all available remedies under state law for breach of this Lease, including eviction, suit for damages, and collection of all related costs and fees.</p>
    `
  };

  return disclosures[stateId] || `
    <h2>19. STANDARD DISCLOSURES</h2>
    <h3>Fair Housing Notice</h3>
    <p>This rental is offered without discrimination based on protected class status under applicable fair housing laws.</p>
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
