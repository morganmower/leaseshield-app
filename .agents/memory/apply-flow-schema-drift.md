---
name: Apply flow 500 = schema drift (terms-ack column)
description: When the apply/submission flow 500s with "column does not exist", it's DB schema drift, not apply-link logic
---

Symptom: landlord's submissions view 500s and applicants "can't open/use the apply
link." Logs show `column "X" does not exist` inside `getRentalSubmissionPeople`
(a `SELECT *`) or on `createRentalSubmissionPerson` (insert).

Root cause pattern: a column declared in `shared/schema.ts` (e.g. the terms-drift
re-ack `property_terms_ack_snapshot_json` on `rental_submission_people`) was never
applied to the database. `GET /api/apply/:token` does NOT touch `rental_submission_people`,
so the applicant can load the page — the failure only hits on **start/submit** and on
the landlord submissions list. That mismatch makes it look like a link problem.

**Why:** schema changes only reach a DB at two points — post-merge (`db:push` → dev)
and Publish (diff dev→prod). If a feature merged without those running, the column is
absent in dev AND prod.

**How to apply / fix:**
1. Confirm with an `information_schema.columns` diff of prod vs dev for the apply tables
   (`rental_submissions`, `rental_submission_people`, `rental_application_links`).
2. Apply to **dev**: `npm run db:push`. NOTE: drizzle-kit push is an interactive TUI —
   `--force` does NOT suppress the "add unique constraint / truncate?" prompt, and piping
   stdin does NOT work (needs a real TTY). For a purely additive nullable column, the safe
   equivalent fallback is `executeSql({environment:"development"})` with
   `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` — identical result, no prompt.
3. Verify dev: restart workflow, confirm no `errorMissingColumn` in logs.
4. **Production is fixed by RE-PUBLISH only** — Replit's publish flow diffs dev→prod and
   adds the column. Never script a prod migration, deploy-build hook, or startup DDL
   (see database-migrations-on-publish reference).

Side note: `rental_application_links` per-link `expires_at` can be set to same-day
(created and expires the same calendar day = ~hours of validity) — a foot-gun that yields
410 "expired" surprisingly fast.
