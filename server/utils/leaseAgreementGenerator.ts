import puppeteer from 'puppeteer';
import { execSync } from 'child_process';
import HTMLtoDOCX from 'html-to-docx';

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
  return escapeHtml(String(value));
}

export async function generateLeaseAgreementDocx(options: LeaseAgreementOptions): Promise<Buffer> {
  const { templateTitle, stateId, fieldValues, version = 1, updatedAt = new Date(), landlordInfo } = options;

  console.log('📝 Generating lease agreement DOCX...');
  const startTime = Date.now();

  const htmlContent = generateSimplifiedLeaseHTMLForDOCX(templateTitle, stateId, fieldValues, version, updatedAt, landlordInfo);

  try {
    const docxBuffer = await HTMLtoDOCX(htmlContent, null, {
      table: { row: { cantSplit: true } },
      footer: true,
      pageNumber: true,
      margins: {
        top: 1440,
        right: 1440,
        bottom: 1440,
        left: 1440,
      },
    });

    console.log(`📝 Lease agreement DOCX generated successfully in ${Date.now() - startTime}ms`);
    return Buffer.from(docxBuffer);
  } catch (error) {
    console.error('📝 Error generating lease agreement DOCX:', error);
    throw error;
  }
}

function generateSimplifiedLeaseHTMLForDOCX(
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
</head>
<body style="font-family: Times New Roman, serif; font-size: 12pt; line-height: 1.5;">

<h1 style="text-align: center; text-transform: uppercase; margin-bottom: 5px;">${safeTitle}</h1>
<p style="text-align: center; margin-top: 0;">State of ${stateName}</p>

<table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
<tr>
<td style="width: 50%; padding: 5px;"><strong>Document Version:</strong> ${version}</td>
<td style="width: 50%; padding: 5px;"><strong>Generated:</strong> ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
</tr>
<tr>
<td colspan="2" style="padding: 5px;"><strong>Last Legal Review:</strong> ${new Date(updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
</tr>
</table>

<hr style="margin: 15px 0;">

<h2>1. TERM OF LEASE</h2>
<p>This Residential Lease Agreement ("Lease") is entered into as of ${leaseStartDate} between the undersigned Landlord and Tenant(s) for the rental of the property located at ${propertyAddress}, ${propertyCity}, ${stateId} ${propertyZip} ("Premises"). This Lease shall commence on ${leaseStartDate} and shall terminate at 11:59 PM on ${leaseEndDate} unless sooner terminated or extended in writing by mutual agreement.</p>

<h2>2. PARTIES</h2>
<table style="width: 100%; border-collapse: collapse; margin-bottom: 10px;">
<tr>
<td style="width: 50%; padding: 5px; vertical-align: top;">
<p><strong>LANDLORD:</strong></p>
<p>Name: ${landlordName}</p>
<p>Address: ${landlordAddress}</p>
<p>Phone: ${landlordPhone}</p>
<p>Email: ${landlordEmail}</p>
</td>
<td style="width: 50%; padding: 5px; vertical-align: top;">
<p><strong>TENANT(S):</strong></p>
<p>Name: ${tenantName}</p>
<p>Phone: ${tenantPhone}</p>
<p>Email: ${tenantEmail}</p>
</td>
</tr>
</table>

<h2>3. PROPERTY</h2>
<p>Address: ${propertyAddress}, ${propertyCity}, ${stateId} ${propertyZip}</p>
<p>Property Type: ${propertyType}</p>

<h2>4. RENT AND PAYMENT</h2>
<p><strong>Monthly Rent:</strong> $${monthlyRent} payable on the ${rentDueDay} day of each month.</p>
<p><strong>Late Fee:</strong> If rent is not received within ${lateFeeGracePeriod} days of the due date, a late fee of $${lateFeeAmount} shall be assessed.</p>
<p><strong>NSF Check Fee:</strong> $35 for any returned check.</p>

<h2>5. SECURITY DEPOSIT</h2>
<p><strong>Amount:</strong> $${securityDeposit}</p>
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
${getStateProvisions(stateId, depositDays)}

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

<hr style="margin: 30px 0 20px 0;">

<h2 style="text-align: center;">SIGNATURES</h2>

<table style="width: 100%; border-collapse: collapse; margin-top: 30px;">
<tr>
<td style="width: 50%; padding: 10px; vertical-align: bottom;">
<p style="border-bottom: 1px solid black; width: 90%; margin-bottom: 5px;">&nbsp;</p>
<p>Landlord Signature</p>
<p style="margin-top: 20px;">Date: _______________________</p>
</td>
<td style="width: 50%; padding: 10px; vertical-align: bottom;">
<p style="border-bottom: 1px solid black; width: 90%; margin-bottom: 5px;">&nbsp;</p>
<p>Tenant Signature</p>
<p style="margin-top: 20px;">Date: _______________________</p>
</td>
</tr>
</table>

<p style="margin-top: 40px; text-align: center; font-size: 10pt; color: #666;">
Generated by LeaseShield | For informational purposes only - Consult with a licensed attorney for legal advice
</p>

</body>
</html>`;
}

function getStateProvisions(stateId: string, depositDays: string): string {
  const stateName = STATE_NAMES[stateId] || stateId;
  
  const provisions: Record<string, string> = {
    UT: `
<p><strong>Security Deposit (Utah Code 57-17-3):</strong> Deposit must be returned within 30 days with itemized statement.</p>
<p><strong>Entry Notice:</strong> 24 hours notice required except for emergencies.</p>
<p><strong>Fair Housing (Utah Code 57-21):</strong> Discrimination prohibited based on protected classes.</p>
<p><strong>Lead-Based Paint:</strong> Disclosure required for pre-1978 properties.</p>
`,
    TX: `
<p><strong>Security Deposit (Texas Property Code 92.103-109):</strong> Deposit must be returned within 30 days with itemized accounting.</p>
<p><strong>Late Fees (Texas Property Code 92.019):</strong> Late fees must be reasonable and specified in lease.</p>
<p><strong>Repairs:</strong> Landlord must repair conditions affecting health and safety within reasonable time after written notice.</p>
<p><strong>Lead-Based Paint:</strong> Disclosure required for pre-1978 properties.</p>
`,
    CA: `
<p><strong>Security Deposit (Civil Code 1950.5):</strong> Deposit must be returned within 21 days with itemized statement. Limit is two months rent (unfurnished) or three months (furnished).</p>
<p><strong>Rent Control (AB 1482):</strong> Statewide rent cap and just cause eviction protections may apply.</p>
<p><strong>Mold Disclosure (Civil Code 1942.5):</strong> Required disclosure of known mold.</p>
<p><strong>Lead-Based Paint:</strong> Disclosure required for pre-1978 properties.</p>
`,
    AZ: `
<p><strong>Security Deposit (A.R.S. 33-1321):</strong> Deposit must be returned within 14 days with itemized statement. Limit is one and one-half months rent.</p>
<p><strong>Entry Notice:</strong> Two days notice required except for emergencies.</p>
<p><strong>Pool Safety (A.R.S. 33-1319):</strong> Pool safety disclosure required if applicable.</p>
<p><strong>Lead-Based Paint:</strong> Disclosure required for pre-1978 properties.</p>
`,
    FL: `
<p><strong>Security Deposit (Florida Statutes 83.49):</strong> Deposit must be returned within 15-60 days depending on claims. No statutory limit on amount.</p>
<p><strong>Entry Notice:</strong> 12 hours notice required except for emergencies.</p>
<p><strong>Radon Disclosure:</strong> Required disclosure of radon gas information.</p>
<p><strong>Lead-Based Paint:</strong> Disclosure required for pre-1978 properties.</p>
`,
    NV: `
<p><strong>Security Deposit (NRS 118A.242):</strong> Deposit must be returned within 30 days with itemized statement. Limit is three months rent.</p>
<p><strong>Landlord Contact (NRS 118A.260):</strong> Landlord contact information disclosure required.</p>
<p><strong>Move-In Inspection (NRS 118A.200):</strong> Move-in inspection checklist required.</p>
<p><strong>Lead-Based Paint:</strong> Disclosure required for pre-1978 properties.</p>
`,
    VA: `
<p><strong>Security Deposit (Virginia Code 55.1-1226):</strong> Deposit must be returned within 45 days with itemized statement. Limit is two months rent.</p>
<p><strong>Entry Notice:</strong> 24 hours notice required except for emergencies.</p>
<p><strong>Move-In Inspection:</strong> Written move-in inspection report required within 5 days.</p>
<p><strong>Lead-Based Paint:</strong> Disclosure required for pre-1978 properties.</p>
`,
    OH: `
<p><strong>Security Deposit (ORC 5321.16):</strong> Deposit must be returned within 30 days with itemized statement. No statutory limit on amount.</p>
<p><strong>Entry Notice:</strong> 24 hours notice required except for emergencies.</p>
<p><strong>Fair Housing:</strong> Discrimination prohibited under Ohio Civil Rights Act.</p>
<p><strong>Lead-Based Paint:</strong> Disclosure required for pre-1978 properties.</p>
`,
    MI: `
<p><strong>Security Deposit (MCL 554.602-616):</strong> Deposit must be returned within 30 days with itemized statement. Limit is one and one-half months rent.</p>
<p><strong>Deposit Escrow:</strong> Deposit must be held in regulated financial institution.</p>
<p><strong>Move-In Checklist:</strong> Inventory checklist at move-in recommended.</p>
<p><strong>Lead-Based Paint:</strong> Disclosure required for pre-1978 properties.</p>
`,
    NC: `
<p><strong>Security Deposit (NCGS 42-50-56):</strong> Deposit must be returned within 30 days with itemized statement. Limit varies by lease length.</p>
<p><strong>Entry Notice:</strong> Reasonable notice required except for emergencies.</p>
<p><strong>Fair Housing:</strong> Discrimination prohibited under NC Fair Housing Act.</p>
<p><strong>Lead-Based Paint:</strong> Disclosure required for pre-1978 properties.</p>
`,
    ID: `
<p><strong>Security Deposit (Idaho Code 6-321):</strong> Deposit must be returned within 21-30 days with itemized statement. No statutory limit on amount.</p>
<p><strong>Entry Notice:</strong> Reasonable notice required except for emergencies.</p>
<p><strong>Fair Housing:</strong> Discrimination prohibited under Idaho Human Rights Act.</p>
<p><strong>Lead-Based Paint:</strong> Disclosure required for pre-1978 properties.</p>
`,
    ND: `
<p><strong>Security Deposit (NDCC 47-16-07.1):</strong> Deposit must be returned within 30 days with itemized statement. Limit is one month rent (exceptions apply).</p>
<p><strong>Landlord Lien (NDCC 35-21):</strong> Landlord has lien on tenant property for unpaid rent.</p>
<p><strong>Fair Housing:</strong> Discrimination prohibited under ND Fair Housing Act.</p>
<p><strong>Lead-Based Paint:</strong> Disclosure required for pre-1978 properties.</p>
`,
    SD: `
<p><strong>Security Deposit (SDCL 43-32-6.1):</strong> Deposit must be returned within 14-45 days with itemized statement. Limit is one month rent.</p>
<p><strong>Entry Notice:</strong> 24 hours notice required except for emergencies.</p>
<p><strong>Fair Housing:</strong> Discrimination prohibited under SD Human Relations Act.</p>
<p><strong>Lead-Based Paint:</strong> Disclosure required for pre-1978 properties.</p>
`,
    WY: `
<p><strong>Security Deposit (W.S. 1-21-1208):</strong> Deposit must be returned within 15-30 days. No statutory limit on amount.</p>
<p><strong>Entry Notice:</strong> Reasonable notice required except for emergencies.</p>
<p><strong>Note:</strong> Wyoming has minimal landlord-tenant regulations. Standard lease terms govern most situations.</p>
<p><strong>Lead-Based Paint:</strong> Disclosure required for pre-1978 properties.</p>
`,
  };

  return provisions[stateId] || `
<p><strong>Security Deposit:</strong> Deposit must be returned within ${depositDays} days with itemized statement.</p>
<p><strong>Fair Housing:</strong> Discrimination prohibited based on protected classes.</p>
<p><strong>Lead-Based Paint:</strong> Disclosure required for pre-1978 properties.</p>
`;
}
