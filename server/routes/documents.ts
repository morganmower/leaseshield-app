import type { Express } from "express";
import { z } from "zod";
import path from "path";
import fs from "fs/promises";
import { storage } from "../storage";
import { isAuthenticated, requireAccess } from "../jwtAuth";
import { insertSavedDocumentSchema } from "@shared/schema";
import { upload, getUserId } from "./_shared";

export async function registerDocumentsRoutes(app: Express) {
  // Saved Documents routes
  app.get('/api/saved-documents', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const documents = await storage.getSavedDocumentsByUserId(userId);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching saved documents:", error);
      res.status(500).json({ message: "Failed to fetch saved documents" });
    }
  });

  app.get('/api/saved-documents/:id', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const document = await storage.getSavedDocumentById(req.params.id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      if (document.userId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      res.json(document);
    } catch (error) {
      console.error("Error fetching saved document:", error);
      res.status(500).json({ message: "Failed to fetch saved document" });
    }
  });

  app.post('/api/saved-documents', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Validate input to prevent malicious data
      const validatedData = insertSavedDocumentSchema.parse({
        ...req.body,
        userId,
        propertyId: req.body.propertyId || null,
      });
      
      // Validate propertyId ownership if provided
      if (validatedData.propertyId) {
        const property = await storage.getProperty(validatedData.propertyId, userId);
        if (!property) {
          return res.status(403).json({ message: "Property not found or access denied" });
        }
      }
      
      const savedDocument = await storage.createSavedDocument(validatedData);

      await storage.trackEvent({
        userId,
        eventType: 'document_saved',
        eventData: { templateId: validatedData.templateId, documentName: validatedData.documentName },
      });

      res.json(savedDocument);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input data", errors: error.errors });
      }
      console.error("Error saving document:", error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  app.get('/api/saved-documents/:id/download', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const document = await storage.getSavedDocumentById(req.params.id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      if (document.userId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const template = await storage.getTemplate(document.templateId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      // Get format from query param (default: pdf)
      const format = (req.query.format as string)?.toLowerCase() === 'docx' ? 'docx' : 'pdf';

      // Get landlord info for document header
      const user = await storage.getUser(userId);
      const landlordInfo = user ? {
        businessName: user.businessName,
        phoneNumber: user.phoneNumber,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      } : undefined;

      // Import document generators
      const { generateDocument, generateDocumentDOCX } = await import("../utils/documentGenerator");
      const { generateLeaseAgreementDocx, generateLeaseAgreementPdf } = await import("../utils/leaseAgreementGenerator");

      const generationOptions = {
        templateTitle: template.title,
        templateContent: '',
        fieldValues: document.formData as Record<string, string>,
        stateId: template.stateId,
        version: template.version || 1,
        updatedAt: template.updatedAt || new Date(),
        landlordInfo,
      };

      // Check if this is a lease agreement template
      const isLeaseAgreement = template.title.toLowerCase().includes('lease') || 
                               template.title.toLowerCase().includes('rental agreement');

      if (format === 'docx') {
        let docxBuffer: Buffer;
        
        if (isLeaseAgreement) {
          // Use specialized lease generator for cleaner DOCX output
          docxBuffer = await generateLeaseAgreementDocx({
            templateTitle: template.title,
            stateId: template.stateId,
            fieldValues: document.formData as Record<string, string>,
            version: template.version || 1,
            updatedAt: template.updatedAt || new Date(),
            landlordInfo,
          });
        } else {
          docxBuffer = await generateDocumentDOCX(generationOptions);
        }
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${document.documentName}.docx"`);
        res.send(docxBuffer);
      } else {
        let pdfBuffer: Buffer;
        
        if (isLeaseAgreement) {
          // Use specialized lease generator for consistent PDF/DOCX output
          pdfBuffer = await generateLeaseAgreementPdf({
            templateTitle: template.title,
            stateId: template.stateId,
            fieldValues: document.formData as Record<string, string>,
            version: template.version || 1,
            updatedAt: template.updatedAt || new Date(),
            landlordInfo,
          });
        } else {
          pdfBuffer = await generateDocument(generationOptions);
        }
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${document.documentName}.pdf"`);
        res.send(pdfBuffer);
      }

      await storage.trackEvent({
        userId,
        eventType: 'document_downloaded',
        eventData: { templateId: document.templateId, documentName: document.documentName },
      });
    } catch (error) {
      console.error("Error downloading saved document:", error);
      res.status(500).json({ message: "Failed to download document" });
    }
  });

  app.delete('/api/saved-documents/:id', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const document = await storage.getSavedDocumentById(req.params.id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      if (document.userId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Note: We allow deleting documents even if the associated property no longer exists
      // This prevents orphaned documents from becoming undeletable if the property is deleted first

      await storage.deleteSavedDocument(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting saved document:", error);
      res.status(500).json({ message: "Failed to delete saved document" });
    }
  });

  // Uploaded Documents routes
  // Schema for uploaded document metadata
  const uploadedDocumentMetadataSchema = z.object({
    propertyId: z.string().uuid().optional().nullable(),
    description: z.string().max(500).optional().nullable(),
  });
  
  app.post('/api/uploaded-documents', isAuthenticated, upload.single('file'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Validate metadata to prevent malicious data
      const validatedMetadata = uploadedDocumentMetadataSchema.parse({
        propertyId: req.body.propertyId || null,
        description: req.body.description || null,
      });

      // Validate propertyId ownership if provided
      if (validatedMetadata.propertyId) {
        const property = await storage.getProperty(validatedMetadata.propertyId, userId);
        if (!property) {
          // Clean up uploaded file if property validation fails
          await fs.unlink(req.file.path).catch(err => console.error("Error deleting orphaned file:", err));
          return res.status(403).json({ message: "Property not found or access denied" });
        }
      }

      const uploadedDocument = await storage.createUploadedDocument({
        userId,
        propertyId: validatedMetadata.propertyId,
        fileName: req.file.originalname,
        fileUrl: req.file.path,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        description: validatedMetadata.description,
      });

      await storage.trackEvent({
        userId,
        eventType: 'document_uploaded',
        eventData: { fileName: req.file.originalname, fileSize: req.file.size },
      });

      res.json(uploadedDocument);
    } catch (error) {
      // Clean up uploaded file on error
      if (req.file) {
        await fs.unlink(req.file.path).catch(err => console.error("Error deleting orphaned file:", err));
      }
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input data", errors: error.errors });
      }
      console.error("Error uploading document:", error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  app.get('/api/uploaded-documents', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const documents = await storage.getUploadedDocumentsByUserId(userId);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching uploaded documents:", error);
      res.status(500).json({ message: "Failed to fetch uploaded documents" });
    }
  });

  app.get('/api/uploaded-documents/property/:propertyId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { propertyId } = req.params;

      // Validate property ownership
      const property = await storage.getProperty(propertyId, userId);
      if (!property) {
        return res.status(403).json({ message: "Property not found or access denied" });
      }

      const documents = await storage.getUploadedDocumentsByPropertyId(propertyId, userId);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching property documents:", error);
      res.status(500).json({ message: "Failed to fetch property documents" });
    }
  });

  app.get('/api/uploaded-documents/:id/download', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const document = await storage.getUploadedDocumentById(req.params.id, userId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Check if file exists on disk
      try {
        await fs.access(document.fileUrl);
      } catch {
        return res.status(404).json({ message: "File not found on disk" });
      }

      // Stream file to client with proper headers
      res.setHeader('Content-Type', document.fileType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${document.fileName}"`);
      
      const fileStream = (await import('fs')).createReadStream(document.fileUrl);
      fileStream.pipe(res);

      await storage.trackEvent({
        userId,
        eventType: 'uploaded_document_downloaded',
        eventData: { fileName: document.fileName },
      });
    } catch (error) {
      console.error("Error downloading uploaded document:", error);
      res.status(500).json({ message: "Failed to download document" });
    }
  });

  app.patch('/api/uploaded-documents/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { fileName, propertyId, description } = req.body;
      
      const updates: { fileName?: string; propertyId?: string | null; description?: string | null } = {};
      if (fileName !== undefined) updates.fileName = fileName;
      if (propertyId !== undefined) updates.propertyId = propertyId === "none" || propertyId === "" ? null : propertyId;
      if (description !== undefined) updates.description = description || null;

      const updated = await storage.updateUploadedDocument(req.params.id, userId, updates);
      if (!updated) {
        return res.status(404).json({ message: "Document not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating uploaded document:", error);
      res.status(500).json({ message: "Failed to update document" });
    }
  });

  app.delete('/api/uploaded-documents/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const document = await storage.getUploadedDocumentById(req.params.id, userId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Delete from database
      const deleted = await storage.deleteUploadedDocument(req.params.id, userId);
      if (!deleted) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Delete physical file from disk
      try {
        await fs.unlink(document.fileUrl);
      } catch (err) {
        console.error("Error deleting file from disk:", err);
        // Continue - database record is already deleted
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting uploaded document:", error);
      res.status(500).json({ message: "Failed to delete uploaded document" });
    }
  });
}
