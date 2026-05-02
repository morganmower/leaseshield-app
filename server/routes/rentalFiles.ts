import type { Express } from "express";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import { storage } from "../storage";
import { isAuthenticated } from "../jwtAuth";
import { rentalSubmissionFiles } from "@shared/schema";
import { db } from "../db";
import { uploadApplicantBuffer, downloadApplicantStream, isObjstorePath, deleteApplicantObject } from "../applicantObjectStorage";
import { upload, applicantUpload } from "./_shared";

export async function registerRentalFilesRoutes(app: Express) {
  // Landlord: Get all files for a submission
  app.get('/api/rental/submissions/:submissionId/files', isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const submission = await storage.getRentalSubmission(req.params.submissionId);
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      // Verify landlord owns the property via application link -> unit -> property
      const link = await storage.getRentalApplicationLink(submission.applicationLinkId);
      if (!link) {
        return res.status(404).json({ message: "Link not found" });
      }
      
      const unit = await storage.getRentalUnit(link.unitId);
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }
      
      const property = await storage.getRentalProperty(unit.propertyId, userId);
      if (!property) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Get all people in the submission
      const people = await storage.getRentalSubmissionPeople(req.params.submissionId);
      
      // Get files for each person
      const filesByPerson: Record<string, any[]> = {};
      for (const person of people) {
        const files = await storage.getRentalSubmissionFiles(person.id);
        filesByPerson[person.id] = files.map(f => ({
          id: f.id,
          fileType: f.fileType,
          originalName: f.originalName,
          fileSize: f.fileSize,
          availabilityStatus: f.availabilityStatus,
          createdAt: f.createdAt,
        }));
      }

      res.json(filesByPerson);
    } catch (error) {
      console.error("Error getting submission files:", error);
      res.status(500).json({ message: "Failed to load files" });
    }
  });

  // Landlord: Download a file
  app.get('/api/rental/submissions/:submissionId/files/:fileId/download', isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const submission = await storage.getRentalSubmission(req.params.submissionId);
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      // Verify landlord owns the property via link -> unit -> property
      const link = await storage.getRentalApplicationLink(submission.applicationLinkId);
      if (!link) {
        return res.status(404).json({ message: "Link not found" });
      }
      
      const unit = await storage.getRentalUnit(link.unitId);
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }
      
      const property = await storage.getRentalProperty(unit.propertyId, userId);
      if (!property) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const file = await storage.getRentalSubmissionFile(req.params.fileId);
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }

      // Verify the file belongs to this submission
      const people = await storage.getRentalSubmissionPeople(req.params.submissionId);
      const personIds = people.map((p: { id: string }) => p.id);
      if (!personIds.includes(file.personId)) {
        return res.status(403).json({ message: "File not part of this submission" });
      }

      if (file.availabilityStatus === 'missing') {
        return res.status(404).json({ message: "File unavailable (lost during a workspace reset before cloud migration)" });
      }

      if (isObjstorePath(file.storedPath)) {
        const stream = await downloadApplicantStream(file.storedPath);
        if (!stream) {
          await db.update(rentalSubmissionFiles)
            .set({ availabilityStatus: 'missing' })
            .where(eq(rentalSubmissionFiles.id, file.id));
          return res.status(404).json({ message: "File unavailable (missing from storage)" });
        }
        res.setHeader("Content-Type", file.mimeType || "application/octet-stream");
        res.setHeader("Content-Disposition", `inline; filename="${file.originalName}"`);
        stream.pipe(res);
      } else if (file.storedPath.startsWith("uploads/")) {
        const localPath = path.join(process.cwd(), file.storedPath);
        if (!fsSync.existsSync(localPath)) {
          await db.update(rentalSubmissionFiles)
            .set({ availabilityStatus: 'missing' })
            .where(eq(rentalSubmissionFiles.id, file.id));
          return res.status(404).json({ message: "File unavailable (legacy local file missing)" });
        }
        res.download(localPath, file.originalName);
      } else {
        return res.status(400).json({ message: "Unrecognized file path format" });
      }
    } catch (error) {
      console.error("Error downloading file:", error);
      res.status(500).json({ message: "Failed to download file" });
    }
  });

  // Landlord: Upload a file to a submission (manual document upload)
  app.post('/api/rental/submissions/:submissionId/files', isAuthenticated, (req: any, res: any, next: any) => {
    applicantUpload.single('file')(req, res, (err: any) => {
      if (err) {
        console.error("Multer upload error (admin):", err.message);
        const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
        return res.status(status).json({ message: err.message || "File upload failed" });
      }
      next();
    });
  }, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const { personId, fileType } = req.body;
      if (!personId || !fileType) {
        return res.status(400).json({ message: "personId and fileType are required" });
      }

      const submission = await storage.getRentalSubmission(req.params.submissionId);
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      // Verify landlord owns the property via link -> unit -> property
      const link = await storage.getRentalApplicationLink(submission.applicationLinkId);
      if (!link) {
        return res.status(404).json({ message: "Link not found" });
      }
      
      const unit = await storage.getRentalUnit(link.unitId);
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }
      
      const property = await storage.getRentalProperty(unit.propertyId, userId);
      if (!property) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Verify the person belongs to this submission
      const people = await storage.getRentalSubmissionPeople(req.params.submissionId);
      const person = people.find((p: { id: string }) => p.id === personId);
      if (!person) {
        return res.status(400).json({ message: "Person not found in this submission" });
      }

      const ext = path.extname(req.file.originalname).toLowerCase() || "";
      const uuid = randomUUID();
      const filename = `${uuid}${ext}`;

      const { dbPath } = await uploadApplicantBuffer(
        req.file.buffer,
        filename,
        req.file.mimetype,
        req.file.originalname
      );

      const newFile = await storage.createRentalSubmissionFile({
        personId,
        fileType,
        originalName: req.file.originalname,
        storedPath: dbPath,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        availabilityStatus: 'available',
      });

      res.status(201).json(newFile);
    } catch (error) {
      console.error("Error uploading landlord file:", error);
      res.status(500).json({ message: "Failed to upload file" });
    }
  });

  // Landlord: Delete a file from a submission
  app.delete('/api/rental/submissions/:submissionId/files/:fileId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const submission = await storage.getRentalSubmission(req.params.submissionId);
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      // Verify landlord owns the property via link -> unit -> property
      const link = await storage.getRentalApplicationLink(submission.applicationLinkId);
      if (!link) {
        return res.status(404).json({ message: "Link not found" });
      }
      
      const unit = await storage.getRentalUnit(link.unitId);
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }
      
      const property = await storage.getRentalProperty(unit.propertyId, userId);
      if (!property) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const file = await storage.getRentalSubmissionFile(req.params.fileId);
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }

      // Verify the file belongs to this submission
      const people = await storage.getRentalSubmissionPeople(req.params.submissionId);
      const personIds = people.map((p: { id: string }) => p.id);
      if (!personIds.includes(file.personId)) {
        return res.status(403).json({ message: "File not part of this submission" });
      }

      if (isObjstorePath(file.storedPath)) {
        await deleteApplicantObject(file.storedPath);
      } else {
        try {
          await fs.unlink(file.storedPath);
        } catch (e) {
          console.error("Error deleting file from disk:", e);
        }
      }

      await storage.deleteRentalSubmissionFile(req.params.fileId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting landlord file:", error);
      res.status(500).json({ message: "Failed to delete file" });
    }
  });
}
