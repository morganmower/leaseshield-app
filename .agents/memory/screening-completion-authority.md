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

## Webhook body transport (critical invariant)
The DigitalDelve webhook routes use a catch-all text body parser
(`express.text({ type: [..., '*/*'] })` in `server/index.ts`), so `req.body` for these
routes is ALWAYS a raw string — never a parsed object. Therefore the result-webhook XML
extractor MUST handle string bodies in every shape: raw XML (the observed real Western
Verify transport — literal `<`, indented), form-urlencoded-as-text (`request=<urlencoded
xml>`, decode via `URLSearchParams`), and whole-body URL-encoded. Relying on
`req.body.request` as an object is dead code under this parser and silently drops results.
**Why:** a dropped result webhook = order never completes = the exact client-facing failure.
Verified against live WV: completion arrives as raw XML; the form path is defensive.

Also: `verifyWebhookToken` fails CLOSED in production when `DIGITAL_DELVE_WEBHOOK_SECRET`
is unset (returns false); dev stays open for local testing. Don't revert to fail-open.
