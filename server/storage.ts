import {
  users,
  templates,
  complianceCards,
  legalUpdates,
  userNotifications,
  analyticsEvents,
  screeningContent,
  tenantIssueWorkflows,
  states,
  blogPosts,
  legislativeMonitoring,
  caseLawMonitoring,
  templateReviewQueue,
  monitoringRuns,
  templateVersions,
  properties,
  savedDocuments,
  uploadedDocuments,
  communicationTemplates,
  rentLedgerEntries,
  type User,
  type UpsertUser,
  type Template,
  type InsertTemplate,
  type ComplianceCard,
  type InsertComplianceCard,
  type LegalUpdate,
  type InsertLegalUpdate,
  type UserNotification,
  type InsertUserNotification,
  type AnalyticsEvent,
  type InsertAnalyticsEvent,
  type ScreeningContent,
  type InsertScreeningContent,
  type TenantIssueWorkflow,
  type InsertTenantIssueWorkflow,
  type State,
  type InsertState,
  type BlogPost,
  type InsertBlogPost,
  type LegislativeMonitoring,
  type InsertLegislativeMonitoring,
  type CaseLawMonitoring,
  type InsertCaseLawMonitoring,
  type TemplateReviewQueue,
  type InsertTemplateReviewQueue,
  type MonitoringRun,
  type InsertMonitoringRun,
  type TemplateVersion,
  type InsertTemplateVersion,
  type Property,
  type InsertProperty,
  type SavedDocument,
  type InsertSavedDocument,
  type UploadedDocument,
  type InsertUploadedDocument,
  type CommunicationTemplate,
  type InsertCommunicationTemplate,
  type RentLedgerEntry,
  type InsertRentLedgerEntry,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";
import { stateCache, templateCache, complianceCache } from "./utils/cache";

/**
 * Database error handler wrapper
 * Provides consistent error handling and logging for database operations
 */
async function handleDbOperation<T>(
  operation: () => Promise<T>,
  context: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error(`Database error in ${context}:`, error);
    throw new Error(`Database operation failed: ${context}`);
  }
}

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserPreferences(id: string, data: { preferredState?: string }): Promise<User>;
  updateUserStripeInfo(id: string, data: { stripeCustomerId?: string; stripeSubscriptionId?: string; subscriptionStatus?: string }): Promise<User>;
  getAllActiveUsers(): Promise<User[]>;
  getAllUsers(): Promise<User[]>;
  getUsersByState(stateId: string): Promise<User[]>;

  // State operations
  getAllStates(): Promise<State[]>;
  getState(id: string): Promise<State | undefined>;
  getStateById(id: string): Promise<State | undefined>;
  createState(state: InsertState): Promise<State>;

  // Template operations
  getAllTemplates(filters?: { stateId?: string; category?: string }): Promise<Template[]>;
  getTemplate(id: string): Promise<Template | undefined>;
  createTemplate(template: InsertTemplate): Promise<Template>;
  updateTemplate(id: string, template: Partial<InsertTemplate>): Promise<Template>;
  deleteTemplate(id: string): Promise<void>;

  // Compliance card operations
  getComplianceCardsByState(stateId: string): Promise<ComplianceCard[]>;
  getAllComplianceCards(): Promise<ComplianceCard[]>;
  getComplianceCard(id: string): Promise<ComplianceCard | undefined>;
  createComplianceCard(card: InsertComplianceCard): Promise<ComplianceCard>;
  updateComplianceCard(id: string, card: Partial<InsertComplianceCard>): Promise<ComplianceCard>;
  deleteComplianceCard(id: string): Promise<void>;

  // Legal update operations
  getLegalUpdatesByState(stateId: string): Promise<LegalUpdate[]>;
  getAllLegalUpdates(): Promise<LegalUpdate[]>;
  getRecentLegalUpdates(limit?: number): Promise<LegalUpdate[]>;
  getLegalUpdate(id: string): Promise<LegalUpdate | undefined>;
  getLegalUpdateById(id: string): Promise<LegalUpdate | undefined>;
  createLegalUpdate(update: InsertLegalUpdate): Promise<LegalUpdate>;
  updateLegalUpdate(id: string, update: Partial<InsertLegalUpdate>): Promise<LegalUpdate>;
  deleteLegalUpdate(id: string): Promise<void>;
  
  // Get current legal disclosures for document generation (dynamic, updates with new legislation)
  getCurrentStateLegalDisclosures(stateId: string): Promise<string>;

  // User notification operations
  getUserNotifications(userId: string): Promise<UserNotification[]>;
  getUnreadNotificationCount(userId: string): Promise<number>;
  markNotificationAsRead(id: string): Promise<void>;
  createUserNotification(notification: InsertUserNotification): Promise<UserNotification>;

  // Analytics operations
  trackEvent(event: InsertAnalyticsEvent): Promise<AnalyticsEvent>;
  getUserTrialReminderEvent(userId: string): Promise<AnalyticsEvent | undefined>;
  getUserTrialExpiredEvent(userId: string): Promise<AnalyticsEvent | undefined>;
  getAnalyticsSummary(): Promise<any>;

  // Screening content operations
  getAllScreeningContent(): Promise<ScreeningContent[]>;
  getScreeningContentBySlug(slug: string): Promise<ScreeningContent | undefined>;
  createScreeningContent(content: InsertScreeningContent): Promise<ScreeningContent>;

  // Tenant issue workflow operations
  getAllTenantIssueWorkflows(): Promise<TenantIssueWorkflow[]>;
  getTenantIssueWorkflowBySlug(slug: string): Promise<TenantIssueWorkflow | undefined>;
  createTenantIssueWorkflow(workflow: InsertTenantIssueWorkflow): Promise<TenantIssueWorkflow>;

  // Blog post operations
  getAllBlogPosts(filters?: { stateId?: string; tag?: string; isPublished?: boolean }): Promise<BlogPost[]>;
  getBlogPostBySlug(slug: string): Promise<BlogPost | undefined>;
  getBlogPost(id: string): Promise<BlogPost | undefined>;
  createBlogPost(post: InsertBlogPost): Promise<BlogPost>;
  updateBlogPost(id: string, post: Partial<InsertBlogPost>): Promise<BlogPost>;
  deleteBlogPost(id: string): Promise<void>;
  incrementBlogPostViews(id: string): Promise<void>;

  // Legislative monitoring operations
  getLegislativeMonitoringByBillId(billId: string): Promise<LegislativeMonitoring | undefined>;
  getAllLegislativeMonitoring(filters?: { stateId?: string; relevanceLevel?: string; isReviewed?: boolean }): Promise<LegislativeMonitoring[]>;
  createLegislativeMonitoring(monitoring: InsertLegislativeMonitoring): Promise<LegislativeMonitoring>;
  updateLegislativeMonitoring(id: string, monitoring: Partial<InsertLegislativeMonitoring>): Promise<LegislativeMonitoring>;

  // Case law monitoring operations
  getCaseLawMonitoringByCaseId(caseId: string): Promise<CaseLawMonitoring | undefined>;
  getAllCaseLawMonitoring(filters?: { stateId?: string; relevanceLevel?: string; isReviewed?: boolean }): Promise<CaseLawMonitoring[]>;
  createCaseLawMonitoring(monitoring: InsertCaseLawMonitoring): Promise<CaseLawMonitoring>;
  updateCaseLawMonitoring(id: string, monitoring: Partial<InsertCaseLawMonitoring>): Promise<CaseLawMonitoring>;

  // Template review queue operations
  getAllTemplateReviewQueue(filters?: { status?: string; templateId?: string }): Promise<TemplateReviewQueue[]>;
  createTemplateReviewQueue(review: InsertTemplateReviewQueue): Promise<TemplateReviewQueue>;
  updateTemplateReviewQueue(id: string, review: Partial<InsertTemplateReviewQueue>): Promise<TemplateReviewQueue>;

  // Monitoring run operations
  createMonitoringRun(run: InsertMonitoringRun): Promise<MonitoringRun>;
  getRecentMonitoringRuns(limit?: number): Promise<MonitoringRun[]>;

  // Template version operations
  publishTemplateUpdate(data: {
    templateId: string;
    reviewId: string;
    pdfUrl?: string;
    fillableFormData?: any;
    versionNotes: string;
    lastUpdateReason: string;
    publishedBy: string;
  }): Promise<{ template: Template; version: TemplateVersion }>;
  getTemplateVersions(templateId: string): Promise<TemplateVersion[]>;
  createTemplateVersion(versionData: InsertTemplateVersion): Promise<TemplateVersion>;
  getTemplateReviewById(id: string): Promise<TemplateReviewQueue | undefined>;

  // Property operations
  getPropertiesByUserId(userId: string): Promise<Property[]>;
  getProperty(id: string, userId: string): Promise<Property | undefined>;
  createProperty(property: InsertProperty): Promise<Property>;
  updateProperty(id: string, userId: string, property: Partial<InsertProperty>): Promise<Property | null>;
  deleteProperty(id: string, userId: string): Promise<boolean>;

  // Saved document operations
  getSavedDocumentsByUserId(userId: string): Promise<SavedDocument[]>;
  getSavedDocumentById(id: string): Promise<SavedDocument | undefined>;
  createSavedDocument(document: InsertSavedDocument): Promise<SavedDocument>;
  deleteSavedDocument(id: string): Promise<void>;

  // Uploaded document operations
  getUploadedDocumentsByUserId(userId: string): Promise<UploadedDocument[]>;
  getUploadedDocumentsByPropertyId(propertyId: string, userId: string): Promise<UploadedDocument[]>;
  getUploadedDocumentById(id: string, userId: string): Promise<UploadedDocument | undefined>;
  createUploadedDocument(document: InsertUploadedDocument): Promise<UploadedDocument>;
  deleteUploadedDocument(id: string, userId: string): Promise<boolean>;

  // Communication template operations
  getCommunicationTemplatesByState(stateId: string): Promise<CommunicationTemplate[]>;
  getAllCommunicationTemplates(): Promise<CommunicationTemplate[]>;
  createCommunicationTemplate(template: InsertCommunicationTemplate): Promise<CommunicationTemplate>;

  // Rent ledger operations
  getRentLedgerEntries(userId: string): Promise<RentLedgerEntry[]>;
  getRentLedgerEntriesByProperty(propertyId: string, userId: string): Promise<RentLedgerEntry[]>;
  createRentLedgerEntry(entry: InsertRentLedgerEntry): Promise<RentLedgerEntry>;
  updateRentLedgerEntry(id: string, userId: string, data: Partial<InsertRentLedgerEntry>): Promise<RentLedgerEntry | null>;
  deleteRentLedgerEntry(id: string, userId: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    return handleDbOperation(async () => {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user;
    }, 'getUser');
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    return handleDbOperation(async () => {
      const [user] = await db
        .insert(users)
        .values(userData)
        .onConflictDoUpdate({
          target: users.id,
          set: {
            ...userData,
            updatedAt: new Date(),
          },
        })
        .returning();
      return user;
    }, 'upsertUser');
  }

  async updateUserPreferences(id: string, data: { preferredState?: string }): Promise<User> {
    return handleDbOperation(async () => {
      const [user] = await db
        .update(users)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning();

      if (!user) {
        throw new Error(`User not found: ${id}`);
      }

      return user;
    }, 'updateUserPreferences');
  }

  async updateUserStripeInfo(id: string, data: { stripeCustomerId?: string; stripeSubscriptionId?: string; subscriptionStatus?: string }): Promise<User> {
    return handleDbOperation(async () => {
      const [user] = await db
        .update(users)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning();

      if (!user) {
        throw new Error(`User not found: ${id}`);
      }

      return user;
    }, 'updateUserStripeInfo');
  }

  async getAllActiveUsers(): Promise<User[]> {
    return await db.select().from(users).where(
      sql`${users.subscriptionStatus} IN ('active', 'trialing', 'incomplete')`
    );
  }

  async getAllUsers(): Promise<User[]> {
    return handleDbOperation(async () => {
      return await db.select().from(users).orderBy(desc(users.createdAt));
    }, 'getAllUsers');
  }

  async getUsersByState(stateId: string): Promise<User[]> {
    return await db.select().from(users).where(eq(users.preferredState, stateId));
  }

  // State operations
  async getAllStates(): Promise<State[]> {
    return handleDbOperation(async () => {
      // Use cache for states (rarely change)
      return stateCache.getOrSet('all-states', async () => {
        return await db.select().from(states).where(eq(states.isActive, true));
      }, 3600); // Cache for 1 hour
    }, 'getAllStates');
  }

  async getState(id: string): Promise<State | undefined> {
    return handleDbOperation(async () => {
      return stateCache.getOrSet(`state-${id}`, async () => {
        const [state] = await db.select().from(states).where(eq(states.id, id));
        return state;
      }, 3600); // Cache for 1 hour
    }, 'getState');
  }

  async getStateById(id: string): Promise<State | undefined> {
    return this.getState(id);
  }

  async createState(stateData: InsertState): Promise<State> {
    return handleDbOperation(async () => {
      const [state] = await db.insert(states).values(stateData).returning();
      // Invalidate cache
      stateCache.clear();
      return state;
    }, 'createState');
  }

  // Template operations
  async getAllTemplates(filters?: { stateId?: string; category?: string }): Promise<Template[]> {
    const conditions = [eq(templates.isActive, true)];

    if (filters?.stateId && filters.stateId !== "all") {
      conditions.push(eq(templates.stateId, filters.stateId));
    }

    if (filters?.category && filters.category !== "all") {
      conditions.push(eq(templates.category, filters.category as any));
    }

    return await db
      .select()
      .from(templates)
      .where(and(...conditions))
      .orderBy(templates.sortOrder, templates.title);
  }

  async getTemplate(id: string): Promise<Template | undefined> {
    const [template] = await db.select().from(templates).where(eq(templates.id, id));
    return template;
  }

  async createTemplate(templateData: InsertTemplate): Promise<Template> {
    const [template] = await db.insert(templates).values(templateData).returning();
    return template;
  }

  async updateTemplate(id: string, templateData: Partial<InsertTemplate>): Promise<Template> {
    const [template] = await db
      .update(templates)
      .set({ ...templateData, updatedAt: new Date() })
      .where(eq(templates.id, id))
      .returning();
    return template;
  }

  async deleteTemplate(id: string): Promise<void> {
    await db.update(templates).set({ isActive: false }).where(eq(templates.id, id));
  }

  // Compliance card operations
  async getComplianceCardsByState(stateId: string): Promise<ComplianceCard[]> {
    return await db
      .select()
      .from(complianceCards)
      .where(and(eq(complianceCards.stateId, stateId), eq(complianceCards.isActive, true)))
      .orderBy(complianceCards.sortOrder, complianceCards.title);
  }

  async getAllComplianceCards(): Promise<ComplianceCard[]> {
    return await db
      .select()
      .from(complianceCards)
      .orderBy(complianceCards.stateId, complianceCards.sortOrder, complianceCards.title);
  }

  async getComplianceCard(id: string): Promise<ComplianceCard | undefined> {
    const [card] = await db.select().from(complianceCards).where(eq(complianceCards.id, id));
    return card;
  }

  async createComplianceCard(cardData: InsertComplianceCard): Promise<ComplianceCard> {
    const [card] = await db.insert(complianceCards).values(cardData).returning();
    return card;
  }

  async updateComplianceCard(id: string, cardData: Partial<InsertComplianceCard>): Promise<ComplianceCard> {
    const [card] = await db
      .update(complianceCards)
      .set({ ...cardData, updatedAt: new Date() })
      .where(eq(complianceCards.id, id))
      .returning();
    return card;
  }

  async deleteComplianceCard(id: string): Promise<void> {
    await db.update(complianceCards).set({ isActive: false }).where(eq(complianceCards.id, id));
  }

  // Legal update operations
  async getLegalUpdatesByState(stateId: string): Promise<LegalUpdate[]> {
    return await db
      .select()
      .from(legalUpdates)
      .where(and(eq(legalUpdates.stateId, stateId), eq(legalUpdates.isActive, true)))
      .orderBy(desc(legalUpdates.createdAt));
  }

  async getAllLegalUpdates(): Promise<LegalUpdate[]> {
    return await db
      .select()
      .from(legalUpdates)
      .orderBy(desc(legalUpdates.createdAt));
  }

  async getRecentLegalUpdates(limit: number = 10): Promise<LegalUpdate[]> {
    return await db
      .select()
      .from(legalUpdates)
      .where(eq(legalUpdates.isActive, true))
      .orderBy(desc(legalUpdates.createdAt))
      .limit(limit);
  }

  async getLegalUpdate(id: string): Promise<LegalUpdate | undefined> {
    const [update] = await db.select().from(legalUpdates).where(eq(legalUpdates.id, id));
    return update;
  }

  async getLegalUpdateById(id: string): Promise<LegalUpdate | undefined> {
    return this.getLegalUpdate(id);
  }

  async createLegalUpdate(updateData: InsertLegalUpdate): Promise<LegalUpdate> {
    const [update] = await db.insert(legalUpdates).values(updateData).returning();
    return update;
  }

  async updateLegalUpdate(id: string, updateData: Partial<InsertLegalUpdate>): Promise<LegalUpdate> {
    const [update] = await db
      .update(legalUpdates)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(legalUpdates.id, id))
      .returning();
    return update;
  }

  async deleteLegalUpdate(id: string): Promise<void> {
    await db.update(legalUpdates).set({ isActive: false }).where(eq(legalUpdates.id, id));
  }

  async getCurrentStateLegalDisclosures(stateId: string): Promise<string> {
    // Helper function for HTML escaping (local copy for this method)
    const htmlEscape = (unsafe: string) => {
      return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
        .replace(/\//g, "&#x2F;");
    };

    // Get all active legal updates for this state to build dynamic disclosures
    const stateUpdates = await db
      .select()
      .from(legalUpdates)
      .where(and(eq(legalUpdates.stateId, stateId), eq(legalUpdates.isActive, true)))
      .orderBy(desc(legalUpdates.effectiveDate));

    // Build disclosure HTML from latest updates
    if (stateUpdates.length === 0) {
      return `<h2>State-Specific Disclosures - ${stateId}</h2><p>Please refer to current state law.</p>`;
    }

    const disclosureHtml = stateUpdates
      .slice(0, 5) // Limit to latest 5 updates for document brevity
      .map(
        (update) => `
      <h3>${htmlEscape(update.title)}</h3>
      <p><strong>Effective Date:</strong> ${update.effectiveDate ? new Date(update.effectiveDate).toLocaleDateString() : 'Ongoing'}</p>
      <p>${htmlEscape(update.summary)}</p>
      ${update.afterText ? `<p><strong>Current Requirement:</strong> ${htmlEscape(update.afterText)}</p>` : ''}
    `
      )
      .join('');

    return `<h2>Current State-Specific Disclosures - ${stateId}</h2>${disclosureHtml}`;
  }

  // User notification operations
  async getUserNotifications(userId: string): Promise<UserNotification[]> {
    return await db
      .select()
      .from(userNotifications)
      .where(eq(userNotifications.userId, userId))
      .orderBy(desc(userNotifications.createdAt));
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(userNotifications)
      .where(and(eq(userNotifications.userId, userId), eq(userNotifications.isRead, false)));
    return Number(result[0]?.count || 0);
  }

  async markNotificationAsRead(id: string): Promise<void> {
    await db
      .update(userNotifications)
      .set({ isRead: true, readAt: new Date() })
      .where(eq(userNotifications.id, id));
  }

  async createUserNotification(notificationData: InsertUserNotification): Promise<UserNotification> {
    const [notification] = await db.insert(userNotifications).values(notificationData).returning();
    return notification;
  }

  // Analytics operations
  async trackEvent(eventData: InsertAnalyticsEvent): Promise<AnalyticsEvent> {
    const [event] = await db.insert(analyticsEvents).values(eventData).returning();
    return event;
  }

  async getUserTrialReminderEvent(userId: string): Promise<AnalyticsEvent | undefined> {
    const [event] = await db
      .select()
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.userId, userId),
          eq(analyticsEvents.eventType, 'trial_reminder_sent')
        )
      )
      .limit(1);
    return event;
  }

  async getUserTrialExpiredEvent(userId: string): Promise<AnalyticsEvent | undefined> {
    const [event] = await db
      .select()
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.userId, userId),
          eq(analyticsEvents.eventType, 'trial_expired_email_sent')
        )
      )
      .limit(1);
    return event;
  }

  async getAnalyticsSummary(): Promise<any> {
    // Subscription metrics
    const totalUsers = await db.select({ count: sql<number>`count(*)` }).from(users);
    const activeSubscriptions = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.subscriptionStatus, 'active'));
    const trialing = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.subscriptionStatus, 'trialing'));
    const canceled = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.subscriptionStatus, 'canceled'));

    // Calculate MRR (assuming $10/month)
    const activeCount = Number(activeSubscriptions[0]?.count || 0);
    const mrr = activeCount * 12;

    // Trial conversion metrics
    const totalTrialsEver = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(sql`${users.trialEndsAt} IS NOT NULL`);
    
    const convertedTrials = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(
        and(
          sql`${users.trialEndsAt} IS NOT NULL`,
          eq(users.subscriptionStatus, 'active')
        )
      );

    const totalTrialsCount = Number(totalTrialsEver[0]?.count || 0);
    const convertedCount = Number(convertedTrials[0]?.count || 0);
    const trialConversionRate = totalTrialsCount > 0 ? convertedCount / totalTrialsCount : 0;

    // Usage metrics
    const templateDownloads = await db
      .select({ count: sql<number>`count(*)` })
      .from(analyticsEvents)
      .where(eq(analyticsEvents.eventType, 'template_download'));
    
    const westernVerifyClicks = await db
      .select({ count: sql<number>`count(*)` })
      .from(analyticsEvents)
      .where(eq(analyticsEvents.eventType, 'western_verify_click'));

    const totalDownloads = Number(templateDownloads[0]?.count || 0);
    const totalWesternClicks = Number(westernVerifyClicks[0]?.count || 0);
    const totalUsersCount = Number(totalUsers[0]?.count || 0);
    const avgDownloadsPerUser = totalUsersCount > 0 ? totalDownloads / totalUsersCount : 0;

    return {
      subscriptions: {
        total: totalUsersCount,
        active: activeCount,
        trialing: Number(trialing[0]?.count || 0),
        canceled: Number(canceled[0]?.count || 0),
        mrr,
      },
      conversion: {
        trialConversionRate,
        totalTrials: totalTrialsCount,
        convertedTrials: convertedCount,
      },
      usage: {
        totalDownloads,
        westernVerifyClicks: totalWesternClicks,
        avgDownloadsPerUser,
      },
    };
  }

  // Screening content operations
  async getAllScreeningContent(): Promise<ScreeningContent[]> {
    return await db
      .select()
      .from(screeningContent)
      .where(eq(screeningContent.isActive, true))
      .orderBy(screeningContent.sortOrder);
  }

  async getScreeningContentBySlug(slug: string): Promise<ScreeningContent | undefined> {
    const [content] = await db.select().from(screeningContent).where(eq(screeningContent.slug, slug));
    return content;
  }

  async createScreeningContent(contentData: InsertScreeningContent): Promise<ScreeningContent> {
    const [content] = await db.insert(screeningContent).values(contentData).returning();
    return content;
  }

  // Tenant issue workflow operations
  async getAllTenantIssueWorkflows(): Promise<TenantIssueWorkflow[]> {
    return await db
      .select()
      .from(tenantIssueWorkflows)
      .where(eq(tenantIssueWorkflows.isActive, true))
      .orderBy(tenantIssueWorkflows.sortOrder);
  }

  async getTenantIssueWorkflowBySlug(slug: string): Promise<TenantIssueWorkflow | undefined> {
    const [workflow] = await db.select().from(tenantIssueWorkflows).where(eq(tenantIssueWorkflows.slug, slug));
    return workflow;
  }

  async createTenantIssueWorkflow(workflowData: InsertTenantIssueWorkflow): Promise<TenantIssueWorkflow> {
    const [workflow] = await db.insert(tenantIssueWorkflows).values(workflowData).returning();
    return workflow;
  }

  // Blog post operations
  async getAllBlogPosts(filters?: { stateId?: string; tag?: string; isPublished?: boolean }): Promise<BlogPost[]> {
    let query = db.select().from(blogPosts);
    
    const conditions = [];
    
    if (filters?.isPublished !== undefined) {
      conditions.push(eq(blogPosts.isPublished, filters.isPublished));
    }
    
    if (filters?.stateId) {
      conditions.push(sql`${filters.stateId} = ANY(${blogPosts.stateIds})`);
    }
    
    if (filters?.tag) {
      conditions.push(sql`${filters.tag} = ANY(${blogPosts.tags})`);
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return await query.orderBy(desc(blogPosts.publishedAt));
  }

  async getBlogPostBySlug(slug: string): Promise<BlogPost | undefined> {
    const [post] = await db.select().from(blogPosts).where(eq(blogPosts.slug, slug));
    return post;
  }

  async getBlogPost(id: string): Promise<BlogPost | undefined> {
    const [post] = await db.select().from(blogPosts).where(eq(blogPosts.id, id));
    return post;
  }

  async createBlogPost(postData: InsertBlogPost): Promise<BlogPost> {
    const [post] = await db.insert(blogPosts).values(postData).returning();
    return post;
  }

  async updateBlogPost(id: string, postData: Partial<InsertBlogPost>): Promise<BlogPost> {
    const [post] = await db
      .update(blogPosts)
      .set({ ...postData, updatedAt: new Date() })
      .where(eq(blogPosts.id, id))
      .returning();
    return post;
  }

  async deleteBlogPost(id: string): Promise<void> {
    await db.delete(blogPosts).where(eq(blogPosts.id, id));
  }

  async incrementBlogPostViews(id: string): Promise<void> {
    await db
      .update(blogPosts)
      .set({ viewCount: sql`${blogPosts.viewCount} + 1` })
      .where(eq(blogPosts.id, id));
  }

  // Legislative monitoring operations
  async getLegislativeMonitoringByBillId(billId: string): Promise<LegislativeMonitoring | undefined> {
    const [monitoring] = await db.select().from(legislativeMonitoring).where(eq(legislativeMonitoring.billId, billId));
    return monitoring;
  }

  async getAllLegislativeMonitoring(filters?: { stateId?: string; relevanceLevel?: string; isReviewed?: boolean }): Promise<LegislativeMonitoring[]> {
    const conditions = [];

    if (filters?.stateId) {
      conditions.push(eq(legislativeMonitoring.stateId, filters.stateId));
    }

    if (filters?.relevanceLevel) {
      conditions.push(eq(legislativeMonitoring.relevanceLevel, filters.relevanceLevel as any));
    }

    if (filters?.isReviewed !== undefined) {
      conditions.push(eq(legislativeMonitoring.isReviewed, filters.isReviewed));
    }

    return await db
      .select()
      .from(legislativeMonitoring)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(legislativeMonitoring.createdAt));
  }

  async createLegislativeMonitoring(monitoringData: InsertLegislativeMonitoring): Promise<LegislativeMonitoring> {
    const [monitoring] = await db.insert(legislativeMonitoring).values(monitoringData).returning();
    return monitoring;
  }

  async updateLegislativeMonitoring(id: string, monitoringData: Partial<InsertLegislativeMonitoring>): Promise<LegislativeMonitoring> {
    const [monitoring] = await db
      .update(legislativeMonitoring)
      .set({ ...monitoringData, updatedAt: new Date() })
      .where(eq(legislativeMonitoring.id, id))
      .returning();
    return monitoring;
  }

  // Case law monitoring operations
  async getCaseLawMonitoringByCaseId(caseId: string): Promise<CaseLawMonitoring | undefined> {
    const [monitoring] = await db.select().from(caseLawMonitoring).where(eq(caseLawMonitoring.caseId, caseId));
    return monitoring;
  }

  async getAllCaseLawMonitoring(filters?: { stateId?: string; relevanceLevel?: string; isReviewed?: boolean }): Promise<CaseLawMonitoring[]> {
    const conditions = [];

    if (filters?.stateId) {
      conditions.push(eq(caseLawMonitoring.stateId, filters.stateId));
    }

    if (filters?.relevanceLevel) {
      conditions.push(eq(caseLawMonitoring.relevanceLevel, filters.relevanceLevel as any));
    }

    if (filters?.isReviewed !== undefined) {
      conditions.push(eq(caseLawMonitoring.isReviewed, filters.isReviewed));
    }

    return await db
      .select()
      .from(caseLawMonitoring)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(caseLawMonitoring.createdAt));
  }

  async createCaseLawMonitoring(monitoringData: InsertCaseLawMonitoring): Promise<CaseLawMonitoring> {
    const [monitoring] = await db.insert(caseLawMonitoring).values(monitoringData).returning();
    return monitoring;
  }

  async updateCaseLawMonitoring(id: string, monitoringData: Partial<InsertCaseLawMonitoring>): Promise<CaseLawMonitoring> {
    const [monitoring] = await db
      .update(caseLawMonitoring)
      .set({ ...monitoringData, updatedAt: new Date() })
      .where(eq(caseLawMonitoring.id, id))
      .returning();
    return monitoring;
  }

  // Template review queue operations
  async getAllTemplateReviewQueue(filters?: { status?: string; templateId?: string }): Promise<TemplateReviewQueue[]> {
    const conditions = [];

    if (filters?.status) {
      conditions.push(eq(templateReviewQueue.status, filters.status as any));
    }

    if (filters?.templateId) {
      conditions.push(eq(templateReviewQueue.templateId, filters.templateId));
    }

    return await db
      .select()
      .from(templateReviewQueue)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(templateReviewQueue.priority), desc(templateReviewQueue.createdAt));
  }

  async createTemplateReviewQueue(reviewData: InsertTemplateReviewQueue): Promise<TemplateReviewQueue> {
    const [review] = await db.insert(templateReviewQueue).values(reviewData).returning();
    return review;
  }

  async updateTemplateReviewQueue(id: string, reviewData: Partial<InsertTemplateReviewQueue>): Promise<TemplateReviewQueue> {
    const [review] = await db
      .update(templateReviewQueue)
      .set({ ...reviewData, updatedAt: new Date() })
      .where(eq(templateReviewQueue.id, id))
      .returning();
    return review;
  }

  // Monitoring run operations
  async createMonitoringRun(runData: InsertMonitoringRun): Promise<MonitoringRun> {
    const [run] = await db.insert(monitoringRuns).values(runData).returning();
    return run;
  }

  async getRecentMonitoringRuns(limit: number = 10): Promise<MonitoringRun[]> {
    return await db
      .select()
      .from(monitoringRuns)
      .orderBy(desc(monitoringRuns.createdAt))
      .limit(limit);
  }

  // Template version operations
  async publishTemplateUpdate(data: {
    templateId: string;
    reviewId: string;
    pdfUrl?: string;
    fillableFormData?: any;
    versionNotes: string;
    lastUpdateReason: string;
    publishedBy: string;
  }): Promise<{ template: Template; version: TemplateVersion }> {
    // Use transaction to ensure atomicity
    return await db.transaction(async (tx) => {
      // Get current template
      const [currentTemplate] = await tx.select().from(templates).where(eq(templates.id, data.templateId));
      if (!currentTemplate) {
        throw new Error(`Template ${data.templateId} not found`);
      }

      const newVersion = (currentTemplate.version || 1) + 1;

      // Update template
      const [updatedTemplate] = await tx
        .update(templates)
        .set({
          version: newVersion,
          versionNotes: data.versionNotes,
          lastUpdateReason: data.lastUpdateReason,
          pdfUrl: data.pdfUrl || currentTemplate.pdfUrl,
          fillableFormData: data.fillableFormData || currentTemplate.fillableFormData,
          updatedAt: new Date(),
        })
        .where(eq(templates.id, data.templateId))
        .returning();

      // Create version history record
      const [versionRecord] = await tx
        .insert(templateVersions)
        .values({
          templateId: data.templateId,
          versionNumber: newVersion,
          pdfUrl: data.pdfUrl || currentTemplate.pdfUrl,
          fillableFormData: data.fillableFormData || currentTemplate.fillableFormData,
          versionNotes: data.versionNotes,
          lastUpdateReason: data.lastUpdateReason,
          sourceReviewId: data.reviewId,
          createdBy: data.publishedBy,
        })
        .returning();

      // Mark review queue as published
      await tx
        .update(templateReviewQueue)
        .set({
          status: 'published' as any,
          publishedAt: new Date(),
          publishedBy: data.publishedBy,
          updatedAt: new Date(),
        })
        .where(eq(templateReviewQueue.id, data.reviewId));

      // Mark legislative monitoring as reviewed
      const [review] = await tx.select().from(templateReviewQueue).where(eq(templateReviewQueue.id, data.reviewId));
      if (review?.billId) {
        await tx
          .update(legislativeMonitoring)
          .set({
            isReviewed: true,
            reviewedBy: data.publishedBy,
            reviewedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(legislativeMonitoring.id, review.billId));
      }

      return { template: updatedTemplate, version: versionRecord };
    });
  }

  async getTemplateVersions(templateId: string): Promise<TemplateVersion[]> {
    return await db
      .select()
      .from(templateVersions)
      .where(eq(templateVersions.templateId, templateId))
      .orderBy(desc(templateVersions.versionNumber));
  }

  async createTemplateVersion(versionData: InsertTemplateVersion): Promise<TemplateVersion> {
    const [version] = await db
      .insert(templateVersions)
      .values(versionData)
      .returning();
    return version;
  }

  async getTemplateReviewById(id: string): Promise<TemplateReviewQueue | undefined> {
    const [review] = await db.select().from(templateReviewQueue).where(eq(templateReviewQueue.id, id));
    return review;
  }

  // Property operations
  async getPropertiesByUserId(userId: string): Promise<Property[]> {
    return await db
      .select()
      .from(properties)
      .where(eq(properties.userId, userId))
      .orderBy(desc(properties.createdAt));
  }

  async getProperty(id: string, userId: string): Promise<Property | undefined> {
    const [property] = await db
      .select()
      .from(properties)
      .where(and(eq(properties.id, id), eq(properties.userId, userId)));
    return property;
  }

  async createProperty(property: InsertProperty): Promise<Property> {
    const [newProperty] = await db
      .insert(properties)
      .values(property)
      .returning();
    return newProperty;
  }

  async updateProperty(id: string, userId: string, property: Partial<InsertProperty>): Promise<Property | null> {
    const [updatedProperty] = await db
      .update(properties)
      .set({ ...property, updatedAt: new Date() })
      .where(and(eq(properties.id, id), eq(properties.userId, userId)))
      .returning();
    return updatedProperty || null;
  }

  async deleteProperty(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(properties)
      .where(and(eq(properties.id, id), eq(properties.userId, userId)))
      .returning();
    return result.length > 0;
  }

  // Saved document operations
  async getSavedDocumentsByUserId(userId: string): Promise<SavedDocument[]> {
    return await db
      .select()
      .from(savedDocuments)
      .where(eq(savedDocuments.userId, userId))
      .orderBy(desc(savedDocuments.createdAt));
  }

  async getSavedDocumentById(id: string): Promise<SavedDocument | undefined> {
    const [document] = await db
      .select()
      .from(savedDocuments)
      .where(eq(savedDocuments.id, id));
    return document;
  }

  async createSavedDocument(document: InsertSavedDocument): Promise<SavedDocument> {
    const [savedDoc] = await db
      .insert(savedDocuments)
      .values(document)
      .returning();
    return savedDoc;
  }

  async deleteSavedDocument(id: string): Promise<void> {
    await db.delete(savedDocuments).where(eq(savedDocuments.id, id));
  }

  // Uploaded document operations
  async getUploadedDocumentsByUserId(userId: string): Promise<UploadedDocument[]> {
    return await db
      .select()
      .from(uploadedDocuments)
      .where(eq(uploadedDocuments.userId, userId))
      .orderBy(desc(uploadedDocuments.createdAt));
  }

  async getUploadedDocumentsByPropertyId(propertyId: string, userId: string): Promise<UploadedDocument[]> {
    return await db
      .select()
      .from(uploadedDocuments)
      .where(and(eq(uploadedDocuments.propertyId, propertyId), eq(uploadedDocuments.userId, userId)))
      .orderBy(desc(uploadedDocuments.createdAt));
  }

  async getUploadedDocumentById(id: string, userId: string): Promise<UploadedDocument | undefined> {
    const [document] = await db
      .select()
      .from(uploadedDocuments)
      .where(and(eq(uploadedDocuments.id, id), eq(uploadedDocuments.userId, userId)));
    return document;
  }

  async createUploadedDocument(document: InsertUploadedDocument): Promise<UploadedDocument> {
    const [uploaded] = await db
      .insert(uploadedDocuments)
      .values(document)
      .returning();
    return uploaded;
  }

  async deleteUploadedDocument(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(uploadedDocuments)
      .where(and(eq(uploadedDocuments.id, id), eq(uploadedDocuments.userId, userId)))
      .returning();
    return result.length > 0;
  }

  // Communication template operations
  async getCommunicationTemplatesByState(stateId: string): Promise<CommunicationTemplate[]> {
    return await db
      .select()
      .from(communicationTemplates)
      .where(and(eq(communicationTemplates.stateId, stateId), eq(communicationTemplates.isActive, true)))
      .orderBy(communicationTemplates.templateType);
  }

  async getAllCommunicationTemplates(): Promise<CommunicationTemplate[]> {
    return await db
      .select()
      .from(communicationTemplates)
      .where(eq(communicationTemplates.isActive, true))
      .orderBy(communicationTemplates.stateId);
  }

  async createCommunicationTemplate(template: InsertCommunicationTemplate): Promise<CommunicationTemplate> {
    const [newTemplate] = await db
      .insert(communicationTemplates)
      .values(template)
      .returning();
    return newTemplate;
  }

  // Rent ledger operations
  async getRentLedgerEntries(userId: string): Promise<RentLedgerEntry[]> {
    return await db
      .select()
      .from(rentLedgerEntries)
      .where(eq(rentLedgerEntries.userId, userId))
      .orderBy(desc(rentLedgerEntries.month));
  }

  async getRentLedgerEntriesByProperty(propertyId: string, userId: string): Promise<RentLedgerEntry[]> {
    return await db
      .select()
      .from(rentLedgerEntries)
      .where(and(eq(rentLedgerEntries.propertyId, propertyId), eq(rentLedgerEntries.userId, userId)))
      .orderBy(desc(rentLedgerEntries.month));
  }

  async createRentLedgerEntry(entry: InsertRentLedgerEntry): Promise<RentLedgerEntry> {
    const [newEntry] = await db
      .insert(rentLedgerEntries)
      .values(entry)
      .returning();
    return newEntry;
  }

  async updateRentLedgerEntry(id: string, userId: string, data: Partial<InsertRentLedgerEntry>): Promise<RentLedgerEntry | null> {
    const [updated] = await db
      .update(rentLedgerEntries)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(rentLedgerEntries.id, id), eq(rentLedgerEntries.userId, userId)))
      .returning();
    return updated || null;
  }

  async deleteRentLedgerEntry(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(rentLedgerEntries)
      .where(and(eq(rentLedgerEntries.id, id), eq(rentLedgerEntries.userId, userId)))
      .returning();
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();
