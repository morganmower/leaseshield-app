-- Adds the state_clause_values table that powers the state-mandated clause
-- framework (late fee caps, deposit caps, notice periods) read by the lease
-- generator at render time and edited from the admin Legislative Monitoring
-- "Clause Values" tab.
-- Idempotent so environments where the table was added manually
-- (via direct SQL push during development) succeed without error.

CREATE TABLE IF NOT EXISTS "state_clause_values" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "state_id" varchar(2) NOT NULL,
  "clause_key" varchar(64) NOT NULL,
  "value_numeric" double precision,
  "value_text" text,
  "unit" varchar(32),
  "statute_citation" text,
  "effective_date" timestamp,
  "source_bill_id" varchar,
  "needs_review" boolean DEFAULT false,
  "notes" text,
  "updated_by" varchar,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_state_clause_unique"
  ON "state_clause_values" ("state_id", "clause_key");

CREATE INDEX IF NOT EXISTS "idx_state_clause_state"
  ON "state_clause_values" ("state_id");
