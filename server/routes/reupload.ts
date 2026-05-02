import type { Express } from "express";
import { randomUUID } from "crypto";
import path from "path";
import { storage } from "../storage";
import { isAuthenticated } from "../jwtAuth";
import { uploadApplicantBuffer } from "../applicantObjectStorage";
import { upload, applicantUpload } from "./_shared";

export async function registerReuploadRoutes(app: Express) {
  // ============================================
  // DOCUMENT RE-UPLOAD SYSTEM
  // ============================================

  const ALLOWED_DOC_TYPES: Record<string, string> = {
    id: "Government-issued ID",
    paystub: "Pay Stubs",
    w2: "W-2 / Tax Documents",
    employment_letter: "Employment Verification Letter",
    bank: "Bank Statements",
    reference: "Reference Letters",
    rental_history: "Rental History / Landlord Reference",
    pet_doc: "Pet Documentation",
    additional: "Additional Supporting Documents",
    other: "Other Document",
    income: "Proof of Income",
  };

  app.post('/api/admin/people/:personId/reupload-link', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      const { allowed_file_types, expires_in_days = 7 } = req.body;
      if (!Array.isArray(allowed_file_types) || allowed_file_types.length === 0) {
        return res.status(400).json({ message: "allowed_file_types is required and must be a non-empty array" });
      }

      const invalid = allowed_file_types.filter((t: string) => !ALLOWED_DOC_TYPES[t]);
      if (invalid.length > 0) {
        return res.status(400).json({ message: `Invalid file types: ${invalid.join(', ')}` });
      }

      const person = await storage.getRentalSubmissionPerson(req.params.personId);
      if (!person) return res.status(404).json({ message: "Person not found" });

      const submission = await storage.getRentalSubmission(person.submissionId);
      if (!submission) return res.status(404).json({ message: "Submission not found" });
      const link = await storage.getRentalApplicationLink(submission.applicationLinkId);
      if (!link) return res.status(404).json({ message: "Link not found" });
      const unit = await storage.getRentalUnit(link.unitId);
      if (!unit) return res.status(404).json({ message: "Unit not found" });
      const property = await storage.getRentalProperty(unit.propertyId, userId);
      if (!property) return res.status(403).json({ message: "Forbidden" });

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expires_in_days);

      await storage.revokeActiveTokensForPerson(req.params.personId);

      const token = await storage.createDocumentReuploadToken({
        personId: req.params.personId,
        allowedFileTypes: allowed_file_types,
        expiresAt,
        createdByUserId: userId,
      });

      const baseUrl = process.env.REPLIT_DOMAINS
        ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
        : 'https://leaseshieldapp.com';
      const reuploadLink = `${baseUrl}/reupload/${token.id}`;

      if (person.email) {
        const docList = allowed_file_types
          .map((t: string) => ALLOWED_DOC_TYPES[t] || t)
          .join(', ');
        const expiryDate = expiresAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        const firstName = person.firstName || 'there';

        const htmlBody = `
          <div style="font-family: Inter, -apple-system, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
            <p style="margin: 0 0 16px;">Hi ${firstName},</p>
            <p style="margin: 0 0 16px;">We're missing a couple items to finish your application: <strong>${docList}</strong>.</p>
            <p style="margin: 0 0 24px;">Please upload them using the button below:</p>
            <a href="${reuploadLink}" style="display: inline-block; background: #2DD4BF; color: #1a2e40; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600;">Upload Documents</a>
            <p style="margin: 24px 0 0; font-size: 13px; color: #6b7280;">This link expires on ${expiryDate}.</p>
            <p style="margin: 24px 0 0; font-size: 13px; color: #6b7280;">Thanks,<br/>Morgan<br/>LeaseShield</p>
          </div>
        `;
        const textBody = `Hi ${firstName},\n\nWe're missing a couple items to finish your application: ${docList}.\n\nPlease upload them here: ${reuploadLink}\n\nThis link expires on ${expiryDate}.\n\nThanks,\nMorgan\nLeaseShield`;

        try {
          const { Resend } = await import('resend');
          if (process.env.RESEND_API_KEY) {
            const resend = new Resend(process.env.RESEND_API_KEY);
            await resend.emails.send({
              from: 'LeaseShield App <support@leaseshieldapp.com>',
              to: person.email,
              subject: 'Upload the missing documents',
              html: htmlBody,
              text: textBody,
            });
          } else {
            console.log(`[Email] Would send re-upload link to ${person.email}: ${reuploadLink}`);
          }
        } catch (emailErr) {
          console.error("Error sending re-upload email:", emailErr);
        }
      }

      res.json({ ok: true, link: reuploadLink, tokenId: token.id });
    } catch (error) {
      console.error("Error creating re-upload link:", error);
      res.status(500).json({ message: "Failed to create re-upload link" });
    }
  });

  app.get('/api/reupload/:token', async (req, res) => {
    try {
      const token = await storage.getDocumentReuploadToken(req.params.token);
      if (!token) return res.status(404).json({ message: "Link not found" });

      if (token.revokedAt) {
        return res.status(410).json({ message: "This link has been revoked." });
      }
      if (token.usedAt) {
        return res.status(410).json({ message: "All documents have already been uploaded. You're all set." });
      }
      if (new Date() > token.expiresAt) {
        return res.status(410).json({ message: "This link has expired. Please contact your landlord for a new one." });
      }

      const currentFiles = await storage.getCurrentFiles(token.personId);
      const tokenCreatedAt = new Date(token.createdAt);
      const filesAfterToken = currentFiles.filter(f => new Date(f.createdAt) > tokenCreatedAt);
      const uploadedTypesAfterToken = new Set(filesAfterToken.map(f => f.fileType));
      const alreadyUploaded = (token.allowedFileTypes as string[]).filter(t => uploadedTypesAfterToken.has(t));
      const stillNeeded = (token.allowedFileTypes as string[]).filter(t => !uploadedTypesAfterToken.has(t));

      const person = await storage.getRentalSubmissionPerson(token.personId);

      res.json({
        allowed_file_types: (token.allowedFileTypes as string[]).map(t => ({
          type: t,
          label: ALLOWED_DOC_TYPES[t] || t,
          uploaded: alreadyUploaded.includes(t),
        })),
        expires_at: token.expiresAt,
        all_complete: stillNeeded.length === 0,
        first_name: person?.firstName || null,
      });
    } catch (error) {
      console.error("Error fetching re-upload token:", error);
      res.status(500).json({ message: "Failed to load upload page" });
    }
  });

  app.post('/api/reupload/:token/upload', (req: any, res: any, next: any) => {
    applicantUpload.single('file')(req, res, (err: any) => {
      if (err) {
        console.error("Multer upload error (reupload):", err.message);
        const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
        return res.status(status).json({ message: err.message || "File upload failed" });
      }
      next();
    });
  }, async (req: any, res) => {
    try {
      const token = await storage.getDocumentReuploadToken(req.params.token);
      if (!token) return res.status(404).json({ message: "Link not found" });

      if (token.revokedAt) return res.status(410).json({ message: "This link has been revoked." });
      if (token.usedAt) return res.status(410).json({ message: "All documents have already been uploaded." });
      if (new Date() > token.expiresAt) return res.status(410).json({ message: "This link has expired." });

      const { file_type } = req.body;
      if (!file_type) return res.status(400).json({ message: "file_type is required" });

      const allowedTypes = token.allowedFileTypes as string[];
      if (!allowedTypes.includes(file_type)) {
        return res.status(400).json({ message: `File type '${file_type}' is not allowed for this link.` });
      }

      if (!req.file) return res.status(400).json({ message: "No file uploaded" });

      const ext = path.extname(req.file.originalname).toLowerCase() || "";
      const uuid = randomUUID();
      const filename = `${uuid}${ext}`;

      const { dbPath } = await uploadApplicantBuffer(
        req.file.buffer,
        filename,
        req.file.mimetype,
        req.file.originalname
      );

      await storage.supersedeFilesForType(token.personId, file_type);

      const newFile = await storage.createRentalSubmissionFile({
        personId: token.personId,
        fileType: file_type,
        originalName: req.file.originalname,
        storedPath: dbPath,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        availabilityStatus: 'available',
      });

      const currentFiles = await storage.getCurrentFiles(token.personId);
      const tokenCreatedAt = new Date(token.createdAt);
      const filesAfterToken = currentFiles.filter(f => new Date(f.createdAt) > tokenCreatedAt);
      const uploadedTypesAfterToken = new Set(filesAfterToken.map(f => f.fileType));
      const allComplete = allowedTypes.every(t => uploadedTypesAfterToken.has(t));
      if (allComplete) {
        await storage.markDocumentReuploadTokenUsed(token.id);
      }

      res.status(201).json({
        file: newFile,
        all_complete: allComplete,
      });
    } catch (error) {
      console.error("Error uploading via re-upload link:", error);
      res.status(500).json({ message: "Failed to upload file" });
    }
  });

  app.post('/api/admin/reupload-tokens/:tokenId/revoke', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      const token = await storage.getDocumentReuploadToken(req.params.tokenId);
      if (!token) return res.status(404).json({ message: "Token not found" });

      await storage.revokeDocumentReuploadToken(req.params.tokenId);
      res.json({ ok: true });
    } catch (error) {
      console.error("Error revoking re-upload token:", error);
      res.status(500).json({ message: "Failed to revoke token" });
    }
  });

  app.get('/api/admin/people/:personId/reupload-tokens', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      const tokens = await storage.getDocumentReuploadTokensForPerson(req.params.personId);
      res.json(tokens);
    } catch (error) {
      console.error("Error fetching re-upload tokens:", error);
      res.status(500).json({ message: "Failed to fetch tokens" });
    }
  });
}
