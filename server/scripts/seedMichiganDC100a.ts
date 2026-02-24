import { db } from "../db";
import { randomUUID } from "crypto";
import {
  noticeForms, noticeFormVersions,
  formDayRules, formServiceRules, formServiceLeaseGates,
  formRequiredLanguage, languageBlocks,
  formFields, fieldValidations,
  outputTemplates,
  holidayCalendars, holidayCalendarDates,
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
  console.log('Seeding Michigan DC 100a — Demand for Possession (Nonpayment of Rent)...');

  const existing = await db.select().from(noticeForms).where(eq(noticeForms.key, 'mi_dc_100a_demand_possession_nonpayment'));
  if (existing.length > 0) {
    console.log('Michigan DC 100a already exists, skipping...');
    process.exit(0);
  }

  const formId = randomUUID();
  const versionId = randomUUID();
  const calendarId = randomUUID();

  // 1. Create Michigan court holiday calendar
  await db.insert(holidayCalendars).values({
    id: calendarId,
    stateId: 'MI',
    name: 'Michigan Court Holidays',
    year: 2026,
    version: '1.0',
    sourceName: 'Michigan Courts - MCR 1.108',
    sourceCitation: 'MCR 1.108; Michigan Compiled Laws',
    isActive: true,
  } as any);

  const holidays2026 = [
    { date: '2026-01-01', label: "New Year's Day" },
    { date: '2026-01-19', label: 'Martin Luther King Jr. Day' },
    { date: '2026-02-16', label: "Presidents' Day" },
    { date: '2026-05-25', label: 'Memorial Day' },
    { date: '2026-07-04', label: 'Independence Day' },
    { date: '2026-09-07', label: 'Labor Day' },
    { date: '2026-11-11', label: 'Veterans Day' },
    { date: '2026-11-26', label: 'Thanksgiving Day' },
    { date: '2026-11-27', label: 'Day After Thanksgiving' },
    { date: '2026-12-24', label: 'Christmas Eve' },
    { date: '2026-12-25', label: 'Christmas Day' },
    { date: '2026-12-31', label: "New Year's Eve" },
  ];

  for (const h of holidays2026) {
    await db.insert(holidayCalendarDates).values({
      id: randomUUID(),
      holidayCalendarId: calendarId,
      date: h.date,
      label: h.label,
    } as any);
  }

  // 2. Create the form
  await db.insert(noticeForms).values({
    id: formId,
    stateId: 'MI',
    key: 'mi_dc_100a_demand_possession_nonpayment',
    displayName: 'Demand for Possession — Nonpayment of Rent (DC 100a)',
    category: 'eviction',
    localOverlayRisk: 'med',
    disclaimerText: 'Some Michigan cities (e.g., Detroit, Ann Arbor) may have local ordinances that require additional notice or cure periods beyond state law. Consult local requirements before serving this notice.',
    isActive: true,
  } as any);

  // 3. Create version 1
  await db.insert(noticeFormVersions).values({
    id: versionId,
    formId,
    versionNumber: 1,
    status: 'approved',
    effectiveStart: '2024-01-01',
    effectiveEnd: null,
    statuteSourceCitation: 'MCL 600.5714(1)(a); MCL 554.134; MCR 4.201',
    approvalNotes: 'Initial version — Michigan SCAO DC 100a form',
  } as any);

  // 4. Day rules — Michigan uses 7-day notice for nonpayment
  await db.insert(formDayRules).values({
    id: randomUUID(),
    formVersionId: versionId,
    dayType: 'calendar',
    noticePeriodDays: 7,
    countingConvention: 'day0_service_plus_n',
    holidayCalendarId: null,
  } as any);

  // 5. Service rules — Michigan MCL 600.5714 allows personal, substitute, posting
  for (const rule of [
    {
      methodId: SERVICE_METHOD_IDS.personal,
      isAllowed: true,
      requiresPriorAttempts: false,
      priorAttemptMethodIds: [],
      requiresAdditionalMethods: false,
      additionalMethodIds: [],
      ackText: null,
      requiresAck: false,
      sortOrder: 1,
    },
    {
      methodId: SERVICE_METHOD_IDS.substitute,
      isAllowed: true,
      requiresPriorAttempts: false,
      priorAttemptMethodIds: [],
      requiresAdditionalMethods: true,
      additionalMethodIds: [SERVICE_METHOD_IDS.first_class_mail],
      ackText: 'Substituted service also requires mailing a copy by first-class mail per MCR 2.105(A)(2)',
      requiresAck: true,
      sortOrder: 2,
    },
    {
      methodId: SERVICE_METHOD_IDS.first_class_mail,
      isAllowed: true,
      requiresPriorAttempts: false,
      priorAttemptMethodIds: [],
      requiresAdditionalMethods: false,
      additionalMethodIds: [],
      ackText: null,
      requiresAck: false,
      sortOrder: 3,
    },
    {
      methodId: SERVICE_METHOD_IDS.posting,
      isAllowed: true,
      requiresPriorAttempts: true,
      priorAttemptMethodIds: [SERVICE_METHOD_IDS.personal],
      requiresAdditionalMethods: true,
      additionalMethodIds: [SERVICE_METHOD_IDS.first_class_mail],
      ackText: 'Posting (nail & mail) requires prior unsuccessful attempt at personal service and simultaneous mailing by first-class mail per MCL 600.5714(1)(a)',
      requiresAck: true,
      sortOrder: 4,
    },
    {
      methodId: SERVICE_METHOD_IDS.certified_mail,
      isAllowed: false,
      requiresPriorAttempts: false,
      priorAttemptMethodIds: [],
      requiresAdditionalMethods: false,
      additionalMethodIds: [],
      ackText: null,
      requiresAck: false,
      sortOrder: 5,
    },
    {
      methodId: SERVICE_METHOD_IDS.electronic,
      isAllowed: false,
      requiresPriorAttempts: false,
      priorAttemptMethodIds: [],
      requiresAdditionalMethods: false,
      additionalMethodIds: [],
      ackText: null,
      requiresAck: false,
      sortOrder: 6,
    },
  ]) {
    await db.insert(formServiceRules).values({
      id: randomUUID(),
      formVersionId: versionId,
      ...rule,
    } as any);
  }

  // 6. Lease gates — Michigan requires lease clause check for nonpayment
  await db.insert(formServiceLeaseGates).values({
    id: randomUUID(),
    formVersionId: versionId,
    gateKey: 'has_written_lease',
    promptText: 'Does this tenancy have a written lease agreement?',
    required: true,
    type: 'boolean',
    selectOptions: null,
    affectsNoticePeriod: false,
    affectsServiceMethods: false,
    affectedMethodIds: [],
  } as any);

  await db.insert(formServiceLeaseGates).values({
    id: randomUUID(),
    formVersionId: versionId,
    gateKey: 'lease_specifies_termination_clause',
    promptText: 'Does the lease contain a specific termination-for-nonpayment clause?',
    required: false,
    type: 'boolean',
    selectOptions: null,
    affectsNoticePeriod: false,
    affectsServiceMethods: false,
    affectedMethodIds: [],
  } as any);

  // 7. Language blocks — required statutory language
  const langBlocks = [
    {
      key: 'mi_demand_possession_header',
      text: 'DEMAND FOR POSSESSION\nNONPAYMENT OF RENT\n\nTO THE TENANT(S) AND ALL OTHER OCCUPANTS OF THE PREMISES DESCRIBED BELOW:',
      sourceCitation: 'SCAO Form DC 100a',
      blockType: 'statutory_language',
    },
    {
      key: 'mi_demand_possession_body',
      text: 'DEMAND IS MADE that you deliver up possession of the following described premises within SEVEN (7) DAYS after service of this demand on the ground that the rent due has not been paid. If you fail to deliver up possession within the time stated above, proceedings will be commenced against you to recover possession and the rent due and other sums required under the lease.',
      sourceCitation: 'MCL 600.5714(1)(a)',
      blockType: 'statutory_language',
    },
    {
      key: 'mi_right_to_cure',
      text: 'YOU MAY AVOID THIS PROCEEDING by paying the full amount of rent due within the seven (7) day period. Payment must be made to the landlord or the landlord\'s agent at the address shown on this demand.',
      sourceCitation: 'MCL 600.5714(1)(a)',
      blockType: 'tenant_options_cure',
    },
    {
      key: 'mi_certificate_of_service',
      text: 'CERTIFICATE OF SERVICE\n\nI certify that on the date stated below, I served a copy of this Demand for Possession on the tenant(s) named above by the method(s) checked below.',
      sourceCitation: 'MCR 2.107(C)',
      blockType: 'other',
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

  // 8. Required language associations
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

  // 9. Form fields — wizard fields for the DC 100a
  const fields = [
    { key: 'plaintiff_name', label: 'Plaintiff (Landlord) Name', type: 'text', required: true, group: 'Parties', helpText: 'Enter the full legal name of the landlord or property owner' },
    { key: 'plaintiff_address', label: 'Plaintiff Address', type: 'text', required: true, group: 'Parties', helpText: 'Street address of the landlord' },
    { key: 'plaintiff_city_state_zip', label: 'Plaintiff City, State, ZIP', type: 'text', required: true, group: 'Parties', helpText: null },
    { key: 'plaintiff_phone', label: 'Plaintiff Phone', type: 'text', required: false, group: 'Parties', helpText: null },

    { key: 'defendant_name', label: 'Defendant (Tenant) Name', type: 'text', required: true, group: 'Parties', helpText: 'Enter the full legal name of the tenant(s)' },
    { key: 'defendant_address', label: 'Defendant Address (Premises)', type: 'text', required: true, group: 'Parties', helpText: 'Address of the rental premises' },
    { key: 'defendant_city_state_zip', label: 'Defendant City, State, ZIP', type: 'text', required: true, group: 'Parties', helpText: null },

    { key: 'premises_address', label: 'Premises Address', type: 'text', required: true, group: 'Property', helpText: 'Full address of the rental property (including unit number if applicable)' },
    { key: 'premises_city', label: 'City', type: 'text', required: true, group: 'Property', helpText: null },
    { key: 'premises_county', label: 'County', type: 'text', required: true, group: 'Property', helpText: 'Michigan county where the property is located' },

    { key: 'rent_amount_due', label: 'Total Rent Amount Due', type: 'money', required: true, group: 'Financial', helpText: 'Total unpaid rent as of the date of this demand' },
    { key: 'rent_period_from', label: 'Rent Period From', type: 'date', required: true, group: 'Financial', helpText: 'Start date of the unpaid rent period' },
    { key: 'rent_period_to', label: 'Rent Period To', type: 'date', required: true, group: 'Financial', helpText: 'End date of the unpaid rent period' },
    { key: 'monthly_rent_amount', label: 'Monthly Rent Amount', type: 'money', required: true, group: 'Financial', helpText: 'Regular monthly rent amount per the lease' },
    { key: 'late_fees', label: 'Late Fees (if applicable)', type: 'money', required: false, group: 'Financial', helpText: 'Late fees assessed per lease terms' },

    { key: 'service_date', label: 'Date of Service', type: 'date', required: true, group: 'Service', helpText: 'Date this demand was served on the tenant' },
    { key: 'server_name', label: 'Name of Person Serving', type: 'text', required: true, group: 'Service', helpText: 'Full name of the person who served this demand' },
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

  // 10. Field validations
  const validations = [
    { fieldKey: 'rent_amount_due', validationType: 'custom_rule', params: { rule: 'money_positive' }, errorMessage: 'Rent amount due must be greater than $0' },
    { fieldKey: 'monthly_rent_amount', validationType: 'custom_rule', params: { rule: 'money_positive' }, errorMessage: 'Monthly rent must be greater than $0' },
    { fieldKey: 'plaintiff_name', validationType: 'disallow_tokens', params: { tokens: ['[', ']', 'PLACEHOLDER', 'SAMPLE', 'TEST'] }, errorMessage: 'Please enter a real plaintiff name, not a placeholder' },
    { fieldKey: 'defendant_name', validationType: 'disallow_tokens', params: { tokens: ['[', ']', 'PLACEHOLDER', 'SAMPLE', 'TEST'] }, errorMessage: 'Please enter a real defendant name, not a placeholder' },
    { fieldKey: 'premises_county', validationType: 'regex', params: { pattern: '^[A-Za-z\\s]+$' }, errorMessage: 'County should contain only letters' },
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

  // 11. Output template — formatted HTML mode for now (overlay mode can be added later with SCAO PDF)
  await db.insert(outputTemplates).values({
    id: randomUUID(),
    formVersionId: versionId,
    mode: 'leaseshield_formatted',
    basePdfAttachmentPath: null,
    htmlTemplate: null,
    docxTemplateAttachmentPath: null,
    pageCount: null,
  } as any);

  console.log('Michigan DC 100a seeded successfully!');
  console.log(`  Form ID: ${formId}`);
  console.log(`  Version ID: ${versionId}`);
  console.log(`  Calendar ID: ${calendarId}`);
  console.log(`  Fields: ${fields.length}`);
  console.log(`  Language blocks: ${langBlocks.length}`);
  console.log(`  Service rules: 6`);
  console.log(`  Lease gates: 2`);
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
