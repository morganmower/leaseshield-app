-- Database Performance Optimization Migration
-- This migration adds indexes to improve query performance
-- All indexes are created CONCURRENTLY to avoid locking tables
-- Safe to run on production database with active users

-- IMPORTANT: Run this during low-traffic hours for best performance
-- Each index creation is independent and can be rolled back individually

-- Users table indexes (for subscription and state filtering)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_subscription_status 
ON users(subscription_status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_preferred_state 
ON users(preferred_state);

-- Templates table indexes (for state and category filtering)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_templates_state_id 
ON templates(state_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_templates_is_active 
ON templates(is_active);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_templates_category 
ON templates(category);

-- Compliance cards indexes (for state filtering)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_compliance_cards_state_id 
ON compliance_cards(state_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_compliance_cards_is_active 
ON compliance_cards(is_active);

-- Legal updates indexes (for state filtering and date sorting)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_legal_updates_state_id 
ON legal_updates(state_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_legal_updates_created_at 
ON legal_updates(created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_legal_updates_is_active 
ON legal_updates(is_active);

-- User notifications indexes (for user queries and read status)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_notifications_user_id 
ON user_notifications(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_notifications_is_read 
ON user_notifications(is_read);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_notifications_created_at 
ON user_notifications(created_at DESC);

-- Properties indexes (for user property queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_properties_user_id 
ON properties(user_id);

-- Saved documents indexes (for user document queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_saved_documents_user_id 
ON saved_documents(user_id);

-- Legislative monitoring indexes (for state and review filtering)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_legislative_monitoring_state_id 
ON legislative_monitoring(state_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_legislative_monitoring_is_reviewed 
ON legislative_monitoring(is_reviewed);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_legislative_monitoring_relevance_level 
ON legislative_monitoring(relevance_level);

-- Verify indexes were created
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

