import { Router } from "express";
import {
  resolveForm,
  validateInputs,
  calculateDates,
  resolveServiceMethods,
  enforceServiceHierarchy,
  renderHtml,
} from "../engine";
import { db } from "../db";
import { generatedNoticeDocuments, noticeAuditEvents } from "@shared/schema";
import { randomUUID } from "crypto";
import { renderDocument, saveRenderProvenance } from "../engine/documentRenderer";

const router = Router();

function selectDayRule(def: any, gateAnswers?: Record<string, string>) {
  if (!def.dayRules || def.dayRules.length === 0) return null;
  if (def.dayRules.length === 1) return def.dayRules[0];
  if (gateAnswers && def.leaseGates) {
    for (const gate of def.leaseGates) {
      if (gate.affectsNoticePeriod) {
        const answer = gateAnswers[gate.gateKey];
        const matchRule = def.dayRules.find((r: any) => r.dayType === answer);
        if (matchRule) return matchRule;
      }
    }
  }
  return def.dayRules[0];
}

router.get("/api/notice-forms/:formKey/definition", async (req, res) => {
  try {
    const def = await resolveForm(req.params.formKey);
    const serviceMethods = resolveServiceMethods(def, {});

    res.json({
      form: def.form,
      version: def.version,
      dayRules: def.dayRules,
      serviceMethods,
      leaseGates: def.leaseGates,
      requiredLanguage: def.requiredLanguage,
      fields: def.fields,
      outputMode: def.outputTemplate?.mode || 'leaseshield_formatted',
    });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

router.post("/api/notice-forms/:formKey/validate", async (req, res) => {
  try {
    const def = await resolveForm(req.params.formKey);
    const { inputs, gateAnswers, serviceSelection } = req.body;
    const result = validateInputs(def, inputs || {}, gateAnswers || {}, serviceSelection || {});
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/api/notice-forms/:formKey/calculate-dates", async (req, res) => {
  try {
    const def = await resolveForm(req.params.formKey);
    const { serviceDate, gateAnswers } = req.body;

    if (!serviceDate) {
      return res.status(400).json({ error: "serviceDate is required" });
    }

    const applicableRule = selectDayRule(def, gateAnswers);

    if (!applicableRule) {
      return res.json({ complianceDeadline: null, earliestFilingDate: null, explainFormula: 'No day rules configured for this form' });
    }

    const result = calculateDates({
      dayType: applicableRule.dayType,
      noticePeriodDays: applicableRule.noticePeriodDays,
      countingConvention: applicableRule.countingConvention,
      serviceDate,
      holidays: applicableRule.holidays,
    });

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/api/notice-forms/:formKey/service-methods", async (req, res) => {
  try {
    const def = await resolveForm(req.params.formKey);
    const { gateAnswers, selectedMethodIds } = req.body;
    const methods = resolveServiceMethods(def, gateAnswers || {});
    const hierarchy = enforceServiceHierarchy(def, selectedMethodIds || []);

    res.json({ methods, hierarchy });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/api/notice-forms/:formKey/preview", async (req, res) => {
  try {
    const def = await resolveForm(req.params.formKey);
    const { inputs, gateAnswers, serviceSelection, serviceDate } = req.body;

    const validation = validateInputs(def, inputs || {}, gateAnswers || {}, serviceSelection || {});

    let dateCalc = null;
    const rule = selectDayRule(def, gateAnswers);
    if (serviceDate && rule) {
      dateCalc = calculateDates({
        dayType: rule.dayType,
        noticePeriodDays: rule.noticePeriodDays,
        countingConvention: rule.countingConvention,
        serviceDate,
        holidays: rule.holidays,
      });
    }

    const html = renderHtml({ def, inputs: inputs || {}, serviceSelection: serviceSelection || {}, dateCalc });

    res.json({
      validation,
      html,
      dateCalc,
      outputMode: def.outputTemplate?.mode || 'leaseshield_formatted',
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/api/notice-forms/:formKey/generate", async (req, res) => {
  try {
    const def = await resolveForm(req.params.formKey);
    const { inputs, gateAnswers, serviceSelection, serviceDate } = req.body;
    const userId = (req as any).userId;

    const validation = validateInputs(def, inputs || {}, gateAnswers || {}, serviceSelection || {});
    if (!validation.valid) {
      return res.status(400).json({ error: 'Validation failed', errors: validation.errors });
    }

    let dateCalc = null;
    const selectedRule = selectDayRule(def, gateAnswers);
    if (serviceDate && selectedRule) {
      dateCalc = calculateDates({
        dayType: selectedRule.dayType,
        noticePeriodDays: selectedRule.noticePeriodDays,
        countingConvention: selectedRule.countingConvention,
        serviceDate,
        holidays: selectedRule.holidays,
      });
    }

    const html = renderHtml({ def, inputs: inputs || {}, serviceSelection: serviceSelection || {}, dateCalc });
    const overlayData = getOverlayData({ def, inputs: inputs || {}, serviceSelection: serviceSelection || {}, dateCalc });

    const docId = randomUUID();
    await db.insert(generatedNoticeDocuments).values({
      id: docId,
      formVersionId: def.version.id,
      userId: userId || null,
      inputSnapshot: inputs,
      gateSnapshot: gateAnswers,
      serviceSnapshot: serviceSelection,
      dateCalcSnapshot: dateCalc,
      renderedHtml: html,
      overlayJson: overlayData.length > 0 ? overlayData : null,
      complianceDeadline: dateCalc?.complianceDeadline || null,
      earliestFilingDate: dateCalc?.earliestFilingDate || null,
    } as any);

    await db.insert(noticeAuditEvents).values({
      id: randomUUID(),
      documentId: docId,
      eventType: 'generated',
      actorId: userId || null,
      detail: { formKey: def.form.key, versionNumber: def.version.versionNumber },
    } as any);

    res.json({
      documentId: docId,
      html,
      dateCalc,
      overlayData: overlayData.length > 0 ? overlayData : null,
      form: def.form,
      version: { id: def.version.id, versionNumber: def.version.versionNumber },
    });
  } catch (err: any) {
    console.error('[NoticeGeneration] Error generating document:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/api/notice-forms/:formKey/generate-pdf", async (req, res) => {
  try {
    const formKey = req.params.formKey;
    const def = await resolveForm(formKey);
    const { inputs, gateAnswers, serviceSelection, serviceDate } = req.body;
    const userId = (req as any).userId;

    const validation = validateInputs(def, inputs || {}, gateAnswers || {}, serviceSelection || {});
    if (!validation.valid) {
      return res.status(400).json({ error: 'Validation failed', errors: validation.errors });
    }

    let dateCalc = null;
    const selectedRule = selectDayRule(def, gateAnswers);
    if (serviceDate && selectedRule) {
      dateCalc = calculateDates({
        dayType: selectedRule.dayType,
        noticePeriodDays: selectedRule.noticePeriodDays,
        countingConvention: selectedRule.countingConvention,
        serviceDate,
        holidays: selectedRule.holidays,
      });
    }

    const outputMode = def.outputTemplate?.mode || 'leaseshield_formatted';

    if (outputMode === 'official_pdf_overlay') {
      const rendered = await renderDocument({
        noticeFormKey: formKey,
        inputs: inputs || {},
        gateAnswers: gateAnswers || {},
        serviceSelection: serviceSelection || {},
        dateCalc,
        userId,
        format: 'pdf',
      });

      if (userId) {
        try {
          const docId = randomUUID();
          await db.insert(generatedNoticeDocuments).values({
            id: docId,
            formVersionId: def.version.id,
            userId,
            inputSnapshot: inputs,
            gateSnapshot: gateAnswers,
            serviceSnapshot: serviceSelection,
            dateCalcSnapshot: dateCalc,
            renderedHtml: null,
            overlayJson: null,
            complianceDeadline: dateCalc?.complianceDeadline || null,
            earliestFilingDate: dateCalc?.earliestFilingDate || null,
          } as any);

          await saveRenderProvenance(docId, {
            renderModeUsed: rendered.renderModeUsed,
            renderStrategyUsed: rendered.renderStrategyUsed,
            basePdfSha256: rendered.basePdfSha256,
            outputPdfSha256: rendered.outputPdfSha256,
          });

          await db.insert(noticeAuditEvents).values({
            id: randomUUID(),
            documentId: docId,
            eventType: 'generated',
            actorId: userId,
            detail: {
              formKey: def.form.key,
              versionNumber: def.version.versionNumber,
              outputMode: rendered.renderModeUsed,
              renderStrategy: rendered.renderStrategyUsed,
            },
          } as any);
        } catch (dbErr: any) {
          console.warn('[NoticeGeneration] Failed to log document generation:', dbErr.message);
        }
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${rendered.filename}"`);
      res.setHeader('Content-Length', rendered.buffer.length);
      return res.send(rendered.buffer);
    }

    const html = renderHtml({ def, inputs: inputs || {}, serviceSelection: serviceSelection || {}, dateCalc });
    return res.json({
      fallback: true,
      html,
      dateCalc,
      error: 'Form is not configured for PDF overlay mode. Returning HTML output instead.',
    });
  } catch (err: any) {
    console.error('[NoticeGeneration] Error generating PDF:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
