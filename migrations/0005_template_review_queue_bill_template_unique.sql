-- Add partial unique index on template_review_queue (bill_id, template_id)
-- to make the approval insert path safely idempotent under concurrency.
-- Required by the ON CONFLICT (bill_id, template_id) DO NOTHING used in
-- server/legislativeApprovalService.ts approveBill().
--
-- Partial because bill_id is nullable for queue rows that come from the
-- normalized_updates ingestion path instead of from a bill approval.
CREATE UNIQUE INDEX IF NOT EXISTS idx_template_review_queue_bill_template
  ON template_review_queue (bill_id, template_id)
  WHERE bill_id IS NOT NULL;
