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
      
      // Get the bill to find affected templates
      const bill = await storage.getLegislativeMonitoringByBillId(id);
      if (!bill) {
        return res.status(404).json({ message: 'Bill not found' });
      }

      // Queue template reviews with AI-drafted clause changes
      let templatesQueued = 0;
      const draftResults: Array<{ templateId: string; changeSummary: string; draftedClause: string }> = [];
      
      if (bill.affectedTemplateIds && bill.affectedTemplateIds.length > 0) {
        const { billAnalysisService } = await import("../billAnalysisService");
        
        for (const templateId of bill.affectedTemplateIds) {
          // Check if a review already exists for this bill+template
          const existing = await db.query.templateReviewQueue.findFirst({
            where: (table, { eq, and }) => and(
              eq(table.billId, id),
              eq(table.templateId, templateId)
            ),
          });
          
          if (!existing) {
            // Get template details for AI drafting
            const template = await storage.getTemplate(templateId);
            
            let draftedChanges: {
              draftedClause: string;
              clauseLocation: string;
              beforeText: string;
              afterText: string;
              changeType: string;
              changeSummary: string;
              legalReference: string;
            } = {
              draftedClause: 'Review bill for potential template changes',
              clauseLocation: '',
              beforeText: '',
              afterText: '',
              changeType: 'other',
              changeSummary: 'Manual review required',
              legalReference: '',
            };
            
            // Generate AI-drafted clause changes
            if (template) {
              try {
                const aiDraft = await billAnalysisService.generateDraftClauseChanges(
                  template.title,
                  template.description || '',
                  template.templateType,
                  template.stateId,
                  bill.billNumber || '',
                  bill.title,
                  bill.description || '',
                  bill.aiAnalysis || ''
                );
                draftedChanges = {
                  draftedClause: aiDraft.draftedClause,
                  clauseLocation: aiDraft.clauseLocation,
                  beforeText: aiDraft.beforeText,
                  afterText: aiDraft.afterText,
                  changeType: aiDraft.changeType,
                  changeSummary: aiDraft.changeSummary,
                  legalReference: aiDraft.legalReference,
                };
              } catch (draftError) {
                console.error('Error generating draft for template:', templateId, draftError);
              }
            }
            
            // Store the drafted changes as JSON in recommendedChanges
            const recommendedChangesJson = JSON.stringify(draftedChanges);
            
            const { templateReviewQueue } = await import('@shared/schema');
            await db.insert(templateReviewQueue).values({
              templateId,
              billId: id,
              reason: `Legislative update: ${bill.billNumber} - ${bill.title}`,
              recommendedChanges: recommendedChangesJson,
              status: 'pending', // Pending admin approval of draft
              queuedAt: new Date(),
            });
            
            templatesQueued++;
            draftResults.push({
              templateId,
              changeSummary: draftedChanges.changeSummary,
              draftedClause: draftedChanges.draftedClause.substring(0, 200) + '...',
            });
          }
        }
      }

      // Mark the bill as reviewed
      await storage.updateLegislativeMonitoring(id, {
        isReviewed: true,
        reviewedBy: userId,
        reviewedAt: new Date(),
        reviewNotes: `Approved by admin - ${templatesQueued} template drafts created`,
      });

      res.json({ 
        success: true, 
        message: `Bill approved - ${templatesQueued} template drafts created for review`,
        templatesQueued,
        drafts: draftResults,
      });
    } catch (error) {
      console.error('Error approving bill:', error);
      res.status(500).json({ message: 'Failed to approve bill' });
    }
  });
}
