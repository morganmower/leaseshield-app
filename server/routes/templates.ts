import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated, requireAccess, requireAdmin } from "../jwtAuth";
import { insertTemplateSchema } from "@shared/schema";
import { sendBinaryDownload, assertLooksLikePdf, assertValidDocx, CONTENT_TYPES } from "../utils/download";
import { getUserId } from "./_shared";

export async function registerTemplatesRoutes(app: Express) {
  // Templates routes
  app.get('/api/stats/template-count', async (req, res) => {
    try {
      const templates = await storage.getAllTemplates({});
      res.json({ count: templates.length });
    } catch (error) {
      console.error("Error fetching template count:", error);
      res.status(500).json({ message: "Failed to fetch template count" });
    }
  });

  app.get('/api/templates', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const { stateId, category } = req.query;
      const templates = await storage.getAllTemplates({
        stateId: stateId as string,
        category: category as string,
      });
      res.json(templates);
    } catch (error) {
      console.error("Error fetching templates:", error);
      res.status(500).json({ message: "Failed to fetch templates" });
    }
  });

  app.get('/api/templates/:id', isAuthenticated, requireAccess, async (req, res) => {
    try {
      const template = await storage.getTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      console.error("Error fetching template:", error);
      res.status(500).json({ message: "Failed to fetch template" });
    }
  });

  // Download blank static template (for templates like Rental Applications filled by tenants)
  app.get('/api/templates/:id/download-blank', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const template = await storage.getTemplate(req.params.id);
      
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      // Only allow blank downloads for static templates (e.g., rental applications)
      if (template.generationMode !== 'static') {
        return res.status(400).json({ message: "This template requires filling out via the wizard" });
      }

      // Get format from query param (default: pdf)
      const format = (req.query.format as string)?.toLowerCase() === 'docx' ? 'docx' : 'pdf';
      const safeFilename = template.title.replace(/[^a-z0-9]/gi, '_');
      
      // Route to appropriate generator based on template type
      if (template.templateType === 'move_out_checklist' || template.templateType === 'move_in_checklist') {
        // Use move-out/move-in checklist generator with correct type
        const { generateMoveOutChecklistPdf, generateMoveOutChecklistDocx } = await import("../utils/moveOutChecklistGenerator");
        const checklistType = template.templateType === 'move_in_checklist' ? 'move_in' : 'move_out';
        
        if (format === 'docx') {
          const docxBuffer = await generateMoveOutChecklistDocx({
            templateTitle: template.title,
            stateId: template.stateId,
            version: template.version || 1,
            updatedAt: template.updatedAt || new Date(),
            checklistType,
          });
          await assertValidDocx(docxBuffer);
          sendBinaryDownload(res, {
            buffer: docxBuffer,
            filename: `${safeFilename}.docx`,
            contentType: CONTENT_TYPES.DOCX,
          });
        } else {
          const pdfBuffer = await generateMoveOutChecklistPdf({
            templateTitle: template.title,
            stateId: template.stateId,
            version: template.version || 1,
            updatedAt: template.updatedAt || new Date(),
            checklistType,
          });
          assertLooksLikePdf(pdfBuffer);
          sendBinaryDownload(res, {
            buffer: pdfBuffer,
            filename: `${safeFilename}.pdf`,
            contentType: CONTENT_TYPES.PDF,
          });
        }
      } else {
        // Default to rental application generator for other static templates
        const { generateBlankApplicationPdf, generateBlankApplicationDocx } = await import("../utils/blankApplicationGenerator");
        
        if (format === 'docx') {
          const docxBuffer = await generateBlankApplicationDocx({
            templateTitle: template.title,
            stateId: template.stateId,
            version: template.version || 1,
            updatedAt: template.updatedAt || new Date(),
          });
          await assertValidDocx(docxBuffer);
          sendBinaryDownload(res, {
            buffer: docxBuffer,
            filename: `${safeFilename}.docx`,
            contentType: CONTENT_TYPES.DOCX,
          });
        } else {
          const pdfBuffer = await generateBlankApplicationPdf({
            templateTitle: template.title,
            stateId: template.stateId,
            version: template.version || 1,
            updatedAt: template.updatedAt || new Date(),
          });
          assertLooksLikePdf(pdfBuffer);
          sendBinaryDownload(res, {
            buffer: pdfBuffer,
            filename: `${safeFilename}.pdf`,
            contentType: CONTENT_TYPES.PDF,
          });
        }
      }

      // Track analytics event
      await storage.trackEvent({
        userId,
        eventType: 'blank_template_downloaded',
        eventData: { templateId: template.id, templateTitle: template.title, format },
      });
    } catch (error: any) {
      console.error('Error downloading blank template:', error);
      res.status(500).json({ message: "Failed to download template" });
    }
  });

  // Admin: Create template
  app.post('/api/admin/templates', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const validatedData = insertTemplateSchema.parse(req.body);
      const template = await storage.createTemplate(validatedData);

      // Track analytics event
      await storage.trackEvent({
        userId: getUserId(req),
        eventType: 'template_created',
        eventData: { templateId: template.id },
      });

      res.json(template);
    } catch (error) {
      console.error("Error creating template:", error);
      res.status(500).json({ message: "Failed to create template" });
    }
  });

  // Admin: Update template
  app.put('/api/admin/templates/:id', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertTemplateSchema.partial().parse(req.body);
      const template = await storage.updateTemplate(id, validatedData);
      res.json(template);
    } catch (error) {
      console.error("Error updating template:", error);
      res.status(500).json({ message: "Failed to update template" });
    }
  });

  // Admin: Delete template
  app.delete('/api/admin/templates/:id', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteTemplate(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting template:", error);
      res.status(500).json({ message: "Failed to delete template" });
    }
  });
}
