-- Rollback script for performance indexes
-- Use this ONLY if you need to remove the indexes
-- Dropping indexes is safe and won't affect data

-- Users table indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_users_subscription_status;
DROP INDEX CONCURRENTLY IF EXISTS idx_users_preferred_state;

-- Templates table indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_templates_state_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_templates_is_active;
DROP INDEX CONCURRENTLY IF EXISTS idx_templates_category;

-- Compliance cards indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_compliance_cards_state_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_compliance_cards_is_active;

-- Legal updates indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_legal_updates_state_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_legal_updates_created_at;
DROP INDEX CONCURRENTLY IF EXISTS idx_legal_updates_is_active;

-- User notifications indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_user_notifications_user_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_user_notifications_is_read;
DROP INDEX CONCURRENTLY IF EXISTS idx_user_notifications_created_at;

-- Properties indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_properties_user_id;

-- Saved documents indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_saved_documents_user_id;

-- Legislative monitoring indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_legislative_monitoring_state_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_legislative_monitoring_is_reviewed;
DROP INDEX CONCURRENTLY IF EXISTS idx_legislative_monitoring_relevance_level;

-- Verify indexes were removed
SELECT 
    schemaname,
    tablename,
    indexname
FROM pg_indexes
WHERE schemaname = 'public'
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

