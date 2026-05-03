import type { Express } from "express";
import crypto, { randomUUID } from "crypto";
import path from "path";
import fs from "fs/promises";
import { storage } from "../storage";
import { emailService } from "../emailService";
import { uploadApplicantBuffer, isObjstorePath, deleteApplicantObject } from "../applicantObjectStorage";
import { upload, applicantUpload, shortToken } from "./_shared";

export async function registerApplyRoutes(app: Express) {
  // Get application link data by public token (for applicants)
  app.get('/api/apply/:token', async (req, res) => {
    try {
      const link = await storage.getRentalApplicationLinkByToken(req.params.token);
      
      if (!link) {
        return res.status(404).json({ message: "Application link not found" });
      }
      
      if (!link.isActive) {
        return res.status(410).json({ message: "This application link is no longer active" });
      }
      
      if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
        return res.status(410).json({ message: "This application link has expired" });
      }

      // Get document requirements for this link
      const documentRequirements = await storage.getEffectiveDocumentRequirements(link.id);

      // Get the property state and current field schema via unit -> property chain
      let propertyState: string | null = null;
      let currentFieldSchema: any = (link.mergedSchemaJson as any)?.fieldSchema;
      if (link.unitId) {
        const unit = await storage.getRentalUnit(link.unitId);
        if (unit?.propertyId) {
          const property = await storage.getRentalPropertyById(unit.propertyId);
          propertyState = property?.state || null;
          // Use fresh field schema from property (allows landlord to update settings without creating new links)
          if (unit.fieldSchemaOverrideEnabled && unit.fieldSchemaOverrideJson) {
            currentFieldSchema = unit.fieldSchemaOverrideJson;
          } else if (property?.defaultFieldSchemaJson) {
            currentFieldSchema = property.defaultFieldSchemaJson;
          }
        }
      }

      // Get active compliance rules for this state
      const complianceRules = propertyState 
        ? await storage.getActiveComplianceRulesForState(propertyState)
        : await storage.getActiveComplianceRulesForState('ALL');

      // Build propertyTerms with live rent from unit (authoritative when set)
      const cachedTerms = (link.mergedSchemaJson as any)?.propertyTerms || {};
      let livePropertyTerms = { ...cachedTerms };
      if (link.unitId) {
        const liveUnit = await storage.getRentalUnit(link.unitId);
        if (liveUnit) {
          if (liveUnit.rentAmount != null) {
            livePropertyTerms.monthlyRent = `$${(liveUnit.rentAmount / 100).toLocaleString()}/mo`;
          }
          if ((liveUnit as any).securityDepositAmount != null) {
            livePropertyTerms.securityDeposit = `$${((liveUnit as any).securityDepositAmount / 100).toLocaleString()}`;
          }
          if (liveUnit.unitLabel !== undefined) {
            (link.mergedSchemaJson as any).unitLabel = liveUnit.unitLabel || "";
          }
        }
      }

      // Return only the merged schema (cover page + fields) - no sensitive data
      res.json({
        id: link.id,
        propertyName: (link.mergedSchemaJson as any)?.propertyName || "Property",
        unitLabel: (link.mergedSchemaJson as any)?.unitLabel || "",
        coverPage: (link.mergedSchemaJson as any)?.coverPage,
        fieldSchema: currentFieldSchema,
        propertyTerms: livePropertyTerms,
        documentRequirements,
        propertyState, // For state-specific compliance (e.g., TX tenant selection criteria)
        complianceRules, // Dynamic compliance rules from database
      });
    } catch (error) {
      console.error("Error getting application link:", error);
      res.status(500).json({ message: "Failed to load application" });
    }
  });

  // Get application link data by ID (for invite flows)
  app.get('/api/apply/link/:linkId', async (req, res) => {
    try {
      const link = await storage.getRentalApplicationLink(req.params.linkId);
      
      if (!link) {
        return res.status(404).json({ message: "Application link not found" });
      }
      
      if (!link.isActive) {
        return res.status(410).json({ message: "This application link is no longer active" });
      }
      
      if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
        return res.status(410).json({ message: "This application link has expired" });
      }

      // Get document requirements for this link
      const documentRequirements = await storage.getEffectiveDocumentRequirements(link.id);

      // Get the property state and current field schema via unit -> property chain
      let propertyState: string | null = null;
      let currentFieldSchema: any = (link.mergedSchemaJson as any)?.fieldSchema;
      if (link.unitId) {
        const unit = await storage.getRentalUnit(link.unitId);
        if (unit?.propertyId) {
          const property = await storage.getRentalPropertyById(unit.propertyId);
          propertyState = property?.state || null;
          // Use fresh field schema from property (allows landlord to update settings without creating new links)
          if (unit.fieldSchemaOverrideEnabled && unit.fieldSchemaOverrideJson) {
            currentFieldSchema = unit.fieldSchemaOverrideJson;
          } else if (property?.defaultFieldSchemaJson) {
            currentFieldSchema = property.defaultFieldSchemaJson;
          }
        }
      }

      // Get active compliance rules for this state
      const complianceRules = propertyState 
        ? await storage.getActiveComplianceRulesForState(propertyState)
        : await storage.getActiveComplianceRulesForState('ALL');

      // Build propertyTerms with live rent from unit (authoritative when set)
      const cachedTerms2 = (link.mergedSchemaJson as any)?.propertyTerms || {};
      let livePropertyTerms2 = { ...cachedTerms2 };
      if (link.unitId) {
        const liveUnit = await storage.getRentalUnit(link.unitId);
        if (liveUnit) {
          if (liveUnit.rentAmount != null) {
            livePropertyTerms2.monthlyRent = `$${(liveUnit.rentAmount / 100).toLocaleString()}/mo`;
          }
          if (liveUnit.unitLabel !== undefined) {
            (link.mergedSchemaJson as any).unitLabel = liveUnit.unitLabel || "";
          }
        }
      }

      res.json({
        id: link.id,
        propertyName: (link.mergedSchemaJson as any)?.propertyName || "Property",
        unitLabel: (link.mergedSchemaJson as any)?.unitLabel || "",
        coverPage: (link.mergedSchemaJson as any)?.coverPage,
        fieldSchema: currentFieldSchema,
        propertyTerms: livePropertyTerms2,
        documentRequirements,
        propertyState,
        complianceRules,
      });
    } catch (error) {
      console.error("Error getting application link by ID:", error);
      res.status(500).json({ message: "Failed to load application" });
    }
  });

  // Start a new rental submission
  app.post('/api/apply/:token/start', async (req, res) => {
    try {
      const link = await storage.getRentalApplicationLinkByToken(req.params.token);
      
      if (!link || !link.isActive) {
        return res.status(404).json({ message: "Application link not found or inactive" });
      }
      
      if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
        return res.status(410).json({ message: "This application link has expired" });
      }

      const { email, firstName, lastName, personType, propertyTermsAcknowledgedAt } = req.body;
      
      if (!email || !firstName || !lastName) {
        return res.status(400).json({ message: "Email, first name, and last name are required" });
      }

      // Create submission
      const submission = await storage.createRentalSubmission({
        applicationLinkId: link.id,
        status: "started",
      });

      // Create primary applicant person
      const person = await storage.createRentalSubmissionPerson({
        submissionId: submission.id,
        role: "applicant",
        email,
        firstName,
        lastName,
        formJson: {},
        inviteToken: shortToken(),
        propertyTermsAcknowledgedAt: propertyTermsAcknowledgedAt ? new Date(propertyTermsAcknowledgedAt) : null,
      });

      // Log event
      await storage.logRentalApplicationEvent({
        submissionId: submission.id,
        eventType: "submission_started",
        metadataJson: { personId: person.id, email, firstName, lastName },
      });

      res.status(201).json({
        submissionId: submission.id,
        personId: person.id,
        personToken: person.inviteToken,
      });
    } catch (error) {
      console.error("Error starting application:", error);
      res.status(500).json({ message: "Failed to start application" });
    }
  });

  // Save form progress (autosave)
  app.patch('/api/apply/person/:personToken', async (req, res) => {
    try {
      const person = await storage.getRentalSubmissionPersonByToken(req.params.personToken);
      
      if (!person) {
        return res.status(404).json({ message: "Application not found" });
      }

      const { formData } = req.body;

      await storage.updateRentalSubmissionPerson(person.id, {
        formJson: formData,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error saving form progress:", error);
      res.status(500).json({ message: "Failed to save progress" });
    }
  });

  // Get person's form data (for resuming)
  app.get('/api/apply/person/:personToken', async (req, res) => {
    try {
      const person = await storage.getRentalSubmissionPersonByToken(req.params.personToken);
      
      if (!person) {
        return res.status(404).json({ message: "Application not found" });
      }

      // Get submission to check status
      const submission = await storage.getRentalSubmission(person.submissionId);

      res.json({
        personId: person.id,
        personType: person.role,
        email: person.email,
        firstName: person.firstName,
        lastName: person.lastName,
        formData: person.formJson,
        submissionStatus: submission?.status || "started",
        isCompleted: person.isCompleted, // Person's individual completion status
        applicationLinkId: submission?.applicationLinkId || null, // For invite flows to fetch link data
      });
    } catch (error) {
      console.error("Error getting person data:", error);
      res.status(500).json({ message: "Failed to load application data" });
    }
  });

  // Submit completed application
  app.post('/api/apply/person/:personToken/submit', async (req, res) => {
    try {
      const person = await storage.getRentalSubmissionPersonByToken(req.params.personToken);
      
      if (!person) {
        return res.status(404).json({ message: "Application not found" });
      }

      // Capture screening disclosure acknowledgment audit data
      const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 
                        req.socket.remoteAddress || 
                        'unknown';
      const userAgent = req.body.userAgent || req.headers['user-agent'] || 'unknown';
      const disclosureVersion = 'v1.0-2024-12-18'; // Immutable version identifier for this disclosure text

      // Extract compliance acknowledgment data from form
      const formData = req.body.formData || person.formJson || {};
      
      // Handle dynamic compliance rules - extract all compliance_* fields
      // Also support legacy field names for backwards compatibility
      const txSelectionAcknowledged = formData.compliance_tx_tenant_selection === true || formData.txSelectionAcknowledged === true;
      const fcraAuthorized = formData.compliance_fcra_authorization === true || formData.fcraAuthorized === true;
      
      // Collect all compliance acknowledgments for audit trail
      const complianceAcknowledgments: Record<string, { acknowledged: boolean; timestamp: string; ip: string }> = {};
      for (const [key, value] of Object.entries(formData)) {
        if (key.startsWith('compliance_') && value === true) {
          const ruleKey = key.replace('compliance_', '');
          complianceAcknowledgments[ruleKey] = {
            acknowledged: true,
            timestamp: new Date().toISOString(),
            ip: ipAddress,
          };
        }
      }
      
      // Store compliance acknowledgments in formData for audit trail
      const enrichedFormData = {
        ...formData,
        _complianceAuditTrail: complianceAcknowledgments,
        _submissionMetadata: {
          ipAddress,
          userAgent,
          timestamp: new Date().toISOString(),
        },
      };

      // Update person as completed with screening disclosure and compliance metadata
      await storage.updateRentalSubmissionPerson(person.id, {
        formJson: enrichedFormData,
        isCompleted: true,
        completedAt: new Date(),
        screeningDisclosureAcknowledgedAt: new Date(),
        screeningDisclosureIpAddress: ipAddress,
        screeningDisclosureUserAgent: userAgent,
        screeningDisclosureVersion: disclosureVersion,
        // TX-specific tenant selection criteria acknowledgment
        txSelectionAcknowledged: txSelectionAcknowledged,
        txSelectionAckTimestamp: txSelectionAcknowledged ? new Date() : null,
        txSelectionAckIp: txSelectionAcknowledged ? ipAddress : null,
        // FCRA authorization (all states)
        fcraAuthorized: fcraAuthorized,
        fcraAuthorizedTimestamp: fcraAuthorized ? new Date() : null,
      });

      // Check if all people have completed
      const allPeople = await storage.getRentalSubmissionPeople(person.submissionId);
      const allCompleted = allPeople.every(p => 
        p.id === person.id || p.isCompleted
      );

      // Update submission status
      await storage.updateRentalSubmission(person.submissionId, {
        status: allCompleted ? "submitted" : "started",
        submittedAt: allCompleted ? new Date() : null,
      });

      // Log event
      await storage.logRentalApplicationEvent({
        submissionId: person.submissionId,
        eventType: "application_submitted",
        metadataJson: { personId: person.id },
      });

      // Auto-screening: If all completed and property has autoScreening enabled, trigger screening
      if (allCompleted) {
        try {
          const submission = await storage.getRentalSubmission(person.submissionId);
          if (submission) {
            const link = await storage.getRentalApplicationLink(submission.applicationLinkId);
            if (link) {
              const unit = await storage.getRentalUnit(link.unitId);
              if (unit) {
                const property = await storage.getRentalPropertyById(unit.propertyId);
                if (property && (property as any).autoScreening) {
                  // Auto-request screening for primary applicant (mirror manual screening flow)
                  // Note: AppScreen sends an invitation email - applicant enters SSN directly on Western Verify portal
                  const primaryApplicant = allPeople.find(p => p.role === 'applicant') || person;
                  const formData = (primaryApplicant.formJson as Record<string, any>) || {};
                  
                  // Check if screening already exists for this person (per-person model)
                  const existingOrder = await storage.getRentalScreeningOrderByPerson(primaryApplicant.id);
                  
                  // Only need name and email for AppScreen invitation flow
                  const hasRequiredData = primaryApplicant.firstName && 
                                         primaryApplicant.lastName && 
                                         primaryApplicant.email;
                  
                  if (!existingOrder && hasRequiredData) {
                    // Import DigitalDelve service and crypto
                    const { processScreeningRequest } = await import("../digitalDelveService");
                    const { decryptCredentials } = await import("../crypto");
                    
                    // Construct base URL for webhook callbacks - use stable production domain
                    const baseUrl = process.env.REPLIT_DOMAINS 
                      ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
                      : `${req.headers['x-forwarded-proto'] || req.protocol || 'https'}://${req.headers['x-forwarded-host'] || req.headers.host}`;
                    
                    // Resolve landlord's screening credentials if configured
                    let screeningCredentials: { username: string; password: string; invitationId?: string } | undefined;
                    const landlordCreds = await storage.getLandlordScreeningCredentials(property.userId);
                    if (landlordCreds && landlordCreds.status === 'verified') {
                      try {
                        const decrypted = decryptCredentials({
                          encryptedUsername: landlordCreds.encryptedUsername,
                          encryptedPassword: landlordCreds.encryptedPassword,
                          encryptionIv: landlordCreds.encryptionIv,
                        });
                        // Resolve per-property invitation ID override (same chain as manual screening)
                        const perPropertyId = (property as any).screeningInvitationId as string | null | undefined;
                        let resolvedInvitationId = landlordCreds.defaultInvitationId || undefined;
                        if (perPropertyId) {
                          resolvedInvitationId = perPropertyId;
                          console.log(`[Screening] Auto-screen: using per-property invitation ID for submission ${person.submissionId}`);
                        }
                        screeningCredentials = {
                          username: decrypted.username,
                          password: decrypted.password,
                          invitationId: resolvedInvitationId,
                        };
                      } catch (e) {
                        console.error("Failed to decrypt landlord credentials, falling back to system credentials");
                      }
                    }
                    
                    // Build applicant data - SSN/DOB collected by Western Verify portal directly
                    // Pass all available fields for consistency with manual flow
                    const result = await processScreeningRequest(
                      person.submissionId,
                      {
                        firstName: primaryApplicant.firstName || "",
                        lastName: primaryApplicant.lastName || "",
                        email: primaryApplicant.email || "",
                        phone: primaryApplicant.phone || formData.phone,
                        ssn: formData.ssn,
                        dob: formData.dob,
                        address: formData.currentAddress,
                        city: formData.currentCity,
                        state: formData.currentState,
                        zip: formData.currentZip,
                      },
                      baseUrl,
                      undefined,
                      screeningCredentials,
                      primaryApplicant.id
                    );
                    
                    if (result.success) {
                      await storage.updateRentalSubmission(person.submissionId, { status: 'screening_requested' });
                      await storage.logRentalApplicationEvent({
                        submissionId: person.submissionId,
                        eventType: 'screening_requested',
                        metadataJson: { autoScreening: true, personId: primaryApplicant.id },
                      });
                    } else {
                      console.error(`Auto-screening failed for submission ${person.submissionId}:`, result.error);
                    }
                  } else if (!existingOrder && !hasRequiredData) {
                    // Log that auto-screening was skipped due to missing required data
                    console.log(`Auto-screening skipped for submission ${person.submissionId}: missing name or email`);
                    await storage.logRentalApplicationEvent({
                      submissionId: person.submissionId,
                      eventType: 'auto_screening_skipped',
                      metadataJson: { reason: 'Missing applicant name or email' },
                    });
                  }
                }
              }
            }
          }
        } catch (screeningError) {
          // Log but don't fail the submission if auto-screening fails
          console.error("Auto-screening error (non-fatal):", screeningError);
        }
      }

      res.json({ success: true, status: allCompleted ? "submitted" : "in_progress" });
    } catch (error) {
      console.error("Error submitting application:", error);
      res.status(500).json({ message: "Failed to submit application" });
    }
  });

  // Invite co-applicant or guarantor
  app.post('/api/apply/:personToken/invite', async (req, res) => {
    try {
      const inviter = await storage.getRentalSubmissionPersonByToken(req.params.personToken);
      
      if (!inviter) {
        return res.status(404).json({ message: "Application not found" });
      }

      const { email, firstName, lastName, personType } = req.body;
      
      if (!email || !firstName || !lastName || !personType) {
        return res.status(400).json({ message: "Email, name, and person type are required" });
      }

      // Map frontend personType to schema role enum values
      const roleMap: Record<string, 'applicant' | 'coapplicant' | 'guarantor'> = {
        'co_applicant': 'coapplicant',
        'guarantor': 'guarantor',
      };

      if (!roleMap[personType]) {
        return res.status(400).json({ message: "Person type must be co_applicant or guarantor" });
      }

      // Check for duplicate email - screening requires unique emails
      const existingPeople = await storage.getRentalSubmissionPeople(inviter.submissionId);
      const emailLower = email.toLowerCase().trim();
      const duplicateEmail = existingPeople.find(p => p.email?.toLowerCase().trim() === emailLower);
      
      if (duplicateEmail) {
        return res.status(400).json({ 
          message: "This email address is already used by another person on this application. Each person must have a unique email for screening to work properly." 
        });
      }

      const inviteToken = shortToken();

      const person = await storage.createRentalSubmissionPerson({
        submissionId: inviter.submissionId,
        role: roleMap[personType],
        email,
        firstName,
        lastName,
        formJson: {},
        inviteToken,
      });

      // Log event
      await storage.logRentalApplicationEvent({
        submissionId: inviter.submissionId,
        eventType: "person_invited",
        metadataJson: { invitedPersonId: person.id, role: roleMap[personType], email },
      });

      const inviteUrl = `/apply/join/${inviteToken}`;

      // Get property name and landlord info for the email
      let propertyName = "the property";
      let landlordEmailInfo: { businessName?: string; phoneNumber?: string } | undefined;
      try {
        const submission = await storage.getRentalSubmission(inviter.submissionId);
        if (submission) {
          const link = await storage.getRentalApplicationLink(submission.applicationLinkId);
          if (link?.unitId) {
            const unit = await storage.getRentalUnit(link.unitId);
            if (unit?.propertyId) {
              const property = await storage.getRentalPropertyById(unit.propertyId);
              if (property) {
                propertyName = property.name + (unit.unitLabel ? ` - ${unit.unitLabel}` : '');
                // Get landlord info
                const landlord = await storage.getUser(property.userId);
                if (landlord) {
                  landlordEmailInfo = {
                    businessName: landlord.businessName || undefined,
                    phoneNumber: landlord.phoneNumber || undefined,
                  };
                }
              }
            }
          }
        }
      } catch (err) {
        console.error("Error getting property name for invite email:", err);
      }

      // Send invite email to co-applicant
      try {
        await emailService.sendCoApplicantInviteEmail(
          { email, firstName, lastName },
          { firstName: inviter.firstName || 'Applicant', lastName: inviter.lastName || '' },
          propertyName,
          inviteUrl,
          roleMap[personType] as 'coapplicant' | 'guarantor',
          landlordEmailInfo
        );
        console.log(`✅ Co-applicant invite email sent to ${email}`);
      } catch (emailError) {
        console.error("Error sending invite email (non-fatal):", emailError);
      }

      res.status(201).json({
        personId: person.id,
        inviteToken,
        inviteUrl,
      });
    } catch (error) {
      console.error("Error inviting person:", error);
      res.status(500).json({ message: "Failed to send invite" });
    }
  });

  // Applicant document upload endpoint
  app.post('/api/apply/person/:personToken/upload', (req, res, next) => {
    applicantUpload.single('file')(req, res, (err: any) => {
      if (err) {
        console.error("Multer upload error:", err.message);
        const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
        return res.status(status).json({ message: err.message || "File upload failed" });
      }
      next();
    });
  }, async (req, res) => {
    try {
      const person = await storage.getRentalSubmissionPersonByToken(req.params.personToken);
      
      if (!person) {
        return res.status(404).json({ message: "Application not found" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const { fileType } = req.body;
      if (!fileType) {
        return res.status(400).json({ message: "File type is required" });
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

      const fileRecord = await storage.createRentalSubmissionFile({
        personId: person.id,
        fileType,
        originalName: req.file.originalname,
        storedPath: dbPath,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        availabilityStatus: 'available',
      });

      res.status(201).json({
        id: fileRecord.id,
        fileType: fileRecord.fileType,
        originalName: fileRecord.originalName,
        fileSize: fileRecord.fileSize,
      });
    } catch (error) {
      console.error("Error uploading file:", error);
      res.status(500).json({ message: "Failed to upload file" });
    }
  });

  // Get applicant's uploaded files
  app.get('/api/apply/person/:personToken/files', async (req, res) => {
    try {
      const person = await storage.getRentalSubmissionPersonByToken(req.params.personToken);
      
      if (!person) {
        return res.status(404).json({ message: "Application not found" });
      }

      const files = await storage.getRentalSubmissionFiles(person.id);
      res.json(files.map(f => ({
        id: f.id,
        fileType: f.fileType,
        originalName: f.originalName,
        fileSize: f.fileSize,
        availabilityStatus: f.availabilityStatus,
        createdAt: f.createdAt,
      })));
    } catch (error) {
      console.error("Error getting files:", error);
      res.status(500).json({ message: "Failed to load files" });
    }
  });

  // Delete applicant's uploaded file
  app.delete('/api/apply/person/:personToken/files/:fileId', async (req, res) => {
    try {
      const person = await storage.getRentalSubmissionPersonByToken(req.params.personToken);
      
      if (!person) {
        return res.status(404).json({ message: "Application not found" });
      }

      const file = await storage.getRentalSubmissionFile(req.params.fileId);
      if (!file || file.personId !== person.id) {
        return res.status(404).json({ message: "File not found" });
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
      console.error("Error deleting file:", error);
      res.status(500).json({ message: "Failed to delete file" });
    }
  });
}
