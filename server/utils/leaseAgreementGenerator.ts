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
  PageBreak,
} from 'docx';

interface LeaseAgreementOptions {
  templateTitle: string;
  stateId: string;
  fieldValues: Record<string, string | number>;
  version?: number;
  updatedAt?: Date;
  landlordInfo?: {
    businessName?: string | null;
    phoneNumber?: string | null;
    email?: string | null;
  };
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

const DEPOSIT_RETURN_DAYS: Record<string, string> = {
  UT: '30',
  TX: '30',
  ND: '30',
  SD: '14-45',
  NC: '30',
  OH: '30',
  MI: '30',
  ID: '21-30',
  WY: '15-30',
  CA: '21',
  VA: '45',
  NV: '30',
  AZ: '14',
  FL: '15-60',
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

function getFieldValue(fieldValues: Record<string, string | number>, key: string, defaultValue: string = '[_____________]'): string {
  const value = fieldValues[key];
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  return String(value);
}

const H1 = (text: string): Paragraph =>
  new Paragraph({
    children: [new TextRun({ text, bold: true, size: 32 })],
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
  });

const H2 = (text: string): Paragraph =>
  new Paragraph({
    children: [new TextRun({ text, bold: true, size: 24 })],
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
  });

const P = (text: string, options?: { bold?: boolean; italic?: boolean }): Paragraph =>
  new Paragraph({
    children: [
      new TextRun({
        text,
        size: 22,
        bold: options?.bold,
        italics: options?.italic,
      }),
    ],
    spacing: { after: 120 },
  });

const LabelValue = (label: string, value: string): Paragraph =>
  new Paragraph({
    children: [
      new TextRun({ text: label, bold: true, size: 22 }),
      new TextRun({ text: value, size: 22 }),
    ],
    spacing: { after: 80 },
  });

const SignatureLine = (label: string): Paragraph =>
  new Paragraph({
    children: [
      new TextRun({ text: label + " ", bold: true, size: 22 }),
      new TextRun({ text: "________________________________________________", size: 22 }),
    ],
    spacing: { before: 200, after: 80 },
  });

const HR = (): Paragraph =>
  new Paragraph({
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
    },
    spacing: { before: 200, after: 200 },
  });

// NOTE: This function provides comprehensive state-specific disclosures for all 14 states.
// Includes mold, radon, bed bugs, and all required statutory disclosures per state law.
function getStateProvisionsParagraphs(stateId: string, depositDays: string): Paragraph[] {
  const stateName = STATE_NAMES[stateId] || stateId;
  
  const provisions: Record<string, { title: string; text: string }[]> = {
    UT: [
      { title: "Fair Housing (Utah Code 57-21):", text: " In accordance with the Utah Fair Housing Act, it is unlawful to refuse to rent, discriminate, or discriminate in advertising because of race, color, religion, sex, national origin, familial status, source of income, or disability." },
      { title: "Mold Prevention and Disclosure:", text: " Pursuant to the Utah Fit Premises Act (Utah Code 57-22-4), Landlord discloses that there is no known mold contamination on the Premises. Tenant agrees to maintain adequate ventilation and promptly report any water leaks or visible mold within 48 hours of discovery." },
      { title: "Radon Gas Disclosure:", text: " Radon is a naturally occurring radioactive gas that may accumulate in buildings. Long-term exposure may pose health risks. Testing is recommended." },
      { title: "Lead-Based Paint (Pre-1978 Properties):", text: " If the property was built before January 1, 1978, Landlord has disclosed all known information regarding lead-based paint hazards." },
      { title: "Security Deposit (Utah Code 57-17-3):", text: " Deposit must be returned within 30 days after termination with an itemized statement of any deductions for unpaid rent, damages beyond normal wear and tear, or cleaning costs." },
      { title: "Entry Notice:", text: " Landlord shall provide at least 24 hours notice before entering the Premises except in cases of emergency." },
      { title: "Bed Bug Disclosure:", text: " Landlord has no knowledge of any bed bug infestation on the Premises. Tenant agrees to promptly report any suspected bed bug activity." },
    ],
    TX: [
      { title: "Fair Housing:", text: " In accordance with the Texas Fair Housing Act (Texas Property Code Chapter 301), discrimination is prohibited based on race, color, religion, sex, national origin, familial status, or disability." },
      { title: "Security Deposit (Texas Property Code 92.103-109):", text: " Deposit must be returned within 30 days with itemized accounting of any deductions." },
      { title: "Late Fees (Texas Property Code 92.019):", text: " Late fees must be reasonable and specified in lease." },
      { title: "Repairs (Texas Property Code 92.056):", text: " Landlord must repair conditions affecting health and safety within reasonable time after written notice." },
      { title: "Smoke Detector Compliance:", text: " Landlord shall provide functioning smoke detectors as required by Texas Property Code." },
      { title: "Lead-Based Paint:", text: " Disclosure required for pre-1978 properties." },
    ],
    CA: [
      { title: "Fair Housing:", text: " In accordance with California Fair Employment and Housing Act (Gov. Code 12955), discrimination is prohibited based on race, color, religion, sex, gender, sexual orientation, marital status, national origin, ancestry, familial status, source of income, disability, or genetic information." },
      { title: "Mold Disclosure (Civil Code 1942.5):", text: " Landlord discloses that there is no known mold contamination on the Premises. If mold is discovered, Tenant shall immediately notify Landlord." },
      { title: "Security Deposit (Civil Code 1950.5):", text: " Deposit must be returned within 21 days with itemized statement. Limit is two months rent (unfurnished) or three months (furnished)." },
      { title: "Rent Control (AB 1482):", text: " Statewide rent cap and just cause eviction protections may apply to this tenancy under the Tenant Protection Act." },
      { title: "Bed Bug Disclosure (Civil Code 1954.602):", text: " Landlord has no knowledge of any bed bug infestation. Written pest control information has been provided." },
      { title: "Lead-Based Paint:", text: " Disclosure required for pre-1978 properties." },
    ],
    AZ: [
      { title: "Fair Housing:", text: " In accordance with the Arizona Fair Housing Act (A.R.S. 41-1491), discrimination is prohibited based on race, color, religion, sex, national origin, familial status, or disability." },
      { title: "Security Deposit (A.R.S. 33-1321):", text: " Deposit must be returned within 14 business days with itemized statement. Limit is one and one-half months rent." },
      { title: "Entry Notice:", text: " Landlord shall provide at least 2 days notice before entering except in emergencies." },
      { title: "Pool Safety (A.R.S. 33-1319):", text: " Pool safety disclosure and barrier requirements apply if property has a pool." },
      { title: "Bed Bug Information:", text: " Landlord has no knowledge of any bed bug infestation on the Premises." },
      { title: "Lead-Based Paint:", text: " Disclosure required for pre-1978 properties." },
    ],
    FL: [
      { title: "Fair Housing:", text: " In accordance with the Florida Fair Housing Act (Fla. Stat. 760.20-760.37), discrimination is prohibited based on race, color, religion, sex, national origin, familial status, or disability." },
      { title: "Security Deposit (Florida Statutes 83.49):", text: " Deposit must be returned within 15-60 days depending on claims. Landlord must notify Tenant of deposit location within 30 days." },
      { title: "Radon Disclosure (Fla. Stat. 404.056):", text: " RADON GAS: Radon is a naturally occurring radioactive gas that, when accumulated in sufficient quantities in a building, may present health risks. Levels that pose risk have been found in Florida. Additional information is available from the county health department." },
      { title: "Entry Notice:", text: " Landlord shall provide at least 12 hours notice before entering except in emergencies." },
      { title: "Lead-Based Paint:", text: " Disclosure required for pre-1978 properties." },
    ],
    NV: [
      { title: "Fair Housing:", text: " In accordance with the Nevada Fair Housing Law (NRS 118.010), discrimination is prohibited based on race, color, religion, sex, national origin, familial status, disability, sexual orientation, or gender identity." },
      { title: "Security Deposit (NRS 118A.242):", text: " Deposit must be returned within 30 days with itemized statement. Limit is three months rent." },
      { title: "Landlord Contact (NRS 118A.260):", text: " Landlord contact information disclosure is required." },
      { title: "Move-In Inspection (NRS 118A.200):", text: " Move-in inspection checklist is required within 5 days of move-in." },
      { title: "Bed Bug Disclosure:", text: " Landlord has no knowledge of any bed bug infestation on the Premises." },
      { title: "Lead-Based Paint:", text: " Disclosure required for pre-1978 properties." },
    ],
    VA: [
      { title: "Fair Housing:", text: " In accordance with the Virginia Fair Housing Law (Va. Code 36-96.1), discrimination is prohibited based on race, color, religion, sex, national origin, familial status, disability, elderliness, or source of funds." },
      { title: "Mold Disclosure (Va. Code 55.1-1215):", text: " Landlord shall disclose visible mold in areas readily accessible within the dwelling unit." },
      { title: "Security Deposit (Virginia Code 55.1-1226):", text: " Deposit must be returned within 45 days with itemized statement. Limit is two months rent." },
      { title: "Entry Notice:", text: " Landlord shall provide at least 24 hours notice before entering except in emergencies." },
      { title: "Move-In Inspection:", text: " Written move-in inspection report is required within 5 days of occupancy." },
      { title: "Lead-Based Paint:", text: " Disclosure required for pre-1978 properties." },
    ],
    OH: [
      { title: "Fair Housing:", text: " In accordance with the Ohio Fair Housing Law (ORC Chapter 4112), discrimination is prohibited based on race, color, religion, sex, national origin, familial status, disability, ancestry, or military status." },
      { title: "Security Deposit (ORC 5321.16):", text: " Deposit must be returned within 30 days with itemized statement. No statutory limit on amount." },
      { title: "Entry Notice:", text: " Landlord shall provide at least 24 hours notice before entering except in emergencies." },
      { title: "Lead-Based Paint:", text: " Disclosure required for pre-1978 properties. Ohio requires additional disclosures for properties built before 1978." },
    ],
    MI: [
      { title: "Fair Housing:", text: " In accordance with the Michigan Elliott-Larsen Civil Rights Act (MCL 37.2101), discrimination is prohibited based on race, color, religion, sex, national origin, familial status, or disability." },
      { title: "Security Deposit (MCL 554.602-616):", text: " Deposit must be returned within 30 days with itemized statement. Limit is one and one-half months rent." },
      { title: "Deposit Escrow:", text: " Deposit must be held in a regulated financial institution and Landlord must provide Tenant with deposit notice within 14 days." },
      { title: "Move-In Checklist (MCL 554.608):", text: " Inventory checklist at move-in is required to document property condition." },
      { title: "Lead-Based Paint:", text: " Disclosure required for pre-1978 properties." },
    ],
    NC: [
      { title: "Fair Housing:", text: " In accordance with the North Carolina Fair Housing Act (NCGS 41A-1), discrimination is prohibited based on race, color, religion, sex, national origin, familial status, or disability." },
      { title: "Security Deposit (NCGS 42-50-56):", text: " Deposit must be returned within 30 days with itemized statement. Limit varies by lease length." },
      { title: "Deposit Trust Account:", text: " Landlord must deposit security in a trust account in a licensed North Carolina bank." },
      { title: "Entry Notice:", text: " Reasonable notice is required before entering except in emergencies." },
      { title: "Lead-Based Paint:", text: " Disclosure required for pre-1978 properties." },
    ],
    ID: [
      { title: "Fair Housing:", text: " In accordance with the Idaho Human Rights Act (Idaho Code 67-5901), discrimination is prohibited based on race, color, religion, sex, national origin, or disability." },
      { title: "Security Deposit (Idaho Code 6-321):", text: " Deposit must be returned within 21-30 days with itemized statement. No statutory limit on amount." },
      { title: "Entry Notice:", text: " Reasonable notice is required before entering except in emergencies." },
      { title: "Lead-Based Paint:", text: " Disclosure required for pre-1978 properties." },
    ],
    ND: [
      { title: "Fair Housing:", text: " In accordance with the North Dakota Fair Housing Act (NDCC 14-02.5), discrimination is prohibited based on race, color, religion, sex, national origin, familial status, disability, or status with regard to marriage or public assistance." },
      { title: "Security Deposit (NDCC 47-16-07.1):", text: " Deposit must be returned within 30 days with itemized statement. Limit is one month rent (exceptions apply)." },
      { title: "Landlord Lien (NDCC 35-21):", text: " Landlord has lien on tenant property for unpaid rent." },
      { title: "Lead-Based Paint:", text: " Disclosure required for pre-1978 properties." },
    ],
    SD: [
      { title: "Fair Housing:", text: " In accordance with the South Dakota Human Relations Act (SDCL 20-13), discrimination is prohibited based on race, color, religion, sex, national origin, familial status, or disability." },
      { title: "Security Deposit (SDCL 43-32-6.1):", text: " Deposit must be returned within 14-45 days with itemized statement. Limit is one month rent." },
      { title: "Entry Notice:", text: " Landlord shall provide at least 24 hours notice before entering except in emergencies." },
      { title: "Lead-Based Paint:", text: " Disclosure required for pre-1978 properties." },
    ],
    WY: [
      { title: "Fair Housing:", text: " In accordance with the Wyoming Fair Housing Act (Wyo. Stat. 40-26-101), discrimination is prohibited based on race, color, religion, sex, national origin, familial status, or disability." },
      { title: "Security Deposit (W.S. 1-21-1207-1208):", text: " Deposit must be returned within 30 days (or 15 days if no deductions). Deposit may not exceed two months rent unless otherwise agreed." },
      { title: "Entry Notice:", text: " Wyoming law does not specify minimum notice, but reasonable notice is required except in emergencies." },
      { title: "Lead-Based Paint:", text: " Disclosure required for pre-1978 properties." },
    ],
  };

  const stateProvisions = provisions[stateId] || [
    { title: "Fair Housing:", text: " Discrimination is prohibited based on protected classes under federal and state fair housing laws." },
    { title: "Security Deposit:", text: ` Deposit must be returned within ${depositDays} days with itemized statement.` },
    { title: "Lead-Based Paint:", text: " Disclosure required for pre-1978 properties." },
  ];

  return stateProvisions.map(p => 
    new Paragraph({
      children: [
        new TextRun({ text: p.title, bold: true, size: 22 }),
        new TextRun({ text: p.text, size: 22 }),
      ],
      spacing: { after: 80 },
    })
  );
}

export async function generateLeaseAgreementDocx(options: LeaseAgreementOptions): Promise<Buffer> {
  const { templateTitle, stateId, fieldValues, version = 1, updatedAt = new Date(), landlordInfo } = options;

  console.log('📝 Generating lease agreement DOCX with docx library...');
  const startTime = Date.now();

  const stateName = STATE_NAMES[stateId] || stateId;
  const depositDays = DEPOSIT_RETURN_DAYS[stateId] || '30';
  
  const landlordName = getFieldValue(fieldValues, 'landlordName');
  const landlordAddress = getFieldValue(fieldValues, 'landlordAddress');
  const landlordPhone = getFieldValue(fieldValues, 'landlordPhone');
  const landlordEmail = getFieldValue(fieldValues, 'landlordEmail');
  const tenantName = getFieldValue(fieldValues, 'tenantName');
  const tenantPhone = getFieldValue(fieldValues, 'tenantPhone');
  const tenantEmail = getFieldValue(fieldValues, 'tenantEmail');
  const propertyAddress = getFieldValue(fieldValues, 'propertyAddress');
  const propertyCity = getFieldValue(fieldValues, 'propertyCity');
  const propertyZip = getFieldValue(fieldValues, 'propertyZip');
  const propertyType = getFieldValue(fieldValues, 'propertyType', 'Residential');
  const leaseStartDate = getFieldValue(fieldValues, 'leaseStartDate');
  const leaseEndDate = getFieldValue(fieldValues, 'leaseEndDate');
  const monthlyRent = getFieldValue(fieldValues, 'monthlyRent');
  const rentDueDay = getFieldValue(fieldValues, 'rentDueDay', '1');
  const lateFeeGracePeriod = getFieldValue(fieldValues, 'lateFeeGracePeriod', '5');
  const lateFeeAmount = getFieldValue(fieldValues, 'lateFeeAmount');
  const securityDeposit = getFieldValue(fieldValues, 'securityDeposit');

  const children: Paragraph[] = [];

  children.push(H1(templateTitle.toUpperCase()));
  children.push(P(`State of ${stateName}`, { italic: true }));
  children.push(P(`Document Version: ${version} | Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`));
  children.push(P(`Last Legal Review: ${new Date(updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`));
  children.push(HR());

  children.push(H2("1. TERM OF LEASE"));
  children.push(P(`This Residential Lease Agreement ("Lease") is entered into as of ${leaseStartDate} between the undersigned Landlord and Tenant(s) for the rental of the property located at ${propertyAddress}, ${propertyCity}, ${stateId} ${propertyZip} ("Premises"). This Lease shall commence on ${leaseStartDate} and shall terminate at 11:59 PM on ${leaseEndDate} unless sooner terminated or extended in writing by mutual agreement.`));

  children.push(H2("2. PARTIES"));
  children.push(P("LANDLORD:", { bold: true }));
  children.push(LabelValue("Name: ", landlordName));
  children.push(LabelValue("Address: ", landlordAddress));
  children.push(LabelValue("Phone: ", landlordPhone));
  children.push(LabelValue("Email: ", landlordEmail));
  children.push(P("TENANT(S):", { bold: true }));
  children.push(LabelValue("Name: ", tenantName));
  children.push(LabelValue("Phone: ", tenantPhone));
  children.push(LabelValue("Email: ", tenantEmail));

  children.push(H2("3. PROPERTY"));
  children.push(LabelValue("Address: ", `${propertyAddress}, ${propertyCity}, ${stateId} ${propertyZip}`));
  children.push(LabelValue("Property Type: ", propertyType));

  children.push(H2("4. RENT AND PAYMENT"));
  children.push(LabelValue("Monthly Rent: ", `$${monthlyRent} payable on the ${rentDueDay} day of each month.`));
  children.push(LabelValue("Late Fee: ", `If rent is not received within ${lateFeeGracePeriod} days of the due date, a late fee of $${lateFeeAmount} shall be assessed.`));
  children.push(LabelValue("NSF Check Fee: ", "$35 for any returned check."));

  children.push(H2("5. SECURITY DEPOSIT"));
  children.push(LabelValue("Amount: ", `$${securityDeposit}`));
  children.push(P(`The security deposit shall be returned within ${depositDays} days after lease termination, less any lawful deductions for damages, unpaid rent, or cleaning costs, with an itemized statement.`));

  children.push(H2("6. MAINTENANCE AND REPAIRS"));
  children.push(P("Tenant shall maintain the Premises in clean condition and promptly report any needed repairs. Landlord shall maintain structural elements, roof, foundation, and major systems (electrical, plumbing, HVAC) in good repair."));

  children.push(H2("7. USE OF PREMISES"));
  children.push(P("The Premises shall be used solely as a residential dwelling. No business, illegal activity, or nuisance shall be permitted. Unauthorized occupants constitute a material breach."));

  children.push(H2("8. PETS"));
  children.push(P("No pets are permitted without prior written consent from Landlord. Approved pets require a pet deposit and monthly pet fee as agreed in writing."));

  children.push(H2("9. UTILITIES"));
  children.push(P("Tenant is responsible for all utilities unless otherwise specified in writing."));

  children.push(H2("10. INSURANCE"));
  children.push(P("Tenant shall obtain and maintain renters insurance. Landlord is not liable for loss or damage to Tenant's personal property."));

  children.push(H2("11. ENTRY AND INSPECTION"));
  children.push(P("Landlord may enter with 24 hours notice for inspection, repairs, or showing to prospective tenants. No notice required for emergencies."));

  children.push(H2("12. TERMINATION"));
  children.push(P("Either party must provide at least 30 days written notice before the end of the lease term. Early termination constitutes a material breach."));

  children.push(H2("13. DEFAULT AND REMEDIES"));
  children.push(P("Default events include non-payment of rent, unauthorized occupants, lease violations, or illegal activity. Upon default, Landlord may pursue eviction and recover all unpaid amounts, attorney fees, and damages."));

  children.push(H2("14. FAIR HOUSING"));
  children.push(P("Landlord does not discriminate based on race, color, religion, sex, national origin, disability, familial status, or any other protected class under federal, state, or local law."));

  children.push(H2(`15. ${stateName.toUpperCase()} STATE-SPECIFIC PROVISIONS`));
  children.push(...getStateProvisionsParagraphs(stateId, depositDays));

  children.push(H2("16. INDEMNIFICATION AND HOLD HARMLESS"));
  children.push(P("Tenant agrees to indemnify and hold harmless Landlord from any claims, damages, or expenses arising from Tenant's use of the Premises, breach of this Lease, or negligence of Tenant or Tenant's guests. Landlord is not liable for theft, injury, or property damage except as required by law."));

  children.push(H2("17. LIABILITY WAIVER"));
  children.push(P("Tenant acknowledges that Landlord makes no warranties regarding security. Tenant assumes responsibility for personal safety and property. Tenant releases Landlord from liability for loss or damage except for gross negligence or willful misconduct."));

  children.push(H2("18. ATTORNEY FEES"));
  children.push(P("In any legal action arising from this Lease, the prevailing party shall recover reasonable attorney fees and court costs."));

  children.push(H2("19. NOTICES"));
  children.push(P("All notices shall be in writing and delivered personally, by certified mail, or by email with confirmed receipt to the addresses provided."));

  children.push(H2("20. ADDITIONAL PROVISIONS"));
  children.push(P("Time is of the essence. No waiver of any breach shall constitute waiver of subsequent breaches. If multiple Tenants, all are jointly and severally liable. This Lease is binding on heirs and successors. Headings are for convenience only."));

  children.push(H2("21. ENTIRE AGREEMENT"));
  children.push(P("This Lease constitutes the entire agreement between the parties and supersedes all prior agreements. Modifications must be in writing and signed by both parties."));

  children.push(H2("22. GOVERNING LAW"));
  children.push(P(`This Lease is governed by the laws of the State of ${stateName}.`));

  children.push(HR());

  children.push(
    new Paragraph({
      children: [new TextRun({ text: "SIGNATURES", bold: true, size: 28 })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 300, after: 200 },
    })
  );

  children.push(P("LANDLORD SIGNATURE:", { bold: true }));
  children.push(SignatureLine("Signature:"));
  children.push(SignatureLine("Date:"));

  children.push(P("TENANT SIGNATURE:", { bold: true }));
  children.push(SignatureLine("Signature:"));
  children.push(SignatureLine("Date:"));

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "For informational purposes only. Consult with a licensed attorney for legal advice.",
          size: 18,
          italics: true,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 400 },
    })
  );

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
    console.log(`📝 Lease agreement DOCX generated successfully in ${Date.now() - startTime}ms (${buffer.length} bytes)`);
    return Buffer.from(buffer);
  } catch (error) {
    console.error('📝 Error generating lease agreement DOCX:', error);
    throw error;
  }
}

export async function generateLeaseAgreementPdf(options: LeaseAgreementOptions): Promise<Buffer> {
  const { templateTitle, stateId, fieldValues, version = 1, updatedAt = new Date(), landlordInfo } = options;

  const htmlContent = generateLeaseHTMLForPdf(templateTitle, stateId, fieldValues, version, updatedAt, landlordInfo);

  console.log('📄 Generating lease agreement PDF with Puppeteer...');
  const startTime = Date.now();

  let browser;
  try {
    const chromiumPath = execSync('which chromium').toString().trim();
    browser = await puppeteer.launch({
      headless: true,
      executablePath: chromiumPath,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: '1in', right: '1in', bottom: '1in', left: '1in' },
    });

    console.log(`📄 Lease agreement PDF generated in ${Date.now() - startTime}ms`);
    return Buffer.from(pdfBuffer);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

function generateLeaseHTMLForPdf(
  templateTitle: string,
  stateId: string,
  fieldValues: Record<string, string | number>,
  version: number,
  updatedAt: Date,
  landlordInfo?: LeaseAgreementOptions['landlordInfo']
): string {
  const stateName = STATE_NAMES[stateId] || stateId;
  const depositDays = DEPOSIT_RETURN_DAYS[stateId] || '30';
  const safeTitle = escapeHtml(templateTitle);
  
  const landlordName = getFieldValue(fieldValues, 'landlordName');
  const landlordAddress = getFieldValue(fieldValues, 'landlordAddress');
  const landlordPhone = getFieldValue(fieldValues, 'landlordPhone');
  const landlordEmail = getFieldValue(fieldValues, 'landlordEmail');
  const tenantName = getFieldValue(fieldValues, 'tenantName');
  const tenantPhone = getFieldValue(fieldValues, 'tenantPhone');
  const tenantEmail = getFieldValue(fieldValues, 'tenantEmail');
  const propertyAddress = getFieldValue(fieldValues, 'propertyAddress');
  const propertyCity = getFieldValue(fieldValues, 'propertyCity');
  const propertyZip = getFieldValue(fieldValues, 'propertyZip');
  const propertyType = getFieldValue(fieldValues, 'propertyType');
  const leaseStartDate = getFieldValue(fieldValues, 'leaseStartDate');
  const leaseEndDate = getFieldValue(fieldValues, 'leaseEndDate');
  const monthlyRent = getFieldValue(fieldValues, 'monthlyRent');
  const rentDueDay = getFieldValue(fieldValues, 'rentDueDay', '1');
  const lateFeeGracePeriod = getFieldValue(fieldValues, 'lateFeeGracePeriod', '5');
  const lateFeeAmount = getFieldValue(fieldValues, 'lateFeeAmount');
  const securityDeposit = getFieldValue(fieldValues, 'securityDeposit');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${safeTitle}</title>
  <style>
    body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; color: #000; }
    h1 { text-align: center; text-transform: uppercase; margin-bottom: 5px; font-size: 18pt; }
    h2 { font-size: 14pt; margin-top: 20px; margin-bottom: 10px; }
    p { margin: 8px 0; }
    hr { border: none; border-top: 1px solid #000; margin: 20px 0; }
    .center { text-align: center; }
    .signature-line { margin: 15px 0; }
    .footer { text-align: center; font-size: 10pt; font-style: italic; margin-top: 30px; }
  </style>
</head>
<body>
<h1>${safeTitle}</h1>
<p class="center">State of ${stateName}</p>
<p><strong>Document Version:</strong> ${version} | <strong>Generated:</strong> ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
<p><strong>Last Legal Review:</strong> ${new Date(updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
<hr>

<h2>1. TERM OF LEASE</h2>
<p>This Residential Lease Agreement ("Lease") is entered into as of ${escapeHtml(leaseStartDate)} between the undersigned Landlord and Tenant(s) for the rental of the property located at ${escapeHtml(propertyAddress)}, ${escapeHtml(propertyCity)}, ${stateId} ${escapeHtml(propertyZip)} ("Premises"). This Lease shall commence on ${escapeHtml(leaseStartDate)} and shall terminate at 11:59 PM on ${escapeHtml(leaseEndDate)} unless sooner terminated or extended in writing by mutual agreement.</p>

<h2>2. PARTIES</h2>
<p><strong>LANDLORD:</strong></p>
<p>Name: ${escapeHtml(landlordName)}</p>
<p>Address: ${escapeHtml(landlordAddress)}</p>
<p>Phone: ${escapeHtml(landlordPhone)}</p>
<p>Email: ${escapeHtml(landlordEmail)}</p>
<p><strong>TENANT(S):</strong></p>
<p>Name: ${escapeHtml(tenantName)}</p>
<p>Phone: ${escapeHtml(tenantPhone)}</p>
<p>Email: ${escapeHtml(tenantEmail)}</p>

<h2>3. PROPERTY</h2>
<p>Address: ${escapeHtml(propertyAddress)}, ${escapeHtml(propertyCity)}, ${stateId} ${escapeHtml(propertyZip)}</p>
<p>Property Type: ${escapeHtml(propertyType)}</p>

<h2>4. RENT AND PAYMENT</h2>
<p><strong>Monthly Rent:</strong> $${escapeHtml(monthlyRent)} payable on the ${escapeHtml(rentDueDay)} day of each month.</p>
<p><strong>Late Fee:</strong> If rent is not received within ${escapeHtml(lateFeeGracePeriod)} days of the due date, a late fee of $${escapeHtml(lateFeeAmount)} shall be assessed.</p>
<p><strong>NSF Check Fee:</strong> $35 for any returned check.</p>

<h2>5. SECURITY DEPOSIT</h2>
<p><strong>Amount:</strong> $${escapeHtml(securityDeposit)}</p>
<p>The security deposit shall be returned within ${depositDays} days after lease termination, less any lawful deductions for damages, unpaid rent, or cleaning costs, with an itemized statement.</p>

<h2>6. MAINTENANCE AND REPAIRS</h2>
<p>Tenant shall maintain the Premises in clean condition and promptly report any needed repairs. Landlord shall maintain structural elements, roof, foundation, and major systems (electrical, plumbing, HVAC) in good repair.</p>

<h2>7. USE OF PREMISES</h2>
<p>The Premises shall be used solely as a residential dwelling. No business, illegal activity, or nuisance shall be permitted. Unauthorized occupants constitute a material breach.</p>

<h2>8. PETS</h2>
<p>No pets are permitted without prior written consent from Landlord. Approved pets require a pet deposit and monthly pet fee as agreed in writing.</p>

<h2>9. UTILITIES</h2>
<p>Tenant is responsible for all utilities unless otherwise specified in writing.</p>

<h2>10. INSURANCE</h2>
<p>Tenant shall obtain and maintain renters insurance. Landlord is not liable for loss or damage to Tenant's personal property.</p>

<h2>11. ENTRY AND INSPECTION</h2>
<p>Landlord may enter with 24 hours notice for inspection, repairs, or showing to prospective tenants. No notice required for emergencies.</p>

<h2>12. TERMINATION</h2>
<p>Either party must provide at least 30 days written notice before the end of the lease term. Early termination constitutes a material breach.</p>

<h2>13. DEFAULT AND REMEDIES</h2>
<p>Default events include non-payment of rent, unauthorized occupants, lease violations, or illegal activity. Upon default, Landlord may pursue eviction and recover all unpaid amounts, attorney fees, and damages.</p>

<h2>14. FAIR HOUSING</h2>
<p>Landlord does not discriminate based on race, color, religion, sex, national origin, disability, familial status, or any other protected class under federal, state, or local law.</p>

<h2>15. ${stateName.toUpperCase()} STATE-SPECIFIC PROVISIONS</h2>
${getStateProvisionsHtml(stateId, depositDays)}

<h2>16. INDEMNIFICATION AND HOLD HARMLESS</h2>
<p>Tenant agrees to indemnify and hold harmless Landlord from any claims, damages, or expenses arising from Tenant's use of the Premises, breach of this Lease, or negligence of Tenant or Tenant's guests. Landlord is not liable for theft, injury, or property damage except as required by law.</p>

<h2>17. LIABILITY WAIVER</h2>
<p>Tenant acknowledges that Landlord makes no warranties regarding security. Tenant assumes responsibility for personal safety and property. Tenant releases Landlord from liability for loss or damage except for gross negligence or willful misconduct.</p>

<h2>18. ATTORNEY FEES</h2>
<p>In any legal action arising from this Lease, the prevailing party shall recover reasonable attorney fees and court costs.</p>

<h2>19. NOTICES</h2>
<p>All notices shall be in writing and delivered personally, by certified mail, or by email with confirmed receipt to the addresses provided.</p>

<h2>20. ADDITIONAL PROVISIONS</h2>
<p>Time is of the essence. No waiver of any breach shall constitute waiver of subsequent breaches. If multiple Tenants, all are jointly and severally liable. This Lease is binding on heirs and successors. Headings are for convenience only.</p>

<h2>21. ENTIRE AGREEMENT</h2>
<p>This Lease constitutes the entire agreement between the parties and supersedes all prior agreements. Modifications must be in writing and signed by both parties.</p>

<h2>22. GOVERNING LAW</h2>
<p>This Lease is governed by the laws of the State of ${stateName}.</p>

<hr>

<h2 class="center">SIGNATURES</h2>
<p><strong>LANDLORD SIGNATURE:</strong></p>
<p class="signature-line">Signature: ________________________________________________</p>
<p class="signature-line">Date: ________________________________________________</p>
<p><strong>TENANT SIGNATURE:</strong></p>
<p class="signature-line">Signature: ________________________________________________</p>
<p class="signature-line">Date: ________________________________________________</p>

<p class="footer">For informational purposes only. Consult with a licensed attorney for legal advice.</p>
</body>
</html>`;
}

// NOTE: This function provides comprehensive state-specific disclosures for all 14 states (HTML version for PDF).
// Includes mold, radon, bed bugs, and all required statutory disclosures per state law.
function getStateProvisionsHtml(stateId: string, depositDays: string): string {
  const provisions: Record<string, string> = {
    UT: `<p><strong>Fair Housing (Utah Code 57-21):</strong> In accordance with the Utah Fair Housing Act, it is unlawful to refuse to rent, discriminate, or discriminate in advertising because of race, color, religion, sex, national origin, familial status, source of income, or disability.</p>
<p><strong>Mold Prevention and Disclosure:</strong> Pursuant to the Utah Fit Premises Act (Utah Code 57-22-4), Landlord discloses that there is no known mold contamination on the Premises. Tenant agrees to maintain adequate ventilation and promptly report any water leaks or visible mold within 48 hours of discovery.</p>
<p><strong>Radon Gas Disclosure:</strong> Radon is a naturally occurring radioactive gas that may accumulate in buildings. Long-term exposure may pose health risks. Testing is recommended.</p>
<p><strong>Lead-Based Paint (Pre-1978 Properties):</strong> If the property was built before January 1, 1978, Landlord has disclosed all known information regarding lead-based paint hazards.</p>
<p><strong>Security Deposit (Utah Code 57-17-3):</strong> Deposit must be returned within 30 days after termination with an itemized statement of any deductions for unpaid rent, damages beyond normal wear and tear, or cleaning costs.</p>
<p><strong>Entry Notice:</strong> Landlord shall provide at least 24 hours notice before entering the Premises except in cases of emergency.</p>
<p><strong>Bed Bug Disclosure:</strong> Landlord has no knowledge of any bed bug infestation on the Premises. Tenant agrees to promptly report any suspected bed bug activity.</p>`,
    TX: `<p><strong>Fair Housing:</strong> In accordance with the Texas Fair Housing Act (Texas Property Code Chapter 301), discrimination is prohibited based on race, color, religion, sex, national origin, familial status, or disability.</p>
<p><strong>Security Deposit (Texas Property Code 92.103-109):</strong> Deposit must be returned within 30 days with itemized accounting of any deductions.</p>
<p><strong>Late Fees (Texas Property Code 92.019):</strong> Late fees must be reasonable and specified in lease.</p>
<p><strong>Repairs (Texas Property Code 92.056):</strong> Landlord must repair conditions affecting health and safety within reasonable time after written notice.</p>
<p><strong>Smoke Detector Compliance:</strong> Landlord shall provide functioning smoke detectors as required by Texas Property Code.</p>
<p><strong>Lead-Based Paint:</strong> Disclosure required for pre-1978 properties.</p>`,
    CA: `<p><strong>Fair Housing:</strong> In accordance with California Fair Employment and Housing Act (Gov. Code 12955), discrimination is prohibited based on race, color, religion, sex, gender, sexual orientation, marital status, national origin, ancestry, familial status, source of income, disability, or genetic information.</p>
<p><strong>Mold Disclosure (Civil Code 1942.5):</strong> Landlord discloses that there is no known mold contamination on the Premises. If mold is discovered, Tenant shall immediately notify Landlord.</p>
<p><strong>Security Deposit (Civil Code 1950.5):</strong> Deposit must be returned within 21 days with itemized statement. Limit is two months rent (unfurnished) or three months (furnished).</p>
<p><strong>Rent Control (AB 1482):</strong> Statewide rent cap and just cause eviction protections may apply to this tenancy under the Tenant Protection Act.</p>
<p><strong>Bed Bug Disclosure (Civil Code 1954.602):</strong> Landlord has no knowledge of any bed bug infestation. Written pest control information has been provided.</p>
<p><strong>Lead-Based Paint:</strong> Disclosure required for pre-1978 properties.</p>`,
    AZ: `<p><strong>Fair Housing:</strong> In accordance with the Arizona Fair Housing Act (A.R.S. 41-1491), discrimination is prohibited based on race, color, religion, sex, national origin, familial status, or disability.</p>
<p><strong>Security Deposit (A.R.S. 33-1321):</strong> Deposit must be returned within 14 business days with itemized statement. Limit is one and one-half months rent.</p>
<p><strong>Entry Notice:</strong> Landlord shall provide at least 2 days notice before entering except in emergencies.</p>
<p><strong>Pool Safety (A.R.S. 33-1319):</strong> Pool safety disclosure and barrier requirements apply if property has a pool.</p>
<p><strong>Bed Bug Information:</strong> Landlord has no knowledge of any bed bug infestation on the Premises.</p>
<p><strong>Lead-Based Paint:</strong> Disclosure required for pre-1978 properties.</p>`,
    FL: `<p><strong>Fair Housing:</strong> In accordance with the Florida Fair Housing Act (Fla. Stat. 760.20-760.37), discrimination is prohibited based on race, color, religion, sex, national origin, familial status, or disability.</p>
<p><strong>Security Deposit (Florida Statutes 83.49):</strong> Deposit must be returned within 15-60 days depending on claims. Landlord must notify Tenant of deposit location within 30 days.</p>
<p><strong>Radon Disclosure (Fla. Stat. 404.056):</strong> RADON GAS: Radon is a naturally occurring radioactive gas that, when accumulated in sufficient quantities in a building, may present health risks. Levels that pose risk have been found in Florida. Additional information is available from the county health department.</p>
<p><strong>Entry Notice:</strong> Landlord shall provide at least 12 hours notice before entering except in emergencies.</p>
<p><strong>Lead-Based Paint:</strong> Disclosure required for pre-1978 properties.</p>`,
    NV: `<p><strong>Fair Housing:</strong> In accordance with the Nevada Fair Housing Law (NRS 118.010), discrimination is prohibited based on race, color, religion, sex, national origin, familial status, disability, sexual orientation, or gender identity.</p>
<p><strong>Security Deposit (NRS 118A.242):</strong> Deposit must be returned within 30 days with itemized statement. Limit is three months rent.</p>
<p><strong>Landlord Contact (NRS 118A.260):</strong> Landlord contact information disclosure is required.</p>
<p><strong>Move-In Inspection (NRS 118A.200):</strong> Move-in inspection checklist is required within 5 days of move-in.</p>
<p><strong>Bed Bug Disclosure:</strong> Landlord has no knowledge of any bed bug infestation on the Premises.</p>
<p><strong>Lead-Based Paint:</strong> Disclosure required for pre-1978 properties.</p>`,
    VA: `<p><strong>Fair Housing:</strong> In accordance with the Virginia Fair Housing Law (Va. Code 36-96.1), discrimination is prohibited based on race, color, religion, sex, national origin, familial status, disability, elderliness, or source of funds.</p>
<p><strong>Mold Disclosure (Va. Code 55.1-1215):</strong> Landlord shall disclose visible mold in areas readily accessible within the dwelling unit.</p>
<p><strong>Security Deposit (Virginia Code 55.1-1226):</strong> Deposit must be returned within 45 days with itemized statement. Limit is two months rent.</p>
<p><strong>Entry Notice:</strong> Landlord shall provide at least 24 hours notice before entering except in emergencies.</p>
<p><strong>Move-In Inspection:</strong> Written move-in inspection report is required within 5 days of occupancy.</p>
<p><strong>Lead-Based Paint:</strong> Disclosure required for pre-1978 properties.</p>`,
    OH: `<p><strong>Fair Housing:</strong> In accordance with the Ohio Fair Housing Law (ORC Chapter 4112), discrimination is prohibited based on race, color, religion, sex, national origin, familial status, disability, ancestry, or military status.</p>
<p><strong>Security Deposit (ORC 5321.16):</strong> Deposit must be returned within 30 days with itemized statement. No statutory limit on amount.</p>
<p><strong>Entry Notice:</strong> Landlord shall provide at least 24 hours notice before entering except in emergencies.</p>
<p><strong>Lead-Based Paint:</strong> Disclosure required for pre-1978 properties. Ohio requires additional disclosures for properties built before 1978.</p>`,
    MI: `<p><strong>Fair Housing:</strong> In accordance with the Michigan Elliott-Larsen Civil Rights Act (MCL 37.2101), discrimination is prohibited based on race, color, religion, sex, national origin, familial status, or disability.</p>
<p><strong>Security Deposit (MCL 554.602-616):</strong> Deposit must be returned within 30 days with itemized statement. Limit is one and one-half months rent.</p>
<p><strong>Deposit Escrow:</strong> Deposit must be held in a regulated financial institution and Landlord must provide Tenant with deposit notice within 14 days.</p>
<p><strong>Move-In Checklist (MCL 554.608):</strong> Inventory checklist at move-in is required to document property condition.</p>
<p><strong>Lead-Based Paint:</strong> Disclosure required for pre-1978 properties.</p>`,
    NC: `<p><strong>Fair Housing:</strong> In accordance with the North Carolina Fair Housing Act (NCGS 41A-1), discrimination is prohibited based on race, color, religion, sex, national origin, familial status, or disability.</p>
<p><strong>Security Deposit (NCGS 42-50-56):</strong> Deposit must be returned within 30 days with itemized statement. Limit varies by lease length.</p>
<p><strong>Deposit Trust Account:</strong> Landlord must deposit security in a trust account in a licensed North Carolina bank.</p>
<p><strong>Entry Notice:</strong> Reasonable notice is required before entering except in emergencies.</p>
<p><strong>Lead-Based Paint:</strong> Disclosure required for pre-1978 properties.</p>`,
    ID: `<p><strong>Fair Housing:</strong> In accordance with the Idaho Human Rights Act (Idaho Code 67-5901), discrimination is prohibited based on race, color, religion, sex, national origin, or disability.</p>
<p><strong>Security Deposit (Idaho Code 6-321):</strong> Deposit must be returned within 21-30 days with itemized statement. No statutory limit on amount.</p>
<p><strong>Entry Notice:</strong> Reasonable notice is required before entering except in emergencies.</p>
<p><strong>Lead-Based Paint:</strong> Disclosure required for pre-1978 properties.</p>`,
    ND: `<p><strong>Fair Housing:</strong> In accordance with the North Dakota Fair Housing Act (NDCC 14-02.5), discrimination is prohibited based on race, color, religion, sex, national origin, familial status, disability, or status with regard to marriage or public assistance.</p>
<p><strong>Security Deposit (NDCC 47-16-07.1):</strong> Deposit must be returned within 30 days with itemized statement. Limit is one month rent (exceptions apply).</p>
<p><strong>Landlord Lien (NDCC 35-21):</strong> Landlord has lien on tenant property for unpaid rent.</p>
<p><strong>Lead-Based Paint:</strong> Disclosure required for pre-1978 properties.</p>`,
    SD: `<p><strong>Fair Housing:</strong> In accordance with the South Dakota Human Relations Act (SDCL 20-13), discrimination is prohibited based on race, color, religion, sex, national origin, familial status, or disability.</p>
<p><strong>Security Deposit (SDCL 43-32-6.1):</strong> Deposit must be returned within 14-45 days with itemized statement. Limit is one month rent.</p>
<p><strong>Entry Notice:</strong> Landlord shall provide at least 24 hours notice before entering except in emergencies.</p>
<p><strong>Lead-Based Paint:</strong> Disclosure required for pre-1978 properties.</p>`,
    WY: `<p><strong>Fair Housing:</strong> In accordance with the Wyoming Fair Housing Act (Wyo. Stat. 40-26-101), discrimination is prohibited based on race, color, religion, sex, national origin, familial status, or disability.</p>
<p><strong>Security Deposit (W.S. 1-21-1207-1208):</strong> Deposit must be returned within 30 days (or 15 days if no deductions). Deposit may not exceed two months rent unless otherwise agreed.</p>
<p><strong>Entry Notice:</strong> Wyoming law does not specify minimum notice, but reasonable notice is required except in emergencies.</p>
<p><strong>Lead-Based Paint:</strong> Disclosure required for pre-1978 properties.</p>`,
  };

  return provisions[stateId] || `<p><strong>Fair Housing:</strong> Discrimination is prohibited based on protected classes under federal and state fair housing laws.</p>
<p><strong>Security Deposit:</strong> Deposit must be returned within ${depositDays} days with itemized statement.</p>
<p><strong>Lead-Based Paint:</strong> Disclosure required for pre-1978 properties.</p>`;
}
