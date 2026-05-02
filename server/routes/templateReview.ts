import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated, requireAdmin } from "../jwtAuth";
import { users } from "@shared/schema";
import { notifyUsersOfTemplateUpdate } from "../templateNotifications";
import { getUserId } from "./_shared";

export async function registerTemplateReviewRoutes(app: Express) {
  // Approve a template update (admin only)
  app.post('/api/admin/template-review/:id/approve', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);

      if (!user?.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const { id } = req.params;
      const { approvalNotes } = req.body;

      // Update review status to approved
      const review = await storage.updateTemplateReviewQueue(id, {
        status: 'approved',
        approvalNotes: approvalNotes || 'Approved by admin',
        approvedAt: new Date(),
      });

      // Publish the template update automatically
      const template = await storage.getTemplate(review.templateId);
      if (!template) {
        return res.status(404).json({ message: 'Template not found' });
      }

      // Mark the originating bill as reviewed
      if (review.billId) {
        await storage.updateLegislativeMonitoring(review.billId, {
          isReviewed: true,
          reviewedBy: userId,
          reviewedAt: new Date(),
          reviewNotes: `Approved template update for ${template.title}`,
        });
      }

      const publishResult = await storage.publishTemplateUpdate({
        templateId: review.templateId,
        reviewId: id,
        versionNotes: review.recommendedChanges || 'Legislative update',
        lastUpdateReason: review.reason,
        publishedBy: userId,
      });

      // Notify affected users
      await notifyUsersOfTemplateUpdate(publishResult.template, publishResult.version);

      res.json({
        success: true,
        message: 'Template update approved and published',
        template: publishResult.template,
        version: publishResult.version,
      });
    } catch (error) {
      console.error('Error approving template update:', error);
      res.status(500).json({ message: 'Failed to approve update' });
    }
  });

  // Reject a template update (admin only)
  app.post('/api/admin/template-review/:id/reject', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);

      if (!user?.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const { id } = req.params;
      const { rejectionNotes } = req.body;

      const review = await storage.updateTemplateReviewQueue(id, {
        status: 'rejected',
        approvalNotes: rejectionNotes || 'Rejected by admin - no changes needed',
        rejectedAt: new Date(),
      });

      // Mark the originating bill as reviewed
      if (review.billId) {
        await storage.updateLegislativeMonitoring(review.billId, {
          isReviewed: true,
          reviewedBy: userId,
          reviewedAt: new Date(),
          reviewNotes: `Rejected template update for template ${review.templateId}: ${rejectionNotes || 'No changes needed'}`,
        });
      }

      res.json({
        success: true,
        message: 'Template update rejected',
        review,
      });
    } catch (error) {
      console.error('Error rejecting template update:', error);
      res.status(500).json({ message: 'Failed to reject update' });
    }
  });
}
