-- =============================================================================
-- Fix: Legislative review queue cross-state fanout
-- Date: 2026-05-07
-- =============================================================================
--
-- PROBLEM
-- -------
-- Every state-level legislative bill (e.g. a North Carolina bill) was being
-- queued against every state's templates (UT, TX, CA, etc.) because:
--   1. All template_topic_routing rows had jurisdiction_state = NULL
--   2. The filter in queueFromLatestIngest only rejected mismatches when
--      BOTH sides had a state set; NULL on either side bypassed the filter
--
-- Result: 36 distinct bills × 116 matching templates = 4,176 pending entries.
--
-- FIX (CODE)
-- ----------
-- Two filter functions were tightened so that a state-scoped bill no longer
-- matches routing rules that have no state set:
--   - server/legislativeMonitoringService.ts queueFromLatestIngest()
--   - server/legislation/publishService.ts getAffectedTemplates()
--
-- FIX (DATA - this file)
-- ----------------------
-- 1. Backfill jurisdiction_state on state-level routing rules so they
--    correctly reflect the template's own state.
-- 2. Reject the existing 4,176 pending queue entries that are cross-state
--    mismatches. Federal-level bills are preserved.
--
-- HOW TO RUN
-- ----------
-- Run each statement individually in the Database pane (Production toggle).
-- The driver throws "Invalid response" on multi-statement batches.
-- Run them in this order, checking the row counts as you go.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- STEP 1 (preview, read-only): show which routing rules will be backfilled.
-- Expect ~212 rows.
-- -----------------------------------------------------------------------------
SELECT r.id, r.template_id, r.topic, r.jurisdiction_level,
       r.jurisdiction_state AS current_state, t.state_id AS new_state
FROM template_topic_routing r
JOIN templates t ON r.template_id = t.id
WHERE r.is_active = true
  AND r.jurisdiction_state IS NULL
  AND r.jurisdiction_level = 'state'
ORDER BY t.state_id, r.topic
LIMIT 50;


-- -----------------------------------------------------------------------------
-- STEP 2 (write): backfill jurisdiction_state from the template's state_id
-- for every active state-level routing rule that currently has NULL state.
-- Federal-level rules (if any) are intentionally left with NULL state so
-- federal bills continue to fan out across all 16 states.
-- -----------------------------------------------------------------------------
UPDATE template_topic_routing AS r
SET jurisdiction_state = t.state_id
FROM templates t
WHERE r.template_id = t.id
  AND r.is_active = true
  AND r.jurisdiction_state IS NULL
  AND r.jurisdiction_level = 'state'
  AND t.state_id IS NOT NULL;


-- -----------------------------------------------------------------------------
-- STEP 3 (preview, read-only): show which pending queue entries will be
-- auto-rejected because the bill's state doesn't match the template's state.
-- Federal bills (jurisdiction_state IS NULL) are kept.
-- -----------------------------------------------------------------------------
SELECT COUNT(*) AS will_reject
FROM template_review_queue q
JOIN normalized_updates nu ON q.normalized_update_id = nu.id
JOIN templates t ON q.template_id = t.id
WHERE q.status = 'pending'
  AND nu.jurisdiction_state IS NOT NULL
  AND nu.jurisdiction_state <> t.state_id;


-- -----------------------------------------------------------------------------
-- STEP 4 (write): auto-reject the cross-state mismatches.
-- Uses status='rejected' (not DELETE) so admins retain history.
-- -----------------------------------------------------------------------------
UPDATE template_review_queue q
SET status = 'rejected',
    rejected_at = NOW(),
    approval_notes = 'Auto-rejected 2026-05-07: cross-state topic match (bill jurisdiction does not match template jurisdiction)',
    updated_at = NOW()
FROM normalized_updates nu, templates t
WHERE q.normalized_update_id = nu.id
  AND q.template_id = t.id
  AND q.status = 'pending'
  AND nu.jurisdiction_state IS NOT NULL
  AND nu.jurisdiction_state <> t.state_id;


-- -----------------------------------------------------------------------------
-- STEP 5 (read-only): verify the remaining pending queue.
-- Expect: only entries where bill is federal (jurisdiction_state NULL) OR
-- the bill's state matches the template's state.
-- -----------------------------------------------------------------------------
SELECT
  COUNT(*) AS remaining_pending,
  COUNT(*) FILTER (WHERE nu.jurisdiction_state IS NULL) AS federal,
  COUNT(*) FILTER (WHERE nu.jurisdiction_state = t.state_id) AS in_state,
  COUNT(DISTINCT q.normalized_update_id) AS distinct_bills
FROM template_review_queue q
JOIN normalized_updates nu ON q.normalized_update_id = nu.id
JOIN templates t ON q.template_id = t.id
WHERE q.status = 'pending';
