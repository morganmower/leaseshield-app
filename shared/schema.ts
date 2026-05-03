import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import {
  index,
  uniqueIndex,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
  pgEnum,
  date,
  doublePrecision,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User storage table for JWT Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique().notNull(),
  passwordHash: varchar("password_hash"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  // Admin flag - admins can access all features without subscription
  isAdmin: boolean("is_admin").default(false),
  // Subscription fields
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  subscriptionStatus: varchar("subscription_status"), // 'trialing', 'active', 'canceled', 'past_due'
  billingInterval: varchar("billing_interval"), // 'month' or 'year'
  trialEndsAt: timestamp("trial_ends_at"),
  currentPeriodEnd: timestamp("current_period_end"), // Next renewal date from Stripe
  subscriptionEndsAt: timestamp("subscription_ends_at"),
  subscriptionExpiresAt: timestamp("subscription_expires_at"),
  renewalReminderSentAt: timestamp("renewal_reminder_sent_at"), // Track when we sent renewal reminder
  paymentFailedAt: timestamp("payment_failed_at"), // Track when payment failed for banner display
  subscribedAt: timestamp("subscribed_at"), // When first payment succeeded (official subscription start)
  // Stripe Connect (for landlord to receive tenant rent payments via ACH)
  stripeConnectAccountId: varchar("stripe_connect_account_id"),
  stripeConnectChargesEnabled: boolean("stripe_connect_charges_enabled").default(false),
  stripeConnectPayoutsEnabled: boolean("stripe_connect_payouts_enabled").default(false),
  stripeConnectDetailsSubmitted: boolean("stripe_connect_details_submitted").default(false),
  // User preferences
  preferredState: varchar("preferred_state", { length: 2 }), // UT, TX, ND, SD
  preferredCity: varchar("preferred_city"), // City ID for denial decision rules
  hasCompletedOnboarding: boolean("has_completed_onboarding").default(false),
  // Notification preferences
  notifyLegalUpdates: boolean("notify_legal_updates").default(true),
  notifyTemplateRevisions: boolean("notify_template_revisions").default(true),
  notifyBillingAlerts: boolean("notify_billing_alerts").default(true),
  notifyTips: boolean("notify_tips").default(false),
  // Communication defaults
  businessName: varchar("business_name"),
  phoneNumber: varchar("phone_number"),
  // Password reset
  passwordResetToken: varchar("password_reset_token"),
  passwordResetExpires: timestamp("password_reset_expires"),
  // Cleanup email tracking (for one-time trial cohort cleanup)
  cleanupEmailSentAt: timestamp("cleanup_email_sent_at"),
  // Rent payment fee defaults — per-landlord defaults applied when creating
  // new rent payment requests. The per-request value can override these.
  defaultServiceFeeEnabled: boolean("default_service_fee_enabled").default(false).notNull(),
  defaultServiceFeeAmount: integer("default_service_fee_amount").default(495).notNull(), // cents
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  // Indexes for common query patterns
  index("idx_users_subscription_status").on(table.subscriptionStatus),
  index("idx_users_preferred_state").on(table.preferredState),
]);

// Refresh tokens for JWT authentication
export const refreshTokens = pgTable("refresh_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: varchar("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("IDX_refresh_tokens_user").on(table.userId)]);

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// States supported by the platform
export const states = pgTable("states", {
  id: varchar("id", { length: 2 }).primaryKey(), // UT, TX, ND, SD
  name: text("name").notNull(), // Utah, Texas, etc.
  description: text("description"),
  isActive: boolean("is_active").default(true),
  decoderNotesReady: boolean("decoder_notes_ready").default(false), // True when required decoder topics are approved
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
  'evictions',
]);

export const templateTypeEnum = pgEnum('template_type', [
  'lease',
  'application',
  'adverse_action',
  'late_rent_notice',
  'lease_violation_notice',
  'non_renewal_notice',
  'rent_increase_notice',
  'rent_increase',
  'move_in_checklist',
  'move_out_checklist',
  'esa_documentation',
  'property_damage_form',
  'partial_payment_form',
  'tenant_complaint_form',
  'eviction_notice',
  'eviction_complaint',
  'security_deposit_return',
  'screening_authorization',
  'deposit_itemization',
  'notice_to_vacate',
]);

// Generation mode for templates - wizard (landlord fills) vs static (blank download for tenant/applicant)
export const generationModeEnum = pgEnum('generation_mode', [
  'wizard',  // Landlord fills out form, generates customized PDF
  'static',  // Blank template download (e.g., rental applications filled by tenants)
]);

// Templates library
export const templates = pgTable("templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: categoryEnum("category").notNull(),
  templateType: templateTypeEnum("template_type").notNull(),
  stateId: varchar("state_id", { length: 2 }).notNull(),
  key: varchar("key", { length: 100 }).notNull(), // Canonical key for upsert: e.g., "lease_residential_lease_agreement"
  // File storage - could be URLs or file paths
  pdfUrl: text("pdf_url"),
  fillableFormData: jsonb("fillable_form_data"), // JSON structure for fillable fields
  // Generation mode: wizard = landlord fills form, static = blank download for applicants
  generationMode: generationModeEnum("generation_mode").default('wizard'),
  // Link to official notice form output template (enables official_pdf_overlay routing)
  outputTemplateId: varchar("output_template_id"), // FK to output_templates.id (set after output_templates table is created)
  // Metadata
  version: integer("version").default(1),
  versionNotes: text("version_notes"), // What changed in this version
  lastUpdateReason: text("last_update_reason"), // Why was this updated
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  // Indexes for filtering templates by state and active status
  index("idx_templates_state_id").on(table.stateId),
  index("idx_templates_is_active").on(table.isActive),
  index("idx_templates_category").on(table.category),
]);

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
  key: varchar("key", { length: 100 }).notNull(), // Canonical key for upsert: e.g., "security_deposit_rules"
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  category: text("category").notNull(), // 'disclosures', 'screening', 'eviction', 'general'
  content: jsonb("content").notNull(), // Rich content structure
  relatedTemplateId: varchar("related_template_id").references(() => templates.id), // Optional link to template
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  // Index for filtering by state
  index("idx_compliance_cards_state_id").on(table.stateId),
  index("idx_compliance_cards_is_active").on(table.isActive),
]);

export const complianceCardsRelations = relations(complianceCards, ({ one }) => ({
  state: one(states, {
    fields: [complianceCards.stateId],
    references: [states.id],
  }),
  relatedTemplate: one(templates, {
    fields: [complianceCards.relatedTemplateId],
    references: [templates.id],
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
  category: varchar("category", { length: 50 }), // 'section8', 'hud', 'eviction', 'deposits', 'general'
  sourceBillId: varchar("source_bill_id"), // Link to legislative monitoring bill if auto-published
  affectedTemplateIds: text("affected_template_ids").array(), // Templates updated due to this legal change
  // Enhanced fields for better landlord communication
  billStatus: varchar("bill_status", { length: 50 }), // 'introduced', 'in_committee', 'passed_chamber', 'signed', 'enacted', 'vetoed'
  actionItems: text("action_items"), // What landlords should do now
  expectedTimeline: text("expected_timeline"), // When this takes effect or next steps
  sourceUrl: text("source_url"), // Link to original legislation/source
  aiEnriched: boolean("ai_enriched").default(false), // Whether AI has enriched this update
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  // Indexes for filtering by state and sorting by date
  index("idx_legal_updates_state_id").on(table.stateId),
  index("idx_legal_updates_created_at").on(table.createdAt),
  index("idx_legal_updates_is_active").on(table.isActive),
  // Prevent duplicate rows for the same state + title. The ingest path
  // upserts on this key, so the same federal/state notice can't be
  // re-published multiple times.
  uniqueIndex("legal_updates_state_title_unique").on(table.stateId, table.title),
]);

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

// Application Compliance Rules - state-specific requirements for rental applications
export const complianceRuleTypeEnum = pgEnum('compliance_rule_type', [
  'acknowledgment',     // Checkbox acknowledgment required
  'disclosure',         // Text disclosure that must be shown
  'authorization',      // Authorization checkbox (like FCRA)
  'document_required',  // Required document upload
  'link_required',      // Link to external page that must be visited
]);

export const applicationComplianceRules = pgTable("application_compliance_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stateId: varchar("state_id", { length: 10 }).notNull(), // 'ALL' for all states, or specific state code
  ruleType: complianceRuleTypeEnum("rule_type").notNull(),
  ruleKey: varchar("rule_key", { length: 100 }).notNull(), // Unique key like 'tx_tenant_selection', 'fcra_authorization'
  title: text("title").notNull(),
  description: text("description"), // Short description for landlords/admins
  checkboxLabel: text("checkbox_label"), // Label for checkbox if acknowledgment/authorization type
  disclosureText: text("disclosure_text"), // Full disclosure text to show
  linkUrl: text("link_url"), // URL to link to (e.g., /tx/tenant-selection-criteria)
  linkText: text("link_text"), // Text for the link
  statuteReference: text("statute_reference"), // Legal citation (e.g., "Texas Property Code § 92.3515")
  sortOrder: integer("sort_order").default(0), // Order in which to display
  isActive: boolean("is_active").default(true),
  effectiveDate: timestamp("effective_date"), // When this rule becomes effective
  expiresAt: timestamp("expires_at"), // When this rule expires (if superseded)
  version: integer("version").default(1),
  sourceBillId: varchar("source_bill_id"), // Reference to legislativeMonitoring if from a bill
  sourceLegalUpdateId: varchar("source_legal_update_id"), // Reference to legalUpdates
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const applicationComplianceRulesRelations = relations(applicationComplianceRules, ({ one }) => ({
  state: one(states, {
    fields: [applicationComplianceRules.stateId],
    references: [states.id],
  }),
  sourceBill: one(legislativeMonitoring, {
    fields: [applicationComplianceRules.sourceBillId],
    references: [legislativeMonitoring.billId],
  }),
  sourceLegalUpdate: one(legalUpdates, {
    fields: [applicationComplianceRules.sourceLegalUpdateId],
    references: [legalUpdates.id],
  }),
}));

export const insertApplicationComplianceRuleSchema = createInsertSchema(applicationComplianceRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertApplicationComplianceRule = z.infer<typeof insertApplicationComplianceRuleSchema>;
export type ApplicationComplianceRule = typeof applicationComplianceRules.$inferSelect;

// User notifications for legal updates and template updates
export const userNotifications = pgTable("user_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  legalUpdateId: varchar("legal_update_id"),
  templateId: varchar("template_id"),
  message: text("message"),
  isRead: boolean("is_read").default(false),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  // Indexes for user notification queries
  index("idx_user_notifications_user_id").on(table.userId),
  index("idx_user_notifications_is_read").on(table.isRead),
  index("idx_user_notifications_created_at").on(table.createdAt),
]);

export const userNotificationsRelations = relations(userNotifications, ({ one }) => ({
  user: one(users, {
    fields: [userNotifications.userId],
    references: [users.id],
  }),
  legalUpdate: one(legalUpdates, {
    fields: [userNotifications.legalUpdateId],
    references: [legalUpdates.id],
  }),
  template: one(templates, {
    fields: [userNotifications.templateId],
    references: [templates.id],
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

// Screening decoder feedback for learning system
export const screeningFeedback = pgTable("screening_feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  decoderType: varchar("decoder_type", { length: 50 }).notNull(), // 'credit' or 'criminal_eviction'
  questionText: text("question_text").notNull(),
  cautionLevel: varchar("caution_level", { length: 20 }), // 'low', 'medium', 'high'
  classifiedTopic: varchar("classified_topic", { length: 100 }),
  rating: varchar("rating", { length: 20 }).notNull(), // 'helpful' or 'not_helpful'
  feedbackText: text("feedback_text"), // Optional user comment
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_screening_feedback_decoder_type").on(table.decoderType),
  index("idx_screening_feedback_rating").on(table.rating),
  index("idx_screening_feedback_created_at").on(table.createdAt),
]);

export const insertScreeningFeedbackSchema = createInsertSchema(screeningFeedback).omit({
  id: true,
  createdAt: true,
});
export type InsertScreeningFeedback = z.infer<typeof insertScreeningFeedbackSchema>;
export type ScreeningFeedback = typeof screeningFeedback.$inferSelect;

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

export const dataSourceEnum = pgEnum('data_source', [
  'legiscan',          // LegiScan API
  'plural_policy',     // Plural Policy (Open States) API
  'federal_register',  // Federal Register API (HUD regulations)
  'court_listener',    // CourtListener case law
  'utah_glen',         // Utah GLEN API (Utah bills)
  'congress_gov',      // Congress.gov API
  'hud_onap',          // HUD ONAP/PIH pages
  'ecfr',              // eCFR API (CFR changes)
  'manual',            // Manually added by admin
]);

export const legislativeMonitoring = pgTable("legislative_monitoring", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  billId: text("bill_id").notNull().unique(), // LegiScan or Plural Policy bill_id
  stateId: varchar("state_id", { length: 2 }).notNull(),
  billNumber: text("bill_number").notNull(), // e.g., "SB 142"
  title: text("title").notNull(),
  description: text("description"),
  status: billStatusEnum("status").notNull(),
  url: text("url"), // Link to LegiScan or state legislature
  dataSource: dataSourceEnum("data_source").default('legiscan'), // Which API found this bill
  lastAction: text("last_action"),
  lastActionDate: timestamp("last_action_date"),
  // AI Analysis
  relevanceLevel: relevanceEnum("relevance_level"),
  aiAnalysis: text("ai_analysis"), // AI explanation of why this matters
  affectedTemplateIds: text("affected_template_ids").array(), // Which templates might need updates
  affectedComplianceCategories: text("affected_compliance_categories").array(), // Which compliance categories are affected (deposits, disclosures, evictions, fair_housing, rent_increases)
  // Tracking
  isMonitored: boolean("is_monitored").default(true),
  isReviewed: boolean("is_reviewed").default(false),
  reviewedBy: varchar("reviewed_by"), // Admin user ID
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  // Indexes for legislative monitoring queries
  index("idx_legislative_monitoring_state_id").on(table.stateId),
  index("idx_legislative_monitoring_is_reviewed").on(table.isReviewed),
  index("idx_legislative_monitoring_relevance_level").on(table.relevanceLevel),
]);

export const insertLegislativeMonitoringSchema = createInsertSchema(legislativeMonitoring).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertLegislativeMonitoring = z.infer<typeof insertLegislativeMonitoringSchema>;
export type LegislativeMonitoring = typeof legislativeMonitoring.$inferSelect;

// Case Law Monitoring - tracks court cases from CourtListener API
export const caseLawMonitoring = pgTable("case_law_monitoring", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: text("case_id").notNull().unique(), // CourtListener cluster ID
  stateId: varchar("state_id", { length: 2 }).notNull(),
  caseName: text("case_name").notNull(),
  caseNameFull: text("case_name_full"),
  citation: text("citation").notNull(), // e.g., "123 N.E.2d 456"
  court: text("court").notNull(),
  dateFiled: timestamp("date_filed"),
  caseNumber: text("case_number"),
  url: text("url"), // Link to CourtListener
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

export const insertCaseLawMonitoringSchema = createInsertSchema(caseLawMonitoring).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCaseLawMonitoring = z.infer<typeof insertCaseLawMonitoringSchema>;
export type CaseLawMonitoring = typeof caseLawMonitoring.$inferSelect;

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
  normalizedUpdateId: varchar("normalized_update_id"), // Reference to normalizedUpdates
  jurisdiction: varchar("jurisdiction", { length: 2 }), // State code if state-specific
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
  // Queueing
  queuedAt: timestamp("queued_at"),
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
  stateGroup: varchar("state_group"), // 'A' or 'B' - which rotation group was used for rate limit management
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

// Properties - user property management
export const properties = pgTable("properties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  address: text("address").notNull(),
  city: text("city"),
  county: text("county"), // For county-level rule matching (e.g., "Cook County")
  state: varchar("state", { length: 2 }),
  zipCode: varchar("zip_code", { length: 10 }),
  propertyType: varchar("property_type", { length: 50 }),
  units: integer("units").default(1),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  // Index for user property queries
  index("idx_properties_user_id").on(table.userId),
]);

export const propertiesRelations = relations(properties, ({ one, many }) => ({
  user: one(users, {
    fields: [properties.userId],
    references: [users.id],
  }),
  savedDocuments: many(savedDocuments),
}));

export const insertPropertySchema = createInsertSchema(properties).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProperty = z.infer<typeof insertPropertySchema>;
export type Property = typeof properties.$inferSelect;

// Retention Settings - per-property document retention configuration
export const retentionSettings = pgTable("retention_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  propertyId: varchar("property_id").notNull().references(() => properties.id).unique(),
  deniedUploadsDays: integer("denied_uploads_days").notNull().default(730),
  deniedBankStatementsDays: integer("denied_bank_statements_days").notNull().default(120),
  approvedUploadsDays: integer("approved_uploads_days").notNull().default(2555),
  approvedBankStatementsDays: integer("approved_bank_statements_days").notNull().default(730),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const retentionSettingsRelations = relations(retentionSettings, ({ one }) => ({
  property: one(properties, {
    fields: [retentionSettings.propertyId],
    references: [properties.id],
  }),
}));

export const insertRetentionSettingsSchema = createInsertSchema(retentionSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertRetentionSettings = z.infer<typeof insertRetentionSettingsSchema>;
export type RetentionSettings = typeof retentionSettings.$inferSelect;

// Saved Documents - user document history
export const savedDocuments = pgTable("saved_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  propertyId: varchar("property_id").references(() => properties.id),
  templateId: varchar("template_id").notNull().references(() => templates.id),
  templateName: text("template_name").notNull(),
  templateVersion: integer("template_version"),
  documentName: text("document_name").notNull(), // User-friendly name like "Late Rent Notice - John Doe"
  formData: jsonb("form_data").notNull(), // Filled form data for regeneration
  stateCode: varchar("state_code", { length: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  // Index for user document queries
  index("idx_saved_documents_user_id").on(table.userId),
]);

export const savedDocumentsRelations = relations(savedDocuments, ({ one }) => ({
  user: one(users, {
    fields: [savedDocuments.userId],
    references: [users.id],
  }),
  property: one(properties, {
    fields: [savedDocuments.propertyId],
    references: [properties.id],
  }),
  template: one(templates, {
    fields: [savedDocuments.templateId],
    references: [templates.id],
  }),
}));

export const insertSavedDocumentSchema = createInsertSchema(savedDocuments).omit({
  id: true,
  createdAt: true,
});
export type InsertSavedDocument = z.infer<typeof insertSavedDocumentSchema>;
export type SavedDocument = typeof savedDocuments.$inferSelect;

// Uploaded Documents - user-uploaded lease documents and files
export const uploadedDocuments = pgTable("uploaded_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  propertyId: varchar("property_id").references(() => properties.id),
  fileName: text("file_name").notNull(), // Original filename
  fileUrl: text("file_url").notNull(), // Storage path
  fileType: varchar("file_type", { length: 100 }), // MIME type like application/pdf
  fileSize: integer("file_size"), // Size in bytes
  description: text("description"), // Optional user description
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const uploadedDocumentsRelations = relations(uploadedDocuments, ({ one }) => ({
  user: one(users, {
    fields: [uploadedDocuments.userId],
    references: [users.id],
  }),
  property: one(properties, {
    fields: [uploadedDocuments.propertyId],
    references: [properties.id],
  }),
}));

export const insertUploadedDocumentSchema = createInsertSchema(uploadedDocuments).omit({
  id: true,
  createdAt: true,
});
export type InsertUploadedDocument = z.infer<typeof insertUploadedDocumentSchema>;
export type UploadedDocument = typeof uploadedDocuments.$inferSelect;

// Communication templates - pre-written templates for landlord-to-tenant communication
export const communicationTemplateTypeEnum = pgEnum('communication_template_type', [
  'rent_reminder',
  'welcome_letter',
  'lease_renewal_notice',
  'late_payment_notice',
  'move_in_welcome',
  'thirty_day_notice',
]);

export const communicationTemplates = pgTable("communication_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stateId: varchar("state_id", { length: 2 }).notNull(),
  templateType: communicationTemplateTypeEnum("template_type").notNull(),
  key: varchar("key", { length: 100 }).notNull(), // Canonical key for upsert: e.g., "rent_due_reminder"
  title: text("title").notNull(),
  bodyText: text("body_text").notNull(), // Contains {{merge_fields}} like {{tenant_name}}, {{amount_due}}, {{due_date}}
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const communicationTemplatesRelations = relations(communicationTemplates, ({ one }) => ({
  state: one(states, {
    fields: [communicationTemplates.stateId],
    references: [states.id],
  }),
}));

export const insertCommunicationTemplateSchema = createInsertSchema(communicationTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCommunicationTemplate = z.infer<typeof insertCommunicationTemplateSchema>;
export type CommunicationTemplate = typeof communicationTemplates.$inferSelect;

// Rent Ledger - track monthly rent payments (Slow path)
export const rentLedgerEntries = pgTable("rent_ledger_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  propertyId: varchar("property_id").references(() => properties.id),
  tenantName: text("tenant_name").notNull(),
  month: varchar("month", { length: 7 }).notNull(), // YYYY-MM format (kept for backward compatibility)
  amountExpected: integer("amount_expected").notNull(), // in cents
  amountReceived: integer("amount_received").default(0), // in cents
  paymentDate: timestamp("payment_date"), // when payment was received
  notes: text("notes"),
  // New fields for professional ledger
  effectiveDate: timestamp("effective_date"), // When charge/payment is effective (e.g., rent due date)
  category: varchar("category", { length: 50 }).default("Rent"), // Rent, Late Fee, Utility, Deposit, Other
  description: text("description"), // User-friendly description (e.g., "December Rent", "Late Fee - 5 days late")
  paymentMethod: varchar("payment_method", { length: 50 }), // Cash, Check, Zelle, Venmo, ACH, Certified funds
  referenceNumber: varchar("reference_number", { length: 100 }), // Check #, transaction ID, etc.
  type: varchar("type", { length: 20 }).default("charge"), // charge or payment
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const rentLedgerEntriesRelations = relations(rentLedgerEntries, ({ one }) => ({
  user: one(users, {
    fields: [rentLedgerEntries.userId],
    references: [users.id],
  }),
  property: one(properties, {
    fields: [rentLedgerEntries.propertyId],
    references: [properties.id],
  }),
}));

export const insertRentLedgerEntrySchema = createInsertSchema(rentLedgerEntries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  month: z.string().optional(),
  effectiveDate: z.union([z.date(), z.string(), z.null()]).optional().transform((v) => 
    v ? (typeof v === 'string' ? new Date(v) : v) : new Date()
  ),
});
export type InsertRentLedgerEntry = z.infer<typeof insertRentLedgerEntrySchema>;
export type RentLedgerEntry = typeof rentLedgerEntries.$inferSelect;

// AI Training Interest - track users who want to be notified about upcoming workshops
export const trainingInterest = pgTable("training_interest", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  email: varchar("email"), // Cached from user record for easy export
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const trainingInterestRelations = relations(trainingInterest, ({ one }) => ({
  user: one(users, {
    fields: [trainingInterest.userId],
    references: [users.id],
  }),
}));

export const insertTrainingInterestSchema = createInsertSchema(trainingInterest).omit({
  id: true,
  createdAt: true,
});
export type InsertTrainingInterest = z.infer<typeof insertTrainingInterestSchema>;
export type TrainingInterest = typeof trainingInterest.$inferSelect;

// Email Sequences - Define reusable email campaigns
export const emailSequences = pgTable("email_sequences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull(), // e.g., "Welcome Series", "Onboarding Tips"
  description: text("description"),
  trigger: varchar("trigger", { length: 50 }).notNull(), // "signup", "subscription", "inactive", "manual"
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const emailSequenceRelations = relations(emailSequences, ({ many }) => ({
  steps: many(emailSequenceSteps),
  enrollments: many(emailSequenceEnrollments),
}));

export const insertEmailSequenceSchema = createInsertSchema(emailSequences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertEmailSequence = z.infer<typeof insertEmailSequenceSchema>;
export type EmailSequence = typeof emailSequences.$inferSelect;

// Email Sequence Steps - Individual emails in a sequence
export const emailSequenceSteps = pgTable("email_sequence_steps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sequenceId: varchar("sequence_id").notNull().references(() => emailSequences.id, { onDelete: "cascade" }),
  stepNumber: integer("step_number").notNull(), // Order in the sequence
  name: varchar("name", { length: 100 }).notNull(), // e.g., "Welcome Email", "Day 3 Tips"
  subject: text("subject").notNull(), // Can include {{placeholders}} for AI
  aiPrompt: text("ai_prompt"), // OpenAI prompt for personalized content
  fallbackBody: text("fallback_body").notNull(), // Static fallback if AI unavailable
  delayHours: integer("delay_hours").default(0).notNull(), // Hours after previous step (or enrollment)
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const emailSequenceStepsRelations = relations(emailSequenceSteps, ({ one }) => ({
  sequence: one(emailSequences, {
    fields: [emailSequenceSteps.sequenceId],
    references: [emailSequences.id],
  }),
}));

export const insertEmailSequenceStepSchema = createInsertSchema(emailSequenceSteps).omit({
  id: true,
  createdAt: true,
});
export type InsertEmailSequenceStep = z.infer<typeof insertEmailSequenceStepSchema>;
export type EmailSequenceStep = typeof emailSequenceSteps.$inferSelect;

// Email Sequence Enrollments - Track user progress through sequences
export const emailSequenceEnrollments = pgTable("email_sequence_enrollments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sequenceId: varchar("sequence_id").notNull().references(() => emailSequences.id, { onDelete: "cascade" }),
  currentStep: integer("current_step").default(0).notNull(), // 0 = not started yet
  status: varchar("status", { length: 20 }).default("active").notNull(), // active, completed, paused, unsubscribed
  nextSendAt: timestamp("next_send_at"), // When to send next email
  enrolledAt: timestamp("enrolled_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  lastSentAt: timestamp("last_sent_at"),
});

export const emailSequenceEnrollmentsRelations = relations(emailSequenceEnrollments, ({ one }) => ({
  user: one(users, {
    fields: [emailSequenceEnrollments.userId],
    references: [users.id],
  }),
  sequence: one(emailSequences, {
    fields: [emailSequenceEnrollments.sequenceId],
    references: [emailSequences.id],
  }),
}));

export const insertEmailSequenceEnrollmentSchema = createInsertSchema(emailSequenceEnrollments).omit({
  id: true,
  enrolledAt: true,
  completedAt: true,
  lastSentAt: true,
});
export type InsertEmailSequenceEnrollment = z.infer<typeof insertEmailSequenceEnrollmentSchema>;
export type EmailSequenceEnrollment = typeof emailSequenceEnrollments.$inferSelect;

// Email Events - Track every email sent and engagement
export const emailEvents = pgTable("email_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  email: varchar("email", { length: 255 }).notNull(),
  resendId: varchar("resend_id", { length: 100 }), // ID from Resend API
  sequenceId: varchar("sequence_id").references(() => emailSequences.id, { onDelete: "set null" }),
  stepId: varchar("step_id").references(() => emailSequenceSteps.id, { onDelete: "set null" }),
  emailType: varchar("email_type", { length: 50 }).notNull(), // "sequence", "transactional", "notification"
  subject: text("subject").notNull(),
  status: varchar("status", { length: 20 }).default("sent").notNull(), // sent, delivered, opened, clicked, bounced, failed
  aiGenerated: boolean("ai_generated").default(false).notNull(),
  aiContentCached: text("ai_content_cached"), // Store AI-generated content for auditing
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  deliveredAt: timestamp("delivered_at"),
  openedAt: timestamp("opened_at"),
  clickedAt: timestamp("clicked_at"),
  bouncedAt: timestamp("bounced_at"),
  metadata: jsonb("metadata"), // Additional data (click URLs, bounce reason, etc.)
});

export const emailEventsRelations = relations(emailEvents, ({ one }) => ({
  user: one(users, {
    fields: [emailEvents.userId],
    references: [users.id],
  }),
  sequence: one(emailSequences, {
    fields: [emailEvents.sequenceId],
    references: [emailSequences.id],
  }),
  step: one(emailSequenceSteps, {
    fields: [emailEvents.stepId],
    references: [emailSequenceSteps.id],
  }),
}));

export const insertEmailEventSchema = createInsertSchema(emailEvents).omit({
  id: true,
  sentAt: true,
  deliveredAt: true,
  openedAt: true,
  clickedAt: true,
  bouncedAt: true,
});
export type InsertEmailEvent = z.infer<typeof insertEmailEventSchema>;
export type EmailEvent = typeof emailEvents.$inferSelect;

// Broadcast Messages - Admin sends messages to trial/active users
export const broadcastAudienceEnum = pgEnum('broadcast_audience', [
  'trial',      // Only trial users
  'active',     // Only active subscribers
  'all',        // Both trial and active
  'individual', // Single user
]);

export const broadcastMessages = pgTable("broadcast_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subject: text("subject").notNull(),
  content: text("content").notNull(),
  audience: broadcastAudienceEnum("audience").notNull(),
  sentByUserId: varchar("sent_by_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  recipientCount: integer("recipient_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const broadcastMessagesRelations = relations(broadcastMessages, ({ one, many }) => ({
  sentBy: one(users, {
    fields: [broadcastMessages.sentByUserId],
    references: [users.id],
  }),
  recipients: many(broadcastRecipients),
  replies: many(broadcastReplies),
}));

export const insertBroadcastMessageSchema = createInsertSchema(broadcastMessages).omit({
  id: true,
  createdAt: true,
  recipientCount: true,
});
export type InsertBroadcastMessage = z.infer<typeof insertBroadcastMessageSchema>;
export type BroadcastMessage = typeof broadcastMessages.$inferSelect;

// Broadcast Recipients - Track which users received which broadcasts
export const broadcastRecipients = pgTable("broadcast_recipients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  broadcastId: varchar("broadcast_id").notNull().references(() => broadcastMessages.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  isRead: boolean("is_read").default(false),
  readAt: timestamp("read_at"),
  emailSent: boolean("email_sent").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const broadcastRecipientsRelations = relations(broadcastRecipients, ({ one }) => ({
  broadcast: one(broadcastMessages, {
    fields: [broadcastRecipients.broadcastId],
    references: [broadcastMessages.id],
  }),
  user: one(users, {
    fields: [broadcastRecipients.userId],
    references: [users.id],
  }),
}));

export const insertBroadcastRecipientSchema = createInsertSchema(broadcastRecipients).omit({
  id: true,
  createdAt: true,
  readAt: true,
});
export type InsertBroadcastRecipient = z.infer<typeof insertBroadcastRecipientSchema>;
export type BroadcastRecipient = typeof broadcastRecipients.$inferSelect;

// Broadcast Replies - User replies to broadcasts (private to admin)
export const broadcastReplies = pgTable("broadcast_replies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  broadcastId: varchar("broadcast_id").notNull().references(() => broadcastMessages.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  isReadByAdmin: boolean("is_read_by_admin").default(false),
  readByAdminAt: timestamp("read_by_admin_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const broadcastRepliesRelations = relations(broadcastReplies, ({ one }) => ({
  broadcast: one(broadcastMessages, {
    fields: [broadcastReplies.broadcastId],
    references: [broadcastMessages.id],
  }),
  user: one(users, {
    fields: [broadcastReplies.userId],
    references: [users.id],
  }),
}));

export const insertBroadcastReplySchema = createInsertSchema(broadcastReplies).omit({
  id: true,
  createdAt: true,
  isReadByAdmin: true,
  readByAdminAt: true,
});
export type InsertBroadcastReply = z.infer<typeof insertBroadcastReplySchema>;
export type BroadcastReply = typeof broadcastReplies.$inferSelect;

// ============================================================
// RENTAL APPLICATION SYSTEM - MVP Tables
// ============================================================

// Document type enum for required documents configuration
export const documentTypeEnum = pgEnum('document_type', [
  'id',        // ID / Driver's License - always required
  'income',    // Proof of Income (paystubs, employment letter)
  'bank',      // Bank Statements
  'reference', // Reference Letters
  'other',     // Other documents
]);

// Helper type for document requirements configuration
export type DocumentRequirementsConfig = {
  id: boolean;        // Always true by default
  income: boolean;
  bank: boolean;
  reference: boolean;
};

// Default document requirements - only ID is required by default
export const DEFAULT_DOCUMENT_REQUIREMENTS: DocumentRequirementsConfig = {
  id: true,
  income: false,
  bank: false,
  reference: false,
};

// Property Terms - rent, fees, deposits shown to applicants before applying
export type PropertyTerms = {
  monthlyRent?: string;          // e.g. "$1,500" or "N/A"
  applicationFee?: string;       // e.g. "$50 per adult" or "N/A"
  securityDeposit?: string;      // e.g. "$1,500 (refundable)" or "N/A"
  adminFee?: string;             // e.g. "$150 (non-refundable)" or "N/A"
  leaseSignDeadlineHours?: number; // e.g. 48 (hours after approval to sign)
  additionalNotes?: string;      // Any other terms/notes
};

// Default empty property terms
export const DEFAULT_PROPERTY_TERMS: PropertyTerms = {};

// Rental Properties - properties with cover page + field schema defaults
export const rentalProperties = pgTable("rental_properties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  address: text("address"),
  city: text("city"),
  state: varchar("state", { length: 2 }),
  zipCode: varchar("zip_code", { length: 10 }),
  propertyType: varchar("property_type", { length: 50 }), // Single Family, Multi-Family, Apartment, etc.
  notes: text("notes"), // Landlord notes about the property
  defaultCoverPageJson: jsonb("default_cover_page_json").notNull(), // Cover page content (title, intro, sections)
  defaultFieldSchemaJson: jsonb("default_field_schema_json").notNull(), // Field visibility toggles
  requiredDocumentTypes: jsonb("required_document_types").$type<DocumentRequirementsConfig>(), // Which documents are required
  autoScreening: boolean("auto_screening").default(false).notNull(), // Automatically request screening on submission
  screeningInvitationId: varchar("screening_invitation_id", { length: 100 }), // Western Verify invitation ID override for this property
  propertyTermsJson: jsonb("property_terms_json").$type<PropertyTerms>(), // Rent, fees, deposits, deadlines
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const rentalPropertiesRelations = relations(rentalProperties, ({ one, many }) => ({
  user: one(users, {
    fields: [rentalProperties.userId],
    references: [users.id],
  }),
  units: many(rentalUnits),
}));

export const insertRentalPropertySchema = createInsertSchema(rentalProperties).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertRentalProperty = z.infer<typeof insertRentalPropertySchema>;
export type RentalProperty = typeof rentalProperties.$inferSelect;

// Rental Units - units with cover page/field schema override capability
export const rentalUnits = pgTable("rental_units", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  propertyId: varchar("property_id").notNull().references(() => rentalProperties.id, { onDelete: 'cascade' }),
  unitLabel: text("unit_label").notNull(), // e.g., "Unit A", "101", "Main House"
  rentAmount: integer("rent_amount"), // Monthly rent in cents (e.g., 150000 = $1,500.00)
  securityDepositAmount: integer("security_deposit_amount"), // Security deposit in cents; null = use property default / not set
  coverPageOverrideEnabled: boolean("cover_page_override_enabled").default(false).notNull(),
  coverPageOverrideJson: jsonb("cover_page_override_json"), // Override cover page if enabled
  fieldSchemaOverrideEnabled: boolean("field_schema_override_enabled").default(false).notNull(),
  fieldSchemaOverrideJson: jsonb("field_schema_override_json"), // Override field schema if enabled
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const rentalUnitsRelations = relations(rentalUnits, ({ one, many }) => ({
  property: one(rentalProperties, {
    fields: [rentalUnits.propertyId],
    references: [rentalProperties.id],
  }),
  applicationLinks: many(rentalApplicationLinks),
}));

export const insertRentalUnitSchema = createInsertSchema(rentalUnits).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertRentalUnit = z.infer<typeof insertRentalUnitSchema>;
export type RentalUnit = typeof rentalUnits.$inferSelect;

// Rental Application Links - public links for applicants
export const rentalApplicationLinks = pgTable("rental_application_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  unitId: varchar("unit_id").notNull().references(() => rentalUnits.id, { onDelete: 'cascade' }),
  publicToken: varchar("public_token", { length: 64 }).notNull().unique(), // Public URL token
  mergedSchemaJson: jsonb("merged_schema_json").notNull(), // Final merged cover page + fields
  isActive: boolean("is_active").default(true).notNull(),
  expiresAt: timestamp("expires_at"), // Optional expiration
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const rentalApplicationLinksRelations = relations(rentalApplicationLinks, ({ one, many }) => ({
  unit: one(rentalUnits, {
    fields: [rentalApplicationLinks.unitId],
    references: [rentalUnits.id],
  }),
  submissions: many(rentalSubmissions),
}));

export const insertRentalApplicationLinkSchema = createInsertSchema(rentalApplicationLinks).omit({
  id: true,
  createdAt: true,
});
export type InsertRentalApplicationLink = z.infer<typeof insertRentalApplicationLinkSchema>;
export type RentalApplicationLink = typeof rentalApplicationLinks.$inferSelect;

// Rental Submission Status Enum
export const rentalSubmissionStatusEnum = pgEnum('rental_submission_status', [
  'started',            // Applicant started but not submitted
  'submitted',          // All required people submitted
  'screening_requested', // Screening sent to DigitalDelve
  'in_progress',        // Screening in progress
  'complete',           // Screening complete, report available
]);

// Rental Submissions - one per application flow
export const rentalSubmissions = pgTable("rental_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationLinkId: varchar("application_link_id").notNull().references(() => rentalApplicationLinks.id, { onDelete: 'cascade' }),
  status: rentalSubmissionStatusEnum("status").default('started').notNull(),
  submittedAt: timestamp("submitted_at"),
  deletedAt: timestamp("deleted_at"), // Soft delete - null means active, timestamp means deleted
  archivedAt: timestamp("archived_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const rentalSubmissionsRelations = relations(rentalSubmissions, ({ one, many }) => ({
  applicationLink: one(rentalApplicationLinks, {
    fields: [rentalSubmissions.applicationLinkId],
    references: [rentalApplicationLinks.id],
  }),
  people: many(rentalSubmissionPeople),
  acknowledgements: many(rentalSubmissionAcknowledgements),
  screeningOrder: one(rentalScreeningOrders),
  decision: one(rentalDecisions),
  events: many(rentalApplicationEvents),
}));

export const insertRentalSubmissionSchema = createInsertSchema(rentalSubmissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertRentalSubmission = z.infer<typeof insertRentalSubmissionSchema>;
export type RentalSubmission = typeof rentalSubmissions.$inferSelect;

// Rental Submission Person Role Enum
export const rentalPersonRoleEnum = pgEnum('rental_person_role', [
  'applicant',
  'coapplicant',
  'guarantor',
]);

// Rental Submission People - people on a submission (primary + co-app + guarantor)
export const rentalSubmissionPeople = pgTable("rental_submission_people", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  submissionId: varchar("submission_id").notNull().references(() => rentalSubmissions.id, { onDelete: 'cascade' }),
  role: rentalPersonRoleEnum("role").notNull(),
  inviteToken: varchar("invite_token", { length: 64 }).notNull().unique(), // Per-person magic link token
  firstName: text("first_name"),
  lastName: text("last_name"),
  email: text("email"),
  phone: text("phone"),
  formJson: jsonb("form_json").default({}).notNull(), // Autosave answers
  isCompleted: boolean("is_completed").default(false).notNull(),
  completedAt: timestamp("completed_at"),
  screeningDisclosureAcknowledgedAt: timestamp("screening_disclosure_acknowledged_at"),
  screeningDisclosureIpAddress: text("screening_disclosure_ip_address"),
  screeningDisclosureUserAgent: text("screening_disclosure_user_agent"),
  screeningDisclosureVersion: text("screening_disclosure_version"),
  // Texas-specific tenant selection criteria acknowledgment
  txSelectionAcknowledged: boolean("tx_selection_acknowledged").default(false),
  txSelectionAckTimestamp: timestamp("tx_selection_ack_timestamp"),
  txSelectionAckIp: text("tx_selection_ack_ip"),
  // FCRA authorization (all states)
  fcraAuthorized: boolean("fcra_authorized").default(false),
  fcraAuthorizedTimestamp: timestamp("fcra_authorized_timestamp"),
  // Property terms acknowledgment
  propertyTermsAcknowledgedAt: timestamp("property_terms_acknowledged_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const rentalSubmissionPeopleRelations = relations(rentalSubmissionPeople, ({ one, many }) => ({
  submission: one(rentalSubmissions, {
    fields: [rentalSubmissionPeople.submissionId],
    references: [rentalSubmissions.id],
  }),
  files: many(rentalSubmissionFiles),
}));

export const insertRentalSubmissionPersonSchema = createInsertSchema(rentalSubmissionPeople).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertRentalSubmissionPerson = z.infer<typeof insertRentalSubmissionPersonSchema>;
export type RentalSubmissionPerson = typeof rentalSubmissionPeople.$inferSelect;

// Rental Submission Files - uploaded documents
export const rentalSubmissionFiles = pgTable("rental_submission_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  personId: varchar("person_id").notNull().references(() => rentalSubmissionPeople.id, { onDelete: 'cascade' }),
  fileType: varchar("file_type", { length: 50 }).notNull(), // id, paystub, w2, bank, etc.
  originalName: text("original_name").notNull(),
  storedPath: text("stored_path").notNull(),
  fileSize: integer("file_size"),
  mimeType: varchar("mime_type", { length: 100 }),
  availabilityStatus: varchar("availability_status", { length: 20 }).notNull().default('available'),
  supersededAt: timestamp("superseded_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const rentalSubmissionFilesRelations = relations(rentalSubmissionFiles, ({ one }) => ({
  person: one(rentalSubmissionPeople, {
    fields: [rentalSubmissionFiles.personId],
    references: [rentalSubmissionPeople.id],
  }),
}));

export const insertRentalSubmissionFileSchema = createInsertSchema(rentalSubmissionFiles).omit({
  id: true,
  createdAt: true,
});
export type InsertRentalSubmissionFile = z.infer<typeof insertRentalSubmissionFileSchema>;
export type RentalSubmissionFile = typeof rentalSubmissionFiles.$inferSelect;

// Rental Submission Acknowledgements - cover page and other acks
export const rentalSubmissionAcknowledgements = pgTable("rental_submission_acknowledgements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  submissionId: varchar("submission_id").notNull().references(() => rentalSubmissions.id, { onDelete: 'cascade' }),
  personId: varchar("person_id").references(() => rentalSubmissionPeople.id, { onDelete: 'cascade' }),
  type: varchar("type", { length: 50 }).notNull(), // cover_page, disclosures, etc.
  ackName: text("ack_name"), // Typed name for signature
  ackChecked: boolean("ack_checked").default(false).notNull(),
  ackAt: timestamp("ack_at"),
  ackIp: varchar("ack_ip", { length: 50 }),
  ackUserAgent: text("ack_user_agent"),
  contentSnapshotJson: jsonb("content_snapshot_json"), // Snapshot of what they acknowledged
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const rentalSubmissionAcknowledgementsRelations = relations(rentalSubmissionAcknowledgements, ({ one }) => ({
  submission: one(rentalSubmissions, {
    fields: [rentalSubmissionAcknowledgements.submissionId],
    references: [rentalSubmissions.id],
  }),
  person: one(rentalSubmissionPeople, {
    fields: [rentalSubmissionAcknowledgements.personId],
    references: [rentalSubmissionPeople.id],
  }),
}));

export const insertRentalSubmissionAcknowledgementSchema = createInsertSchema(rentalSubmissionAcknowledgements).omit({
  id: true,
  createdAt: true,
});
export type InsertRentalSubmissionAcknowledgement = z.infer<typeof insertRentalSubmissionAcknowledgementSchema>;
export type RentalSubmissionAcknowledgement = typeof rentalSubmissionAcknowledgements.$inferSelect;

// Rental Screening Order Status Enum
export const rentalScreeningStatusEnum = pgEnum('rental_screening_status', [
  'not_sent',
  'sent',
  'in_progress',
  'complete',
  'error',
]);

// Rental Screening Orders - DigitalDelve integration (per-person screening)
export const rentalScreeningOrders = pgTable("rental_screening_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  submissionId: varchar("submission_id").notNull().references(() => rentalSubmissions.id, { onDelete: 'cascade' }),
  personId: varchar("person_id").references(() => rentalSubmissionPeople.id, { onDelete: 'cascade' }), // Person being screened
  invitationId: text("invitation_id"), // DigitalDelve invitation ID
  referenceNumber: varchar("reference_number", { length: 100 }).notNull().unique(), // Our reference number
  status: rentalScreeningStatusEnum("status").default('not_sent').notNull(),
  reportId: text("report_id"), // DigitalDelve report ID
  reportUrl: text("report_url"), // URL to view report
  rawStatusXml: text("raw_status_xml"), // Raw status webhook data
  rawResultXml: text("raw_result_xml"), // Raw result webhook data
  errorMessage: text("error_message"),
  // Polling metadata for automatic status checks
  lastStatusCheckAt: timestamp("last_status_check_at"), // When we last checked status
  nextStatusCheckAt: timestamp("next_status_check_at"), // When to check next
  pollUntil: timestamp("poll_until"), // Stop polling after this time
  consecutiveFailures: integer("consecutive_failures").default(0), // For exponential backoff
  completionNotifiedAt: timestamp("completion_notified_at"), // When owner was notified of completion
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const rentalScreeningOrdersRelations = relations(rentalScreeningOrders, ({ one }) => ({
  submission: one(rentalSubmissions, {
    fields: [rentalScreeningOrders.submissionId],
    references: [rentalSubmissions.id],
  }),
  person: one(rentalSubmissionPeople, {
    fields: [rentalScreeningOrders.personId],
    references: [rentalSubmissionPeople.id],
  }),
}));

export const insertRentalScreeningOrderSchema = createInsertSchema(rentalScreeningOrders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertRentalScreeningOrder = z.infer<typeof insertRentalScreeningOrderSchema>;
export type RentalScreeningOrder = typeof rentalScreeningOrders.$inferSelect;

// Rental Decision Enum
export const rentalDecisionTypeEnum = pgEnum('rental_decision_type', [
  'approved',
  'denied',
]);

// Rental Decisions - approve/deny decisions
export const rentalDecisions = pgTable("rental_decisions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  submissionId: varchar("submission_id").notNull().unique().references(() => rentalSubmissions.id, { onDelete: 'cascade' }),
  decision: rentalDecisionTypeEnum("decision").notNull(),
  decidedAt: timestamp("decided_at").notNull(),
  decidedByUserId: varchar("decided_by_user_id").notNull().references(() => users.id),
  notes: text("notes"), // Internal notes
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const rentalDecisionsRelations = relations(rentalDecisions, ({ one, many }) => ({
  submission: one(rentalSubmissions, {
    fields: [rentalDecisions.submissionId],
    references: [rentalSubmissions.id],
  }),
  decidedBy: one(users, {
    fields: [rentalDecisions.decidedByUserId],
    references: [users.id],
  }),
  letters: many(rentalDecisionLetters),
  denialReasons: many(rentalDenialReasons),
}));

export const insertRentalDecisionSchema = createInsertSchema(rentalDecisions).omit({
  id: true,
  createdAt: true,
});
export type InsertRentalDecision = z.infer<typeof insertRentalDecisionSchema>;
export type RentalDecision = typeof rentalDecisions.$inferSelect;

// Denial Reason Category Enum
export const denialReasonCategoryEnum = pgEnum('denial_reason_category', [
  'credit',
  'criminal',
  'eviction',
  'rental_history',
  'income',
  'incomplete',
  'false_information',
  'other',
]);

// Rental Denial Reasons - structured denial reasons for FCRA compliance
export const rentalDenialReasons = pgTable("rental_denial_reasons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  decisionId: varchar("decision_id").notNull().references(() => rentalDecisions.id, { onDelete: 'cascade' }),
  category: denialReasonCategoryEnum("category").notNull(),
  detail: text("detail"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const rentalDenialReasonsRelations = relations(rentalDenialReasons, ({ one }) => ({
  decision: one(rentalDecisions, {
    fields: [rentalDenialReasons.decisionId],
    references: [rentalDecisions.id],
  }),
}));

export const insertRentalDenialReasonSchema = createInsertSchema(rentalDenialReasons).omit({
  id: true,
  createdAt: true,
});
export type InsertRentalDenialReason = z.infer<typeof insertRentalDenialReasonSchema>;
export type RentalDenialReason = typeof rentalDenialReasons.$inferSelect;

// Rental Decision Letter Type Enum
export const rentalLetterTypeEnum = pgEnum('rental_letter_type', [
  'approval',
  'adverse_action',
]);

// Rental Decision Letters - letter templates and sent letters
export const rentalDecisionLetters = pgTable("rental_decision_letters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  submissionId: varchar("submission_id").notNull().references(() => rentalSubmissions.id, { onDelete: 'cascade' }),
  decisionId: varchar("decision_id").references(() => rentalDecisions.id, { onDelete: 'cascade' }),
  letterType: rentalLetterTypeEnum("letter_type").notNull(),
  templateBody: text("template_body").notNull(), // Original template
  finalBody: text("final_body").notNull(), // Edited final version
  sentToEmail: text("sent_to_email"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const rentalDecisionLettersRelations = relations(rentalDecisionLetters, ({ one }) => ({
  submission: one(rentalSubmissions, {
    fields: [rentalDecisionLetters.submissionId],
    references: [rentalSubmissions.id],
  }),
  decision: one(rentalDecisions, {
    fields: [rentalDecisionLetters.decisionId],
    references: [rentalDecisions.id],
  }),
}));

export const insertRentalDecisionLetterSchema = createInsertSchema(rentalDecisionLetters).omit({
  id: true,
  createdAt: true,
});
export type InsertRentalDecisionLetter = z.infer<typeof insertRentalDecisionLetterSchema>;
export type RentalDecisionLetter = typeof rentalDecisionLetters.$inferSelect;

// Rental Application Events - event logging
export const rentalApplicationEvents = pgTable("rental_application_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  submissionId: varchar("submission_id").references(() => rentalSubmissions.id, { onDelete: 'cascade' }),
  eventType: varchar("event_type", { length: 50 }).notNull(), // submission_created, cover_page_acknowledged, etc.
  metadataJson: jsonb("metadata_json"), // Additional context
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const rentalApplicationEventsRelations = relations(rentalApplicationEvents, ({ one }) => ({
  submission: one(rentalSubmissions, {
    fields: [rentalApplicationEvents.submissionId],
    references: [rentalSubmissions.id],
  }),
}));

export const insertRentalApplicationEventSchema = createInsertSchema(rentalApplicationEvents).omit({
  id: true,
  createdAt: true,
});
export type InsertRentalApplicationEvent = z.infer<typeof insertRentalApplicationEventSchema>;
export type RentalApplicationEvent = typeof rentalApplicationEvents.$inferSelect;

// Landlord screening credentials (Western Verify / Digital Delve)
export const screeningCredentialStatusEnum = pgEnum('screening_credential_status', [
  'not_configured',
  'pending_verification',
  'verified',
  'failed',
]);

export const landlordScreeningCredentials = pgTable("landlord_screening_credentials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  encryptedUsername: text("encrypted_username").notNull(),
  encryptedPassword: text("encrypted_password").notNull(),
  encryptionIv: text("encryption_iv").notNull(),
  defaultInvitationId: varchar("default_invitation_id"),
  status: screeningCredentialStatusEnum("status").default("pending_verification").notNull(),
  lastVerifiedAt: timestamp("last_verified_at"),
  lastErrorMessage: text("last_error_message"),
  configuredBy: varchar("configured_by").references(() => users.id),
  configuredAt: timestamp("configured_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertLandlordScreeningCredentialsSchema = createInsertSchema(landlordScreeningCredentials).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertLandlordScreeningCredentials = z.infer<typeof insertLandlordScreeningCredentialsSchema>;
export type LandlordScreeningCredentials = typeof landlordScreeningCredentials.$inferSelect;

// Default cover page template
export const defaultCoverPageTemplate = {
  title: "Rental Application Requirements",
  intro: "Please read the following requirements carefully before submitting your application. Applications are reviewed in the order received.",
  sections: [
    { id: "processing_time", heading: "Processing Time", body: "Most applications are processed within 1–3 business days." },
    { id: "required_uploads", heading: "Required Documents", body: "Government-issued ID and proof of income are required. Additional documents may be requested." },
    { id: "move_in_funds", heading: "Move-In Funds", body: "Move-in funds are due upon approval unless otherwise stated in the rental terms above." },
    { id: "pet_policy", heading: "Pet Policy", body: "Pets may require approval and additional deposits or fees. Unauthorized pets may result in denial or lease violation." },
    { id: "renters_insurance", heading: "Renters Insurance", body: "Renters insurance may be required prior to move-in and throughout the lease term." },
    { id: "fees", heading: "Fees", body: "Late fees and other administrative fees may apply per the lease agreement." },
    { id: "no_verbal", heading: "No Verbal Agreements", body: "All agreements must be in writing. Verbal statements do not modify the lease." }
  ],
  footerNote: ""
};

// Default field schema template (visibility toggles)
export const defaultFieldSchemaTemplate = {
  stateScope: "all_leaseshield_states",
  fields: {
    phone: { visibility: "required" },
    dlNumber: { visibility: "optional" },
    dlState: { visibility: "optional" },
    ssn: { visibility: "hidden" }, // SSN/DOB collected by DigitalDelve
    dob: { visibility: "hidden" },
    currentAddress: { visibility: "required" },
    previousAddresses: { visibility: "required" },
    employmentHistory: { visibility: "required" },
    rentalHistory: { visibility: "optional" },
    vehicles: { visibility: "optional" },
    pets: { visibility: "optional" },
    emergencyContact: { visibility: "optional" },
    // New toggleable fields
    desiredMoveInDate: { visibility: "optional" },
    numberOfOccupants: { visibility: "optional" },
    personalReferences: { visibility: "optional" },
    housingVoucher: { visibility: "hidden" }, // Source of income protection in some states - hidden by default
    referralSource: { visibility: "optional" },
    // Mandatory toggle options for existing fields (track if landlord requires these)
    currentLandlordContact: { visibility: "optional" },
    employerPhone: { visibility: "optional" },
    monthlyIncome: { visibility: "required" },
    reasonForMoving: { visibility: "optional" }
  },
  historyRules: {
    minAddressYears: 2,
    minEmploymentYears: 2,
    minPreviousRentals: 2 // For rental history section
  },
  uploads: {
    govId: { required: true, label: "Government ID" },
    paystubs30Days: { required: true, label: "Paystubs (last 30 days)" },
    taxDocsSelfEmployed: { required: false, label: "Self-employed tax documents (Schedule C, etc.)" },
    otherIncome: { required: false, label: "Other income documentation" }
  }
};

// Default letter templates
export const defaultApprovalLetterTemplate = `Subject: Application Approved – {{propertyName}}

Hello {{applicantName}},

Good news — your rental application for {{unitLabel}} at {{propertyName}} has been approved.

Next steps:
• Please review and sign the lease by {{leaseSignDueDate}}
• Pay move-in funds as outlined by management
• Provide any remaining documents requested (if applicable)

If you have questions, reply to this email.

Thank you,
{{landlordName}}`;

export const defaultAdverseActionLetterTemplate = `Subject: Adverse Action Notice – Rental Application

Date: {{date}}

Applicant: {{applicantName}}
Property/Unit: {{propertyName}} – {{unitLabel}}

This notice is to inform you that an adverse action has been taken regarding your rental application.

Reason(s) (optional – if provided by landlord policy):
{{denialReasons}}

Consumer Reporting Agency (CRA) that provided the report:
Western Verify (via DigitalDelve)
{{craAddress}}
{{craPhone}}

The CRA did not make this decision and cannot explain why the decision was made.

You have the right to obtain a free copy of your consumer report from the CRA if you request it within 60 days, and you have the right to dispute the accuracy or completeness of any information in the report.

Sincerely,
{{landlordName}}`;

// Direct Messaging System - Two-way conversations between admin and users
export const directConversations = pgTable("direct_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subject: text("subject").notNull(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdByAdminId: varchar("created_by_admin_id").notNull().references(() => users.id),
  lastMessageAt: timestamp("last_message_at").defaultNow(),
  isArchived: boolean("is_archived").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("IDX_direct_conversations_user").on(table.userId),
  index("IDX_direct_conversations_admin").on(table.createdByAdminId),
]);

export const directConversationsRelations = relations(directConversations, ({ one, many }) => ({
  user: one(users, {
    fields: [directConversations.userId],
    references: [users.id],
  }),
  admin: one(users, {
    fields: [directConversations.createdByAdminId],
    references: [users.id],
  }),
  messages: many(directMessages),
}));

export const insertDirectConversationSchema = createInsertSchema(directConversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertDirectConversation = z.infer<typeof insertDirectConversationSchema>;
export type DirectConversation = typeof directConversations.$inferSelect;

// Direct Messages within conversations
export const directMessages = pgTable("direct_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => directConversations.id, { onDelete: 'cascade' }),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  content: text("content").notNull(), // 5000 char limit enforced via validation
  isFromAdmin: boolean("is_from_admin").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_direct_messages_conversation").on(table.conversationId),
  index("IDX_direct_messages_sender").on(table.senderId),
]);

export const directMessagesRelations = relations(directMessages, ({ one }) => ({
  conversation: one(directConversations, {
    fields: [directMessages.conversationId],
    references: [directConversations.id],
  }),
  sender: one(users, {
    fields: [directMessages.senderId],
    references: [users.id],
  }),
}));

export const insertDirectMessageSchema = createInsertSchema(directMessages).omit({
  id: true,
  createdAt: true,
}).extend({
  content: z.string().min(1).max(5000),
});
export type InsertDirectMessage = z.infer<typeof insertDirectMessageSchema>;
export type DirectMessage = typeof directMessages.$inferSelect;

// Track read status for conversations
export const directConversationReadStatus = pgTable("direct_conversation_read_status", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => directConversations.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  lastReadAt: timestamp("last_read_at").defaultNow(),
}, (table) => [
  index("IDX_read_status_conversation").on(table.conversationId),
  index("IDX_read_status_user").on(table.userId),
]);

export const insertDirectConversationReadStatusSchema = createInsertSchema(directConversationReadStatus).omit({
  id: true,
});
export type InsertDirectConversationReadStatus = z.infer<typeof insertDirectConversationReadStatusSchema>;
export type DirectConversationReadStatus = typeof directConversationReadStatus.$inferSelect;

// ============================================================================
// LEGISLATIVE SOURCE ADAPTERS - Normalized multi-source monitoring system
// ============================================================================

// Topic tags for filtering which updates go to which templates
export const topicTagEnum = pgEnum('topic_tag', [
  'landlord_tenant',
  'nahasda_core',
  'tribal_adjacent',
  'ihbg',
  'hud_general',
  'fair_housing',
  'security_deposit',
  'eviction',
  'environmental',
  'procurement',
  'income_limits',
  'not_relevant',
]);

// Jurisdiction level for filtering
export const jurisdictionLevelEnum = pgEnum('jurisdiction_level', [
  'federal',
  'state',
  'tribal',
  'local',
]);

// Item types from various sources
export const legislationItemTypeEnum = pgEnum('legislation_item_type', [
  'bill',
  'regulation',
  'case',
  'notice',
  'cfr_change',
]);

// Severity levels
export const severityEnum = pgEnum('severity_level', [
  'low',
  'medium',
  'high',
  'critical',
]);

// Source type (API or page polling)
export const sourceTypeEnum = pgEnum('source_type', [
  'api',
  'page_poll',
]);

// Legislation Sources - configuration for each data source
export const legislationSources = pgTable("legislation_sources", {
  id: varchar("id").primaryKey(), // e.g., 'legiscan', 'federal_register'
  name: text("name").notNull(),
  type: sourceTypeEnum("type").notNull(),
  enabled: boolean("enabled").default(true),
  pollIntervalMinutes: integer("poll_interval_minutes").default(720), // 12 hours default
  lastCursor: text("last_cursor"), // For pagination/incremental fetching
  lastSeenDate: timestamp("last_seen_date"),
  lastRunAt: timestamp("last_run_at"),
  lastRunStatus: varchar("last_run_status"), // 'success', 'partial', 'failed'
  lastRunError: text("last_run_error"),
  topicFilter: text("topic_filter").array(), // Only fetch items matching these topics
  stateFilter: text("state_filter").array(), // Only fetch items for these states
  config: jsonb("config"), // Additional source-specific configuration
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertLegislationSourceSchema = createInsertSchema(legislationSources).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertLegislationSource = z.infer<typeof insertLegislationSourceSchema>;
export type LegislationSource = typeof legislationSources.$inferSelect;

// Raw Legislation Items - stores original data from sources for audit trail
export const rawLegislationItems = pgTable("raw_legislation_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceId: varchar("source_id").notNull().references(() => legislationSources.id),
  externalId: text("external_id").notNull(), // ID from the source (bill_id, doc_number, etc.)
  url: text("url"),
  publishedAt: timestamp("published_at"),
  title: text("title").notNull(),
  body: text("body"), // Full text or summary
  rawData: jsonb("raw_data").notNull(), // Original API response
  contentHash: text("content_hash"), // For detecting changes
  fetchedAt: timestamp("fetched_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_raw_items_source").on(table.sourceId),
  index("IDX_raw_items_external").on(table.externalId),
  index("IDX_raw_items_published").on(table.publishedAt),
]);

export const insertRawLegislationItemSchema = createInsertSchema(rawLegislationItems).omit({
  id: true,
  fetchedAt: true,
  createdAt: true,
});
export type InsertRawLegislationItem = z.infer<typeof insertRawLegislationItemSchema>;
export type RawLegislationItem = typeof rawLegislationItems.$inferSelect;

// Normalized Updates - unified format from all sources for downstream processing
export const normalizedUpdates = pgTable("normalized_updates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceId: varchar("source_id").notNull().references(() => legislationSources.id),
  rawItemId: varchar("raw_item_id").references(() => rawLegislationItems.id),
  sourceKey: text("source_key").notNull(), // Unique ID from source
  crossRefKey: text("cross_ref_key"), // For deduplication across sources (e.g., 'UT-HB123-2026')
  itemType: legislationItemTypeEnum("item_type").notNull(),
  jurisdictionLevel: jurisdictionLevelEnum("jurisdiction_level").notNull(),
  jurisdictionState: varchar("jurisdiction_state", { length: 2 }),
  jurisdictionTribe: text("jurisdiction_tribe"),
  title: text("title").notNull(),
  summary: text("summary"),
  status: text("status"),
  introducedDate: timestamp("introduced_date"),
  effectiveDate: timestamp("effective_date"),
  publishedAt: timestamp("published_at"),
  url: text("url"),
  pdfUrl: text("pdf_url"),
  topics: text("topics").array().notNull(), // Array of topic_tag values
  severity: severityEnum("severity"),
  cfrReferences: jsonb("cfr_references"), // Array of {title, part, section}
  // AI Analysis
  aiAnalyzed: boolean("ai_analyzed").default(false),
  aiRelevanceScore: integer("ai_relevance_score"), // 0-100
  aiAnalysis: text("ai_analysis"),
  aiRecommendedActions: text("ai_recommended_actions"),
  affectedTemplateIds: text("affected_template_ids").array(),
  // Processing status
  isDuplicate: boolean("is_duplicate").default(false),
  duplicateOfId: varchar("duplicate_of_id"),
  isProcessed: boolean("is_processed").default(false),
  processedAt: timestamp("processed_at"),
  isQueued: boolean("is_queued").default(false),
  queuedAt: timestamp("queued_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("IDX_normalized_source").on(table.sourceId),
  index("IDX_normalized_crossref").on(table.crossRefKey),
  index("IDX_normalized_topics").on(table.topics),
  index("IDX_normalized_jurisdiction").on(table.jurisdictionLevel, table.jurisdictionState),
  index("IDX_normalized_processed").on(table.isProcessed),
]);

export const insertNormalizedUpdateSchema = createInsertSchema(normalizedUpdates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertNormalizedUpdate = z.infer<typeof insertNormalizedUpdateSchema>;
export type NormalizedUpdate = typeof normalizedUpdates.$inferSelect;

// Template Topic Routing - defines which topics update which templates
export const templateTopicRouting = pgTable("template_topic_routing", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").notNull().references(() => templates.id),
  topic: topicTagEnum("topic").notNull(),
  jurisdictionLevel: jurisdictionLevelEnum("jurisdiction_level"),
  jurisdictionState: varchar("jurisdiction_state", { length: 2 }),
  jurisdictionTribe: text("jurisdiction_tribe"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_routing_template").on(table.templateId),
  index("IDX_routing_topic").on(table.topic),
]);

export const insertTemplateTopicRoutingSchema = createInsertSchema(templateTopicRouting).omit({
  id: true,
  createdAt: true,
});
export type InsertTemplateTopicRouting = z.infer<typeof insertTemplateTopicRoutingSchema>;
export type TemplateTopicRouting = typeof templateTopicRouting.$inferSelect;

// Source Runs - tracks each ingestion run for a source
export const sourceRunStatusEnum = pgEnum('source_run_status', [
  'running',
  'success',
  'partial',
  'failed',
]);

export const sourceRuns = pgTable("source_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceKey: varchar("source_key").notNull(), // e.g., 'federal_register', 'ut_glen'
  startedAt: timestamp("started_at").defaultNow(),
  finishedAt: timestamp("finished_at"),
  status: sourceRunStatusEnum("status").default('running'),
  cursorBefore: text("cursor_before"), // Pagination state before run
  cursorAfter: text("cursor_after"), // Pagination state after run
  newItemsCount: integer("new_items_count").default(0),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_source_runs_source").on(table.sourceKey),
  index("IDX_source_runs_started").on(table.startedAt),
]);

export const insertSourceRunSchema = createInsertSchema(sourceRuns).omit({
  id: true,
  createdAt: true,
});
export type InsertSourceRun = z.infer<typeof insertSourceRunSchema>;
export type SourceRun = typeof sourceRuns.$inferSelect;

// Release Batches - tracks monthly publishing cycles
export const releaseBatchStatusEnum = pgEnum('release_batch_status', [
  'running',
  'pending_review',
  'publishing',
  'published',
  'failed',
  'aborted',
]);

export const releaseBatches = pgTable("release_batches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  batchType: varchar("batch_type").notNull().default('monthly'), // 'monthly', 'manual', 'hotfix'
  period: varchar("period").notNull(), // e.g., '2026-02' for Feb 2026
  startedAt: timestamp("started_at").defaultNow(),
  publishedAt: timestamp("published_at"),
  status: releaseBatchStatusEnum("status").default('running'),
  updatesProcessed: integer("updates_processed").default(0),
  templatesQueued: integer("templates_queued").default(0),
  templatesApproved: integer("templates_approved").default(0),
  templatesBuilt: integer("templates_built").default(0),
  errorMessage: text("error_message"),
  summaryReport: text("summary_report"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_release_batches_period").on(table.period),
  index("IDX_release_batches_status").on(table.status),
]);

export const insertReleaseBatchSchema = createInsertSchema(releaseBatches).omit({
  id: true,
  createdAt: true,
});
export type InsertReleaseBatch = z.infer<typeof insertReleaseBatchSchema>;
export type ReleaseBatch = typeof releaseBatches.$inferSelect;

// Document Builds - tracks DOCX/PDF generation for templates
export const documentBuildStatusEnum = pgEnum('document_build_status', [
  'queued',
  'building',
  'success',
  'failed',
]);

export const documentBuilds = pgTable("document_builds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").notNull().references(() => templates.id),
  templateVersion: integer("template_version").notNull(),
  batchId: varchar("batch_id").references(() => releaseBatches.id),
  docxPath: text("docx_path"),
  pdfPath: text("pdf_path"),
  docxChecksum: text("docx_checksum"),
  pdfChecksum: text("pdf_checksum"),
  status: documentBuildStatusEnum("status").default('queued'),
  errorMessage: text("error_message"),
  buildStartedAt: timestamp("build_started_at"),
  buildFinishedAt: timestamp("build_finished_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_document_builds_template").on(table.templateId),
  index("IDX_document_builds_batch").on(table.batchId),
  index("IDX_document_builds_status").on(table.status),
]);

export const insertDocumentBuildSchema = createInsertSchema(documentBuilds).omit({
  id: true,
  createdAt: true,
});
export type InsertDocumentBuild = z.infer<typeof insertDocumentBuildSchema>;
export type DocumentBuild = typeof documentBuilds.$inferSelect;

// Update status enum for normalized updates workflow
export const updateWorkflowStatusEnum = pgEnum('update_workflow_status', [
  'new',
  'queued',
  'in_review',
  'approved',
  'published',
  'ignored',
]);

// Decoder types for state notes
export const decoderTypeEnum = pgEnum('decoder_type', [
  'credit',
  'criminal_eviction',
]);

// State note status for approval workflow
export const stateNoteStatusEnum = pgEnum('state_note_status', [
  'draft',
  'in_review',
  'approved',
  'archived',
]);

// State Notes - vetted state-specific snippets for decoders
export const stateNotes = pgTable("state_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stateId: varchar("state_id", { length: 2 }).notNull().references(() => states.id),
  decoder: decoderTypeEnum("decoder").notNull(),
  topic: varchar("topic", { length: 50 }).notNull(), // Controlled list from decoderTopics.ts
  title: text("title").notNull(), // e.g., "State-Specific Notes (Illinois)"
  bullets: jsonb("bullets").notNull().$type<string[]>(), // Array of bullet point strings
  isActive: boolean("is_active").default(true),
  version: integer("version").default(1),
  status: stateNoteStatusEnum("status").default('draft'),
  lastReviewedAt: timestamp("last_reviewed_at"),
  reviewedByUserId: varchar("reviewed_by_user_id").references(() => users.id),
  approvalChecklist: jsonb("approval_checklist").$type<Record<string, boolean>>(), // Checklist responses
  sourceLinks: jsonb("source_links").$type<string[]>(), // Internal references, not shown to users
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("IDX_state_notes_state").on(table.stateId),
  index("IDX_state_notes_decoder").on(table.decoder),
  index("IDX_state_notes_topic").on(table.topic),
  index("IDX_state_notes_status").on(table.status),
]);

export const stateNotesRelations = relations(stateNotes, ({ one }) => ({
  state: one(states, {
    fields: [stateNotes.stateId],
    references: [states.id],
  }),
  reviewedBy: one(users, {
    fields: [stateNotes.reviewedByUserId],
    references: [users.id],
  }),
}));

export const insertStateNoteSchema = createInsertSchema(stateNotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertStateNote = z.infer<typeof insertStateNoteSchema>;
export type StateNote = typeof stateNotes.$inferSelect;

// ===== DENIAL DECISION ASSISTANT TABLES =====

// Cities - for city-level screening rule overrides
export const cities = pgTable("cities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // "Los Angeles", "Chicago", etc.
  stateId: varchar("state_id", { length: 2 }).notNull().references(() => states.id),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_cities_state").on(table.stateId),
]);

export const citiesRelations = relations(cities, ({ one }) => ({
  state: one(states, {
    fields: [cities.stateId],
    references: [states.id],
  }),
}));

export const insertCitySchema = createInsertSchema(cities).omit({
  id: true,
  createdAt: true,
});
export type InsertCity = z.infer<typeof insertCitySchema>;
export type City = typeof cities.$inferSelect;

// Counties - for county-level screening rule overrides (e.g., Cook County, IL)
export const counties = pgTable("counties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // "Cook County", "Maricopa County", etc.
  stateId: varchar("state_id", { length: 2 }).notNull().references(() => states.id),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_counties_state").on(table.stateId),
]);

export const countiesRelations = relations(counties, ({ one }) => ({
  state: one(states, {
    fields: [counties.stateId],
    references: [states.id],
  }),
}));

export const insertCountySchema = createInsertSchema(counties).omit({
  id: true,
  createdAt: true,
});
export type InsertCounty = z.infer<typeof insertCountySchema>;
export type County = typeof counties.$inferSelect;

// Denial criteria categories
export const denialCriteriaCategoryEnum = pgEnum('denial_criteria_category', [
  'criminal',
  'eviction',
  'credit',
  'income',
  'verification',
]);

// Rule status - what happens when this criterion is present
export const criteriaRuleStatusEnum = pgEnum('criteria_rule_status', [
  'blocked',        // Cannot use as denial reason
  'allowed',        // Can use as denial reason
  'conditional',    // Requires additional workflow (fair chance, etc.)
]);

// Denial Criteria - master list of screening criteria
export const denialCriteria = pgTable("denial_criteria", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code", { length: 50 }).notNull().unique(), // e.g., "CRIM_ARREST", "EVICT_FILING"
  category: denialCriteriaCategoryEnum("category").notNull(),
  label: text("label").notNull(), // "Arrest (no conviction)"
  description: text("description"), // Longer explanation
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDenialCriteriaSchema = createInsertSchema(denialCriteria).omit({
  id: true,
  createdAt: true,
});
export type InsertDenialCriteria = z.infer<typeof insertDenialCriteriaSchema>;
export type DenialCriteria = typeof denialCriteria.$inferSelect;

// Denial Criteria Rules - BLOCK/ALLOW rules per jurisdiction (state, county, or city)
export const denialCriteriaRules = pgTable("denial_criteria_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  criteriaId: varchar("criteria_id").notNull().references(() => denialCriteria.id),
  stateId: varchar("state_id", { length: 2 }).references(() => states.id), // null = federal default
  countyId: varchar("county_id").references(() => counties.id), // null = state-level rule
  cityId: varchar("city_id").references(() => cities.id), // null = state/county-level rule
  status: criteriaRuleStatusEnum("status").notNull(),
  explanationPlain: text("explanation_plain"), // "Not allowed in this city because..."
  whyItMatters: text("why_it_matters"), // Tooltip content
  legalAlternative: text("legal_alternative"), // "What you can use instead"
  requiredSteps: jsonb("required_steps").$type<string[]>(), // ["individual_assessment", "pre_adverse_notice"]
  statuteCitation: text("statute_citation"), // Legal reference
  effectiveDate: timestamp("effective_date").defaultNow(),
  endDate: timestamp("end_date"), // null = still in effect
  version: integer("version").default(1),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("IDX_criteria_rules_criteria").on(table.criteriaId),
  index("IDX_criteria_rules_state").on(table.stateId),
  index("IDX_criteria_rules_county").on(table.countyId),
  index("IDX_criteria_rules_city").on(table.cityId),
]);

export const denialCriteriaRulesRelations = relations(denialCriteriaRules, ({ one }) => ({
  criteria: one(denialCriteria, {
    fields: [denialCriteriaRules.criteriaId],
    references: [denialCriteria.id],
  }),
  state: one(states, {
    fields: [denialCriteriaRules.stateId],
    references: [states.id],
  }),
  county: one(counties, {
    fields: [denialCriteriaRules.countyId],
    references: [counties.id],
  }),
  city: one(cities, {
    fields: [denialCriteriaRules.cityId],
    references: [cities.id],
  }),
}));

export const insertDenialCriteriaRuleSchema = createInsertSchema(denialCriteriaRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertDenialCriteriaRule = z.infer<typeof insertDenialCriteriaRuleSchema>;
export type DenialCriteriaRule = typeof denialCriteriaRules.$inferSelect;

// Denial Sentence Templates - pre-approved denial language
export const denialSentenceTemplates = pgTable("denial_sentence_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  criteriaId: varchar("criteria_id").notNull().references(() => denialCriteria.id),
  stateId: varchar("state_id", { length: 2 }).references(() => states.id), // null = universal
  cityId: varchar("city_id").references(() => cities.id), // null = state-level
  sentenceText: text("sentence_text").notNull(), // The actual denial sentence
  toneTags: jsonb("tone_tags").$type<string[]>(), // ["neutral", "combined", "incomplete"]
  isDefault: boolean("is_default").default(false), // Use this if no jurisdiction-specific exists
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_sentence_templates_criteria").on(table.criteriaId),
  index("IDX_sentence_templates_state").on(table.stateId),
]);

export const denialSentenceTemplatesRelations = relations(denialSentenceTemplates, ({ one }) => ({
  criteria: one(denialCriteria, {
    fields: [denialSentenceTemplates.criteriaId],
    references: [denialCriteria.id],
  }),
  state: one(states, {
    fields: [denialSentenceTemplates.stateId],
    references: [states.id],
  }),
  city: one(cities, {
    fields: [denialSentenceTemplates.cityId],
    references: [cities.id],
  }),
}));

export const insertDenialSentenceTemplateSchema = createInsertSchema(denialSentenceTemplates).omit({
  id: true,
  createdAt: true,
});
export type InsertDenialSentenceTemplate = z.infer<typeof insertDenialSentenceTemplateSchema>;
export type DenialSentenceTemplate = typeof denialSentenceTemplates.$inferSelect;

// Decision outcome type
export const decisionOutcomeEnum = pgEnum('decision_outcome', [
  'approve',
  'conditional',
  'deny',
]);

// Denial Decision Audit Logs - immutable record of every decision
export const denialDecisionAuditLogs = pgTable("denial_decision_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  propertyId: varchar("property_id").references(() => properties.id),
  applicantName: text("applicant_name"), // For reference, not PII stored
  stateId: varchar("state_id", { length: 2 }).notNull().references(() => states.id),
  countyId: varchar("county_id").references(() => counties.id),
  countyName: text("county_name"), // Snapshot in case county record changes
  cityId: varchar("city_id").references(() => cities.id),
  cityName: text("city_name"), // Snapshot in case city record changes
  ruleVersion: text("rule_version").notNull(), // Hash or version ID of rules at decision time
  outcome: decisionOutcomeEnum("outcome").notNull(),
  criteriaPresent: jsonb("criteria_present").$type<string[]>().notNull(), // Codes of criteria marked "present"
  criteriaSelectedForDenial: jsonb("criteria_selected_for_denial").$type<string[]>(), // Codes selected as reasons
  blockedCriteriaShown: jsonb("blocked_criteria_shown").$type<string[]>(), // Codes that were blocked
  generatedDenialText: text("generated_denial_text"),
  adverseActionLetterGenerated: boolean("adverse_action_letter_generated").default(false),
  adverseActionLetterId: varchar("adverse_action_letter_id"),
  letterTypeDownloaded: varchar("letter_type_downloaded", { length: 50 }), // 'pre_adverse' or 'adverse_action'
  conditions: jsonb("conditions").$type<string[]>(), // For conditional approvals
  fairChanceStepsCompleted: jsonb("fair_chance_steps_completed").$type<Record<string, boolean>>(),
  noticesProvided: jsonb("notices_provided").$type<string[]>(), // ["adverse_action", "pre_adverse", etc.]
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_audit_logs_user").on(table.userId),
  index("IDX_audit_logs_state").on(table.stateId),
  index("IDX_audit_logs_created").on(table.createdAt),
]);

export const denialDecisionAuditLogsRelations = relations(denialDecisionAuditLogs, ({ one }) => ({
  user: one(users, {
    fields: [denialDecisionAuditLogs.userId],
    references: [users.id],
  }),
  property: one(properties, {
    fields: [denialDecisionAuditLogs.propertyId],
    references: [properties.id],
  }),
  state: one(states, {
    fields: [denialDecisionAuditLogs.stateId],
    references: [states.id],
  }),
  county: one(counties, {
    fields: [denialDecisionAuditLogs.countyId],
    references: [counties.id],
  }),
  city: one(cities, {
    fields: [denialDecisionAuditLogs.cityId],
    references: [cities.id],
  }),
}));

export const insertDenialDecisionAuditLogSchema = createInsertSchema(denialDecisionAuditLogs).omit({
  id: true,
  createdAt: true,
});
export type InsertDenialDecisionAuditLog = z.infer<typeof insertDenialDecisionAuditLogSchema>;
export type DenialDecisionAuditLog = typeof denialDecisionAuditLogs.$inferSelect;

// Document Re-upload Tokens - secure links for applicants to re-upload missing docs
export const documentReuploadTokens = pgTable("document_reupload_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  personId: varchar("person_id").notNull().references(() => rentalSubmissionPeople.id, { onDelete: 'cascade' }),
  allowedFileTypes: jsonb("allowed_file_types").notNull().$type<string[]>(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  revokedAt: timestamp("revoked_at"),
  createdByUserId: text("created_by_user_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const documentReuploadTokensRelations = relations(documentReuploadTokens, ({ one }) => ({
  person: one(rentalSubmissionPeople, {
    fields: [documentReuploadTokens.personId],
    references: [rentalSubmissionPeople.id],
  }),
}));

export const insertDocumentReuploadTokenSchema = createInsertSchema(documentReuploadTokens).omit({
  id: true,
  createdAt: true,
});
export type InsertDocumentReuploadToken = z.infer<typeof insertDocumentReuploadTokenSchema>;
export type DocumentReuploadToken = typeof documentReuploadTokens.$inferSelect;

// ============================================================================
// COMPLIANCE MATRIX — State-Specific Legal Notice Forms
// ============================================================================
// Engine code MUST NOT branch on state_code or form keys.
// All behavior is derived from matrix-provided enums and rules.
// ============================================================================

// --- Enums ---

export const noticeFormStatusEnum = pgEnum('notice_form_status', [
  'draft',
  'approved',
  'review_required',
  'retired',
]);

export const localOverlayRiskEnum = pgEnum('local_overlay_risk', [
  'low',
  'med',
  'high',
]);

export const dayTypeEnum = pgEnum('day_type', [
  'calendar',
  'business',
  'judicial',
  'judicial_holidays_excluded',
]);

export const countingConventionEnum = pgEnum('counting_convention', [
  'day0_service_plus_n',
]);

export const outputModeEnum = pgEnum('output_mode', [
  'official_pdf_overlay',
  'leaseshield_formatted',
]);

export const renderStrategyEnum = pgEnum('render_strategy', [
  'form_fields',
  'coordinates',
]);

export const formFieldTypeEnum = pgEnum('form_field_type', [
  'text',
  'money',
  'date',
  'select',
  'checkbox',
  'textarea',
  'number',
]);

export const validationTypeEnum = pgEnum('validation_type', [
  'regex',
  'min',
  'max',
  'disallow_tokens',
  'required_if',
  'custom_rule',
]);

export const languageBlockTypeEnum = pgEnum('language_block_type', [
  'statutory_language',
  'tenant_warning',
  'tenant_options_cure',
  'local_disclaimer',
  'other',
]);

export const serviceLeaseGateTypeEnum = pgEnum('service_lease_gate_type', [
  'boolean',
  'number',
  'select',
]);

export const overlayAlignEnum = pgEnum('overlay_align', [
  'left',
  'center',
  'right',
]);

export const noticeAuditEventTypeEnum = pgEnum('notice_audit_event_type', [
  'date_override',
  'form_generated',
  'holiday_table_updated',
  'form_locked',
  'form_approved',
  'form_retired',
]);

// --- Phase 1A: Core reference + versioning tables ---

export const noticeForms = pgTable("notice_forms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stateId: varchar("state_id", { length: 2 }).notNull().references(() => states.id),
  key: varchar("key").notNull().unique(),
  displayName: varchar("display_name").notNull(),
  category: varchar("notice_category", { length: 50 }).notNull(),
  localOverlayRisk: localOverlayRiskEnum("local_overlay_risk").notNull().default('low'),
  disclaimerText: text("disclaimer_text"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_notice_forms_state").on(table.stateId),
  index("idx_notice_forms_category").on(table.category),
]);

export const noticeFormVersions = pgTable("notice_form_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  formId: varchar("form_id").notNull().references(() => noticeForms.id, { onDelete: 'cascade' }),
  versionNumber: integer("version_number").notNull().default(1),
  effectiveStart: date("effective_start"),
  effectiveEnd: date("effective_end"),
  status: noticeFormStatusEnum("status").notNull().default('draft'),
  approvalNotes: text("approval_notes"),
  statuteSnapshotText: text("statute_snapshot_text"),
  statuteRetrievedAt: timestamp("statute_retrieved_at"),
  statuteSourceCitation: text("statute_source_citation"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_notice_form_versions_form").on(table.formId),
  index("idx_notice_form_versions_status").on(table.status),
]);

export const holidayCalendars = pgTable("holiday_calendars", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stateId: varchar("state_id", { length: 2 }).notNull().references(() => states.id),
  name: varchar("name").notNull(),
  year: integer("year").notNull(),
  version: varchar("version").notNull(),
  sourceName: varchar("source_name"),
  sourceCitation: text("source_citation"),
  retrievedAt: timestamp("retrieved_at"),
  sourceAttachmentPath: text("source_attachment_path"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_holiday_calendars_state_year").on(table.stateId, table.year),
]);

export const holidayCalendarDates = pgTable("holiday_calendar_dates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  holidayCalendarId: varchar("holiday_calendar_id").notNull().references(() => holidayCalendars.id, { onDelete: 'cascade' }),
  date: date("date").notNull(),
  label: text("label").notNull(),
}, (table) => [
  index("idx_holiday_calendar_dates_cal").on(table.holidayCalendarId),
]);

// --- Phase 1B: Day rules + service methods ---

export const formDayRules = pgTable("form_day_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  formVersionId: varchar("form_version_id").notNull().references(() => noticeFormVersions.id, { onDelete: 'cascade' }),
  dayType: dayTypeEnum("day_type").notNull(),
  noticePeriodDays: integer("notice_period_days").notNull(),
  countingConvention: countingConventionEnum("counting_convention").notNull().default('day0_service_plus_n'),
  holidayCalendarId: varchar("holiday_calendar_id").references(() => holidayCalendars.id),
}, (table) => [
  index("idx_form_day_rules_version").on(table.formVersionId),
]);

export const serviceMethods = pgTable("service_methods", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key").notNull().unique(),
  displayName: varchar("display_name").notNull(),
});

export const formServiceRules = pgTable("form_service_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  formVersionId: varchar("form_version_id").notNull().references(() => noticeFormVersions.id, { onDelete: 'cascade' }),
  methodId: varchar("method_id").notNull().references(() => serviceMethods.id),
  isAllowed: boolean("is_allowed").notNull().default(true),
  requiresPriorAttempts: boolean("requires_prior_attempts").notNull().default(false),
  priorAttemptMethodIds: jsonb("prior_attempt_method_ids").$type<string[]>().default([]),
  requiresAdditionalMethods: boolean("requires_additional_methods").notNull().default(false),
  additionalMethodIds: jsonb("additional_method_ids").$type<string[]>().default([]),
  ackText: text("ack_text"),
  requiresAck: boolean("requires_ack").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
}, (table) => [
  index("idx_form_service_rules_version").on(table.formVersionId),
]);

export const formServiceLeaseGates = pgTable("form_service_lease_gates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  formVersionId: varchar("form_version_id").notNull().references(() => noticeFormVersions.id, { onDelete: 'cascade' }),
  gateKey: varchar("gate_key").notNull(),
  promptText: text("prompt_text").notNull(),
  required: boolean("required").notNull().default(true),
  type: serviceLeaseGateTypeEnum("type").notNull(),
  selectOptions: jsonb("select_options").$type<string[]>(),
  affectsNoticePeriod: boolean("affects_notice_period").notNull().default(false),
  affectsServiceMethods: boolean("affects_service_methods").notNull().default(false),
  affectedMethodIds: jsonb("affected_method_ids").$type<string[]>().default([]),
}, (table) => [
  index("idx_form_service_lease_gates_version").on(table.formVersionId),
]);

// --- Phase 1C: Language blocks + wizard fields + validation ---

export const languageBlocks = pgTable("language_blocks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key").notNull().unique(),
  text: text("text").notNull(),
  sourceCitation: text("source_citation"),
  retrievedAt: timestamp("retrieved_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const formRequiredLanguage = pgTable("form_required_language", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  formVersionId: varchar("form_version_id").notNull().references(() => noticeFormVersions.id, { onDelete: 'cascade' }),
  blockType: languageBlockTypeEnum("block_type").notNull(),
  languageBlockId: varchar("language_block_id").notNull().references(() => languageBlocks.id),
  isRequired: boolean("is_required").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
}, (table) => [
  index("idx_form_required_language_version").on(table.formVersionId),
]);

export const formFields = pgTable("form_fields", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  formVersionId: varchar("form_version_id").notNull().references(() => noticeFormVersions.id, { onDelete: 'cascade' }),
  key: varchar("key").notNull(),
  label: varchar("label").notNull(),
  type: formFieldTypeEnum("type").notNull(),
  required: boolean("required").notNull().default(true),
  helpText: text("help_text"),
  defaultValue: text("default_value"),
  selectOptions: jsonb("select_options").$type<string[]>(),
  visibilityRule: jsonb("visibility_rule"),
  sortOrder: integer("sort_order").notNull().default(0),
  fieldGroup: varchar("field_group"),
}, (table) => [
  index("idx_form_fields_version").on(table.formVersionId),
]);

export const fieldValidations = pgTable("field_validations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fieldId: varchar("field_id").notNull().references(() => formFields.id, { onDelete: 'cascade' }),
  validationType: validationTypeEnum("validation_type").notNull(),
  params: jsonb("params"),
  errorMessage: text("error_message").notNull(),
}, (table) => [
  index("idx_field_validations_field").on(table.fieldId),
]);

// --- Phase 1D: Output rendering + generation audit ---

export const outputTemplates = pgTable("output_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  formVersionId: varchar("form_version_id").notNull().references(() => noticeFormVersions.id, { onDelete: 'cascade' }),
  mode: outputModeEnum("mode").notNull(),
  renderStrategy: renderStrategyEnum("render_strategy").default('form_fields'),
  basePdfAttachmentPath: text("base_pdf_attachment_path"),
  htmlTemplate: text("html_template"),
  docxTemplateAttachmentPath: text("docx_template_attachment_path"),
  pageCount: integer("page_count"),
  // For form_fields strategy: JSON mapping of field_key → exact pdf_field_name
  // Preferred over any in-code field map constant — enables new forms without code changes
  fieldMapJson: jsonb("field_map_json").$type<Record<string, string>>(),
}, (table) => [
  index("idx_output_templates_version").on(table.formVersionId),
]);

export const overlayFields = pgTable("overlay_fields", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  outputTemplateId: varchar("output_template_id").notNull().references(() => outputTemplates.id, { onDelete: 'cascade' }),
  fieldKey: varchar("field_key").notNull(),
  pageNumber: integer("page_number").notNull().default(1),
  x: doublePrecision("x").notNull(),
  y: doublePrecision("y").notNull(),
  font: varchar("font").default('Helvetica'),
  fontSize: doublePrecision("font_size").default(10),
  maxWidth: doublePrecision("max_width"),
  align: overlayAlignEnum("align").default('left'),
  wrap: boolean("wrap").default(false),
}, (table) => [
  index("idx_overlay_fields_template").on(table.outputTemplateId),
]);

export const generatedNoticeDocuments = pgTable("generated_notice_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  formVersionId: varchar("form_version_id").notNull().references(() => noticeFormVersions.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  inputs: jsonb("inputs").notNull().$type<Record<string, string | number | boolean>>(),
  serviceSelection: jsonb("service_selection").$type<Record<string, boolean | string>>(),
  leaseGateAnswers: jsonb("lease_gate_answers").$type<Record<string, string | number | boolean>>(),
  calculatedComplianceDeadline: date("calculated_compliance_deadline"),
  calculatedEarliestFilingDate: date("calculated_earliest_filing_date"),
  holidayCalendarVersionUsed: varchar("holiday_calendar_version_used"),
  overrideComplianceDeadline: date("override_compliance_deadline"),
  overrideConfirmedAt: timestamp("override_confirmed_at"),
  pdfAttachmentPath: text("pdf_attachment_path"),
  docxAttachmentPath: text("docx_attachment_path"),
  isImmutable: boolean("is_immutable").notNull().default(true),
  renderModeUsed: varchar("render_mode_used"),
  renderStrategyUsed: varchar("render_strategy_used"),
  basePdfSha256: varchar("base_pdf_sha256"),
  outputPdfSha256: varchar("output_pdf_sha256"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_generated_notice_docs_user").on(table.userId),
  index("idx_generated_notice_docs_version").on(table.formVersionId),
]);

export const noticeAuditEvents = pgTable("notice_audit_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  generatedDocumentId: varchar("generated_document_id").references(() => generatedNoticeDocuments.id),
  formVersionId: varchar("form_version_id").references(() => noticeFormVersions.id),
  userId: varchar("user_id").references(() => users.id),
  eventType: noticeAuditEventTypeEnum("event_type").notNull(),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_notice_audit_events_doc").on(table.generatedDocumentId),
  index("idx_notice_audit_events_type").on(table.eventType),
]);

// --- Relations ---

export const noticeFormsRelations = relations(noticeForms, ({ one, many }) => ({
  state: one(states, { fields: [noticeForms.stateId], references: [states.id] }),
  versions: many(noticeFormVersions),
}));

export const noticeFormVersionsRelations = relations(noticeFormVersions, ({ one, many }) => ({
  form: one(noticeForms, { fields: [noticeFormVersions.formId], references: [noticeForms.id] }),
  dayRules: many(formDayRules),
  serviceRules: many(formServiceRules),
  leaseGates: many(formServiceLeaseGates),
  requiredLanguage: many(formRequiredLanguage),
  fields: many(formFields),
  outputTemplates: many(outputTemplates),
}));

export const holidayCalendarsRelations = relations(holidayCalendars, ({ one, many }) => ({
  state: one(states, { fields: [holidayCalendars.stateId], references: [states.id] }),
  dates: many(holidayCalendarDates),
}));

export const holidayCalendarDatesRelations = relations(holidayCalendarDates, ({ one }) => ({
  calendar: one(holidayCalendars, { fields: [holidayCalendarDates.holidayCalendarId], references: [holidayCalendars.id] }),
}));

export const formDayRulesRelations = relations(formDayRules, ({ one }) => ({
  formVersion: one(noticeFormVersions, { fields: [formDayRules.formVersionId], references: [noticeFormVersions.id] }),
  holidayCalendar: one(holidayCalendars, { fields: [formDayRules.holidayCalendarId], references: [holidayCalendars.id] }),
}));

export const formServiceRulesRelations = relations(formServiceRules, ({ one }) => ({
  formVersion: one(noticeFormVersions, { fields: [formServiceRules.formVersionId], references: [noticeFormVersions.id] }),
  method: one(serviceMethods, { fields: [formServiceRules.methodId], references: [serviceMethods.id] }),
}));

export const formServiceLeaseGatesRelations = relations(formServiceLeaseGates, ({ one }) => ({
  formVersion: one(noticeFormVersions, { fields: [formServiceLeaseGates.formVersionId], references: [noticeFormVersions.id] }),
}));

export const formRequiredLanguageRelations = relations(formRequiredLanguage, ({ one }) => ({
  formVersion: one(noticeFormVersions, { fields: [formRequiredLanguage.formVersionId], references: [noticeFormVersions.id] }),
  block: one(languageBlocks, { fields: [formRequiredLanguage.languageBlockId], references: [languageBlocks.id] }),
}));

export const formFieldsRelations = relations(formFields, ({ one, many }) => ({
  formVersion: one(noticeFormVersions, { fields: [formFields.formVersionId], references: [noticeFormVersions.id] }),
  validations: many(fieldValidations),
}));

export const fieldValidationsRelations = relations(fieldValidations, ({ one }) => ({
  field: one(formFields, { fields: [fieldValidations.fieldId], references: [formFields.id] }),
}));

export const outputTemplatesRelations = relations(outputTemplates, ({ one, many }) => ({
  formVersion: one(noticeFormVersions, { fields: [outputTemplates.formVersionId], references: [noticeFormVersions.id] }),
  overlayFields: many(overlayFields),
}));

export const overlayFieldsRelations = relations(overlayFields, ({ one }) => ({
  outputTemplate: one(outputTemplates, { fields: [overlayFields.outputTemplateId], references: [outputTemplates.id] }),
}));

export const generatedNoticeDocumentsRelations = relations(generatedNoticeDocuments, ({ one, many }) => ({
  formVersion: one(noticeFormVersions, { fields: [generatedNoticeDocuments.formVersionId], references: [noticeFormVersions.id] }),
  user: one(users, { fields: [generatedNoticeDocuments.userId], references: [users.id] }),
  auditEvents: many(noticeAuditEvents),
}));

export const noticeAuditEventsRelations = relations(noticeAuditEvents, ({ one }) => ({
  generatedDocument: one(generatedNoticeDocuments, { fields: [noticeAuditEvents.generatedDocumentId], references: [generatedNoticeDocuments.id] }),
  formVersion: one(noticeFormVersions, { fields: [noticeAuditEvents.formVersionId], references: [noticeFormVersions.id] }),
  user: one(users, { fields: [noticeAuditEvents.userId], references: [users.id] }),
}));

// --- Insert schemas + types ---

export const insertNoticeFormSchema = createInsertSchema(noticeForms).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertNoticeForm = z.infer<typeof insertNoticeFormSchema>;
export type NoticeForm = typeof noticeForms.$inferSelect;

export const insertNoticeFormVersionSchema = createInsertSchema(noticeFormVersions).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertNoticeFormVersion = z.infer<typeof insertNoticeFormVersionSchema>;
export type NoticeFormVersion = typeof noticeFormVersions.$inferSelect;

export const insertHolidayCalendarSchema = createInsertSchema(holidayCalendars).omit({ id: true, createdAt: true });
export type InsertHolidayCalendar = z.infer<typeof insertHolidayCalendarSchema>;
export type HolidayCalendar = typeof holidayCalendars.$inferSelect;

export const insertHolidayCalendarDateSchema = createInsertSchema(holidayCalendarDates).omit({ id: true });
export type InsertHolidayCalendarDate = z.infer<typeof insertHolidayCalendarDateSchema>;
export type HolidayCalendarDate = typeof holidayCalendarDates.$inferSelect;

export const insertFormDayRuleSchema = createInsertSchema(formDayRules).omit({ id: true });
export type InsertFormDayRule = z.infer<typeof insertFormDayRuleSchema>;
export type FormDayRule = typeof formDayRules.$inferSelect;

export const insertServiceMethodSchema = createInsertSchema(serviceMethods).omit({ id: true });
export type InsertServiceMethod = z.infer<typeof insertServiceMethodSchema>;
export type ServiceMethod = typeof serviceMethods.$inferSelect;

export const insertFormServiceRuleSchema = createInsertSchema(formServiceRules).omit({ id: true });
export type InsertFormServiceRule = z.infer<typeof insertFormServiceRuleSchema>;
export type FormServiceRule = typeof formServiceRules.$inferSelect;

export const insertFormServiceLeaseGateSchema = createInsertSchema(formServiceLeaseGates).omit({ id: true });
export type InsertFormServiceLeaseGate = z.infer<typeof insertFormServiceLeaseGateSchema>;
export type FormServiceLeaseGate = typeof formServiceLeaseGates.$inferSelect;

export const insertLanguageBlockSchema = createInsertSchema(languageBlocks).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLanguageBlock = z.infer<typeof insertLanguageBlockSchema>;
export type LanguageBlock = typeof languageBlocks.$inferSelect;

export const insertFormRequiredLanguageSchema = createInsertSchema(formRequiredLanguage).omit({ id: true });
export type InsertFormRequiredLanguage = z.infer<typeof insertFormRequiredLanguageSchema>;
export type FormRequiredLanguage = typeof formRequiredLanguage.$inferSelect;

export const insertFormFieldSchema = createInsertSchema(formFields).omit({ id: true });
export type InsertFormField = z.infer<typeof insertFormFieldSchema>;
export type FormField = typeof formFields.$inferSelect;

export const insertFieldValidationSchema = createInsertSchema(fieldValidations).omit({ id: true });
export type InsertFieldValidation = z.infer<typeof insertFieldValidationSchema>;
export type FieldValidation = typeof fieldValidations.$inferSelect;

export const insertOutputTemplateSchema = createInsertSchema(outputTemplates).omit({ id: true });
export type InsertOutputTemplate = z.infer<typeof insertOutputTemplateSchema>;
export type OutputTemplate = typeof outputTemplates.$inferSelect;

export const insertOverlayFieldSchema = createInsertSchema(overlayFields).omit({ id: true });
export type InsertOverlayField = z.infer<typeof insertOverlayFieldSchema>;
export type OverlayField = typeof overlayFields.$inferSelect;

export const insertGeneratedNoticeDocumentSchema = createInsertSchema(generatedNoticeDocuments).omit({ id: true, createdAt: true });
export type InsertGeneratedNoticeDocument = z.infer<typeof insertGeneratedNoticeDocumentSchema>;
export type GeneratedNoticeDocument = typeof generatedNoticeDocuments.$inferSelect;

export const insertNoticeAuditEventSchema = createInsertSchema(noticeAuditEvents).omit({ id: true, createdAt: true });
export type InsertNoticeAuditEvent = z.infer<typeof insertNoticeAuditEventSchema>;
export type NoticeAuditEvent = typeof noticeAuditEvents.$inferSelect;

// =====================================================================
// Rent Payment Requests - Online rent collection via Stripe Connect ACH
// =====================================================================
export const rentPaymentRequests = pgTable("rent_payment_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  rentalPropertyId: varchar("rental_property_id").references(() => rentalProperties.id, { onDelete: 'set null' }),
  tenantName: text("tenant_name").notNull(),
  tenantEmail: varchar("tenant_email"),
  amount: integer("amount").notNull(), // base rent in cents
  amountPaid: integer("amount_paid").default(0).notNull(), // total paid in cents
  dueDate: date("due_date").notNull(),
  description: text("description"),
  publicToken: varchar("public_token", { length: 64 }).notNull().unique(),
  // Late fee config (per lease terms)
  lateFeeAmount: integer("late_fee_amount").default(0).notNull(), // cents
  gracePeriodDays: integer("grace_period_days").default(5).notNull(),
  lateFeeAppliedAt: timestamp("late_fee_applied_at"),
  lateFeeLedgerEntryId: varchar("late_fee_ledger_entry_id"),
  // Auto-reminder config
  reminderDaysBefore: integer("reminder_days_before").default(5).notNull(),
  reminderSentAt: timestamp("reminder_sent_at"),
  // Fee config — convenience fee paid by tenant or absorbed by landlord, plus
  // LeaseShield's per-transaction platform application fee. All amounts in
  // cents. `serviceFeePayer` controls who pays the convenience fee:
  //   tenant   — added on top of rent at checkout (tenant total = rent + fee)
  //   landlord — deducted from landlord settlement (tenant pays just rent)
  //   none     — no convenience fee (only platform fee deducted)
  serviceFeeAmount: integer("service_fee_amount").default(0).notNull(),
  serviceFeePayer: varchar("service_fee_payer", { length: 16 }).default("none").notNull(),
  platformFeeAmount: integer("platform_fee_amount").default(0).notNull(),
  // Status
  // Enum: pending | reminded | processing | paid | overdue | canceled
  //       | auto_scheduled | failed   (last two added for recurring auto-bill)
  status: varchar("status", { length: 32 }).notNull().default("pending"),
  paidAt: timestamp("paid_at"),
  // Stripe references
  stripeCheckoutSessionId: varchar("stripe_checkout_session_id"),
  stripePaymentIntentId: varchar("stripe_payment_intent_id"),
  ledgerEntryId: varchar("ledger_entry_id"),
  // Recurring auto-bill linkage. NULL for legacy/one-time requests.
  // No FK at the DB level (application-layer reference only) to keep the
  // additive migration zero-risk.
  rentSubscriptionId: varchar("rent_subscription_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_rent_payment_user").on(table.userId),
  index("idx_rent_payment_status").on(table.status),
  index("idx_rent_payment_due_date").on(table.dueDate),
  index("idx_rent_payment_token").on(table.publicToken),
  index("idx_rent_payment_subscription").on(table.rentSubscriptionId),
]);

// =====================================================================
// Rent Subscriptions - Recurring auto-bill ACH (Plan B from architecture report)
// SetupIntent + saved us_bank_account PaymentMethod on the platform side +
// cron-driven PaymentIntents using transfer_data.destination = landlord acct.
// =====================================================================
export const rentSubscriptions = pgTable("rent_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  rentalPropertyId: varchar("rental_property_id").references(() => rentalProperties.id, { onDelete: 'set null' }),
  tenantName: text("tenant_name").notNull(),
  tenantEmail: varchar("tenant_email").notNull(),
  // Schedule
  amount: integer("amount").notNull(), // monthly rent in cents
  dayOfMonth: integer("day_of_month").notNull().default(1), // 1-28 (skip 29-31 for safety)
  startDate: date("start_date").notNull(),
  endDate: date("end_date"), // optional lease end
  nextScheduledDate: date("next_scheduled_date"), // null until activated
  // Late fee config (mirror of rent_payment_requests so each generated debit inherits)
  lateFeeAmount: integer("late_fee_amount").default(0).notNull(),
  gracePeriodDays: integer("grace_period_days").default(5).notNull(),
  // Tenant authorization link
  publicToken: varchar("public_token", { length: 64 }).notNull().unique(),
  // Status: pending_authorization | active | paused | revoked_by_tenant | failed | canceled | completed
  status: varchar("status", { length: 32 }).notNull().default("pending_authorization"),
  // Stripe references (platform-side, since this is Option B)
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeSetupIntentId: varchar("stripe_setup_intent_id"),
  stripeSetupCheckoutSessionId: varchar("stripe_setup_checkout_session_id"),
  stripePaymentMethodId: varchar("stripe_payment_method_id"),
  stripeMandateId: varchar("stripe_mandate_id"),
  // NACHA mandate audit trail (we snapshot the disclosure text at acceptance time
  // so prior mandates remain governed by the wording shown when accepted).
  mandateAcceptedAt: timestamp("mandate_accepted_at"),
  mandateAcceptedIp: varchar("mandate_accepted_ip", { length: 64 }),
  mandateAcceptedUserAgent: text("mandate_accepted_user_agent"),
  mandateAuthorizationText: text("mandate_authorization_text"),
  // Bank hint for tenant UI ("Chase ••8765")
  bankAccountLast4: varchar("bank_account_last4", { length: 8 }),
  bankAccountBankName: text("bank_account_bank_name"),
  // Lifecycle
  activatedAt: timestamp("activated_at"),
  revokedAt: timestamp("revoked_at"),
  revokedReason: text("revoked_reason"),
  lastDebitAttemptAt: timestamp("last_debit_attempt_at"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_rent_sub_user").on(table.userId),
  index("idx_rent_sub_status").on(table.status),
  index("idx_rent_sub_next_date").on(table.nextScheduledDate),
  index("idx_rent_sub_token").on(table.publicToken),
  // Guarantee one active subscription per (property, tenant) — prevents accidental
  // double mandates if a landlord re-sends the auth link to the same tenant.
  uniqueIndex("rent_sub_one_active_per_lease")
    .on(table.rentalPropertyId, table.tenantEmail)
    .where(sql`status = 'active'`),
]);

export const rentSubscriptionsRelations = relations(rentSubscriptions, ({ one }) => ({
  user: one(users, {
    fields: [rentSubscriptions.userId],
    references: [users.id],
  }),
  property: one(rentalProperties, {
    fields: [rentSubscriptions.rentalPropertyId],
    references: [rentalProperties.id],
  }),
}));

export const insertRentSubscriptionSchema = createInsertSchema(rentSubscriptions).omit({
  id: true,
  publicToken: true,
  status: true,
  stripeCustomerId: true,
  stripeSetupIntentId: true,
  stripeSetupCheckoutSessionId: true,
  stripePaymentMethodId: true,
  stripeMandateId: true,
  mandateAcceptedAt: true,
  mandateAcceptedIp: true,
  mandateAcceptedUserAgent: true,
  mandateAuthorizationText: true,
  bankAccountLast4: true,
  bankAccountBankName: true,
  activatedAt: true,
  revokedAt: true,
  revokedReason: true,
  lastDebitAttemptAt: true,
  nextScheduledDate: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertRentSubscription = z.infer<typeof insertRentSubscriptionSchema>;
export type RentSubscription = typeof rentSubscriptions.$inferSelect;

export const rentPaymentRequestsRelations = relations(rentPaymentRequests, ({ one }) => ({
  user: one(users, {
    fields: [rentPaymentRequests.userId],
    references: [users.id],
  }),
  property: one(rentalProperties, {
    fields: [rentPaymentRequests.rentalPropertyId],
    references: [rentalProperties.id],
  }),
}));

export const insertRentPaymentRequestSchema = createInsertSchema(rentPaymentRequests).omit({
  id: true,
  publicToken: true,
  amountPaid: true,
  paidAt: true,
  reminderSentAt: true,
  lateFeeAppliedAt: true,
  lateFeeLedgerEntryId: true,
  stripeCheckoutSessionId: true,
  stripePaymentIntentId: true,
  ledgerEntryId: true,
  status: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertRentPaymentRequest = z.infer<typeof insertRentPaymentRequestSchema>;
export type RentPaymentRequest = typeof rentPaymentRequests.$inferSelect;
