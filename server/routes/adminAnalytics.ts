import type { Express } from "express";
import { desc, sql } from "drizzle-orm";
import { storage } from "../storage";
import { isAuthenticated, requireAdmin } from "../jwtAuth";
import { users } from "@shared/schema";
import { db } from "../db";
import { getUserId } from "./_shared";

export async function registerAdminAnalyticsRoutes(app: Express) {
  // Admin: Application outcome aggregate stats
  app.get('/api/admin/applications-activity/stats', isAuthenticated, requireAdmin, async (_req, res) => {
    try {
      // Approval rate
      const decisionsResult = await db.execute(sql`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE decision = 'approved') AS approved
        FROM rental_decisions
      `);
      interface DecisionCountRow { total: string; approved: string; }
      const decisionRow = decisionsResult.rows[0] as DecisionCountRow | undefined;
      const total = Number(decisionRow?.total ?? 0);
      const approved = Number(decisionRow?.approved ?? 0);
      const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;

      // Most common denial reason category
      const denialResult = await db.execute(sql`
        SELECT category, COUNT(*) AS cnt
        FROM rental_denial_reasons
        GROUP BY category
        ORDER BY cnt DESC
        LIMIT 1
      `);
      interface DenialCategoryRow { category: string; }
      const topDenialCategory = denialResult.rows[0]
        ? (denialResult.rows[0] as DenialCategoryRow).category
        : null;

      // Average days from submittedAt to decidedAt
      const avgDaysResult = await db.execute(sql`
        SELECT AVG(
          EXTRACT(EPOCH FROM (rd.decided_at - rs.submitted_at)) / 86400
        )::numeric(10,1) AS avg_days
        FROM rental_decisions rd
        JOIN rental_submissions rs ON rs.id = rd.submission_id
        WHERE rs.submitted_at IS NOT NULL
      `);
      interface AvgDaysRow { avg_days: string | null; }
      const avgDays = avgDaysResult.rows[0]
        ? parseFloat((avgDaysResult.rows[0] as AvgDaysRow).avg_days ?? '0') || 0
        : 0;

      res.json({ approvalRate, topDenialCategory, avgDays, totalDecided: Number(total) });
    } catch (error) {
      console.error("Error fetching application stats:", error);
      res.status(500).json({ message: "Failed to fetch application stats" });
    }
  });

  // Admin: Subscriber funnel drop-off
  app.get('/api/admin/analytics/funnel', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { from, to } = req.query as { from?: string; to?: string };
      const fromDate = from ? new Date(from) : null;
      const toDate = to ? new Date(to) : null;

      // Build the active_subs filter fragment
      const dateFilter = fromDate && toDate
        ? sql`AND COALESCE(subscribed_at, created_at) >= ${fromDate.toISOString()} AND COALESCE(subscribed_at, created_at) <= ${toDate.toISOString()}`
        : fromDate
        ? sql`AND COALESCE(subscribed_at, created_at) >= ${fromDate.toISOString()}`
        : toDate
        ? sql`AND COALESCE(subscribed_at, created_at) <= ${toDate.toISOString()}`
        : sql``;

      const rows = await db.execute(sql`
        WITH base AS (
          SELECT id FROM users WHERE is_admin IS NOT TRUE
        ),
        active_subs AS (
          SELECT id FROM users WHERE subscription_status IN ('active', 'trialing') AND is_admin IS NOT TRUE ${dateFilter}
        ),
        with_property AS (
          SELECT DISTINCT user_id AS id FROM rental_properties
          WHERE user_id IN (SELECT id FROM active_subs)
        ),
        with_link AS (
          SELECT DISTINCT rp.user_id AS id
          FROM rental_application_links ral
          JOIN rental_units ru ON ru.id = ral.unit_id
          JOIN rental_properties rp ON rp.id = ru.property_id
          WHERE rp.user_id IN (SELECT id FROM active_subs)
        ),
        with_submission AS (
          SELECT DISTINCT rp.user_id AS id
          FROM rental_submissions rs
          JOIN rental_application_links ral ON ral.id = rs.application_link_id
          JOIN rental_units ru ON ru.id = ral.unit_id
          JOIN rental_properties rp ON rp.id = ru.property_id
          WHERE rp.user_id IN (SELECT id FROM active_subs)
            AND rs.status IN ('submitted','screening_requested','in_progress','complete')
        ),
        with_screening AS (
          SELECT DISTINCT rp.user_id AS id
          FROM rental_screening_orders rso
          JOIN rental_submissions rs ON rs.id = rso.submission_id
          JOIN rental_application_links ral ON ral.id = rs.application_link_id
          JOIN rental_units ru ON ru.id = ral.unit_id
          JOIN rental_properties rp ON rp.id = ru.property_id
          WHERE rp.user_id IN (SELECT id FROM active_subs)
        ),
        with_decision AS (
          SELECT DISTINCT rp.user_id AS id
          FROM rental_decisions rd
          JOIN rental_submissions rs ON rs.id = rd.submission_id
          JOIN rental_application_links ral ON ral.id = rs.application_link_id
          JOIN rental_units ru ON ru.id = ral.unit_id
          JOIN rental_properties rp ON rp.id = ru.property_id
          WHERE rp.user_id IN (SELECT id FROM active_subs)
        )
        SELECT
          (SELECT COUNT(*) FROM base) AS total_users,
          (SELECT COUNT(*) FROM active_subs) AS active_subscribers,
          -- distinct user counts (for drop-off %)
          (SELECT COUNT(*) FROM with_property) AS with_property,
          (SELECT COUNT(*) FROM with_link) AS with_link,
          (SELECT COUNT(*) FROM with_submission) AS with_submission,
          (SELECT COUNT(*) FROM with_screening) AS with_screening,
          (SELECT COUNT(*) FROM with_decision) AS with_decision,
          -- total activity counts (volume, not distinct users)
          (SELECT COUNT(*) FROM rental_properties WHERE user_id IN (SELECT id FROM active_subs)) AS total_properties,
          (SELECT COUNT(ral.id) FROM rental_application_links ral JOIN rental_units ru ON ru.id = ral.unit_id JOIN rental_properties rp ON rp.id = ru.property_id WHERE rp.user_id IN (SELECT id FROM active_subs)) AS total_links,
          (SELECT COUNT(rs.id) FROM rental_submissions rs JOIN rental_application_links ral ON ral.id = rs.application_link_id JOIN rental_units ru ON ru.id = ral.unit_id JOIN rental_properties rp ON rp.id = ru.property_id WHERE rp.user_id IN (SELECT id FROM active_subs) AND rs.status IN ('submitted','screening_requested','in_progress','complete')) AS total_submissions,
          (SELECT COUNT(rso.id) FROM rental_screening_orders rso JOIN rental_submissions rs ON rs.id = rso.submission_id JOIN rental_application_links ral ON ral.id = rs.application_link_id JOIN rental_units ru ON ru.id = ral.unit_id JOIN rental_properties rp ON rp.id = ru.property_id WHERE rp.user_id IN (SELECT id FROM active_subs)) AS total_screenings,
          (SELECT COUNT(rd.id) FROM rental_decisions rd JOIN rental_submissions rs ON rs.id = rd.submission_id JOIN rental_application_links ral ON ral.id = rs.application_link_id JOIN rental_units ru ON ru.id = ral.unit_id JOIN rental_properties rp ON rp.id = ru.property_id WHERE rp.user_id IN (SELECT id FROM active_subs)) AS total_decisions
      `);
      interface FunnelRow {
        total_users: string; active_subscribers: string;
        with_property: string; with_link: string; with_submission: string; with_screening: string; with_decision: string;
        total_properties: string; total_links: string; total_submissions: string; total_screenings: string; total_decisions: string;
      }
      const r = rows.rows[0] as FunnelRow;
      res.json({
        from: fromDate ? fromDate.toISOString() : null,
        to: toDate ? toDate.toISOString() : null,
        stages: [
          { label: "All Users", count: Number(r.total_users), total: null, totalLabel: null },
          { label: "Subscribers (Active + Trial)", count: Number(r.active_subscribers), total: null, totalLabel: null },
          { label: "Created a Property", count: Number(r.with_property), total: Number(r.total_properties), totalLabel: "properties" },
          { label: "Sent Application Link", count: Number(r.with_link), total: Number(r.total_links), totalLabel: "links sent" },
          { label: "Received Submission", count: Number(r.with_submission), total: Number(r.total_submissions), totalLabel: "submissions" },
          { label: "Requested Screening", count: Number(r.with_screening), total: Number(r.total_screenings), totalLabel: "orders" },
          { label: "Issued Decision", count: Number(r.with_decision), total: Number(r.total_decisions), totalLabel: "decisions" },
        ],
      });
    } catch (error) {
      console.error("Error fetching funnel data:", error);
      res.status(500).json({ message: "Failed to fetch funnel data" });
    }
  });

  // Admin: Per-user engagement summary
  app.get('/api/admin/analytics/users', isAuthenticated, requireAdmin, async (_req, res) => {
    try {
      const rows = await db.execute(sql`
        SELECT
          u.id,
          u.email,
          u.first_name AS "firstName",
          u.last_name AS "lastName",
          u.subscription_status AS "subscriptionStatus",
          u.subscribed_at AS "subscribedAt",
          u.created_at AS "createdAt",
          -- Last analytics activity
          MAX(ae.created_at) AS "lastActiveAt",
          -- Template downloads
          COUNT(ae.id) FILTER (WHERE ae.event_type = 'template_download') AS "templateDownloads",
          -- Applications sent = outbound links created by this landlord
          (
            SELECT COUNT(DISTINCT ral.id)
            FROM rental_application_links ral
            JOIN rental_units ru ON ru.id = ral.unit_id
            JOIN rental_properties rp ON rp.id = ru.property_id
            WHERE rp.user_id = u.id
          ) AS "applicationsSent",
          -- Screening requests
          COUNT(ae.id) FILTER (WHERE ae.event_type IN ('screening_request', 'western_verify_click')) AS "screeningRequests"
        FROM users u
        LEFT JOIN analytics_events ae ON ae.user_id = u.id
        WHERE u.is_admin IS NOT TRUE
        GROUP BY u.id, u.email, u.first_name, u.last_name, u.subscription_status, u.subscribed_at, u.created_at
        ORDER BY "lastActiveAt" DESC NULLS LAST
      `);
      res.json(rows.rows);
    } catch (error) {
      console.error("Error fetching user engagement:", error);
      res.status(500).json({ message: "Failed to fetch user engagement" });
    }
  });

  // Admin: MRR history for past 12 months
  app.get('/api/admin/analytics/mrr-history', isAuthenticated, requireAdmin, async (_req, res) => {
    try {
      // Generate past 12 months
      const months: { year: number; month: number; label: string }[] = [];
      const now = new Date();
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({
          year: d.getFullYear(),
          month: d.getMonth() + 1,
          label: d.toLocaleString('default', { month: 'short', year: '2-digit' }),
        });
      }

      // For each month, count active subscribers and compute MRR
      // A subscriber counts for a month if they subscribed before end of that month
      // and either have no end date or ended after start of that month
      const history = await Promise.all(
        months.map(async ({ year, month, label }) => {
          const start = new Date(year, month - 1, 1);
          const end = new Date(year, month, 0, 23, 59, 59); // last day of month

          const result = await db.execute(sql`
            SELECT
              COUNT(*) FILTER (WHERE billing_interval IN ('year', 'yearly')) AS annual_count,
              COUNT(*) FILTER (WHERE billing_interval IN ('month', 'monthly') OR billing_interval IS NULL) AS monthly_count
            FROM users
            WHERE is_admin IS NOT TRUE
              AND COALESCE(subscribed_at, created_at) <= ${end.toISOString()}
              AND (
                subscription_expires_at IS NULL
                OR subscription_expires_at >= ${start.toISOString()}
              )
              AND subscription_status IN ('active', 'canceled')
          `);
          interface MrrRow { annual_count: string; monthly_count: string; }
          const r = result.rows[0] as MrrRow;
          const annualCount = Number(r.annual_count) || 0;
          const monthlyCount = Number(r.monthly_count) || 0;
          // Annual = $100/year → $8.33/month. Monthly = $10/month
          const mrr = Math.round(monthlyCount * 10 + annualCount * (100 / 12));
          return { label, year, month, mrr, subscribers: annualCount + monthlyCount };
        })
      );

      res.json(history);
    } catch (error) {
      console.error("Error fetching MRR history:", error);
      res.status(500).json({ message: "Failed to fetch MRR history" });
    }
  });

  // Admin Applications Activity - view all rental submissions across all users
  app.get('/api/admin/applications-activity', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);

      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Access denied. Admin only." });
      }

      // Fetch all submissions with full details using Drizzle relations
      const submissions = await db.query.rentalSubmissions.findMany({
        with: {
          applicationLink: {
            with: {
              unit: {
                with: {
                  property: {
                    with: {
                      user: true, // The landlord
                    },
                  },
                },
              },
            },
          },
          people: { with: { files: true } },
          screeningOrder: true,
          decision: { with: { denialReasons: true } },
          events: true,
        },
        orderBy: (rs, { desc }) => [desc(rs.createdAt)],
      });

      // Helper: extract key fields from formJson
      function extractFormData(formJson: any) {
        if (!formJson) return null;
        return {
          monthlyIncome: formJson.monthlyIncome ?? formJson.income ?? null,
          employer: formJson.employer ?? formJson.currentEmployer ?? null,
          employerPhone: formJson.employerPhone ?? null,
          moveInDate: formJson.moveInDate ?? null,
          desiredMoveInDate: formJson.desiredMoveInDate ?? formJson.moveInDate ?? null,
          occupantCount: Array.isArray(formJson.occupants) ? formJson.occupants.length : (formJson.occupantCount ?? null),
          petCount: Array.isArray(formJson.pets) ? formJson.pets.length : (formJson.petCount ?? null),
          vehicleCount: Array.isArray(formJson.vehicles) ? formJson.vehicles.length : (formJson.vehicleCount ?? null),
          pets: Array.isArray(formJson.pets) ? formJson.pets : [],
          vehicles: Array.isArray(formJson.vehicles) ? formJson.vehicles : [],
        };
      }

      // Transform into a more digestible format for the admin UI
      const activityData = submissions.map(sub => {
        const property = sub.applicationLink?.unit?.property;
        const landlord = property?.user;
        const primaryApplicant = sub.people?.find(p => p.role === 'applicant');
        const coApplicants = sub.people?.filter(p => p.role === 'coapplicant') || [];
        const guarantors = sub.people?.filter(p => p.role === 'guarantor') || [];

        return {
          id: sub.id,
          status: sub.status,
          submittedAt: sub.submittedAt,
          createdAt: sub.createdAt,
          // Landlord info
          landlord: landlord ? {
            id: landlord.id,
            email: landlord.email,
            name: [landlord.firstName, landlord.lastName].filter(Boolean).join(' ') || landlord.email,
          } : null,
          // Property info
          property: property ? {
            id: property.id,
            name: property.name,
            address: property.address,
            city: property.city,
            state: property.state,
          } : null,
          // Unit info
          unit: sub.applicationLink?.unit ? {
            id: sub.applicationLink.unit.id,
            label: sub.applicationLink.unit.unitLabel,
          } : null,
          // Primary applicant
          applicant: primaryApplicant ? {
            id: primaryApplicant.id,
            firstName: primaryApplicant.firstName,
            lastName: primaryApplicant.lastName,
            email: primaryApplicant.email,
            phone: primaryApplicant.phone,
            isCompleted: primaryApplicant.isCompleted,
            completedAt: primaryApplicant.completedAt,
            formData: extractFormData(primaryApplicant.formJson),
            files: (Array.isArray((primaryApplicant as { files?: unknown[] }).files)
              ? (primaryApplicant as { files: { fileType: string; availabilityStatus: string }[] }).files
              : []
            ).map(f => ({ fileType: f.fileType, availabilityStatus: f.availabilityStatus })),
          } : null,
          // Co-applicants and guarantors
          coApplicants: coApplicants.map(p => ({
            id: p.id,
            firstName: p.firstName,
            lastName: p.lastName,
            email: p.email,
            isCompleted: p.isCompleted,
            formData: extractFormData(p.formJson),
          })),
          guarantors: guarantors.map(p => ({
            id: p.id,
            firstName: p.firstName,
            lastName: p.lastName,
            email: p.email,
            isCompleted: p.isCompleted,
            formData: extractFormData(p.formJson),
          })),
          // Screening info
          screening: sub.screeningOrder ? {
            status: sub.screeningOrder.status,
            referenceNumber: sub.screeningOrder.referenceNumber,
            createdAt: sub.screeningOrder.createdAt,
            updatedAt: sub.screeningOrder.updatedAt,
            reportUrl: sub.screeningOrder.reportUrl,
          } : null,
          // Decision with denial reasons
          decision: sub.decision ? {
            decision: sub.decision.decision,
            decidedAt: sub.decision.decidedAt,
            notes: sub.decision.notes,
            denialReasons: (Array.isArray((sub.decision as { denialReasons?: unknown[] }).denialReasons)
              ? (sub.decision as { denialReasons: { category: string; detail: string }[] }).denialReasons
              : []
            ).map(r => ({ category: r.category, detail: r.detail })),
          } : null,
          // Event timeline
          events: sub.events?.map(e => ({
            type: e.eventType,
            createdAt: e.createdAt,
            metadata: e.metadataJson,
          })) || [],
        };
      });

      res.json(activityData);
    } catch (error) {
      console.error("Error fetching applications activity:", error);
      res.status(500).json({ message: "Failed to fetch applications activity" });
    }
  });

  // Admin: Rent collection / Stripe activity per landlord
  // Surfaces which landlords are transacting through Stripe (one-time rent
  // requests + recurring ACH auto-pay) and their Stripe Connect onboarding
  // status. All money amounts are returned in cents.
  //   totalCollected     = SUM(amount_paid) over ALL requests (actual cash
  //                        received, including partial payments).
  //   totalPlatformFees  = SUM(platform_fee_amount) over status='paid' only
  //                        (fees are realized when a request is fully paid).
  app.get('/api/admin/analytics/rent-stripe', isAuthenticated, requireAdmin, async (_req, res) => {
    try {
      const rows = await db.execute(sql`
        WITH pay AS (
          SELECT
            user_id,
            COUNT(*) AS request_count,
            COUNT(*) FILTER (WHERE status = 'paid') AS paid_count,
            COALESCE(SUM(amount_paid), 0) AS total_collected,
            COALESCE(SUM(platform_fee_amount) FILTER (WHERE status = 'paid'), 0) AS total_platform_fees,
            MAX(paid_at) AS last_paid_at
          FROM rent_payment_requests
          GROUP BY user_id
        ),
        subs AS (
          SELECT
            user_id,
            COUNT(*) FILTER (WHERE status = 'active') AS active_recurring,
            COUNT(*) AS total_recurring
          FROM rent_subscriptions
          GROUP BY user_id
        )
        SELECT
          u.id,
          u.email,
          u.first_name AS "firstName",
          u.last_name AS "lastName",
          u.business_name AS "businessName",
          (u.stripe_connect_account_id IS NOT NULL) AS "hasConnect",
          COALESCE(u.stripe_connect_charges_enabled, false) AS "chargesEnabled",
          COALESCE(u.stripe_connect_payouts_enabled, false) AS "payoutsEnabled",
          COALESCE(pay.request_count, 0) AS "requestCount",
          COALESCE(pay.paid_count, 0) AS "paidCount",
          COALESCE(pay.total_collected, 0) AS "totalCollected",
          COALESCE(pay.total_platform_fees, 0) AS "totalPlatformFees",
          pay.last_paid_at AS "lastPaidAt",
          COALESCE(subs.active_recurring, 0) AS "activeRecurring",
          COALESCE(subs.total_recurring, 0) AS "totalRecurring"
        FROM users u
        LEFT JOIN pay ON pay.user_id = u.id
        LEFT JOIN subs ON subs.user_id = u.id
        WHERE u.is_admin IS NOT TRUE
          AND (
            u.stripe_connect_account_id IS NOT NULL
            OR pay.user_id IS NOT NULL
            OR subs.user_id IS NOT NULL
          )
        ORDER BY "totalCollected" DESC, "requestCount" DESC, "hasConnect" DESC
      `);
      res.json(rows.rows);
    } catch (error) {
      console.error("Error fetching rent/Stripe activity:", error);
      res.status(500).json({ message: "Failed to fetch rent/Stripe activity" });
    }
  });
}
