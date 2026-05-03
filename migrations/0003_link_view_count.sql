-- Adds per-link view tracking for application analytics.
-- Idempotent so repeat runs and environments where the column was added
-- manually (via psql ALTER) succeed without error.
ALTER TABLE "rental_application_links"
  ADD COLUMN IF NOT EXISTS "view_count" integer NOT NULL DEFAULT 0;
