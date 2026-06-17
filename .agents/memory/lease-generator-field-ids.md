---
name: Lease generator field-ID coupling
description: Why leaseAgreementGenerator must accept multiple field-ID aliases per concept
---

Lease templates store their own input field IDs in `templates.fillable_form_data`
(wizard flow), and these IDs are NOT standardized across states. e.g. the
Michigan lease template uses `maxDeposit` (security deposit) and `lateFeeDays`
(grace period), while older templates use `securityDeposit` and
`lateFeeGracePeriod`.

**Rule:** `server/utils/leaseAgreementGenerator.ts` must read each such concept
through `getFieldValueAny(fieldValues, [aliases...])`, listing every template's
field ID for that concept. Apply the fix in BOTH builders — the DOCX path
(`docx` lib) and the PDF path (`generateLeaseHTMLForPdf`).

**Why:** If the generator reads only one ID, a user's entered value silently
falls back to a hardcoded default (grace days) or a blank placeholder (deposit)
with no error — a landlord reported exactly this. Keep legacy IDs in the alias
list so other templates don't regress.

**How to apply:** When adding/editing a lease template's fillable_form_data,
diff its field IDs against the keys the generator reads. Rent due day is rendered
as an English ordinal via `ordinalDay()` ("1" -> "1st"); reuse it for any new
day-of-month output. Note: `depositReturnDeadline` entered in the MI wizard is
intentionally ignored — deposit return days come from the state clause cache
(state-mandated), not user input.
