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
  emailSequences,
  emailSequenceSteps,
  emailSequenceEnrollments,
  emailEvents,
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
  type TrainingInterest,
  type InsertTrainingInterest,
  type EmailSequence,
  type InsertEmailSequence,
  type EmailSequenceStep,
  type InsertEmailSequenceStep,
  type EmailSequenceEnrollment,
  type InsertEmailSequenceEnrollment,
  type EmailEvent,
  type InsertEmailEvent,
  trainingInterest,
  broadcastMessages,
  broadcastRecipients,
  broadcastReplies,
  type BroadcastMessage,
  type InsertBroadcastMessage,
  type BroadcastRecipient,
  type InsertBroadcastRecipient,
  type BroadcastReply,
  type InsertBroadcastReply,
  rentalProperties,
  rentalUnits,
  rentalApplicationLinks,
  rentalSubmissions,
  rentalSubmissionPeople,
  rentalSubmissionFiles,
  rentalSubmissionAcknowledgements,
  rentalScreeningOrders,
  rentalDecisions,
  rentalDenialReasons,
  rentalDecisionLetters,
  rentalApplicationEvents,
  type RentalProperty,
  type InsertRentalProperty,
  type RentalUnit,
  type InsertRentalUnit,
  type RentalApplicationLink,
  type InsertRentalApplicationLink,
  type RentalSubmission,
  type InsertRentalSubmission,
  type RentalSubmissionPerson,
  type InsertRentalSubmissionPerson,
  type RentalSubmissionFile,
  type InsertRentalSubmissionFile,
  type RentalSubmissionAcknowledgement,
  type InsertRentalSubmissionAcknowledgement,
  type RentalScreeningOrder,
  type InsertRentalScreeningOrder,
  type RentalDecision,
  type InsertRentalDecision,
  type RentalDenialReason,
  type InsertRentalDenialReason,
  type RentalDecisionLetter,
  type InsertRentalDecisionLetter,
  type RentalApplicationEvent,
  type InsertRentalApplicationEvent,
  retentionSettings,
  type RetentionSettings,
  type InsertRetentionSettings,
  defaultCoverPageTemplate,
  defaultFieldSchemaTemplate,
  applicationComplianceRules,
  type ApplicationComplianceRule,
  type InsertApplicationComplianceRule,
  landlordScreeningCredentials,
  type LandlordScreeningCredentials,
  type InsertLandlordScreeningCredentials,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, desc, sql, isNull, lte, lt, gt, gte, inArray } from "drizzle-orm";
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
  updateUserPreferences(id: string, data: { 
    preferredState?: string;
    notifyLegalUpdates?: boolean;
    notifyTemplateRevisions?: boolean;
    notifyBillingAlerts?: boolean;
    notifyTips?: boolean;
    businessName?: string | null;
    phoneNumber?: string | null;
  }): Promise<User>;
  updateUserStripeInfo(id: string, data: { stripeCustomerId?: string; stripeSubscriptionId?: string; subscriptionStatus?: string; billingInterval?: string; subscriptionEndsAt?: Date; renewalReminderSentAt?: Date; paymentFailedAt?: Date | null }): Promise<User>;
  getUsersNeedingRenewalReminder(): Promise<User[]>;
  getUsersWithPaymentFailed(): Promise<User[]>;
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
  getDetailedEngagementEvents(filters?: { eventType?: string; limit?: number; month?: number; year?: number }): Promise<Array<{
    id: string;
    eventType: string;
    eventData: any;
    createdAt: Date | null;
    userId: string | null;
    userEmail: string | null;
    userName: string | null;
  }>>;
  
  getEngagementSummaryByMonth(year: number): Promise<Array<{
    month: number;
    year: number;
    templateDownloads: number;
    westernVerifyClicks: number;
    creditHelperUses: number;
    criminalHelperUses: number;
    totalEvents: number;
  }>>;

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
  getLastSuccessfulMonitoringRun(): Promise<MonitoringRun | undefined>;
  hasMonitoringRunThisMonth(): Promise<boolean>;

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

  // Training interest operations
  getTrainingInterest(userId: string): Promise<TrainingInterest | undefined>;
  createTrainingInterest(interest: InsertTrainingInterest): Promise<TrainingInterest>;

  // Email sequence operations
  getEmailSequences(): Promise<EmailSequence[]>;
  getEmailSequenceByTrigger(trigger: string): Promise<EmailSequence | undefined>;
  getEmailSequenceById(id: string): Promise<EmailSequence | undefined>;
  createEmailSequence(sequence: InsertEmailSequence): Promise<EmailSequence>;
  
  // Email sequence step operations
  getEmailSequenceSteps(sequenceId: string): Promise<EmailSequenceStep[]>;
  getEmailSequenceStep(id: string): Promise<EmailSequenceStep | undefined>;
  createEmailSequenceStep(step: InsertEmailSequenceStep): Promise<EmailSequenceStep>;
  
  // Email sequence enrollment operations
  getActiveEnrollments(): Promise<EmailSequenceEnrollment[]>;
  getEnrollmentsByUser(userId: string): Promise<EmailSequenceEnrollment[]>;
  getActiveEnrollmentByUserAndSequence(userId: string, sequenceId: string): Promise<EmailSequenceEnrollment | undefined>;
  createEnrollment(enrollment: InsertEmailSequenceEnrollment): Promise<EmailSequenceEnrollment>;
  updateEnrollment(id: string, data: Partial<EmailSequenceEnrollment>): Promise<EmailSequenceEnrollment>;
  getPendingEnrollments(): Promise<EmailSequenceEnrollment[]>;
  
  // Email event operations
  createEmailEvent(event: InsertEmailEvent): Promise<EmailEvent>;
  updateEmailEventStatus(resendId: string, status: string, timestamp: Date): Promise<EmailEvent | undefined>;
  getEmailEventsByUser(userId: string): Promise<EmailEvent[]>;

  // Broadcast operations
  createBroadcast(broadcast: InsertBroadcastMessage): Promise<BroadcastMessage>;
  getAllBroadcasts(): Promise<BroadcastMessage[]>;
  getBroadcastById(id: string): Promise<BroadcastMessage | undefined>;
  createBroadcastRecipient(recipient: InsertBroadcastRecipient): Promise<BroadcastRecipient>;
  getBroadcastRecipientsByBroadcastId(broadcastId: string): Promise<BroadcastRecipient[]>;
  getUserBroadcastRecipients(userId: string): Promise<(BroadcastRecipient & { broadcast: BroadcastMessage })[]>;
  getUnreadBroadcastCount(userId: string): Promise<number>;
  markBroadcastAsRead(broadcastId: string, userId: string): Promise<void>;
  createBroadcastReply(reply: InsertBroadcastReply): Promise<BroadcastReply>;
  getBroadcastRepliesByBroadcastId(broadcastId: string): Promise<(BroadcastReply & { user: User })[]>;
  markBroadcastReplyAsRead(replyId: string): Promise<void>;
  getTrialingUsers(): Promise<User[]>;
  updateBroadcastRecipientCount(broadcastId: string, count: number): Promise<void>;

  // Rental Application System - Property operations
  getRentalPropertiesByUserId(userId: string): Promise<RentalProperty[]>;
  getRentalProperty(id: string, userId: string): Promise<RentalProperty | undefined>;
  getRentalPropertyById(id: string): Promise<RentalProperty | undefined>; // Internal use only - no ownership check
  createRentalProperty(property: InsertRentalProperty): Promise<RentalProperty>;
  updateRentalProperty(id: string, userId: string, property: Partial<InsertRentalProperty>): Promise<RentalProperty | null>;
  deleteRentalProperty(id: string, userId: string): Promise<boolean>;

  // Rental Application System - Unit operations
  getRentalUnitsByPropertyId(propertyId: string): Promise<RentalUnit[]>;
  getRentalUnit(id: string): Promise<RentalUnit | undefined>;
  createRentalUnit(unit: InsertRentalUnit): Promise<RentalUnit>;
  updateRentalUnit(id: string, unit: Partial<InsertRentalUnit>): Promise<RentalUnit | null>;
  deleteRentalUnit(id: string): Promise<boolean>;

  // Rental Application System - Application link operations
  getRentalApplicationLinksByUnitId(unitId: string): Promise<RentalApplicationLink[]>;
  getRentalApplicationLinkByToken(token: string): Promise<RentalApplicationLink | undefined>;
  getRentalApplicationLink(id: string): Promise<RentalApplicationLink | undefined>;
  createRentalApplicationLink(link: InsertRentalApplicationLink): Promise<RentalApplicationLink>;
  deactivateRentalApplicationLink(id: string): Promise<boolean>;
  getEffectiveDocumentRequirements(linkId: string): Promise<import("@shared/schema").DocumentRequirementsConfig>;

  // Rental Application System - Submission operations
  getRentalSubmissionsByUserId(userId: string, includeDeleted?: boolean): Promise<RentalSubmission[]>;
  getRentalSubmission(id: string): Promise<RentalSubmission | undefined>;
  createRentalSubmission(submission: InsertRentalSubmission): Promise<RentalSubmission>;
  updateRentalSubmission(id: string, submission: Partial<InsertRentalSubmission>): Promise<RentalSubmission | null>;
  softDeleteRentalSubmission(id: string): Promise<boolean>;
  getPendingSubmissionsCount(userId: string): Promise<number>;

  // Rental Application System - Submission people operations
  getRentalSubmissionPeople(submissionId: string): Promise<RentalSubmissionPerson[]>;
  getRentalSubmissionPersonByToken(token: string): Promise<RentalSubmissionPerson | undefined>;
  createRentalSubmissionPerson(person: InsertRentalSubmissionPerson): Promise<RentalSubmissionPerson>;
  updateRentalSubmissionPerson(id: string, person: Partial<InsertRentalSubmissionPerson>): Promise<RentalSubmissionPerson | null>;

  // Rental Application System - File operations
  getRentalSubmissionFiles(personId: string): Promise<RentalSubmissionFile[]>;
  getRentalSubmissionFile(id: string): Promise<RentalSubmissionFile | undefined>;
  createRentalSubmissionFile(file: InsertRentalSubmissionFile): Promise<RentalSubmissionFile>;
  deleteRentalSubmissionFile(id: string): Promise<boolean>;

  // Rental Application System - Acknowledgement operations
  createRentalSubmissionAcknowledgement(ack: InsertRentalSubmissionAcknowledgement): Promise<RentalSubmissionAcknowledgement>;
  getRentalSubmissionAcknowledgements(submissionId: string): Promise<RentalSubmissionAcknowledgement[]>;

  // Rental Application System - Screening order operations (per-person)
  getRentalScreeningOrder(submissionId: string): Promise<RentalScreeningOrder | undefined>; // Legacy - gets first order
  getRentalScreeningOrderById(orderId: string): Promise<RentalScreeningOrder | undefined>;
  getRentalScreeningOrderByPerson(personId: string): Promise<RentalScreeningOrder | undefined>;
  getRentalScreeningOrdersBySubmission(submissionId: string): Promise<RentalScreeningOrder[]>;
  getRentalScreeningOrderByReference(referenceNumber: string): Promise<RentalScreeningOrder | undefined>;
  createRentalScreeningOrder(order: InsertRentalScreeningOrder): Promise<RentalScreeningOrder>;
  updateRentalScreeningOrder(id: string, order: Partial<InsertRentalScreeningOrder>): Promise<RentalScreeningOrder | null>;
  deleteRentalScreeningOrder(id: string): Promise<boolean>;
  getScreeningOrdersNeedingPoll(): Promise<RentalScreeningOrder[]>;
  getInProgressScreeningOrdersWithOwnerInfo(): Promise<Array<{
    order: RentalScreeningOrder;
    ownerEmail: string;
    ownerFirstName: string | null;
    personName: string;
    propertyName: string;
    unitName: string;
  }>>;

  // Rental Application System - Decision operations
  getRentalDecision(submissionId: string): Promise<RentalDecision | undefined>;
  createRentalDecision(decision: InsertRentalDecision): Promise<RentalDecision>;

  // Rental Application System - Denial reason operations
  getRentalDenialReasons(decisionId: string): Promise<RentalDenialReason[]>;
  createRentalDenialReason(reason: InsertRentalDenialReason): Promise<RentalDenialReason>;
  createRentalDenialReasons(reasons: InsertRentalDenialReason[]): Promise<RentalDenialReason[]>;

  // Rental Application System - Decision letter operations
  getRentalDecisionLetters(submissionId: string): Promise<RentalDecisionLetter[]>;
  createRentalDecisionLetter(letter: InsertRentalDecisionLetter): Promise<RentalDecisionLetter>;
  updateRentalDecisionLetter(id: string, letter: Partial<InsertRentalDecisionLetter>): Promise<RentalDecisionLetter | null>;

  // Rental Application System - Event logging
  logRentalApplicationEvent(event: InsertRentalApplicationEvent): Promise<RentalApplicationEvent>;
  getRentalApplicationEvents(submissionId: string): Promise<RentalApplicationEvent[]>;

  // Retention Settings operations
  getRetentionSettings(propertyId: string): Promise<RetentionSettings | undefined>;
  upsertRetentionSettings(settings: InsertRetentionSettings): Promise<RetentionSettings>;
  getAllRetentionSettings(): Promise<RetentionSettings[]>;

  // Application Compliance Rules operations
  getApplicationComplianceRules(stateId: string): Promise<ApplicationComplianceRule[]>;
  getActiveComplianceRulesForState(stateId: string): Promise<ApplicationComplianceRule[]>;
  getAllApplicationComplianceRules(): Promise<ApplicationComplianceRule[]>;
  createApplicationComplianceRule(rule: InsertApplicationComplianceRule): Promise<ApplicationComplianceRule>;
  updateApplicationComplianceRule(id: string, rule: Partial<InsertApplicationComplianceRule>): Promise<ApplicationComplianceRule | null>;
  deactivateComplianceRule(id: string): Promise<boolean>;

  // Landlord screening credentials operations
  getLandlordScreeningCredentials(userId: string): Promise<LandlordScreeningCredentials | undefined>;
  createLandlordScreeningCredentials(credentials: InsertLandlordScreeningCredentials): Promise<LandlordScreeningCredentials>;
  updateLandlordScreeningCredentials(userId: string, credentials: Partial<InsertLandlordScreeningCredentials>): Promise<LandlordScreeningCredentials | null>;
  deleteLandlordScreeningCredentials(userId: string): Promise<boolean>;
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

  async updateUserPreferences(id: string, data: { 
    preferredState?: string;
    notifyLegalUpdates?: boolean;
    notifyTemplateRevisions?: boolean;
    notifyBillingAlerts?: boolean;
    notifyTips?: boolean;
    businessName?: string | null;
    phoneNumber?: string | null;
  }): Promise<User> {
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

  async updateUserStripeInfo(id: string, data: { stripeCustomerId?: string; stripeSubscriptionId?: string; subscriptionStatus?: string; billingInterval?: string; subscriptionEndsAt?: Date; renewalReminderSentAt?: Date; paymentFailedAt?: Date | null }): Promise<User> {
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

  async getUsersNeedingRenewalReminder(): Promise<User[]> {
    return handleDbOperation(async () => {
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      
      const fourDaysFromNow = new Date();
      fourDaysFromNow.setDate(fourDaysFromNow.getDate() + 4);
      
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      return await db.select().from(users).where(
        sql`${users.subscriptionStatus} = 'active' 
            AND ${users.billingInterval} = 'year'
            AND ${users.subscriptionEndsAt} IS NOT NULL
            AND ${users.subscriptionEndsAt} <= ${sevenDaysFromNow}
            AND ${users.subscriptionEndsAt} > ${fourDaysFromNow}
            AND (${users.renewalReminderSentAt} IS NULL 
                 OR ${users.renewalReminderSentAt} < ${thirtyDaysAgo})
            AND ${users.notifyBillingAlerts} = true`
      );
    }, 'getUsersNeedingRenewalReminder');
  }

  async getUsersWithPaymentFailed(): Promise<User[]> {
    return handleDbOperation(async () => {
      return await db.select().from(users).where(
        sql`${users.subscriptionStatus} = 'past_due' AND ${users.paymentFailedAt} IS NOT NULL`
      );
    }, 'getUsersWithPaymentFailed');
  }

  async getAllActiveUsers(): Promise<User[]> {
    return await db.select().from(users).where(
      eq(users.subscriptionStatus, "active")
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
      .orderBy(desc(legalUpdates.effectiveDate));
  }

  async getAllLegalUpdates(): Promise<LegalUpdate[]> {
    return await db
      .select()
      .from(legalUpdates)
      .orderBy(desc(legalUpdates.effectiveDate));
  }

  async getRecentLegalUpdates(limit: number = 10): Promise<LegalUpdate[]> {
    return await db
      .select()
      .from(legalUpdates)
      .where(eq(legalUpdates.isActive, true))
      .orderBy(desc(legalUpdates.effectiveDate))
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
    // Count only ACTIVE trials (not expired)
    const trialing = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(
        and(
          eq(users.subscriptionStatus, 'trialing'),
          sql`(${users.trialEndsAt} IS NULL OR ${users.trialEndsAt} >= NOW())`
        )
      );
    
    // Count expired trials separately
    const expiredTrials = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(
        and(
          eq(users.subscriptionStatus, 'trialing'),
          sql`${users.trialEndsAt} < NOW()`
        )
      );
    const canceled = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.subscriptionStatus, 'canceled'));

    // Calculate MRR based on actual subscription intervals
    // Monthly: $10/month, Yearly: $100/year = $8.33/month
    // Handle variations: 'month'/'monthly' and 'year'/'yearly'
    const yearlySubscriptions = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(
        and(
          eq(users.subscriptionStatus, 'active'),
          or(
            eq(users.billingInterval, 'year'),
            eq(users.billingInterval, 'yearly')
          )
        )
      );
    
    const yearlyCount = Number(yearlySubscriptions[0]?.count || 0);
    const activeCount = Number(activeSubscriptions[0]?.count || 0);
    // Monthly count = total active minus yearly (everything not yearly is monthly)
    const monthlyCount = activeCount - yearlyCount;
    // MRR = (monthly subs × $10) + (yearly subs × $100/12)
    const mrr = (monthlyCount * 10) + (yearlyCount * (100 / 12));

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

    // Usage metrics - filter by current month only
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    
    const templateDownloads = await db
      .select({ count: sql<number>`count(*)` })
      .from(analyticsEvents)
      .where(and(
        eq(analyticsEvents.eventType, 'template_download'),
        gte(analyticsEvents.createdAt, monthStart),
        lte(analyticsEvents.createdAt, monthEnd)
      ));
    
    const westernVerifyClicks = await db
      .select({ count: sql<number>`count(*)` })
      .from(analyticsEvents)
      .where(and(
        eq(analyticsEvents.eventType, 'western_verify_click'),
        gte(analyticsEvents.createdAt, monthStart),
        lte(analyticsEvents.createdAt, monthEnd)
      ));

    const creditHelperUses = await db
      .select({ count: sql<number>`count(*)` })
      .from(analyticsEvents)
      .where(and(
        eq(analyticsEvents.eventType, 'credit_helper_use'),
        gte(analyticsEvents.createdAt, monthStart),
        lte(analyticsEvents.createdAt, monthEnd)
      ));

    const criminalHelperUses = await db
      .select({ count: sql<number>`count(*)` })
      .from(analyticsEvents)
      .where(and(
        eq(analyticsEvents.eventType, 'criminal_helper_use'),
        gte(analyticsEvents.createdAt, monthStart),
        lte(analyticsEvents.createdAt, monthEnd)
      ));

    const totalDownloads = Number(templateDownloads[0]?.count || 0);
    const totalWesternClicks = Number(westernVerifyClicks[0]?.count || 0);
    const totalCreditHelperUses = Number(creditHelperUses[0]?.count || 0);
    const totalCriminalHelperUses = Number(criminalHelperUses[0]?.count || 0);
    const totalUsersCount = Number(totalUsers[0]?.count || 0);
    const avgDownloadsPerUser = totalUsersCount > 0 ? totalDownloads / totalUsersCount : 0;

    // Total subscribers = active + trialing (people who have actually subscribed or are in trial)
    const trialingCount = Number(trialing[0]?.count || 0);
    const totalSubscribers = activeCount + trialingCount;
    
    return {
      subscriptions: {
        total: totalSubscribers,
        active: activeCount,
        trialing: trialingCount,
        expiredTrials: Number(expiredTrials[0]?.count || 0),
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
        creditHelperUses: totalCreditHelperUses,
        criminalHelperUses: totalCriminalHelperUses,
        avgDownloadsPerUser,
      },
    };
  }

  async getDetailedEngagementEvents(filters?: { eventType?: string; limit?: number; month?: number; year?: number }): Promise<Array<{
    id: string;
    eventType: string;
    eventData: any;
    createdAt: Date | null;
    userId: string | null;
    userEmail: string | null;
    userName: string | null;
  }>> {
    // Get engagement event types (exclude internal events like trial reminders)
    const engagementTypes = [
      'template_download',
      'western_verify_click',
      'credit_helper_use',
      'criminal_helper_use',
      'compliance_card_view',
      'legal_update_view',
      'screening_request',
    ];

    const limit = filters?.limit || 100;
    
    // Build conditions
    const conditions = [];
    if (filters?.eventType) {
      conditions.push(eq(analyticsEvents.eventType, filters.eventType));
    } else {
      conditions.push(inArray(analyticsEvents.eventType, engagementTypes));
    }
    
    // Add month/year filter if provided
    if (filters?.month && filters?.year) {
      const startDate = new Date(filters.year, filters.month - 1, 1);
      const endDate = new Date(filters.year, filters.month, 0, 23, 59, 59, 999);
      conditions.push(sql`${analyticsEvents.createdAt} >= ${startDate}`);
      conditions.push(sql`${analyticsEvents.createdAt} <= ${endDate}`);
    } else if (filters?.year) {
      const startDate = new Date(filters.year, 0, 1);
      const endDate = new Date(filters.year, 11, 31, 23, 59, 59, 999);
      conditions.push(sql`${analyticsEvents.createdAt} >= ${startDate}`);
      conditions.push(sql`${analyticsEvents.createdAt} <= ${endDate}`);
    }

    // Query events with user info via left join
    const events = await db
      .select({
        id: analyticsEvents.id,
        eventType: analyticsEvents.eventType,
        eventData: analyticsEvents.eventData,
        createdAt: analyticsEvents.createdAt,
        userId: analyticsEvents.userId,
        userEmail: users.email,
        userFirstName: users.firstName,
        userLastName: users.lastName,
      })
      .from(analyticsEvents)
      .leftJoin(users, eq(analyticsEvents.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(analyticsEvents.createdAt))
      .limit(limit);

    return events.map(e => ({
      id: e.id,
      eventType: e.eventType,
      eventData: e.eventData,
      createdAt: e.createdAt,
      userId: e.userId,
      userEmail: e.userEmail,
      userName: e.userFirstName && e.userLastName 
        ? `${e.userFirstName} ${e.userLastName}`
        : e.userFirstName || e.userLastName || null,
    }));
  }
  
  async getEngagementSummaryByMonth(year: number): Promise<Array<{
    month: number;
    year: number;
    templateDownloads: number;
    westernVerifyClicks: number;
    creditHelperUses: number;
    criminalHelperUses: number;
    totalEvents: number;
  }>> {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59, 999);
    
    const engagementTypes = [
      'template_download',
      'western_verify_click',
      'credit_helper_use',
      'criminal_helper_use',
    ];
    
    const events = await db
      .select({
        eventType: analyticsEvents.eventType,
        createdAt: analyticsEvents.createdAt,
      })
      .from(analyticsEvents)
      .where(and(
        inArray(analyticsEvents.eventType, engagementTypes),
        sql`${analyticsEvents.createdAt} >= ${startDate}`,
        sql`${analyticsEvents.createdAt} <= ${endDate}`
      ));
    
    // Group by month
    const monthlyData: Map<number, {
      templateDownloads: number;
      westernVerifyClicks: number;
      creditHelperUses: number;
      criminalHelperUses: number;
    }> = new Map();
    
    // Initialize all months
    for (let m = 1; m <= 12; m++) {
      monthlyData.set(m, {
        templateDownloads: 0,
        westernVerifyClicks: 0,
        creditHelperUses: 0,
        criminalHelperUses: 0,
      });
    }
    
    for (const event of events) {
      if (!event.createdAt) continue;
      const month = event.createdAt.getMonth() + 1;
      const data = monthlyData.get(month)!;
      
      switch (event.eventType) {
        case 'template_download':
          data.templateDownloads++;
          break;
        case 'western_verify_click':
          data.westernVerifyClicks++;
          break;
        case 'credit_helper_use':
          data.creditHelperUses++;
          break;
        case 'criminal_helper_use':
          data.criminalHelperUses++;
          break;
      }
    }
    
    return Array.from(monthlyData.entries()).map(([month, data]) => ({
      month,
      year,
      ...data,
      totalEvents: data.templateDownloads + data.westernVerifyClicks + data.creditHelperUses + data.criminalHelperUses,
    }));
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

  async getLastSuccessfulMonitoringRun(): Promise<MonitoringRun | undefined> {
    const [run] = await db
      .select()
      .from(monitoringRuns)
      .where(eq(monitoringRuns.status, 'success'))
      .orderBy(desc(monitoringRuns.createdAt))
      .limit(1);
    return run;
  }

  async hasMonitoringRunThisMonth(): Promise<boolean> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const [run] = await db
      .select()
      .from(monitoringRuns)
      .where(
        and(
          gte(monitoringRuns.createdAt, startOfMonth),
          eq(monitoringRuns.status, 'success')
        )
      )
      .limit(1);
    
    return !!run;
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

  async updateUploadedDocument(id: string, userId: string, updates: { fileName?: string; propertyId?: string | null; description?: string | null }): Promise<UploadedDocument | undefined> {
    const [updated] = await db
      .update(uploadedDocuments)
      .set(updates)
      .where(and(eq(uploadedDocuments.id, id), eq(uploadedDocuments.userId, userId)))
      .returning();
    return updated;
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
    // Generate month from effectiveDate if not provided
    const entryWithMonth = {
      ...entry,
      month: entry.month || (entry.effectiveDate 
        ? new Date(entry.effectiveDate).toISOString().slice(0, 7)
        : new Date().toISOString().slice(0, 7)
      ),
    };
    const [newEntry] = await db
      .insert(rentLedgerEntries)
      .values(entryWithMonth)
      .returning();
    return newEntry;
  }

  async updateRentLedgerEntry(id: string, userId: string, data: Partial<InsertRentLedgerEntry>): Promise<RentLedgerEntry | null> {
    // Generate month from effectiveDate if not provided
    const dataWithMonth = {
      ...data,
      month: data.month || (data.effectiveDate
        ? new Date(data.effectiveDate).toISOString().slice(0, 7)
        : undefined
      ),
    };
    const [updated] = await db
      .update(rentLedgerEntries)
      .set({ ...dataWithMonth, updatedAt: new Date() })
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

  // Training interest operations
  async getTrainingInterest(userId: string): Promise<TrainingInterest | undefined> {
    const [interest] = await db
      .select()
      .from(trainingInterest)
      .where(eq(trainingInterest.userId, userId));
    return interest;
  }

  async createTrainingInterest(interest: InsertTrainingInterest): Promise<TrainingInterest> {
    const [newInterest] = await db
      .insert(trainingInterest)
      .values(interest)
      .returning();
    return newInterest;
  }

  // Email sequence operations
  async getEmailSequences(): Promise<EmailSequence[]> {
    return await db.select().from(emailSequences).orderBy(emailSequences.name);
  }

  async getEmailSequenceByTrigger(trigger: string): Promise<EmailSequence | undefined> {
    const [sequence] = await db
      .select()
      .from(emailSequences)
      .where(and(eq(emailSequences.trigger, trigger), eq(emailSequences.isActive, true)));
    return sequence;
  }

  async getEmailSequenceById(id: string): Promise<EmailSequence | undefined> {
    const [sequence] = await db.select().from(emailSequences).where(eq(emailSequences.id, id));
    return sequence;
  }

  async createEmailSequence(sequence: InsertEmailSequence): Promise<EmailSequence> {
    const [newSequence] = await db.insert(emailSequences).values(sequence).returning();
    return newSequence;
  }

  // Email sequence step operations
  async getEmailSequenceSteps(sequenceId: string): Promise<EmailSequenceStep[]> {
    return await db
      .select()
      .from(emailSequenceSteps)
      .where(eq(emailSequenceSteps.sequenceId, sequenceId))
      .orderBy(emailSequenceSteps.stepNumber);
  }

  async getEmailSequenceStep(id: string): Promise<EmailSequenceStep | undefined> {
    const [step] = await db.select().from(emailSequenceSteps).where(eq(emailSequenceSteps.id, id));
    return step;
  }

  async createEmailSequenceStep(step: InsertEmailSequenceStep): Promise<EmailSequenceStep> {
    const [newStep] = await db.insert(emailSequenceSteps).values(step).returning();
    return newStep;
  }

  // Email sequence enrollment operations
  async getActiveEnrollments(): Promise<EmailSequenceEnrollment[]> {
    return await db
      .select()
      .from(emailSequenceEnrollments)
      .where(eq(emailSequenceEnrollments.status, "active"));
  }

  async getEnrollmentsByUser(userId: string): Promise<EmailSequenceEnrollment[]> {
    return await db
      .select()
      .from(emailSequenceEnrollments)
      .where(eq(emailSequenceEnrollments.userId, userId));
  }

  async getActiveEnrollmentByUserAndSequence(userId: string, sequenceId: string): Promise<EmailSequenceEnrollment | undefined> {
    const [enrollment] = await db
      .select()
      .from(emailSequenceEnrollments)
      .where(
        and(
          eq(emailSequenceEnrollments.userId, userId),
          eq(emailSequenceEnrollments.sequenceId, sequenceId),
          eq(emailSequenceEnrollments.status, "active")
        )
      );
    return enrollment;
  }

  async createEnrollment(enrollment: InsertEmailSequenceEnrollment): Promise<EmailSequenceEnrollment> {
    const [newEnrollment] = await db.insert(emailSequenceEnrollments).values(enrollment).returning();
    return newEnrollment;
  }

  async updateEnrollment(id: string, data: Partial<EmailSequenceEnrollment>): Promise<EmailSequenceEnrollment> {
    const [updated] = await db
      .update(emailSequenceEnrollments)
      .set(data)
      .where(eq(emailSequenceEnrollments.id, id))
      .returning();
    return updated;
  }

  async getPendingEnrollments(): Promise<EmailSequenceEnrollment[]> {
    const now = new Date();
    return await db
      .select()
      .from(emailSequenceEnrollments)
      .where(
        and(
          eq(emailSequenceEnrollments.status, "active"),
          sql`${emailSequenceEnrollments.nextSendAt} <= ${now}`
        )
      );
  }

  // Email event operations
  async createEmailEvent(event: InsertEmailEvent): Promise<EmailEvent> {
    const [newEvent] = await db.insert(emailEvents).values(event).returning();
    return newEvent;
  }

  async updateEmailEventStatus(resendId: string, status: string, timestamp: Date): Promise<EmailEvent | undefined> {
    const updateData: Record<string, any> = { status };
    
    if (status === "delivered") updateData.deliveredAt = timestamp;
    else if (status === "opened") updateData.openedAt = timestamp;
    else if (status === "clicked") updateData.clickedAt = timestamp;
    else if (status === "bounced") updateData.bouncedAt = timestamp;
    
    const [updated] = await db
      .update(emailEvents)
      .set(updateData)
      .where(eq(emailEvents.resendId, resendId))
      .returning();
    return updated;
  }

  async getEmailEventsByUser(userId: string): Promise<EmailEvent[]> {
    return await db
      .select()
      .from(emailEvents)
      .where(eq(emailEvents.userId, userId))
      .orderBy(desc(emailEvents.sentAt));
  }

  // Broadcast operations
  async createBroadcast(broadcast: InsertBroadcastMessage): Promise<BroadcastMessage> {
    const [newBroadcast] = await db.insert(broadcastMessages).values(broadcast).returning();
    return newBroadcast;
  }

  async getAllBroadcasts(): Promise<BroadcastMessage[]> {
    return await db
      .select()
      .from(broadcastMessages)
      .orderBy(desc(broadcastMessages.createdAt));
  }

  async getBroadcastById(id: string): Promise<BroadcastMessage | undefined> {
    const [broadcast] = await db
      .select()
      .from(broadcastMessages)
      .where(eq(broadcastMessages.id, id));
    return broadcast;
  }

  async createBroadcastRecipient(recipient: InsertBroadcastRecipient): Promise<BroadcastRecipient> {
    const [newRecipient] = await db.insert(broadcastRecipients).values(recipient).returning();
    return newRecipient;
  }

  async getBroadcastRecipientsByBroadcastId(broadcastId: string): Promise<BroadcastRecipient[]> {
    return await db
      .select()
      .from(broadcastRecipients)
      .where(eq(broadcastRecipients.broadcastId, broadcastId));
  }

  async getUserBroadcastRecipients(userId: string): Promise<(BroadcastRecipient & { broadcast: BroadcastMessage })[]> {
    const results = await db
      .select()
      .from(broadcastRecipients)
      .innerJoin(broadcastMessages, eq(broadcastRecipients.broadcastId, broadcastMessages.id))
      .where(eq(broadcastRecipients.userId, userId))
      .orderBy(desc(broadcastMessages.createdAt));
    
    return results.map(r => ({
      ...r.broadcast_recipients,
      broadcast: r.broadcast_messages,
    }));
  }

  async getUnreadBroadcastCount(userId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(broadcastRecipients)
      .where(and(
        eq(broadcastRecipients.userId, userId),
        eq(broadcastRecipients.isRead, false)
      ));
    return Number(result[0]?.count || 0);
  }

  async markBroadcastAsRead(broadcastId: string, userId: string): Promise<void> {
    await db
      .update(broadcastRecipients)
      .set({ isRead: true, readAt: new Date() })
      .where(and(
        eq(broadcastRecipients.broadcastId, broadcastId),
        eq(broadcastRecipients.userId, userId)
      ));
  }

  async createBroadcastReply(reply: InsertBroadcastReply): Promise<BroadcastReply> {
    const [newReply] = await db.insert(broadcastReplies).values(reply).returning();
    return newReply;
  }

  async getBroadcastRepliesByBroadcastId(broadcastId: string): Promise<(BroadcastReply & { user: User })[]> {
    const results = await db
      .select()
      .from(broadcastReplies)
      .innerJoin(users, eq(broadcastReplies.userId, users.id))
      .where(eq(broadcastReplies.broadcastId, broadcastId))
      .orderBy(desc(broadcastReplies.createdAt));
    
    return results.map(r => ({
      ...r.broadcast_replies,
      user: r.users,
    }));
  }

  async markBroadcastReplyAsRead(replyId: string): Promise<void> {
    await db
      .update(broadcastReplies)
      .set({ isReadByAdmin: true, readByAdminAt: new Date() })
      .where(eq(broadcastReplies.id, replyId));
  }

  async getTrialingUsers(): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(eq(users.subscriptionStatus, "trialing"));
  }

  async updateBroadcastRecipientCount(broadcastId: string, count: number): Promise<void> {
    await db
      .update(broadcastMessages)
      .set({ recipientCount: count })
      .where(eq(broadcastMessages.id, broadcastId));
  }

  // ============================================================
  // RENTAL APPLICATION SYSTEM - Implementation
  // ============================================================

  // Rental Property operations
  async getRentalPropertiesByUserId(userId: string): Promise<RentalProperty[]> {
    return handleDbOperation(async () => {
      return await db.select().from(rentalProperties).where(eq(rentalProperties.userId, userId)).orderBy(desc(rentalProperties.createdAt));
    }, 'getRentalPropertiesByUserId');
  }

  async getRentalProperty(id: string, userId: string): Promise<RentalProperty | undefined> {
    return handleDbOperation(async () => {
      const [property] = await db.select().from(rentalProperties).where(and(eq(rentalProperties.id, id), eq(rentalProperties.userId, userId)));
      return property;
    }, 'getRentalProperty');
  }

  async getRentalPropertyById(id: string): Promise<RentalProperty | undefined> {
    return handleDbOperation(async () => {
      const [property] = await db.select().from(rentalProperties).where(eq(rentalProperties.id, id));
      return property;
    }, 'getRentalPropertyById');
  }

  async createRentalProperty(property: InsertRentalProperty): Promise<RentalProperty> {
    return handleDbOperation(async () => {
      const [newProperty] = await db.insert(rentalProperties).values(property).returning();
      return newProperty;
    }, 'createRentalProperty');
  }

  async updateRentalProperty(id: string, userId: string, property: Partial<InsertRentalProperty>): Promise<RentalProperty | null> {
    return handleDbOperation(async () => {
      const [updated] = await db.update(rentalProperties).set({ ...property, updatedAt: new Date() }).where(and(eq(rentalProperties.id, id), eq(rentalProperties.userId, userId))).returning();
      return updated || null;
    }, 'updateRentalProperty');
  }

  async deleteRentalProperty(id: string, userId: string): Promise<boolean> {
    return handleDbOperation(async () => {
      const result = await db.delete(rentalProperties).where(and(eq(rentalProperties.id, id), eq(rentalProperties.userId, userId)));
      return true;
    }, 'deleteRentalProperty');
  }

  // Rental Unit operations
  async getRentalUnitsByPropertyId(propertyId: string): Promise<RentalUnit[]> {
    return handleDbOperation(async () => {
      return await db.select().from(rentalUnits).where(eq(rentalUnits.propertyId, propertyId)).orderBy(rentalUnits.unitLabel);
    }, 'getRentalUnitsByPropertyId');
  }

  async getRentalUnit(id: string): Promise<RentalUnit | undefined> {
    return handleDbOperation(async () => {
      const [unit] = await db.select().from(rentalUnits).where(eq(rentalUnits.id, id));
      return unit;
    }, 'getRentalUnit');
  }

  async createRentalUnit(unit: InsertRentalUnit): Promise<RentalUnit> {
    return handleDbOperation(async () => {
      const [newUnit] = await db.insert(rentalUnits).values(unit).returning();
      return newUnit;
    }, 'createRentalUnit');
  }

  async updateRentalUnit(id: string, unit: Partial<InsertRentalUnit>): Promise<RentalUnit | null> {
    return handleDbOperation(async () => {
      const [updated] = await db.update(rentalUnits).set({ ...unit, updatedAt: new Date() }).where(eq(rentalUnits.id, id)).returning();
      return updated || null;
    }, 'updateRentalUnit');
  }

  async deleteRentalUnit(id: string): Promise<boolean> {
    return handleDbOperation(async () => {
      await db.delete(rentalUnits).where(eq(rentalUnits.id, id));
      return true;
    }, 'deleteRentalUnit');
  }

  // Rental Application Link operations
  async getRentalApplicationLinksByUnitId(unitId: string): Promise<RentalApplicationLink[]> {
    return handleDbOperation(async () => {
      return await db.select().from(rentalApplicationLinks).where(eq(rentalApplicationLinks.unitId, unitId)).orderBy(desc(rentalApplicationLinks.createdAt));
    }, 'getRentalApplicationLinksByUnitId');
  }

  async getRentalApplicationLinkByToken(token: string): Promise<RentalApplicationLink | undefined> {
    return handleDbOperation(async () => {
      const [link] = await db.select().from(rentalApplicationLinks).where(eq(rentalApplicationLinks.publicToken, token));
      return link;
    }, 'getRentalApplicationLinkByToken');
  }

  async getRentalApplicationLink(id: string): Promise<RentalApplicationLink | undefined> {
    return handleDbOperation(async () => {
      const [link] = await db.select().from(rentalApplicationLinks).where(eq(rentalApplicationLinks.id, id));
      return link;
    }, 'getRentalApplicationLink');
  }

  async createRentalApplicationLink(link: InsertRentalApplicationLink): Promise<RentalApplicationLink> {
    return handleDbOperation(async () => {
      const [newLink] = await db.insert(rentalApplicationLinks).values(link).returning();
      return newLink;
    }, 'createRentalApplicationLink');
  }

  async deactivateRentalApplicationLink(id: string): Promise<boolean> {
    return handleDbOperation(async () => {
      await db.update(rentalApplicationLinks).set({ isActive: false }).where(eq(rentalApplicationLinks.id, id));
      return true;
    }, 'deactivateRentalApplicationLink');
  }

  async getEffectiveDocumentRequirements(linkId: string): Promise<import("@shared/schema").DocumentRequirementsConfig> {
    return handleDbOperation(async () => {
      const { DEFAULT_DOCUMENT_REQUIREMENTS } = await import("@shared/schema");
      
      // Get link -> unit -> property chain
      const [link] = await db.select().from(rentalApplicationLinks).where(eq(rentalApplicationLinks.id, linkId));
      if (!link) return DEFAULT_DOCUMENT_REQUIREMENTS;
      
      const [unit] = await db.select().from(rentalUnits).where(eq(rentalUnits.id, link.unitId));
      if (!unit) return DEFAULT_DOCUMENT_REQUIREMENTS;
      
      const [property] = await db.select().from(rentalProperties).where(eq(rentalProperties.id, unit.propertyId));
      if (!property) return DEFAULT_DOCUMENT_REQUIREMENTS;
      
      // Return property's requirements, or defaults if not set
      return (property.requiredDocumentTypes as import("@shared/schema").DocumentRequirementsConfig) || DEFAULT_DOCUMENT_REQUIREMENTS;
    }, 'getEffectiveDocumentRequirements');
  }

  // Rental Submission operations
  async getRentalSubmissionsByUserId(userId: string, includeDeleted: boolean = false): Promise<RentalSubmission[]> {
    return handleDbOperation(async () => {
      const results = await db
        .select({ submission: rentalSubmissions })
        .from(rentalSubmissions)
        .innerJoin(rentalApplicationLinks, eq(rentalSubmissions.applicationLinkId, rentalApplicationLinks.id))
        .innerJoin(rentalUnits, eq(rentalApplicationLinks.unitId, rentalUnits.id))
        .innerJoin(rentalProperties, eq(rentalUnits.propertyId, rentalProperties.id))
        .where(
          includeDeleted 
            ? eq(rentalProperties.userId, userId)
            : and(eq(rentalProperties.userId, userId), isNull(rentalSubmissions.deletedAt))
        )
        .orderBy(desc(rentalSubmissions.createdAt));
      return results.map(r => r.submission);
    }, 'getRentalSubmissionsByUserId');
  }

  async getRentalSubmission(id: string): Promise<RentalSubmission | undefined> {
    return handleDbOperation(async () => {
      const [submission] = await db.select().from(rentalSubmissions).where(eq(rentalSubmissions.id, id));
      return submission;
    }, 'getRentalSubmission');
  }

  async createRentalSubmission(submission: InsertRentalSubmission): Promise<RentalSubmission> {
    return handleDbOperation(async () => {
      const [newSubmission] = await db.insert(rentalSubmissions).values(submission).returning();
      return newSubmission;
    }, 'createRentalSubmission');
  }

  async updateRentalSubmission(id: string, submission: Partial<InsertRentalSubmission>): Promise<RentalSubmission | null> {
    return handleDbOperation(async () => {
      const [updated] = await db.update(rentalSubmissions).set({ ...submission, updatedAt: new Date() }).where(eq(rentalSubmissions.id, id)).returning();
      return updated || null;
    }, 'updateRentalSubmission');
  }

  async softDeleteRentalSubmission(id: string): Promise<boolean> {
    return handleDbOperation(async () => {
      const [deleted] = await db.update(rentalSubmissions)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(rentalSubmissions.id, id))
        .returning();
      return !!deleted;
    }, 'softDeleteRentalSubmission');
  }

  async getPendingSubmissionsCount(userId: string): Promise<number> {
    return handleDbOperation(async () => {
      const results = await db
        .select({ id: rentalSubmissions.id })
        .from(rentalSubmissions)
        .innerJoin(rentalApplicationLinks, eq(rentalSubmissions.applicationLinkId, rentalApplicationLinks.id))
        .innerJoin(rentalUnits, eq(rentalApplicationLinks.unitId, rentalUnits.id))
        .innerJoin(rentalProperties, eq(rentalUnits.propertyId, rentalProperties.id))
        .leftJoin(rentalDecisions, eq(rentalSubmissions.id, rentalDecisions.submissionId))
        .where(and(
          eq(rentalProperties.userId, userId),
          isNull(rentalSubmissions.deletedAt),
          isNull(rentalDecisions.id)
        ));
      return results.length;
    }, 'getPendingSubmissionsCount');
  }

  // Rental Submission People operations
  async getRentalSubmissionPeople(submissionId: string): Promise<RentalSubmissionPerson[]> {
    return handleDbOperation(async () => {
      return await db.select().from(rentalSubmissionPeople).where(eq(rentalSubmissionPeople.submissionId, submissionId));
    }, 'getRentalSubmissionPeople');
  }

  async getRentalSubmissionPersonByToken(token: string): Promise<RentalSubmissionPerson | undefined> {
    return handleDbOperation(async () => {
      const [person] = await db.select().from(rentalSubmissionPeople).where(eq(rentalSubmissionPeople.inviteToken, token));
      return person;
    }, 'getRentalSubmissionPersonByToken');
  }

  async createRentalSubmissionPerson(person: InsertRentalSubmissionPerson): Promise<RentalSubmissionPerson> {
    return handleDbOperation(async () => {
      const [newPerson] = await db.insert(rentalSubmissionPeople).values(person).returning();
      return newPerson;
    }, 'createRentalSubmissionPerson');
  }

  async updateRentalSubmissionPerson(id: string, person: Partial<InsertRentalSubmissionPerson>): Promise<RentalSubmissionPerson | null> {
    return handleDbOperation(async () => {
      const [updated] = await db.update(rentalSubmissionPeople).set({ ...person, updatedAt: new Date() }).where(eq(rentalSubmissionPeople.id, id)).returning();
      return updated || null;
    }, 'updateRentalSubmissionPerson');
  }

  async deleteRentalSubmissionPerson(id: string): Promise<boolean> {
    return handleDbOperation(async () => {
      await db.delete(rentalSubmissionPeople).where(eq(rentalSubmissionPeople.id, id));
      return true;
    }, 'deleteRentalSubmissionPerson');
  }

  // Rental Submission File operations
  async getRentalSubmissionFiles(personId: string): Promise<RentalSubmissionFile[]> {
    return handleDbOperation(async () => {
      return await db.select().from(rentalSubmissionFiles).where(eq(rentalSubmissionFiles.personId, personId));
    }, 'getRentalSubmissionFiles');
  }

  async getRentalSubmissionFile(id: string): Promise<RentalSubmissionFile | undefined> {
    return handleDbOperation(async () => {
      const [file] = await db.select().from(rentalSubmissionFiles).where(eq(rentalSubmissionFiles.id, id));
      return file;
    }, 'getRentalSubmissionFile');
  }

  async createRentalSubmissionFile(file: InsertRentalSubmissionFile): Promise<RentalSubmissionFile> {
    return handleDbOperation(async () => {
      const [newFile] = await db.insert(rentalSubmissionFiles).values(file).returning();
      return newFile;
    }, 'createRentalSubmissionFile');
  }

  async deleteRentalSubmissionFile(id: string): Promise<boolean> {
    return handleDbOperation(async () => {
      await db.delete(rentalSubmissionFiles).where(eq(rentalSubmissionFiles.id, id));
      return true;
    }, 'deleteRentalSubmissionFile');
  }

  // Rental Submission Acknowledgement operations
  async createRentalSubmissionAcknowledgement(ack: InsertRentalSubmissionAcknowledgement): Promise<RentalSubmissionAcknowledgement> {
    return handleDbOperation(async () => {
      const [newAck] = await db.insert(rentalSubmissionAcknowledgements).values(ack).returning();
      return newAck;
    }, 'createRentalSubmissionAcknowledgement');
  }

  async getRentalSubmissionAcknowledgements(submissionId: string): Promise<RentalSubmissionAcknowledgement[]> {
    return handleDbOperation(async () => {
      return await db.select().from(rentalSubmissionAcknowledgements).where(eq(rentalSubmissionAcknowledgements.submissionId, submissionId));
    }, 'getRentalSubmissionAcknowledgements');
  }

  // Rental Screening Order operations (per-person)
  async getRentalScreeningOrder(submissionId: string): Promise<RentalScreeningOrder | undefined> {
    return handleDbOperation(async () => {
      const [order] = await db.select().from(rentalScreeningOrders).where(eq(rentalScreeningOrders.submissionId, submissionId));
      return order;
    }, 'getRentalScreeningOrder');
  }

  async getRentalScreeningOrderById(orderId: string): Promise<RentalScreeningOrder | undefined> {
    return handleDbOperation(async () => {
      const [order] = await db.select().from(rentalScreeningOrders).where(eq(rentalScreeningOrders.id, orderId));
      return order;
    }, 'getRentalScreeningOrderById');
  }

  async getRentalScreeningOrderByPerson(personId: string): Promise<RentalScreeningOrder | undefined> {
    return handleDbOperation(async () => {
      const [order] = await db.select().from(rentalScreeningOrders).where(eq(rentalScreeningOrders.personId, personId));
      return order;
    }, 'getRentalScreeningOrderByPerson');
  }

  async getRentalScreeningOrdersBySubmission(submissionId: string): Promise<RentalScreeningOrder[]> {
    return handleDbOperation(async () => {
      return await db.select().from(rentalScreeningOrders).where(eq(rentalScreeningOrders.submissionId, submissionId));
    }, 'getRentalScreeningOrdersBySubmission');
  }

  async getRentalScreeningOrderByReference(referenceNumber: string): Promise<RentalScreeningOrder | undefined> {
    return handleDbOperation(async () => {
      const [order] = await db.select().from(rentalScreeningOrders).where(eq(rentalScreeningOrders.referenceNumber, referenceNumber));
      return order;
    }, 'getRentalScreeningOrderByReference');
  }

  async createRentalScreeningOrder(order: InsertRentalScreeningOrder): Promise<RentalScreeningOrder> {
    return handleDbOperation(async () => {
      const [newOrder] = await db.insert(rentalScreeningOrders).values(order).returning();
      return newOrder;
    }, 'createRentalScreeningOrder');
  }

  async updateRentalScreeningOrder(id: string, order: Partial<InsertRentalScreeningOrder>): Promise<RentalScreeningOrder | null> {
    return handleDbOperation(async () => {
      const [updated] = await db.update(rentalScreeningOrders).set({ ...order, updatedAt: new Date() }).where(eq(rentalScreeningOrders.id, id)).returning();
      return updated || null;
    }, 'updateRentalScreeningOrder');
  }

  async deleteRentalScreeningOrder(id: string): Promise<boolean> {
    return handleDbOperation(async () => {
      const result = await db.delete(rentalScreeningOrders).where(eq(rentalScreeningOrders.id, id));
      return result.rowCount ? result.rowCount > 0 : false;
    }, 'deleteRentalScreeningOrder');
  }

  async getScreeningOrdersNeedingPoll(): Promise<RentalScreeningOrder[]> {
    return handleDbOperation(async () => {
      const now = new Date();
      return await db.select().from(rentalScreeningOrders)
        .where(
          and(
            // Non-final statuses only
            or(
              eq(rentalScreeningOrders.status, 'sent'),
              eq(rentalScreeningOrders.status, 'in_progress')
            ),
            // Time to poll (nextStatusCheckAt <= now)
            lte(rentalScreeningOrders.nextStatusCheckAt, now),
            // Still within polling window (pollUntil > now)
            gt(rentalScreeningOrders.pollUntil, now)
          )
        )
        .limit(10); // Batch size to avoid overloading
    }, 'getScreeningOrdersNeedingPoll');
  }

  async getInProgressScreeningOrdersWithOwnerInfo(): Promise<Array<{
    order: RentalScreeningOrder;
    ownerEmail: string;
    ownerFirstName: string | null;
    personName: string;
    propertyName: string;
    unitName: string;
  }>> {
    return handleDbOperation(async () => {
      // Get in-progress orders that haven't been notified yet
      const results = await db
        .select({
          order: rentalScreeningOrders,
          ownerEmail: users.email,
          ownerFirstName: users.firstName,
          personFirstName: rentalSubmissionPeople.firstName,
          personLastName: rentalSubmissionPeople.lastName,
          propertyName: rentalProperties.name,
          unitLabel: rentalUnits.unitLabel,
        })
        .from(rentalScreeningOrders)
        .innerJoin(rentalSubmissions, eq(rentalScreeningOrders.submissionId, rentalSubmissions.id))
        .innerJoin(rentalApplicationLinks, eq(rentalSubmissions.applicationLinkId, rentalApplicationLinks.id))
        .innerJoin(rentalUnits, eq(rentalApplicationLinks.unitId, rentalUnits.id))
        .innerJoin(rentalProperties, eq(rentalUnits.propertyId, rentalProperties.id))
        .innerJoin(users, eq(rentalProperties.userId, users.id))
        .leftJoin(rentalSubmissionPeople, eq(rentalScreeningOrders.personId, rentalSubmissionPeople.id))
        .where(
          and(
            // Include in-progress orders OR complete orders needing notification retry
            or(
              eq(rentalScreeningOrders.status, 'in_progress'),
              and(
                eq(rentalScreeningOrders.status, 'complete'),
                isNull(rentalScreeningOrders.completionNotifiedAt)
              )
            ),
            isNull(rentalScreeningOrders.completionNotifiedAt)
          )
        );

      return results.map(r => ({
        order: r.order,
        ownerEmail: r.ownerEmail || '',
        ownerFirstName: r.ownerFirstName,
        personName: r.personFirstName && r.personLastName 
          ? `${r.personFirstName} ${r.personLastName}` 
          : 'Applicant',
        propertyName: r.propertyName,
        unitName: r.unitLabel,
      }));
    }, 'getInProgressScreeningOrdersWithOwnerInfo');
  }

  // Rental Decision operations
  async getRentalDecision(submissionId: string): Promise<RentalDecision | undefined> {
    return handleDbOperation(async () => {
      const [decision] = await db.select().from(rentalDecisions).where(eq(rentalDecisions.submissionId, submissionId));
      return decision;
    }, 'getRentalDecision');
  }

  async createRentalDecision(decision: InsertRentalDecision): Promise<RentalDecision> {
    return handleDbOperation(async () => {
      const [newDecision] = await db.insert(rentalDecisions).values(decision).returning();
      return newDecision;
    }, 'createRentalDecision');
  }

  // Rental Denial Reason operations
  async getRentalDenialReasons(decisionId: string): Promise<RentalDenialReason[]> {
    return handleDbOperation(async () => {
      return await db.select().from(rentalDenialReasons).where(eq(rentalDenialReasons.decisionId, decisionId)).orderBy(desc(rentalDenialReasons.createdAt));
    }, 'getRentalDenialReasons');
  }

  async createRentalDenialReason(reason: InsertRentalDenialReason): Promise<RentalDenialReason> {
    return handleDbOperation(async () => {
      const [newReason] = await db.insert(rentalDenialReasons).values(reason).returning();
      return newReason;
    }, 'createRentalDenialReason');
  }

  async createRentalDenialReasons(reasons: InsertRentalDenialReason[]): Promise<RentalDenialReason[]> {
    return handleDbOperation(async () => {
      if (reasons.length === 0) return [];
      const newReasons = await db.insert(rentalDenialReasons).values(reasons).returning();
      return newReasons;
    }, 'createRentalDenialReasons');
  }

  // Rental Decision Letter operations
  async getRentalDecisionLetters(submissionId: string): Promise<RentalDecisionLetter[]> {
    return handleDbOperation(async () => {
      return await db.select().from(rentalDecisionLetters).where(eq(rentalDecisionLetters.submissionId, submissionId)).orderBy(desc(rentalDecisionLetters.createdAt));
    }, 'getRentalDecisionLetters');
  }

  async createRentalDecisionLetter(letter: InsertRentalDecisionLetter): Promise<RentalDecisionLetter> {
    return handleDbOperation(async () => {
      const [newLetter] = await db.insert(rentalDecisionLetters).values(letter).returning();
      return newLetter;
    }, 'createRentalDecisionLetter');
  }

  async updateRentalDecisionLetter(id: string, letter: Partial<InsertRentalDecisionLetter>): Promise<RentalDecisionLetter | null> {
    return handleDbOperation(async () => {
      const [updated] = await db.update(rentalDecisionLetters).set(letter).where(eq(rentalDecisionLetters.id, id)).returning();
      return updated || null;
    }, 'updateRentalDecisionLetter');
  }

  // Rental Application Event logging
  async logRentalApplicationEvent(event: InsertRentalApplicationEvent): Promise<RentalApplicationEvent> {
    return handleDbOperation(async () => {
      const [newEvent] = await db.insert(rentalApplicationEvents).values(event).returning();
      return newEvent;
    }, 'logRentalApplicationEvent');
  }

  async getRentalApplicationEvents(submissionId: string): Promise<RentalApplicationEvent[]> {
    return handleDbOperation(async () => {
      return await db.select().from(rentalApplicationEvents).where(eq(rentalApplicationEvents.submissionId, submissionId)).orderBy(desc(rentalApplicationEvents.createdAt));
    }, 'getRentalApplicationEvents');
  }

  // Retention Settings operations
  async getRetentionSettings(propertyId: string): Promise<RetentionSettings | undefined> {
    return handleDbOperation(async () => {
      const [settings] = await db.select().from(retentionSettings).where(eq(retentionSettings.propertyId, propertyId));
      return settings;
    }, 'getRetentionSettings');
  }

  async upsertRetentionSettings(settings: InsertRetentionSettings): Promise<RetentionSettings> {
    return handleDbOperation(async () => {
      const [result] = await db
        .insert(retentionSettings)
        .values(settings)
        .onConflictDoUpdate({
          target: retentionSettings.propertyId,
          set: {
            deniedUploadsDays: settings.deniedUploadsDays,
            deniedBankStatementsDays: settings.deniedBankStatementsDays,
            approvedUploadsDays: settings.approvedUploadsDays,
            approvedBankStatementsDays: settings.approvedBankStatementsDays,
            updatedAt: new Date(),
          },
        })
        .returning();
      return result;
    }, 'upsertRetentionSettings');
  }

  async getAllRetentionSettings(): Promise<RetentionSettings[]> {
    return handleDbOperation(async () => {
      return await db.select().from(retentionSettings);
    }, 'getAllRetentionSettings');
  }

  // Application Compliance Rules operations
  async getApplicationComplianceRules(stateId: string): Promise<ApplicationComplianceRule[]> {
    return handleDbOperation(async () => {
      return await db.select().from(applicationComplianceRules)
        .where(eq(applicationComplianceRules.stateId, stateId))
        .orderBy(applicationComplianceRules.sortOrder);
    }, 'getApplicationComplianceRules');
  }

  async getActiveComplianceRulesForState(stateId: string): Promise<ApplicationComplianceRule[]> {
    return handleDbOperation(async () => {
      const now = new Date();
      return await db.select().from(applicationComplianceRules)
        .where(and(
          eq(applicationComplianceRules.isActive, true),
          sql`(${applicationComplianceRules.stateId} = ${stateId} OR ${applicationComplianceRules.stateId} = 'ALL')`,
          sql`(${applicationComplianceRules.effectiveDate} IS NULL OR ${applicationComplianceRules.effectiveDate} <= ${now})`,
          sql`(${applicationComplianceRules.expiresAt} IS NULL OR ${applicationComplianceRules.expiresAt} > ${now})`
        ))
        .orderBy(applicationComplianceRules.sortOrder);
    }, 'getActiveComplianceRulesForState');
  }

  async getAllApplicationComplianceRules(): Promise<ApplicationComplianceRule[]> {
    return handleDbOperation(async () => {
      return await db.select().from(applicationComplianceRules).orderBy(applicationComplianceRules.stateId, applicationComplianceRules.sortOrder);
    }, 'getAllApplicationComplianceRules');
  }

  async createApplicationComplianceRule(rule: InsertApplicationComplianceRule): Promise<ApplicationComplianceRule> {
    return handleDbOperation(async () => {
      const [newRule] = await db.insert(applicationComplianceRules).values(rule).returning();
      return newRule;
    }, 'createApplicationComplianceRule');
  }

  async updateApplicationComplianceRule(id: string, rule: Partial<InsertApplicationComplianceRule>): Promise<ApplicationComplianceRule | null> {
    return handleDbOperation(async () => {
      const [updated] = await db.update(applicationComplianceRules)
        .set({ ...rule, updatedAt: new Date() })
        .where(eq(applicationComplianceRules.id, id))
        .returning();
      return updated || null;
    }, 'updateApplicationComplianceRule');
  }

  async deactivateComplianceRule(id: string): Promise<boolean> {
    return handleDbOperation(async () => {
      const [updated] = await db.update(applicationComplianceRules)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(applicationComplianceRules.id, id))
        .returning();
      return !!updated;
    }, 'deactivateComplianceRule');
  }

  // Landlord screening credentials operations
  async getLandlordScreeningCredentials(userId: string): Promise<LandlordScreeningCredentials | undefined> {
    return handleDbOperation(async () => {
      const [credentials] = await db.select().from(landlordScreeningCredentials)
        .where(eq(landlordScreeningCredentials.userId, userId));
      return credentials;
    }, 'getLandlordScreeningCredentials');
  }

  async createLandlordScreeningCredentials(credentials: InsertLandlordScreeningCredentials): Promise<LandlordScreeningCredentials> {
    return handleDbOperation(async () => {
      const [newCredentials] = await db.insert(landlordScreeningCredentials)
        .values(credentials)
        .returning();
      return newCredentials;
    }, 'createLandlordScreeningCredentials');
  }

  async updateLandlordScreeningCredentials(userId: string, credentials: Partial<InsertLandlordScreeningCredentials>): Promise<LandlordScreeningCredentials | null> {
    return handleDbOperation(async () => {
      const [updated] = await db.update(landlordScreeningCredentials)
        .set({ ...credentials, updatedAt: new Date() })
        .where(eq(landlordScreeningCredentials.userId, userId))
        .returning();
      return updated || null;
    }, 'updateLandlordScreeningCredentials');
  }

  async deleteLandlordScreeningCredentials(userId: string): Promise<boolean> {
    return handleDbOperation(async () => {
      const result = await db.delete(landlordScreeningCredentials)
        .where(eq(landlordScreeningCredentials.userId, userId))
        .returning();
      return result.length > 0;
    }, 'deleteLandlordScreeningCredentials');
  }

  async getAllLandlordsWithScreeningStatus(): Promise<Array<{
    user: typeof users.$inferSelect;
    credentials: LandlordScreeningCredentials | null;
  }>> {
    return handleDbOperation(async () => {
      const allUsers = await db.select().from(users);
      const allCredentials = await db.select().from(landlordScreeningCredentials);
      
      const credentialsMap = new Map<string, LandlordScreeningCredentials>();
      for (const cred of allCredentials) {
        credentialsMap.set(cred.userId, cred);
      }
      
      return allUsers.map(user => ({
        user,
        credentials: credentialsMap.get(user.id) || null,
      }));
    }, 'getAllLandlordsWithScreeningStatus');
  }
}

export const storage = new DatabaseStorage();
