import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated, requireAccess } from "../jwtAuth";
import { emailService } from "../emailService";
import { getUserId } from "./_shared";

export async function registerRentalSubmissionsRoutes(app: Express) {
  // Get count of pending (submitted) applications for landlord
  app.get('/api/rental/submissions/pending-count', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const count = await storage.getPendingSubmissionsCount(userId);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching pending count:", error);
      res.status(500).json({ message: "Failed to fetch pending count" });
    }
  });

  // List all submissions for landlord's properties
  app.get('/api/rental/submissions', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const includeArchived = req.query.includeArchived === 'true';
      const submissions = await storage.getRentalSubmissionsByUserId(userId, false, includeArchived);
      
      // Enrich with property/unit info and people
      const enriched = await Promise.all(submissions.map(async (sub) => {
        const people = await storage.getRentalSubmissionPeople(sub.id);
        const appLink = sub.applicationLinkId ? await storage.getRentalApplicationLink(sub.applicationLinkId) : null;
        let propertyName = "Unknown";
        let unitLabel = "";
        if (appLink) {
          const unit = await storage.getRentalUnit(appLink.unitId);
          if (unit) {
            const property = await storage.getRentalProperty(unit.propertyId, userId);
            if (property) {
              propertyName = property.name;
              unitLabel = unit.unitLabel;
            }
          }
        }
        const primaryApplicant = people.find(p => p.role === 'applicant');
        const decision = await storage.getRentalDecision(sub.id);
        
        // Get screening status aggregation with normalization for vendor variants
        const screeningOrders = await storage.getRentalScreeningOrdersBySubmission(sub.id);
        let screeningStatus: 'not_sent' | 'pending' | 'complete' = 'not_sent';
        if (screeningOrders.length > 0) {
          // Normalize status to handle any vendor variants
          const normalizedStatuses = screeningOrders.map(o => {
            const s = (o.status || '').toLowerCase().replace(/[_\s-]/g, '');
            if (s === 'complete' || s === 'completed') return 'complete';
            if (s === 'sent' || s === 'inprogress' || s === 'pending') return 'pending';
            return s;
          });
          const allComplete = normalizedStatuses.every(s => s === 'complete');
          const anyPending = normalizedStatuses.some(s => s === 'pending');
          if (allComplete) {
            screeningStatus = 'complete';
          } else if (anyPending || normalizedStatuses.some(s => s === 'complete')) {
            screeningStatus = 'pending';
          }
        }
        
        return {
          ...sub,
          propertyName,
          unitLabel,
          primaryApplicant: primaryApplicant ? {
            firstName: primaryApplicant.firstName,
            lastName: primaryApplicant.lastName,
            email: primaryApplicant.email,
          } : null,
          peopleCount: people.length,
          decision: decision ? { decision: decision.decision, decidedAt: decision.decidedAt } : null,
          screeningStatus,
          archivedAt: sub.archivedAt,
        };
      }));
      
      res.json(enriched);
    } catch (error) {
      console.error("Error fetching submissions:", error);
      res.status(500).json({ message: "Failed to fetch submissions" });
    }
  });

  // Get specific submission with all people
  app.get('/api/rental/submissions/:id', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const submission = await storage.getRentalSubmission(req.params.id);
      
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      // Verify ownership
      const appLink = submission.applicationLinkId ? await storage.getRentalApplicationLink(submission.applicationLinkId) : null;
      if (!appLink) {
        return res.status(404).json({ message: "Application link not found" });
      }
      const unit = await storage.getRentalUnit(appLink.unitId);
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }
      const property = await storage.getRentalProperty(unit.propertyId, userId);
      if (!property) {
        return res.status(403).json({ message: "Access denied" });
      }

      const people = await storage.getRentalSubmissionPeople(submission.id);
      const events = await storage.getRentalApplicationEvents(submission.id);

      res.json({
        ...submission,
        propertyName: property.name,
        unitLabel: unit.unitLabel,
        people,
        events,
      });
    } catch (error) {
      console.error("Error fetching submission:", error);
      res.status(500).json({ message: "Failed to fetch submission" });
    }
  });

  // Update submission status (approve/deny/etc)
  app.patch('/api/rental/submissions/:id', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const submission = await storage.getRentalSubmission(req.params.id);
      
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      // Verify ownership
      const appLink = submission.applicationLinkId ? await storage.getRentalApplicationLink(submission.applicationLinkId) : null;
      if (!appLink) {
        return res.status(404).json({ message: "Application link not found" });
      }
      const unit = await storage.getRentalUnit(appLink.unitId);
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }
      const property = await storage.getRentalProperty(unit.propertyId, userId);
      if (!property) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { status, landlordNotes, screeningTier } = req.body;
      const updates: any = {};
      if (status) updates.status = status;
      if (landlordNotes !== undefined) updates.landlordNotes = landlordNotes;
      if (screeningTier) updates.screeningTier = screeningTier;

      const updated = await storage.updateRentalSubmission(req.params.id, updates);

      // Log the status change event
      if (status) {
        await storage.logRentalApplicationEvent({
          submissionId: submission.id,
          eventType: `status_changed_to_${status}`,
          metadataJson: { previousStatus: submission.status, newStatus: status, changedBy: userId },
        });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating submission:", error);
      res.status(500).json({ message: "Failed to update submission" });
    }
  });

  // Soft delete a submission
  app.delete('/api/rental/submissions/:id', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const submission = await storage.getRentalSubmission(req.params.id);
      
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      // Verify ownership
      const appLink = submission.applicationLinkId ? await storage.getRentalApplicationLink(submission.applicationLinkId) : null;
      if (!appLink) {
        return res.status(404).json({ message: "Application link not found" });
      }
      const unit = await storage.getRentalUnit(appLink.unitId);
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }
      const property = await storage.getRentalProperty(unit.propertyId, userId);
      if (!property) {
        return res.status(403).json({ message: "Access denied" });
      }

      const deleted = await storage.softDeleteRentalSubmission(req.params.id);
      
      if (deleted) {
        // Log the deletion event
        await storage.logRentalApplicationEvent({
          submissionId: submission.id,
          eventType: 'submission_deleted',
          metadataJson: { deletedBy: userId, deletedAt: new Date().toISOString() },
        });
      }

      res.json({ success: deleted });
    } catch (error) {
      console.error("Error deleting submission:", error);
      res.status(500).json({ message: "Failed to delete submission" });
    }
  });

  app.post('/api/rental/submissions/:id/archive', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const submission = await storage.getRentalSubmission(req.params.id);
      if (!submission) return res.status(404).json({ message: "Submission not found" });

      const appLink = submission.applicationLinkId ? await storage.getRentalApplicationLink(submission.applicationLinkId) : null;
      if (!appLink) return res.status(404).json({ message: "Application link not found" });
      const unit = await storage.getRentalUnit(appLink.unitId);
      if (!unit) return res.status(404).json({ message: "Unit not found" });
      const property = await storage.getRentalProperty(unit.propertyId, userId);
      if (!property) return res.status(403).json({ message: "Access denied" });

      const updated = await storage.archiveRentalSubmission(req.params.id);
      res.json(updated);
    } catch (error) {
      console.error("Error archiving submission:", error);
      res.status(500).json({ message: "Failed to archive submission" });
    }
  });

  app.post('/api/rental/submissions/:id/unarchive', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const submission = await storage.getRentalSubmission(req.params.id);
      if (!submission) return res.status(404).json({ message: "Submission not found" });

      const appLink = submission.applicationLinkId ? await storage.getRentalApplicationLink(submission.applicationLinkId) : null;
      if (!appLink) return res.status(404).json({ message: "Application link not found" });
      const unit = await storage.getRentalUnit(appLink.unitId);
      if (!unit) return res.status(404).json({ message: "Unit not found" });
      const property = await storage.getRentalProperty(unit.propertyId, userId);
      if (!property) return res.status(403).json({ message: "Access denied" });

      const updated = await storage.unarchiveRentalSubmission(req.params.id);
      res.json(updated);
    } catch (error) {
      console.error("Error unarchiving submission:", error);
      res.status(500).json({ message: "Failed to unarchive submission" });
    }
  });

  // Create a decision (approve/deny) for a submission
  app.post('/api/rental/submissions/:id/decision', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const submission = await storage.getRentalSubmission(req.params.id);
      
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      // Verify ownership
      const appLink = submission.applicationLinkId ? await storage.getRentalApplicationLink(submission.applicationLinkId) : null;
      if (!appLink) {
        return res.status(404).json({ message: "Application link not found" });
      }
      const unit = await storage.getRentalUnit(appLink.unitId);
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }
      const property = await storage.getRentalProperty(unit.propertyId, userId);
      if (!property) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Check if a decision already exists
      const existingDecision = await storage.getRentalDecision(submission.id);
      if (existingDecision) {
        return res.status(400).json({ message: "A decision has already been made for this application" });
      }

      const { decision, notes, denialReasons, skipNotification } = req.body;
      if (!decision || !['approved', 'denied'].includes(decision)) {
        return res.status(400).json({ message: "Decision must be 'approved' or 'denied'" });
      }

      const newDecision = await storage.createRentalDecision({
        submissionId: submission.id,
        decision,
        decidedAt: new Date(),
        decidedByUserId: userId,
        notes: notes || null,
      });

      // If denied, store the denial reasons
      let reasons: any[] = [];
      if (decision === 'denied' && denialReasons && Array.isArray(denialReasons) && denialReasons.length > 0) {
        const reasonsToInsert = denialReasons.map((r: { category: string; detail?: string }) => ({
          decisionId: newDecision.id,
          category: r.category as any,
          detail: r.detail || null,
        }));
        reasons = await storage.createRentalDenialReasons(reasonsToInsert);
      }

      // Log the decision event (skipNotification indicates landlord will send their own adverse action notice)
      await storage.logRentalApplicationEvent({
        submissionId: submission.id,
        eventType: `decision_${decision}`,
        metadataJson: { 
          decisionId: newDecision.id, 
          decidedBy: userId, 
          notes, 
          denialReasons: reasons.map(r => r.category),
          skipNotification: skipNotification || false,
        },
      });

      // Send notification email to applicant if not skipped
      if (!skipNotification) {
        try {
          // Get the primary applicant for the submission
          const people = await storage.getRentalSubmissionPeople(submission.id);
          const primaryApplicant = people.find(p => p.role === 'applicant');
          
          if (primaryApplicant && primaryApplicant.email) {
            // Build property address
            let propertyAddress = 'the rental property';
            if (unit && property) {
              propertyAddress = unit.unitLabel 
                ? `${property.name} - Unit ${unit.unitLabel}`
                : property.name;
            }
            
            // Get landlord name
            const landlord = await storage.getUser(userId);
            const landlordInfo = landlord ? {
              name: landlord.firstName && landlord.lastName 
                ? `${landlord.firstName} ${landlord.lastName}`
                : undefined,
              businessName: landlord.businessName || undefined,
              phoneNumber: landlord.phoneNumber || undefined,
            } : undefined;
            
            await emailService.sendApplicationDecisionEmail(
              { 
                email: primaryApplicant.email, 
                firstName: primaryApplicant.firstName || undefined, 
                lastName: primaryApplicant.lastName || undefined 
              },
              decision as 'approved' | 'denied',
              propertyAddress,
              landlordInfo
            );
            console.log(`✅ Decision notification sent to ${primaryApplicant.email}`);
          }
        } catch (emailError) {
          console.error("Error sending decision notification email:", emailError);
          // Don't fail the request if email fails
        }
      }

      res.status(201).json({ ...newDecision, denialReasons: reasons });
    } catch (error) {
      console.error("Error creating decision:", error);
      res.status(500).json({ message: "Failed to create decision" });
    }
  });

  // Get decision for a submission
  app.get('/api/rental/submissions/:id/decision', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const submission = await storage.getRentalSubmission(req.params.id);
      
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      // Verify ownership
      const appLink = submission.applicationLinkId ? await storage.getRentalApplicationLink(submission.applicationLinkId) : null;
      if (!appLink) {
        return res.status(404).json({ message: "Application link not found" });
      }
      const unit = await storage.getRentalUnit(appLink.unitId);
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }
      const property = await storage.getRentalProperty(unit.propertyId, userId);
      if (!property) {
        return res.status(403).json({ message: "Access denied" });
      }

      const decision = await storage.getRentalDecision(submission.id);
      if (!decision) {
        return res.json(null);
      }
      
      // Include denial reasons if it's a denial
      const denialReasons = decision.decision === 'denied' 
        ? await storage.getRentalDenialReasons(decision.id) 
        : [];
      
      res.json({ ...decision, denialReasons });
    } catch (error) {
      console.error("Error getting decision:", error);
      res.status(500).json({ message: "Failed to get decision" });
    }
  });

  // Send custom notification email for a decision
  app.post('/api/rental/submissions/:id/send-notification', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { subject, body } = req.body;
      
      if (!subject || !body) {
        return res.status(400).json({ message: "Subject and body are required" });
      }
      
      const submission = await storage.getRentalSubmission(req.params.id);
      
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      // Verify ownership
      const appLink = submission.applicationLinkId ? await storage.getRentalApplicationLink(submission.applicationLinkId) : null;
      if (!appLink) {
        return res.status(404).json({ message: "Application link not found" });
      }
      const unit = await storage.getRentalUnit(appLink.unitId);
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }
      const property = await storage.getRentalProperty(unit.propertyId, userId);
      if (!property) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get the primary applicant
      const people = await storage.getRentalSubmissionPeople(submission.id);
      const primaryApplicant = people.find(p => p.role === 'applicant');
      
      if (!primaryApplicant?.email) {
        return res.status(400).json({ message: "Primary applicant email not found" });
      }

      // Send custom email using the email service
      await emailService.sendCustomDecisionEmail(
        primaryApplicant.email,
        subject,
        body
      );
      
      // Record the sent letter in decision letters table
      const decision = await storage.getRentalDecision(submission.id);
      if (decision) {
        const letterType = decision.decision === 'approved' ? 'approval' : 'adverse_action';
        await storage.createRentalDecisionLetter({
          submissionId: submission.id,
          decisionId: decision.id,
          letterType: letterType as 'approval' | 'adverse_action',
          templateBody: body, // Original template body
          finalBody: body, // Final sent body (same in this case)
          sentToEmail: primaryApplicant.email,
          sentAt: new Date(),
        });
      }
      
      console.log(`✅ Custom decision notification sent to ${primaryApplicant.email}`);
      
      res.json({ success: true, message: "Notification sent successfully" });
    } catch (error) {
      console.error("Error sending notification:", error);
      res.status(500).json({ message: "Failed to send notification" });
    }
  });
}
