import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../jwtAuth";
import { getUserId } from "./_shared";

type AttentionItem = {
  id: string;
  type: string;
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
  timestamp?: string;
};

type ActivityItem = {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  href?: string;
};

const PRIORITY_ORDER: Record<"high" | "medium" | "low", number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export async function registerDashboardRoutes(app: Express) {
  app.get("/api/dashboard/attention", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(userId);
      const userState = user?.preferredState || null;

      const [
        rentalProperties,
        properties,
        submissions,
        rentLedger,
        stateLegalUpdates,
      ] = await Promise.all([
        storage.getRentalPropertiesByUserId(userId).catch(() => []),
        storage.getPropertiesByUserId(userId).catch(() => []),
        storage.getRentalSubmissionsByUserId(userId, false, false).catch(() => []),
        storage.getRentLedgerEntries(userId).catch(() => []),
        // State-scoped fetch so we never miss a relevant update by being
        // truncated out of a global "recent" window. Empty array if no
        // preferred state - matches the gating logic below.
        userState
          ? storage.getLegalUpdatesByState(userState).catch(() => [])
          : Promise.resolve([] as any[]),
      ]);

      const attention: AttentionItem[] = [];
      const activity: ActivityItem[] = [];

      // Submissions: enrich each with screening orders + decisions (concurrency-bounded)
      const enriched = await Promise.all(
        submissions.slice(0, 50).map(async (s) => {
          const [orders, decision, people] = await Promise.all([
            storage.getRentalScreeningOrdersBySubmission(s.id).catch(() => []),
            storage.getRentalDecision(s.id).catch(() => undefined),
            storage.getRentalSubmissionPeople(s.id).catch(() => []),
          ]);
          let appName = "Applicant";
          if (Array.isArray(people) && people.length > 0) {
            const primary = people.find((p: any) => p.role === "applicant") || people[0];
            const fn = primary?.firstName || "";
            const ln = primary?.lastName || "";
            const full = `${fn} ${ln}`.trim();
            if (full) appName = full;
          }
          return { s, orders, decision, appName };
        })
      );

      let reportsToReviewCount = 0;
      let activeApplicationsCount = 0;

      for (const { s, orders, decision, appName } of enriched) {
        const isActive = ["started", "submitted", "screening_requested", "in_progress"].includes(s.status);
        if (isActive) activeApplicationsCount++;

        // High: Screening complete, no decision yet → decode + decide
        const allComplete =
          orders.length > 0 &&
          orders.every((o: any) => {
            const x = (o.status || "").toLowerCase();
            return x === "complete" || x === "completed";
          });
        if ((s.status === "complete" || allComplete) && !decision) {
          reportsToReviewCount++;
          attention.push({
            id: `report-${s.id}`,
            type: "report_ready",
            priority: "high",
            title: `Screening report ready for ${appName}`,
            description: "Decode the report and record your decision.",
            actionLabel: "Review report",
            actionHref: `/rental-submissions?id=${s.id}`,
            timestamp: (s.updatedAt as any) ?? undefined,
          });
        }

        // High: Submitted but no screening sent yet → send for screening
        if (s.status === "submitted" && orders.length === 0) {
          attention.push({
            id: `submitted-${s.id}`,
            type: "needs_screening",
            priority: "high",
            title: `${appName} submitted an application`,
            description: "Send the screening request to keep things moving.",
            actionLabel: "Open application",
            actionHref: `/rental-submissions?id=${s.id}`,
            timestamp: (s.submittedAt as any) ?? (s.updatedAt as any) ?? undefined,
          });
        }

        // Medium: Screening in progress → status awareness
        if (s.status === "screening_requested" || s.status === "in_progress") {
          attention.push({
            id: `inprog-${s.id}`,
            type: "screening_in_progress",
            priority: "medium",
            title: `Screening in progress for ${appName}`,
            description: "We'll notify you when results arrive.",
            actionLabel: "View status",
            actionHref: `/rental-submissions?id=${s.id}`,
            timestamp: (s.updatedAt as any) ?? undefined,
          });
        }

        // Activity: recent submissions / decisions
        if (s.submittedAt) {
          activity.push({
            id: `act-sub-${s.id}`,
            type: "submission",
            description: `${appName} submitted an application`,
            timestamp: s.submittedAt as any,
            href: `/rental-submissions?id=${s.id}`,
          });
        }
        if (decision?.decidedAt) {
          activity.push({
            id: `act-dec-${s.id}`,
            type: "decision",
            description: `Decision recorded for ${appName} (${decision.decision})`,
            timestamp: decision.decidedAt as any,
            href: `/rental-submissions?id=${s.id}`,
          });
        }
      }

      // Overdue rent: charge entries with effectiveDate in the past and amountReceived < amountExpected
      const now = new Date();
      const overdue = (rentLedger || []).filter((e: any) => {
        if (e.type && e.type !== "charge") return false;
        const eff = e.effectiveDate ? new Date(e.effectiveDate) : null;
        if (!eff || eff > now) return false;
        const expected = e.amountExpected || 0;
        const received = e.amountReceived || 0;
        return received < expected;
      });
      for (const e of overdue.slice(0, 5)) {
        const dollars = ((e.amountExpected - (e.amountReceived || 0)) / 100).toFixed(2);
        attention.push({
          id: `rent-${e.id}`,
          type: "overdue_rent",
          priority: "high",
          title: `Rent overdue from ${e.tenantName}`,
          description: `$${dollars} outstanding for ${e.description || e.month}.`,
          actionLabel: "Open rent ledger",
          actionHref: "/rent-ledger?tab=track",
          timestamp: e.effectiveDate ? new Date(e.effectiveDate).toISOString() : undefined,
        });
      }

      // Recent legal updates this month for user's state.
      // If user has not set a preferred state, do NOT surface updates from
      // every state - that would defeat the "all caught up" empty state and
      // create noise.
      const monthAgo = new Date();
      monthAgo.setDate(monthAgo.getDate() - 30);
      const stateUpdates = userState
        ? (stateLegalUpdates || []).filter((u: any) => {
            const eff = u.effectiveDate ? new Date(u.effectiveDate) : null;
            return eff ? eff >= monthAgo : true;
          })
        : [];
      for (const u of stateUpdates.slice(0, 3)) {
        attention.push({
          id: `update-${u.id}`,
          type: "legal_update",
          priority: u.impactLevel === "high" ? "high" : "medium",
          title: `${u.stateId}: ${u.title}`,
          description: u.whyItMatters || u.summary || "Review this legislation update.",
          actionLabel: "Review update",
          actionHref: "/legal-updates",
          timestamp: u.effectiveDate ? new Date(u.effectiveDate).toISOString() : undefined,
        });
      }

      // Sort attention: priority then newest
      attention.sort((a, b) => {
        const p = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
        if (p !== 0) return p;
        const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return tb - ta;
      });

      // Sort activity: newest first
      activity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // Stats
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const updatesThisMonthCount = stateUpdates.length;
      const propertiesCount = rentalProperties.length || properties.length || 0;

      res.json({
        stats: {
          propertiesCount,
          activeApplicationsCount,
          reportsToReviewCount,
          updatesThisMonthCount,
        },
        attention: attention.slice(0, 8),
        activity: activity.slice(0, 8),
      });
    } catch (error) {
      console.error("Error building dashboard attention:", error);
      res.status(500).json({ message: "Failed to load dashboard" });
    }
  });
}
