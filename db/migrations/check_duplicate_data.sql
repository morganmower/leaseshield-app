-- Script to check for duplicate data in the database
-- Run this to identify any duplicate records that can be safely cleaned
-- This is READ-ONLY and won't modify any data

-- Check for duplicate users by email
SELECT 
    email,
    COUNT(*) as count,
    array_agg(id) as user_ids
FROM users
WHERE email IS NOT NULL
GROUP BY email
HAVING COUNT(*) > 1;

-- Check for duplicate templates (same title, state, and type)
SELECT 
    title,
    state_id,
    template_type,
    COUNT(*) as count,
    array_agg(id) as template_ids
FROM templates
GROUP BY title, state_id, template_type
HAVING COUNT(*) > 1;

-- Check for duplicate compliance cards (same title and state)
SELECT 
    title,
    state_id,
    COUNT(*) as count,
    array_agg(id) as card_ids
FROM compliance_cards
GROUP BY title, state_id
HAVING COUNT(*) > 1;

-- Check for duplicate legal updates (same title and state)
SELECT 
    title,
    state_id,
    COUNT(*) as count,
    array_agg(id) as update_ids
FROM legal_updates
GROUP BY title, state_id
HAVING COUNT(*) > 1;

-- Check for duplicate blog posts by slug (should be unique)
SELECT 
    slug,
    COUNT(*) as count,
    array_agg(id) as post_ids
FROM blog_posts
GROUP BY slug
HAVING COUNT(*) > 1;

-- Check for duplicate legislative monitoring bills (should be unique by bill_id)
SELECT 
    bill_id,
    COUNT(*) as count,
    array_agg(id) as monitoring_ids
FROM legislative_monitoring
GROUP BY bill_id
HAVING COUNT(*) > 1;

-- Check for duplicate screening content by slug (should be unique)
SELECT 
    slug,
    COUNT(*) as count,
    array_agg(id) as content_ids
FROM screening_content
GROUP BY slug
HAVING COUNT(*) > 1;

-- Check for duplicate tenant issue workflows by slug (should be unique)
SELECT 
    slug,
    COUNT(*) as count,
    array_agg(id) as workflow_ids
FROM tenant_issue_workflows
GROUP BY slug
HAVING COUNT(*) > 1;

-- Check for duplicate properties (same address for same user)
SELECT 
    user_id,
    address,
    COUNT(*) as count,
    array_agg(id) as property_ids
FROM properties
GROUP BY user_id, address
HAVING COUNT(*) > 1;

-- Summary: Count total records in each table
SELECT 'users' as table_name, COUNT(*) as total_records FROM users
UNION ALL
SELECT 'templates', COUNT(*) FROM templates
UNION ALL
SELECT 'compliance_cards', COUNT(*) FROM compliance_cards
UNION ALL
SELECT 'legal_updates', COUNT(*) FROM legal_updates
UNION ALL
SELECT 'user_notifications', COUNT(*) FROM user_notifications
UNION ALL
SELECT 'blog_posts', COUNT(*) FROM blog_posts
UNION ALL
SELECT 'legislative_monitoring', COUNT(*) FROM legislative_monitoring
UNION ALL
SELECT 'properties', COUNT(*) FROM properties
UNION ALL
SELECT 'saved_documents', COUNT(*) FROM saved_documents
UNION ALL
SELECT 'screening_content', COUNT(*) FROM screening_content
UNION ALL
SELECT 'tenant_issue_workflows', COUNT(*) FROM tenant_issue_workflows
ORDER BY table_name;

