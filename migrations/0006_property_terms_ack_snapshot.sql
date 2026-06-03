-- Adds a per-applicant snapshot of the property terms acknowledged at the time
-- the application was started. Property terms read live on the apply page, so a
-- landlord can change them after an applicant began. This snapshot lets us detect
-- drift and require re-acknowledgment of the updated terms before submission.
-- Idempotent so repeat runs and environments where the column was added manually
-- (via psql ALTER) succeed without error.
ALTER TABLE "rental_submission_people"
  ADD COLUMN IF NOT EXISTS "property_terms_ack_snapshot_json" jsonb;
