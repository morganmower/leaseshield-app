import type { Express } from "express";
import { createServer, type Server } from "http";
import cookieParser from "cookie-parser";
import authRoutes from "./authRoutes";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { registerComplianceMatrixRoutes } from "./routes/complianceMatrix";
import noticeGenerationRoutes from "./routes/noticeGeneration";
import { registerSitemapRoute } from "./routes/sitemap";
import { registerUserSettingsRoutes } from "./routes/userSettings";
import { registerScreeningCredentialsRoutes } from "./routes/screeningCredentials";
import { registerSubscriptionRoutes } from "./routes/subscription";
import { registerResendWebhookRoute } from "./routes/resendWebhook";
import { registerTemplatesRoutes } from "./routes/templates";
import { registerPropertiesRoutes } from "./routes/properties";
import { registerDocumentsRoutes } from "./routes/documents";
import { registerComplianceCardsRoutes } from "./routes/complianceCards";
import { registerLegalUpdatesRoutes } from "./routes/legalUpdates";
import { registerCommunicationsRoutes } from "./routes/communications";
import { registerRentLedgerRoutes } from "./routes/rentLedger";
import { registerStripeConnectRoutes } from "./routes/stripeConnect";
import { registerRentPaymentsRoutes } from "./routes/rentPayments";
import { registerLegalUpdatesAdminRoutes } from "./routes/legalUpdatesAdmin";
import { registerNotificationsRoutes } from "./routes/notifications";
import { registerAnalyticsRoutes } from "./routes/analytics";
import { registerAdminUsersRoutes } from "./routes/adminUsers";
import { registerAdminAnalyticsRoutes } from "./routes/adminAnalytics";
import { registerAdminPlatformFeesRoutes } from "./routes/adminPlatformFees";
import { registerContactRoute } from "./routes/contact";
import { registerStatesRoute } from "./routes/states";
import { registerBlogRoutes } from "./routes/blog";
import { registerNotifyLegalUpdateRoute } from "./routes/notifyLegalUpdate";
import { registerTemplateReviewQueueRoutes } from "./routes/templateReviewQueue";
import { registerTemplateVersionsRoutes } from "./routes/templateVersions";
import { registerDocumentsGenerateRoutes } from "./routes/documentsGenerate";
import { registerLegislativeBillsRoutes } from "./routes/legislativeBills";
import { registerCaseLawRoutes } from "./routes/caseLaw";
import { registerTemplateReviewRoutes } from "./routes/templateReview";
import { registerLegislativeMonitoringRoutes } from "./routes/legislativeMonitoring";
import { registerExplainTermsRoutes } from "./routes/explainTerms";
import { registerScreeningFeedbackRoutes } from "./routes/screeningFeedback";
import { registerChatRoutes } from "./routes/chat";
import { registerDownloadsRoutes } from "./routes/downloads";
import { registerAdminBroadcastsRoutes } from "./routes/adminBroadcasts";
import { registerAdminScreeningCredentialsRoutes } from "./routes/adminScreeningCredentials";
import { registerMessagesRoutes } from "./routes/messages";
import { registerRentalPropertiesRoutes } from "./routes/rentalProperties";
import { registerRentalSubmissionsRoutes } from "./routes/rentalSubmissions";
import { registerRentalScreeningRoutes } from "./routes/rentalScreening";
import { registerDigitalDelveWebhooksRoutes } from "./routes/digitalDelveWebhooks";
import { registerApplyRoutes } from "./routes/apply";
import { registerRentalFilesRoutes } from "./routes/rentalFiles";
import { registerReuploadRoutes } from "./routes/reupload";
import { registerAdminDatabaseRoutes } from "./routes/adminDatabase";
import { registerStateNotesRoutes } from "./routes/stateNotes";
import { registerDenialDecisionRoutes } from "./routes/denialDecision";
import { registerRentSubscriptionsRoutes } from "./routes/rentSubscriptions";
import { registerDashboardRoutes } from "./routes/dashboard";
import { registerWaitlistRoutes } from "./routes/waitlist";

export async function registerRoutes(app: Express): Promise<Server> {
  // Trust proxy - required for secure cookies behind Replit's HTTPS proxy
  app.set('trust proxy', 1);

  // Cookie parser for refresh tokens
  app.use(cookieParser());

  // JWT Auth routes
  app.use('/api/auth', authRoutes);

  // Object Storage routes for public assets
  registerObjectStorageRoutes(app);

  // Compliance Matrix admin routes (state-specific legal notice forms)
  registerComplianceMatrixRoutes(app);

  // Notice form generation engine routes (matrix-driven, zero state branching)
  app.use(noticeGenerationRoutes);

  // Domain route modules - each handles a single concern. Awaited because
  // some modules use top-level dynamic imports (await import(...)).
  await registerSitemapRoute(app);
  await registerUserSettingsRoutes(app);
  await registerScreeningCredentialsRoutes(app);
  await registerSubscriptionRoutes(app);
  await registerResendWebhookRoute(app);
  await registerTemplatesRoutes(app);
  await registerPropertiesRoutes(app);
  await registerDocumentsRoutes(app);
  await registerComplianceCardsRoutes(app);
  await registerLegalUpdatesRoutes(app);
  await registerCommunicationsRoutes(app);
  await registerRentLedgerRoutes(app);
  await registerStripeConnectRoutes(app);
  await registerRentPaymentsRoutes(app);
  await registerLegalUpdatesAdminRoutes(app);
  await registerNotificationsRoutes(app);
  await registerAnalyticsRoutes(app);
  await registerAdminUsersRoutes(app);
  await registerAdminAnalyticsRoutes(app);
  await registerAdminPlatformFeesRoutes(app);
  await registerContactRoute(app);
  await registerStatesRoute(app);
  await registerBlogRoutes(app);
  await registerNotifyLegalUpdateRoute(app);
  await registerTemplateReviewQueueRoutes(app);
  await registerTemplateVersionsRoutes(app);
  await registerDocumentsGenerateRoutes(app);
  await registerLegislativeBillsRoutes(app);
  await registerCaseLawRoutes(app);
  await registerTemplateReviewRoutes(app);
  await registerLegislativeMonitoringRoutes(app);
  await registerExplainTermsRoutes(app);
  await registerScreeningFeedbackRoutes(app);
  await registerChatRoutes(app);
  await registerDownloadsRoutes(app);
  await registerAdminBroadcastsRoutes(app);
  await registerAdminScreeningCredentialsRoutes(app);
  await registerMessagesRoutes(app);
  await registerRentalPropertiesRoutes(app);
  await registerRentalSubmissionsRoutes(app);
  await registerRentalScreeningRoutes(app);
  await registerDigitalDelveWebhooksRoutes(app);
  await registerApplyRoutes(app);
  await registerRentalFilesRoutes(app);
  await registerReuploadRoutes(app);
  await registerAdminDatabaseRoutes(app);
  await registerStateNotesRoutes(app);
  await registerDenialDecisionRoutes(app);
  await registerRentSubscriptionsRoutes(app);
  await registerDashboardRoutes(app);
  await registerWaitlistRoutes(app);

  const httpServer = createServer(app);
  return httpServer;
}
