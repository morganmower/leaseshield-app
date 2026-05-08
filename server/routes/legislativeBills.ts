import type { Express } from "express";
import { eq } from "drizzle-orm";
import { storage } from "../storage";
import { isAuthenticated, requireAdmin } from "../jwtAuth";
import { db } from "../db";
import { getUserId } from "./_shared";

export async function registerLegislativeBillsRoutes(app: Express) {
  // Get all monitored bills (admin only)
  app.get('/api/admin/legislative-bills', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);

      if (!user?.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const filters: any = {};
      if (req.query.stateId) filters.stateId = req.query.stateId as string;
      if (req.query.relevanceLevel) filters.relevanceLevel = req.query.relevanceLevel as string;
      if (req.query.isReviewed !== undefined) filters.isReviewed = req.query.isReviewed === 'true';

      const bills = await storage.getAllLegislativeMonitoring(filters);
      res.json(bills);
    } catch (error) {
      console.error('Error fetching legislative bills:', error);
      res.status(500).json({ message: 'Failed to fetch bills' });
    }
  });

  // Dismiss/review a pending bill (admin only)
  app.patch('/api/admin/legislative-bills/:id/dismiss', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);

      if (!user?.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const { id } = req.params;
      const { reviewNotes } = req.body;

      await storage.updateLegislativeMonitoring(id, {
        isReviewed: true,
        reviewedBy: userId,
        reviewedAt: new Date(),
        reviewNotes: reviewNotes || 'Dismissed by admin - no template updates needed',
      });

      res.json({ success: true, message: 'Bill dismissed' });
    } catch (error) {
      console.error('Error dismissing bill:', error);
      res.status(500).json({ message: 'Failed to dismiss bill' });
    }
  });

  // Approve a bill and queue template updates with AI-drafted changes (admin only)
  app.patch('/api/admin/legislative-bills/:id/approve', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);

      if (!user?.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const { id } = req.params;
      const bill = await storage.getLegislativeMonitoringByBillId(id);
      if (!bill) {
        return res.status(404).json({ message: 'Bill not found' });
      }

      const { approveBill } = await import('../legislativeApprovalService');
      const result = await approveBill(bill.billId, {
        reviewedBy: userId,
        reviewNotes: undefined,
      });

      res.json({
        success: true,
        message: result.alreadyReviewed
          ? 'Bill was already reviewed'
          : `Bill approved - ${result.templatesQueued} template drafts created for review`,
        templatesQueued: result.templatesQueued,
        drafts: result.drafts,
      });
    } catch (error) {
      console.error('Error approving bill:', error);
      res.status(500).json({ message: 'Failed to approve bill' });
    }
  });
}
