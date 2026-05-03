import { Express } from "express";
import { isAuthenticated, requireAdmin } from "../jwtAuth";
import { db } from "../db";
import { eq, and, desc, asc } from "drizzle-orm";
import {
  noticeForms, noticeFormVersions,
  holidayCalendars, holidayCalendarDates,
  formDayRules, serviceMethods, formServiceRules, formServiceLeaseGates,
  languageBlocks, formRequiredLanguage,
  formFields, fieldValidations,
  outputTemplates, overlayFields,
  generatedNoticeDocuments, noticeAuditEvents,
  insertNoticeFormSchema, insertNoticeFormVersionSchema,
  insertHolidayCalendarSchema, insertHolidayCalendarDateSchema,
  insertFormDayRuleSchema, insertServiceMethodSchema,
  insertFormServiceRuleSchema, insertFormServiceLeaseGateSchema,
  insertLanguageBlockSchema, insertFormRequiredLanguageSchema,
  insertFormFieldSchema, insertFieldValidationSchema,
  insertOutputTemplateSchema, insertOverlayFieldSchema,
  insertNoticeAuditEventSchema,
} from "@shared/schema";

export function registerComplianceMatrixRoutes(app: Express) {

  // ============================================================================
  // NOTICE FORMS - CRUD
  // ============================================================================

  app.get('/api/admin/notice-forms', isAuthenticated, requireAdmin, async (_req: any, res) => {
    try {
      const forms = await db.select().from(noticeForms).orderBy(asc(noticeForms.stateId), asc(noticeForms.displayName));
      res.json(forms);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/admin/notice-forms/:id', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const [form] = await db.select().from(noticeForms).where(eq(noticeForms.id, req.params.id));
      if (!form) return res.status(404).json({ message: "Form not found" });
      res.json(form);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/admin/notice-forms', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const parsed = insertNoticeFormSchema.parse(req.body);
      const [form] = await db.insert(noticeForms).values(parsed).returning();
      res.status(201).json(form);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put('/api/admin/notice-forms/:id', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const [form] = await db.update(noticeForms)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(noticeForms.id, req.params.id))
        .returning();
      if (!form) return res.status(404).json({ message: "Form not found" });
      res.json(form);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete('/api/admin/notice-forms/:id', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      await db.delete(noticeForms).where(eq(noticeForms.id, req.params.id));
      res.json({ message: "Form deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================================================
  // FORM VERSIONS - CRUD + status workflow
  // ============================================================================

  app.get('/api/admin/notice-forms/:formId/versions', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const versions = await db.select().from(noticeFormVersions)
        .where(eq(noticeFormVersions.formId, req.params.formId))
        .orderBy(desc(noticeFormVersions.versionNumber));
      res.json(versions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/admin/form-versions/:id', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const [version] = await db.select().from(noticeFormVersions).where(eq(noticeFormVersions.id, req.params.id));
      if (!version) return res.status(404).json({ message: "Version not found" });
      res.json(version);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/admin/form-versions', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const parsed = insertNoticeFormVersionSchema.parse(req.body);
      const [version] = await db.insert(noticeFormVersions).values(parsed).returning();
      res.status(201).json(version);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put('/api/admin/form-versions/:id', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const existing = await db.select().from(noticeFormVersions).where(eq(noticeFormVersions.id, req.params.id));
      if (!existing.length) return res.status(404).json({ message: "Version not found" });

      const oldStatus = existing[0].status;
      const newStatus = req.body.status;

      const [version] = await db.update(noticeFormVersions)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(noticeFormVersions.id, req.params.id))
        .returning();

      if (newStatus && newStatus !== oldStatus) {
        await db.insert(noticeAuditEvents).values({
          formVersionId: req.params.id,
          userId: req.user?.id,
          eventType: newStatus === 'review_required' ? 'form_locked' :
                     newStatus === 'approved' ? 'form_approved' :
                     newStatus === 'retired' ? 'form_retired' : 'form_approved',
          payload: { oldStatus, newStatus, notes: req.body.approvalNotes },
        });
      }

      res.json(version);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete('/api/admin/form-versions/:id', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      await db.delete(noticeFormVersions).where(eq(noticeFormVersions.id, req.params.id));
      res.json({ message: "Version deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================================================
  // HOLIDAY CALENDARS + DATES - CRUD
  // ============================================================================

  app.get('/api/admin/holiday-calendars', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const stateId = req.query.stateId;
      const where = stateId ? eq(holidayCalendars.stateId, stateId as string) : undefined;
      const calendars = await db.select().from(holidayCalendars)
        .where(where)
        .orderBy(asc(holidayCalendars.stateId), desc(holidayCalendars.year));
      res.json(calendars);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/admin/holiday-calendars', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const parsed = insertHolidayCalendarSchema.parse(req.body);
      const [calendar] = await db.insert(holidayCalendars).values(parsed).returning();
      res.status(201).json(calendar);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put('/api/admin/holiday-calendars/:id', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const [calendar] = await db.update(holidayCalendars)
        .set(req.body)
        .where(eq(holidayCalendars.id, req.params.id))
        .returning();
      if (!calendar) return res.status(404).json({ message: "Calendar not found" });
      res.json(calendar);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete('/api/admin/holiday-calendars/:id', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      await db.delete(holidayCalendars).where(eq(holidayCalendars.id, req.params.id));
      res.json({ message: "Calendar deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/admin/holiday-calendars/:calendarId/dates', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const dates = await db.select().from(holidayCalendarDates)
        .where(eq(holidayCalendarDates.holidayCalendarId, req.params.calendarId))
        .orderBy(asc(holidayCalendarDates.date));
      res.json(dates);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/admin/holiday-calendar-dates', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const parsed = insertHolidayCalendarDateSchema.parse(req.body);
      const [dateRecord] = await db.insert(holidayCalendarDates).values(parsed).returning();
      res.status(201).json(dateRecord);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post('/api/admin/holiday-calendar-dates/bulk', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const { calendarId, dates } = req.body;
      if (!Array.isArray(dates) || !calendarId) {
        return res.status(400).json({ message: "calendarId and dates[] required" });
      }
      await db.delete(holidayCalendarDates).where(eq(holidayCalendarDates.holidayCalendarId, calendarId));
      const records = dates.map((d: any) => ({ holidayCalendarId: calendarId, date: d.date, label: d.label }));
      if (records.length) {
        const inserted = await db.insert(holidayCalendarDates).values(records).returning();
        return res.json(inserted);
      }
      res.json([]);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete('/api/admin/holiday-calendar-dates/:id', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      await db.delete(holidayCalendarDates).where(eq(holidayCalendarDates.id, req.params.id));
      res.json({ message: "Date deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================================================
  // DAY RULES - per form version
  // ============================================================================

  app.get('/api/admin/form-versions/:versionId/day-rules', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const rules = await db.select().from(formDayRules)
        .where(eq(formDayRules.formVersionId, req.params.versionId));
      res.json(rules);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/admin/day-rules', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const parsed = insertFormDayRuleSchema.parse(req.body);
      const [rule] = await db.insert(formDayRules).values(parsed).returning();
      res.status(201).json(rule);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put('/api/admin/day-rules/:id', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const [rule] = await db.update(formDayRules).set(req.body).where(eq(formDayRules.id, req.params.id)).returning();
      if (!rule) return res.status(404).json({ message: "Rule not found" });
      res.json(rule);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete('/api/admin/day-rules/:id', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      await db.delete(formDayRules).where(eq(formDayRules.id, req.params.id));
      res.json({ message: "Day rule deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================================================
  // SERVICE METHODS - master list
  // ============================================================================

  app.get('/api/admin/service-methods', isAuthenticated, requireAdmin, async (_req: any, res) => {
    try {
      const methods = await db.select().from(serviceMethods).orderBy(asc(serviceMethods.displayName));
      res.json(methods);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/admin/service-methods', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const parsed = insertServiceMethodSchema.parse(req.body);
      const [method] = await db.insert(serviceMethods).values(parsed).returning();
      res.status(201).json(method);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put('/api/admin/service-methods/:id', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const [method] = await db.update(serviceMethods).set(req.body).where(eq(serviceMethods.id, req.params.id)).returning();
      if (!method) return res.status(404).json({ message: "Method not found" });
      res.json(method);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete('/api/admin/service-methods/:id', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      await db.delete(serviceMethods).where(eq(serviceMethods.id, req.params.id));
      res.json({ message: "Method deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================================================
  // SERVICE RULES - per form version
  // ============================================================================

  app.get('/api/admin/form-versions/:versionId/service-rules', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const rules = await db.select().from(formServiceRules)
        .where(eq(formServiceRules.formVersionId, req.params.versionId))
        .orderBy(asc(formServiceRules.sortOrder));
      res.json(rules);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/admin/service-rules', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const parsed = insertFormServiceRuleSchema.parse(req.body);
      const [rule] = await db.insert(formServiceRules).values(parsed as any).returning();
      res.status(201).json(rule);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put('/api/admin/service-rules/:id', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const [rule] = await db.update(formServiceRules).set(req.body).where(eq(formServiceRules.id, req.params.id)).returning();
      if (!rule) return res.status(404).json({ message: "Rule not found" });
      res.json(rule);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete('/api/admin/service-rules/:id', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      await db.delete(formServiceRules).where(eq(formServiceRules.id, req.params.id));
      res.json({ message: "Rule deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================================================
  // LEASE GATES - per form version
  // ============================================================================

  app.get('/api/admin/form-versions/:versionId/lease-gates', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const gates = await db.select().from(formServiceLeaseGates)
        .where(eq(formServiceLeaseGates.formVersionId, req.params.versionId));
      res.json(gates);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/admin/lease-gates', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const parsed = insertFormServiceLeaseGateSchema.parse(req.body);
      const [gate] = await db.insert(formServiceLeaseGates).values(parsed as any).returning();
      res.status(201).json(gate);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put('/api/admin/lease-gates/:id', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const [gate] = await db.update(formServiceLeaseGates).set(req.body).where(eq(formServiceLeaseGates.id, req.params.id)).returning();
      if (!gate) return res.status(404).json({ message: "Gate not found" });
      res.json(gate);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete('/api/admin/lease-gates/:id', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      await db.delete(formServiceLeaseGates).where(eq(formServiceLeaseGates.id, req.params.id));
      res.json({ message: "Gate deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================================================
  // LANGUAGE BLOCKS - master list + form binding
  // ============================================================================

  app.get('/api/admin/language-blocks', isAuthenticated, requireAdmin, async (_req: any, res) => {
    try {
      const blocks = await db.select().from(languageBlocks).orderBy(asc(languageBlocks.key));
      res.json(blocks);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/admin/language-blocks', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const parsed = insertLanguageBlockSchema.parse(req.body);
      const [block] = await db.insert(languageBlocks).values(parsed).returning();
      res.status(201).json(block);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put('/api/admin/language-blocks/:id', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const [block] = await db.update(languageBlocks)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(languageBlocks.id, req.params.id))
        .returning();
      if (!block) return res.status(404).json({ message: "Block not found" });
      res.json(block);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete('/api/admin/language-blocks/:id', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      await db.delete(languageBlocks).where(eq(languageBlocks.id, req.params.id));
      res.json({ message: "Block deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/admin/form-versions/:versionId/required-language', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const items = await db.select().from(formRequiredLanguage)
        .where(eq(formRequiredLanguage.formVersionId, req.params.versionId))
        .orderBy(asc(formRequiredLanguage.sortOrder));
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/admin/required-language', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const parsed = insertFormRequiredLanguageSchema.parse(req.body);
      const [item] = await db.insert(formRequiredLanguage).values(parsed).returning();
      res.status(201).json(item);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put('/api/admin/required-language/:id', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const [item] = await db.update(formRequiredLanguage).set(req.body).where(eq(formRequiredLanguage.id, req.params.id)).returning();
      if (!item) return res.status(404).json({ message: "Item not found" });
      res.json(item);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete('/api/admin/required-language/:id', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      await db.delete(formRequiredLanguage).where(eq(formRequiredLanguage.id, req.params.id));
      res.json({ message: "Required language deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================================================
  // FORM FIELDS + VALIDATIONS - per form version
  // ============================================================================

  app.get('/api/admin/form-versions/:versionId/fields', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const fields = await db.select().from(formFields)
        .where(eq(formFields.formVersionId, req.params.versionId))
        .orderBy(asc(formFields.sortOrder));
      res.json(fields);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/admin/form-fields', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const parsed = insertFormFieldSchema.parse(req.body);
      const [field] = await db.insert(formFields).values(parsed as any).returning();
      res.status(201).json(field);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put('/api/admin/form-fields/:id', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const [field] = await db.update(formFields).set(req.body).where(eq(formFields.id, req.params.id)).returning();
      if (!field) return res.status(404).json({ message: "Field not found" });
      res.json(field);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete('/api/admin/form-fields/:id', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      await db.delete(formFields).where(eq(formFields.id, req.params.id));
      res.json({ message: "Field deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/admin/form-fields/:fieldId/validations', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const validations = await db.select().from(fieldValidations)
        .where(eq(fieldValidations.fieldId, req.params.fieldId));
      res.json(validations);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/admin/field-validations', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const parsed = insertFieldValidationSchema.parse(req.body);
      const [validation] = await db.insert(fieldValidations).values(parsed).returning();
      res.status(201).json(validation);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put('/api/admin/field-validations/:id', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const [validation] = await db.update(fieldValidations).set(req.body).where(eq(fieldValidations.id, req.params.id)).returning();
      if (!validation) return res.status(404).json({ message: "Validation not found" });
      res.json(validation);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete('/api/admin/field-validations/:id', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      await db.delete(fieldValidations).where(eq(fieldValidations.id, req.params.id));
      res.json({ message: "Validation deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================================================
  // OUTPUT TEMPLATES + OVERLAY FIELDS
  // ============================================================================

  app.get('/api/admin/form-versions/:versionId/output-templates', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const templates = await db.select().from(outputTemplates)
        .where(eq(outputTemplates.formVersionId, req.params.versionId));
      res.json(templates);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/admin/output-templates', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const parsed = insertOutputTemplateSchema.parse(req.body);
      const [template] = await db.insert(outputTemplates).values(parsed).returning();
      res.status(201).json(template);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put('/api/admin/output-templates/:id', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const [template] = await db.update(outputTemplates).set(req.body).where(eq(outputTemplates.id, req.params.id)).returning();
      if (!template) return res.status(404).json({ message: "Template not found" });
      res.json(template);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete('/api/admin/output-templates/:id', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      await db.delete(outputTemplates).where(eq(outputTemplates.id, req.params.id));
      res.json({ message: "Template deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/admin/output-templates/:templateId/overlay-fields', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const fields = await db.select().from(overlayFields)
        .where(eq(overlayFields.outputTemplateId, req.params.templateId))
        .orderBy(asc(overlayFields.pageNumber), asc(overlayFields.y));
      res.json(fields);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/admin/overlay-fields', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const parsed = insertOverlayFieldSchema.parse(req.body);
      const [field] = await db.insert(overlayFields).values(parsed).returning();
      res.status(201).json(field);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post('/api/admin/overlay-fields/bulk', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const { outputTemplateId, fields: fieldsList } = req.body;
      if (!Array.isArray(fieldsList) || !outputTemplateId) {
        return res.status(400).json({ message: "outputTemplateId and fields[] required" });
      }
      await db.delete(overlayFields).where(eq(overlayFields.outputTemplateId, outputTemplateId));
      if (fieldsList.length) {
        const records = fieldsList.map((f: any) => ({ ...f, outputTemplateId }));
        const inserted = await db.insert(overlayFields).values(records).returning();
        return res.json(inserted);
      }
      res.json([]);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put('/api/admin/overlay-fields/:id', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const [field] = await db.update(overlayFields).set(req.body).where(eq(overlayFields.id, req.params.id)).returning();
      if (!field) return res.status(404).json({ message: "Field not found" });
      res.json(field);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete('/api/admin/overlay-fields/:id', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      await db.delete(overlayFields).where(eq(overlayFields.id, req.params.id));
      res.json({ message: "Field deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================================================
  // HYDRATED FORM DEFINITION - Matrix Resolver read endpoint
  // ============================================================================

  app.get('/api/admin/form-versions/:versionId/full', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const [version] = await db.select().from(noticeFormVersions).where(eq(noticeFormVersions.id, req.params.versionId));
      if (!version) return res.status(404).json({ message: "Version not found" });

      const [form] = await db.select().from(noticeForms).where(eq(noticeForms.id, version.formId));

      const [dayRulesResult, serviceRulesResult, leaseGatesResult, requiredLangResult, fieldsResult, outputTemplatesResult] = await Promise.all([
        db.select().from(formDayRules).where(eq(formDayRules.formVersionId, req.params.versionId)),
        db.select().from(formServiceRules).where(eq(formServiceRules.formVersionId, req.params.versionId)).orderBy(asc(formServiceRules.sortOrder)),
        db.select().from(formServiceLeaseGates).where(eq(formServiceLeaseGates.formVersionId, req.params.versionId)),
        db.select().from(formRequiredLanguage).where(eq(formRequiredLanguage.formVersionId, req.params.versionId)).orderBy(asc(formRequiredLanguage.sortOrder)),
        db.select().from(formFields).where(eq(formFields.formVersionId, req.params.versionId)).orderBy(asc(formFields.sortOrder)),
        db.select().from(outputTemplates).where(eq(outputTemplates.formVersionId, req.params.versionId)),
      ]);

      const langBlockIds = requiredLangResult.map(r => r.languageBlockId);
      let langBlocksMap: Record<string, any> = {};
      if (langBlockIds.length) {
        const blocks = await db.select().from(languageBlocks);
        blocks.forEach(b => { langBlocksMap[b.id] = b; });
      }

      let overlayFieldsMap: Record<string, any[]> = {};
      for (const tmpl of outputTemplatesResult) {
        const fields = await db.select().from(overlayFields)
          .where(eq(overlayFields.outputTemplateId, tmpl.id))
          .orderBy(asc(overlayFields.pageNumber), asc(overlayFields.y));
        overlayFieldsMap[tmpl.id] = fields;
      }

      const fieldValidationsResult: Record<string, any[]> = {};
      for (const field of fieldsResult) {
        const vals = await db.select().from(fieldValidations).where(eq(fieldValidations.fieldId, field.id));
        if (vals.length) fieldValidationsResult[field.id] = vals;
      }

      res.json({
        form,
        version,
        dayRules: dayRulesResult,
        serviceRules: serviceRulesResult,
        leaseGates: leaseGatesResult,
        requiredLanguage: requiredLangResult.map(r => ({
          ...r,
          block: langBlocksMap[r.languageBlockId] || null,
        })),
        fields: fieldsResult.map(f => ({
          ...f,
          validations: fieldValidationsResult[f.id] || [],
        })),
        outputTemplates: outputTemplatesResult.map(t => ({
          ...t,
          overlayFields: overlayFieldsMap[t.id] || [],
        })),
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================================================
  // AUDIT EVENTS - read-only for admin
  // ============================================================================

  app.get('/api/admin/notice-audit-events', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const formVersionId = req.query.formVersionId;
      const where = formVersionId ? eq(noticeAuditEvents.formVersionId, formVersionId as string) : undefined;
      const events = await db.select().from(noticeAuditEvents)
        .where(where)
        .orderBy(desc(noticeAuditEvents.createdAt))
        .limit(100);
      res.json(events);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
}
