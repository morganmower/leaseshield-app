import { db } from "./db";
import { storage } from "./storage";
import { templateReviewQueue } from "@shared/schema";
import type { LegislativeMonitoring } from "@shared/schema";

export interface ApproveBillOptions {
  reviewedBy: string;
  reviewNotes?: string;
}

export interface ApproveBillResult {
  success: boolean;
  alreadyReviewed: boolean;
  templatesQueued: number;
  drafts: Array<{ templateId: string; changeSummary: string; draftedClause: string }>;
}

export async function approveBill(
  billId: string,
  opts: ApproveBillOptions,
): Promise<ApproveBillResult> {
  const bill = await storage.getLegislativeMonitoringByBillId(billId);
  if (!bill) {
    throw new Error(`Bill ${billId} not found`);
  }

  if (bill.isReviewed) {
    return { success: true, alreadyReviewed: true, templatesQueued: 0, drafts: [] };
  }

  let templatesQueued = 0;
  const drafts: ApproveBillResult["drafts"] = [];

  if (bill.affectedTemplateIds && bill.affectedTemplateIds.length > 0) {
    const { billAnalysisService } = await import("./billAnalysisService");

    for (const templateId of bill.affectedTemplateIds) {
      const template = await storage.getTemplate(templateId);
      let draftedChanges = {
        draftedClause: "Review bill for potential template changes",
        clauseLocation: "",
        beforeText: "",
        afterText: "",
        changeType: "other",
        changeSummary: "Manual review required",
        legalReference: "",
      };

      if (template) {
        try {
          const aiDraft = await billAnalysisService.generateDraftClauseChanges(
            template.title,
            template.description || "",
            template.templateType,
            template.stateId,
            bill.billNumber || "",
            bill.title,
            bill.description || "",
            bill.aiAnalysis || "",
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
          console.error("Error generating draft for template:", templateId, draftError);
        }
      }

      // Atomic dedupe via partial unique index on (bill_id, template_id).
      // Concurrent approval calls for the same bill resolve to a single row.
      const inserted = await db
        .insert(templateReviewQueue)
        .values({
          templateId,
          billId,
          reason: `Legislative update: ${bill.billNumber} - ${bill.title}`,
          recommendedChanges: JSON.stringify(draftedChanges),
          status: "pending",
          queuedAt: new Date(),
        })
        .onConflictDoNothing({
          target: [templateReviewQueue.billId, templateReviewQueue.templateId],
        })
        .returning({ id: templateReviewQueue.id });

      if (inserted.length === 0) continue;

      templatesQueued++;
      drafts.push({
        templateId,
        changeSummary: draftedChanges.changeSummary,
        draftedClause: draftedChanges.draftedClause.substring(0, 200) + "...",
      });
    }
  }

  await storage.updateLegislativeMonitoring(bill.id, {
    isReviewed: true,
    reviewedBy: opts.reviewedBy,
    reviewedAt: new Date(),
    reviewNotes:
      opts.reviewNotes ?? `Approved by ${opts.reviewedBy} - ${templatesQueued} template drafts created`,
  });

  return { success: true, alreadyReviewed: false, templatesQueued, drafts };
}

/**
 * Auto-approve bills that are signed law AND high relevance AND have at least one
 * affected template. Safe to call after any insert/update of a legislative_monitoring
 * row. Failures are logged but never thrown — auto-approval must never block ingestion.
 *
 * Disabled when env AUTO_APPROVE_SIGNED_BILLS === 'false'.
 */
export async function tryAutoApproveBill(bill: LegislativeMonitoring): Promise<void> {
  try {
    if (process.env.AUTO_APPROVE_SIGNED_BILLS === "false") return;
    if (bill.isReviewed) return;
    if (bill.status !== "signed") return;
    if (bill.relevanceLevel !== "high") return;
    if (!bill.affectedTemplateIds || bill.affectedTemplateIds.length === 0) return;

    const result = await approveBill(bill.billId, {
      reviewedBy: "system:auto-approve",
      reviewNotes: "Auto-approved: signed law, high relevance",
    });
    if (!result.alreadyReviewed) {
      console.log(
        `🤖 Auto-approved signed bill ${bill.billNumber} (${bill.stateId}) — ${result.templatesQueued} template drafts queued`,
      );
    }
  } catch (err) {
    console.error(`Auto-approve failed for bill ${bill.billNumber} (${bill.id}):`, err);
  }
}
