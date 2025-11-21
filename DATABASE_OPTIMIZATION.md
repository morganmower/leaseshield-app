# Database Optimization Guide

This document outlines recommended database indexes and optimization strategies for LeaseShield App.

## Recommended Indexes

### Users Table
```sql
-- Index on email for login lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Index on stripe_customer_id for webhook lookups
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id);

-- Index on subscription_status for filtering active users
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status);

-- Index on preferred_state for state-based queries
CREATE INDEX IF NOT EXISTS idx_users_preferred_state ON users(preferred_state);

-- Index on trial_ends_at for scheduled job queries
CREATE INDEX IF NOT EXISTS idx_users_trial_ends_at ON users(trial_ends_at) WHERE trial_ends_at IS NOT NULL;
```

### Templates Table
```sql
-- Composite index for common filter queries
CREATE INDEX IF NOT EXISTS idx_templates_state_category_active 
ON templates(state_id, category, is_active);

-- Index on sort_order for ordering
CREATE INDEX IF NOT EXISTS idx_templates_sort_order ON templates(sort_order);
```

### Compliance Cards Table
```sql
-- Composite index for state-based queries
CREATE INDEX IF NOT EXISTS idx_compliance_cards_state_active 
ON compliance_cards(state_id, is_active);

-- Index on category for filtering
CREATE INDEX IF NOT EXISTS idx_compliance_cards_category ON compliance_cards(category);
```

### Legal Updates Table
```sql
-- Composite index for state-based queries with active filter
CREATE INDEX IF NOT EXISTS idx_legal_updates_state_active 
ON legal_updates(state_id, is_active, created_at DESC);

-- Index on effective_date for sorting
CREATE INDEX IF NOT EXISTS idx_legal_updates_effective_date 
ON legal_updates(effective_date DESC);

-- Index on impact_level for filtering high-priority updates
CREATE INDEX IF NOT EXISTS idx_legal_updates_impact_level ON legal_updates(impact_level);
```

### User Notifications Table
```sql
-- Composite index for user notification queries
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_read 
ON user_notifications(user_id, is_read, created_at DESC);
```

### Analytics Events Table
```sql
-- Composite index for user event queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_type 
ON analytics_events(user_id, event_type, created_at DESC);

-- Index on created_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at 
ON analytics_events(created_at DESC);
```

### Legislative Monitoring Table
```sql
-- Index on bill_id for lookups
CREATE INDEX IF NOT EXISTS idx_legislative_monitoring_bill_id 
ON legislative_monitoring(bill_id);

-- Composite index for filtering
CREATE INDEX IF NOT EXISTS idx_legislative_monitoring_state_relevance 
ON legislative_monitoring(state_id, relevance_level, is_reviewed);
```

### Properties Table
```sql
-- Index on user_id for user property queries
CREATE INDEX IF NOT EXISTS idx_properties_user_id ON properties(user_id);

-- Index on state for state-based queries
CREATE INDEX IF NOT EXISTS idx_properties_state ON properties(state);
```

### Saved Documents Table
```sql
-- Index on user_id for user document queries
CREATE INDEX IF NOT EXISTS idx_saved_documents_user_id ON saved_documents(user_id);

-- Index on property_id for property-based queries
CREATE INDEX IF NOT EXISTS idx_saved_documents_property_id 
ON saved_documents(property_id) WHERE property_id IS NOT NULL;

-- Index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_saved_documents_created_at 
ON saved_documents(created_at DESC);
```

### Blog Posts Table
```sql
-- Composite index for published posts
CREATE INDEX IF NOT EXISTS idx_blog_posts_published 
ON blog_posts(is_published, published_at DESC) WHERE is_published = true;

-- Index on slug for lookups
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
```

## Query Optimization Tips

### 1. Use Prepared Statements
Drizzle ORM automatically uses prepared statements, which improves performance and security.

### 2. Limit Result Sets
Always use `.limit()` when fetching lists to prevent loading too much data:
```typescript
await db.select().from(templates).limit(100);
```

### 3. Select Only Needed Columns
Instead of `select()`, specify only the columns you need:
```typescript
await db.select({ id: users.id, email: users.email }).from(users);
```

### 4. Use Transactions for Multiple Operations
```typescript
await db.transaction(async (tx) => {
  await tx.insert(users).values(userData);
  await tx.insert(properties).values(propertyData);
});
```

### 5. Batch Operations
Use batch inserts instead of multiple single inserts:
```typescript
await db.insert(notifications).values([notification1, notification2, notification3]);
```

## Connection Pool Configuration

Current configuration in `server/db.ts`:
- Max connections: 20
- Idle timeout: 30 seconds
- Connection timeout: 10 seconds

Adjust these based on your application load and database limits.

## Monitoring

### Key Metrics to Monitor
1. Query execution time
2. Connection pool utilization
3. Slow query log
4. Database CPU and memory usage
5. Number of active connections

### Logging Slow Queries
Add query logging in development:
```typescript
// In db.ts
export const db = drizzle({ 
  client: pool, 
  schema,
  logger: process.env.NODE_ENV === 'development'
});
```

## Caching Strategy

### Application-Level Caching
- Cache frequently accessed, rarely changing data (states, templates)
- Use in-memory cache with TTL
- Invalidate cache on updates

### Query Result Caching
Implement caching for:
- State list (rarely changes)
- Template categories (static)
- Compliance cards (changes infrequently)

See `server/utils/cache.ts` for implementation.

