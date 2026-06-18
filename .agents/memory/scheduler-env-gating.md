---
name: Scheduler customer-job env gating
description: Why customer-facing scheduled jobs (emails/payments) must run only in production, not the dev workspace.
---

# Customer-facing scheduled jobs must be production-only

Any scheduled/polled job that sends real customer emails (Resend) or moves real
money (Stripe) must be gated behind `isProduction()` (`server/utils/env.ts`,
keyed on `NODE_ENV`). The dev workspace and the deployed production app both run
the same startup code, share the same Resend/Stripe credentials, but use
**separate Neon databases each with their own dedup/idempotency tables**.

**Why:** A landlord received two identical biweekly "landlord tip" emails ~1.5h
apart. The per-DB dedup (unique `(user_id, dedup_key)` on `email_send_dedup`) is
airtight *within one database*, but cannot dedup across environments. The same
opted-in user existed in both the dev and prod DBs, so each environment sent the
tip once. Dev should never send real customer emails at all.

**How to apply:** When adding or reviewing a recurring job, classify it:
- Customer-facing (emails to landlords/tenants, Stripe charges/debits) → wrap
  the scheduling in `if (isProduction())`. This covers lifecycle emails, email
  sequences, renewal reminders, biweekly tips, legislative digest, rent
  reminders/late-fees, recurring rent debits, and screening-completion
  notification retries.
- Internal maintenance (ingest, cleanup, db backup, publish, auto-archive,
  case-law refresh, SSO URL refresh) → safe to run in every environment.
Watch for mixed jobs (e.g. the screening poller does internal SSO refresh AND
customer notification retries) — gate only the customer-email portion.
