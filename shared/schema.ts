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
  subscriptionEndsAt: timestamp("subscription_ends_at"),
  subscriptionExpiresAt: timestamp("subscription_expires_at"),
  renewalReminderSentAt: timestamp("renewal_reminder_sent_at"), // Track when we sent renewal reminder
  paymentFailedAt: timestamp("payment_failed_at"), // Track when payment failed for banner display
  // User preferences
  preferredState: varchar("preferred_state", { length: 2 }), // UT, TX, ND, SD
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
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

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
  // File storage - could be URLs or file paths
  pdfUrl: text("pdf_url"),
  fillableFormData: jsonb("fillable_form_data"), // JSON structure for fillable fields
  // Generation mode: wizard = landlord fills form, static = blank download for applicants
  generationMode: generationModeEnum("generation_mode").default('wizard'),
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
  relatedTemplateId: varchar("related_template_id").references(() => templates.id), // Optional link to template
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

// Properties - user property management
export const properties = pgTable("properties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  address: text("address").notNull(),
  city: text("city"),
  state: varchar("state", { length: 2 }),
  zipCode: varchar("zip_code", { length: 10 }),
  propertyType: varchar("property_type", { length: 50 }),
  units: integer("units").default(1),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

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
});

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
]);

export const communicationTemplates = pgTable("communication_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stateId: varchar("state_id", { length: 2 }).notNull(),
  templateType: communicationTemplateTypeEnum("template_type").notNull(),
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

// Rental Properties - properties with cover page + field schema defaults
export const rentalProperties = pgTable("rental_properties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  address: text("address"),
  city: text("city"),
  state: varchar("state", { length: 2 }),
  zipCode: varchar("zip_code", { length: 10 }),
  defaultCoverPageJson: jsonb("default_cover_page_json").notNull(), // Cover page content (title, intro, sections)
  defaultFieldSchemaJson: jsonb("default_field_schema_json").notNull(), // Field visibility toggles
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
  fileType: varchar("file_type", { length: 50 }).notNull(), // gov_id, paystubs, tax_docs, other
  originalName: text("original_name").notNull(),
  storedPath: text("stored_path").notNull(),
  fileSize: integer("file_size"),
  mimeType: varchar("mime_type", { length: 100 }),
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

// Rental Screening Orders - DigitalDelve integration
export const rentalScreeningOrders = pgTable("rental_screening_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  submissionId: varchar("submission_id").notNull().unique().references(() => rentalSubmissions.id, { onDelete: 'cascade' }),
  invitationId: text("invitation_id"), // DigitalDelve invitation ID
  referenceNumber: varchar("reference_number", { length: 100 }).notNull().unique(), // Our reference number
  status: rentalScreeningStatusEnum("status").default('not_sent').notNull(),
  reportId: text("report_id"), // DigitalDelve report ID
  reportUrl: text("report_url"), // URL to view report
  rawStatusXml: text("raw_status_xml"), // Raw status webhook data
  rawResultXml: text("raw_result_xml"), // Raw result webhook data
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const rentalScreeningOrdersRelations = relations(rentalScreeningOrders, ({ one }) => ({
  submission: one(rentalSubmissions, {
    fields: [rentalScreeningOrders.submissionId],
    references: [rentalSubmissions.id],
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

// Default cover page template
export const defaultCoverPageTemplate = {
  title: "Rental Application Requirements",
  intro: "Please read the following requirements carefully before submitting your application. Applications are reviewed in the order received.",
  sections: [
    { id: "processing_time", heading: "Processing Time", body: "Most applications are processed within 1–3 business days." },
    { id: "required_uploads", heading: "Required Documents", body: "Government ID + proof of income are required. Additional documents may be requested." },
    { id: "move_in_funds", heading: "Move-In Funds", body: "Move-in funds are due upon approval (deposit + first month's rent). Exact amounts may vary by unit." },
    { id: "pet_policy", heading: "Pet Policy", body: "Pets may require approval and additional deposits/fees. Unauthorized pets may be grounds for denial or lease violation." },
    { id: "renters_insurance", heading: "Renters Insurance", body: "Renters insurance may be required prior to move-in and throughout the lease term." },
    { id: "fees", heading: "Fees", body: "Late fees and other administrative fees may apply per lease terms and property policy." },
    { id: "no_verbal", heading: "No Verbal Agreements", body: "All agreements must be in writing. Verbal statements do not modify the lease." }
  ],
  footerNote: "By continuing, you confirm you understand these requirements."
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
    emergencyContact: { visibility: "optional" }
  },
  historyRules: {
    minAddressYears: 2,
    minEmploymentYears: 2
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
