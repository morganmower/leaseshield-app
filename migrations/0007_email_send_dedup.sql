-- Atomic dedup guard for scheduled emails (biweekly landlord tips and the
-- legislative digest). The app runs an in-process scheduler; on an autoscale
-- deployment multiple server instances each run it, and an instance can also be
-- torn down mid-send. The old guard (SELECT analytics_events -> send -> INSERT)
-- was not atomic, so the same email could be sent more than once.
--
-- A row is "claimed" via INSERT ... ON CONFLICT DO NOTHING before the email is
-- sent; the unique (user_id, dedup_key) index makes the claim atomic so only one
-- run can win and send. Idempotent so repeat runs and environments where the
-- table was created manually succeed without error.
CREATE TABLE IF NOT EXISTS "email_send_dedup" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL,
  "dedup_key" varchar(100) NOT NULL,
  "sent_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_email_send_dedup_unique"
  ON "email_send_dedup" ("user_id", "dedup_key");
