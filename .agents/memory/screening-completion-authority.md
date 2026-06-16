---
name: Screening completion authority (Western Verify / DigitalDelve)
description: What is allowed to mark a tenant-screening order "complete" and why SSO redirect URLs must never do it.
---

# Screening completion authority

A `rental_screening_orders` row may be flipped to `status='complete'` ONLY by the
Western Verify RESULT webhook (`ResultPostURL` -> `handleResultWebhook` in
`server/digitalDelveService.ts`), which also always writes `rawResultXml`.

**Must NOT mark complete:**
- `syncScreeningStatus` (the SSO poll / "Sync status" button). Western Verify's
  SSO endpoint returns a portal landing URL (e.g. `ordersystem/default.cfm?param=…`)
  even for orders that only have an invitation sent. Treating any non-`report_lookup.cfm`
  redirect as "report ready" produced false "Screening Complete" states in production.
  This function now only updates `lastStatusCheckAt`.
- `handleStatusWebhook` (the `StatusPostURL` webhook) carries intermediate progress
  only; it is mapped to `sent`/`in_progress`/`error` and can never set `complete`.

**Why:** SSO redirect URLs are NOT reliable completion indicators (documented in
`server/screeningPoller.ts`). A real report is evidenced by `rawResultXml` being set.

**How to apply:** When touching screening status flow, keep webhook-as-sole-completion-authority.
The only intentional non-webhook completion is the explicit landlord "Mark complete"
button (`/mark-complete`), which is gated behind a confirm dialog and shown only for
`sent`/`in_progress`. Note: manual mark-complete leaves `rawResultXml` NULL, so
`rawResultXml IS NULL` on a `complete` row means "not completed by a real WV result"
(either the old SSO bug or a manual override) — useful if building a recovery/reset path.
