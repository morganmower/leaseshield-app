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
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserPreferences(id: string, data: { preferredState?: string }): Promise<User>;
  updateUserStripeInfo(id: string, data: { stripeCustomerId?: string; stripeSubscriptionId?: string; subscriptionStatus?: string }): Promise<User>;

  // State operations
  getAllStates(): Promise<State[]>;
  getState(id: string): Promise<State | undefined>;
  createState(state: InsertState): Promise<State>;

  // Template operations
  getAllTemplates(filters?: { stateId?: string; category?: string }): Promise<Template[]>;
  getTemplate(id: string): Promise<Template | undefined>;
  createTemplate(template: InsertTemplate): Promise<Template>;
  updateTemplate(id: string, template: Partial<InsertTemplate>): Promise<Template>;
  deleteTemplate(id: string): Promise<void>;

  // Compliance card operations
  getComplianceCardsByState(stateId: string): Promise<ComplianceCard[]>;
  getComplianceCard(id: string): Promise<ComplianceCard | undefined>;
  createComplianceCard(card: InsertComplianceCard): Promise<ComplianceCard>;
  updateComplianceCard(id: string, card: Partial<InsertComplianceCard>): Promise<ComplianceCard>;
  deleteComplianceCard(id: string): Promise<void>;

  // Legal update operations
  getLegalUpdatesByState(stateId: string): Promise<LegalUpdate[]>;
  getRecentLegalUpdates(limit?: number): Promise<LegalUpdate[]>;
  getLegalUpdate(id: string): Promise<LegalUpdate | undefined>;
  createLegalUpdate(update: InsertLegalUpdate): Promise<LegalUpdate>;
  updateLegalUpdate(id: string, update: Partial<InsertLegalUpdate>): Promise<LegalUpdate>;
  deleteLegalUpdate(id: string): Promise<void>;

  // User notification operations
  getUserNotifications(userId: string): Promise<UserNotification[]>;
  getUnreadNotificationCount(userId: string): Promise<number>;
  markNotificationAsRead(id: string): Promise<void>;
  createUserNotification(notification: InsertUserNotification): Promise<UserNotification>;

  // Analytics operations
  trackEvent(event: InsertAnalyticsEvent): Promise<AnalyticsEvent>;
  getAnalyticsSummary(): Promise<any>;

  // Screening content operations
  getAllScreeningContent(): Promise<ScreeningContent[]>;
  getScreeningContentBySlug(slug: string): Promise<ScreeningContent | undefined>;
  createScreeningContent(content: InsertScreeningContent): Promise<ScreeningContent>;

  // Tenant issue workflow operations
  getAllTenantIssueWorkflows(): Promise<TenantIssueWorkflow[]>;
  getTenantIssueWorkflowBySlug(slug: string): Promise<TenantIssueWorkflow | undefined>;
  createTenantIssueWorkflow(workflow: InsertTenantIssueWorkflow): Promise<TenantIssueWorkflow>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
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
  }

  async updateUserPreferences(id: string, data: { preferredState?: string }): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async updateUserStripeInfo(id: string, data: { stripeCustomerId?: string; stripeSubscriptionId?: string; subscriptionStatus?: string }): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  // State operations
  async getAllStates(): Promise<State[]> {
    return await db.select().from(states).where(eq(states.isActive, true));
  }

  async getState(id: string): Promise<State | undefined> {
    const [state] = await db.select().from(states).where(eq(states.id, id));
    return state;
  }

  async createState(stateData: InsertState): Promise<State> {
    const [state] = await db.insert(states).values(stateData).returning();
    return state;
  }

  // Template operations
  async getAllTemplates(filters?: { stateId?: string; category?: string }): Promise<Template[]> {
    let query = db.select().from(templates).where(eq(templates.isActive, true));

    if (filters?.stateId && filters.stateId !== "all") {
      query = query.where(eq(templates.stateId, filters.stateId));
    }

    if (filters?.category && filters.category !== "all") {
      query = query.where(eq(templates.category, filters.category as any));
    }

    return await query.orderBy(templates.sortOrder, templates.title);
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

  async getAnalyticsSummary(): Promise<any> {
    // Simplified analytics - in production, you'd have more complex queries
    const totalUsers = await db.select({ count: sql<number>`count(*)` }).from(users);
    const activeTrials = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.subscriptionStatus, 'trialing'));
    const activeSubscriptions = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.subscriptionStatus, 'active'));

    return {
      totalUsers: Number(totalUsers[0]?.count || 0),
      activeTrials: Number(activeTrials[0]?.count || 0),
      activeSubscriptions: Number(activeSubscriptions[0]?.count || 0),
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
}

export const storage = new DatabaseStorage();
