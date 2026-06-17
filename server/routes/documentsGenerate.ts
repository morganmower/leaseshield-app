import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../jwtAuth";
import { users } from "@shared/schema";
import { sendBinaryDownload, assertLooksLikePdf, assertValidDocx, CONTENT_TYPES } from "../utils/download";
import { getUserId } from "./_shared";

export async function registerDocumentsGenerateRoutes(app: Express) {
  // Generate filled document (PDF or DOCX)
  app.post('/api/documents/generate', isAuthenticated, async (req: any, res) => {
    try {
      const { templateId, fieldValues } = req.body;
      const format = (req.query.format as string)?.toLowerCase() === 'docx' ? 'docx' : 'pdf';

      if (!templateId || !fieldValues) {
        return res.status(400).json({ message: "Template ID and field values are required" });
      }

      console.log(`📄 Document generation request (${format.toUpperCase()}):`, {
        templateId,
        format,
        fieldCount: Object.keys(fieldValues || {}).length,
        fieldIds: Object.keys(fieldValues || {}),
        sampleValues: Object.entries(fieldValues || {}).slice(0, 3).map(([k, v]) => `${k}=${v}`)
      });

      // Get template
      const template = await storage.getTemplate(templateId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      console.log('📄 Template found:', template.title, `- Generating ${format.toUpperCase()} with field values...`);

      // SECURITY: We NEVER use custom templateContent from the database to prevent HTML injection.
      // All documents are generated using the default template generator with fully escaped user input.
      // If custom templates are needed in the future, they MUST be:
      // 1. Created only by admin users
      // 2. Stored as safe placeholder-based templates (not raw HTML)
      // 3. Rendered through a safe templating engine with auto-escaping

      // Get landlord info for document header
      const userId = getUserId(req);
      const user = userId ? await storage.getUser(userId) : null;
      const landlordInfo = user ? {
        businessName: user.businessName,
        phoneNumber: user.phoneNumber,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      } : undefined;

      // Route to official overlay renderer if this template has an output_template_id configured
      if ((template as any).outputTemplateId && format === 'pdf') {
        try {
          const { renderDocument } = await import("../engine/documentRenderer");
          const rendered = await renderDocument({
            templateId: template.id,
            inputs: fieldValues as Record<string, string | number | boolean>,
            userId,
            format: 'pdf',
          });
          assertLooksLikePdf(rendered.buffer);
          return sendBinaryDownload(res, {
            buffer: rendered.buffer,
            filename: rendered.filename,
            contentType: CONTENT_TYPES.PDF,
          });
        } catch (overlayErr: any) {
          console.warn('[DocumentGenerate] Official overlay PDF failed, falling back to formatted generation:', overlayErr.message);
        }
      }

      // Import document generators
      const { generateDocument, generateDocumentDOCX } = await import("../utils/documentGenerator");
      const { generateLeaseAgreementDocx, generateLeaseAgreementPdf } = await import("../utils/leaseAgreementGenerator");

      const generationOptions = {
        templateTitle: template.title,
        templateContent: '', // Always empty - use default generation only
        fieldValues,
        stateId: template.stateId,
        version: template.version || 1,
        updatedAt: template.updatedAt || new Date(),
        landlordInfo,
      };

      // Check if this is a lease agreement template. Route by template type
      // first (authoritative); fall back to title keywords for safety. This
      // catches lease-type templates whose titles lack "lease"/"rental
      // agreement" (e.g. "Month-to-Month Agreement (XX)"), which would
      // otherwise fall through to the generic generator and silently drop the
      // landlord/tenant contact block.
      const isLeaseAgreement = (template as any).templateType === 'lease' ||
                               template.title.toLowerCase().includes('lease') || 
                               template.title.toLowerCase().includes('rental agreement');

      const safeFilename = template.title.replace(/[^a-z0-9]/gi, '_');
      
      if (format === 'docx') {
        let docxBuffer: Buffer;
        
        if (isLeaseAgreement) {
          // Use specialized lease generator for cleaner DOCX output
          docxBuffer = await generateLeaseAgreementDocx({
            templateTitle: template.title,
            stateId: template.stateId,
            fieldValues,
            version: template.version || 1,
            updatedAt: template.updatedAt || new Date(),
            landlordInfo,
          });
        } else {
          docxBuffer = await generateDocumentDOCX(generationOptions);
        }
        
        await assertValidDocx(docxBuffer);
        sendBinaryDownload(res, {
          buffer: docxBuffer,
          filename: `${safeFilename}.docx`,
          contentType: CONTENT_TYPES.DOCX,
        });
      } else {
        // Generate PDF (default)
        let pdfBuffer: Buffer;
        
        if (isLeaseAgreement) {
          // Use specialized lease generator for consistent PDF/DOCX output
          pdfBuffer = await generateLeaseAgreementPdf({
            templateTitle: template.title,
            stateId: template.stateId,
            fieldValues,
            version: template.version || 1,
            updatedAt: template.updatedAt || new Date(),
            landlordInfo,
          });
        } else {
          pdfBuffer = await generateDocument(generationOptions);
        }
        
        assertLooksLikePdf(pdfBuffer);
        sendBinaryDownload(res, {
          buffer: pdfBuffer,
          filename: `${safeFilename}.pdf`,
          contentType: CONTENT_TYPES.PDF,
        });
      }
    } catch (error: any) {
      console.error('Document generation error:', error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });
}
