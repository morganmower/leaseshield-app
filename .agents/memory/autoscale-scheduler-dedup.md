---
name: Autoscale in-process schedulers double-send
description: Why scheduled emails/jobs duplicate on autoscale and how to guard them atomically.
---

# In-process schedulers on autoscale double-fire

The app runs its job scheduler **inside the web server process** (setInterval +
a startup setTimeout). On an **autoscale** deployment (`.replit`
deploymentTarget="autoscale") every server instance runs its own scheduler, and
instances are spun up/town down on demand. So a scheduled job can run on two
instances at once, and an instance can be killed mid-job.

**Symptom seen:** a biweekly tip email was delivered twice but only one
`analytics_events` "sent" row existed — fingerprint of one instance sending then
being torn down before it wrote its tracking row, while another instance also
sent.

**Rule:** never dedup a scheduled side effect with a non-atomic
`SELECT-exists -> do-thing -> INSERT-marker` sequence. Two runs can both pass the
SELECT before either writes the marker.

**How to apply:** claim atomically at the DB level *before* the side effect.
Pattern used here: a dedicated `email_send_dedup` table with
`UNIQUE(user_id, dedup_key)`; `storage.claimEmailSend()` does
`INSERT ... ON CONFLICT DO NOTHING RETURNING` and only the caller that inserted a
row proceeds to send. On a known send failure, `releaseEmailSend()` deletes the
claim so a later run retries. This is **at-most-once** (a crash after claim but
before send loses that one email) — the right tradeoff for tips/digests where a
duplicate is the real harm.

**Why:** this fix targets duplicate emails (the user complaint). The structural
alternative — move scheduled jobs to a single always-on **Reserved VM**
deployment — removes the multi-instance racing at the source but is the user's
billing/deployment decision.
