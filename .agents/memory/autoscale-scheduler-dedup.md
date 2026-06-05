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

## Deploy-rollover duplicates are a separate, expected transition artifact

Even after the atomic-claim fix shipped, one more duplicate digest happened
*during the deploy itself*: a draining **old-code** instance sent a batch
(leaving NO row in `email_send_dedup` and no analytics row — old code used a
different store and/or was SIGTERM'd mid-run), while the newly-deployed
**new-code** instance ran the same job minutes later, found no claim, and sent
again. Old and new code dedup against **different stores**, so they cannot see
each other's sends — exactly one duplicate per send that straddles the rollover.

**How to recognize:** in prod, the recorded run (analytics + `email_send_dedup`)
shows exactly one send per user (new code is fine); the duplicate batch appears
only in deployment logs with zero DB trace. Same recipients, ~minutes apart.

**Conclusion:** this is a one-time transition cost, NOT a regression of the
fix. It recurs only if a future deploy rolls over while a scheduled job is
firing. The only way to eliminate it entirely is the Reserved VM single-instance
scheduler above (user's call).
