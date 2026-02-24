import { db } from "../db";
import { eq, and, lte, or, isNull, asc, desc } from "drizzle-orm";
import {
  noticeForms, noticeFormVersions,
  formDayRules, formServiceRules, formServiceLeaseGates,
  formRequiredLanguage, languageBlocks,
  formFields, fieldValidations,
  outputTemplates, overlayFields,
  holidayCalendars, holidayCalendarDates,
  serviceMethods,
} from "@shared/schema";

export type HydratedFormDefinition = {
  form: {
    id: string;
    stateId: string;
    key: string;
    displayName: string;
    category: string;
    localOverlayRisk: string;
    disclaimerText: string | null;
  };
  version: {
    id: string;
    versionNumber: number;
    status: string;
    effectiveStart: string | null;
    effectiveEnd: string | null;
    statuteSourceCitation: string | null;
  };
  dayRules: Array<{
    id: string;
    dayType: string;
    noticePeriodDays: number;
    countingConvention: string;
    holidayCalendarId: string | null;
    holidays: Array<{ date: string; label: string }>;
  }>;
  serviceRules: Array<{
    id: string;
    methodId: string;
    methodKey: string;
    methodDisplayName: string;
    isAllowed: boolean;
    requiresPriorAttempts: boolean;
    priorAttemptMethodIds: string[];
    requiresAdditionalMethods: boolean;
    additionalMethodIds: string[];
    ackText: string | null;
    requiresAck: boolean;
    sortOrder: number;
  }>;
  leaseGates: Array<{
    id: string;
    gateKey: string;
    promptText: string;
    required: boolean;
    type: string;
    selectOptions: string[] | null;
    affectsNoticePeriod: boolean;
    affectsServiceMethods: boolean;
    affectedMethodIds: string[];
  }>;
  requiredLanguage: Array<{
    id: string;
    blockType: string;
    isRequired: boolean;
    sortOrder: number;
    block: { key: string; text: string; sourceCitation: string | null };
  }>;
  fields: Array<{
    id: string;
    key: string;
    label: string;
    type: string;
    required: boolean;
    helpText: string | null;
    defaultValue: string | null;
    selectOptions: string[] | null;
    visibilityRule: any;
    sortOrder: number;
    fieldGroup: string | null;
    validations: Array<{
      validationType: string;
      params: any;
      errorMessage: string;
    }>;
  }>;
  outputTemplate: {
    id: string;
    mode: string;
    basePdfAttachmentPath: string | null;
    htmlTemplate: string | null;
    docxTemplateAttachmentPath: string | null;
    pageCount: number | null;
    overlayFields: Array<{
      fieldKey: string;
      pageNumber: number;
      x: number;
      y: number;
      font: string;
      fontSize: number;
      maxWidth: number | null;
      align: string;
      wrap: boolean;
    }>;
  } | null;
};

export async function resolveForm(formKey: string, asOfDate?: Date): Promise<HydratedFormDefinition> {
  const refDate = asOfDate || new Date();
  const dateStr = refDate.toISOString().split('T')[0];

  const [form] = await db.select().from(noticeForms).where(eq(noticeForms.key, formKey));
  if (!form) throw new Error(`Form not found: ${formKey}`);
  if (!form.isActive) throw new Error(`Form is inactive: ${formKey}`);

  const versions = await db.select().from(noticeFormVersions)
    .where(and(
      eq(noticeFormVersions.formId, form.id),
      eq(noticeFormVersions.status, 'approved'),
    ))
    .orderBy(desc(noticeFormVersions.versionNumber));

  const version = versions.find(v => {
    const start = v.effectiveStart;
    const end = v.effectiveEnd;
    if (start && dateStr < start) return false;
    if (end && dateStr > end) return false;
    return true;
  });

  if (!version) throw new Error(`No approved version found for ${formKey} as of ${dateStr}`);

  const allMethods = await db.select().from(serviceMethods);
  const methodMap = new Map(allMethods.map(m => [m.id, m]));

  const [dayRulesResult, serviceRulesResult, leaseGatesResult, reqLangResult, fieldsResult, outputsResult] = await Promise.all([
    db.select().from(formDayRules).where(eq(formDayRules.formVersionId, version.id)),
    db.select().from(formServiceRules).where(eq(formServiceRules.formVersionId, version.id)).orderBy(asc(formServiceRules.sortOrder)),
    db.select().from(formServiceLeaseGates).where(eq(formServiceLeaseGates.formVersionId, version.id)),
    db.select().from(formRequiredLanguage).where(eq(formRequiredLanguage.formVersionId, version.id)).orderBy(asc(formRequiredLanguage.sortOrder)),
    db.select().from(formFields).where(eq(formFields.formVersionId, version.id)).orderBy(asc(formFields.sortOrder)),
    db.select().from(outputTemplates).where(eq(outputTemplates.formVersionId, version.id)),
  ]);

  const hydratedDayRules = await Promise.all(dayRulesResult.map(async (rule) => {
    let holidays: Array<{ date: string; label: string }> = [];
    if (rule.holidayCalendarId) {
      const dates = await db.select().from(holidayCalendarDates)
        .where(eq(holidayCalendarDates.holidayCalendarId, rule.holidayCalendarId))
        .orderBy(asc(holidayCalendarDates.date));
      holidays = dates.map(d => ({ date: d.date, label: d.label }));
    }
    return {
      id: rule.id,
      dayType: rule.dayType,
      noticePeriodDays: rule.noticePeriodDays,
      countingConvention: rule.countingConvention,
      holidayCalendarId: rule.holidayCalendarId,
      holidays,
    };
  }));

  const langBlockIds = reqLangResult.map(r => r.languageBlockId);
  let langBlockMap: Map<string, any> = new Map();
  if (langBlockIds.length) {
    const blocks = await db.select().from(languageBlocks);
    blocks.forEach(b => langBlockMap.set(b.id, b));
  }

  const fieldIds = fieldsResult.map(f => f.id);
  const allValidations = fieldIds.length
    ? await db.select().from(fieldValidations)
    : [];
  const validationsByField = new Map<string, any[]>();
  allValidations.forEach(v => {
    const list = validationsByField.get(v.fieldId) || [];
    list.push(v);
    validationsByField.set(v.fieldId, list);
  });

  let outputTemplate: HydratedFormDefinition['outputTemplate'] = null;
  if (outputsResult.length) {
    const tmpl = outputsResult[0];
    const oFields = await db.select().from(overlayFields)
      .where(eq(overlayFields.outputTemplateId, tmpl.id))
      .orderBy(asc(overlayFields.pageNumber), asc(overlayFields.y));

    outputTemplate = {
      id: tmpl.id,
      mode: tmpl.mode,
      basePdfAttachmentPath: tmpl.basePdfAttachmentPath,
      htmlTemplate: tmpl.htmlTemplate,
      docxTemplateAttachmentPath: tmpl.docxTemplateAttachmentPath,
      pageCount: tmpl.pageCount,
      overlayFields: oFields.map(f => ({
        fieldKey: f.fieldKey,
        pageNumber: f.pageNumber,
        x: f.x,
        y: f.y,
        font: f.font || 'Helvetica',
        fontSize: f.fontSize || 10,
        maxWidth: f.maxWidth,
        align: f.align || 'left',
        wrap: f.wrap || false,
      })),
    };
  }

  return {
    form: {
      id: form.id,
      stateId: form.stateId,
      key: form.key,
      displayName: form.displayName,
      category: form.category,
      localOverlayRisk: form.localOverlayRisk,
      disclaimerText: form.disclaimerText,
    },
    version: {
      id: version.id,
      versionNumber: version.versionNumber,
      status: version.status,
      effectiveStart: version.effectiveStart,
      effectiveEnd: version.effectiveEnd,
      statuteSourceCitation: version.statuteSourceCitation,
    },
    dayRules: hydratedDayRules,
    serviceRules: serviceRulesResult.map(r => {
      const method = methodMap.get(r.methodId);
      return {
        id: r.id,
        methodId: r.methodId,
        methodKey: method?.key || '',
        methodDisplayName: method?.displayName || '',
        isAllowed: r.isAllowed,
        requiresPriorAttempts: r.requiresPriorAttempts,
        priorAttemptMethodIds: (r.priorAttemptMethodIds as string[]) || [],
        requiresAdditionalMethods: r.requiresAdditionalMethods,
        additionalMethodIds: (r.additionalMethodIds as string[]) || [],
        ackText: r.ackText,
        requiresAck: r.requiresAck,
        sortOrder: r.sortOrder,
      };
    }),
    leaseGates: leaseGatesResult.map(g => ({
      id: g.id,
      gateKey: g.gateKey,
      promptText: g.promptText,
      required: g.required,
      type: g.type,
      selectOptions: g.selectOptions as string[] | null,
      affectsNoticePeriod: g.affectsNoticePeriod,
      affectsServiceMethods: g.affectsServiceMethods,
      affectedMethodIds: (g.affectedMethodIds as string[]) || [],
    })),
    requiredLanguage: reqLangResult.map(r => {
      const block = langBlockMap.get(r.languageBlockId);
      return {
        id: r.id,
        blockType: r.blockType,
        isRequired: r.isRequired,
        sortOrder: r.sortOrder,
        block: block ? { key: block.key, text: block.text, sourceCitation: block.sourceCitation } : { key: '', text: '', sourceCitation: null },
      };
    }),
    fields: fieldsResult.map(f => ({
      id: f.id,
      key: f.key,
      label: f.label,
      type: f.type,
      required: f.required,
      helpText: f.helpText,
      defaultValue: f.defaultValue,
      selectOptions: f.selectOptions as string[] | null,
      visibilityRule: f.visibilityRule,
      sortOrder: f.sortOrder,
      fieldGroup: f.fieldGroup,
      validations: (validationsByField.get(f.id) || []).map(v => ({
        validationType: v.validationType,
        params: v.params,
        errorMessage: v.errorMessage,
      })),
    })),
    outputTemplate,
  };
}
