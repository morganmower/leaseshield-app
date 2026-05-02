import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated, requireAdmin } from "../jwtAuth";
import { users } from "@shared/schema";
import { notifyUsersOfTemplateUpdate } from "../templateNotifications";
import { getUserId } from "./_shared";

export async function registerTemplateReviewQueueRoutes(app: Express) {
  // Admin - Get template review queue (with enriched template data)
  app.get("/api/admin/template-review-queue", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const reviews = await storage.getAllTemplateReviewQueue({
        status: req.query.status as string | undefined,
      });

      const enrichedReviews = await Promise.all(
        reviews.map(async (review) => {
          const template = await storage.getTemplate(review.templateId);
          // Also get the related bill info
          let bill = null;
          if (review.billId) {
            bill = await storage.getLegislativeMonitoringByBillId(review.billId);
          }
          return { ...review, template, bill };
        })
      );

      // Return array directly, not wrapped in object
      res.json(enrichedReviews);
    } catch (error: any) {
      console.error("Error fetching template review queue:", error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  // Admin - Approve template update
  app.patch("/api/admin/template-review-queue/:id/approve", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { approvalNotes, versionNotes, lastUpdateReason, pdfUrl, fillableFormData } = req.body;

      if (!versionNotes || !lastUpdateReason) {
        return res.status(400).json({ message: "versionNotes and lastUpdateReason are required" });
      }

      const review = await storage.getTemplateReviewById(id);
      if (!review) {
        return res.status(404).json({ message: "Review not found" });
      }

      const userId = getUserId(req);
      const { template, version } = await storage.publishTemplateUpdate({
        templateId: review.templateId,
        reviewId: id,
        pdfUrl,
        fillableFormData,
        versionNotes,
        lastUpdateReason,
        publishedBy: userId,
      });

      if (approvalNotes) {
        await storage.updateTemplateReviewQueue(id, { approvalNotes, approvedAt: new Date() });
      }

      const notificationsSent = await notifyUsersOfTemplateUpdate(template, version);

      res.json({ success: true, template, version, notificationsSent });
    } catch (error: any) {
      console.error("Error approving template update:", error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  // Admin - Reject template update
  app.patch("/api/admin/template-review-queue/:id/reject", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { approvalNotes } = req.body;

      if (!approvalNotes) {
        return res.status(400).json({ message: "approvalNotes is required" });
      }

      await storage.updateTemplateReviewQueue(id, {
        status: 'rejected' as any,
        approvalNotes,
        rejectedAt: new Date(),
      });

      res.json({ success: true, reviewId: id, status: 'rejected' });
    } catch (error: any) {
      console.error("Error rejecting template update:", error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  // Admin - One-click approve AI-drafted template update
  app.patch("/api/admin/template-review-queue/:id/quick-approve", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = getUserId(req);

      const review = await storage.getTemplateReviewById(id);
      if (!review) {
        return res.status(404).json({ message: "Review not found" });
      }

      // Parse the AI-drafted changes from recommendedChanges
      let draftedChanges = {
        draftedClause: '',
        clauseLocation: '',
        changeType: 'other',
        changeSummary: '',
        legalReference: '',
      };

      if (review.recommendedChanges) {
        try {
          draftedChanges = JSON.parse(review.recommendedChanges);
        } catch {
          // Not JSON, use as plain text
          draftedChanges.draftedClause = review.recommendedChanges;
          draftedChanges.changeSummary = 'Manual update based on legislative change';
        }
      }

      // Get the template
      const template = await storage.getTemplate(review.templateId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      // Generate version notes from the draft
      const versionNotes = draftedChanges.changeSummary || 'Legislative update applied';
      const lastUpdateReason = draftedChanges.legalReference 
        ? `Legislative update: ${draftedChanges.legalReference}`
        : 'Legislative compliance update';

      // Publish the template update with the drafted changes
      const { template: updatedTemplate, version } = await storage.publishTemplateUpdate({
        templateId: review.templateId,
        reviewId: id,
        pdfUrl: template.pdfUrl, // Keep existing PDF - would need to regenerate separately
        fillableFormData: template.fillableFormData,
        versionNotes,
        lastUpdateReason,
        publishedBy: userId,
      });

      // Update the review queue entry
      await storage.updateTemplateReviewQueue(id, {
        status: 'approved' as any,
        approvedAt: new Date(),
        approvalNotes: `Quick-approved AI draft: ${draftedChanges.changeSummary}`,
        approvedChanges: draftedChanges.draftedClause,
      });

      // Notify users about the template update
      const notificationsSent = await notifyUsersOfTemplateUpdate(updatedTemplate, version);

      res.json({ 
        success: true, 
        template: updatedTemplate, 
        version,
        notificationsSent,
        message: `Template "${template.title}" updated and ${notificationsSent} users notified`,
      });
    } catch (error: any) {
      console.error("Error quick-approving template update:", error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });
}
