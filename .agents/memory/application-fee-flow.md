---
name: Application fee flow
description: How the one-click "Charge application fee" reuses rent-payment infra and why it copies a link instead of auto-emailing.
---

# Application fee flow

The Application Inbox "Charge fee" button reuses the rent-payment request infra; the
record is distinguished only by `request_type` ('application_fee' vs 'rent'). The
public pay page branches on that field for title/line-item and to hide the due date.

**Why no auto-email:** the existing `POST /api/rent-payments/:id/send-reminder`
email template is rent-flavored ("rent reminder", due date, late fee). Sending it for
an application fee would mislabel the message. The flow intentionally creates the
request and surfaces a copy-able payment link (with inline instructions) instead of
auto-sending, to avoid wrong-content emails. If application-fee email is wanted later,
add a dedicated template — do not reuse the rent reminder.

**Stripe setup dead-end fix:** `/api/stripe-connect/onboard` accepts an optional
`returnTo` relative path (guarded: must start with "/" and not "//") so a landlord who
sets up Stripe mid-charge lands back on the inbox; the page reopens the dialog via a
`?chargeFee=<personId>` query param.

**How to apply:** any new payment-request "type" must thread through three places in
lockstep — the create endpoint (accept `requestType`), the public GET (return it), and
`pay-rent.tsx` (render it) — or the applicant sees the wrong labels.
