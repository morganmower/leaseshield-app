import type { Express } from "express";
import { sql } from "drizzle-orm";
import { isAuthenticated, requireAdmin } from "../jwtAuth";
import { db } from "../db";

interface SummaryRow {
  total_fees_cents: string | null;
  total_paid_count: string | null;
  total_volume_cents: string | null;
}

interface MonthlyRow {
  month: string;
  fees_cents: string;
  payment_count: string;
  volume_cents: string;
}

interface LandlordRow {
  user_id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  fees_cents: string;
  payment_count: string;
  volume_cents: string;
}

export async function registerAdminPlatformFeesRoutes(app: Express) {
  // Summary: totals + per-month breakdown + per-landlord breakdown
  app.get(
    "/api/admin/platform-fees/summary",
    isAuthenticated,
    requireAdmin,
    async (_req, res) => {
      try {
        const totalsResult = await db.execute(sql`
          SELECT
            COALESCE(SUM(platform_fee_amount), 0) AS total_fees_cents,
            COUNT(*) AS total_paid_count,
            COALESCE(SUM(amount_paid), 0) AS total_volume_cents
          FROM rent_payment_requests
          WHERE status = 'paid'
        `);
        const totals = totalsResult.rows[0] as SummaryRow | undefined;

        const monthlyResult = await db.execute(sql`
          SELECT
            to_char(date_trunc('month', COALESCE(paid_at, updated_at)), 'YYYY-MM') AS month,
            COALESCE(SUM(platform_fee_amount), 0) AS fees_cents,
            COUNT(*) AS payment_count,
            COALESCE(SUM(amount_paid), 0) AS volume_cents
          FROM rent_payment_requests
          WHERE status = 'paid'
          GROUP BY 1
          ORDER BY 1 DESC
          LIMIT 24
        `);

        const landlordResult = await db.execute(sql`
          SELECT
            u.id AS user_id,
            u.email,
            u.first_name,
            u.last_name,
            COALESCE(SUM(rpr.platform_fee_amount), 0) AS fees_cents,
            COUNT(rpr.id) AS payment_count,
            COALESCE(SUM(rpr.amount_paid), 0) AS volume_cents
          FROM rent_payment_requests rpr
          JOIN users u ON u.id = rpr.user_id
          WHERE rpr.status = 'paid'
          GROUP BY u.id, u.email, u.first_name, u.last_name
          ORDER BY fees_cents DESC
          LIMIT 100
        `);

        res.json({
          totals: {
            totalFeesCents: Number(totals?.total_fees_cents ?? 0),
            totalPaidCount: Number(totals?.total_paid_count ?? 0),
            totalVolumeCents: Number(totals?.total_volume_cents ?? 0),
          },
          monthly: (monthlyResult.rows as MonthlyRow[]).map((r) => ({
            month: r.month,
            feesCents: Number(r.fees_cents),
            paymentCount: Number(r.payment_count),
            volumeCents: Number(r.volume_cents),
          })),
          landlords: (landlordResult.rows as LandlordRow[]).map((r) => ({
            userId: r.user_id,
            email: r.email,
            name:
              [r.first_name, r.last_name].filter(Boolean).join(" ") ||
              r.email ||
              "(unknown)",
            feesCents: Number(r.fees_cents),
            paymentCount: Number(r.payment_count),
            volumeCents: Number(r.volume_cents),
          })),
        });
      } catch (error) {
        console.error("Error fetching platform fee summary:", error);
        res.status(500).json({ message: "Failed to fetch platform fee summary" });
      }
    }
  );

  // CSV export of all paid rent payment requests with platform fee data
  app.get(
    "/api/admin/platform-fees/export.csv",
    isAuthenticated,
    requireAdmin,
    async (_req, res) => {
      try {
        const rowsResult = await db.execute(sql`
          SELECT
            rpr.id,
            rpr.paid_at,
            rpr.due_date,
            rpr.tenant_name,
            rpr.tenant_email,
            rpr.amount,
            rpr.amount_paid,
            rpr.service_fee_amount,
            rpr.service_fee_payer,
            rpr.platform_fee_amount,
            rpr.stripe_payment_intent_id,
            u.id AS landlord_id,
            u.email AS landlord_email,
            u.first_name AS landlord_first_name,
            u.last_name AS landlord_last_name
          FROM rent_payment_requests rpr
          JOIN users u ON u.id = rpr.user_id
          WHERE rpr.status = 'paid'
          ORDER BY rpr.paid_at DESC NULLS LAST
        `);

        const escape = (v: unknown): string => {
          if (v === null || v === undefined) return "";
          const s = String(v);
          if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
          return s;
        };

        const header = [
          "payment_id",
          "paid_at",
          "due_date",
          "tenant_name",
          "tenant_email",
          "rent_amount_cents",
          "amount_paid_cents",
          "service_fee_amount_cents",
          "service_fee_payer",
          "platform_fee_cents",
          "stripe_payment_intent_id",
          "landlord_id",
          "landlord_email",
          "landlord_name",
        ].join(",");

        const lines = (rowsResult.rows as Record<string, unknown>[]).map((r) =>
          [
            r.id,
            r.paid_at instanceof Date
              ? r.paid_at.toISOString()
              : r.paid_at,
            r.due_date,
            r.tenant_name,
            r.tenant_email,
            r.amount,
            r.amount_paid,
            r.service_fee_amount,
            r.service_fee_payer,
            r.platform_fee_amount,
            r.stripe_payment_intent_id,
            r.landlord_id,
            r.landlord_email,
            [r.landlord_first_name, r.landlord_last_name]
              .filter(Boolean)
              .join(" "),
          ]
            .map(escape)
            .join(",")
        );

        const csv = [header, ...lines].join("\n");
        const filename = `leaseshield-platform-fees-${new Date()
          .toISOString()
          .split("T")[0]}.csv`;
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filename}"`
        );
        res.send(csv);
      } catch (error) {
        console.error("Error exporting platform fees CSV:", error);
        res.status(500).json({ message: "Failed to export platform fees" });
      }
    }
  );
}
