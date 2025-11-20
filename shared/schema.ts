import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  // Subscription fields
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  subscriptionStatus: varchar("subscription_status"), // 'trialing', 'active', 'canceled', 'past_due'
  trialEndsAt: timestamp("trial_ends_at"),
  subscriptionEndsAt: timestamp("subscription_ends_at"),
  // User preferences
  preferredState: varchar("preferred_state", { length: 2 }), // UT, TX, ND, SD
  hasCompletedOnboarding: boolean("has_completed_onboarding").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// States supported by the platform
export const states = pgTable("states", {
  id: varchar("id", { length: 2 }).primaryKey(), // UT, TX, ND, SD
  name: text("name").notNull(), // Utah, Texas, etc.
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertStateSchema = createInsertSchema(states).omit({
  createdAt: true,
});
export type InsertState = z.infer<typeof insertStateSchema>;
export type State = typeof states.$inferSelect;

// Template categories
export const categoryEnum = pgEnum('category', [
  'leasing',
  'screening',
  'compliance',
  'tenant_issues',
  'notices',
  'move_in_out',
]);

export const templateTypeEnum = pgEnum('template_type', [
  'lease',
  'application',
  'adverse_action',
  'late_rent_notice',
  'lease_violation_notice',
  'non_renewal_notice',
  'rent_increase_notice',
  'move_in_checklist',
  'move_out_checklist',
  'esa_documentation',
  'property_damage_form',
  'partial_payment_form',
  'tenant_complaint_form',
  'eviction_notice',
  'security_deposit_return',
]);

// Templates library
export const templates = pgTable("templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: categoryEnum("category").notNull(),
  templateType: templateTypeEnum("template_type").notNull(),
  stateId: varchar("state_id", { length: 2 }).notNull(),
  // File storage - could be URLs or file paths
  pdfUrl: text("pdf_url"),
  fillableFormData: jsonb("fillable_form_data"), // JSON structure for fillable fields
  // Metadata
  version: integer("version").default(1),
  versionNotes: text("version_notes"), // What changed in this version
  lastUpdateReason: text("last_update_reason"), // Why was this updated
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const templatesRelations = relations(templates, ({ one }) => ({
  state: one(states, {
    fields: [templates.stateId],
    references: [states.id],
  }),
}));

export const insertTemplateSchema = createInsertSchema(templates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTemplate = z.infer<typeof insertTemplateSchema>;
export type Template = typeof templates.$inferSelect;

// Compliance cards and legal updates
export const complianceCards = pgTable("compliance_cards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stateId: varchar("state_id", { length: 2 }).notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  category: text("category").notNull(), // 'disclosures', 'screening', 'eviction', 'general'
  content: jsonb("content").notNull(), // Rich content structure
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const complianceCardsRelations = relations(complianceCards, ({ one }) => ({
  state: one(states, {
    fields: [complianceCards.stateId],
    references: [states.id],
  }),
}));

export const insertComplianceCardSchema = createInsertSchema(complianceCards).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertComplianceCard = z.infer<typeof insertComplianceCardSchema>;
export type ComplianceCard = typeof complianceCards.$inferSelect;

// Legal updates tracking
export const legalUpdates = pgTable("legal_updates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stateId: varchar("state_id", { length: 2 }).notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  whyItMatters: text("why_it_matters").notNull(),
  beforeText: text("before_text"),
  afterText: text("after_text"),
  effectiveDate: timestamp("effective_date"),
  impactLevel: varchar("impact_level", { length: 20 }).notNull(), // 'high', 'medium', 'low'
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const legalUpdatesRelations = relations(legalUpdates, ({ one }) => ({
  state: one(states, {
    fields: [legalUpdates.stateId],
    references: [states.id],
  }),
}));

export const insertLegalUpdateSchema = createInsertSchema(legalUpdates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertLegalUpdate = z.infer<typeof insertLegalUpdateSchema>;
export type LegalUpdate = typeof legalUpdates.$inferSelect;

// User notifications for legal updates
export const userNotifications = pgTable("user_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  legalUpdateId: varchar("legal_update_id").notNull(),
  isRead: boolean("is_read").default(false),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userNotificationsRelations = relations(userNotifications, ({ one }) => ({
  user: one(users, {
    fields: [userNotifications.userId],
    references: [users.id],
  }),
  legalUpdate: one(legalUpdates, {
    fields: [userNotifications.legalUpdateId],
    references: [legalUpdates.id],
  }),
}));

export const insertUserNotificationSchema = createInsertSchema(userNotifications).omit({
  id: true,
  createdAt: true,
});
export type InsertUserNotification = z.infer<typeof insertUserNotificationSchema>;
export type UserNotification = typeof userNotifications.$inferSelect;

// Analytics events for tracking
export const analyticsEvents = pgTable("analytics_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  eventType: varchar("event_type", { length: 50 }).notNull(), // 'template_download', 'western_verify_click', etc.
  eventData: jsonb("event_data"), // Additional context
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAnalyticsEventSchema = createInsertSchema(analyticsEvents).omit({
  id: true,
  createdAt: true,
});
export type InsertAnalyticsEvent = z.infer<typeof insertAnalyticsEventSchema>;
export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;

// Screening toolkit content
export const screeningContent = pgTable("screening_content", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  title: text("title").notNull(),
  category: varchar("category", { length: 50 }).notNull(), // 'credit', 'criminal', 'eviction', 'general'
  content: jsonb("content").notNull(), // Rich content structure
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertScreeningContentSchema = createInsertSchema(screeningContent).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertScreeningContent = z.infer<typeof insertScreeningContentSchema>;
export type ScreeningContent = typeof screeningContent.$inferSelect;

// Tenant issue workflows
export const tenantIssueWorkflows = pgTable("tenant_issue_workflows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: varchar("category", { length: 50 }).notNull(), // 'late_rent', 'violations', 'damage', etc.
  steps: jsonb("steps").notNull(), // Array of workflow steps
  relatedTemplateIds: jsonb("related_template_ids"), // Array of template IDs
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTenantIssueWorkflowSchema = createInsertSchema(tenantIssueWorkflows).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTenantIssueWorkflow = z.infer<typeof insertTenantIssueWorkflowSchema>;
export type TenantIssueWorkflow = typeof tenantIssueWorkflows.$inferSelect;

// Blog posts for SEO and landlord education
export const blogPosts = pgTable("blog_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  slug: varchar("slug", { length: 200 }).notNull().unique(),
  excerpt: text("excerpt").notNull(),
  content: text("content").notNull(), // Markdown or HTML
  author: varchar("author", { length: 100 }).notNull().default('LeaseShield Team'),
  featuredImageUrl: text("featured_image_url"),
  // SEO fields
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
  // Categorization
  stateIds: text("state_ids").array(), // ['UT', 'TX'] - null means applies to all states
  tags: text("tags").array(), // ['eviction', 'compliance', 'screening']
  // Publishing
  isPublished: boolean("is_published").default(false),
  publishedAt: timestamp("published_at"),
  // Metadata
  viewCount: integer("view_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertBlogPostSchema = createInsertSchema(blogPosts).omit({
  id: true,
  viewCount: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertBlogPost = z.infer<typeof insertBlogPostSchema>;
export type BlogPost = typeof blogPosts.$inferSelect;

// Legislative Monitoring - tracks bills from LegiScan API
export const billStatusEnum = pgEnum('bill_status', [
  'introduced',
  'in_committee',
  'passed_chamber',
  'passed_both',
  'signed',
  'vetoed',
  'dead',
]);

export const relevanceEnum = pgEnum('relevance_level', [
  'high',      // Definitely affects templates
  'medium',    // Might affect templates
  'low',       // Probably doesn't affect templates
  'dismissed', // Reviewed and determined not relevant
]);

export const legislativeMonitoring = pgTable("legislative_monitoring", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  billId: text("bill_id").notNull().unique(), // LegiScan bill_id
  stateId: varchar("state_id", { length: 2 }).notNull(),
  billNumber: text("bill_number").notNull(), // e.g., "SB 142"
  title: text("title").notNull(),
  description: text("description"),
  status: billStatusEnum("status").notNull(),
  url: text("url"), // Link to LegiScan or state legislature
  lastAction: text("last_action"),
  lastActionDate: timestamp("last_action_date"),
  // AI Analysis
  relevanceLevel: relevanceEnum("relevance_level"),
  aiAnalysis: text("ai_analysis"), // AI explanation of why this matters
  affectedTemplateIds: text("affected_template_ids").array(), // Which templates might need updates
  // Tracking
  isMonitored: boolean("is_monitored").default(true),
  isReviewed: boolean("is_reviewed").default(false),
  reviewedBy: varchar("reviewed_by"), // Admin user ID
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertLegislativeMonitoringSchema = createInsertSchema(legislativeMonitoring).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertLegislativeMonitoring = z.infer<typeof insertLegislativeMonitoringSchema>;
export type LegislativeMonitoring = typeof legislativeMonitoring.$inferSelect;

// Template Review Queue - tracks templates flagged for attorney review
export const reviewStatusEnum = pgEnum('review_status', [
  'pending',      // Waiting for attorney review
  'in_review',    // Attorney is reviewing
  'approved',     // Changes approved, ready to publish
  'rejected',     // No changes needed
  'published',    // Changes published to live templates
]);

export const templateReviewQueue = pgTable("template_review_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").notNull(),
  billId: varchar("bill_id"), // Reference to legislativeMonitoring
  // Review details
  status: reviewStatusEnum("status").default('pending'),
  priority: integer("priority").default(5), // 1-10, higher = more urgent
  reason: text("reason").notNull(), // Why this template needs review
  recommendedChanges: text("recommended_changes"), // AI-suggested updates
  currentVersion: integer("current_version"),
  // Attorney workflow
  assignedTo: varchar("assigned_to"), // Attorney user ID
  reviewStartedAt: timestamp("review_started_at"),
  reviewCompletedAt: timestamp("review_completed_at"),
  attorneyNotes: text("attorney_notes"),
  approvedChanges: text("approved_changes"),
  approvalNotes: text("approval_notes"), // Admin notes on approval/rejection
  approvedAt: timestamp("approved_at"),
  rejectedAt: timestamp("rejected_at"),
  updatedTemplateSnapshot: jsonb("updated_template_snapshot"), // Stores approved changes payload
  // Publishing
  publishedAt: timestamp("published_at"),
  publishedBy: varchar("published_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTemplateReviewQueueSchema = createInsertSchema(templateReviewQueue).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTemplateReviewQueue = z.infer<typeof insertTemplateReviewQueueSchema>;
export type TemplateReviewQueue = typeof templateReviewQueue.$inferSelect;

// Monitoring Run Log - tracks each monthly automated run
export const monitoringRuns = pgTable("monitoring_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  runDate: timestamp("run_date").defaultNow(),
  statesChecked: text("states_checked").array(), // ['UT', 'TX', 'ND', 'SD']
  billsFound: integer("bills_found").default(0),
  relevantBills: integer("relevant_bills").default(0),
  templatesQueued: integer("templates_queued").default(0),
  status: varchar("status"), // 'success', 'partial', 'failed'
  errorMessage: text("error_message"),
  summaryReport: text("summary_report"), // Generated summary for admin
  emailSent: boolean("email_sent").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMonitoringRunSchema = createInsertSchema(monitoringRuns).omit({
  id: true,
  createdAt: true,
});
export type InsertMonitoringRun = z.infer<typeof insertMonitoringRunSchema>;
export type MonitoringRun = typeof monitoringRuns.$inferSelect;

// Template Versions - immutable history of template changes
export const templateVersions = pgTable("template_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").notNull().references(() => templates.id),
  versionNumber: integer("version_number").notNull(),
  pdfUrl: text("pdf_url"),
  fillableFormData: jsonb("fillable_form_data"),
  versionNotes: text("version_notes"), // What changed
  lastUpdateReason: text("last_update_reason"), // Why it changed (e.g., "SB 142")
  sourceReviewId: varchar("source_review_id"), // Link to templateReviewQueue if from legislative monitoring
  metadata: jsonb("metadata"), // Additional context
  createdBy: varchar("created_by"), // Admin who published
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTemplateVersionSchema = createInsertSchema(templateVersions).omit({
  id: true,
  createdAt: true,
});
export type InsertTemplateVersion = z.infer<typeof insertTemplateVersionSchema>;
export type TemplateVersion = typeof templateVersions.$inferSelect;
