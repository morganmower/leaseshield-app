import { db } from "../db";
import { randomUUID } from "crypto";
import {
  noticeForms, noticeFormVersions,
  formDayRules, formServiceRules,
  formRequiredLanguage, languageBlocks,
  formFields, fieldValidations,
  outputTemplates,
} from "@shared/schema";
import { eq } from "drizzle-orm";

const SERVICE_METHOD_IDS = {
  personal: '3f6115b9-2a72-4580-b5a5-1c17a95c4c10',
  substitute: 'dccf1121-d509-463d-9d83-dca2bb5b54f8',
  first_class_mail: 'e8f96a37-0cf7-42f8-9580-29e9d7b6ffa9',
  certified_mail: '3dce2f7c-a211-4a45-8fb5-f7ac8aa4c19c',
  posting: '7c139675-869b-4721-9b56-5af66b3f2e8e',
  electronic: '810f622e-efdd-49fd-8f43-aae2be0394c9',
};

async function seed() {
  console.log('Seeding Michigan DC 100c - Complaint for Land Contract Forfeiture / Termination...');

  const existing = await db.select().from(noticeForms).where(eq(noticeForms.key, 'mi_dc_100c_complaint_land_contract'));
  if (existing.length > 0) {
    console.log('Michigan DC 100c already exists, skipping...');
    process.exit(0);
  }

  const formId = randomUUID();
  const versionId = randomUUID();

  await db.insert(noticeForms).values({
    id: formId,
    stateId: 'MI',
    key: 'mi_dc_100c_complaint_land_contract',
    displayName: 'Complaint - Land Contract Forfeiture / Termination (DC 100c)',
    category: 'eviction',
    localOverlayRisk: 'med',
    disclaimerText: 'Land contract forfeiture proceedings have specific timing requirements. Some Michigan jurisdictions may have additional local requirements. Consult with legal counsel.',
    isActive: true,
  } as any);

  await db.insert(noticeFormVersions).values({
    id: versionId,
    formId,
    versionNumber: 1,
    status: 'approved',
    effectiveStart: '2024-01-01',
    effectiveEnd: null,
    statuteSourceCitation: 'MCL 600.5726; MCL 600.5728; MCL 554.134',
    approvalNotes: 'Initial version - Michigan SCAO DC 100c form for land contract forfeiture',
  } as any);

  await db.insert(formDayRules).values({
    id: randomUUID(),
    formVersionId: versionId,
    dayType: 'calendar',
    noticePeriodDays: 90,
    countingConvention: 'day0_service_plus_n',
    holidayCalendarId: null,
  } as any);

  for (const rule of [
    { methodId: SERVICE_METHOD_IDS.personal, isAllowed: true, requiresPriorAttempts: false, priorAttemptMethodIds: [], requiresAdditionalMethods: false, additionalMethodIds: [], ackText: null, requiresAck: false, sortOrder: 1 },
    { methodId: SERVICE_METHOD_IDS.substitute, isAllowed: true, requiresPriorAttempts: false, priorAttemptMethodIds: [], requiresAdditionalMethods: true, additionalMethodIds: [SERVICE_METHOD_IDS.first_class_mail], ackText: 'Substituted service also requires mailing per MCR 2.105(A)(2)', requiresAck: true, sortOrder: 2 },
    { methodId: SERVICE_METHOD_IDS.first_class_mail, isAllowed: true, requiresPriorAttempts: false, priorAttemptMethodIds: [], requiresAdditionalMethods: false, additionalMethodIds: [], ackText: null, requiresAck: false, sortOrder: 3 },
    { methodId: SERVICE_METHOD_IDS.certified_mail, isAllowed: true, requiresPriorAttempts: false, priorAttemptMethodIds: [], requiresAdditionalMethods: false, additionalMethodIds: [], ackText: 'Certified mail is recommended for land contract forfeiture notices per MCL 600.5726', requiresAck: false, sortOrder: 4 },
    { methodId: SERVICE_METHOD_IDS.posting, isAllowed: true, requiresPriorAttempts: true, priorAttemptMethodIds: [SERVICE_METHOD_IDS.personal], requiresAdditionalMethods: true, additionalMethodIds: [SERVICE_METHOD_IDS.first_class_mail], ackText: 'Posting requires prior attempt at personal service plus mailing', requiresAck: true, sortOrder: 5 },
    { methodId: SERVICE_METHOD_IDS.electronic, isAllowed: false, requiresPriorAttempts: false, priorAttemptMethodIds: [], requiresAdditionalMethods: false, additionalMethodIds: [], ackText: null, requiresAck: false, sortOrder: 6 },
  ]) {
    await db.insert(formServiceRules).values({
      id: randomUUID(),
      formVersionId: versionId,
      ...rule,
    } as any);
  }

  const langBlocks = [
    {
      key: 'mi_land_contract_forfeiture_header',
      text: 'NOTICE OF FORFEITURE OF LAND CONTRACT\n\nTO THE PURCHASER(S) AND ALL OCCUPANTS OF THE PREMISES DESCRIBED BELOW:',
      sourceCitation: 'SCAO Form DC 100c',
      blockType: 'statutory_language',
    },
    {
      key: 'mi_land_contract_forfeiture_body',
      text: 'NOTICE IS HEREBY GIVEN that the land contract dated {{contract_date}} between {{seller_name}} (Seller) and {{buyer_name}} (Purchaser) for the property described below is being forfeited due to nonpayment of the amount due. The purchaser has NINETY (90) DAYS from service of this notice to cure the default by paying the full amount due. If the default is not cured, the land contract will be forfeited and the seller will be entitled to possession of the premises.',
      sourceCitation: 'MCL 600.5726; MCL 600.5728',
      blockType: 'statutory_language',
    },
    {
      key: 'mi_land_contract_90day_cure',
      text: 'YOU HAVE THE RIGHT TO CURE THIS DEFAULT by paying the total amount due, including late charges and costs, within 90 days after service of this notice. Payment must be made to the seller or the seller\'s agent at the address shown on this notice.',
      sourceCitation: 'MCL 600.5728',
      blockType: 'tenant_options_cure',
    },
  ];

  const langBlockIds: Record<string, string> = {};
  for (const block of langBlocks) {
    const id = randomUUID();
    langBlockIds[block.key] = id;
    await db.insert(languageBlocks).values({
      id,
      key: block.key,
      text: block.text,
      sourceCitation: block.sourceCitation,
    } as any);
  }

  let langSort = 1;
  for (const block of langBlocks) {
    await db.insert(formRequiredLanguage).values({
      id: randomUUID(),
      formVersionId: versionId,
      languageBlockId: langBlockIds[block.key],
      blockType: block.blockType,
      isRequired: true,
      sortOrder: langSort++,
    } as any);
  }

  const fields = [
    { key: 'seller_name', label: 'Seller (Vendor) Name', type: 'text', required: true, group: 'Parties', helpText: 'Full legal name of the land contract seller' },
    { key: 'seller_address', label: 'Seller Address', type: 'text', required: true, group: 'Parties', helpText: null },
    { key: 'seller_city_state_zip', label: 'Seller City, State, ZIP', type: 'text', required: true, group: 'Parties', helpText: null },
    { key: 'seller_phone', label: 'Seller Phone', type: 'text', required: false, group: 'Parties', helpText: null },
    { key: 'buyer_name', label: 'Purchaser (Vendee) Name', type: 'text', required: true, group: 'Parties', helpText: 'Full legal name of the land contract buyer' },
    { key: 'buyer_address', label: 'Purchaser Address', type: 'text', required: true, group: 'Parties', helpText: null },
    { key: 'buyer_city_state_zip', label: 'Purchaser City, State, ZIP', type: 'text', required: true, group: 'Parties', helpText: null },
    { key: 'premises_address', label: 'Property Address', type: 'text', required: true, group: 'Property', helpText: 'Full street address of the subject property' },
    { key: 'premises_city', label: 'City', type: 'text', required: true, group: 'Property', helpText: null },
    { key: 'premises_county', label: 'County', type: 'text', required: true, group: 'Property', helpText: 'Michigan county where the property is located' },
    { key: 'legal_description', label: 'Legal Description', type: 'textarea', required: false, group: 'Property', helpText: 'Legal description of the property from the land contract (optional but recommended)' },
    { key: 'contract_date', label: 'Land Contract Date', type: 'date', required: true, group: 'Contract', helpText: 'Date the land contract was executed' },
    { key: 'total_contract_price', label: 'Total Contract Price', type: 'money', required: true, group: 'Contract', helpText: null },
    { key: 'amount_due', label: 'Total Amount Due', type: 'money', required: true, group: 'Financial', helpText: 'Total amount past due including principal, interest, taxes, insurance' },
    { key: 'payments_missed_from', label: 'Payments Missed From', type: 'date', required: true, group: 'Financial', helpText: 'Start date of the missed payment period' },
    { key: 'payments_missed_to', label: 'Payments Missed To', type: 'date', required: true, group: 'Financial', helpText: 'End date of the missed payment period' },
    { key: 'monthly_payment_amount', label: 'Monthly Payment Amount', type: 'money', required: true, group: 'Financial', helpText: 'Regular monthly payment amount per the land contract' },
    { key: 'service_date', label: 'Date of Service', type: 'date', required: true, group: 'Service', helpText: 'Date this notice was served' },
    { key: 'server_name', label: 'Name of Person Serving', type: 'text', required: true, group: 'Service', helpText: null },
  ];

  let fieldSort = 1;
  const fieldIds: Record<string, string> = {};
  for (const f of fields) {
    const id = randomUUID();
    fieldIds[f.key] = id;
    await db.insert(formFields).values({
      id,
      formVersionId: versionId,
      key: f.key,
      label: f.label,
      type: f.type,
      required: f.required,
      helpText: f.helpText,
      defaultValue: null,
      selectOptions: null,
      visibilityRule: null,
      sortOrder: fieldSort++,
      fieldGroup: f.group,
    } as any);
  }

  const validations = [
    { fieldKey: 'amount_due', validationType: 'custom_rule', params: { rule: 'money_positive' }, errorMessage: 'Amount due must be greater than $0' },
    { fieldKey: 'monthly_payment_amount', validationType: 'custom_rule', params: { rule: 'money_positive' }, errorMessage: 'Monthly payment must be greater than $0' },
    { fieldKey: 'total_contract_price', validationType: 'custom_rule', params: { rule: 'money_positive' }, errorMessage: 'Contract price must be greater than $0' },
    { fieldKey: 'seller_name', validationType: 'disallow_tokens', params: { tokens: ['[', ']', 'PLACEHOLDER', 'SAMPLE'] }, errorMessage: 'Enter a real seller name' },
    { fieldKey: 'buyer_name', validationType: 'disallow_tokens', params: { tokens: ['[', ']', 'PLACEHOLDER', 'SAMPLE'] }, errorMessage: 'Enter a real buyer name' },
  ];

  for (const v of validations) {
    await db.insert(fieldValidations).values({
      id: randomUUID(),
      fieldId: fieldIds[v.fieldKey],
      validationType: v.validationType,
      params: v.params,
      errorMessage: v.errorMessage,
    } as any);
  }

  await db.insert(outputTemplates).values({
    id: randomUUID(),
    formVersionId: versionId,
    mode: 'leaseshield_formatted',
    basePdfAttachmentPath: null,
    htmlTemplate: null,
    docxTemplateAttachmentPath: null,
    pageCount: null,
  } as any);

  console.log('Michigan DC 100c seeded successfully!');
  console.log(`  Form ID: ${formId}`);
  console.log(`  Version ID: ${versionId}`);
  console.log(`  Fields: ${fields.length}`);
  console.log(`  Language blocks: ${langBlocks.length}`);
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
