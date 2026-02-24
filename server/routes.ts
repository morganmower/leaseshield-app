import type { Express } from "express";
import { createServer, type Server } from "http";
import cookieParser from "cookie-parser";
import { storage } from "./storage";
import { isAuthenticated, requireAccess, requireAdmin, startImpersonation, stopImpersonation, getImpersonationStatus } from "./jwtAuth";
import authRoutes from "./authRoutes";
import Stripe from "stripe";
import { insertTemplateSchema, insertComplianceCardSchema, insertLegalUpdateSchema, insertBlogPostSchema, users, insertUploadedDocumentSchema, insertCommunicationTemplateSchema, insertRentLedgerEntrySchema, insertPropertySchema, insertSavedDocumentSchema, screeningFeedback, insertScreeningFeedbackSchema } from "@shared/schema";
import { z } from "zod";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";
import { emailService } from "./emailService";
import OpenAI from "openai";
import { getUncachableResendClient } from "./resend";
import { generateLegalUpdateEmail } from "./email-templates";
import { notifyUsersOfTemplateUpdate } from "./templateNotifications";
import { asyncHandler, RateLimiter } from "./utils/validation";
import { sendBinaryDownload, assertLooksLikeDocx, assertLooksLikePdf, assertValidDocx, CONTENT_TYPES } from "./utils/download";
import { getActiveStateIds } from "./states/getActiveStates";
import multer from "multer";
import path from "path";
import { randomUUID } from "crypto";
import fs from "fs/promises";
import { execSync } from "child_process";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { registerComplianceMatrixRoutes } from "./routes/complianceMatrix";
import noticeGenerationRoutes from "./routes/noticeGeneration";
import { getStateAdverseActionHtml } from "./states/adverseActionDisclosures";
import { uploadApplicantBuffer, downloadApplicantStream, isObjstorePath, deleteApplicantObject } from "./applicantObjectStorage";
import { rentalSubmissionFiles } from "@shared/schema";
import fsSync from "fs";

// Stripe configuration - use STRIPE_SECRET_KEY for both test and live
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-10-29.clover",
});

// Initialize OpenAI for chat assistant
const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

// Rate limiter for chat endpoint
const chatRateLimiter = new RateLimiter(10, 60 * 1000); // 10 messages per minute

// Configure multer for secure file uploads
const uploadStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = 'uploads';
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error as Error, uploadDir);
    }
  },
  filename: (req, file, cb) => {
    // Use UUID for collision-resistant filenames
    const uniqueId = randomUUID();
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueId}${ext}`);
  }
});

const upload = multer({
  storage: uploadStorage,
  limits: { 
    fileSize: 20 * 1024 * 1024 // 20MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Allowed MIME types for PDF and DOCX
    const allowedMimeTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/msword', // .doc
    ];
    
    // Allowed file extensions
    const allowedExtensions = /\.(pdf|docx|doc)$/i;
    
    const ext = path.extname(file.originalname).toLowerCase();
    const mimeTypeValid = allowedMimeTypes.includes(file.mimetype);
    const extensionValid = allowedExtensions.test(ext);
    
    if (mimeTypeValid && extensionValid) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOC, and DOCX files are allowed'));
    }
  }
});

const applicantUpload = multer({
  storage: multer.memoryStorage(),
  limits: { 
    fileSize: 10 * 1024 * 1024 // 10MB max file size
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
    ];
    const allowedExtensions = /\.(pdf|jpg|jpeg|png)$/i;
    
    const ext = path.extname(file.originalname).toLowerCase();
    const mimeTypeValid = allowedMimeTypes.includes(file.mimetype);
    const extensionValid = allowedExtensions.test(ext);
    
    if (mimeTypeValid && extensionValid) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, JPG, and PNG files are allowed'));
    }
  }
});

// Helper to get user ID from request with validation
function getUserId(req: any): string {
  const userId = req.user?.id || req.userId;
  if (!userId) {
    throw new Error('User ID not found in request');
  }
  return userId;
}

// Helper to get client IP address
function getClientIp(req: any): string {
  return req.ip || req.connection.remoteAddress || 'unknown';
}

// Helper to auto-update submission status based on screening progress
async function updateSubmissionStatusFromScreening(submissionId: string): Promise<void> {
  try {
    const submission = await storage.getRentalSubmission(submissionId);
    if (!submission) return;
    
    // Don't modify status if there's already a final decision
    const decision = await storage.getRentalDecision(submissionId);
    if (decision) return;
    
    const screeningOrders = await storage.getRentalScreeningOrdersBySubmission(submissionId);
    
    if (screeningOrders.length === 0) {
      // No screening orders yet - don't change status
      return;
    }
    
    // Normalize order statuses (handle vendor variants like "completed" vs "complete")
    const normalizeStatus = (status: string): string => {
      const s = status.toLowerCase().trim();
      if (s === 'completed' || s === 'complete') return 'complete';
      if (s === 'in_progress' || s === 'in progress' || s === 'inprogress' || s === 'processing') return 'in_progress';
      if (s === 'sent' || s === 'pending') return 'sent';
      return s;
    };
    
    // Count normalized order statuses
    const normalizedStatuses = screeningOrders.map(o => normalizeStatus(o.status));
    const completeCount = normalizedStatuses.filter(s => s === 'complete').length;
    const inProgressCount = normalizedStatuses.filter(s => s === 'in_progress').length;
    const errorCount = normalizedStatuses.filter(s => s === 'error').length;
    
    let newStatus: string | null = null;
    
    // All screening orders are complete (based solely on orders, not people)
    if (completeCount > 0 && completeCount === screeningOrders.length) {
      newStatus = 'complete';
    }
    // Any screening is in progress
    else if (inProgressCount > 0) {
      newStatus = 'in_progress';
    }
    // At least one screening exists and not all are errors
    else if (screeningOrders.length > errorCount) {
      newStatus = 'screening_requested';
    }
    
    // Update status if changed and not going backwards
    const statusOrder = ['started', 'submitted', 'screening_requested', 'in_progress', 'complete'];
    if (newStatus && statusOrder.indexOf(newStatus) > statusOrder.indexOf(submission.status)) {
      await storage.updateRentalSubmission(submissionId, { status: newStatus });
      console.log(`[Auto-Status] Updated submission ${submissionId} status to ${newStatus}`);
    }
  } catch (error) {
    console.error("Error updating submission status from screening:", error);
  }
}

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

  // User preferences - with strict input validation
  const userPreferencesSchema = z.object({
    preferredState: z.string().length(2).regex(/^[A-Z]{2}$/).optional(),
    // Notification preferences
    notifyLegalUpdates: z.boolean().optional(),
    notifyTemplateRevisions: z.boolean().optional(),
    notifyBillingAlerts: z.boolean().optional(),
    notifyTips: z.boolean().optional(),
    // Profile info
    businessName: z.string().max(100).optional().nullable(),
    phoneNumber: z.string().max(20).optional().nullable(),
  });
  
  app.patch('/api/user/settings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      
      // Validate input to prevent malicious data
      const validatedData = userPreferencesSchema.parse(req.body);
      
      // Only allow supported states - dynamically fetched from database
      if (validatedData.preferredState) {
        try {
          const supportedStates = await getActiveStateIds();
          if (!supportedStates.includes(validatedData.preferredState)) {
            return res.status(400).json({ message: "Invalid state selection" });
          }
        } catch (error) {
          console.error("Error fetching active states:", error);
          return res.status(500).json({ message: "Unable to validate state selection" });
        }
      }
      
      const user = await storage.updateUserPreferences(userId, validatedData);
      res.json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input data", errors: error.errors });
      }
      console.error("Error updating user preferences:", error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  // SECURITY: /api/user/make-admin endpoint removed (critical vulnerability)
  // To make a user admin in development, update the database directly:
  // UPDATE users SET "isAdmin" = true WHERE id = '<user-id>';

  // ============================================
  // Landlord Screening Credentials API
  // ============================================
  
  // Import crypto helper for credentials
  const { encryptCredentials, decryptCredentials } = await import("./crypto");
  const { verifyCredentialsWithParams, retrieveInvitations } = await import("./digitalDelveService");
  
  // Schema for credential input (landlord only sets username/password, admin sets invitation ID)
  const screeningCredentialsSchema = z.object({
    username: z.string().min(1).max(100),
    password: z.string().min(1).max(100),
  });
  
  // Test credentials with Western Verify (no save)
  app.post('/api/screening-credentials/test', isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = screeningCredentialsSchema.parse(req.body);
      
      // Test authentication with Western Verify
      const result = await verifyCredentialsWithParams(validatedData.username, validatedData.password);
      
      if (result.success) {
        // Also fetch invitations to return them
        const invitationsResult = await retrieveInvitations({ 
          username: validatedData.username, 
          password: validatedData.password 
        });
        
        res.json({
          success: true,
          message: "Credentials verified successfully",
          invitations: invitationsResult.success ? invitationsResult.invitations : [],
        });
      } else {
        res.json({
          success: false,
          message: result.error || "Invalid credentials",
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: "Invalid input data" });
      }
      console.error("Error testing screening credentials:", error);
      res.status(500).json({ success: false, message: "Something went wrong. Please try again." });
    }
  });
  
  // Save credentials (encrypted)
  app.post('/api/screening-credentials', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const validatedData = screeningCredentialsSchema.parse(req.body);
      
      // Test credentials first
      const testResult = await verifyCredentialsWithParams(validatedData.username, validatedData.password);
      
      if (!testResult.success) {
        return res.status(400).json({
          success: false,
          message: testResult.error || "Invalid credentials - please verify your Western Verify login details",
        });
      }
      
      // Encrypt credentials
      const encrypted = encryptCredentials(validatedData.username, validatedData.password);
      
      // Check if credentials already exist for this user
      const existing = await storage.getLandlordScreeningCredentials(userId);
      
      if (existing) {
        // Update existing credentials (preserve admin-set invitation ID)
        const updated = await storage.updateLandlordScreeningCredentials(userId, {
          encryptedUsername: encrypted.encryptedUsername,
          encryptedPassword: encrypted.encryptedPassword,
          encryptionIv: encrypted.encryptionIv,
          status: 'verified',
          lastVerifiedAt: new Date(),
          lastErrorMessage: null,
        });
        
        res.json({
          success: true,
          message: "Screening credentials updated successfully",
          status: updated?.status,
        });
      } else {
        // Create new credentials (admin will set invitation ID separately)
        await storage.createLandlordScreeningCredentials({
          userId,
          encryptedUsername: encrypted.encryptedUsername,
          encryptedPassword: encrypted.encryptedPassword,
          encryptionIv: encrypted.encryptionIv,
          status: 'verified',
          lastVerifiedAt: new Date(),
        });
        
        // Notify admin that a landlord is waiting for invitation ID setup
        try {
          const landlord = await storage.getUser(userId);
          const allUsers = await storage.getAllUsers();
          const adminEmails = allUsers.filter(u => u.isAdmin && u.email).map(u => u.email!);
          
          if (landlord && adminEmails.length > 0) {
            await emailService.sendScreeningCredentialsSetupNotification(landlord, adminEmails);
            console.log(`📧 Admin notification sent for landlord ${landlord.email} credentials setup`);
          }
        } catch (notifyError) {
          console.error('Failed to send admin notification:', notifyError);
          // Don't fail the credential save if notification fails
        }
        
        res.json({
          success: true,
          message: "Screening credentials saved successfully. An administrator will complete your setup shortly.",
          status: 'verified',
          pendingAdminSetup: true,
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: "Invalid input data" });
      }
      console.error("Error saving screening credentials:", error);
      res.status(500).json({ success: false, message: "Something went wrong. Please try again." });
    }
  });
  
  // Get credential status (never returns actual credentials)
  app.get('/api/screening-credentials', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const credentials = await storage.getLandlordScreeningCredentials(userId);
      
      if (!credentials) {
        return res.json({
          configured: false,
          status: 'not_configured',
          integrationReady: false,
        });
      }
      
      // Integration is ready when credentials are verified AND invitation ID is set
      const integrationReady = credentials.status === 'verified' && !!credentials.defaultInvitationId;
      const pendingAdminSetup = credentials.status === 'verified' && !credentials.defaultInvitationId;
      
      res.json({
        configured: true,
        status: credentials.status,
        lastVerifiedAt: credentials.lastVerifiedAt,
        lastErrorMessage: credentials.lastErrorMessage,
        hasDefaultInvitation: !!credentials.defaultInvitationId,
        integrationReady,
        pendingAdminSetup,
      });
    } catch (error) {
      console.error("Error getting screening credentials:", error);
      res.status(500).json({ success: false, message: "Something went wrong. Please try again." });
    }
  });
  
  // Delete credentials
  app.delete('/api/screening-credentials', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const deleted = await storage.deleteLandlordScreeningCredentials(userId);
      
      res.json({
        success: deleted,
        message: deleted ? "Screening credentials removed" : "No credentials found",
      });
    } catch (error) {
      console.error("Error deleting screening credentials:", error);
      res.status(500).json({ success: false, message: "Something went wrong. Please try again." });
    }
  });
  
  // Get invitations for current credentials
  app.get('/api/screening-credentials/invitations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const credentials = await storage.getLandlordScreeningCredentials(userId);
      
      if (!credentials) {
        return res.status(400).json({
          success: false,
          message: "No screening credentials configured",
        });
      }
      
      // Decrypt credentials
      const decrypted = decryptCredentials({
        encryptedUsername: credentials.encryptedUsername,
        encryptedPassword: credentials.encryptedPassword,
        encryptionIv: credentials.encryptionIv,
      });
      
      const result = await retrieveInvitations({ 
        username: decrypted.username, 
        password: decrypted.password 
      });
      
      if (result.success) {
        res.json({
          success: true,
          invitations: result.invitations,
          defaultInvitationId: credentials.defaultInvitationId,
        });
      } else {
        res.json({
          success: false,
          message: result.error || "Failed to retrieve invitations",
        });
      }
    } catch (error) {
      console.error("Error getting screening invitations:", error);
      res.status(500).json({ success: false, message: "Something went wrong. Please try again." });
    }
  });

  // AI Training Interest - track users who want to be notified about workshops
  app.post('/api/training-interest', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Check if user already registered interest
      const existingInterest = await storage.getTrainingInterest(userId);
      if (existingInterest) {
        return res.json({ message: "Already registered", interest: existingInterest });
      }
      
      // Save the interest with user's email for easy export
      const interest = await storage.createTrainingInterest({
        userId,
        email: user.email || undefined,
      });
      
      res.json({ message: "Successfully registered for notifications", interest });
    } catch (error) {
      console.error("Error saving training interest:", error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  // Check if user has registered training interest
  app.get('/api/training-interest', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const interest = await storage.getTrainingInterest(userId);
      res.json({ registered: !!interest, interest });
    } catch (error) {
      console.error("Error checking training interest:", error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  // Stripe subscription routes
  
  // Step 1: Create SetupIntent to collect payment method (no invoice created)
  app.post('/api/create-setup-intent', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);

      if (!user) return res.status(404).json({ message: "User not found" });
      if (!user.email) return res.status(400).json({ message: 'No user email' });

      // Check if user already has an active subscription
      if (user.subscriptionStatus === 'active') {
        return res.status(400).json({ message: "You already have an active subscription" });
      }

      // Reuse existing Stripe customer or create new one
      let customerId: string | null = user.stripeCustomerId;
      
      // Verify customer exists in current Stripe environment
      if (customerId) {
        try {
          await stripe.customers.retrieve(customerId);
        } catch (error: any) {
          if (error.message?.includes('No such customer')) {
            console.log(`[create-setup-intent] Customer ${customerId} not found, creating new one`);
            customerId = null;
          } else {
            throw error;
          }
        }
      }
      
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : undefined,
          metadata: { userId },
        });
        customerId = customer.id;
        await storage.updateUserStripeInfo(userId, { stripeCustomerId: customerId });
      }

      // Create SetupIntent - this does NOT create an invoice
      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
        metadata: {
          userId: userId,
        },
      });

      console.log(`[create-setup-intent] ✅ SetupIntent ${setupIntent.id} created for customer ${customerId}`);

      return res.json({
        clientSecret: setupIntent.client_secret,
        customerId: customerId,
      });
    } catch (error: any) {
      console.error('❌ /api/create-setup-intent error:', error.message);
      return res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  // Step 2: Create subscription after payment method is confirmed (invoice created and paid immediately)
  app.post('/api/complete-subscription', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);
      const { paymentMethodId, billingPeriod } = req.body;

      if (!user) return res.status(404).json({ message: "User not found" });
      if (!user.stripeCustomerId) return res.status(400).json({ message: "No Stripe customer found" });
      if (!paymentMethodId) return res.status(400).json({ message: "Payment method required" });

      // Check if user already has an active subscription
      if (user.subscriptionStatus === 'active') {
        return res.status(400).json({ message: "You already have an active subscription" });
      }

      // Get the appropriate price ID based on billing period
      const stripePriceId = billingPeriod === 'yearly' 
        ? process.env.STRIPE_PRICE_ID_YEARLY 
        : process.env.STRIPE_PRICE_ID;
      
      if (!stripePriceId) {
        return res.status(500).json({ message: `STRIPE_PRICE_ID${billingPeriod === 'yearly' ? '_YEARLY' : ''} not configured` });
      }

      // Set payment method as default for invoices
      // Note: SetupIntent with customer already attaches the payment method,
      // so we just need to set it as the default - no need to attach again
      await stripe.customers.update(user.stripeCustomerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });

      // Clean up any stale incomplete subscriptions first
      try {
        const existingSubscriptions = await stripe.subscriptions.list({
          customer: user.stripeCustomerId,
          status: 'all',
        });
        
        for (const sub of existingSubscriptions.data) {
          if (sub.status === 'incomplete' || sub.status === 'incomplete_expired') {
            console.log(`[complete-subscription] Canceling stale subscription ${sub.id}`);
            await stripe.subscriptions.cancel(sub.id);
          }
        }
      } catch (err: any) {
        console.log(`[complete-subscription] Error cleaning up old subscriptions: ${err.message}`);
      }

      // Create subscription - payment method is already attached, so invoice is paid immediately
      const subscription = await stripe.subscriptions.create({
        customer: user.stripeCustomerId,
        items: [{ price: stripePriceId }],
        default_payment_method: paymentMethodId,
        payment_settings: { 
          save_default_payment_method: 'on_subscription',
        },
        metadata: {
          userId: userId,
          billingPeriod: billingPeriod || 'monthly',
        },
        expand: ['latest_invoice'],
      });

      // Determine billing interval from the subscription
      const billingInterval = subscription.items.data[0]?.price?.recurring?.interval === 'year' ? 'yearly' : 'monthly';
      
      // Get subscription end date
      const periodEnd = (subscription as any).current_period_end as number | undefined;
      const subscriptionEndsAt = periodEnd ? new Date(periodEnd * 1000) : undefined;

      // Update user's subscription status
      await storage.updateUserStripeInfo(userId, {
        stripeSubscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
        billingInterval,
        subscriptionEndsAt,
        paymentFailedAt: null,
      });

      console.log(`[complete-subscription] ✅ Subscription ${subscription.id} created with status ${subscription.status}`);

      return res.json({
        success: true,
        subscriptionId: subscription.id,
        status: subscription.status,
        subscriptionEndsAt,
      });
    } catch (error: any) {
      console.error('❌ /api/complete-subscription error:', error.message);
      
      // Handle specific Stripe errors
      if (error.type === 'StripeCardError') {
        return res.status(400).json({ message: error.message });
      }
      
      return res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  // DEPRECATED: Legacy endpoint - creates invoice before payment
  // Use /api/create-setup-intent + /api/complete-subscription instead
  app.post('/api/create-subscription', isAuthenticated, async (req: any, res) => {
    console.warn('[DEPRECATED] /api/create-subscription called - use SetupIntent flow instead');
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);
      const { billingPeriod } = req.body; // 'monthly' or 'yearly'

      if (!user) return res.status(404).json({ message: "User not found" });
      if (!user.email) return res.status(400).json({ message: 'No user email' });

      // Check if user already has an active subscription
      if (user.subscriptionStatus === 'active') {
        return res.status(400).json({ message: "You already have an active subscription" });
      }

      // SAFEGUARD: Cancel any existing incomplete/past_due subscriptions to prevent invoice clutter
      if (user.stripeCustomerId) {
        try {
          const existingSubscriptions = await stripe.subscriptions.list({
            customer: user.stripeCustomerId,
            status: 'all',
          });
          
          for (const sub of existingSubscriptions.data) {
            // Only cancel truly abandoned checkouts - NOT past_due (which are legitimate subscriptions retrying payment)
            if (sub.status === 'incomplete' || sub.status === 'incomplete_expired') {
              console.log(`[create-subscription] Canceling stale subscription ${sub.id} (status: ${sub.status})`);
              await stripe.subscriptions.cancel(sub.id);
              
              // Also void the associated invoice if it's still open
              if (sub.latest_invoice) {
                const invoiceId = typeof sub.latest_invoice === 'string' ? sub.latest_invoice : sub.latest_invoice.id;
                try {
                  const invoice = await stripe.invoices.retrieve(invoiceId);
                  if (invoice.status === 'open' || invoice.status === 'draft') {
                    await stripe.invoices.voidInvoice(invoiceId);
                    console.log(`[create-subscription] Voided invoice ${invoiceId}`);
                  }
                } catch (invoiceErr: any) {
                  console.log(`[create-subscription] Could not void invoice ${invoiceId}: ${invoiceErr.message}`);
                }
              }
            }
          }
        } catch (err: any) {
          console.log(`[create-subscription] Error cleaning up old subscriptions: ${err.message}`);
          // Continue anyway - we'll create a new subscription
        }
      }

      // Get the appropriate price ID based on billing period
      const stripePriceId = billingPeriod === 'yearly' 
        ? process.env.STRIPE_PRICE_ID_YEARLY 
        : process.env.STRIPE_PRICE_ID;
      
      console.error(`[create-subscription] billingPeriod: "${billingPeriod}", stripePriceId from env: "${stripePriceId}" (length: ${stripePriceId?.length})`);
      if (!stripePriceId) {
        return res.status(500).json({ message: `STRIPE_PRICE_ID${billingPeriod === 'yearly' ? '_YEARLY' : ''} not configured` });
      }

      // Reuse existing Stripe customer or create new one
      let customerId: string | null = user.stripeCustomerId;
      
      // Verify customer exists in current Stripe environment
      if (customerId) {
        try {
          await stripe.customers.retrieve(customerId);
        } catch (error: any) {
          if (error.message?.includes('No such customer')) {
            console.error(`[create-subscription] Customer ${customerId} not found, creating new one`);
            customerId = null;
          } else {
            throw error;
          }
        }
      }
      
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : undefined,
          metadata: { userId },
        });
        customerId = customer.id;
        await storage.updateUserStripeInfo(userId, { stripeCustomerId: customerId });
      }

      // Create subscription with payment_behavior: 'default_incomplete' and expand the invoice
      // This creates a subscription with an incomplete invoice that we can pay
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: stripePriceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: { 
          save_default_payment_method: 'on_subscription',
          payment_method_types: ['card'], // Only allow card payments
        },
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          userId: userId,
          billingPeriod: billingPeriod || 'monthly',
        },
      });

      await storage.updateUserStripeInfo(userId, {
        stripeSubscriptionId: subscription.id,
        subscriptionStatus: 'incomplete',
      });

      // Get the client secret from the subscription's invoice payment intent
      let invoice = subscription.latest_invoice as Stripe.Invoice & { payment_intent?: Stripe.PaymentIntent | string };
      
      // If payment_intent is not expanded, fetch the invoice explicitly
      if (!invoice?.payment_intent || typeof invoice.payment_intent === 'string') {
        const invoiceId = typeof invoice === 'string' ? invoice : invoice?.id;
        if (invoiceId) {
          invoice = await stripe.invoices.retrieve(invoiceId, {
            expand: ['payment_intent'],
          }) as Stripe.Invoice & { payment_intent?: Stripe.PaymentIntent };
          
          // If still no payment_intent, try to finalize the invoice to create one
          if (!invoice.payment_intent && invoice.status === 'draft') {
            invoice = await stripe.invoices.finalizeInvoice(invoiceId, {
              expand: ['payment_intent'],
            }) as Stripe.Invoice & { payment_intent?: Stripe.PaymentIntent };
          }
          
          // If still no payment_intent on open invoice, create PaymentIntent manually
          if (!invoice.payment_intent && invoice.status === 'open') {
            console.log(`[create-subscription] Creating PaymentIntent manually for invoice ${invoice.id}`);
            const paymentIntentData = await stripe.paymentIntents.create({
              amount: invoice.amount_due,
              currency: invoice.currency,
              customer: customerId,
              metadata: {
                invoice_id: invoice.id,
                subscription_id: subscription.id,
                userId: userId,
              },
              setup_future_usage: 'off_session',
            });
            return res.json({
              subscriptionId: subscription.id,
              clientSecret: paymentIntentData.client_secret,
              paymentIntentId: paymentIntentData.id,
            });
          }
        }
      }
      
      const paymentIntent = invoice?.payment_intent as Stripe.PaymentIntent;
      
      if (!paymentIntent?.client_secret) {
        console.error(`[create-subscription] ❌ No client_secret - invoice status: ${invoice?.status}, total: ${invoice?.total}`);
        throw new Error('Failed to create payment intent for subscription');
      }

      console.log(`[create-subscription] ✅ Subscription ${subscription.id} created`);

      // Return subscription and payment intent details
      return res.json({
        subscriptionId: subscription.id,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      });
    } catch (error: any) {
      console.error('❌ /api/create-subscription error:', error.message);
      return res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  // Confirm payment and activate subscription (backup to webhook)
  app.post('/api/confirm-payment', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      if (!user.stripeSubscriptionId) {
        return res.status(400).json({ message: "No subscription found" });
      }
      
      console.log(`[confirm-payment] Checking subscription ${user.stripeSubscriptionId} for user ${userId}`);
      
      // Retrieve the actual subscription from Stripe to get authoritative status
      const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId) as Stripe.Subscription;
      
      console.log(`[confirm-payment] Stripe subscription status: ${subscription.status}`);
      
      if (subscription.status === 'active' || subscription.status === 'trialing') {
        // Subscription is active - sync status from Stripe
        const billingInterval = subscription.items.data[0]?.plan?.interval || 'month';
        const periodEnd = (subscription as any).current_period_end;
        const subscriptionEndsAt = periodEnd 
          ? new Date(periodEnd * 1000)
          : undefined;
        
        await storage.updateUserStripeInfo(userId, {
          subscriptionStatus: subscription.status,
          billingInterval,
          subscriptionEndsAt,
          paymentFailedAt: null,
        });
        
        console.log(`[confirm-payment] ✅ User ${userId} subscription synced: status=${subscription.status}, ends=${subscriptionEndsAt?.toISOString()}`);
        
        res.json({ success: true, subscriptionEndsAt, status: subscription.status });
      } else if (subscription.status === 'incomplete') {
        // Still waiting for payment to complete
        console.log(`[confirm-payment] Subscription still incomplete, payment may be processing`);
        res.status(202).json({ message: "Payment is still processing", status: subscription.status });
      } else {
        console.log(`[confirm-payment] Unexpected subscription status: ${subscription.status}`);
        res.status(400).json({ message: "Subscription is not active", status: subscription.status });
      }
    } catch (error: any) {
      console.error('❌ /api/confirm-payment error:', error.message);
      return res.status(500).json({ message: "Failed to confirm payment" });
    }
  });

  // Sync subscription status from Stripe (finds any active subscription for customer)
  app.post('/api/sync-subscription', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!user.stripeCustomerId) {
        return res.status(400).json({ message: "No Stripe customer found" });
      }

      // List all subscriptions for this customer
      const subscriptions = await stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        status: 'all',
        limit: 10,
      });

      console.log(`[sync-subscription] Found ${subscriptions.data.length} subscriptions for customer ${user.stripeCustomerId}`);

      // Find an active or trialing subscription
      const activeSub = subscriptions.data.find(
        sub => sub.status === 'active' || sub.status === 'trialing'
      );

      if (activeSub) {
        const billingInterval = activeSub.items.data[0]?.plan?.interval || 'month';
        const periodEnd = (activeSub as any).current_period_end;
        const subscriptionEndsAt = periodEnd ? new Date(periodEnd * 1000) : undefined;

        await storage.updateUserStripeInfo(userId, {
          stripeSubscriptionId: activeSub.id,
          subscriptionStatus: activeSub.status,
          billingInterval,
          subscriptionEndsAt,
          paymentFailedAt: undefined,
        });

        console.log(`[sync-subscription] ✅ Synced active subscription ${activeSub.id} for user ${userId}`);
        return res.json({
          message: "Subscription synced",
          status: activeSub.status,
          subscriptionId: activeSub.id,
          endsAt: subscriptionEndsAt,
        });
      }

      // No active subscription found - check if there's a past_due one
      const pastDueSub = subscriptions.data.find(sub => sub.status === 'past_due');
      if (pastDueSub) {
        await storage.updateUserStripeInfo(userId, {
          stripeSubscriptionId: pastDueSub.id,
          subscriptionStatus: 'past_due',
        });
        console.log(`[sync-subscription] Found past_due subscription ${pastDueSub.id}`);
        return res.json({ message: "Found past due subscription", status: 'past_due' });
      }

      // No subscription found - reset to trial
      await storage.updateUserStripeInfo(userId, {
        stripeSubscriptionId: undefined,
        subscriptionStatus: 'trialing',
      });

      console.log(`[sync-subscription] No active subscription found, reset to trialing`);
      return res.json({ message: "No active subscription found", status: 'trialing' });
    } catch (error: any) {
      console.error("Error syncing subscription:", error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  // Cancel subscription
  app.post('/api/cancel-subscription', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!user.stripeSubscriptionId) {
        return res.status(400).json({ message: "No active subscription found" });
      }

      // Cancel the subscription at period end (so user keeps access until billing cycle ends)
      const subscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });

      // Update user status
      await storage.updateUserStripeInfo(userId, {
        subscriptionStatus: 'cancel_at_period_end',
      });

      console.log(`✓ Subscription ${subscription.id} will cancel at period end for user ${userId}`);

      res.json({
        message: 'Subscription will be cancelled at the end of your billing period',
        cancelAt: subscription.cancel_at,
      });
    } catch (error: any) {
      console.error("Error cancelling subscription:", error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  // Cancel incomplete subscription immediately (for failed payment attempts)
  app.post('/api/cancel-incomplete-subscription', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!user.stripeSubscriptionId) {
        return res.status(400).json({ message: "No subscription found" });
      }

      // Get current subscription status from Stripe
      const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
      
      if (subscription.status !== 'incomplete' && subscription.status !== 'incomplete_expired') {
        return res.status(400).json({ message: "Subscription is not incomplete" });
      }

      // Cancel immediately (not at period end)
      await stripe.subscriptions.cancel(user.stripeSubscriptionId);

      // Clear user subscription info
      await storage.updateUserStripeInfo(userId, {
        stripeSubscriptionId: undefined,
        subscriptionStatus: 'trialing', // Reset to trial status
      });

      console.log(`✓ Incomplete subscription ${user.stripeSubscriptionId} cancelled for user ${userId}`);

      res.json({ message: 'Incomplete subscription cancelled successfully' });
    } catch (error: any) {
      console.error("Error cancelling incomplete subscription:", error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  // Create Stripe Customer Portal session for payment method management
  app.post('/api/create-portal-session', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!user.stripeCustomerId) {
        return res.status(400).json({ message: "No Stripe customer found" });
      }

      // Create portal session
      const domain = process.env.REPLIT_DOMAINS?.split(',')[0];
      const returnUrl = domain 
        ? `https://${domain}/dashboard`
        : 'http://localhost:5000/dashboard';
      
      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: returnUrl,
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Error creating portal session:", error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  // Stripe webhook handler for subscription lifecycle events
  app.post('/api/stripe-webhook', async (req: any, res) => {
    const sig = req.headers['stripe-signature'];

    if (!sig) {
      console.error('Stripe webhook: Missing stripe-signature header');
      return res.status(400).send('Missing stripe-signature header');
    }

    let event: Stripe.Event;

    try {
      // Verify webhook signature using raw body
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      
      if (!webhookSecret) {
        console.error('⚠️  STRIPE_WEBHOOK_SECRET not set - webhook verification will fail in production');
        return res.status(500).send('Webhook secret not configured');
      }
      
      // req.body is raw Buffer when using express.raw() middleware
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        webhookSecret
      );
      
      console.log(`✓ Webhook verified: ${event.type}`);
    } catch (err: any) {
      console.error('❌ Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    try {
      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated': {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = subscription.customer as string;
          
          // Find user by Stripe customer ID
          const userResults = await db.select().from(users).where(eq(users.stripeCustomerId, customerId)).limit(1);
          if (userResults.length > 0) {
            // Check if subscription is set to cancel at period end
            const status = subscription.cancel_at_period_end 
              ? 'cancel_at_period_end' 
              : subscription.status;
            
            // Get billing interval and period end from subscription
            const billingInterval = subscription.items.data[0]?.plan?.interval || 'month';
            const periodEnd = (subscription as any).current_period_end;
            const currentPeriodEnd = periodEnd 
              ? new Date(periodEnd * 1000)
              : undefined;
            
            await storage.updateUserStripeInfo(userResults[0].id, {
              subscriptionStatus: status,
              billingInterval,
              currentPeriodEnd,
              // Only set subscriptionEndsAt if subscription is ending
              subscriptionEndsAt: subscription.cancel_at_period_end ? currentPeriodEnd : undefined,
              // Clear payment failed timestamp if subscription is now active
              paymentFailedAt: status === 'active' ? null : undefined,
            });
            console.log(`Updated user ${userResults[0].id} subscription: status=${status}, interval=${billingInterval}, nextRenewal=${currentPeriodEnd?.toISOString()}`);
          }
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = subscription.customer as string;
          
          const userResults = await db.select().from(users).where(eq(users.stripeCustomerId, customerId)).limit(1);
          if (userResults.length > 0) {
            await storage.updateUserStripeInfo(userResults[0].id, {
              subscriptionStatus: 'canceled',
            });
            console.log(`Updated user ${userResults[0].id} subscription status to canceled`);
          }
          break;
        }

        case 'invoice.payment_succeeded': {
          const invoice = event.data.object as Stripe.Invoice;
          const customerId = invoice.customer as string;
          
          const userResults = await db.select().from(users).where(eq(users.stripeCustomerId, customerId)).limit(1);
          if (userResults.length > 0) {
            const user = userResults[0];
            // Payment successful - update to active and clear any payment failure state
            // Set subscribedAt on first successful payment (when subscription officially starts)
            const updateData: any = {
              subscriptionStatus: 'active',
              paymentFailedAt: null, // Clear payment failed timestamp on successful payment
            };
            
            // Only set subscribedAt if not already set (first payment = official join date)
            if (!user.subscribedAt) {
              updateData.subscribedAt = new Date();
              console.log(`🎉 User ${user.id} first payment succeeded - setting subscribedAt (official subscription start)`);
            }
            
            await storage.updateUserStripeInfo(user.id, updateData);
            console.log(`User ${user.id} payment succeeded - marked as active, cleared payment failed state`);
            
            // Send admin notification email about the payment
            const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || 'mmower21@gmail.com';
            try {
              const { emailService } = await import('./emailService');
              const amountPaid = invoice.amount_paid || invoice.total || 0;
              
              // Determine plan type from amount or billing interval
              let planType = 'Subscription';
              const billingInterval = (invoice.lines?.data?.[0] as any)?.plan?.interval;
              if (billingInterval === 'year' || amountPaid >= 9900) {
                planType = 'Annual ($100/year)';
              } else if (billingInterval === 'month' || amountPaid >= 900) {
                planType = 'Monthly ($10/month)';
              }
              
              const customerName = user.firstName && user.lastName 
                ? `${user.firstName} ${user.lastName}` 
                : user.firstName || undefined;
              
              await emailService.sendAdminPaymentNotification(
                adminEmail,
                user.email || 'unknown',
                amountPaid,
                planType,
                customerName
              );
              console.log(`💰 Admin payment notification sent to ${adminEmail} for ${user.email}`);
            } catch (emailError) {
              console.error('Failed to send admin payment notification:', emailError);
            }
          }
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object as Stripe.Invoice;
          const customerId = invoice.customer as string;
          
          const userResults = await db.select().from(users).where(eq(users.stripeCustomerId, customerId)).limit(1);
          if (userResults.length > 0) {
            const user = userResults[0];
            await storage.updateUserStripeInfo(user.id, {
              subscriptionStatus: 'past_due',
              paymentFailedAt: new Date(),
            });
            console.log(`User ${user.id} payment failed - marked as past_due`);
            
            // Send payment failed email notification
            if (user.email && user.notifyBillingAlerts) {
              try {
                const { emailService } = await import('./emailService');
                await emailService.sendPaymentFailedEmail(
                  { email: user.email, firstName: user.firstName || undefined },
                );
                console.log(`Payment failed email sent to ${user.email}`);
              } catch (emailError) {
                console.error('Failed to send payment failed email:', emailError);
              }
            }
          }
          break;
        }

        case 'payment_intent.succeeded': {
          const paymentIntent = event.data.object as Stripe.PaymentIntent & { invoice?: string };
          const invoiceId = paymentIntent.invoice;
          
          console.log(`💰 Payment intent succeeded: ${paymentIntent.id}, invoiceId: ${invoiceId}`);
          
          // For subscription payments, the invoice will tell us which subscription
          if (invoiceId) {
            try {
              const invoice = await stripe.invoices.retrieve(invoiceId) as Stripe.Invoice & { subscription?: string };
              const subscriptionId = invoice.subscription;
              
              if (subscriptionId) {
                // Retrieve the subscription to get actual status and period end
                const subscription = await stripe.subscriptions.retrieve(subscriptionId) as Stripe.Subscription;
                const customerId = subscription.customer as string;
                
                const userResults = await db.select().from(users).where(eq(users.stripeCustomerId, customerId)).limit(1);
                if (userResults.length > 0) {
                  const billingInterval = subscription.items.data[0]?.plan?.interval || 'month';
                  const periodEnd = (subscription as any).current_period_end;
                  const subscriptionEndsAt = periodEnd 
                    ? new Date(periodEnd * 1000)
                    : undefined;
                  
                  await storage.updateUserStripeInfo(userResults[0].id, {
                    subscriptionStatus: subscription.status,
                    billingInterval,
                    subscriptionEndsAt,
                    paymentFailedAt: null,
                  });
                  
                  console.log(`✅ User ${userResults[0].id} subscription activated via payment_intent.succeeded: status=${subscription.status}`);
                }
              }
            } catch (err: any) {
              console.error(`Failed to process payment_intent.succeeded for invoice ${invoiceId}:`, err.message);
            }
          }
          break;
        }

        default:
          console.log(`Unhandled event type ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      console.error('Error processing webhook:', error);
      res.status(500).send('Webhook processing failed');
    }
  });

  // Resend webhook handler for email engagement tracking
  app.post('/api/resend-webhook', async (req: any, res) => {
    try {
      const event = req.body;
      
      if (!event || !event.type) {
        return res.status(400).json({ message: 'Invalid webhook payload' });
      }

      console.log(`📧 Resend webhook: ${event.type}`);

      const data = event.data;
      
      switch (event.type) {
        case 'email.delivered': {
          if (data?.email_id) {
            await storage.updateEmailEventStatus(data.email_id, 'delivered', new Date());
            console.log(`  ✓ Email ${data.email_id} marked as delivered`);
          }
          break;
        }

        case 'email.opened': {
          if (data?.email_id) {
            await storage.updateEmailEventStatus(data.email_id, 'opened', new Date());
            console.log(`  ✓ Email ${data.email_id} marked as opened`);
          }
          break;
        }

        case 'email.clicked': {
          if (data?.email_id) {
            await storage.updateEmailEventStatus(data.email_id, 'clicked', new Date());
            console.log(`  ✓ Email ${data.email_id} marked as clicked`);
          }
          break;
        }

        case 'email.bounced': {
          if (data?.email_id) {
            await storage.updateEmailEventStatus(data.email_id, 'bounced', new Date());
            console.log(`  ⚠ Email ${data.email_id} bounced`);
          }
          break;
        }

        case 'email.complained': {
          if (data?.email_id) {
            await storage.updateEmailEventStatus(data.email_id, 'complained', new Date());
            console.log(`  ⚠ Email ${data.email_id} received complaint`);
          }
          break;
        }

        default:
          console.log(`  Unhandled Resend event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      console.error('❌ Error processing Resend webhook:', error);
      res.status(500).json({ message: 'Webhook processing failed' });
    }
  });

  // Templates routes
  app.get('/api/stats/template-count', async (req, res) => {
    try {
      const templates = await storage.getAllTemplates({});
      res.json({ count: templates.length });
    } catch (error) {
      console.error("Error fetching template count:", error);
      res.status(500).json({ message: "Failed to fetch template count" });
    }
  });

  app.get('/api/templates', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const { stateId, category } = req.query;
      const templates = await storage.getAllTemplates({
        stateId: stateId as string,
        category: category as string,
      });
      res.json(templates);
    } catch (error) {
      console.error("Error fetching templates:", error);
      res.status(500).json({ message: "Failed to fetch templates" });
    }
  });

  app.get('/api/templates/:id', isAuthenticated, requireAccess, async (req, res) => {
    try {
      const template = await storage.getTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      console.error("Error fetching template:", error);
      res.status(500).json({ message: "Failed to fetch template" });
    }
  });

  // Download blank static template (for templates like Rental Applications filled by tenants)
  app.get('/api/templates/:id/download-blank', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const template = await storage.getTemplate(req.params.id);
      
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      // Only allow blank downloads for static templates (e.g., rental applications)
      if (template.generationMode !== 'static') {
        return res.status(400).json({ message: "This template requires filling out via the wizard" });
      }

      // Get format from query param (default: pdf)
      const format = (req.query.format as string)?.toLowerCase() === 'docx' ? 'docx' : 'pdf';
      const safeFilename = template.title.replace(/[^a-z0-9]/gi, '_');
      
      // Route to appropriate generator based on template type
      if (template.templateType === 'move_out_checklist' || template.templateType === 'move_in_checklist') {
        // Use move-out/move-in checklist generator with correct type
        const { generateMoveOutChecklistPdf, generateMoveOutChecklistDocx } = await import('./utils/moveOutChecklistGenerator');
        const checklistType = template.templateType === 'move_in_checklist' ? 'move_in' : 'move_out';
        
        if (format === 'docx') {
          const docxBuffer = await generateMoveOutChecklistDocx({
            templateTitle: template.title,
            stateId: template.stateId,
            version: template.version || 1,
            updatedAt: template.updatedAt || new Date(),
            checklistType,
          });
          await assertValidDocx(docxBuffer);
          sendBinaryDownload(res, {
            buffer: docxBuffer,
            filename: `${safeFilename}.docx`,
            contentType: CONTENT_TYPES.DOCX,
          });
        } else {
          const pdfBuffer = await generateMoveOutChecklistPdf({
            templateTitle: template.title,
            stateId: template.stateId,
            version: template.version || 1,
            updatedAt: template.updatedAt || new Date(),
            checklistType,
          });
          assertLooksLikePdf(pdfBuffer);
          sendBinaryDownload(res, {
            buffer: pdfBuffer,
            filename: `${safeFilename}.pdf`,
            contentType: CONTENT_TYPES.PDF,
          });
        }
      } else {
        // Default to rental application generator for other static templates
        const { generateBlankApplicationPdf, generateBlankApplicationDocx } = await import('./utils/blankApplicationGenerator');
        
        if (format === 'docx') {
          const docxBuffer = await generateBlankApplicationDocx({
            templateTitle: template.title,
            stateId: template.stateId,
            version: template.version || 1,
            updatedAt: template.updatedAt || new Date(),
          });
          await assertValidDocx(docxBuffer);
          sendBinaryDownload(res, {
            buffer: docxBuffer,
            filename: `${safeFilename}.docx`,
            contentType: CONTENT_TYPES.DOCX,
          });
        } else {
          const pdfBuffer = await generateBlankApplicationPdf({
            templateTitle: template.title,
            stateId: template.stateId,
            version: template.version || 1,
            updatedAt: template.updatedAt || new Date(),
          });
          assertLooksLikePdf(pdfBuffer);
          sendBinaryDownload(res, {
            buffer: pdfBuffer,
            filename: `${safeFilename}.pdf`,
            contentType: CONTENT_TYPES.PDF,
          });
        }
      }

      // Track analytics event
      await storage.trackEvent({
        userId,
        eventType: 'blank_template_downloaded',
        eventData: { templateId: template.id, templateTitle: template.title, format },
      });
    } catch (error: any) {
      console.error('Error downloading blank template:', error);
      res.status(500).json({ message: "Failed to download template" });
    }
  });

  // Admin: Create template
  app.post('/api/admin/templates', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const validatedData = insertTemplateSchema.parse(req.body);
      const template = await storage.createTemplate(validatedData);

      // Track analytics event
      await storage.trackEvent({
        userId: getUserId(req),
        eventType: 'template_created',
        eventData: { templateId: template.id },
      });

      res.json(template);
    } catch (error) {
      console.error("Error creating template:", error);
      res.status(500).json({ message: "Failed to create template" });
    }
  });

  // Admin: Update template
  app.put('/api/admin/templates/:id', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertTemplateSchema.partial().parse(req.body);
      const template = await storage.updateTemplate(id, validatedData);
      res.json(template);
    } catch (error) {
      console.error("Error updating template:", error);
      res.status(500).json({ message: "Failed to update template" });
    }
  });

  // Admin: Delete template
  app.delete('/api/admin/templates/:id', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteTemplate(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting template:", error);
      res.status(500).json({ message: "Failed to delete template" });
    }
  });

  // Property routes
  app.get('/api/properties', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const properties = await storage.getPropertiesByUserId(userId);
      res.json(properties);
    } catch (error) {
      console.error("Error fetching properties:", error);
      res.status(500).json({ message: "Failed to fetch properties" });
    }
  });

  app.get('/api/properties/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const property = await storage.getProperty(req.params.id, userId);
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }
      res.json(property);
    } catch (error) {
      console.error("Error fetching property:", error);
      res.status(500).json({ message: "Failed to fetch property" });
    }
  });

  app.post('/api/properties', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Validate input to prevent malicious data
      const validatedData = insertPropertySchema.parse({
        ...req.body,
        userId,
      });
      
      const property = await storage.createProperty(validatedData);

      await storage.trackEvent({
        userId,
        eventType: 'property_created',
        eventData: { propertyId: property.id, propertyName: property.name },
      });

      res.json(property);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input data", errors: error.errors });
      }
      console.error("Error creating property:", error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  app.put('/api/properties/:id', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Validate input to prevent malicious data
      const validatedData = insertPropertySchema.partial().parse(req.body);
      
      const updatedProperty = await storage.updateProperty(req.params.id, userId, validatedData);
      if (!updatedProperty) {
        return res.status(404).json({ message: "Property not found" });
      }
      res.json(updatedProperty);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input data", errors: error.errors });
      }
      console.error("Error updating property:", error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  app.delete('/api/properties/:id', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const deleted = await storage.deleteProperty(req.params.id, userId);
      if (!deleted) {
        return res.status(404).json({ message: "Property not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting property:", error);
      res.status(500).json({ message: "Failed to delete property" });
    }
  });

  // Retention Settings routes
  app.get('/api/properties/:id/retention', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const property = await storage.getProperty(req.params.id, userId);
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }

      let settings = await storage.getRetentionSettings(req.params.id);
      if (!settings) {
        settings = {
          id: '',
          propertyId: req.params.id,
          deniedUploadsDays: 730,
          deniedBankStatementsDays: 120,
          approvedUploadsDays: 2555,
          approvedBankStatementsDays: 730,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }
      res.json(settings);
    } catch (error) {
      console.error("Error fetching retention settings:", error);
      res.status(500).json({ message: "Failed to fetch retention settings" });
    }
  });

  app.put('/api/properties/:id/retention', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const property = await storage.getProperty(req.params.id, userId);
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }

      const { deniedUploadsDays, deniedBankStatementsDays, approvedUploadsDays, approvedBankStatementsDays } = req.body;

      const values = [deniedUploadsDays, deniedBankStatementsDays, approvedUploadsDays, approvedBankStatementsDays].map(Number);
      if (values.some((n) => !Number.isFinite(n) || n < 0 || n > 36500)) {
        return res.status(400).json({ message: "Invalid retention values (must be 0-36500 days)" });
      }

      const settings = await storage.upsertRetentionSettings({
        propertyId: req.params.id,
        deniedUploadsDays: values[0],
        deniedBankStatementsDays: values[1],
        approvedUploadsDays: values[2],
        approvedBankStatementsDays: values[3],
      });

      res.json(settings);
    } catch (error) {
      console.error("Error updating retention settings:", error);
      res.status(500).json({ message: "Failed to update retention settings" });
    }
  });

  // Saved Documents routes
  app.get('/api/saved-documents', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const documents = await storage.getSavedDocumentsByUserId(userId);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching saved documents:", error);
      res.status(500).json({ message: "Failed to fetch saved documents" });
    }
  });

  app.get('/api/saved-documents/:id', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const document = await storage.getSavedDocumentById(req.params.id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      if (document.userId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      res.json(document);
    } catch (error) {
      console.error("Error fetching saved document:", error);
      res.status(500).json({ message: "Failed to fetch saved document" });
    }
  });

  app.post('/api/saved-documents', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Validate input to prevent malicious data
      const validatedData = insertSavedDocumentSchema.parse({
        ...req.body,
        userId,
        propertyId: req.body.propertyId || null,
      });
      
      // Validate propertyId ownership if provided
      if (validatedData.propertyId) {
        const property = await storage.getProperty(validatedData.propertyId, userId);
        if (!property) {
          return res.status(403).json({ message: "Property not found or access denied" });
        }
      }
      
      const savedDocument = await storage.createSavedDocument(validatedData);

      await storage.trackEvent({
        userId,
        eventType: 'document_saved',
        eventData: { templateId: validatedData.templateId, documentName: validatedData.documentName },
      });

      res.json(savedDocument);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input data", errors: error.errors });
      }
      console.error("Error saving document:", error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  app.get('/api/saved-documents/:id/download', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const document = await storage.getSavedDocumentById(req.params.id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      if (document.userId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const template = await storage.getTemplate(document.templateId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      // Get format from query param (default: pdf)
      const format = (req.query.format as string)?.toLowerCase() === 'docx' ? 'docx' : 'pdf';

      // Get landlord info for document header
      const user = await storage.getUser(userId);
      const landlordInfo = user ? {
        businessName: user.businessName,
        phoneNumber: user.phoneNumber,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      } : undefined;

      // Import document generators
      const { generateDocument, generateDocumentDOCX } = await import('./utils/documentGenerator');
      const { generateLeaseAgreementDocx, generateLeaseAgreementPdf } = await import('./utils/leaseAgreementGenerator');

      const generationOptions = {
        templateTitle: template.title,
        templateContent: '',
        fieldValues: document.formData as Record<string, string>,
        stateId: template.stateId,
        version: template.version || 1,
        updatedAt: template.updatedAt || new Date(),
        landlordInfo,
      };

      // Check if this is a lease agreement template
      const isLeaseAgreement = template.title.toLowerCase().includes('lease') || 
                               template.title.toLowerCase().includes('rental agreement');

      if (format === 'docx') {
        let docxBuffer: Buffer;
        
        if (isLeaseAgreement) {
          // Use specialized lease generator for cleaner DOCX output
          docxBuffer = await generateLeaseAgreementDocx({
            templateTitle: template.title,
            stateId: template.stateId,
            fieldValues: document.formData as Record<string, string>,
            version: template.version || 1,
            updatedAt: template.updatedAt || new Date(),
            landlordInfo,
          });
        } else {
          docxBuffer = await generateDocumentDOCX(generationOptions);
        }
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${document.documentName}.docx"`);
        res.send(docxBuffer);
      } else {
        let pdfBuffer: Buffer;
        
        if (isLeaseAgreement) {
          // Use specialized lease generator for consistent PDF/DOCX output
          pdfBuffer = await generateLeaseAgreementPdf({
            templateTitle: template.title,
            stateId: template.stateId,
            fieldValues: document.formData as Record<string, string>,
            version: template.version || 1,
            updatedAt: template.updatedAt || new Date(),
            landlordInfo,
          });
        } else {
          pdfBuffer = await generateDocument(generationOptions);
        }
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${document.documentName}.pdf"`);
        res.send(pdfBuffer);
      }

      await storage.trackEvent({
        userId,
        eventType: 'document_downloaded',
        eventData: { templateId: document.templateId, documentName: document.documentName },
      });
    } catch (error) {
      console.error("Error downloading saved document:", error);
      res.status(500).json({ message: "Failed to download document" });
    }
  });

  app.delete('/api/saved-documents/:id', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const document = await storage.getSavedDocumentById(req.params.id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      if (document.userId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Note: We allow deleting documents even if the associated property no longer exists
      // This prevents orphaned documents from becoming undeletable if the property is deleted first

      await storage.deleteSavedDocument(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting saved document:", error);
      res.status(500).json({ message: "Failed to delete saved document" });
    }
  });

  // Uploaded Documents routes
  // Schema for uploaded document metadata
  const uploadedDocumentMetadataSchema = z.object({
    propertyId: z.string().uuid().optional().nullable(),
    description: z.string().max(500).optional().nullable(),
  });
  
  app.post('/api/uploaded-documents', isAuthenticated, upload.single('file'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Validate metadata to prevent malicious data
      const validatedMetadata = uploadedDocumentMetadataSchema.parse({
        propertyId: req.body.propertyId || null,
        description: req.body.description || null,
      });

      // Validate propertyId ownership if provided
      if (validatedMetadata.propertyId) {
        const property = await storage.getProperty(validatedMetadata.propertyId, userId);
        if (!property) {
          // Clean up uploaded file if property validation fails
          await fs.unlink(req.file.path).catch(err => console.error("Error deleting orphaned file:", err));
          return res.status(403).json({ message: "Property not found or access denied" });
        }
      }

      const uploadedDocument = await storage.createUploadedDocument({
        userId,
        propertyId: validatedMetadata.propertyId,
        fileName: req.file.originalname,
        fileUrl: req.file.path,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        description: validatedMetadata.description,
      });

      await storage.trackEvent({
        userId,
        eventType: 'document_uploaded',
        eventData: { fileName: req.file.originalname, fileSize: req.file.size },
      });

      res.json(uploadedDocument);
    } catch (error) {
      // Clean up uploaded file on error
      if (req.file) {
        await fs.unlink(req.file.path).catch(err => console.error("Error deleting orphaned file:", err));
      }
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input data", errors: error.errors });
      }
      console.error("Error uploading document:", error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  app.get('/api/uploaded-documents', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const documents = await storage.getUploadedDocumentsByUserId(userId);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching uploaded documents:", error);
      res.status(500).json({ message: "Failed to fetch uploaded documents" });
    }
  });

  app.get('/api/uploaded-documents/property/:propertyId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { propertyId } = req.params;

      // Validate property ownership
      const property = await storage.getProperty(propertyId, userId);
      if (!property) {
        return res.status(403).json({ message: "Property not found or access denied" });
      }

      const documents = await storage.getUploadedDocumentsByPropertyId(propertyId, userId);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching property documents:", error);
      res.status(500).json({ message: "Failed to fetch property documents" });
    }
  });

  app.get('/api/uploaded-documents/:id/download', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const document = await storage.getUploadedDocumentById(req.params.id, userId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Check if file exists on disk
      try {
        await fs.access(document.fileUrl);
      } catch {
        return res.status(404).json({ message: "File not found on disk" });
      }

      // Stream file to client with proper headers
      res.setHeader('Content-Type', document.fileType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${document.fileName}"`);
      
      const fileStream = (await import('fs')).createReadStream(document.fileUrl);
      fileStream.pipe(res);

      await storage.trackEvent({
        userId,
        eventType: 'uploaded_document_downloaded',
        eventData: { fileName: document.fileName },
      });
    } catch (error) {
      console.error("Error downloading uploaded document:", error);
      res.status(500).json({ message: "Failed to download document" });
    }
  });

  app.patch('/api/uploaded-documents/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { fileName, propertyId, description } = req.body;
      
      const updates: { fileName?: string; propertyId?: string | null; description?: string | null } = {};
      if (fileName !== undefined) updates.fileName = fileName;
      if (propertyId !== undefined) updates.propertyId = propertyId === "none" || propertyId === "" ? null : propertyId;
      if (description !== undefined) updates.description = description || null;

      const updated = await storage.updateUploadedDocument(req.params.id, userId, updates);
      if (!updated) {
        return res.status(404).json({ message: "Document not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating uploaded document:", error);
      res.status(500).json({ message: "Failed to update document" });
    }
  });

  app.delete('/api/uploaded-documents/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const document = await storage.getUploadedDocumentById(req.params.id, userId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Delete from database
      const deleted = await storage.deleteUploadedDocument(req.params.id, userId);
      if (!deleted) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Delete physical file from disk
      try {
        await fs.unlink(document.fileUrl);
      } catch (err) {
        console.error("Error deleting file from disk:", err);
        // Continue - database record is already deleted
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting uploaded document:", error);
      res.status(500).json({ message: "Failed to delete uploaded document" });
    }
  });

  // Compliance routes
  app.get('/api/compliance-cards', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const { stateId } = req.query;
      if (!stateId) {
        return res.status(400).json({ message: "stateId is required" });
      }
      const cards = await storage.getComplianceCardsByState(stateId as string);
      res.json(cards);
    } catch (error) {
      console.error("Error fetching compliance cards:", error);
      res.status(500).json({ message: "Failed to fetch compliance cards" });
    }
  });

  // Admin: Get all compliance cards
  app.get('/api/admin/compliance-cards', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const cards = await storage.getAllComplianceCards();
      res.json(cards);
    } catch (error) {
      console.error("Error fetching all compliance cards:", error);
      res.status(500).json({ message: "Failed to fetch compliance cards" });
    }
  });

  // Admin: Create compliance card
  app.post('/api/admin/compliance-cards', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const validatedData = insertComplianceCardSchema.parse(req.body);
      const card = await storage.createComplianceCard(validatedData);
      res.json(card);
    } catch (error) {
      console.error("Error creating compliance card:", error);
      res.status(500).json({ message: "Failed to create compliance card" });
    }
  });

  // Admin: Update compliance card
  app.put('/api/admin/compliance-cards/:id', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertComplianceCardSchema.partial().parse(req.body);
      const card = await storage.updateComplianceCard(id, validatedData);
      res.json(card);
    } catch (error) {
      console.error("Error updating compliance card:", error);
      res.status(500).json({ message: "Failed to update compliance card" });
    }
  });

  // Admin: Delete compliance card
  app.delete('/api/admin/compliance-cards/:id', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteComplianceCard(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting compliance card:", error);
      res.status(500).json({ message: "Failed to delete compliance card" });
    }
  });

  // Legal updates routes
  app.get('/api/legal-updates', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const { stateId } = req.query;
      if (!stateId) {
        return res.status(400).json({ message: "stateId is required" });
      }
      
      let updates;
      
      if (stateId === 'NATIONAL') {
        // Get all legal updates including federal
        updates = await storage.getAllLegalUpdates();
      } else {
        // Get state-specific updates AND federal (US) updates - they apply to all states
        const stateUpdates = await storage.getLegalUpdatesByState(stateId as string);
        const federalUpdates = await storage.getLegalUpdatesByState('US');
        updates = [...stateUpdates, ...federalUpdates];
      }
      
      // Also fetch recent legislative monitoring records (high/medium relevance) for this state(s)
      // Federal Register documents (stateId='US') should appear for ALL states
      let legislativeUpdates: any[] = [];
      if (stateId === 'NATIONAL') {
        const allBills = await storage.getAllLegislativeMonitoring({});
        legislativeUpdates = allBills.filter(b => b.relevanceLevel === 'high' || b.relevanceLevel === 'medium');
      } else {
        // Get state-specific bills
        const stateBills = await storage.getAllLegislativeMonitoring({ stateId: stateId as string });
        // Also get federal documents (US) - they apply to all states
        const federalBills = await storage.getAllLegislativeMonitoring({ stateId: 'US' });
        const allBills = [...stateBills, ...federalBills];
        legislativeUpdates = allBills.filter(b => b.relevanceLevel === 'high' || b.relevanceLevel === 'medium');
      }
      
      // Combine and sort by effective date (most recent first), fallback to createdAt
      const combined = [
        ...updates.map(u => ({ ...u, type: 'legal_update' })),
        ...legislativeUpdates.map(b => ({ 
          ...b, 
          type: 'legislative_update',
          impactLevel: b.relevanceLevel,
          // Map legislative fields to legal update format for UI display
          title: b.title || b.billNumber,
          summary: b.description || `Bill: ${b.billNumber}`,
          whyItMatters: b.aiAnalysis || 'This bill affects landlord-tenant law in your state.',
          beforeText: b.lastAction || 'Bill pending',
          afterText: `${b.billNumber}: ${b.title}`,
          effectiveDate: b.lastActionDate || b.createdAt
        }))
      ].sort((a, b) => {
        // Sort by effectiveDate first, then by createdAt as fallback
        const dateA = a.effectiveDate ? new Date(a.effectiveDate).getTime() : new Date(a.createdAt).getTime();
        const dateB = b.effectiveDate ? new Date(b.effectiveDate).getTime() : new Date(b.createdAt).getTime();
        return dateB - dateA; // Most recent first
      });
      
      // Mark the first (most recent) item as "isNewest" for UI highlighting
      const result = combined.map((item, index) => ({
        ...item,
        isNewest: index === 0
      }));
      
      res.json(result);
    } catch (error) {
      console.error("Error fetching legal updates:", error);
      res.status(500).json({ message: "Failed to fetch legal updates" });
    }
  });

  // Communication templates routes
  app.get('/api/communications', isAuthenticated, async (req: any, res) => {
    try {
      const { stateId } = req.query;
      console.log(`[communications] 🔍 Fetching templates - stateId=${stateId}, query=${JSON.stringify(req.query)}`);
      if (!stateId) {
        const templates = await storage.getAllCommunicationTemplates();
        console.log(`[communications] ✅ Returning all ${templates.length} templates`);
        return res.json(templates);
      }
      console.log(`[communications] 📊 Database query starting for state: ${stateId}`);
      const templates = await storage.getCommunicationTemplatesByState(stateId as string);
      console.log(`[communications] ✅ Query successful - found ${templates.length} templates for state ${stateId}`);
      if (templates.length === 0) {
        console.warn(`[communications] ⚠️ WARNING: No templates found for state ${stateId}. Check database connectivity and data.`);
      }
      res.json(templates);
    } catch (error: any) {
      console.error(`[communications] ❌ ERROR fetching templates:`, error?.message || error);
      console.error(`[communications] Full error:`, error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  app.post('/api/communications', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(getUserId(req));
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Admin only" });
      }
      
      const data = req.body;
      const template = await storage.createCommunicationTemplate(data);
      res.json(template);
    } catch (error) {
      console.error("Error creating communication template:", error);
      res.status(500).json({ message: "Failed to create template" });
    }
  });

  // Rent Ledger routes
  app.get('/api/rent-ledger', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const entries = await storage.getRentLedgerEntries(userId);
      res.json(entries);
    } catch (error) {
      console.error("Error fetching rent ledger:", error);
      res.status(500).json({ message: "Failed to fetch entries" });
    }
  });

  app.post('/api/rent-ledger', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      console.log("📝 Creating rent ledger entry, body:", JSON.stringify(req.body, null, 2));

      // Validate property exists and belongs to user if provided
      // Note: The client uses rentalProperties table, but the rent ledger FK references properties table
      // We need to check rentalProperties since that's where the UI gets the list
      const propertyId = req.body.propertyId || null;
      if (propertyId) {
        console.log("📝 Checking rental property:", propertyId);
        const rentalProperty = await storage.getRentalPropertyById(propertyId);
        if (!rentalProperty) {
          console.error("❌ Rental property not found:", propertyId);
          return res.status(400).json({ message: "Property not found. Please select a valid property or leave it blank." });
        }
        if (rentalProperty.userId !== userId) {
          console.error("❌ Rental property belongs to different user:", rentalProperty.userId, "vs", userId);
          return res.status(400).json({ message: "Property not found. Please select a valid property or leave it blank." });
        }
        console.log("✅ Rental property validated:", rentalProperty.name);
        // Clear the propertyId since it references the wrong table (properties vs rentalProperties)
        // The rent ledger FK references the old 'properties' table, but UI uses 'rentalProperties'
        // For now, we'll store null to avoid FK violation, but log what property was selected
        console.log("⚠️ Clearing propertyId due to table mismatch - UI uses rentalProperties, DB expects properties");
      }

      // Auto-generate month from effectiveDate if not provided
      let month = req.body.month;
      if (!month && req.body.effectiveDate) {
        const effectiveDate = new Date(req.body.effectiveDate);
        if (!isNaN(effectiveDate.getTime())) {
          const year = effectiveDate.getFullYear();
          const monthNum = String(effectiveDate.getMonth() + 1).padStart(2, '0');
          month = `${year}-${monthNum}`;
        }
      }
      if (!month) {
        // Fallback to current month
        const now = new Date();
        month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      }

      // Clean up optional fields - convert empty strings to null
      // Note: propertyId is intentionally set to null because the UI uses rentalProperties table
      // but the rent ledger FK references the old 'properties' table - table mismatch issue
      const dataToValidate = {
        ...req.body,
        userId,
        month,
        propertyId: null, // Intentionally null due to FK/table mismatch - see validation above
        description: req.body.description || null,
        notes: req.body.notes || null,
        paymentMethod: req.body.paymentMethod || null,
        referenceNumber: req.body.referenceNumber || null,
      };

      console.log("📝 Data to validate:", JSON.stringify(dataToValidate, null, 2));

      const validated = insertRentLedgerEntrySchema.parse(dataToValidate);

      console.log("✅ Validated rent ledger entry");

      const entry = await storage.createRentLedgerEntry(validated);
      res.json(entry);
    } catch (error: any) {
      console.error("❌ Error creating rent ledger entry:", error);
      // Handle Zod validation errors specifically
      if (error?.issues) {
        console.error("❌ Zod validation issues:", JSON.stringify(error.issues, null, 2));
        const errorDetails = error.issues.map((i: any) => `${i.path.join('.')}: ${i.message}`).join(', ');
        return res.status(500).json({ message: `Validation failed: ${errorDetails}` });
      }
      // Handle database errors (like foreign key constraint)
      if (error?.code === '23503') {
        console.error("❌ Foreign key violation - property not found");
        return res.status(500).json({ message: "Property not found. Please select a valid property or leave it blank." });
      }
      console.error("❌ Error details:", error?.message, error?.code);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  app.put('/api/rent-ledger/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const validated = insertRentLedgerEntrySchema.parse({
        ...req.body,
        userId,
      });

      const updated = await storage.updateRentLedgerEntry(req.params.id, userId, validated);
      if (!updated) {
        return res.status(404).json({ message: "Entry not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating rent ledger entry:", error);
      res.status(500).json({ message: "Failed to update entry" });
    }
  });

  app.delete('/api/rent-ledger/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const deleted = await storage.deleteRentLedgerEntry(req.params.id, userId);
      if (!deleted) {
        return res.status(404).json({ message: "Entry not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting rent ledger entry:", error);
      res.status(500).json({ message: "Failed to delete entry" });
    }
  });

  app.get('/api/legal-updates/recent', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const updates = await storage.getRecentLegalUpdates(5);
      res.json(updates);
    } catch (error) {
      console.error("Error fetching recent legal updates:", error);
      res.status(500).json({ message: "Failed to fetch recent legal updates" });
    }
  });

  // Admin: Get all legal updates
  app.get('/api/admin/legal-updates', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const updates = await storage.getAllLegalUpdates();
      res.json(updates);
    } catch (error) {
      console.error("Error fetching all legal updates:", error);
      res.status(500).json({ message: "Failed to fetch legal updates" });
    }
  });

  // Admin: Create legal update
  app.post('/api/admin/legal-updates', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const validatedData = insertLegalUpdateSchema.parse(req.body);
      const update = await storage.createLegalUpdate(validatedData);

      // Optionally: Create notifications for affected users
      // This would be done in a background job in production

      res.json(update);
    } catch (error) {
      console.error("Error creating legal update:", error);
      res.status(500).json({ message: "Failed to create legal update" });
    }
  });

  // Admin: Update legal update
  app.put('/api/admin/legal-updates/:id', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertLegalUpdateSchema.partial().parse(req.body);
      const update = await storage.updateLegalUpdate(id, validatedData);
      res.json(update);
    } catch (error) {
      console.error("Error updating legal update:", error);
      res.status(500).json({ message: "Failed to update legal update" });
    }
  });

  // Admin: Delete legal update
  app.delete('/api/admin/legal-updates/:id', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteLegalUpdate(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting legal update:", error);
      res.status(500).json({ message: "Failed to delete legal update" });
    }
  });

  // Notification routes
  app.get('/api/notifications/unread-count', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const count = await storage.getUnreadNotificationCount(userId);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching unread notification count:", error);
      res.status(500).json({ message: "Failed to fetch notification count" });
    }
  });

  app.get('/api/notifications', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const notifications = await storage.getUserNotifications(userId);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.patch('/api/notifications/:id/read', isAuthenticated, async (req, res) => {
    try {
      await storage.markNotificationAsRead(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  // Analytics routes
  app.post('/api/analytics/track', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { eventType, eventData } = req.body;
      await storage.trackEvent({
        userId,
        eventType,
        eventData,
      });
      res.json({ success: true });
    } catch (error) {
      console.error("Error tracking analytics event:", error);
      res.status(500).json({ message: "Failed to track event" });
    }
  });

  // Admin analytics
  app.get('/api/admin/analytics', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const summary = await storage.getAnalyticsSummary();
      res.json(summary);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // Detailed engagement events with user info for drill-down
  app.get('/api/admin/analytics/engagement', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { eventType, limit, month, year } = req.query;
      const events = await storage.getDetailedEngagementEvents({
        eventType: eventType as string | undefined,
        limit: limit ? parseInt(limit as string) : 100,
        month: month ? parseInt(month as string) : undefined,
        year: year ? parseInt(year as string) : undefined,
      });
      res.json(events);
    } catch (error) {
      console.error("Error fetching engagement details:", error);
      res.status(500).json({ message: "Failed to fetch engagement details" });
    }
  });
  
  // Monthly engagement summary for yearly aggregation
  app.get('/api/admin/analytics/engagement/monthly', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { year } = req.query;
      const targetYear = year ? parseInt(year as string) : new Date().getFullYear();
      const summary = await storage.getEngagementSummaryByMonth(targetYear);
      res.json(summary);
    } catch (error) {
      console.error("Error fetching monthly engagement summary:", error);
      res.status(500).json({ message: "Failed to fetch monthly engagement summary" });
    }
  });

  app.get('/api/admin/users', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);

      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Access denied. Admin only." });
      }

      const allUsers = await storage.getAllUsers();
      res.json(allUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Admin: Start impersonating a user
  app.post('/api/admin/impersonate/:userId', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const realAdmin = req.realAdmin || req.user;
      const targetUserId = req.params.userId;
      
      // Can't impersonate yourself
      if (targetUserId === realAdmin.id) {
        return res.status(400).json({ message: "Cannot impersonate yourself" });
      }
      
      // Verify target user exists
      const targetUser = await storage.getUser(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Start impersonation
      startImpersonation(realAdmin.id, targetUserId);
      
      console.log(`🎭 Admin ${realAdmin.email} started impersonating ${targetUser.email}`);
      
      res.json({ 
        success: true, 
        impersonating: { 
          id: targetUser.id, 
          email: targetUser.email,
          firstName: targetUser.firstName,
          lastName: targetUser.lastName,
        }
      });
    } catch (error) {
      console.error("Error starting impersonation:", error);
      res.status(500).json({ message: "Failed to start impersonation" });
    }
  });

  // Admin: Stop impersonating
  app.post('/api/admin/stop-impersonating', isAuthenticated, async (req: any, res) => {
    try {
      const realAdmin = req.realAdmin || req.user;
      
      if (!realAdmin.isAdmin) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      stopImpersonation(realAdmin.id);
      
      console.log(`🎭 Admin ${realAdmin.email} stopped impersonating`);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error stopping impersonation:", error);
      res.status(500).json({ message: "Failed to stop impersonation" });
    }
  });

  // Admin: Get current impersonation status
  app.get('/api/admin/impersonation-status', isAuthenticated, async (req: any, res) => {
    try {
      const realAdmin = req.realAdmin || req.user;
      
      if (!realAdmin.isAdmin) {
        return res.json({ isImpersonating: false });
      }
      
      const status = getImpersonationStatus(realAdmin.id);
      
      if (status) {
        const impersonatedUser = await storage.getUser(status.impersonatedUserId);
        return res.json({
          isImpersonating: true,
          impersonating: impersonatedUser ? {
            id: impersonatedUser.id,
            email: impersonatedUser.email,
            firstName: impersonatedUser.firstName,
            lastName: impersonatedUser.lastName,
          } : null,
          startedAt: status.startedAt,
        });
      }
      
      res.json({ isImpersonating: false });
    } catch (error) {
      console.error("Error getting impersonation status:", error);
      res.status(500).json({ message: "Failed to get impersonation status" });
    }
  });

  // Admin Applications Activity - view all rental submissions across all users
  app.get('/api/admin/applications-activity', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);

      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Access denied. Admin only." });
      }

      // Fetch all submissions with full details using Drizzle relations
      const submissions = await db.query.rentalSubmissions.findMany({
        with: {
          applicationLink: {
            with: {
              unit: {
                with: {
                  property: {
                    with: {
                      user: true, // The landlord
                    },
                  },
                },
              },
            },
          },
          people: true,
          screeningOrder: true,
          decision: true,
          events: true,
        },
        orderBy: (rs, { desc }) => [desc(rs.createdAt)],
      });

      // Transform into a more digestible format for the admin UI
      const activityData = submissions.map(sub => {
        const property = sub.applicationLink?.unit?.property;
        const landlord = property?.user;
        const primaryApplicant = sub.people?.find(p => p.role === 'applicant');
        const coApplicants = sub.people?.filter(p => p.role === 'coapplicant') || [];
        const guarantors = sub.people?.filter(p => p.role === 'guarantor') || [];

        return {
          id: sub.id,
          status: sub.status,
          submittedAt: sub.submittedAt,
          createdAt: sub.createdAt,
          // Landlord info
          landlord: landlord ? {
            id: landlord.id,
            email: landlord.email,
            name: [landlord.firstName, landlord.lastName].filter(Boolean).join(' ') || landlord.email,
          } : null,
          // Property info
          property: property ? {
            id: property.id,
            name: property.name,
            address: property.address,
            city: property.city,
            state: property.state,
          } : null,
          // Unit info
          unit: sub.applicationLink?.unit ? {
            id: sub.applicationLink.unit.id,
            label: sub.applicationLink.unit.unitLabel,
          } : null,
          // Primary applicant
          applicant: primaryApplicant ? {
            id: primaryApplicant.id,
            firstName: primaryApplicant.firstName,
            lastName: primaryApplicant.lastName,
            email: primaryApplicant.email,
            phone: primaryApplicant.phone,
            isCompleted: primaryApplicant.isCompleted,
            completedAt: primaryApplicant.completedAt,
          } : null,
          // Co-applicants and guarantors
          coApplicants: coApplicants.map(p => ({
            id: p.id,
            firstName: p.firstName,
            lastName: p.lastName,
            email: p.email,
            isCompleted: p.isCompleted,
          })),
          guarantors: guarantors.map(p => ({
            id: p.id,
            firstName: p.firstName,
            lastName: p.lastName,
            email: p.email,
            isCompleted: p.isCompleted,
          })),
          // Screening info
          screening: sub.screeningOrder ? {
            status: sub.screeningOrder.status,
            referenceNumber: sub.screeningOrder.referenceNumber,
            createdAt: sub.screeningOrder.createdAt,
            reportUrl: sub.screeningOrder.reportUrl,
          } : null,
          // Decision
          decision: sub.decision ? {
            decision: sub.decision.decision,
            decidedAt: sub.decision.decidedAt,
            notes: sub.decision.notes,
          } : null,
          // Event timeline
          events: sub.events?.map(e => ({
            type: e.eventType,
            createdAt: e.createdAt,
            metadata: e.metadataJson,
          })) || [],
        };
      });

      res.json(activityData);
    } catch (error) {
      console.error("Error fetching applications activity:", error);
      res.status(500).json({ message: "Failed to fetch applications activity" });
    }
  });

  // Contact form route (public - no authentication required)
  app.post('/api/contact', async (req, res) => {
    try {
      const { firstName, lastName, email, phone, message } = req.body;

      // Validate required fields
      if (!firstName || !lastName || !email || !message) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Send email to support
      await emailService.sendContactFormEmail({
        firstName,
        lastName,
        email,
        phone: phone || "Not provided",
        message,
      });

      res.json({ success: true, message: "Contact form submitted successfully" });
    } catch (error) {
      console.error("Error processing contact form:", error);
      res.status(500).json({ message: "Failed to send contact form" });
    }
  });

  // States routes - API-driven source of truth for all state dropdowns
  app.get('/api/states', async (req, res) => {
    try {
      const { active } = req.query;
      // Default: return only active states
      // Pass active=false to include inactive states (admin use)
      const includeInactive = active === 'false';
      const states = await storage.getAllStates({ includeInactive });
      res.json(states);
    } catch (error) {
      console.error("Error fetching states:", error);
      res.status(500).json({ message: "Failed to fetch states" });
    }
  });

  // Blog routes (public)
  app.get('/api/blog', async (req, res) => {
    try {
      const { stateId, tag } = req.query;
      const posts = await storage.getAllBlogPosts({
        stateId: stateId as string,
        tag: tag as string,
        isPublished: true,
      });
      res.json(posts);
    } catch (error) {
      console.error("Error fetching blog posts:", error);
      res.status(500).json({ message: "Failed to fetch blog posts" });
    }
  });

  app.get('/api/blog/:slug', async (req, res) => {
    try {
      const { slug } = req.params;
      const post = await storage.getBlogPostBySlug(slug);
      
      if (!post || !post.isPublished) {
        return res.status(404).json({ message: "Blog post not found" });
      }

      // Increment view count
      await storage.incrementBlogPostViews(post.id);
      
      res.json(post);
    } catch (error) {
      console.error("Error fetching blog post:", error);
      res.status(500).json({ message: "Failed to fetch blog post" });
    }
  });

  // Admin blog routes (admin only)
  app.get('/api/admin/blog', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const posts = await storage.getAllBlogPosts({});
      res.json(posts);
    } catch (error) {
      console.error("Error fetching all blog posts:", error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  app.post('/api/admin/blog', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const validatedData = insertBlogPostSchema.parse(req.body);
      const post = await storage.createBlogPost(validatedData);
      res.json(post);
    } catch (error) {
      console.error("Error creating blog post:", error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  app.patch('/api/admin/blog/:id', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const { id } = req.params;
      const post = await storage.updateBlogPost(id, req.body);
      res.json(post);
    } catch (error) {
      console.error("Error updating blog post:", error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  app.delete('/api/admin/blog/:id', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const { id } = req.params;
      await storage.deleteBlogPost(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting blog post:", error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  // Send legal update notifications (admin only)
  app.post('/api/admin/notify-legal-update/:updateId', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { updateId } = req.params;
      
      // Get the legal update with state info
      const update = await storage.getLegalUpdateById(updateId);
      if (!update) {
        return res.status(404).json({ message: "Legal update not found" });
      }
      
      const state = await storage.getStateById(update.stateId);
      if (!state) {
        return res.status(404).json({ message: "State not found" });
      }
      
      // Get all users who have this state as their preferred state or all users for high impact
      // Filter to only users who have opted in to legal update notifications
      const allUsers = update.impactLevel === 'high' 
        ? await storage.getAllActiveUsers() 
        : await storage.getUsersByState(update.stateId);
      
      // Only notify users who have opted in to legal update notifications
      const users = allUsers.filter(u => u.notifyLegalUpdates !== false);
      
      const { client, fromEmail } = await getUncachableResendClient();
      
      let successCount = 0;
      let errorCount = 0;
      
      // Send emails to opted-in users only
      for (const user of users) {
        if (!user.email) continue;
        
        try {
          const emailData = generateLegalUpdateEmail({
            update: {
              ...update,
              whatChanged: (update as any).beforeText && (update as any).afterText 
                ? `Before: ${(update as any).beforeText}\n\nAfter: ${(update as any).afterText}` 
                : null,
              nextSteps: null,
            },
            state: { ...state, code: state.id },
            userEmail: user.email,
            userName: user.firstName || undefined,
          });
          
          await client.emails.send({
            from: fromEmail,
            to: user.email,
            subject: emailData.subject,
            html: emailData.html,
            text: emailData.text,
          });
          
          // Create in-app notification
          await storage.createUserNotification({
            userId: user.id,
            legalUpdateId: updateId,
            isRead: false,
          });
          
          successCount++;
        } catch (emailError) {
          console.error(`Failed to send email to ${user.email}:`, emailError);
          errorCount++;
        }
      }
      
      res.json({ 
        success: true,
        sent: successCount,
        failed: errorCount,
        total: users.length
      });
    } catch (error) {
      console.error("Error sending notifications:", error);
      res.status(500).json({ message: "Failed to send notifications" });
    }
  });

  // Admin - Get template review queue (with enriched template data)
  app.get("/api/admin/template-review-queue", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const reviews = await storage.getAllTemplateReviewQueue({
        status: req.query.status as string | undefined,
      });

      const enrichedReviews = await Promise.all(
        reviews.map(async (review) => {
          const template = await storage.getTemplate(review.templateId);
          // Also get the related bill info
          let bill = null;
          if (review.billId) {
            bill = await storage.getLegislativeMonitoringByBillId(review.billId);
          }
          return { ...review, template, bill };
        })
      );

      // Return array directly, not wrapped in object
      res.json(enrichedReviews);
    } catch (error: any) {
      console.error("Error fetching template review queue:", error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  // Admin - Approve template update
  app.patch("/api/admin/template-review-queue/:id/approve", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { approvalNotes, versionNotes, lastUpdateReason, pdfUrl, fillableFormData } = req.body;

      if (!versionNotes || !lastUpdateReason) {
        return res.status(400).json({ message: "versionNotes and lastUpdateReason are required" });
      }

      const review = await storage.getTemplateReviewById(id);
      if (!review) {
        return res.status(404).json({ message: "Review not found" });
      }

      const userId = getUserId(req);
      const { template, version } = await storage.publishTemplateUpdate({
        templateId: review.templateId,
        reviewId: id,
        pdfUrl,
        fillableFormData,
        versionNotes,
        lastUpdateReason,
        publishedBy: userId,
      });

      if (approvalNotes) {
        await storage.updateTemplateReviewQueue(id, { approvalNotes, approvedAt: new Date() });
      }

      const notificationsSent = await notifyUsersOfTemplateUpdate(template, version);

      res.json({ success: true, template, version, notificationsSent });
    } catch (error: any) {
      console.error("Error approving template update:", error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  // Admin - Reject template update
  app.patch("/api/admin/template-review-queue/:id/reject", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { approvalNotes } = req.body;

      if (!approvalNotes) {
        return res.status(400).json({ message: "approvalNotes is required" });
      }

      await storage.updateTemplateReviewQueue(id, {
        status: 'rejected' as any,
        approvalNotes,
        rejectedAt: new Date(),
      });

      res.json({ success: true, reviewId: id, status: 'rejected' });
    } catch (error: any) {
      console.error("Error rejecting template update:", error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  // Admin - One-click approve AI-drafted template update
  app.patch("/api/admin/template-review-queue/:id/quick-approve", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = getUserId(req);

      const review = await storage.getTemplateReviewById(id);
      if (!review) {
        return res.status(404).json({ message: "Review not found" });
      }

      // Parse the AI-drafted changes from recommendedChanges
      let draftedChanges = {
        draftedClause: '',
        clauseLocation: '',
        changeType: 'other',
        changeSummary: '',
        legalReference: '',
      };

      if (review.recommendedChanges) {
        try {
          draftedChanges = JSON.parse(review.recommendedChanges);
        } catch {
          // Not JSON, use as plain text
          draftedChanges.draftedClause = review.recommendedChanges;
          draftedChanges.changeSummary = 'Manual update based on legislative change';
        }
      }

      // Get the template
      const template = await storage.getTemplate(review.templateId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      // Generate version notes from the draft
      const versionNotes = draftedChanges.changeSummary || 'Legislative update applied';
      const lastUpdateReason = draftedChanges.legalReference 
        ? `Legislative update: ${draftedChanges.legalReference}`
        : 'Legislative compliance update';

      // Publish the template update with the drafted changes
      const { template: updatedTemplate, version } = await storage.publishTemplateUpdate({
        templateId: review.templateId,
        reviewId: id,
        pdfUrl: template.pdfUrl, // Keep existing PDF - would need to regenerate separately
        fillableFormData: template.fillableFormData,
        versionNotes,
        lastUpdateReason,
        publishedBy: userId,
      });

      // Update the review queue entry
      await storage.updateTemplateReviewQueue(id, {
        status: 'approved' as any,
        approvedAt: new Date(),
        approvalNotes: `Quick-approved AI draft: ${draftedChanges.changeSummary}`,
        approvedChanges: draftedChanges.draftedClause,
      });

      // Notify users about the template update
      const notificationsSent = await notifyUsersOfTemplateUpdate(updatedTemplate, version);

      res.json({ 
        success: true, 
        template: updatedTemplate, 
        version,
        notificationsSent,
        message: `Template "${template.title}" updated and ${notificationsSent} users notified`,
      });
    } catch (error: any) {
      console.error("Error quick-approving template update:", error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  // Get template version history
  app.get("/api/templates/:id/versions", async (req, res) => {
    try {
      const { id } = req.params;
      
      const template = await storage.getTemplate(id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      const versions = await storage.getTemplateVersions(id);

      res.json({
        template: { id: template.id, title: template.title, currentVersion: template.version },
        versions,
      });
    } catch (error: any) {
      console.error("Error fetching template versions:", error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  // Restore a previous template version
  app.post("/api/templates/:id/restore-version/:versionId", isAuthenticated, async (req: any, res) => {
    try {
      const { id, versionId } = req.params;
      const userId = getUserId(req);
      const user = await storage.getUser(userId);

      if (!user?.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
      }
      
      const template = await storage.getTemplate(id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      const versions = await storage.getTemplateVersions(id);
      const versionToRestore = versions.find(v => v.id.toString() === versionId);
      
      if (!versionToRestore) {
        return res.status(404).json({ message: "Version not found" });
      }

      // Create new version entry for the restoration
      const newVersionNumber = template.version ? template.version + 1 : 2;
      await storage.createTemplateVersion({
        templateId: id,
        versionNumber: newVersionNumber,
        pdfUrl: versionToRestore.pdfUrl,
        fillableFormData: versionToRestore.fillableFormData as any,
        versionNotes: `Restored from Version ${versionToRestore.versionNumber}`,
        lastUpdateReason: `Rollback to previous version ${versionToRestore.versionNumber}`,
        sourceReviewId: null,
        metadata: { restoredFrom: versionToRestore.id } as any,
        createdBy: userId,
      });

      // Update the template with the restored version's data
      await storage.updateTemplate(id, {
        version: newVersionNumber,
        pdfUrl: versionToRestore.pdfUrl,
        fillableFormData: versionToRestore.fillableFormData as any,
        versionNotes: `Restored from Version ${versionToRestore.versionNumber}`,
        lastUpdateReason: `Rollback to previous version ${versionToRestore.versionNumber}`,
      });

      res.json({ 
        success: true, 
        message: `Template restored to version ${versionToRestore.versionNumber}`,
        newVersion: newVersionNumber,
      });
    } catch (error: any) {
      console.error('Error restoring template version:', error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  // Generate filled document (PDF or DOCX)
  app.post('/api/documents/generate', isAuthenticated, async (req: any, res) => {
    try {
      const { templateId, fieldValues } = req.body;
      const format = (req.query.format as string)?.toLowerCase() === 'docx' ? 'docx' : 'pdf';

      if (!templateId || !fieldValues) {
        return res.status(400).json({ message: "Template ID and field values are required" });
      }

      console.log(`📄 Document generation request (${format.toUpperCase()}):`, {
        templateId,
        format,
        fieldCount: Object.keys(fieldValues || {}).length,
        fieldIds: Object.keys(fieldValues || {}),
        sampleValues: Object.entries(fieldValues || {}).slice(0, 3).map(([k, v]) => `${k}=${v}`)
      });

      // Get template
      const template = await storage.getTemplate(templateId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      console.log('📄 Template found:', template.title, `- Generating ${format.toUpperCase()} with field values...`);

      // SECURITY: We NEVER use custom templateContent from the database to prevent HTML injection.
      // All documents are generated using the default template generator with fully escaped user input.
      // If custom templates are needed in the future, they MUST be:
      // 1. Created only by admin users
      // 2. Stored as safe placeholder-based templates (not raw HTML)
      // 3. Rendered through a safe templating engine with auto-escaping

      // Get landlord info for document header
      const userId = getUserId(req);
      const user = userId ? await storage.getUser(userId) : null;
      const landlordInfo = user ? {
        businessName: user.businessName,
        phoneNumber: user.phoneNumber,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      } : undefined;

      // Check if this template has a corresponding notice form with official PDF overlay mode
      const titleLower = template.title.toLowerCase();
      const isMichiganDemand = titleLower.includes('demand for possession') ||
        (template.stateId === 'MI' && titleLower.includes('demand') && titleLower.includes('seven'));
      
      if (isMichiganDemand && format === 'pdf') {
        try {
          const { resolveForm, getOverlayData, calculateDates } = await import('./engine');
          const { generateOverlayPdf } = await import('./engine/pdfOverlay');
          const path = await import('path');
          
          const def = await resolveForm('mi_dc_100a_demand_possession_nonpayment');
          const outputMode = def.outputTemplate?.mode;
          
          if (outputMode === 'official_pdf_overlay' && def.outputTemplate?.basePdfAttachmentPath) {
            const mappedInputs: Record<string, string | number | boolean> = {};
            
            mappedInputs['plaintiff_name'] = String(fieldValues.landlordName || fieldValues.plaintiff_name || '');
            mappedInputs['plaintiff_address'] = String(fieldValues.landlordAddress || fieldValues.plaintiff_address || '');
            mappedInputs['plaintiff_city_state_zip'] = String(fieldValues.plaintiff_city_state_zip || '');
            mappedInputs['plaintiff_phone'] = String(fieldValues.landlordPhone || fieldValues.plaintiff_phone || '');
            mappedInputs['defendant_name'] = String(fieldValues.tenantName || fieldValues.defendant_name || '');
            mappedInputs['defendant_address'] = String(fieldValues.propertyAddress || fieldValues.defendant_address || '');
            mappedInputs['defendant_city_state_zip'] = String(fieldValues.defendant_city_state_zip || '');
            mappedInputs['premises_address'] = String(fieldValues.propertyAddress || fieldValues.premises_address || '');
            mappedInputs['premises_city'] = String(fieldValues.propertyCity || fieldValues.premises_city || '');
            mappedInputs['premises_county'] = String(fieldValues.premises_county || '');
            mappedInputs['rent_amount_due'] = String(fieldValues.amountDue || fieldValues.rent_amount_due || '');
            mappedInputs['rent_period_from'] = String(fieldValues.rentDueDate || fieldValues.rent_period_from || '');
            mappedInputs['rent_period_to'] = String(fieldValues.rent_period_to || '');
            mappedInputs['monthly_rent_amount'] = String(fieldValues.monthly_rent_amount || '');
            mappedInputs['service_date'] = String(fieldValues.noticeDate || fieldValues.service_date || '');
            mappedInputs['server_name'] = String(fieldValues.server_name || '');
            mappedInputs['plaintiff_name_print'] = mappedInputs['plaintiff_name'];
            mappedInputs['plaintiff_phone_sig'] = mappedInputs['plaintiff_phone'];
            mappedInputs['plaintiff_address_sig'] = mappedInputs['plaintiff_address'] + (mappedInputs['plaintiff_city_state_zip'] ? ', ' + mappedInputs['plaintiff_city_state_zip'] : '');
            mappedInputs['signature_date'] = mappedInputs['service_date'];

            const serviceSelection: Record<string, boolean> = {};
            const serviceMethod = String(fieldValues.serviceMethod || '').toLowerCase();
            for (const rule of def.serviceRules) {
              const methodKey = rule.methodKey || '';
              if (serviceMethod.includes('personal') && methodKey === 'personal') serviceSelection[rule.methodId] = true;
              else if (serviceMethod.includes('mail') && !serviceMethod.includes('tack') && methodKey === 'first_class_mail') serviceSelection[rule.methodId] = true;
              else if ((serviceMethod.includes('tack') || serviceMethod.includes('post')) && methodKey === 'posting') serviceSelection[rule.methodId] = true;
            }

            const overlayData = getOverlayData({ def, inputs: mappedInputs, serviceSelection, dateCalc: null });
            const basePdfPath = path.resolve(process.cwd(), def.outputTemplate.basePdfAttachmentPath);
            const pdfBuffer = await generateOverlayPdf(basePdfPath, overlayData);

            const safeFilename = template.title.replace(/[^a-z0-9]/gi, '_');
            assertLooksLikePdf(pdfBuffer);
            return sendBinaryDownload(res, {
              buffer: pdfBuffer,
              filename: `${safeFilename}.pdf`,
              contentType: CONTENT_TYPES.PDF,
            });
          }
        } catch (overlayErr: any) {
          console.warn('[DocumentGenerate] Overlay PDF failed, falling back to HTML generation:', overlayErr.message);
        }
      }

      // Import document generators
      const { generateDocument, generateDocumentDOCX } = await import('./utils/documentGenerator');
      const { generateLeaseAgreementDocx, generateLeaseAgreementPdf } = await import('./utils/leaseAgreementGenerator');

      const generationOptions = {
        templateTitle: template.title,
        templateContent: '', // Always empty - use default generation only
        fieldValues,
        stateId: template.stateId,
        version: template.version || 1,
        updatedAt: template.updatedAt || new Date(),
        landlordInfo,
      };

      // Check if this is a lease agreement template
      const isLeaseAgreement = template.title.toLowerCase().includes('lease') || 
                               template.title.toLowerCase().includes('rental agreement');

      const safeFilename = template.title.replace(/[^a-z0-9]/gi, '_');
      
      if (format === 'docx') {
        let docxBuffer: Buffer;
        
        if (isLeaseAgreement) {
          // Use specialized lease generator for cleaner DOCX output
          docxBuffer = await generateLeaseAgreementDocx({
            templateTitle: template.title,
            stateId: template.stateId,
            fieldValues,
            version: template.version || 1,
            updatedAt: template.updatedAt || new Date(),
            landlordInfo,
          });
        } else {
          docxBuffer = await generateDocumentDOCX(generationOptions);
        }
        
        await assertValidDocx(docxBuffer);
        sendBinaryDownload(res, {
          buffer: docxBuffer,
          filename: `${safeFilename}.docx`,
          contentType: CONTENT_TYPES.DOCX,
        });
      } else {
        // Generate PDF (default)
        let pdfBuffer: Buffer;
        
        if (isLeaseAgreement) {
          // Use specialized lease generator for consistent PDF/DOCX output
          pdfBuffer = await generateLeaseAgreementPdf({
            templateTitle: template.title,
            stateId: template.stateId,
            fieldValues,
            version: template.version || 1,
            updatedAt: template.updatedAt || new Date(),
            landlordInfo,
          });
        } else {
          pdfBuffer = await generateDocument(generationOptions);
        }
        
        assertLooksLikePdf(pdfBuffer);
        sendBinaryDownload(res, {
          buffer: pdfBuffer,
          filename: `${safeFilename}.pdf`,
          contentType: CONTENT_TYPES.PDF,
        });
      }
    } catch (error: any) {
      console.error('Document generation error:', error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  // ==========================================
  // LEGISLATIVE MONITORING & TEMPLATE REVIEW
  // ==========================================

  // Get all monitored bills (admin only)
  app.get('/api/admin/legislative-bills', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);

      if (!user?.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const filters: any = {};
      if (req.query.stateId) filters.stateId = req.query.stateId as string;
      if (req.query.relevanceLevel) filters.relevanceLevel = req.query.relevanceLevel as string;
      if (req.query.isReviewed !== undefined) filters.isReviewed = req.query.isReviewed === 'true';

      const bills = await storage.getAllLegislativeMonitoring(filters);
      res.json(bills);
    } catch (error) {
      console.error('Error fetching legislative bills:', error);
      res.status(500).json({ message: 'Failed to fetch bills' });
    }
  });

  // Dismiss/review a pending bill (admin only)
  app.patch('/api/admin/legislative-bills/:id/dismiss', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);

      if (!user?.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const { id } = req.params;
      const { reviewNotes } = req.body;

      await storage.updateLegislativeMonitoring(id, {
        isReviewed: true,
        reviewedBy: userId,
        reviewedAt: new Date(),
        reviewNotes: reviewNotes || 'Dismissed by admin - no template updates needed',
      });

      res.json({ success: true, message: 'Bill dismissed' });
    } catch (error) {
      console.error('Error dismissing bill:', error);
      res.status(500).json({ message: 'Failed to dismiss bill' });
    }
  });

  // Approve a bill and queue template updates with AI-drafted changes (admin only)
  app.patch('/api/admin/legislative-bills/:id/approve', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);

      if (!user?.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const { id } = req.params;
      
      // Get the bill to find affected templates
      const bill = await storage.getLegislativeMonitoringByBillId(id);
      if (!bill) {
        return res.status(404).json({ message: 'Bill not found' });
      }

      // Queue template reviews with AI-drafted clause changes
      let templatesQueued = 0;
      const draftResults: Array<{ templateId: string; changeSummary: string; draftedClause: string }> = [];
      
      if (bill.affectedTemplateIds && bill.affectedTemplateIds.length > 0) {
        const { billAnalysisService } = await import('./billAnalysisService');
        
        for (const templateId of bill.affectedTemplateIds) {
          // Check if a review already exists for this bill+template
          const existing = await db.query.templateReviewQueue.findFirst({
            where: (table, { eq, and }) => and(
              eq(table.billId, id),
              eq(table.templateId, templateId)
            ),
          });
          
          if (!existing) {
            // Get template details for AI drafting
            const template = await storage.getTemplate(templateId);
            
            let draftedChanges: {
              draftedClause: string;
              clauseLocation: string;
              beforeText: string;
              afterText: string;
              changeType: string;
              changeSummary: string;
              legalReference: string;
            } = {
              draftedClause: 'Review bill for potential template changes',
              clauseLocation: '',
              beforeText: '',
              afterText: '',
              changeType: 'other',
              changeSummary: 'Manual review required',
              legalReference: '',
            };
            
            // Generate AI-drafted clause changes
            if (template) {
              try {
                const aiDraft = await billAnalysisService.generateDraftClauseChanges(
                  template.title,
                  template.description || '',
                  template.templateType,
                  template.stateId,
                  bill.billNumber || '',
                  bill.title,
                  bill.description || '',
                  bill.aiAnalysis || ''
                );
                draftedChanges = {
                  draftedClause: aiDraft.draftedClause,
                  clauseLocation: aiDraft.clauseLocation,
                  beforeText: aiDraft.beforeText,
                  afterText: aiDraft.afterText,
                  changeType: aiDraft.changeType,
                  changeSummary: aiDraft.changeSummary,
                  legalReference: aiDraft.legalReference,
                };
              } catch (draftError) {
                console.error('Error generating draft for template:', templateId, draftError);
              }
            }
            
            // Store the drafted changes as JSON in recommendedChanges
            const recommendedChangesJson = JSON.stringify(draftedChanges);
            
            const { templateReviewQueue } = await import('@shared/schema');
            await db.insert(templateReviewQueue).values({
              templateId,
              billId: id,
              reason: `Legislative update: ${bill.billNumber} - ${bill.title}`,
              recommendedChanges: recommendedChangesJson,
              status: 'pending', // Pending admin approval of draft
              queuedAt: new Date(),
            });
            
            templatesQueued++;
            draftResults.push({
              templateId,
              changeSummary: draftedChanges.changeSummary,
              draftedClause: draftedChanges.draftedClause.substring(0, 200) + '...',
            });
          }
        }
      }

      // Mark the bill as reviewed
      await storage.updateLegislativeMonitoring(id, {
        isReviewed: true,
        reviewedBy: userId,
        reviewedAt: new Date(),
        reviewNotes: `Approved by admin - ${templatesQueued} template drafts created`,
      });

      res.json({ 
        success: true, 
        message: `Bill approved - ${templatesQueued} template drafts created for review`,
        templatesQueued,
        drafts: draftResults,
      });
    } catch (error) {
      console.error('Error approving bill:', error);
      res.status(500).json({ message: 'Failed to approve bill' });
    }
  });

  // Get all monitored case law (admin only)
  // Get case law for authenticated users (filtered by relevance and state)
  app.get('/api/case-law', isAuthenticated, async (req: any, res) => {
    try {
      const { stateId } = req.query;
      if (!stateId) {
        return res.status(400).json({ message: "stateId required" });
      }
      
      let cases;
      if (stateId === 'NATIONAL') {
        cases = await db.query.caseLawMonitoring.findMany({
          where: (table) => eq(table.isMonitored, true),
          limit: 100,
          orderBy: (table) => [desc(table.dateFiled)],
        });
      } else {
        cases = await db.query.caseLawMonitoring.findMany({
          where: (table, { eq, and }) => and(
            eq(table.stateId, stateId as string),
            eq(table.isMonitored, true),
          ),
          limit: 50,
          orderBy: (table) => [desc(table.dateFiled)],
        });
      }

      // Filter to only high/medium relevance cases for user display
      const relevantCases = cases.filter(c => c.relevanceLevel === 'high' || c.relevanceLevel === 'medium');
      res.json(relevantCases);
    } catch (error) {
      console.error('Error fetching case law:', error);
      res.status(500).json({ message: 'Failed to fetch case law' });
    }
  });

  app.get('/api/admin/case-law', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);

      if (!user?.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const filters: any = {};
      if (req.query.stateId) filters.stateId = req.query.stateId as string;
      if (req.query.relevanceLevel) filters.relevanceLevel = req.query.relevanceLevel as string;
      if (req.query.isReviewed !== undefined) filters.isReviewed = req.query.isReviewed === 'true';

      const cases = await storage.getAllCaseLawMonitoring(filters);
      res.json(cases);
    } catch (error) {
      console.error('Error fetching case law:', error);
      res.status(500).json({ message: 'Failed to fetch case law' });
    }
  });

  // Test CourtListener API (admin only) - for debugging
  app.get('/api/admin/case-law/test', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);

      if (!user?.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const stateId = (req.query.stateId as string) || 'UT';
      const daysBack = parseInt(req.query.daysBack as string) || 60;

      const { courtListenerService } = await import('./courtListenerService');
      
      console.log(`🧪 Testing CourtListener API for ${stateId} (${daysBack} days back)`);
      const results = await courtListenerService.searchCases(stateId, [], daysBack);

      if (!results) {
        return res.json({
          success: false,
          message: 'CourtListener API returned no results (check API key)',
          stateId,
          daysBack,
          apiKeySet: !!process.env.COURTLISTENER_API_KEY,
        });
      }

      res.json({
        success: true,
        stateId,
        daysBack,
        totalCount: results.meta.total_count,
        resultsReturned: results.results.length,
        cases: results.results.slice(0, 5).map(c => ({
          id: c.id,
          caseName: c.case_name,
          dateFiled: c.date_filed,
          court: c.court,
        })),
      });
    } catch (error) {
      console.error('Error testing CourtListener:', error);
      res.status(500).json({ message: 'Failed to test CourtListener API', error: String(error) });
    }
  });

  app.post('/api/admin/case-law/refresh', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const daysBack = parseInt(req.query.daysBack as string) || 180;
      const stateId = req.query.stateId as string | undefined;

      const { courtListenerService } = await import('./courtListenerService');
      
      console.log(`⚖️ Admin triggered case law refresh (daysBack=${daysBack}, state=${stateId || 'all'})`);
      const result = await courtListenerService.refreshCaseLaw({
        daysBack,
        states: stateId ? [stateId] : undefined,
      });

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      console.error('Error refreshing case law:', error);
      res.status(500).json({ message: 'Failed to refresh case law', error: String(error) });
    }
  });

  // Approve a template update (admin only)
  app.post('/api/admin/template-review/:id/approve', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);

      if (!user?.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const { id } = req.params;
      const { approvalNotes } = req.body;

      // Update review status to approved
      const review = await storage.updateTemplateReviewQueue(id, {
        status: 'approved',
        approvalNotes: approvalNotes || 'Approved by admin',
        approvedAt: new Date(),
      });

      // Publish the template update automatically
      const template = await storage.getTemplate(review.templateId);
      if (!template) {
        return res.status(404).json({ message: 'Template not found' });
      }

      // Mark the originating bill as reviewed
      if (review.billId) {
        await storage.updateLegislativeMonitoring(review.billId, {
          isReviewed: true,
          reviewedBy: userId,
          reviewedAt: new Date(),
          reviewNotes: `Approved template update for ${template.title}`,
        });
      }

      const publishResult = await storage.publishTemplateUpdate({
        templateId: review.templateId,
        reviewId: id,
        versionNotes: review.recommendedChanges || 'Legislative update',
        lastUpdateReason: review.reason,
        publishedBy: userId,
      });

      // Notify affected users
      await notifyUsersOfTemplateUpdate(publishResult.template, publishResult.version);

      res.json({
        success: true,
        message: 'Template update approved and published',
        template: publishResult.template,
        version: publishResult.version,
      });
    } catch (error) {
      console.error('Error approving template update:', error);
      res.status(500).json({ message: 'Failed to approve update' });
    }
  });

  // Reject a template update (admin only)
  app.post('/api/admin/template-review/:id/reject', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);

      if (!user?.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const { id } = req.params;
      const { rejectionNotes } = req.body;

      const review = await storage.updateTemplateReviewQueue(id, {
        status: 'rejected',
        approvalNotes: rejectionNotes || 'Rejected by admin - no changes needed',
        rejectedAt: new Date(),
      });

      // Mark the originating bill as reviewed
      if (review.billId) {
        await storage.updateLegislativeMonitoring(review.billId, {
          isReviewed: true,
          reviewedBy: userId,
          reviewedAt: new Date(),
          reviewNotes: `Rejected template update for template ${review.templateId}: ${rejectionNotes || 'No changes needed'}`,
        });
      }

      res.json({
        success: true,
        message: 'Template update rejected',
        review,
      });
    } catch (error) {
      console.error('Error rejecting template update:', error);
      res.status(500).json({ message: 'Failed to reject update' });
    }
  });

  // Get monitoring run history (admin only)
  app.get('/api/admin/monitoring-runs', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);

      if (!user?.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const runs = await storage.getRecentMonitoringRuns(limit);
      res.json(runs);
    } catch (error) {
      console.error('Error fetching monitoring runs:', error);
      res.status(500).json({ message: 'Failed to fetch runs' });
    }
  });

  // Get last successful monitoring run (admin only)
  app.get('/api/admin/monitoring-status', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);

      if (!user?.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const { getLockStatus } = await import('./utils/jobLock');
      const lockStatus = getLockStatus();

      const lastRun = await storage.getLastSuccessfulMonitoringRun();
      const hasRunThisMonth = await storage.hasMonitoringRunThisMonth();
      
      res.json({
        lastRun: lastRun || null,
        hasRunThisMonth,
        nextScheduledDay: 1, // Runs on the 1st of each month
        jobInProgress: lockStatus.locked,
        currentJob: lockStatus.job,
        jobStartedAt: lockStatus.since,
      });
    } catch (error) {
      console.error('Error fetching monitoring status:', error);
      res.status(500).json({ message: 'Failed to fetch status' });
    }
  });

  // Legislative Monitoring Orchestrator (admin only)
  // Modes: queueOnly (default), ingestOnly, publishApproved
  // Returns immediately (async job) - poll /api/admin/monitoring-status for progress
  app.post('/api/admin/legislative-monitoring/run', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);

      if (!user?.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const mode = String(req.query.mode || 'queueOnly').toLowerCase();
      const validModes = ['queueonly', 'ingestonly', 'publishapproved'];
      
      if (!validModes.includes(mode)) {
        return res.status(400).json({
          success: false,
          error: `Invalid mode "${mode}". Valid modes: queueOnly, ingestOnly, publishApproved`,
        });
      }

      const { tryAcquireLock, releaseLock, getLockStatus } = await import('./utils/jobLock');
      
      // Try to acquire lock synchronously before responding
      const lockAcquired = tryAcquireLock('legislative-monitoring');
      
      if (!lockAcquired) {
        const lockStatus = getLockStatus();
        return res.status(409).json({
          success: false,
          error: 'A monitoring job is already running',
          currentJob: lockStatus.job,
          lockedSince: lockStatus.since,
        });
      }

      // Lock acquired - wrap everything in try/catch to ensure lock release on failure
      let legislativeMonitoringService: any;
      try {
        const module = await import('./legislativeMonitoringService');
        legislativeMonitoringService = module.legislativeMonitoringService;
      } catch (importErr) {
        releaseLock('legislative-monitoring');
        throw importErr;
      }

      console.log(`📋 Legislative monitoring run triggered by ${user.email} (mode: ${mode})`);

      // Run job in background (lock already acquired)
      (async () => {
        try {
          if (mode === 'ingestonly') {
            await legislativeMonitoringService.ingestNow();
            return;
          }

          if (mode === 'publishapproved') {
            await legislativeMonitoringService.ingestNow();
            await legislativeMonitoringService.publishApproved();
            return;
          }

          // Default: queueOnly (safe)
          await legislativeMonitoringService.ingestNow();
          await legislativeMonitoringService.queueFromLatestIngest();
        } catch (err) {
          console.error('Background monitoring job failed:', err);
        } finally {
          releaseLock('legislative-monitoring');
        }
      })();

      // Return immediately - lock is confirmed acquired
      return res.json({ 
        success: true, 
        mode, 
        message: 'Monitoring job started. Poll /api/admin/monitoring-status to track progress.',
        async: true,
      });
    } catch (err: any) {
      // Ensure lock is released if we somehow get here with lock held
      const { releaseLock } = await import('./utils/jobLock');
      releaseLock('legislative-monitoring');
      console.error('Error starting legislative monitoring run:', err);
      return res.status(500).json({ 
        success: false, 
        error: err?.message || 'Unknown error',
      });
    }
  });

  // Re-analyze existing bills to populate compliance categories (admin only)
  app.post('/api/admin/legislative-monitoring/reanalyze', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);

      if (!user?.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      console.log('🔄 Re-analyzing existing bills for compliance categories...');
      
      // Get all bills that don't have compliance categories
      const allBills = await storage.getAllLegislativeMonitoring({});
      const billsToReanalyze = allBills.filter(b => 
        !b.affectedComplianceCategories || b.affectedComplianceCategories.length === 0
      );

      console.log(`Found ${billsToReanalyze.length} bills to re-analyze`);

      // Import the analysis service
      const { BillAnalysisService } = await import('./billAnalysisService');
      const analysisService = new BillAnalysisService();

      let updated = 0;
      for (const bill of billsToReanalyze) {
        try {
          // Use fallback analysis (faster, no API calls)
          // Safely build analysis text with null-guarding
          const text = [
            bill.title || '',
            bill.description || '',
            bill.aiAnalysis || ''
          ].join(' ').toLowerCase();
          
          const categoryKeywords: Record<string, string[]> = {
            rent_increases: [
              'rent increase', 'rent control', 'rent cap', 'rent stabilization',
              'rent limit', 'rental increase', 'rent notice', 'rent raise',
              'tenant protection act', 'just cause', 'rent regulation',
            ],
            deposits: [
              'security deposit', 'deposit return', 'deposit limit', 'deposit refund',
            ],
            evictions: [
              'eviction', 'unlawful detainer', 'lease termination', 'notice to quit',
              'eviction moratorium', 'eviction protection',
            ],
            disclosures: [
              'disclosure', 'lead paint', 'mold disclosure', 'bed bug',
            ],
            fair_housing: [
              'fair housing', 'discrimination', 'protected class', 'source of income',
              'housing discrimination', 'reasonable accommodation',
            ],
          };

          const affectedCategories: string[] = [];
          for (const [category, keywords] of Object.entries(categoryKeywords)) {
            if (keywords.some(k => text.includes(k))) {
              affectedCategories.push(category);
            }
          }

          if (affectedCategories.length > 0) {
            // Use bill.id (primary key) not bill.billId (source system ID)
            await storage.updateLegislativeMonitoring(bill.id, {
              affectedComplianceCategories: affectedCategories,
            });
            updated++;
            console.log(`  Updated ${bill.billNumber}: ${affectedCategories.join(', ')}`);
          }
        } catch (err) {
          console.error(`Error re-analyzing bill ${bill.id}:`, err);
        }
      }

      console.log(`✅ Re-analysis complete. Updated ${updated} bills with compliance categories.`);

      return res.json({
        success: true,
        message: `Re-analyzed ${billsToReanalyze.length} bills, updated ${updated} with compliance categories`,
        analyzed: billsToReanalyze.length,
        updated,
      });
    } catch (error) {
      console.error('Error re-analyzing bills:', error);
      return res.status(500).json({ 
        success: false,
        message: "Something went wrong. Please try again."
      });
    }
  });

  // Ingest only endpoint (admin only) - with job lock
  app.post('/api/admin/legislative-monitoring/ingest', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);

      if (!user?.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      console.log('🌙 Ingest triggered by admin:', user.email);
      
      const { withJobLock } = await import('./utils/jobLock');
      const { legislativeMonitoringService } = await import('./legislativeMonitoringService');

      const result = await withJobLock('legislative-monitoring', async () => {
        return await legislativeMonitoringService.ingestNow();
      });

      return res.json({ success: true, result });
    } catch (err: any) {
      console.error('Error running legislative ingest:', err);
      const status = err?.status || 500;
      return res.status(status).json({ 
        success: false, 
        error: err?.message || 'Unknown error',
        currentJob: err?.currentJob,
        lockedSince: err?.lockedSince,
      });
    }
  });

  // Publish approved only endpoint (admin only) - with job lock and approval gate
  app.post('/api/admin/legislative-monitoring/publish', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);

      if (!user?.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      console.log('📦 Publish approved triggered by admin:', user.email);
      
      const { withJobLock } = await import('./utils/jobLock');
      const { legislativeMonitoringService } = await import('./legislativeMonitoringService');

      const result = await withJobLock('legislative-monitoring', async () => {
        return await legislativeMonitoringService.publishApproved();
      });

      return res.json({ success: true, result });
    } catch (err: any) {
      console.error('Error running legislative publish:', err);
      const status = err?.status || 500;
      return res.status(status).json({ 
        success: false, 
        error: err?.message || 'Unknown error',
        currentJob: err?.currentJob,
        lockedSince: err?.lockedSince,
      });
    }
  });

  // Get legislative source status (admin only)
  app.get('/api/admin/legislative-sources', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);

      if (!user?.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const { legislationSources, sourceRuns, releaseBatches } = await import('@shared/schema');
      const { db } = await import('./db');
      const { desc, eq } = await import('drizzle-orm');

      const sources = await db.select().from(legislationSources);
      const recentRuns = await db.select()
        .from(sourceRuns)
        .orderBy(desc(sourceRuns.startedAt))
        .limit(50);
      const recentBatches = await db.select()
        .from(releaseBatches)
        .orderBy(desc(releaseBatches.startedAt))
        .limit(10);

      return res.json({
        sources,
        recentRuns,
        recentBatches,
      });
    } catch (error) {
      console.error('Error fetching legislative sources:', error);
      return res.status(500).json({ message: 'Failed to fetch sources' });
    }
  });

  // Automated cron endpoint for legislative monitoring (protected by secret key)
  app.post('/api/cron/legislative-monitoring', async (req, res) => {
    try {
      // Verify cron secret to prevent unauthorized triggers
      const cronSecret = req.headers['x-cron-secret'];
      const expectedSecret = process.env.CRON_SECRET || 'dev-secret-change-in-production';
      
      if (cronSecret !== expectedSecret) {
        console.warn('⚠️ Unauthorized cron attempt - invalid secret');
        return res.status(401).json({ message: 'Unauthorized' });
      }

      console.log('🔄 Running scheduled legislative monitoring...');
      
      const { legislativeMonitoringService } = await import('./legislativeMonitoringService');
      legislativeMonitoringService.runMonthlyMonitoring().catch(err => {
        console.error('Background cron monitoring error:', err);
      });

      console.log('✅ Scheduled monitoring started');
      return res.json({
        success: true,
        message: 'Scheduled monitoring started',
      });
    } catch (error) {
      console.error('❌ Cron monitoring failed:', error);
      return res.status(500).json({ 
        success: false,
        message: "Something went wrong. Please try again."
      });
    }
  });

  // Credit Report Helper - explain credit terms using AI
  app.post('/api/explain-credit-term', isAuthenticated, requireAccess, asyncHandler(async (req, res) => {
    // Rate limiting (same as chat)
    const clientIp = getClientIp(req);
    if (!chatRateLimiter.check(clientIp)) {
      return res.status(429).json({
        explanation: "You're asking questions too quickly. Please wait a moment and try again."
      });
    }

    const { term } = req.body;

    if (!term || typeof term !== 'string') {
      return res.status(400).json({ 
        explanation: "Please provide a valid credit report term." 
      });
    }

    const trimmedTerm = term.trim();

    // Privacy and safety checks
    // Block Social Security Numbers (various formats)
    if (/\b\d{3}-\d{2}-\d{4}\b/.test(trimmedTerm) || 
        /\b\d{9}\b/.test(trimmedTerm) ||
        /\bssn\b/i.test(trimmedTerm)) {
      return res.json({
        explanation: "For your safety, please do not enter Social Security numbers or personal identifiers. Just type the WORD or PHRASE you'd like explained (for example: 'charge-off' or 'collection')."
      });
    }

    // Block long numbers that look like account numbers (10+ consecutive digits)
    if (/\d{10,}/.test(trimmedTerm)) {
      return res.json({
        explanation: "This looks like an account number. For privacy reasons, please remove specific account numbers before submitting."
      });
    }

    // Length check - allow longer inputs for multi-item credit analysis
    if (trimmedTerm.length > 2000) {
      return res.status(400).json({ 
        explanation: "Please keep your input under 2000 characters. You can describe multiple credit items but try to be concise." 
      });
    }

    // Get user's preferred state for state-specific notes
    const userId = getUserId(req);
    let userState: string | null = null;
    let userStateName: string | null = null;
    if (userId) {
      const user = await storage.getUser(userId);
      if (user?.preferredState) {
        userState = user.preferredState;
        const stateNames: Record<string, string> = {
          UT: "Utah", TX: "Texas", ND: "North Dakota", SD: "South Dakota", NC: "North Carolina",
          OH: "Ohio", MI: "Michigan", ID: "Idaho", WY: "Wyoming", CA: "California",
          VA: "Virginia", NV: "Nevada", AZ: "Arizona", FL: "Florida", IL: "Illinois",
        };
        userStateName = stateNames[userState] || userState;
      }
    }

    try {
      // Import state law helpers and caution level detector
      const { classifyTopic } = await import('./decoders/topicClassifier');
      const { isStateSpecificQuestion, extractStateFromQuestion, shouldTriggerStateLawFallback, STATE_LAW_FALLBACK_TEXT } = await import('./decoders/stateLawFallback');
      const { detectCautionLevel, getFieldGuide, formatFieldGuideForPrompt, getSafeFollowUps } = await import('./decoders/cautionLevelDetector');

      // Classify topic for potential state note lookup
      const topicMatch = await classifyTopic(trimmedTerm, 'credit', openai);
      
      // Detect caution level based on keywords in the question
      const cautionResult = detectCautionLevel(trimmedTerm, 'credit');
      
      // Get field reference guide for this topic
      const fieldGuide = getFieldGuide(topicMatch?.topic || null, 'credit');
      const fieldGuideText = formatFieldGuideForPrompt(fieldGuide);
      
      // Get safe follow-up questions
      const followUps = getSafeFollowUps('credit');
      
      // Check if question references state law or mentions specific state
      const asksAboutStateLaw = isStateSpecificQuestion(trimmedTerm);
      const mentionedState = extractStateFromQuestion(trimmedTerm);
      
      // Determine which state to use for snippet lookup
      const lookupState = mentionedState || userState;
      
      // Fetch vetted state note if we have a topic and state
      let stateNote = null;
      let fallbackText = null;
      if (lookupState && topicMatch) {
        stateNote = await storage.getApprovedStateNote(lookupState, 'credit', topicMatch.topic);
      }
      
      // Determine if fallback is needed using full fallback logic
      if (shouldTriggerStateLawFallback(trimmedTerm, stateNote, topicMatch)) {
        fallbackText = STATE_LAW_FALLBACK_TEXT;
      }

      // Build tone guidance based on caution level
      const toneInstruction = cautionResult.level === 'high' 
        ? 'IMPORTANT: This appears to be a higher-risk situation based on the keywords detected. Be direct about potential concerns while remaining balanced. Include a clear caution note in "What This Does NOT Mean".'
        : cautionResult.level === 'medium'
        ? 'This appears to be a moderate concern. Be balanced - acknowledge the risk signal while providing context. Include appropriate caution in "What This Does NOT Mean".'
        : 'This appears to be a routine inquiry. Provide helpful context while maintaining professional balance.';

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a helpful assistant that explains credit report information to landlords reviewing tenant applications. You help them UNDERSTAND, not DECIDE. You never recommend approving or denying - you inform.

CAUTION LEVEL FOR THIS QUESTION: ${cautionResult.level.toUpperCase()}
${toneInstruction}
${cautionResult.triggers.length > 0 ? `Detected keywords: ${cautionResult.triggers.slice(0, 5).join(', ')}` : ''}

STATE-SPECIFIC LAW GUARDRAILS:
- Do NOT generate or infer state or local laws.
- Do NOT include a "State-Specific Notes" section - state-specific guidance will be provided separately by the system.
- If the user asks about a specific state or local law, do NOT attempt to explain it.
- Focus only on explaining the credit item itself in general terms.

${fieldGuideText}

REQUIRED RESPONSE STRUCTURE (use these exact headers):

**WHAT THIS MEANS**
[2-3 sentences in plain English explaining what this credit item is and why it appears on reports. Be specific about what landlords should look at on the report.]

**WHERE TO LOOK ON YOUR REPORT**
• [Reference the specific field name from the guide above and what to look for]
• [Another field and what it tells you]
• [Include the general tip about patterns]

**HOW LANDLORDS TYPICALLY WEIGH THIS**
Factors that increase weight:
• [Factor that makes this more concerning - e.g., recency, amount, multiple occurrences]
• [Another factor - be specific about what to look for on the report]
Factors that reduce weight:
• [Factor that makes this less concerning - e.g., age, medical-related, evidence of recovery]
• [Another factor]

**WHAT THIS DOES NOT MEAN**
${cautionResult.level === 'high' ? `• CAUTION: ${cautionResult.toneGuidance}
• This doesn't automatically require denial, but this pattern is a real risk flag—don't ignore it
• [Specific clarification based on the credit item]
• Apply your written criteria consistently to reduce fair-housing risk` : 
cautionResult.level === 'medium' ? `• This is a real risk flag—don't ignore it, but context matters
• [Clarification to prevent over-reaction while acknowledging the concern]
• Apply your written criteria consistently to reduce fair-housing risk` :
`• [Clarification to prevent over-reaction - e.g., "Does not automatically mean they will miss rent"]
• [Another clarification - e.g., "Older items may have limited relevance"]
• Apply your written criteria consistently`}

**COMMON SCREENING APPROACHES**
• Some landlords require higher income ratios when this appears
• Some landlords allow a qualified co-signer to offset credit risk
• Some landlords apply stricter criteria only if the item is recent
• [Add 1-2 more relevant approaches based on the specific item]

**CONSISTENCY CHECK**
Before relying on this information, confirm that:
• This factor is addressed in your written screening criteria
• You apply the same standards to all applicants
• Any exceptions are documented consistently
• You have not made exceptions based on protected characteristics

**DOCUMENTATION HELPER**
Neutral language (use whether approving or denying):
"Application reviewed using standard screening criteria. Credit report reflects [item type] dated [MM/YYYY]. Applicant was evaluated using the same criteria applied to all applicants."

**OPTIONAL FOLLOW-UP QUESTIONS**
1. "[Conversational question about context]"
2. "[Question about what's changed since]"
3. "[Question about current stability]"

**WHAT LANDLORDS OFTEN CONSIDER NEXT**
• Review your written screening criteria to confirm this factor is addressed
• Compare to your established thresholds (income ratio, credit score minimum, etc.)
• If uncertain, document your reasoning before making any decision
• Consider whether the applicant's current situation differs from the past

CRITICAL RULES:
- NEVER say "approve" or "deny" - you inform, landlords decide
- Use "Some landlords..." phrasing for actions - describe industry behavior, don't prescribe
- Always include the "What This Does NOT Mean" section to prevent over-reaction
- Always include the Consistency Check - this is critical for Fair Housing compliance
- Use bullet points and short sentences - easy to scan quickly
- Be balanced - risks AND context that reduces weight
- NEVER generate state-specific legal content

TONE: Calm, structured, and confidence-building. Help landlords feel informed and capable, not anxious. You are a knowledgeable colleague who explains things simply and reassures them that understanding this is straightforward. Avoid alarm language. Use phrases like "This is common" and "Many landlords handle this by..." Premium and legally sophisticated, but accessible.`
          },
          {
            role: "user",
            content: `Explain this credit report information for a landlord: "${trimmedTerm}"`
          }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      const explanation = completion.choices[0]?.message?.content || 
        "I couldn't generate an explanation. Please try rephrasing your question.";

      // Track credit helper usage
      if (userId) {
        await storage.trackEvent({
          userId,
          eventType: 'credit_helper_use',
          eventData: { termLength: trimmedTerm.length, cautionLevel: cautionResult.level },
        });
      }

      res.json({ 
        explanation,
        userState: userState || null,
        userStateName: userStateName || null,
        stateNote: stateNote || null,
        fallbackText: fallbackText || null,
        classifiedTopic: topicMatch?.topic || null,
        cautionLevel: cautionResult.level,
        followUpQuestions: followUps.slice(0, 3).map(f => ({
          question: f.question,
          yesImplication: f.yesImplication,
          noImplication: f.noImplication
        })),
      });
    } catch (error) {
      console.error('Error explaining credit term:', error);
      res.status(500).json({
        explanation: "Sorry, something went wrong. Please try again in a moment."
      });
    }
  }));

  // Criminal & Eviction Screening Helper - explain terms using AI
  app.post('/api/explain-criminal-eviction-term', isAuthenticated, requireAccess, asyncHandler(async (req, res) => {
    // Rate limiting (same as chat and credit helper)
    const clientIp = getClientIp(req);
    if (!chatRateLimiter.check(clientIp)) {
      return res.status(429).json({
        explanation: "You're asking questions too quickly. Please wait a moment and try again."
      });
    }

    const { term } = req.body;

    if (!term || typeof term !== 'string') {
      return res.status(400).json({ 
        explanation: "Please provide a valid term or question." 
      });
    }

    const trimmedTerm = term.trim();

    // Privacy and safety checks
    // Block Social Security Numbers (XXX-XX-XXXX format or 9 consecutive digits NOT in date format)
    // SSN format: 3 digits, hyphen, 2 digits, hyphen, 4 digits
    if (/\b\d{3}-\d{2}-\d{4}\b/.test(trimmedTerm) || 
        /\bssn\b/i.test(trimmedTerm)) {
      return res.json({
        explanation: "For your safety, please do not enter Social Security numbers or personal identifiers. Just type the term or concept you'd like explained (for example: 'felony' or 'eviction record')."
      });
    }
    
    // Check for 9 consecutive digits that are NOT dates (MMDDYYYY or similar)
    // Remove dates (MM/DD/YYYY, MM-DD-YYYY) before checking for long number sequences
    const textWithoutDates = trimmedTerm.replace(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g, '');
    // Also remove statute numbers like "76-6-301" which are legal codes, not personal info
    const textWithoutStatutes = textWithoutDates.replace(/\b\d{1,3}-\d{1,3}-\d{1,4}\b/g, '');
    // Check for remaining 9+ consecutive digits that could be SSNs or account numbers
    if (/\d{9,}/.test(textWithoutStatutes)) {
      return res.json({
        explanation: "This appears to contain a long number that could be a personal identifier. For privacy, please remove any account numbers, case numbers, or other long numeric identifiers."
      });
    }

    // Block specific full names (first + last name patterns like "John Smith" or "Jane Doe")
    // Only block if it looks like a person's name with legal suffixes or in case format
    const namePatterns = [
      /\b[A-Z][a-z]+\s+[A-Z][a-z]+\s+(Jr\.?|Sr\.?|III?|IV)\b/, // Name with suffix
      /\b(defendant|plaintiff|vs\.?|versus)\s+[A-Z][a-z]+/i,    // Legal case name format
    ];
    if (namePatterns.some(pattern => pattern.test(trimmedTerm))) {
      return res.json({
        explanation: "For privacy reasons, please remove specific names before submitting. You can describe the charges/offenses without including names."
      });
    }

    // Length check - allow longer inputs for multi-charge analysis
    if (trimmedTerm.length > 2000) {
      return res.status(400).json({ 
        explanation: "Please keep your input under 2000 characters. You can describe multiple charges but try to be concise." 
      });
    }

    // Get user's preferred state for state-specific notes
    const userId = getUserId(req);
    let userState: string | null = null;
    let userStateName: string | null = null;
    if (userId) {
      const user = await storage.getUser(userId);
      if (user?.preferredState) {
        userState = user.preferredState;
        const stateNames: Record<string, string> = {
          UT: "Utah", TX: "Texas", ND: "North Dakota", SD: "South Dakota", NC: "North Carolina",
          OH: "Ohio", MI: "Michigan", ID: "Idaho", WY: "Wyoming", CA: "California",
          VA: "Virginia", NV: "Nevada", AZ: "Arizona", FL: "Florida", IL: "Illinois",
        };
        userStateName = stateNames[userState] || userState;
      }
    }

    try {
      // Import state law helpers and caution level detector
      const { classifyTopic } = await import('./decoders/topicClassifier');
      const { isStateSpecificQuestion, extractStateFromQuestion, shouldTriggerStateLawFallback, STATE_LAW_FALLBACK_TEXT } = await import('./decoders/stateLawFallback');
      const { detectCautionLevel, getFieldGuide, formatFieldGuideForPrompt, getSafeFollowUps } = await import('./decoders/cautionLevelDetector');

      // Classify topic for potential state note lookup
      const topicMatch = await classifyTopic(trimmedTerm, 'criminal_eviction', openai);
      
      // Detect caution level based on keywords in the question
      const cautionResult = detectCautionLevel(trimmedTerm, 'criminal_eviction');
      
      // Get field reference guide for this topic
      const fieldGuide = getFieldGuide(topicMatch?.topic || null, 'criminal_eviction');
      const fieldGuideText = formatFieldGuideForPrompt(fieldGuide);
      
      // Get safe follow-up questions
      const followUps = getSafeFollowUps('criminal_eviction');
      
      // Check if question references state law or mentions specific state
      const asksAboutStateLaw = isStateSpecificQuestion(trimmedTerm);
      const mentionedState = extractStateFromQuestion(trimmedTerm);
      
      // Determine which state to use for snippet lookup
      const lookupState = mentionedState || userState;
      
      // Fetch vetted state note if we have a topic and state
      let stateNote = null;
      let fallbackText = null;
      if (lookupState && topicMatch) {
        stateNote = await storage.getApprovedStateNote(lookupState, 'criminal_eviction', topicMatch.topic);
      }
      
      // Determine if fallback is needed using full fallback logic
      if (shouldTriggerStateLawFallback(trimmedTerm, stateNote, topicMatch)) {
        fallbackText = STATE_LAW_FALLBACK_TEXT;
      }

      // Build tone guidance based on caution level
      const toneInstruction = cautionResult.level === 'high' 
        ? 'IMPORTANT: This appears to be a higher-risk situation based on the keywords detected (e.g., violent offense, recent record, multiple occurrences). Be direct about potential concerns while remaining balanced. Include a clear caution note in "What This Does NOT Mean". Emphasize individualized assessment is critical.'
        : cautionResult.level === 'medium'
        ? 'This appears to be a moderate concern. Be balanced - acknowledge the significance while providing context about outcomes and rehabilitation. Include appropriate caution in "What This Does NOT Mean".'
        : 'This appears to be a routine inquiry. Provide helpful context while maintaining professional balance.';

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a helpful assistant that explains criminal background and eviction screening findings to landlords. You help them UNDERSTAND, not DECIDE. You never recommend approving or denying - you inform and emphasize individualized assessment.

CAUTION LEVEL FOR THIS QUESTION: ${cautionResult.level.toUpperCase()}
${toneInstruction}
${cautionResult.triggers.length > 0 ? `Detected keywords: ${cautionResult.triggers.slice(0, 5).join(', ')}` : ''}

STATE-SPECIFIC LAW GUARDRAILS:
- Do NOT generate or infer state or local laws.
- Do NOT include a "State-Specific Notes" section - state-specific guidance will be provided separately by the system.
- If the user asks about a specific state or local law, do NOT attempt to explain it.
- Focus only on explaining the criminal/eviction item itself in general terms.

${fieldGuideText}

REQUIRED RESPONSE STRUCTURE (use these exact headers):

**WHAT THIS MEANS**
[2-3 sentences explaining what this criminal/eviction record means. Be specific about what landlords should look at on the record. Note: Criminal and eviction records reflect information from public court sources. Their relevance depends on type, outcome, timing, and behavior since.]

**WHERE TO LOOK ON THE RECORD**
• [Reference the specific field name from the guide above and what to look for]
• [Another field and what it tells you]
• [Include the general tip about outcomes vs filings]

**HOW THIS IS COMMONLY EVALUATED**
Factors that increase weight:
• [Factor - e.g., record is recent, involves violence/property damage, multiple occurrences]
• [Another factor - be specific about what to look for on the record]
Factors that reduce weight:
• [Factor - e.g., record is older, was dismissed, followed by stable housing/employment]
• [Another factor]

**WHAT THIS DOES NOT MEAN**
${cautionResult.level === 'high' ? `• CAUTION: ${cautionResult.toneGuidance}
• A criminal or eviction record does not automatically require denial, but this appears to be a significant concern—individualized assessment is critical
• [Specific clarification based on the record type]
• Apply your written criteria consistently and document your reasoning` : 
cautionResult.level === 'medium' ? `• This is a real consideration—don't ignore it, but context and outcomes matter
• A criminal or eviction record does not automatically require denial
• [Specific clarification based on the record type]
• Apply your written criteria consistently` :
`• A criminal or eviction record does not require denial
• [Specific clarification - e.g., "Arrests without conviction are not equivalent to convictions"]
• Older records may have limited relevance
• Apply your written criteria consistently`}

**COMMON SCREENING APPROACHES**
• Some landlords distinguish between arrests and convictions
• Some landlords focus on completed evictions vs. filings
• Some landlords apply defined look-back periods
• Some landlords place greater emphasis on recent rental references
• Some landlords consider post-event stability more heavily than the event itself

**CONSISTENCY CHECK**
Before relying on criminal or eviction history, confirm that:
• Your written screening criteria address criminal and eviction records
• The same standards are applied to all applicants
• Arrest-only records are not treated the same as convictions
• Eviction filings and judgments are evaluated differently
• Reviews are individualized, not automatic

**DOCUMENTATION HELPER**
Neutral language (use whether approving or denying):
"Application reviewed using standard screening criteria. Public record information reflects prior criminal and/or eviction history dated [MM/YYYY]. The application was evaluated using the same criteria applied to all applicants."

**WHAT LANDLORDS OFTEN CONSIDER NEXT**
• Review your written screening criteria to confirm criminal/eviction records are addressed
• Apply individualized assessment: nature, severity, time elapsed, and relevance to tenancy
• Document your reasoning before making any decision
• Consider evidence of rehabilitation or stable housing since the record

CRITICAL RULES:
- NEVER say "approve" or "deny" - you inform, landlords decide
- Use "Some landlords..." phrasing - describe industry behavior, don't prescribe
- Always emphasize individualized assessment per HUD 2016 guidance
- Always include "What This Does NOT Mean" section with appropriate caution level
- Always include Consistency Check - critical for Fair Housing compliance
- NEVER suggest blanket bans - these violate Fair Housing
- Be balanced - concerns AND context that reduces weight
- NEVER generate state-specific legal content

TONE: Calm, structured, and confidence-building. Help landlords feel informed and capable, not anxious. You are a knowledgeable colleague who explains things simply and reassures them that handling this correctly is straightforward. ${cautionResult.level === 'high' ? 'Be direct about serious concerns while remaining professional.' : 'Avoid alarm language.'} Use phrases like "This is manageable" and "Many landlords approach this by..." Premium and legally sophisticated, but accessible. Focus on Fair Housing.`
          },
          {
            role: "user",
            content: `Explain this criminal/eviction screening information for a landlord: "${trimmedTerm}"`
          }
        ],
        temperature: 0.7,
        max_tokens: 1200,
      });

      const explanation = completion.choices[0]?.message?.content || 
        "I couldn't generate an explanation. Please try rephrasing your question.";

      // Track criminal/eviction helper usage
      if (userId) {
        await storage.trackEvent({
          userId,
          eventType: 'criminal_helper_use',
          eventData: { termLength: trimmedTerm.length, cautionLevel: cautionResult.level },
        });
      }

      res.json({ 
        explanation,
        userState: userState || null,
        userStateName: userStateName || null,
        stateNote: stateNote || null,
        fallbackText: fallbackText || null,
        classifiedTopic: topicMatch?.topic || null,
        cautionLevel: cautionResult.level,
        followUpQuestions: followUps.slice(0, 3).map(f => ({
          question: f.question,
          yesImplication: f.yesImplication,
          noImplication: f.noImplication
        })),
      });
    } catch (error) {
      console.error('Error explaining criminal/eviction term:', error);
      res.status(500).json({
        explanation: "Sorry, something went wrong. Please try again in a moment."
      });
    }
  }));

  // Screening decoder feedback endpoint - for learning system
  app.post('/api/screening-feedback', isAuthenticated, asyncHandler(async (req, res) => {
    // Validate with extended schema that includes decoderType/rating constraints
    const feedbackSchema = insertScreeningFeedbackSchema.extend({
      decoderType: z.enum(['credit', 'criminal_eviction']),
      rating: z.enum(['helpful', 'not_helpful']),
      questionText: z.string().min(1).max(500),
      cautionLevel: z.enum(['low', 'medium', 'high']).nullable().optional(),
      classifiedTopic: z.string().max(100).nullable().optional(),
    });

    const parseResult = feedbackSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ 
        message: "Invalid feedback data",
        errors: parseResult.error.flatten().fieldErrors 
      });
    }

    const { decoderType, questionText, cautionLevel, classifiedTopic, rating } = parseResult.data;
    const userId = (req as any).userId || null;

    await db.insert(screeningFeedback).values({
      userId,
      decoderType,
      questionText,
      cautionLevel: cautionLevel || null,
      classifiedTopic: classifiedTopic || null,
      rating,
    });

    res.json({ success: true });
  }));

  // Chat assistant endpoint (public, for landing page)
  app.post('/api/chat', asyncHandler(async (req, res) => {
    // Rate limiting
    const clientIp = getClientIp(req);
    if (!chatRateLimiter.check(clientIp)) {
      return res.status(429).json({
        reply: "You're sending messages too quickly. Please wait a moment and try again."
      });
    }

    const { message } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ reply: "Please provide a valid message." });
    }

    if (message.length > 500) {
      return res.status(400).json({ reply: "Message is too long. Please keep it under 500 characters." });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are the LeaseShield Assistant, a helpful and protective AI assistant for landlords visiting the LeaseShield App website.

ABOUT LEASESHIELD APP:
- Subscription-based platform ($12/month with 7-day free trial)
- Provides state-specific legal templates, compliance guidance, and tenant screening resources
- Currently serving: Utah (UT), Texas (TX), North Dakota (ND), South Dakota (SD), and North Carolina (NC)
- Features: professional state-specific lease agreements, compliance cards, legal update notifications, screening guides, tenant issue workflows
- Tone: "Protective mentor" - helping landlords protect their investments while staying compliant

YOUR ROLE:
1. Answer questions about landlord-tenant law in UT, TX, ND, SD, and NC (general guidance only, not legal advice)
2. Explain LeaseShield App features and benefits
3. Help landlords understand compliance requirements
4. Guide them toward signing up for the 7-day free trial
5. Be warm, professional, and protective of their interests

IMPORTANT DISCLAIMERS:
- Always remind users that you provide educational information, not legal advice
- Encourage them to consult an attorney for specific legal situations
- Emphasize that LeaseShield App provides templates and guidance, but users should review with legal counsel

TONE: Friendly, knowledgeable, protective, and helpful. Think "experienced landlord mentor."

If asked about states we don't serve, politely explain we currently focus on UT, TX, ND, SD, and NC but are expanding.

Keep responses concise (2-4 sentences unless more detail is specifically requested).`
        },
        {
          role: "user",
          content: message
        }
      ],
      temperature: 0.7,
      max_tokens: 300,
    });

    const reply = completion.choices[0]?.message?.content || "I'm sorry, I couldn't process that. Please try again.";

    res.json({ reply });
  }));

  // Download logos endpoint
  app.get('/api/download/logos/:filename', async (req, res) => {
    const filename = req.params.filename;
    if (!filename.match(/^leaseshield-logo-(horizontal|stacked)\.jpg$/)) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    const filePath = path.join('attached_assets', filename);
    try {
      res.download(filePath);
    } catch (error) {
      res.status(404).json({ error: 'File not found' });
    }
  });

  // ===== BROADCAST MESSAGING ENDPOINTS =====

  // Get all users for admin
  app.get('/api/admin/users', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error getting users:", error);
      res.status(500).json({ message: "Failed to get users" });
    }
  });
  
  // Get audience counts for admin broadcast form
  app.get('/api/admin/broadcasts/audience-counts', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const trialUsers = await storage.getTrialingUsers();
      const activeUsers = await storage.getAllActiveUsers();
      res.json({
        trial: trialUsers.length,
        active: activeUsers.length,
        all: trialUsers.length + activeUsers.length,
      });
    } catch (error) {
      console.error("Error getting audience counts:", error);
      res.status(500).json({ message: "Failed to get audience counts" });
    }
  });

  // Get all broadcasts with replies for admin
  app.get('/api/admin/broadcasts', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const broadcasts = await storage.getAllBroadcasts();
      const broadcastsWithReplies = await Promise.all(
        broadcasts.map(async (broadcast) => {
          const replies = await storage.getBroadcastRepliesByBroadcastId(broadcast.id);
          const recipients = await storage.getBroadcastRecipientsByBroadcastId(broadcast.id);
          const readCount = recipients.filter(r => r.isRead).length;
          return {
            ...broadcast,
            replies,
            recipientCount: recipients.length,
            readCount,
          };
        })
      );
      res.json(broadcastsWithReplies);
    } catch (error) {
      console.error("Error getting broadcasts:", error);
      res.status(500).json({ message: "Failed to get broadcasts" });
    }
  });

  // Send a broadcast message
  app.post('/api/admin/broadcasts', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const adminUserId = getUserId(req);
      const { subject, content, audience, userId: targetUserId } = req.body;

      if (!subject || !content || !audience) {
        return res.status(400).json({ message: "Subject, content, and audience are required" });
      }

      if (audience === 'individual' && !targetUserId) {
        return res.status(400).json({ message: "User ID is required for individual messages" });
      }

      // Create the broadcast
      const broadcast = await storage.createBroadcast({
        subject,
        content,
        audience: audience === 'individual' ? 'individual' : audience,
        sentByUserId: adminUserId,
      });

      // Get target users based on audience
      let targetUsers: any[] = [];
      if (audience === 'individual') {
        const user = await storage.getUser(targetUserId);
        if (user) targetUsers = [user];
      } else if (audience === 'trial') {
        targetUsers = await storage.getTrialingUsers();
      } else if (audience === 'active') {
        targetUsers = await storage.getAllActiveUsers();
      } else {
        const trialUsers = await storage.getTrialingUsers();
        const activeUsers = await storage.getAllActiveUsers();
        const uniqueUserIds = new Set<string>();
        targetUsers = [...trialUsers, ...activeUsers].filter(u => {
          if (uniqueUserIds.has(u.id)) return false;
          uniqueUserIds.add(u.id);
          return true;
        });
      }

      // Create recipient records and send emails
      const { client, fromEmail } = await getUncachableResendClient();
      const domain = req.get('host') || 'leaseshield.app';
      const baseUrl = req.secure || req.headers['x-forwarded-proto'] === 'https' 
        ? `https://${domain}` 
        : `http://${domain}`;

      let emailSuccessCount = 0;
      for (const user of targetUsers) {
        // Create recipient record
        await storage.createBroadcastRecipient({
          broadcastId: broadcast.id,
          userId: user.id,
          isRead: false,
          emailSent: false,
        });

        // Send email notification
        if (user.email) {
          try {
            await client.emails.send({
              from: fromEmail,
              to: user.email,
              subject: "You have a new message from LeaseShield",
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #14b8a6;">New Message from LeaseShield</h2>
                  <p>Hi${user.firstName ? ` ${user.firstName}` : ''},</p>
                  <p>You have an unread message waiting for you in your LeaseShield account.</p>
                  <p style="margin: 24px 0;">
                    <a href="${baseUrl}/messages" style="background-color: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                      View Message
                    </a>
                  </p>
                  <p style="color: #666; font-size: 14px;">
                    Or copy this link: ${baseUrl}/messages
                  </p>
                  <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
                  <p style="color: #999; font-size: 12px;">
                    LeaseShield - Protecting landlords with legal templates and compliance guidance.
                  </p>
                </div>
              `,
              text: `Hi${user.firstName ? ` ${user.firstName}` : ''},\n\nYou have an unread message waiting for you in your LeaseShield account.\n\nView it here: ${baseUrl}/messages\n\nLeaseShield - Protecting landlords with legal templates and compliance guidance.`,
            });
            emailSuccessCount++;
          } catch (emailError) {
            console.error(`Failed to send broadcast email to ${user.email}:`, emailError);
          }
        }
      }

      // Update recipient count
      await storage.updateBroadcastRecipientCount(broadcast.id, targetUsers.length);

      res.json({
        ...broadcast,
        recipientCount: targetUsers.length,
        emailsSent: emailSuccessCount,
      });
    } catch (error) {
      console.error("Error sending broadcast:", error);
      res.status(500).json({ message: "Failed to send broadcast" });
    }
  });

  // Mark a broadcast reply as read (admin)
  app.post('/api/admin/broadcasts/replies/:replyId/read', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { replyId } = req.params;
      await storage.markBroadcastReplyAsRead(replyId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking reply as read:", error);
      res.status(500).json({ message: "Failed to mark reply as read" });
    }
  });

  // Resend broadcast emails to active subscribers
  app.post('/api/admin/broadcasts/:broadcastId/resend', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { broadcastId } = req.params;
      
      // Get the broadcast
      const broadcast = await storage.getBroadcastById(broadcastId);
      if (!broadcast) {
        return res.status(404).json({ message: "Broadcast not found" });
      }

      // Get active subscribers only
      const activeUsers = await storage.getAllActiveUsers();
      
      if (activeUsers.length === 0) {
        return res.json({ success: true, emailsSent: 0, message: "No active subscribers to send to" });
      }

      // Send emails
      const { client, fromEmail } = await getUncachableResendClient();
      const domain = req.get('host') || 'leaseshield.app';
      const baseUrl = req.secure || req.headers['x-forwarded-proto'] === 'https' 
        ? `https://${domain}` 
        : `http://${domain}`;

      let emailSuccessCount = 0;
      // Helper to escape HTML special characters
      const escapeHtml = (text: string) => text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
      
      // Create a brief preview (first 200 characters) for the teaser email
      const rawPreview = broadcast.content.length > 200 
        ? broadcast.content.substring(0, 200).trim() + '...' 
        : broadcast.content;
      const contentPreview = escapeHtml(rawPreview);
      const subjectEscaped = escapeHtml(broadcast.subject);

      for (const user of activeUsers) {
        if (user.email) {
          try {
            await client.emails.send({
              from: fromEmail,
              to: user.email,
              subject: `LeaseShield Update: ${broadcast.subject}`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #14b8a6;">${subjectEscaped}</h2>
                  <p>Hi${user.firstName ? ` ${user.firstName}` : ''},</p>
                  <p>You have a new announcement from LeaseShield:</p>
                  <div style="background-color: #f8f9fa; border-left: 4px solid #14b8a6; padding: 16px; margin: 16px 0; border-radius: 4px;">
                    <p style="margin: 0; color: #374151; line-height: 1.6;">${contentPreview}</p>
                  </div>
                  <p style="margin: 24px 0;">
                    <a href="${baseUrl}/messages" style="background-color: #14b8a6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
                      View Full Message in LeaseShield
                    </a>
                  </p>
                  <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
                  <p style="color: #999; font-size: 12px;">
                    LeaseShield - Protecting landlords with legal templates and compliance guidance.
                  </p>
                </div>
              `,
              text: `Hi${user.firstName ? ` ${user.firstName}` : ''},\n\nYou have a new announcement from LeaseShield:\n\n${broadcast.subject}\n\n${rawPreview}\n\nView the full message here: ${baseUrl}/messages\n\nLeaseShield - Protecting landlords with legal templates and compliance guidance.`,
            });
            emailSuccessCount++;
          } catch (emailError) {
            console.error(`Failed to resend broadcast email to ${user.email}:`, emailError);
          }
        }
      }

      console.log(`Resent broadcast "${broadcast.subject}" to ${emailSuccessCount} active subscribers`);
      res.json({ 
        success: true, 
        emailsSent: emailSuccessCount,
        totalActiveSubscribers: activeUsers.length 
      });
    } catch (error) {
      console.error("Error resending broadcast:", error);
      res.status(500).json({ message: "Failed to resend broadcast" });
    }
  });

  // ===== ADMIN SCREENING CREDENTIALS MANAGEMENT =====

  // Get all landlords with their screening credential status
  app.get('/api/admin/screening-credentials', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const landlordsWithStatus = await storage.getAllLandlordsWithScreeningStatus();
      
      // Map to return safe data (no encrypted passwords)
      const result = landlordsWithStatus.map(({ user, credentials }) => ({
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        hasCredentials: !!credentials,
        status: credentials?.status || 'not_configured',
        lastVerifiedAt: credentials?.lastVerifiedAt,
        lastErrorMessage: credentials?.lastErrorMessage,
        configuredBy: credentials?.configuredBy,
        configuredAt: credentials?.configuredAt,
        hasInvitationId: !!credentials?.defaultInvitationId,
        invitationId: credentials?.defaultInvitationId || null,
      }));
      
      res.json(result);
    } catch (error) {
      console.error("Error getting landlords with screening status:", error);
      res.status(500).json({ message: "Failed to get landlords" });
    }
  });

  // Set or update screening credentials for a landlord (admin only)
  app.post('/api/admin/screening-credentials/:userId', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const adminId = getUserId(req);
      const { username, password, invitationId } = req.body;

      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }

      // Encrypt credentials using existing crypto functions
      const { encryptCredentials } = await import('./crypto');
      const { encryptedUsername, encryptedPassword, encryptionIv } = encryptCredentials(username, password);

      // Check if credentials already exist
      const existing = await storage.getLandlordScreeningCredentials(userId);

      if (existing) {
        // Update existing
        await storage.updateLandlordScreeningCredentials(userId, {
          encryptedUsername,
          encryptedPassword,
          encryptionIv,
          defaultInvitationId: invitationId || null,
          status: 'pending_verification',
          configuredBy: adminId,
          configuredAt: new Date(),
        });
        res.json({ success: true, status: 'updated' });
      } else {
        // Create new
        await storage.createLandlordScreeningCredentials({
          userId,
          encryptedUsername,
          encryptedPassword,
          encryptionIv,
          defaultInvitationId: invitationId || undefined,
          status: 'pending_verification',
          configuredBy: adminId,
          configuredAt: new Date(),
        });
        res.json({ success: true, status: 'created' });
      }
    } catch (error) {
      console.error("Error setting screening credentials:", error);
      res.status(500).json({ message: "Failed to set credentials" });
    }
  });

  // Test screening credentials for a landlord (admin only)
  app.post('/api/admin/screening-credentials/:userId/test', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      
      const credentials = await storage.getLandlordScreeningCredentials(userId);
      if (!credentials) {
        return res.status(404).json({ message: "Credentials not found for this landlord" });
      }

      // Decrypt credentials
      const { decryptCredentials } = await import('./crypto');
      const { username, password } = decryptCredentials({
        encryptedUsername: credentials.encryptedUsername,
        encryptedPassword: credentials.encryptedPassword,
        encryptionIv: credentials.encryptionIv,
      });

      // Test with Digital Delve
      const { verifyCredentialsWithParams } = await import('./digitalDelveService');
      const verifyResult = await verifyCredentialsWithParams(username, password);
      const testResult = {
        success: verifyResult.success,
        error: verifyResult.error || verifyResult.message,
      };

      // Update status based on test result
      const wasVerified = credentials.status === 'verified';
      await storage.updateLandlordScreeningCredentials(userId, {
        status: testResult.success ? 'verified' : 'failed',
        lastVerifiedAt: testResult.success ? new Date() : undefined,
        lastErrorMessage: testResult.success ? null : testResult.error,
      });

      // Send email notification to landlord when credentials are newly verified
      if (testResult.success && !wasVerified) {
        const landlord = await storage.getUser(userId);
        if (landlord) {
          const { emailService } = await import('./emailService');
          emailService.sendScreeningReadyNotification(landlord).catch(err => {
            console.error('Failed to send screening ready notification:', err);
          });
        }
      }

      res.json(testResult);
    } catch (error) {
      console.error("Error testing screening credentials:", error);
      res.status(500).json({ message: "Failed to test credentials" });
    }
  });

  // Get all tips for admin preview (admin only)
  app.get('/api/admin/tips', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const { LANDLORD_TIPS } = await import('./scheduledJobs');
      
      // Calculate current biweek
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const weekNumber = Math.floor((now.getTime() - startOfYear.getTime()) / (7 * 24 * 60 * 60 * 1000));
      const currentBiweek = Math.floor(weekNumber / 2);
      const currentTipIndex = currentBiweek % LANDLORD_TIPS.length;
      
      res.json({
        tips: LANDLORD_TIPS.map((tip, index) => ({
          ...tip,
          index,
          isCurrent: index === currentTipIndex,
        })),
        currentTipIndex,
        currentBiweek,
        totalTips: LANDLORD_TIPS.length,
      });
    } catch (error) {
      console.error("Error fetching tips:", error);
      res.status(500).json({ message: "Failed to fetch tips" });
    }
  });

  // Send a specific tip to admin for preview (admin only)
  app.post('/api/admin/tips/:index/preview', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const { LANDLORD_TIPS } = await import('./scheduledJobs');
      const tipIndex = parseInt(req.params.index);
      
      if (isNaN(tipIndex) || tipIndex < 0 || tipIndex >= LANDLORD_TIPS.length) {
        return res.status(400).json({ message: "Invalid tip index" });
      }
      
      const tip = LANDLORD_TIPS[tipIndex];
      const adminId = getUserId(req);
      const admin = await storage.getUser(adminId);
      
      if (!admin?.email) {
        return res.status(400).json({ message: "Admin email not found" });
      }
      
      // Import and use the sendTipEmail function's logic directly
      const { getUncachableResendClient } = await import('./resend');
      const { client, fromEmail } = await getUncachableResendClient();
      
      const firstName = admin.firstName || 'there';
      const baseUrl = process.env.REPLIT_DOMAINS 
        ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
        : 'https://leaseshieldapp.com';

      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%); padding: 24px 40px;">
              <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 600;">
                LeaseShield Tip of the Week
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 40px;">
              <p style="margin: 0 0 24px 0; color: #1e293b; font-size: 18px; font-weight: 500;">
                Hi ${firstName},
              </p>
              
              <div style="background-color: #f0fdfa; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
                <h2 style="margin: 0 0 8px 0; color: #0d9488; font-size: 18px; font-weight: 600;">
                  ${tip.title}
                </h2>
                <p style="margin: 0; color: #475569; font-size: 14px; font-style: italic;">
                  ${tip.summary}
                </p>
              </div>

              <p style="margin: 0 0 20px 0; color: #334155; font-size: 15px; line-height: 1.7;">
                ${tip.content}
              </p>

              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 4px; margin-bottom: 24px;">
                <p style="margin: 0; color: #92400e; font-size: 14px;">
                  <strong>Action Item:</strong> ${tip.actionItem}
                </p>
              </div>

              <div style="text-align: center; margin-top: 32px;">
                <a href="${baseUrl}/dashboard" 
                   style="display: inline-block; background-color: #14b8a6; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 14px;">
                  Go to Dashboard
                </a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                [PREVIEW] This is tip #${tipIndex + 1} of ${LANDLORD_TIPS.length}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
      
      await client.emails.send({
        from: fromEmail,
        to: admin.email,
        subject: `[Preview] Tip #${tipIndex + 1}: ${tip.title}`,
        html,
        text: `${tip.title}\n\n${tip.summary}\n\n${tip.content}\n\nAction Item: ${tip.actionItem}`,
      });
      
      res.json({ success: true, message: `Preview sent to ${admin.email}` });
    } catch (error) {
      console.error("Error sending tip preview:", error);
      res.status(500).json({ message: "Failed to send tip preview" });
    }
  });

  // Test biweekly tip email (admin only)
  app.post('/api/admin/test-biweekly-tip', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const { scheduledJobs } = await import('./scheduledJobs');
      await scheduledJobs.sendBiweeklyTips();
      res.json({ success: true, message: 'Biweekly tips sent' });
    } catch (error) {
      console.error("Error sending test tip:", error);
      res.status(500).json({ message: "Failed to send test tip" });
    }
  });

  // Delete screening credentials for a landlord (admin only)
  app.delete('/api/admin/screening-credentials/:userId', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const deleted = await storage.deleteLandlordScreeningCredentials(userId);
      res.json({ success: deleted });
    } catch (error) {
      console.error("Error deleting screening credentials:", error);
      res.status(500).json({ message: "Failed to delete credentials" });
    }
  });

  // Set or clear invitation ID for a landlord (admin only) - separate from credentials
  app.patch('/api/admin/screening-credentials/:userId/invitation', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { invitationId } = req.body;
      const adminId = getUserId(req);

      // Check if credentials exist for this landlord
      const credentials = await storage.getLandlordScreeningCredentials(userId);
      if (!credentials) {
        return res.status(404).json({ message: "Landlord has not set up credentials yet" });
      }

      // Allow setting or clearing the invitation ID
      const trimmedId = typeof invitationId === 'string' ? invitationId.trim() : null;
      const wasAlreadySet = !!credentials.defaultInvitationId;
      
      // Update the invitation ID (null to clear)
      await storage.updateLandlordScreeningCredentials(userId, {
        defaultInvitationId: trimmedId || null,
        configuredBy: adminId,
        configuredAt: new Date(),
      });

      // Notify landlord when invitation ID is set (not cleared) and wasn't previously set
      if (trimmedId && !wasAlreadySet) {
        try {
          const landlord = await storage.getUser(userId);
          if (landlord) {
            await emailService.sendScreeningReadyNotification(landlord);
            console.log(`📧 Screening ready notification sent to landlord ${landlord.email}`);
          }
        } catch (notifyError) {
          console.error('Failed to send landlord notification:', notifyError);
        }
      }

      res.json({ success: true, cleared: !trimmedId });
    } catch (error) {
      console.error("Error setting invitation ID:", error);
      res.status(500).json({ message: "Failed to set invitation ID" });
    }
  });

  // Get user's messages (broadcasts they received)
  app.get('/api/messages', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const recipients = await storage.getUserBroadcastRecipients(userId);
      
      // Get user's own replies for each broadcast
      const messagesWithReplies = await Promise.all(
        recipients.map(async (recipient) => {
          const allReplies = await storage.getBroadcastRepliesByBroadcastId(recipient.broadcastId);
          const userReplies = allReplies.filter(r => r.userId === userId);
          return {
            ...recipient,
            userReplies,
          };
        })
      );
      
      res.json(messagesWithReplies);
    } catch (error) {
      console.error("Error getting user messages:", error);
      res.status(500).json({ message: "Failed to get messages" });
    }
  });

  // Get unread message count for user
  app.get('/api/messages/unread-count', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const count = await storage.getUnreadBroadcastCount(userId);
      res.json({ count });
    } catch (error) {
      console.error("Error getting unread count:", error);
      res.status(500).json({ message: "Failed to get unread count" });
    }
  });

  // Mark a message as read
  app.post('/api/messages/:broadcastId/read', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { broadcastId } = req.params;
      await storage.markBroadcastAsRead(broadcastId, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking message as read:", error);
      res.status(500).json({ message: "Failed to mark message as read" });
    }
  });

  // Reply to a broadcast message
  app.post('/api/messages/:broadcastId/reply', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { broadcastId } = req.params;
      const { content } = req.body;

      if (!content || !content.trim()) {
        return res.status(400).json({ message: "Reply content is required" });
      }

      const reply = await storage.createBroadcastReply({
        broadcastId,
        userId,
        content: content.trim(),
      });

      res.json(reply);
    } catch (error) {
      console.error("Error creating reply:", error);
      res.status(500).json({ message: "Failed to send reply" });
    }
  });

  // ============================================================
  // DIRECT MESSAGING SYSTEM - Two-way conversations between admin and users
  // ============================================================

  // Get user's direct conversations
  app.get('/api/messages/direct', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);
      
      let conversations;
      if (user?.isAdmin) {
        conversations = await storage.getDirectConversationsForAdmin();
      } else {
        conversations = await storage.getDirectConversationsForUser(userId);
      }
      
      // Enrich with user info and last message
      const enrichedConversations = await Promise.all(
        conversations.map(async (conv) => {
          const targetUser = await storage.getUser(conv.userId);
          const messages = await storage.getDirectMessages(conv.id);
          const lastMessage = messages[messages.length - 1];
          const readStatus = await storage.getDirectConversationReadStatus(conv.id, userId);
          const lastReadAt = readStatus?.lastReadAt || new Date(0);
          
          // Count unread messages for this conversation
          const unreadCount = messages.filter(m => {
            const isFromOther = user?.isAdmin ? !m.isFromAdmin : m.isFromAdmin;
            return isFromOther && m.createdAt && new Date(m.createdAt) > lastReadAt;
          }).length;
          
          return {
            ...conv,
            user: targetUser ? {
              id: targetUser.id,
              email: targetUser.email,
              firstName: targetUser.firstName,
              lastName: targetUser.lastName,
            } : null,
            lastMessage: lastMessage ? {
              content: lastMessage.content.substring(0, 100) + (lastMessage.content.length > 100 ? '...' : ''),
              createdAt: lastMessage.createdAt,
              isFromAdmin: lastMessage.isFromAdmin,
            } : null,
            unreadCount,
          };
        })
      );
      
      res.json(enrichedConversations);
    } catch (error) {
      console.error("Error getting direct conversations:", error);
      res.status(500).json({ message: "Failed to get conversations" });
    }
  });

  // Get unread direct message count
  app.get('/api/messages/direct/unread-count', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);
      const count = await storage.getUnreadDirectMessageCount(userId, user?.isAdmin || false);
      res.json({ count });
    } catch (error) {
      console.error("Error getting unread direct message count:", error);
      res.status(500).json({ message: "Failed to get unread count" });
    }
  });

  // Get messages in a conversation
  app.get('/api/messages/direct/:conversationId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);
      const { conversationId } = req.params;
      
      const conversation = await storage.getDirectConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      
      // Check access: user must be the target user or an admin
      if (!user?.isAdmin && conversation.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const messages = await storage.getDirectMessages(conversationId);
      const targetUser = await storage.getUser(conversation.userId);
      
      res.json({
        conversation: {
          ...conversation,
          user: targetUser ? {
            id: targetUser.id,
            email: targetUser.email,
            firstName: targetUser.firstName,
            lastName: targetUser.lastName,
          } : null,
        },
        messages,
      });
    } catch (error) {
      console.error("Error getting conversation messages:", error);
      res.status(500).json({ message: "Failed to get messages" });
    }
  });

  // Create a new direct conversation (admin only)
  app.post('/api/messages/direct', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const adminId = getUserId(req);
      const { userId, subject, initialMessage } = req.body;
      
      if (!userId || !subject || !initialMessage) {
        return res.status(400).json({ message: "User ID, subject, and initial message are required" });
      }
      
      if (initialMessage.length > 5000) {
        return res.status(400).json({ message: "Message content exceeds 5000 character limit" });
      }
      
      // Check target user exists
      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Create conversation
      const conversation = await storage.createDirectConversation({
        subject: subject.trim(),
        userId,
        createdByAdminId: adminId,
      });
      
      // Create initial message
      await storage.createDirectMessage({
        conversationId: conversation.id,
        senderId: adminId,
        content: initialMessage.trim(),
        isFromAdmin: true,
      });
      
      // Send email notification to user
      emailService.sendDirectMessageNotification(
        { email: targetUser.email, firstName: targetUser.firstName || undefined, lastName: targetUser.lastName || undefined },
        subject.trim(),
        initialMessage.trim()
      ).catch(err => console.error("Failed to send direct message email:", err));
      
      res.json(conversation);
    } catch (error) {
      console.error("Error creating direct conversation:", error);
      res.status(500).json({ message: "Failed to create conversation" });
    }
  });

  // Reply to a direct conversation
  app.post('/api/messages/direct/:conversationId/reply', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);
      const { conversationId } = req.params;
      const { content } = req.body;
      
      if (!content || !content.trim()) {
        return res.status(400).json({ message: "Message content is required" });
      }
      
      if (content.length > 5000) {
        return res.status(400).json({ message: "Message content exceeds 5000 character limit" });
      }
      
      const conversation = await storage.getDirectConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      
      // Check access
      if (!user?.isAdmin && conversation.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const message = await storage.createDirectMessage({
        conversationId,
        senderId: userId,
        content: content.trim(),
        isFromAdmin: user?.isAdmin || false,
      });
      
      // If admin is replying, send email notification to user
      if (user?.isAdmin) {
        const targetUser = await storage.getUser(conversation.userId);
        if (targetUser) {
          emailService.sendDirectMessageNotification(
            { email: targetUser.email, firstName: targetUser.firstName || undefined, lastName: targetUser.lastName || undefined },
            conversation.subject,
            content.trim()
          ).catch(err => console.error("Failed to send direct message reply email:", err));
        }
      }
      
      res.json(message);
    } catch (error) {
      console.error("Error sending direct message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  // Mark a direct conversation as read
  app.post('/api/messages/direct/:conversationId/read', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);
      const { conversationId } = req.params;
      
      const conversation = await storage.getDirectConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      
      // Check access
      if (!user?.isAdmin && conversation.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      await storage.upsertDirectConversationReadStatus(conversationId, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking conversation as read:", error);
      res.status(500).json({ message: "Failed to mark as read" });
    }
  });

  // Archive a direct conversation (admin only)
  app.post('/api/messages/direct/:conversationId/archive', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const { conversationId } = req.params;
      
      const conversation = await storage.getDirectConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      
      await storage.archiveDirectConversation(conversationId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error archiving conversation:", error);
      res.status(500).json({ message: "Failed to archive conversation" });
    }
  });

  // Get all users for admin to start conversations with
  app.get('/api/admin/users-for-messaging', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      // Return minimal user info for selection
      const usersForMessaging = allUsers
        .filter(u => !u.isAdmin) // Don't show admins
        .map(u => ({
          id: u.id,
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          preferredState: u.preferredState,
        }));
      res.json(usersForMessaging);
    } catch (error) {
      console.error("Error getting users for messaging:", error);
      res.status(500).json({ message: "Failed to get users" });
    }
  });

  // ============================================================
  // RENTAL APPLICATION SYSTEM - API Routes
  // ============================================================

  // Import default templates from schema
  const { defaultCoverPageTemplate, defaultFieldSchemaTemplate } = await import("@shared/schema");

  // Rental Property CRUD
  app.get('/api/rental/properties', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const properties = await storage.getRentalPropertiesByUserId(userId);
      res.json(properties);
    } catch (error) {
      console.error("Error getting rental properties:", error);
      res.status(500).json({ message: "Failed to get properties" });
    }
  });

  app.get('/api/rental/properties/:id', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const property = await storage.getRentalProperty(req.params.id, userId);
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }
      res.json(property);
    } catch (error) {
      console.error("Error getting rental property:", error);
      res.status(500).json({ message: "Failed to get property" });
    }
  });

  app.post('/api/rental/properties', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { name, address, city, state, zipCode, propertyType, notes, defaultCoverPageJson, defaultFieldSchemaJson, requiredDocumentTypes, autoScreening, propertyTermsJson } = req.body;
      
      if (!name) {
        return res.status(400).json({ message: "Property name is required" });
      }

      const property = await storage.createRentalProperty({
        userId,
        name,
        address: address || null,
        city: city || null,
        state: state || null,
        zipCode: zipCode || null,
        propertyType: propertyType || null,
        notes: notes || null,
        defaultCoverPageJson: defaultCoverPageJson || defaultCoverPageTemplate,
        defaultFieldSchemaJson: defaultFieldSchemaJson || defaultFieldSchemaTemplate,
        requiredDocumentTypes: requiredDocumentTypes || null,
        autoScreening: autoScreening ?? false,
        propertyTermsJson: propertyTermsJson || null,
      });

      res.status(201).json(property);
    } catch (error) {
      console.error("Error creating rental property:", error);
      res.status(500).json({ message: "Failed to create property" });
    }
  });

  app.patch('/api/rental/properties/:id', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { name, address, city, state, zipCode, propertyType, notes, defaultCoverPageJson, defaultFieldSchemaJson, requiredDocumentTypes, autoScreening, propertyTermsJson } = req.body;
      
      const property = await storage.updateRentalProperty(req.params.id, userId, {
        name,
        address,
        city,
        state,
        zipCode,
        propertyType,
        notes,
        defaultCoverPageJson,
        defaultFieldSchemaJson,
        requiredDocumentTypes,
        autoScreening,
        propertyTermsJson,
      });

      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }

      res.json(property);
    } catch (error) {
      console.error("Error updating rental property:", error);
      res.status(500).json({ message: "Failed to update property" });
    }
  });

  app.delete('/api/rental/properties/:id', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      await storage.deleteRentalProperty(req.params.id, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting rental property:", error);
      res.status(500).json({ message: "Failed to delete property" });
    }
  });

  // Rental Unit CRUD
  app.get('/api/rental/properties/:propertyId/units', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      // Verify property ownership
      const property = await storage.getRentalProperty(req.params.propertyId, userId);
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }
      const units = await storage.getRentalUnitsByPropertyId(req.params.propertyId);
      res.json(units);
    } catch (error) {
      console.error("Error getting rental units:", error);
      res.status(500).json({ message: "Failed to get units" });
    }
  });

  // Create application link at property level - reuses existing unit and link if available
  app.post('/api/rental/properties/:propertyId/quick-link', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const property = await storage.getRentalProperty(req.params.propertyId, userId);
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }

      // Check for existing units
      const existingUnits = await storage.getRentalUnitsByPropertyId(req.params.propertyId);
      
      let unit;
      let unitCreated = false;
      
      if (existingUnits.length > 0) {
        // Use the first existing unit
        unit = existingUnits[0];
        
        // Check if this unit already has an active link
        const existingLinks = await storage.getRentalApplicationLinksByUnitId(unit.id);
        const activeLink = existingLinks.find(l => l.isActive);
        
        if (activeLink) {
          // Update the existing link with latest property terms, then return it
          const currentSchema = activeLink.mergedSchemaJson as any || {};
          const updatedPropertyTerms = property.propertyTermsJson || {};
          const updatedCoverPage = property.defaultCoverPageJson || currentSchema.coverPage;
          const updatedMergedSchema = {
            ...currentSchema,
            coverPage: updatedCoverPage,
            propertyTerms: updatedPropertyTerms,
            propertyName: property.name,
          };
          await storage.updateRentalApplicationLink(activeLink.id, { mergedSchemaJson: updatedMergedSchema });
          return res.status(200).json({ unit, link: { ...activeLink, mergedSchemaJson: updatedMergedSchema }, unitCreated: false, reused: true });
        }
      } else {
        // Create a default unit silently (user doesn't need to see it)
        unit = await storage.createRentalUnit({
          propertyId: req.params.propertyId,
          unitLabel: "", // Empty label - shows property name only
          coverPageOverrideEnabled: false,
          coverPageOverrideJson: null,
          fieldSchemaOverrideEnabled: false,
          fieldSchemaOverrideJson: null,
        });
        unitCreated = true;
      }

      // Create the application link
      const publicToken = randomUUID().replace(/-/g, '');
      const coverPage = property.defaultCoverPageJson;
      const fieldSchema = property.defaultFieldSchemaJson;
      
      // Get property terms from the property's stored data
      const propertyTerms = property.propertyTermsJson || {};

      // Format rent as currency string for display
      const formattedRent = unit.rentAmount ? `$${(unit.rentAmount / 100).toLocaleString()}/mo` : null;
      const updatedPropertyTerms = {
        ...propertyTerms,
        ...(formattedRent && { monthlyRent: formattedRent }),
      };
      
      const link = await storage.createRentalApplicationLink({
        unitId: unit.id,
        publicToken,
        mergedSchemaJson: { coverPage, fieldSchema, propertyName: property.name, unitLabel: unit.unitLabel || "", propertyTerms: updatedPropertyTerms, rentAmount: unit.rentAmount },
        isActive: true,
        expiresAt: null,
      });

      res.status(201).json({ unit, link, unitCreated });
    } catch (error) {
      console.error("Error creating quick link:", error);
      res.status(500).json({ message: "Failed to create application link" });
    }
  });

  app.post('/api/rental/properties/:propertyId/units', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      // Verify property ownership
      const property = await storage.getRentalProperty(req.params.propertyId, userId);
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }

      const { unitLabel, coverPageOverrideEnabled, coverPageOverrideJson, fieldSchemaOverrideEnabled, fieldSchemaOverrideJson, createLink } = req.body;

      const unit = await storage.createRentalUnit({
        propertyId: req.params.propertyId,
        unitLabel: unitLabel || "",
        coverPageOverrideEnabled: coverPageOverrideEnabled || false,
        coverPageOverrideJson: coverPageOverrideJson || null,
        fieldSchemaOverrideEnabled: fieldSchemaOverrideEnabled || false,
        fieldSchemaOverrideJson: fieldSchemaOverrideJson || null,
      });

      // If createLink is true, also create an application link for this unit
      let link = null;
      if (createLink) {
        const publicToken = randomUUID().replace(/-/g, '');
        
        // Compute merged schema from property defaults (unit has no overrides yet)
        const coverPage = property.defaultCoverPageJson;
        const fieldSchema = property.defaultFieldSchemaJson;
        const propertyTerms = property.propertyTermsJson || {};
        
        // Format rent as currency string for display
        const formattedRent = unit.rentAmount ? `$${(unit.rentAmount / 100).toLocaleString()}/mo` : null;
        const updatedPropertyTerms = {
          ...propertyTerms,
          ...(formattedRent && { monthlyRent: formattedRent }),
        };
        
        link = await storage.createRentalApplicationLink({
          unitId: unit.id,
          publicToken,
          mergedSchemaJson: { coverPage, fieldSchema, propertyName: property.name, unitLabel: unit.unitLabel || "", propertyTerms: updatedPropertyTerms, rentAmount: unit.rentAmount },
          isActive: true,
          expiresAt: null,
        });
      }

      res.status(201).json({ unit, link });
    } catch (error) {
      console.error("Error creating rental unit:", error);
      res.status(500).json({ message: "Failed to create unit" });
    }
  });

  app.patch('/api/rental/units/:id', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      // Get the unit first to verify ownership via property
      const existingUnit = await storage.getRentalUnit(req.params.id);
      if (!existingUnit) {
        return res.status(404).json({ message: "Unit not found" });
      }
      
      // Verify property ownership
      const property = await storage.getRentalProperty(existingUnit.propertyId, userId);
      if (!property) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { unitLabel, rentAmount, coverPageOverrideEnabled, coverPageOverrideJson, fieldSchemaOverrideEnabled, fieldSchemaOverrideJson } = req.body;
      
      const unit = await storage.updateRentalUnit(req.params.id, {
        unitLabel,
        rentAmount,
        coverPageOverrideEnabled,
        coverPageOverrideJson,
        fieldSchemaOverrideEnabled,
        fieldSchemaOverrideJson,
      });

      // Update active links with new unit label and rent amount
      if (unit && (unitLabel !== undefined || rentAmount !== undefined)) {
        try {
          const links = await storage.getRentalApplicationLinksByUnitId(req.params.id);
          const activeLinks = links.filter(l => l.isActive);
          
          for (const link of activeLinks) {
            const currentSchema = link.mergedSchemaJson as any || {};
            const currentPropertyTerms = currentSchema.propertyTerms || {};
            
            const formattedRent = rentAmount !== undefined && rentAmount !== null
              ? `$${(rentAmount / 100).toLocaleString()}/mo`
              : currentPropertyTerms.monthlyRent;
            
            const updatedSchema = {
              ...currentSchema,
              ...(unitLabel !== undefined && { unitLabel: unitLabel || "" }),
              ...(rentAmount !== undefined && { rentAmount }),
              propertyTerms: {
                ...currentPropertyTerms,
                ...(rentAmount !== undefined && { monthlyRent: formattedRent }),
              },
            };
            await storage.updateRentalApplicationLink(link.id, { mergedSchemaJson: updatedSchema });
          }
          console.log(`[Unit Update] Synced ${activeLinks.length} active link(s) for unit ${req.params.id}`);
        } catch (linkSyncError) {
          console.error(`[Unit Update] Failed to sync links for unit ${req.params.id}:`, linkSyncError);
        }
      }

      res.json(unit);
    } catch (error) {
      console.error("Error updating rental unit:", error);
      res.status(500).json({ message: "Failed to update unit" });
    }
  });

  app.delete('/api/rental/units/:id', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      // Get the unit first to verify ownership via property
      const existingUnit = await storage.getRentalUnit(req.params.id);
      if (!existingUnit) {
        return res.status(404).json({ message: "Unit not found" });
      }
      
      // Verify property ownership
      const property = await storage.getRentalProperty(existingUnit.propertyId, userId);
      if (!property) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.deleteRentalUnit(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting rental unit:", error);
      res.status(500).json({ message: "Failed to delete unit" });
    }
  });

  // Application Link Management
  app.get('/api/rental/units/:unitId/links', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      // Verify ownership via unit -> property
      const unit = await storage.getRentalUnit(req.params.unitId);
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }
      const property = await storage.getRentalProperty(unit.propertyId, userId);
      if (!property) {
        return res.status(403).json({ message: "Access denied" });
      }

      const links = await storage.getRentalApplicationLinksByUnitId(req.params.unitId);
      res.json(links);
    } catch (error) {
      console.error("Error getting application links:", error);
      res.status(500).json({ message: "Failed to get links" });
    }
  });

  app.post('/api/rental/units/:unitId/links', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      // Verify ownership via unit -> property
      const unit = await storage.getRentalUnit(req.params.unitId);
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }
      const property = await storage.getRentalProperty(unit.propertyId, userId);
      if (!property) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Check if this unit already has an active link - update and reuse it with latest property terms
      const existingLinks = await storage.getRentalApplicationLinksByUnitId(req.params.unitId);
      const activeLink = existingLinks.find(l => l.isActive);
      if (activeLink) {
        // Update the existing link with latest property terms from the property
        const currentSchema = activeLink.mergedSchemaJson as any || {};
        const updatedPropertyTerms = property.propertyTermsJson || {};
        const updatedCoverPage = property.defaultCoverPageJson || currentSchema.coverPage;
        const updatedMergedSchema = {
          ...currentSchema,
          coverPage: updatedCoverPage,
          propertyTerms: updatedPropertyTerms,
          propertyName: property.name,
        };
        await storage.updateRentalApplicationLink(activeLink.id, { mergedSchemaJson: updatedMergedSchema });
        return res.status(200).json({ ...activeLink, mergedSchemaJson: updatedMergedSchema });
      }

      // Merge schemas: unit overrides or property defaults
      const coverPage = unit.coverPageOverrideEnabled && unit.coverPageOverrideJson 
        ? unit.coverPageOverrideJson 
        : property.defaultCoverPageJson;
      const fieldSchema = unit.fieldSchemaOverrideEnabled && unit.fieldSchemaOverrideJson
        ? unit.fieldSchemaOverrideJson
        : property.defaultFieldSchemaJson;

      // Generate public token
      const publicToken = randomUUID().replace(/-/g, '');

      // Get property terms from property (fall back to request body for backwards compatibility)
      const propertyTerms = property.propertyTermsJson || req.body.propertyTerms || {};

      // Format rent as currency string for display
      const formattedRent = unit.rentAmount ? `$${(unit.rentAmount / 100).toLocaleString()}/mo` : null;
      const updatedPropertyTerms = {
        ...propertyTerms,
        ...(formattedRent && { monthlyRent: formattedRent }),
      };
      
      const link = await storage.createRentalApplicationLink({
        unitId: req.params.unitId,
        publicToken,
        mergedSchemaJson: { coverPage, fieldSchema, propertyName: property.name, unitLabel: unit.unitLabel, propertyTerms: updatedPropertyTerms, rentAmount: unit.rentAmount },
        isActive: true,
        expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : null,
      });

      res.status(201).json(link);
    } catch (error) {
      console.error("Error creating application link:", error);
      res.status(500).json({ message: "Failed to create link" });
    }
  });

  app.post('/api/rental/links/:id/deactivate', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      await storage.deactivateRentalApplicationLink(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deactivating link:", error);
      res.status(500).json({ message: "Failed to deactivate link" });
    }
  });

  // ============================================================
  // LANDLORD SUBMISSION MANAGEMENT ROUTES (Authenticated)
  // ============================================================

  // Get count of pending (submitted) applications for landlord
  app.get('/api/rental/submissions/pending-count', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const count = await storage.getPendingSubmissionsCount(userId);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching pending count:", error);
      res.status(500).json({ message: "Failed to fetch pending count" });
    }
  });

  // List all submissions for landlord's properties
  app.get('/api/rental/submissions', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const includeArchived = req.query.includeArchived === 'true';
      const submissions = await storage.getRentalSubmissionsByUserId(userId, false, includeArchived);
      
      // Enrich with property/unit info and people
      const enriched = await Promise.all(submissions.map(async (sub) => {
        const people = await storage.getRentalSubmissionPeople(sub.id);
        const appLink = sub.applicationLinkId ? await storage.getRentalApplicationLink(sub.applicationLinkId) : null;
        let propertyName = "Unknown";
        let unitLabel = "";
        if (appLink) {
          const unit = await storage.getRentalUnit(appLink.unitId);
          if (unit) {
            const property = await storage.getRentalProperty(unit.propertyId, userId);
            if (property) {
              propertyName = property.name;
              unitLabel = unit.unitLabel;
            }
          }
        }
        const primaryApplicant = people.find(p => p.role === 'applicant');
        const decision = await storage.getRentalDecision(sub.id);
        
        // Get screening status aggregation with normalization for vendor variants
        const screeningOrders = await storage.getRentalScreeningOrdersBySubmission(sub.id);
        let screeningStatus: 'not_sent' | 'pending' | 'complete' = 'not_sent';
        if (screeningOrders.length > 0) {
          // Normalize status to handle any vendor variants
          const normalizedStatuses = screeningOrders.map(o => {
            const s = (o.status || '').toLowerCase().replace(/[_\s-]/g, '');
            if (s === 'complete' || s === 'completed') return 'complete';
            if (s === 'sent' || s === 'inprogress' || s === 'pending') return 'pending';
            return s;
          });
          const allComplete = normalizedStatuses.every(s => s === 'complete');
          const anyPending = normalizedStatuses.some(s => s === 'pending');
          if (allComplete) {
            screeningStatus = 'complete';
          } else if (anyPending || normalizedStatuses.some(s => s === 'complete')) {
            screeningStatus = 'pending';
          }
        }
        
        return {
          ...sub,
          propertyName,
          unitLabel,
          primaryApplicant: primaryApplicant ? {
            firstName: primaryApplicant.firstName,
            lastName: primaryApplicant.lastName,
            email: primaryApplicant.email,
          } : null,
          peopleCount: people.length,
          decision: decision ? { decision: decision.decision, decidedAt: decision.decidedAt } : null,
          screeningStatus,
          archivedAt: sub.archivedAt,
        };
      }));
      
      res.json(enriched);
    } catch (error) {
      console.error("Error fetching submissions:", error);
      res.status(500).json({ message: "Failed to fetch submissions" });
    }
  });

  // Get specific submission with all people
  app.get('/api/rental/submissions/:id', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const submission = await storage.getRentalSubmission(req.params.id);
      
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      // Verify ownership
      const appLink = submission.applicationLinkId ? await storage.getRentalApplicationLink(submission.applicationLinkId) : null;
      if (!appLink) {
        return res.status(404).json({ message: "Application link not found" });
      }
      const unit = await storage.getRentalUnit(appLink.unitId);
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }
      const property = await storage.getRentalProperty(unit.propertyId, userId);
      if (!property) {
        return res.status(403).json({ message: "Access denied" });
      }

      const people = await storage.getRentalSubmissionPeople(submission.id);
      const events = await storage.getRentalApplicationEvents(submission.id);

      res.json({
        ...submission,
        propertyName: property.name,
        unitLabel: unit.unitLabel,
        people,
        events,
      });
    } catch (error) {
      console.error("Error fetching submission:", error);
      res.status(500).json({ message: "Failed to fetch submission" });
    }
  });

  // Update submission status (approve/deny/etc)
  app.patch('/api/rental/submissions/:id', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const submission = await storage.getRentalSubmission(req.params.id);
      
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      // Verify ownership
      const appLink = submission.applicationLinkId ? await storage.getRentalApplicationLink(submission.applicationLinkId) : null;
      if (!appLink) {
        return res.status(404).json({ message: "Application link not found" });
      }
      const unit = await storage.getRentalUnit(appLink.unitId);
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }
      const property = await storage.getRentalProperty(unit.propertyId, userId);
      if (!property) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { status, landlordNotes, screeningTier } = req.body;
      const updates: any = {};
      if (status) updates.status = status;
      if (landlordNotes !== undefined) updates.landlordNotes = landlordNotes;
      if (screeningTier) updates.screeningTier = screeningTier;

      const updated = await storage.updateRentalSubmission(req.params.id, updates);

      // Log the status change event
      if (status) {
        await storage.logRentalApplicationEvent({
          submissionId: submission.id,
          eventType: `status_changed_to_${status}`,
          metadataJson: { previousStatus: submission.status, newStatus: status, changedBy: userId },
        });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating submission:", error);
      res.status(500).json({ message: "Failed to update submission" });
    }
  });

  // Soft delete a submission
  app.delete('/api/rental/submissions/:id', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const submission = await storage.getRentalSubmission(req.params.id);
      
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      // Verify ownership
      const appLink = submission.applicationLinkId ? await storage.getRentalApplicationLink(submission.applicationLinkId) : null;
      if (!appLink) {
        return res.status(404).json({ message: "Application link not found" });
      }
      const unit = await storage.getRentalUnit(appLink.unitId);
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }
      const property = await storage.getRentalProperty(unit.propertyId, userId);
      if (!property) {
        return res.status(403).json({ message: "Access denied" });
      }

      const deleted = await storage.softDeleteRentalSubmission(req.params.id);
      
      if (deleted) {
        // Log the deletion event
        await storage.logRentalApplicationEvent({
          submissionId: submission.id,
          eventType: 'submission_deleted',
          metadataJson: { deletedBy: userId, deletedAt: new Date().toISOString() },
        });
      }

      res.json({ success: deleted });
    } catch (error) {
      console.error("Error deleting submission:", error);
      res.status(500).json({ message: "Failed to delete submission" });
    }
  });

  app.post('/api/rental/submissions/:id/archive', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const submission = await storage.getRentalSubmission(req.params.id);
      if (!submission) return res.status(404).json({ message: "Submission not found" });

      const appLink = submission.applicationLinkId ? await storage.getRentalApplicationLink(submission.applicationLinkId) : null;
      if (!appLink) return res.status(404).json({ message: "Application link not found" });
      const unit = await storage.getRentalUnit(appLink.unitId);
      if (!unit) return res.status(404).json({ message: "Unit not found" });
      const property = await storage.getRentalProperty(unit.propertyId, userId);
      if (!property) return res.status(403).json({ message: "Access denied" });

      const updated = await storage.archiveRentalSubmission(req.params.id);
      res.json(updated);
    } catch (error) {
      console.error("Error archiving submission:", error);
      res.status(500).json({ message: "Failed to archive submission" });
    }
  });

  app.post('/api/rental/submissions/:id/unarchive', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const submission = await storage.getRentalSubmission(req.params.id);
      if (!submission) return res.status(404).json({ message: "Submission not found" });

      const appLink = submission.applicationLinkId ? await storage.getRentalApplicationLink(submission.applicationLinkId) : null;
      if (!appLink) return res.status(404).json({ message: "Application link not found" });
      const unit = await storage.getRentalUnit(appLink.unitId);
      if (!unit) return res.status(404).json({ message: "Unit not found" });
      const property = await storage.getRentalProperty(unit.propertyId, userId);
      if (!property) return res.status(403).json({ message: "Access denied" });

      const updated = await storage.unarchiveRentalSubmission(req.params.id);
      res.json(updated);
    } catch (error) {
      console.error("Error unarchiving submission:", error);
      res.status(500).json({ message: "Failed to unarchive submission" });
    }
  });

  // Create a decision (approve/deny) for a submission
  app.post('/api/rental/submissions/:id/decision', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const submission = await storage.getRentalSubmission(req.params.id);
      
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      // Verify ownership
      const appLink = submission.applicationLinkId ? await storage.getRentalApplicationLink(submission.applicationLinkId) : null;
      if (!appLink) {
        return res.status(404).json({ message: "Application link not found" });
      }
      const unit = await storage.getRentalUnit(appLink.unitId);
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }
      const property = await storage.getRentalProperty(unit.propertyId, userId);
      if (!property) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Check if a decision already exists
      const existingDecision = await storage.getRentalDecision(submission.id);
      if (existingDecision) {
        return res.status(400).json({ message: "A decision has already been made for this application" });
      }

      const { decision, notes, denialReasons, skipNotification } = req.body;
      if (!decision || !['approved', 'denied'].includes(decision)) {
        return res.status(400).json({ message: "Decision must be 'approved' or 'denied'" });
      }

      const newDecision = await storage.createRentalDecision({
        submissionId: submission.id,
        decision,
        decidedAt: new Date(),
        decidedByUserId: userId,
        notes: notes || null,
      });

      // If denied, store the denial reasons
      let reasons: any[] = [];
      if (decision === 'denied' && denialReasons && Array.isArray(denialReasons) && denialReasons.length > 0) {
        const reasonsToInsert = denialReasons.map((r: { category: string; detail?: string }) => ({
          decisionId: newDecision.id,
          category: r.category as any,
          detail: r.detail || null,
        }));
        reasons = await storage.createRentalDenialReasons(reasonsToInsert);
      }

      // Log the decision event (skipNotification indicates landlord will send their own adverse action notice)
      await storage.logRentalApplicationEvent({
        submissionId: submission.id,
        eventType: `decision_${decision}`,
        metadataJson: { 
          decisionId: newDecision.id, 
          decidedBy: userId, 
          notes, 
          denialReasons: reasons.map(r => r.category),
          skipNotification: skipNotification || false,
        },
      });

      // Send notification email to applicant if not skipped
      if (!skipNotification) {
        try {
          // Get the primary applicant for the submission
          const people = await storage.getRentalSubmissionPeople(submission.id);
          const primaryApplicant = people.find(p => p.role === 'applicant');
          
          if (primaryApplicant && primaryApplicant.email) {
            // Build property address
            let propertyAddress = 'the rental property';
            if (unit && property) {
              propertyAddress = unit.unitLabel 
                ? `${property.name} - Unit ${unit.unitLabel}`
                : property.name;
            }
            
            // Get landlord name
            const landlord = await storage.getUser(userId);
            const landlordInfo = landlord ? {
              name: landlord.firstName && landlord.lastName 
                ? `${landlord.firstName} ${landlord.lastName}`
                : undefined,
              businessName: landlord.businessName || undefined,
              phoneNumber: landlord.phoneNumber || undefined,
            } : undefined;
            
            await emailService.sendApplicationDecisionEmail(
              { 
                email: primaryApplicant.email, 
                firstName: primaryApplicant.firstName || undefined, 
                lastName: primaryApplicant.lastName || undefined 
              },
              decision as 'approved' | 'denied',
              propertyAddress,
              landlordInfo
            );
            console.log(`✅ Decision notification sent to ${primaryApplicant.email}`);
          }
        } catch (emailError) {
          console.error("Error sending decision notification email:", emailError);
          // Don't fail the request if email fails
        }
      }

      res.status(201).json({ ...newDecision, denialReasons: reasons });
    } catch (error) {
      console.error("Error creating decision:", error);
      res.status(500).json({ message: "Failed to create decision" });
    }
  });

  // Get decision for a submission
  app.get('/api/rental/submissions/:id/decision', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const submission = await storage.getRentalSubmission(req.params.id);
      
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      // Verify ownership
      const appLink = submission.applicationLinkId ? await storage.getRentalApplicationLink(submission.applicationLinkId) : null;
      if (!appLink) {
        return res.status(404).json({ message: "Application link not found" });
      }
      const unit = await storage.getRentalUnit(appLink.unitId);
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }
      const property = await storage.getRentalProperty(unit.propertyId, userId);
      if (!property) {
        return res.status(403).json({ message: "Access denied" });
      }

      const decision = await storage.getRentalDecision(submission.id);
      if (!decision) {
        return res.json(null);
      }
      
      // Include denial reasons if it's a denial
      const denialReasons = decision.decision === 'denied' 
        ? await storage.getRentalDenialReasons(decision.id) 
        : [];
      
      res.json({ ...decision, denialReasons });
    } catch (error) {
      console.error("Error getting decision:", error);
      res.status(500).json({ message: "Failed to get decision" });
    }
  });

  // Send custom notification email for a decision
  app.post('/api/rental/submissions/:id/send-notification', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { subject, body } = req.body;
      
      if (!subject || !body) {
        return res.status(400).json({ message: "Subject and body are required" });
      }
      
      const submission = await storage.getRentalSubmission(req.params.id);
      
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      // Verify ownership
      const appLink = submission.applicationLinkId ? await storage.getRentalApplicationLink(submission.applicationLinkId) : null;
      if (!appLink) {
        return res.status(404).json({ message: "Application link not found" });
      }
      const unit = await storage.getRentalUnit(appLink.unitId);
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }
      const property = await storage.getRentalProperty(unit.propertyId, userId);
      if (!property) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get the primary applicant
      const people = await storage.getRentalSubmissionPeople(submission.id);
      const primaryApplicant = people.find(p => p.role === 'applicant');
      
      if (!primaryApplicant?.email) {
        return res.status(400).json({ message: "Primary applicant email not found" });
      }

      // Send custom email using the email service
      await emailService.sendCustomDecisionEmail(
        primaryApplicant.email,
        subject,
        body
      );
      
      // Record the sent letter in decision letters table
      const decision = await storage.getRentalDecision(submission.id);
      if (decision) {
        const letterType = decision.decision === 'approved' ? 'approval' : 'adverse_action';
        await storage.createRentalDecisionLetter({
          submissionId: submission.id,
          decisionId: decision.id,
          letterType: letterType as 'approval' | 'adverse_action',
          templateBody: body, // Original template body
          finalBody: body, // Final sent body (same in this case)
          sentToEmail: primaryApplicant.email,
          sentAt: new Date(),
        });
      }
      
      console.log(`✅ Custom decision notification sent to ${primaryApplicant.email}`);
      
      res.json({ success: true, message: "Notification sent successfully" });
    } catch (error) {
      console.error("Error sending notification:", error);
      res.status(500).json({ message: "Failed to send notification" });
    }
  });

  // ============================================================
  // SCREENING ROUTES (DigitalDelve Integration)
  // ============================================================

  // Get all screening orders for a submission (per-person model)
  app.get('/api/rental/submissions/:id/screening', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const submission = await storage.getRentalSubmission(req.params.id);
      
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      // Verify ownership
      const appLink = submission.applicationLinkId ? await storage.getRentalApplicationLink(submission.applicationLinkId) : null;
      if (!appLink) {
        return res.status(404).json({ message: "Application link not found" });
      }
      const unit = await storage.getRentalUnit(appLink.unitId);
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }
      const property = await storage.getRentalProperty(unit.propertyId, userId);
      if (!property) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Return all screening orders for this submission (per-person)
      const screeningOrders = await storage.getRentalScreeningOrdersBySubmission(submission.id);
      res.json(screeningOrders);
    } catch (error) {
      console.error("Error getting screening orders:", error);
      res.status(500).json({ message: "Failed to get screening orders" });
    }
  });

  // Download consent authorization PDF for a specific person
  app.get('/api/rental/submissions/:id/person/:personId/consent-pdf', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const submission = await storage.getRentalSubmission(req.params.id);
      
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      // Verify ownership
      const appLink = submission.applicationLinkId ? await storage.getRentalApplicationLink(submission.applicationLinkId) : null;
      if (!appLink) {
        return res.status(404).json({ message: "Application link not found" });
      }
      const unit = await storage.getRentalUnit(appLink.unitId);
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }
      const property = await storage.getRentalProperty(unit.propertyId, userId);
      if (!property) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get the person
      const people = await storage.getRentalSubmissionPeople(submission.id);
      const person = people.find(p => p.id === req.params.personId);
      
      if (!person) {
        return res.status(404).json({ message: "Person not found" });
      }

      if (!person.fcraAuthorized) {
        return res.status(400).json({ message: "This person has not authorized a background check" });
      }

      // Generate PDF using Puppeteer with system Chromium
      const puppeteer = await import('puppeteer');
      const chromiumPath = execSync('which chromium').toString().trim();
      const browser = await puppeteer.default.launch({ 
        headless: true,
        executablePath: chromiumPath,
        timeout: 30000,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--single-process',
          '--no-zygote',
          '--disable-extensions',
          '--disable-background-networking',
        ]
      });
      
      let pdfBuffer: Buffer;
      try {
        const page = await browser.newPage();
        page.setDefaultTimeout(30000);

        const consentDate = person.fcraAuthorizedTimestamp 
          ? new Date(person.fcraAuthorizedTimestamp).toLocaleString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZoneName: 'short'
          })
        : 'Unknown';

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: 'Georgia', serif;
              max-width: 800px;
              margin: 0 auto;
              padding: 40px;
              line-height: 1.6;
              color: #1a1a1a;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #0d9488;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .header h1 {
              color: #0d9488;
              margin: 0 0 10px 0;
              font-size: 24px;
            }
            .header h2 {
              color: #374151;
              margin: 0;
              font-size: 18px;
              font-weight: normal;
            }
            .section {
              margin-bottom: 24px;
            }
            .section-title {
              font-weight: bold;
              color: #0d9488;
              margin-bottom: 8px;
              font-size: 14px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 16px;
              margin-bottom: 24px;
            }
            .info-item label {
              display: block;
              font-size: 11px;
              color: #6b7280;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 4px;
            }
            .info-item span {
              font-size: 14px;
            }
            .consent-box {
              background: #f0fdfa;
              border: 1px solid #99f6e4;
              border-radius: 8px;
              padding: 20px;
              margin: 24px 0;
            }
            .consent-box h3 {
              color: #0d9488;
              margin: 0 0 12px 0;
              font-size: 16px;
            }
            .consent-text {
              font-size: 13px;
              color: #374151;
            }
            .consent-text ul {
              margin: 12px 0;
              padding-left: 24px;
            }
            .consent-text li {
              margin-bottom: 8px;
            }
            .authorization-stamp {
              background: #dcfce7;
              border: 2px solid #22c55e;
              border-radius: 8px;
              padding: 20px;
              text-align: center;
              margin: 24px 0;
            }
            .authorization-stamp .checkmark {
              color: #22c55e;
              font-size: 36px;
              margin-bottom: 8px;
            }
            .authorization-stamp .status {
              color: #166534;
              font-weight: bold;
              font-size: 18px;
            }
            .authorization-stamp .timestamp {
              color: #374151;
              font-size: 14px;
              margin-top: 8px;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              font-size: 11px;
              color: #6b7280;
              text-align: center;
            }
            .disclaimer {
              background: #fffbeb;
              border: 1px solid #fcd34d;
              border-radius: 6px;
              padding: 12px;
              font-size: 11px;
              color: #92400e;
              margin-top: 24px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Background Check Authorization</h1>
            <h2>Rental Application Consent Record</h2>
          </div>

          <div class="section">
            <div class="section-title">Applicant Information</div>
            <div class="info-grid">
              <div class="info-item">
                <label>Full Name</label>
                <span>${person.firstName} ${person.lastName}</span>
              </div>
              <div class="info-item">
                <label>Email Address</label>
                <span>${person.email}</span>
              </div>
              <div class="info-item">
                <label>Role</label>
                <span>${person.role === 'applicant' ? 'Primary Applicant' : person.role === 'coapplicant' ? 'Co-Applicant' : 'Guarantor'}</span>
              </div>
              <div class="info-item">
                <label>Application Date</label>
                <span>${new Date(person.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Property Information</div>
            <div class="info-grid">
              <div class="info-item">
                <label>Property</label>
                <span>${property.name}</span>
              </div>
              <div class="info-item">
                <label>Unit</label>
                <span>${unit.unitLabel}</span>
              </div>
            </div>
          </div>

          <div class="consent-box">
            <h3>Disclosure Acknowledgment</h3>
            <div class="consent-text">
              <p>By submitting this rental application, the applicant acknowledged the following:</p>
              <ul>
                <li>A background screening may be requested in connection with the rental application</li>
                <li>The screening authorization will be collected directly by Western Verify through its screening platform DigitalDelve</li>
                <li>LeaseShield does not make rental decisions</li>
                <li>The background screening report may include credit history, rental history, employment-related information, criminal records, and eviction records as permitted by law</li>
              </ul>
              <p>The applicant authorized the verification of the information provided, including background and credit screening where permitted by law.</p>
            </div>
          </div>

          <div class="authorization-stamp">
            <div class="checkmark">✓</div>
            <div class="status">AUTHORIZED</div>
            <div class="timestamp">Consent recorded: ${consentDate}</div>
            ${(person.formJson as any)?.typedSignature ? `
              <div style="margin-top: 16px; padding-top: 16px; border-top: 1px dashed #86efac;">
                <div style="font-size: 12px; color: #374151; margin-bottom: 8px;">Electronic Signature:</div>
                <div style="font-family: 'Georgia', serif; font-style: italic; font-size: 20px; color: #166534;">${(person.formJson as any).typedSignature}</div>
              </div>
            ` : ''}
          </div>

          <div class="disclaimer">
            <strong>Important:</strong> This document serves as a record that the applicant acknowledged the background screening disclosure and authorized verification of their information during the rental application process. The actual background check authorization and consent are collected separately by Western Verify (DigitalDelve) in compliance with FCRA requirements.
          </div>

          <div class="footer">
            <p>Generated by LeaseShield on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p>Submission ID: ${submission.id}</p>
          </div>
        </body>
        </html>
      `;

        await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });
        const pdfData = await page.pdf({
          format: 'Letter',
          printBackground: true,
          margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' }
        });
        
        pdfBuffer = Buffer.from(pdfData);
      } finally {
        await browser.close();
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="consent-authorization-${person.firstName}-${person.lastName}.pdf"`);
      res.send(pdfBuffer);
    } catch (error: any) {
      console.error("Error generating consent PDF:", error?.message || error);
      console.error("Error stack:", error?.stack);
      res.status(500).json({ message: "Failed to generate consent PDF", error: error?.message });
    }
  });

  // Download full rental application as PDF
  app.get('/api/rental/submissions/:id/application-pdf', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const submission = await storage.getRentalSubmission(req.params.id);
      
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      // Verify ownership
      const appLink = submission.applicationLinkId ? await storage.getRentalApplicationLink(submission.applicationLinkId) : null;
      if (!appLink) {
        return res.status(404).json({ message: "Application link not found" });
      }
      const unit = await storage.getRentalUnit(appLink.unitId);
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }
      const property = await storage.getRentalProperty(unit.propertyId, userId);
      if (!property) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get all people for this submission
      const people = await storage.getRentalSubmissionPeople(submission.id);
      const decision = await storage.getRentalDecision(submission.id);

      // Helper functions
      const escapeHtml = (str: string | null | undefined): string => {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
      };

      const formatDate = (dateStr: string | null | undefined): string => {
        if (!dateStr) return 'N/A';
        return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      };

      const roleLabel = (role: string): string => {
        switch (role) {
          case 'applicant': return 'Primary Applicant';
          case 'coapplicant': return 'Co-Applicant';
          case 'guarantor': return 'Guarantor';
          default: return role;
        }
      };

      // Generate terms & policies section from cover page
      const generateTermsPoliciesSection = (link: any) => {
        const merged = link.mergedSchemaJson as any;
        const propertyTerms = merged?.propertyTerms || {};
        const coverPage = merged?.coverPage || {};
        const sections = coverPage?.sections || [];
        
        // Check if there's anything to show
        const hasPropertyTerms = propertyTerms.monthlyRent || propertyTerms.applicationFee || 
          propertyTerms.securityDeposit || propertyTerms.adminFee || propertyTerms.additionalNotes;
        const hasSections = sections.length > 0;
        
        if (!hasPropertyTerms && !hasSections) {
          return '';
        }
        
        let html = `<div class="terms-section">`;
        
        // Property Terms (rent, fees, deposits)
        if (hasPropertyTerms) {
          html += `
            <div class="property-terms">
              <h3>Property Terms &amp; Fees</h3>
              <div class="terms-grid">
                ${propertyTerms.monthlyRent ? `<div class="term-item"><label>Monthly Rent</label><span>${escapeHtml(propertyTerms.monthlyRent)}</span></div>` : ''}
                ${propertyTerms.applicationFee ? `<div class="term-item"><label>Application Fee</label><span>${escapeHtml(propertyTerms.applicationFee)}</span></div>` : ''}
                ${propertyTerms.securityDeposit ? `<div class="term-item"><label>Security Deposit</label><span>${escapeHtml(propertyTerms.securityDeposit)}</span></div>` : ''}
                ${propertyTerms.adminFee ? `<div class="term-item"><label>Admin/Move-in Fee</label><span>${escapeHtml(propertyTerms.adminFee)}</span></div>` : ''}
                ${propertyTerms.leaseSignDeadlineHours ? `<div class="term-item"><label>Lease Signing Deadline</label><span>${propertyTerms.leaseSignDeadlineHours} hours after approval</span></div>` : ''}
              </div>
              ${propertyTerms.additionalNotes ? `<div class="additional-notes"><label>Additional Notes</label><p>${escapeHtml(propertyTerms.additionalNotes)}</p></div>` : ''}
            </div>
          `;
        }
        
        // Cover Page Policies
        if (hasSections) {
          html += `
            <div class="policies-section">
              <h3>Application Requirements &amp; Policies</h3>
              ${sections.map((section: any) => `
                <div class="policy-item">
                  <strong>${escapeHtml(section.heading || '')}</strong>
                  <p>${escapeHtml(section.body || '')}</p>
                </div>
              `).join('')}
            </div>
          `;
        }
        
        html += `</div>`;
        return html;
      };

      // Generate acknowledgment record section
      const generateAcknowledgmentSection = (personList: any[]) => {
        const acknowledgedPeople = personList.filter(p => p.propertyTermsAcknowledgedAt);
        
        if (acknowledgedPeople.length === 0) {
          return '';
        }
        
        return `
          <div class="acknowledgment-section">
            <h3>Acknowledgment Record</h3>
            <p class="ack-intro">The following individuals acknowledged the property terms, fees, and application requirements shown above:</p>
            <div class="ack-list">
              ${acknowledgedPeople.map(person => `
                <div class="ack-item">
                  <span class="checkmark">&#10003;</span>
                  <span><strong>${escapeHtml(person.firstName)} ${escapeHtml(person.lastName)}</strong> (${roleLabel(person.role)}) acknowledged on ${formatDate(person.propertyTermsAcknowledgedAt)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      };

      // Generate person sections
      const generatePersonSection = (person: any, index: number) => {
        const formData = person.formJson || {};
        
        return `
          <div class="person-section ${index > 0 ? 'page-break' : ''}">
            <div class="person-header">
              <h2>${escapeHtml(person.firstName)} ${escapeHtml(person.lastName)}</h2>
              <span class="role-badge">${roleLabel(person.role)}</span>
            </div>
            
            <div class="info-section">
              <h3>Contact Information</h3>
              <div class="info-grid">
                <div class="info-item">
                  <label>Email</label>
                  <span>${escapeHtml(person.email)}</span>
                </div>
                ${formData.phone ? `
                <div class="info-item">
                  <label>Phone</label>
                  <span>${escapeHtml(formData.phone)}</span>
                </div>
                ` : ''}
                ${formData.dateOfBirth ? `
                <div class="info-item">
                  <label>Date of Birth</label>
                  <span>${escapeHtml(formData.dateOfBirth)}</span>
                </div>
                ` : ''}
                ${formData.driversLicense ? `
                <div class="info-item">
                  <label>Driver's License</label>
                  <span>${escapeHtml(formData.driversLicense)}</span>
                </div>
                ` : ''}
                ${formData.desiredMoveInDate ? `
                <div class="info-item">
                  <label>Desired Move-in</label>
                  <span>${formatDate(formData.desiredMoveInDate)}</span>
                </div>
                ` : ''}
                ${formData.hasHousingVoucher !== undefined ? `
                <div class="info-item">
                  <label>Housing Voucher</label>
                  <span>${formData.hasHousingVoucher ? `Yes${formData.voucherType ? ` - ${escapeHtml(formData.voucherType)}` : ''}` : 'No'}</span>
                </div>
                ` : ''}
                ${formData.referralSource ? `
                <div class="info-item">
                  <label>Referral Source</label>
                  <span>${escapeHtml(formData.referralSource === 'other' ? formData.referralSourceOther || 'Other' : formData.referralSource.replace(/_/g, ' '))}</span>
                </div>
                ` : ''}
              </div>
            </div>

            ${formData.occupants && Array.isArray(formData.occupants) && formData.occupants.length > 0 ? `
            <div class="info-section">
              <h3>Additional Occupants</h3>
              <div class="occupants-list">
                ${formData.occupants.map((occ: any, idx: number) => `
                  <div class="occupant-item">
                    <strong>${escapeHtml(occ.name || 'Occupant ' + (idx + 1))}</strong>
                    ${occ.relationship ? ` - ${escapeHtml(occ.relationship)}` : ''}
                    ${occ.age ? ` (Age: ${escapeHtml(occ.age)})` : ''}
                  </div>
                `).join('')}
              </div>
            </div>
            ` : ''}

            ${formData.currentAddress ? `
            <div class="info-section">
              <h3>Current Residence</h3>
              <div class="info-grid">
                <div class="info-item wide">
                  <label>Address</label>
                  <span>${escapeHtml(formData.currentAddress)}${formData.currentCity ? `, ${escapeHtml(formData.currentCity)}` : ''}${formData.currentState ? `, ${escapeHtml(formData.currentState)}` : ''} ${escapeHtml(formData.currentZip || '')}</span>
                </div>
                ${formData.currentLandlordName ? `
                <div class="info-item">
                  <label>Landlord Name</label>
                  <span>${escapeHtml(formData.currentLandlordName)}</span>
                </div>
                ` : ''}
                ${formData.currentLandlordPhone ? `
                <div class="info-item">
                  <label>Landlord Phone</label>
                  <span>${escapeHtml(formData.currentLandlordPhone)}</span>
                </div>
                ` : ''}
                ${formData.currentRent ? `
                <div class="info-item">
                  <label>Current Rent</label>
                  <span>$${escapeHtml(formData.currentRent)}/mo</span>
                </div>
                ` : ''}
                ${formData.moveInDate ? `
                <div class="info-item">
                  <label>Move-In Date</label>
                  <span>${escapeHtml(formData.moveInDate)}</span>
                </div>
                ` : ''}
                ${formData.reasonForMoving ? `
                <div class="info-item wide">
                  <label>Reason for Moving</label>
                  <span>${escapeHtml(formData.reasonForMoving)}</span>
                </div>
                ` : ''}
              </div>
            </div>
            ` : ''}

            ${formData.currentEmployer || formData.monthlyIncome ? `
            <div class="info-section">
              <h3>Employment &amp; Income</h3>
              <div class="info-grid">
                ${formData.currentEmployer ? `
                <div class="info-item">
                  <label>Employer</label>
                  <span>${escapeHtml(formData.currentEmployer)}</span>
                </div>
                ` : ''}
                ${formData.employerPhone ? `
                <div class="info-item">
                  <label>Employer Phone</label>
                  <span>${escapeHtml(formData.employerPhone)}</span>
                </div>
                ` : ''}
                ${formData.jobTitle ? `
                <div class="info-item">
                  <label>Job Title</label>
                  <span>${escapeHtml(formData.jobTitle)}</span>
                </div>
                ` : ''}
                ${formData.monthlyIncome ? `
                <div class="info-item">
                  <label>Monthly Income</label>
                  <span>$${escapeHtml(formData.monthlyIncome)}</span>
                </div>
                ` : ''}
                ${formData.employmentLength ? `
                <div class="info-item">
                  <label>Time at Job</label>
                  <span>${escapeHtml(formData.employmentLength)}</span>
                </div>
                ` : ''}
                ${formData.additionalIncome ? `
                <div class="info-item">
                  <label>Additional Income</label>
                  <span>$${escapeHtml(formData.additionalIncome)} (${escapeHtml(formData.additionalIncomeSource || 'Other')})</span>
                </div>
                ` : ''}
              </div>
            </div>
            ` : ''}

            ${formData.emergencyContactName || formData.emergencyContactPhone ? `
            <div class="info-section">
              <h3>Emergency Contact</h3>
              <div class="info-grid">
                ${formData.emergencyContactName ? `
                <div class="info-item">
                  <label>Name</label>
                  <span>${escapeHtml(formData.emergencyContactName)}</span>
                </div>
                ` : ''}
                ${formData.emergencyContactPhone ? `
                <div class="info-item">
                  <label>Phone</label>
                  <span>${escapeHtml(formData.emergencyContactPhone)}</span>
                </div>
                ` : ''}
                ${formData.emergencyContactRelationship ? `
                <div class="info-item">
                  <label>Relationship</label>
                  <span>${escapeHtml(formData.emergencyContactRelationship)}</span>
                </div>
                ` : ''}
              </div>
            </div>
            ` : ''}

            ${formData.personalReferences && Array.isArray(formData.personalReferences) && formData.personalReferences.length > 0 ? `
            <div class="info-section">
              <h3>Personal References</h3>
              <div class="references-list">
                ${formData.personalReferences.map((ref: any, idx: number) => `
                  <div class="reference-item">
                    <strong>${escapeHtml(ref.name || 'Reference ' + (idx + 1))}</strong>
                    ${ref.relationship ? ` (${escapeHtml(ref.relationship)})` : ''}
                    <div class="reference-contact">
                      ${ref.phone ? `<span>Phone: ${escapeHtml(ref.phone)}</span>` : ''}
                      ${ref.email ? `<span>Email: ${escapeHtml(ref.email)}</span>` : ''}
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
            ` : ''}

            ${formData.hasPets !== undefined || formData.smoker !== undefined || formData.hasBeenEvicted !== undefined || formData.hasFelony !== undefined ? `
            <div class="info-section">
              <h3>Additional Information</h3>
              <div class="info-grid">
                ${formData.hasPets !== undefined ? `
                <div class="info-item">
                  <label>Has Pets</label>
                  <span>${formData.hasPets ? 'Yes' : 'No'}</span>
                </div>
                ` : ''}
                ${formData.smoker !== undefined ? `
                <div class="info-item">
                  <label>Smoker</label>
                  <span>${formData.smoker ? 'Yes' : 'No'}</span>
                </div>
                ` : ''}
                ${formData.hasBeenEvicted !== undefined ? `
                <div class="info-item">
                  <label>Prior Eviction</label>
                  <span>${formData.hasBeenEvicted ? 'Yes' : 'No'}</span>
                </div>
                ` : ''}
                ${formData.hasFelony !== undefined ? `
                <div class="info-item">
                  <label>Felony Conviction</label>
                  <span>${formData.hasFelony ? 'Yes' : 'No'}</span>
                </div>
                ` : ''}
                ${(formData.smokesOrVapes !== undefined || formData.smoker !== undefined) ? `
                <div class="info-item">
                  <label>Smokes/Vapes</label>
                  <span>${(formData.smokesOrVapes ?? formData.smoker) ? 'Yes' : 'No'}</span>
                </div>
                ` : ''}
              </div>
              ${formData.pets && Array.isArray(formData.pets) && formData.pets.length > 0 ? `
              <div class="pets-list">
                <label>Pets:</label>
                <ul>
                  ${formData.pets.map((p: any) => `<li>${escapeHtml(p.type || '')} ${p.breed ? `(${escapeHtml(p.breed)})` : ''} ${p.weight ? `- ${escapeHtml(p.weight)} lbs` : ''} ${p.isServiceAnimal ? '- Service Animal' : ''}</li>`).join('')}
                </ul>
              </div>
              ` : ''}
              ${formData.vehicles && Array.isArray(formData.vehicles) && formData.vehicles.length > 0 ? `
              <div class="vehicles-list">
                <label>Vehicles:</label>
                <ul>
                  ${formData.vehicles.map((v: any) => `<li>${escapeHtml(v.year || '')} ${escapeHtml(v.make || '')} ${escapeHtml(v.model || '')} ${v.color ? `(${escapeHtml(v.color)})` : ''} ${v.licensePlate ? `- ${escapeHtml(v.licensePlate)}` : ''}</li>`).join('')}
                </ul>
              </div>
              ` : ''}
            </div>
            ` : ''}

            ${person.fcraAuthorized ? `
            <div class="fcra-authorization-box">
              <div class="fcra-header">
                <span class="checkmark">&#10003;</span>
                <span class="fcra-title">Background Screening Disclosure &amp; Acknowledgment</span>
                <span class="fcra-date">Acknowledged: ${formatDate(person.fcraAuthorizedTimestamp)}</span>
              </div>
              <div class="fcra-content">
                <p>As part of the rental application process, the landlord or property manager may request a background screening report about you for housing purposes.</p>
                <p class="fcra-subheading">If screening is requested:</p>
                <ul>
                  <li>You will receive a separate invitation directly from Western Verify, the consumer reporting agency, delivered through its screening platform DigitalDelve</li>
                  <li>That invitation will include a standalone disclosure and authorization, which you must review and complete before any consumer report is obtained</li>
                  <li>LeaseShield does not collect or store your Social Security number, date of birth, or screening authorization</li>
                </ul>
                <p>The background screening report, if obtained, may include information permitted by law, such as credit history, rental history, employment-related information, criminal records, and eviction records.</p>
                <p class="fcra-subheading">Adverse Action Notice:</p>
                <p>If adverse action is taken based in whole or in part on information contained in a consumer report, you will be provided an adverse action notice that includes:</p>
                <ul>
                  <li>The name, address, and phone number of the consumer reporting agency (Western Verify) that provided the report</li>
                  <li>A statement that the consumer reporting agency did not make the decision and cannot explain why the decision was made</li>
                  <li>Notice of your rights under the Fair Credit Reporting Act (FCRA), including your right to obtain a free copy of your consumer report and to dispute inaccurate or incomplete information</li>
                </ul>
                <p class="fcra-subheading">By acknowledging, applicant confirmed:</p>
                <ul>
                  <li>Understanding that a background screening may be requested in connection with the rental application</li>
                  <li>Understanding that any screening authorization will be collected directly by Western Verify, through its screening platform DigitalDelve, and not by LeaseShield</li>
                  <li>Understanding that LeaseShield does not make rental decisions</li>
                </ul>
              </div>
            </div>
            ` : `
            <div class="consent-status pending">
              <span>Background Check Authorization: Pending</span>
            </div>
            `}
          </div>
        `;
      };

      const primaryApplicant = people.find(p => p.role === 'applicant');

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            * { box-sizing: border-box; }
            body {
              font-family: 'Helvetica Neue', Arial, sans-serif;
              max-width: 850px;
              margin: 0 auto;
              padding: 40px;
              line-height: 1.5;
              color: #1a1a1a;
              font-size: 12px;
            }
            .header {
              text-align: center;
              border-bottom: 3px solid #0d9488;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .header h1 {
              color: #0d9488;
              margin: 0 0 8px 0;
              font-size: 26px;
              font-weight: 600;
            }
            .header .subtitle {
              color: #6b7280;
              font-size: 14px;
            }
            .property-info {
              background: #f0fdfa;
              border: 1px solid #99f6e4;
              border-radius: 8px;
              padding: 16px;
              margin-bottom: 24px;
            }
            .property-info h3 {
              margin: 0 0 12px 0;
              color: #0d9488;
              font-size: 14px;
            }
            .property-info .details {
              display: flex;
              gap: 32px;
              flex-wrap: wrap;
            }
            .property-info .detail-item label {
              display: block;
              font-size: 10px;
              color: #6b7280;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .property-info .detail-item span {
              font-size: 14px;
              font-weight: 500;
            }
            .person-section {
              margin-bottom: 32px;
              padding-bottom: 24px;
              border-bottom: 1px solid #e5e7eb;
            }
            .person-section:last-child {
              border-bottom: none;
            }
            .person-header {
              display: flex;
              align-items: center;
              gap: 12px;
              margin-bottom: 16px;
            }
            .person-header h2 {
              margin: 0;
              font-size: 18px;
              color: #1a1a1a;
            }
            .role-badge {
              background: #0d9488;
              color: white;
              padding: 4px 12px;
              border-radius: 12px;
              font-size: 11px;
              font-weight: 500;
            }
            .info-section {
              margin-bottom: 20px;
            }
            .info-section h3 {
              color: #374151;
              font-size: 13px;
              font-weight: 600;
              margin: 0 0 12px 0;
              padding-bottom: 6px;
              border-bottom: 1px solid #e5e7eb;
            }
            .info-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 12px;
            }
            .info-item {
              padding: 8px;
              background: #f9fafb;
              border-radius: 4px;
            }
            .info-item.wide {
              grid-column: span 2;
            }
            .info-item label {
              display: block;
              font-size: 10px;
              color: #6b7280;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 2px;
            }
            .info-item span {
              font-size: 12px;
              color: #1a1a1a;
            }
            .consent-status {
              display: flex;
              align-items: center;
              gap: 8px;
              padding: 12px 16px;
              border-radius: 6px;
              font-size: 12px;
              margin-top: 16px;
            }
            .consent-status.authorized {
              background: #dcfce7;
              color: #166534;
            }
            .consent-status.pending {
              background: #fef3c7;
              color: #92400e;
            }
            .consent-status .checkmark {
              font-size: 16px;
              font-weight: bold;
            }
            .pets-list, .vehicles-list {
              margin-top: 12px;
            }
            .pets-list label, .vehicles-list label {
              display: block;
              font-size: 11px;
              color: #6b7280;
              margin-bottom: 4px;
            }
            .pets-list ul, .vehicles-list ul {
              margin: 0;
              padding-left: 20px;
            }
            .pets-list li, .vehicles-list li {
              font-size: 12px;
              margin-bottom: 4px;
            }
            .occupants-list, .references-list {
              display: flex;
              flex-direction: column;
              gap: 8px;
            }
            .occupant-item, .reference-item {
              padding: 8px 12px;
              background: #f9fafb;
              border-radius: 4px;
              font-size: 12px;
            }
            .reference-contact {
              display: flex;
              gap: 16px;
              margin-top: 4px;
              font-size: 11px;
              color: #6b7280;
            }
            .decision-box {
              margin-top: 32px;
              padding: 20px;
              border-radius: 8px;
            }
            .decision-box.approved {
              background: #dcfce7;
              border: 2px solid #22c55e;
            }
            .decision-box.denied {
              background: #fef2f2;
              border: 2px solid #ef4444;
            }
            .decision-box h3 {
              margin: 0 0 12px 0;
              font-size: 16px;
            }
            .decision-box.approved h3 { color: #166534; }
            .decision-box.denied h3 { color: #991b1b; }
            .decision-box p {
              margin: 4px 0;
              font-size: 12px;
            }
            .footer {
              margin-top: 40px;
              padding-top: 16px;
              border-top: 1px solid #e5e7eb;
              text-align: center;
              font-size: 10px;
              color: #9ca3af;
            }
            .terms-section {
              margin-bottom: 28px;
              padding: 16px;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
            }
            .property-terms h3, .policies-section h3 {
              color: #0d9488;
              font-size: 14px;
              margin: 0 0 12px 0;
              padding-bottom: 6px;
              border-bottom: 1px solid #e5e7eb;
            }
            .terms-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 10px;
              margin-bottom: 12px;
            }
            .term-item {
              padding: 8px;
              background: white;
              border-radius: 4px;
              border: 1px solid #e5e7eb;
            }
            .term-item label {
              display: block;
              font-size: 10px;
              color: #6b7280;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 2px;
            }
            .term-item span {
              font-size: 13px;
              font-weight: 500;
              color: #1a1a1a;
            }
            .additional-notes {
              margin-top: 8px;
              padding: 10px;
              background: white;
              border-radius: 4px;
              border: 1px solid #e5e7eb;
            }
            .additional-notes label {
              display: block;
              font-size: 10px;
              color: #6b7280;
              text-transform: uppercase;
              margin-bottom: 4px;
            }
            .additional-notes p {
              margin: 0;
              font-size: 12px;
              color: #1a1a1a;
            }
            .policies-section {
              margin-top: 16px;
            }
            .policy-item {
              margin-bottom: 10px;
              padding: 8px 10px;
              background: white;
              border-radius: 4px;
              border-left: 3px solid #0d9488;
            }
            .policy-item strong {
              display: block;
              font-size: 12px;
              color: #374151;
              margin-bottom: 3px;
            }
            .policy-item p {
              margin: 0;
              font-size: 11px;
              color: #6b7280;
              line-height: 1.4;
            }
            .acknowledgment-section {
              margin-top: 32px;
              padding: 16px;
              background: #f0fdf4;
              border: 1px solid #bbf7d0;
              border-radius: 8px;
            }
            .acknowledgment-section h3 {
              color: #166534;
              font-size: 14px;
              margin: 0 0 8px 0;
            }
            .ack-intro {
              font-size: 11px;
              color: #374151;
              margin: 0 0 12px 0;
            }
            .ack-list {
              display: flex;
              flex-direction: column;
              gap: 8px;
            }
            .ack-item {
              display: flex;
              align-items: center;
              gap: 8px;
              padding: 8px 12px;
              background: white;
              border-radius: 4px;
              font-size: 12px;
            }
            .ack-item .checkmark {
              color: #22c55e;
              font-size: 16px;
              font-weight: bold;
            }
            .fcra-authorization-box {
              margin-top: 16px;
              background: #fef3c7;
              border: 1px solid #fcd34d;
              border-radius: 8px;
              padding: 12px 16px;
            }
            .fcra-header {
              display: flex;
              align-items: center;
              gap: 8px;
              margin-bottom: 12px;
              padding-bottom: 8px;
              border-bottom: 1px solid #fcd34d;
              flex-wrap: wrap;
            }
            .fcra-header .checkmark {
              color: #16a34a;
              font-size: 18px;
              font-weight: bold;
            }
            .fcra-title {
              font-weight: 600;
              font-size: 13px;
              color: #92400e;
            }
            .fcra-date {
              margin-left: auto;
              font-size: 11px;
              color: #b45309;
              font-weight: 500;
            }
            .fcra-content {
              font-size: 10px;
              color: #78350f;
              line-height: 1.5;
            }
            .fcra-content p {
              margin: 6px 0;
            }
            .fcra-content ul {
              margin: 6px 0 10px 0;
              padding-left: 18px;
            }
            .fcra-content li {
              margin-bottom: 3px;
            }
            .fcra-subheading {
              font-weight: 600;
              margin-top: 10px !important;
            }
            .page-break {
              page-break-before: always;
            }
            @media print {
              body { padding: 20px; }
              .page-break { page-break-before: always; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Rental Application</h1>
            <div class="subtitle">Submitted ${formatDate(submission.createdAt)}</div>
          </div>

          <div class="property-info">
            <h3>Property Information</h3>
            <div class="details">
              <div class="detail-item">
                <label>Property</label>
                <span>${escapeHtml(property.name)}</span>
              </div>
              <div class="detail-item">
                <label>Unit</label>
                <span>${escapeHtml(unit.unitLabel)}</span>
              </div>
              <div class="detail-item">
                <label>Status</label>
                <span>${submission.status}</span>
              </div>
            </div>
          </div>

          ${generateTermsPoliciesSection(appLink)}

          ${people.map((person, index) => generatePersonSection(person, index)).join('')}

          ${decision ? `
          <div class="decision-box ${decision.decision}">
            <h3>Application ${decision.decision === 'approved' ? 'Approved' : 'Denied'}</h3>
            <p><strong>Decision Date:</strong> ${formatDate(decision.decidedAt)}</p>
            ${decision.notes ? `<p><strong>Notes:</strong> ${escapeHtml(decision.notes)}</p>` : ''}
          </div>
          ` : ''}

          ${generateAcknowledgmentSection(people)}

          <div class="footer">
            <p>Generated by LeaseShield on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
            <p>Application ID: ${submission.id}</p>
          </div>
        </body>
        </html>
      `;

      // Generate PDF using Puppeteer
      const puppeteer = await import('puppeteer');
      const chromiumPath = execSync('which chromium').toString().trim();
      const browser = await puppeteer.default.launch({ 
        headless: true,
        executablePath: chromiumPath,
        timeout: 30000,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--single-process',
          '--no-zygote',
          '--disable-extensions',
          '--disable-background-networking',
        ]
      });
      
      let pdfBuffer: Buffer;
      try {
        const page = await browser.newPage();
        page.setDefaultTimeout(30000);

        await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });
        const pdfData = await page.pdf({
          format: 'Letter',
          printBackground: true,
          margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' }
        });
        
        pdfBuffer = Buffer.from(pdfData);
      } finally {
        await browser.close();
      }

      const fileName = primaryApplicant 
        ? `rental-application-${primaryApplicant.firstName}-${primaryApplicant.lastName}.pdf`
        : `rental-application-${submission.id.slice(0, 8)}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(pdfBuffer);
    } catch (error: any) {
      console.error("Error generating application PDF:", error?.message || error);
      console.error("Error stack:", error?.stack);
      res.status(500).json({ message: "Failed to generate application PDF", error: error?.message });
    }
  });

  // Request screening for a specific person in a submission (per-person model)
  app.post('/api/rental/submissions/:id/screening', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const submission = await storage.getRentalSubmission(req.params.id);
      
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      // Verify ownership
      const appLink = submission.applicationLinkId ? await storage.getRentalApplicationLink(submission.applicationLinkId) : null;
      if (!appLink) {
        return res.status(404).json({ message: "Application link not found" });
      }
      const unit = await storage.getRentalUnit(appLink.unitId);
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }
      const property = await storage.getRentalProperty(unit.propertyId, userId);
      if (!property) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { personId, invitationId } = req.body;
      
      // Get all people for this submission
      const people = await storage.getRentalSubmissionPeople(submission.id);
      
      // Find the target person - either by personId or default to primary applicant
      let targetPerson;
      if (personId) {
        targetPerson = people.find(p => p.id === personId);
        if (!targetPerson) {
          return res.status(404).json({ message: "Person not found in this submission" });
        }
      } else {
        // Legacy fallback: use primary applicant if no personId provided
        targetPerson = people.find(p => p.role === 'applicant');
        if (!targetPerson) {
          return res.status(400).json({ message: "No primary applicant found" });
        }
      }

      // SAFETY GUARDRAIL: Only allow screening for completed applications (signed with disclosure)
      if (!targetPerson.isCompleted) {
        return res.status(400).json({ message: "Cannot request screening until the applicant completes and signs their application" });
      }

      // Check if screening already exists for this person - allow retry for failed, not_sent, or sent (resend invitation)
      const existingOrder = await storage.getRentalScreeningOrderByPerson(targetPerson.id);
      const allowedRetryStatuses = ['error', 'not_sent', 'sent'];
      if (existingOrder && !allowedRetryStatuses.includes(existingOrder.status)) {
        return res.status(400).json({ message: `Screening already requested for ${targetPerson.firstName} ${targetPerson.lastName}` });
      }
      
      // If there's a failed or stuck order for this person (error/not_sent), delete it so we can send a fresh invitation
      // For 'sent' orders, we also delete and recreate since Western Verify AppScreen generates a new invitation each time
      if (existingOrder && allowedRetryStatuses.includes(existingOrder.status)) {
        await storage.deleteRentalScreeningOrder(existingOrder.id);
      }

      const formData = targetPerson.formJson as Record<string, any>;
      
      // Import DigitalDelve service and crypto
      const { processScreeningRequest } = await import('./digitalDelveService');
      const { decryptCredentials } = await import('./crypto');
      
      // Determine base URL for webhooks - use stable production domain
      // IMPORTANT: Use REPLIT_DOMAINS for consistent webhook URLs that Western Verify can reach
      const baseUrl = process.env.REPLIT_DOMAINS 
        ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
        : `${req.headers['x-forwarded-proto'] || req.protocol || 'https'}://${req.headers['x-forwarded-host'] || req.headers.host}`;
      
      // Resolve landlord's screening credentials if configured
      let screeningCredentials: { username: string; password: string; invitationId?: string } | undefined;
      const landlordCreds = await storage.getLandlordScreeningCredentials(userId);
      if (landlordCreds && landlordCreds.status === 'verified') {
        try {
          const decrypted = decryptCredentials({
            encryptedUsername: landlordCreds.encryptedUsername,
            encryptedPassword: landlordCreds.encryptedPassword,
            encryptionIv: landlordCreds.encryptionIv,
          });
          screeningCredentials = {
            username: decrypted.username,
            password: decrypted.password,
            invitationId: landlordCreds.defaultInvitationId || undefined,
          };
        } catch (e) {
          console.error("Failed to decrypt landlord credentials, falling back to system credentials");
        }
      }
      
      const result = await processScreeningRequest(
        submission.id,
        {
          firstName: targetPerson.firstName || "",
          lastName: targetPerson.lastName || "",
          email: targetPerson.email || "",
          phone: targetPerson.phone || formData.phone,
          ssn: formData.ssn,
          dob: formData.dob,
          address: formData.currentAddress,
          city: formData.currentCity,
          state: formData.currentState,
          zip: formData.currentZip,
        },
        baseUrl,
        invitationId,
        screeningCredentials,
        targetPerson.id
      );

      if (result.success) {
        // Auto-update submission status based on screening progress
        await updateSubmissionStatusFromScreening(submission.id);
        
        // Log event with personId
        await storage.logRentalApplicationEvent({
          submissionId: submission.id,
          eventType: 'screening_requested',
          metadataJson: { orderId: result.order?.id, personId: targetPerson.id, personName: `${targetPerson.firstName} ${targetPerson.lastName}` },
        });
        
        // Track analytics event for dashboard
        await storage.trackEvent({
          userId,
          eventType: 'screening_request',
          eventData: { submissionId: submission.id, personId: targetPerson.id, personName: `${targetPerson.firstName} ${targetPerson.lastName}` },
        });
        
        res.json({ success: true, order: result.order });
      } else {
        console.error("Screening request failed:", result.error);
        res.status(500).json({ message: result.error || "Failed to request screening" });
      }
    } catch (error: any) {
      console.error("Error requesting screening:", error?.message || error);
      console.error("Stack:", error?.stack);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  // Redirect to Western Verify report lookup page
  // NOTE: Full SSO auto-login is not possible without exposing credentials to the browser.
  // Western Verify's SSO requires browser-based form submission to set session cookies.
  // For security, we redirect landlords to the report lookup page where they can log in.
  app.get('/api/rental/screening/:orderId/view-report', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { orderId } = req.params;

      // Get the screening order to verify it exists
      const order = await storage.getRentalScreeningOrderById(orderId);
      if (!order) {
        return res.status(404).json({ message: "Screening order not found" });
      }

      // Verify ownership via submission
      const submission = await storage.getRentalSubmission(order.submissionId);
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      const appLink = submission.applicationLinkId ? await storage.getRentalApplicationLink(submission.applicationLinkId) : null;
      if (!appLink) {
        return res.status(404).json({ message: "Application link not found" });
      }
      const unit = await storage.getRentalUnit(appLink.unitId);
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }
      const property = await storage.getRentalProperty(unit.propertyId, userId);
      if (!property) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Redirect to Western Verify report lookup page
      res.redirect('https://secure.westernverify.com/report_lookup.cfm');
    } catch (error: any) {
      console.error("Error redirecting to report:", error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  // Resend invitation email to incomplete co-applicant/guarantor
  app.post('/api/rental/submissions/:submissionId/people/:personId/resend-invite', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { submissionId, personId } = req.params;

      // Get and verify submission ownership
      const submission = await storage.getRentalSubmission(submissionId);
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      // Verify landlord owns this submission
      const appLink = await storage.getRentalApplicationLink(submission.applicationLinkId);
      if (!appLink) {
        return res.status(404).json({ message: "Application link not found" });
      }
      const unit = await storage.getRentalUnit(appLink.unitId);
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }
      const property = await storage.getRentalProperty(unit.propertyId, userId);
      if (!property) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get the person
      const people = await storage.getRentalSubmissionPeople(submissionId);
      const person = people.find(p => p.id === personId);
      if (!person) {
        return res.status(404).json({ message: "Person not found" });
      }

      // Check person is incomplete
      if (person.isCompleted) {
        return res.status(400).json({ message: "This person has already completed their application" });
      }

      // Build the invite URL
      const inviteUrl = `/apply/person/${person.inviteToken}`;
      const propertyName = property.name + (unit.unitLabel ? ` - ${unit.unitLabel}` : '');

      // Find the primary applicant for the "invited by" info
      const primaryApplicant = people.find(p => p.role === 'applicant' && p.isCompleted);

      // Get landlord info for email
      const landlord = await storage.getUser(userId);
      const landlordEmailInfo = landlord ? {
        businessName: landlord.businessName || undefined,
        phoneNumber: landlord.phoneNumber || undefined,
      } : undefined;

      // Send the invite email
      await emailService.sendCoApplicantInviteEmail(
        { email: person.email || '', firstName: person.firstName || '', lastName: person.lastName || '' },
        { firstName: primaryApplicant?.firstName || 'Applicant', lastName: primaryApplicant?.lastName || '' },
        propertyName,
        inviteUrl,
        person.role as 'coapplicant' | 'guarantor',
        landlordEmailInfo
      );

      // Log event
      await storage.logRentalApplicationEvent({
        submissionId,
        eventType: 'invitation_resent',
        metadataJson: { personId, email: person.email, role: person.role },
      });

      console.log(`✅ Resent invitation to ${person.email} for submission ${submissionId}`);
      res.json({ success: true, message: "Invitation resent successfully" });
    } catch (error: any) {
      console.error("Error resending invitation:", error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  // Delete a co-applicant or guarantor from submission
  app.delete('/api/rental/submissions/:submissionId/people/:personId', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { submissionId, personId } = req.params;

      // Get and verify submission ownership
      const submission = await storage.getRentalSubmission(submissionId);
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      // Verify landlord owns this submission
      const appLink = await storage.getRentalApplicationLink(submission.applicationLinkId);
      if (!appLink) {
        return res.status(404).json({ message: "Application link not found" });
      }
      const unit = await storage.getRentalUnit(appLink.unitId);
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }
      const property = await storage.getRentalProperty(unit.propertyId, userId);
      if (!property) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get the person
      const people = await storage.getRentalSubmissionPeople(submissionId);
      const person = people.find(p => p.id === personId);
      if (!person) {
        return res.status(404).json({ message: "Person not found" });
      }

      // Cannot delete the primary applicant
      if (person.role === 'applicant') {
        return res.status(400).json({ message: "Cannot delete the primary applicant. Delete the entire submission instead." });
      }

      // Delete the person
      await storage.deleteRentalSubmissionPerson(personId);

      // Log event
      await storage.logRentalApplicationEvent({
        submissionId,
        eventType: 'person_removed',
        metadataJson: { 
          personId, 
          personName: `${person.firstName} ${person.lastName}`,
          role: person.role,
          removedBy: userId 
        },
      });

      console.log(`✅ Deleted person ${personId} from submission ${submissionId}`);
      res.json({ success: true, message: "Person removed successfully" });
    } catch (error: any) {
      console.error("Error deleting person:", error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  // Get available screening invitations (packages)
  app.get('/api/rental/screening/invitations', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const { retrieveInvitations } = await import('./digitalDelveService');
      const result = await retrieveInvitations();
      
      if (result.success) {
        res.json(result.invitations || []);
      } else {
        res.status(500).json({ message: result.error || "Failed to retrieve invitations" });
      }
    } catch (error) {
      console.error("Error getting screening invitations:", error);
      res.status(500).json({ message: "Failed to get screening invitations" });
    }
  });

  // Verify DigitalDelve credentials
  app.post('/api/rental/screening/verify', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const { verifyCredentials } = await import('./digitalDelveService');
      const result = await verifyCredentials();
      
      res.json({ success: result.success, error: result.error });
    } catch (error: any) {
      console.error("Error verifying credentials:", error);
      res.status(500).json({ success: false, error: "Something went wrong. Please try again." });
    }
  });

  // Get SSO URL to view report - by submissionId
  app.get('/api/rental/submissions/:submissionId/screening/report-url', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      
      // Get the order by submissionId
      const order = await storage.getRentalScreeningOrder(req.params.submissionId);
      if (!order) {
        return res.status(404).json({ message: "Screening order not found" });
      }

      // Verify ownership via submission
      const submission = await storage.getRentalSubmission(order.submissionId);
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      const appLink = submission.applicationLinkId ? await storage.getRentalApplicationLink(submission.applicationLinkId) : null;
      if (!appLink) {
        return res.status(404).json({ message: "Application link not found" });
      }
      const unit = await storage.getRentalUnit(appLink.unitId);
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }
      const property = await storage.getRentalProperty(unit.propertyId, userId);
      if (!property) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Direct to Western Verify login page for compliance
      res.json({ url: 'https://secure.westernverify.com/login.cfm' });
    } catch (error) {
      console.error("Error getting report URL:", error);
      res.status(500).json({ message: "Failed to get report URL" });
    }
  });

  // Get SSO URL to view report (by orderId - for per-person screening)
  app.get('/api/rental/screening/:orderId/report-url', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      
      // Get the order by its ID
      const order = await storage.getRentalScreeningOrderById(req.params.orderId);
      if (!order) {
        return res.status(404).json({ message: "Screening order not found" });
      }

      // Verify ownership via submission
      const submission = await storage.getRentalSubmission(order.submissionId);
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      const appLink = submission.applicationLinkId ? await storage.getRentalApplicationLink(submission.applicationLinkId) : null;
      if (!appLink) {
        return res.status(404).json({ message: "Application link not found" });
      }
      const unit = await storage.getRentalUnit(appLink.unitId);
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }
      const property = await storage.getRentalProperty(unit.propertyId, userId);
      if (!property) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Direct to Western Verify login page for compliance
      res.json({ url: 'https://secure.westernverify.com/login.cfm' });
    } catch (error) {
      console.error("Error getting report URL:", error);
      res.status(500).json({ message: "Failed to get report URL" });
    }
  });

  // Sync screening status by checking if report is available
  // This is useful when webhooks are missed or delayed
  app.post('/api/rental/screening/:orderId/sync', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      
      const order = await storage.getRentalScreeningOrderById(req.params.orderId);
      if (!order) {
        return res.status(404).json({ message: "Screening order not found" });
      }

      const submission = await storage.getRentalSubmission(order.submissionId);
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      const appLink = submission.applicationLinkId ? await storage.getRentalApplicationLink(submission.applicationLinkId) : null;
      if (!appLink) {
        return res.status(404).json({ message: "Application link not found" });
      }
      const unit = await storage.getRentalUnit(appLink.unitId);
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }
      const property = await storage.getRentalProperty(unit.propertyId, userId);
      if (!property) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get credentials for sync
      const storedCredentials = await storage.getLandlordScreeningCredentials(userId);
      if (!storedCredentials || !storedCredentials.encryptedUsername || !storedCredentials.encryptedPassword) {
        return res.status(400).json({ message: "Screening credentials not configured" });
      }

      // Decrypt credentials before using
      const { decryptCredentials } = await import('./crypto');
      let credentials;
      try {
        const decrypted = decryptCredentials({
          encryptedUsername: storedCredentials.encryptedUsername,
          encryptedPassword: storedCredentials.encryptedPassword,
          encryptionIv: storedCredentials.encryptionIv,
        });
        credentials = {
          username: decrypted.username,
          password: decrypted.password,
        };
      } catch (e) {
        console.error("Failed to decrypt credentials:", e);
        return res.status(400).json({ message: "Failed to decrypt credentials" });
      }

      const { syncScreeningStatus } = await import('./digitalDelveService');
      const result = await syncScreeningStatus(req.params.orderId, credentials);

      res.json(result);
    } catch (error) {
      console.error("Error syncing screening status:", error);
      res.status(500).json({ message: "Failed to sync status" });
    }
  });

  // Bulk sync all pending screenings for the current user
  app.post('/api/rental/screening/bulk-sync', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      
      const storedCredentials = await storage.getLandlordScreeningCredentials(userId);
      if (!storedCredentials || !storedCredentials.encryptedUsername || !storedCredentials.encryptedPassword) {
        return res.json({ synced: 0, completed: 0, errors: 0, message: 'no_credentials' });
      }

      const { decryptCredentials } = await import('./crypto');
      let credentials;
      try {
        const decrypted = decryptCredentials({
          encryptedUsername: storedCredentials.encryptedUsername,
          encryptedPassword: storedCredentials.encryptedPassword,
          encryptionIv: storedCredentials.encryptionIv,
        });
        credentials = { username: decrypted.username, password: decrypted.password };
      } catch (e) {
        return res.json({ synced: 0, completed: 0, errors: 0, message: 'credential_error' });
      }

      const { bulkSyncScreeningStatuses } = await import('./digitalDelveService');
      const result = await bulkSyncScreeningStatuses(userId, credentials);
      
      res.json(result);
    } catch (error) {
      console.error("Error in bulk screening sync:", error);
      res.status(500).json({ message: "Failed to sync screening statuses" });
    }
  });

  // ============================================================
  // WEBHOOK ROUTES (No Auth - called by DigitalDelve)
  // ============================================================

  function verifyWebhookToken(token: string | undefined): boolean {
    const webhookSecret = process.env.DIGITAL_DELVE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.warn("DIGITAL_DELVE_WEBHOOK_SECRET not set - webhooks are unprotected");
      return true;
    }
    return token === webhookSecret;
  }

  // Helper to extract XML from webhook body (handles both raw XML and form-urlencoded)
  function extractXmlFromWebhookBody(req: any): string {
    // Western Verify sends webhooks as application/x-www-form-urlencoded with XML in 'request' param
    if (req.body && typeof req.body === 'object' && req.body.request) {
      console.log("[Webhook] Extracted XML from form-urlencoded 'request' parameter");
      return req.body.request;
    }
    // Fallback to raw body if sent as plain XML
    if (typeof req.body === 'string') {
      return req.body;
    }
    return '';
  }

  // Status update webhook from DigitalDelve
  app.post('/api/webhooks/digitaldelve/status', async (req, res) => {
    try {
      const token = req.query.token as string | undefined;
      if (!verifyWebhookToken(token)) {
        console.warn("Invalid webhook token received for status webhook");
        return res.status(401).send("Unauthorized");
      }

      console.log("Received DigitalDelve status webhook");
      console.log("[Webhook] Content-Type:", req.headers['content-type']);
      console.log("[Webhook] Body type:", typeof req.body);
      console.log("[Webhook] Body keys:", req.body && typeof req.body === 'object' ? Object.keys(req.body) : 'N/A');
      
      const xml = extractXmlFromWebhookBody(req);
      
      if (!xml || xml.length < 20 || !xml.includes('<')) {
        console.warn("Invalid XML body received:", xml?.substring(0, 100));
        return res.status(400).send("Invalid XML body");
      }

      console.log("[Webhook] Parsed XML (first 500 chars):", xml.substring(0, 500));

      const { handleStatusWebhook } = await import('./digitalDelveService');
      const result = await handleStatusWebhook(xml);
      
      if (result.success) {
        // Auto-update submission status based on screening progress
        if (result.submissionId) {
          await updateSubmissionStatusFromScreening(result.submissionId);
        }
        res.status(200).send("OK");
      } else {
        res.status(400).send("Failed to process webhook");
      }
    } catch (error) {
      console.error("Error processing status webhook:", error);
      res.status(500).send("Internal error");
    }
  });

  // Result webhook from DigitalDelve
  app.post('/api/webhooks/digitaldelve/result', async (req, res) => {
    try {
      const token = req.query.token as string | undefined;
      if (!verifyWebhookToken(token)) {
        console.warn("Invalid webhook token received for result webhook");
        return res.status(401).send("Unauthorized");
      }

      console.log("Received DigitalDelve result webhook");
      console.log("[Webhook] Content-Type:", req.headers['content-type']);
      console.log("[Webhook] Body type:", typeof req.body);
      console.log("[Webhook] Body keys:", req.body && typeof req.body === 'object' ? Object.keys(req.body) : 'N/A');
      
      const xml = extractXmlFromWebhookBody(req);
      
      if (!xml || xml.length < 20 || !xml.includes('<')) {
        console.warn("Invalid XML body received:", xml?.substring(0, 100));
        return res.status(400).send("Invalid XML body");
      }

      console.log("[Webhook] Parsed XML (first 500 chars):", xml.substring(0, 500));

      const { handleResultWebhook } = await import('./digitalDelveService');
      const result = await handleResultWebhook(xml);
      
      if (result.success) {
        // Auto-update submission status based on screening progress
        if (result.submissionId) {
          await updateSubmissionStatusFromScreening(result.submissionId);
        }
        res.status(200).send("OK");
      } else {
        res.status(400).send("Failed to process webhook");
      }
    } catch (error) {
      console.error("Error processing result webhook:", error);
      res.status(500).send("Internal error");
    }
  });

  // ============================================================
  // PUBLIC RENTAL APPLICATION ROUTES (No Auth Required)
  // ============================================================

  // Get application link data by public token (for applicants)
  app.get('/api/apply/:token', async (req, res) => {
    try {
      const link = await storage.getRentalApplicationLinkByToken(req.params.token);
      
      if (!link) {
        return res.status(404).json({ message: "Application link not found" });
      }
      
      if (!link.isActive) {
        return res.status(410).json({ message: "This application link is no longer active" });
      }
      
      if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
        return res.status(410).json({ message: "This application link has expired" });
      }

      // Get document requirements for this link
      const documentRequirements = await storage.getEffectiveDocumentRequirements(link.id);

      // Get the property state and current field schema via unit -> property chain
      let propertyState: string | null = null;
      let currentFieldSchema: any = (link.mergedSchemaJson as any)?.fieldSchema;
      if (link.unitId) {
        const unit = await storage.getRentalUnit(link.unitId);
        if (unit?.propertyId) {
          const property = await storage.getRentalPropertyById(unit.propertyId);
          propertyState = property?.state || null;
          // Use fresh field schema from property (allows landlord to update settings without creating new links)
          if (unit.fieldSchemaOverrideEnabled && unit.fieldSchemaOverrideJson) {
            currentFieldSchema = unit.fieldSchemaOverrideJson;
          } else if (property?.defaultFieldSchemaJson) {
            currentFieldSchema = property.defaultFieldSchemaJson;
          }
        }
      }

      // Get active compliance rules for this state
      const complianceRules = propertyState 
        ? await storage.getActiveComplianceRulesForState(propertyState)
        : await storage.getActiveComplianceRulesForState('ALL');

      // Build propertyTerms with live rent from unit (authoritative when set)
      const cachedTerms = (link.mergedSchemaJson as any)?.propertyTerms || {};
      let livePropertyTerms = { ...cachedTerms };
      if (link.unitId) {
        const liveUnit = await storage.getRentalUnit(link.unitId);
        if (liveUnit) {
          if (liveUnit.rentAmount != null) {
            livePropertyTerms.monthlyRent = `$${(liveUnit.rentAmount / 100).toLocaleString()}/mo`;
          }
          if (liveUnit.unitLabel !== undefined) {
            (link.mergedSchemaJson as any).unitLabel = liveUnit.unitLabel || "";
          }
        }
      }

      // Return only the merged schema (cover page + fields) - no sensitive data
      res.json({
        id: link.id,
        propertyName: (link.mergedSchemaJson as any)?.propertyName || "Property",
        unitLabel: (link.mergedSchemaJson as any)?.unitLabel || "",
        coverPage: (link.mergedSchemaJson as any)?.coverPage,
        fieldSchema: currentFieldSchema,
        propertyTerms: livePropertyTerms,
        documentRequirements,
        propertyState, // For state-specific compliance (e.g., TX tenant selection criteria)
        complianceRules, // Dynamic compliance rules from database
      });
    } catch (error) {
      console.error("Error getting application link:", error);
      res.status(500).json({ message: "Failed to load application" });
    }
  });

  // Get application link data by ID (for invite flows)
  app.get('/api/apply/link/:linkId', async (req, res) => {
    try {
      const link = await storage.getRentalApplicationLink(req.params.linkId);
      
      if (!link) {
        return res.status(404).json({ message: "Application link not found" });
      }
      
      if (!link.isActive) {
        return res.status(410).json({ message: "This application link is no longer active" });
      }
      
      if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
        return res.status(410).json({ message: "This application link has expired" });
      }

      // Get document requirements for this link
      const documentRequirements = await storage.getEffectiveDocumentRequirements(link.id);

      // Get the property state and current field schema via unit -> property chain
      let propertyState: string | null = null;
      let currentFieldSchema: any = (link.mergedSchemaJson as any)?.fieldSchema;
      if (link.unitId) {
        const unit = await storage.getRentalUnit(link.unitId);
        if (unit?.propertyId) {
          const property = await storage.getRentalPropertyById(unit.propertyId);
          propertyState = property?.state || null;
          // Use fresh field schema from property (allows landlord to update settings without creating new links)
          if (unit.fieldSchemaOverrideEnabled && unit.fieldSchemaOverrideJson) {
            currentFieldSchema = unit.fieldSchemaOverrideJson;
          } else if (property?.defaultFieldSchemaJson) {
            currentFieldSchema = property.defaultFieldSchemaJson;
          }
        }
      }

      // Get active compliance rules for this state
      const complianceRules = propertyState 
        ? await storage.getActiveComplianceRulesForState(propertyState)
        : await storage.getActiveComplianceRulesForState('ALL');

      // Build propertyTerms with live rent from unit (authoritative when set)
      const cachedTerms2 = (link.mergedSchemaJson as any)?.propertyTerms || {};
      let livePropertyTerms2 = { ...cachedTerms2 };
      if (link.unitId) {
        const liveUnit = await storage.getRentalUnit(link.unitId);
        if (liveUnit) {
          if (liveUnit.rentAmount != null) {
            livePropertyTerms2.monthlyRent = `$${(liveUnit.rentAmount / 100).toLocaleString()}/mo`;
          }
          if (liveUnit.unitLabel !== undefined) {
            (link.mergedSchemaJson as any).unitLabel = liveUnit.unitLabel || "";
          }
        }
      }

      res.json({
        id: link.id,
        propertyName: (link.mergedSchemaJson as any)?.propertyName || "Property",
        unitLabel: (link.mergedSchemaJson as any)?.unitLabel || "",
        coverPage: (link.mergedSchemaJson as any)?.coverPage,
        fieldSchema: currentFieldSchema,
        propertyTerms: livePropertyTerms2,
        documentRequirements,
        propertyState,
        complianceRules,
      });
    } catch (error) {
      console.error("Error getting application link by ID:", error);
      res.status(500).json({ message: "Failed to load application" });
    }
  });

  // Start a new rental submission
  app.post('/api/apply/:token/start', async (req, res) => {
    try {
      const link = await storage.getRentalApplicationLinkByToken(req.params.token);
      
      if (!link || !link.isActive) {
        return res.status(404).json({ message: "Application link not found or inactive" });
      }
      
      if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
        return res.status(410).json({ message: "This application link has expired" });
      }

      const { email, firstName, lastName, personType, propertyTermsAcknowledgedAt } = req.body;
      
      if (!email || !firstName || !lastName) {
        return res.status(400).json({ message: "Email, first name, and last name are required" });
      }

      // Create submission
      const submission = await storage.createRentalSubmission({
        applicationLinkId: link.id,
        status: "started",
      });

      // Create primary applicant person
      const person = await storage.createRentalSubmissionPerson({
        submissionId: submission.id,
        role: "applicant",
        email,
        firstName,
        lastName,
        formJson: {},
        inviteToken: randomUUID().replace(/-/g, ''),
        propertyTermsAcknowledgedAt: propertyTermsAcknowledgedAt ? new Date(propertyTermsAcknowledgedAt) : null,
      });

      // Log event
      await storage.logRentalApplicationEvent({
        submissionId: submission.id,
        eventType: "submission_started",
        metadataJson: { personId: person.id, email, firstName, lastName },
      });

      res.status(201).json({
        submissionId: submission.id,
        personId: person.id,
        personToken: person.inviteToken,
      });
    } catch (error) {
      console.error("Error starting application:", error);
      res.status(500).json({ message: "Failed to start application" });
    }
  });

  // Save form progress (autosave)
  app.patch('/api/apply/person/:personToken', async (req, res) => {
    try {
      const person = await storage.getRentalSubmissionPersonByToken(req.params.personToken);
      
      if (!person) {
        return res.status(404).json({ message: "Application not found" });
      }

      const { formData } = req.body;

      await storage.updateRentalSubmissionPerson(person.id, {
        formJson: formData,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error saving form progress:", error);
      res.status(500).json({ message: "Failed to save progress" });
    }
  });

  // Get person's form data (for resuming)
  app.get('/api/apply/person/:personToken', async (req, res) => {
    try {
      const person = await storage.getRentalSubmissionPersonByToken(req.params.personToken);
      
      if (!person) {
        return res.status(404).json({ message: "Application not found" });
      }

      // Get submission to check status
      const submission = await storage.getRentalSubmission(person.submissionId);

      res.json({
        personId: person.id,
        personType: person.role,
        email: person.email,
        firstName: person.firstName,
        lastName: person.lastName,
        formData: person.formJson,
        submissionStatus: submission?.status || "started",
        isCompleted: person.isCompleted, // Person's individual completion status
        applicationLinkId: submission?.applicationLinkId || null, // For invite flows to fetch link data
      });
    } catch (error) {
      console.error("Error getting person data:", error);
      res.status(500).json({ message: "Failed to load application data" });
    }
  });

  // Submit completed application
  app.post('/api/apply/person/:personToken/submit', async (req, res) => {
    try {
      const person = await storage.getRentalSubmissionPersonByToken(req.params.personToken);
      
      if (!person) {
        return res.status(404).json({ message: "Application not found" });
      }

      // Capture screening disclosure acknowledgment audit data
      const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 
                        req.socket.remoteAddress || 
                        'unknown';
      const userAgent = req.body.userAgent || req.headers['user-agent'] || 'unknown';
      const disclosureVersion = 'v1.0-2024-12-18'; // Immutable version identifier for this disclosure text

      // Extract compliance acknowledgment data from form
      const formData = req.body.formData || person.formJson || {};
      
      // Handle dynamic compliance rules - extract all compliance_* fields
      // Also support legacy field names for backwards compatibility
      const txSelectionAcknowledged = formData.compliance_tx_tenant_selection === true || formData.txSelectionAcknowledged === true;
      const fcraAuthorized = formData.compliance_fcra_authorization === true || formData.fcraAuthorized === true;
      
      // Collect all compliance acknowledgments for audit trail
      const complianceAcknowledgments: Record<string, { acknowledged: boolean; timestamp: string; ip: string }> = {};
      for (const [key, value] of Object.entries(formData)) {
        if (key.startsWith('compliance_') && value === true) {
          const ruleKey = key.replace('compliance_', '');
          complianceAcknowledgments[ruleKey] = {
            acknowledged: true,
            timestamp: new Date().toISOString(),
            ip: ipAddress,
          };
        }
      }
      
      // Store compliance acknowledgments in formData for audit trail
      const enrichedFormData = {
        ...formData,
        _complianceAuditTrail: complianceAcknowledgments,
        _submissionMetadata: {
          ipAddress,
          userAgent,
          timestamp: new Date().toISOString(),
        },
      };

      // Update person as completed with screening disclosure and compliance metadata
      await storage.updateRentalSubmissionPerson(person.id, {
        formJson: enrichedFormData,
        isCompleted: true,
        completedAt: new Date(),
        screeningDisclosureAcknowledgedAt: new Date(),
        screeningDisclosureIpAddress: ipAddress,
        screeningDisclosureUserAgent: userAgent,
        screeningDisclosureVersion: disclosureVersion,
        // TX-specific tenant selection criteria acknowledgment
        txSelectionAcknowledged: txSelectionAcknowledged,
        txSelectionAckTimestamp: txSelectionAcknowledged ? new Date() : null,
        txSelectionAckIp: txSelectionAcknowledged ? ipAddress : null,
        // FCRA authorization (all states)
        fcraAuthorized: fcraAuthorized,
        fcraAuthorizedTimestamp: fcraAuthorized ? new Date() : null,
      });

      // Check if all people have completed
      const allPeople = await storage.getRentalSubmissionPeople(person.submissionId);
      const allCompleted = allPeople.every(p => 
        p.id === person.id || p.isCompleted
      );

      // Update submission status
      await storage.updateRentalSubmission(person.submissionId, {
        status: allCompleted ? "submitted" : "started",
        submittedAt: allCompleted ? new Date() : null,
      });

      // Log event
      await storage.logRentalApplicationEvent({
        submissionId: person.submissionId,
        eventType: "application_submitted",
        metadataJson: { personId: person.id },
      });

      // Auto-screening: If all completed and property has autoScreening enabled, trigger screening
      if (allCompleted) {
        try {
          const submission = await storage.getRentalSubmission(person.submissionId);
          if (submission) {
            const link = await storage.getRentalApplicationLink(submission.applicationLinkId);
            if (link) {
              const unit = await storage.getRentalUnit(link.unitId);
              if (unit) {
                const property = await storage.getRentalPropertyById(unit.propertyId);
                if (property && (property as any).autoScreening) {
                  // Auto-request screening for primary applicant (mirror manual screening flow)
                  // Note: AppScreen sends an invitation email - applicant enters SSN directly on Western Verify portal
                  const primaryApplicant = allPeople.find(p => p.role === 'applicant') || person;
                  const formData = (primaryApplicant.formJson as Record<string, any>) || {};
                  
                  // Check if screening already exists for this person (per-person model)
                  const existingOrder = await storage.getRentalScreeningOrderByPerson(primaryApplicant.id);
                  
                  // Only need name and email for AppScreen invitation flow
                  const hasRequiredData = primaryApplicant.firstName && 
                                         primaryApplicant.lastName && 
                                         primaryApplicant.email;
                  
                  if (!existingOrder && hasRequiredData) {
                    // Import DigitalDelve service and crypto
                    const { processScreeningRequest } = await import('./digitalDelveService');
                    const { decryptCredentials } = await import('./crypto');
                    
                    // Construct base URL for webhook callbacks - use stable production domain
                    const baseUrl = process.env.REPLIT_DOMAINS 
                      ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
                      : `${req.headers['x-forwarded-proto'] || req.protocol || 'https'}://${req.headers['x-forwarded-host'] || req.headers.host}`;
                    
                    // Resolve landlord's screening credentials if configured
                    let screeningCredentials: { username: string; password: string; invitationId?: string } | undefined;
                    const landlordCreds = await storage.getLandlordScreeningCredentials(property.userId);
                    if (landlordCreds && landlordCreds.status === 'verified') {
                      try {
                        const decrypted = decryptCredentials({
                          encryptedUsername: landlordCreds.encryptedUsername,
                          encryptedPassword: landlordCreds.encryptedPassword,
                          encryptionIv: landlordCreds.encryptionIv,
                        });
                        screeningCredentials = {
                          username: decrypted.username,
                          password: decrypted.password,
                          invitationId: landlordCreds.defaultInvitationId || undefined,
                        };
                      } catch (e) {
                        console.error("Failed to decrypt landlord credentials, falling back to system credentials");
                      }
                    }
                    
                    // Build applicant data - SSN/DOB collected by Western Verify portal directly
                    // Pass all available fields for consistency with manual flow
                    const result = await processScreeningRequest(
                      person.submissionId,
                      {
                        firstName: primaryApplicant.firstName || "",
                        lastName: primaryApplicant.lastName || "",
                        email: primaryApplicant.email || "",
                        phone: primaryApplicant.phone || formData.phone,
                        ssn: formData.ssn,
                        dob: formData.dob,
                        address: formData.currentAddress,
                        city: formData.currentCity,
                        state: formData.currentState,
                        zip: formData.currentZip,
                      },
                      baseUrl,
                      undefined,
                      screeningCredentials,
                      primaryApplicant.id
                    );
                    
                    if (result.success) {
                      await storage.updateRentalSubmission(person.submissionId, { status: 'screening_requested' });
                      await storage.logRentalApplicationEvent({
                        submissionId: person.submissionId,
                        eventType: 'screening_requested',
                        metadataJson: { autoScreening: true, personId: primaryApplicant.id },
                      });
                    } else {
                      console.error(`Auto-screening failed for submission ${person.submissionId}:`, result.error);
                    }
                  } else if (!existingOrder && !hasRequiredData) {
                    // Log that auto-screening was skipped due to missing required data
                    console.log(`Auto-screening skipped for submission ${person.submissionId}: missing name or email`);
                    await storage.logRentalApplicationEvent({
                      submissionId: person.submissionId,
                      eventType: 'auto_screening_skipped',
                      metadataJson: { reason: 'Missing applicant name or email' },
                    });
                  }
                }
              }
            }
          }
        } catch (screeningError) {
          // Log but don't fail the submission if auto-screening fails
          console.error("Auto-screening error (non-fatal):", screeningError);
        }
      }

      res.json({ success: true, status: allCompleted ? "submitted" : "in_progress" });
    } catch (error) {
      console.error("Error submitting application:", error);
      res.status(500).json({ message: "Failed to submit application" });
    }
  });

  // Invite co-applicant or guarantor
  app.post('/api/apply/:personToken/invite', async (req, res) => {
    try {
      const inviter = await storage.getRentalSubmissionPersonByToken(req.params.personToken);
      
      if (!inviter) {
        return res.status(404).json({ message: "Application not found" });
      }

      const { email, firstName, lastName, personType } = req.body;
      
      if (!email || !firstName || !lastName || !personType) {
        return res.status(400).json({ message: "Email, name, and person type are required" });
      }

      // Map frontend personType to schema role enum values
      const roleMap: Record<string, 'applicant' | 'coapplicant' | 'guarantor'> = {
        'co_applicant': 'coapplicant',
        'guarantor': 'guarantor',
      };

      if (!roleMap[personType]) {
        return res.status(400).json({ message: "Person type must be co_applicant or guarantor" });
      }

      // Check for duplicate email - screening requires unique emails
      const existingPeople = await storage.getRentalSubmissionPeople(inviter.submissionId);
      const emailLower = email.toLowerCase().trim();
      const duplicateEmail = existingPeople.find(p => p.email?.toLowerCase().trim() === emailLower);
      
      if (duplicateEmail) {
        return res.status(400).json({ 
          message: "This email address is already used by another person on this application. Each person must have a unique email for screening to work properly." 
        });
      }

      const inviteToken = randomUUID().replace(/-/g, '');

      const person = await storage.createRentalSubmissionPerson({
        submissionId: inviter.submissionId,
        role: roleMap[personType],
        email,
        firstName,
        lastName,
        formJson: {},
        inviteToken,
      });

      // Log event
      await storage.logRentalApplicationEvent({
        submissionId: inviter.submissionId,
        eventType: "person_invited",
        metadataJson: { invitedPersonId: person.id, role: roleMap[personType], email },
      });

      const inviteUrl = `/apply/join/${inviteToken}`;

      // Get property name and landlord info for the email
      let propertyName = "the property";
      let landlordEmailInfo: { businessName?: string; phoneNumber?: string } | undefined;
      try {
        const submission = await storage.getRentalSubmission(inviter.submissionId);
        if (submission) {
          const link = await storage.getRentalApplicationLink(submission.applicationLinkId);
          if (link?.unitId) {
            const unit = await storage.getRentalUnit(link.unitId);
            if (unit?.propertyId) {
              const property = await storage.getRentalPropertyById(unit.propertyId);
              if (property) {
                propertyName = property.name + (unit.unitLabel ? ` - ${unit.unitLabel}` : '');
                // Get landlord info
                const landlord = await storage.getUser(property.userId);
                if (landlord) {
                  landlordEmailInfo = {
                    businessName: landlord.businessName || undefined,
                    phoneNumber: landlord.phoneNumber || undefined,
                  };
                }
              }
            }
          }
        }
      } catch (err) {
        console.error("Error getting property name for invite email:", err);
      }

      // Send invite email to co-applicant
      try {
        await emailService.sendCoApplicantInviteEmail(
          { email, firstName, lastName },
          { firstName: inviter.firstName || 'Applicant', lastName: inviter.lastName || '' },
          propertyName,
          inviteUrl,
          roleMap[personType] as 'coapplicant' | 'guarantor',
          landlordEmailInfo
        );
        console.log(`✅ Co-applicant invite email sent to ${email}`);
      } catch (emailError) {
        console.error("Error sending invite email (non-fatal):", emailError);
      }

      res.status(201).json({
        personId: person.id,
        inviteToken,
        inviteUrl,
      });
    } catch (error) {
      console.error("Error inviting person:", error);
      res.status(500).json({ message: "Failed to send invite" });
    }
  });

  // Applicant document upload endpoint
  app.post('/api/apply/person/:personToken/upload', (req, res, next) => {
    applicantUpload.single('file')(req, res, (err: any) => {
      if (err) {
        console.error("Multer upload error:", err.message);
        const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
        return res.status(status).json({ message: err.message || "File upload failed" });
      }
      next();
    });
  }, async (req, res) => {
    try {
      const person = await storage.getRentalSubmissionPersonByToken(req.params.personToken);
      
      if (!person) {
        return res.status(404).json({ message: "Application not found" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const { fileType } = req.body;
      if (!fileType) {
        return res.status(400).json({ message: "File type is required" });
      }

      const ext = path.extname(req.file.originalname).toLowerCase() || "";
      const uuid = randomUUID();
      const filename = `${uuid}${ext}`;

      const { dbPath } = await uploadApplicantBuffer(
        req.file.buffer,
        filename,
        req.file.mimetype,
        req.file.originalname
      );

      const fileRecord = await storage.createRentalSubmissionFile({
        personId: person.id,
        fileType,
        originalName: req.file.originalname,
        storedPath: dbPath,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        availabilityStatus: 'available',
      });

      res.status(201).json({
        id: fileRecord.id,
        fileType: fileRecord.fileType,
        originalName: fileRecord.originalName,
        fileSize: fileRecord.fileSize,
      });
    } catch (error) {
      console.error("Error uploading file:", error);
      res.status(500).json({ message: "Failed to upload file" });
    }
  });

  // Get applicant's uploaded files
  app.get('/api/apply/person/:personToken/files', async (req, res) => {
    try {
      const person = await storage.getRentalSubmissionPersonByToken(req.params.personToken);
      
      if (!person) {
        return res.status(404).json({ message: "Application not found" });
      }

      const files = await storage.getRentalSubmissionFiles(person.id);
      res.json(files.map(f => ({
        id: f.id,
        fileType: f.fileType,
        originalName: f.originalName,
        fileSize: f.fileSize,
        availabilityStatus: f.availabilityStatus,
        createdAt: f.createdAt,
      })));
    } catch (error) {
      console.error("Error getting files:", error);
      res.status(500).json({ message: "Failed to load files" });
    }
  });

  // Delete applicant's uploaded file
  app.delete('/api/apply/person/:personToken/files/:fileId', async (req, res) => {
    try {
      const person = await storage.getRentalSubmissionPersonByToken(req.params.personToken);
      
      if (!person) {
        return res.status(404).json({ message: "Application not found" });
      }

      const file = await storage.getRentalSubmissionFile(req.params.fileId);
      if (!file || file.personId !== person.id) {
        return res.status(404).json({ message: "File not found" });
      }

      if (isObjstorePath(file.storedPath)) {
        await deleteApplicantObject(file.storedPath);
      } else {
        try {
          await fs.unlink(file.storedPath);
        } catch (e) {
          console.error("Error deleting file from disk:", e);
        }
      }

      await storage.deleteRentalSubmissionFile(req.params.fileId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting file:", error);
      res.status(500).json({ message: "Failed to delete file" });
    }
  });

  // Landlord: Get all files for a submission
  app.get('/api/rental/submissions/:submissionId/files', isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const submission = await storage.getRentalSubmission(req.params.submissionId);
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      // Verify landlord owns the property via application link -> unit -> property
      const link = await storage.getRentalApplicationLink(submission.applicationLinkId);
      if (!link) {
        return res.status(404).json({ message: "Link not found" });
      }
      
      const unit = await storage.getRentalUnit(link.unitId);
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }
      
      const property = await storage.getRentalProperty(unit.propertyId, userId);
      if (!property) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Get all people in the submission
      const people = await storage.getRentalSubmissionPeople(req.params.submissionId);
      
      // Get files for each person
      const filesByPerson: Record<string, any[]> = {};
      for (const person of people) {
        const files = await storage.getRentalSubmissionFiles(person.id);
        filesByPerson[person.id] = files.map(f => ({
          id: f.id,
          fileType: f.fileType,
          originalName: f.originalName,
          fileSize: f.fileSize,
          availabilityStatus: f.availabilityStatus,
          createdAt: f.createdAt,
        }));
      }

      res.json(filesByPerson);
    } catch (error) {
      console.error("Error getting submission files:", error);
      res.status(500).json({ message: "Failed to load files" });
    }
  });

  // Landlord: Download a file
  app.get('/api/rental/submissions/:submissionId/files/:fileId/download', isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const submission = await storage.getRentalSubmission(req.params.submissionId);
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      // Verify landlord owns the property via link -> unit -> property
      const link = await storage.getRentalApplicationLink(submission.applicationLinkId);
      if (!link) {
        return res.status(404).json({ message: "Link not found" });
      }
      
      const unit = await storage.getRentalUnit(link.unitId);
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }
      
      const property = await storage.getRentalProperty(unit.propertyId, userId);
      if (!property) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const file = await storage.getRentalSubmissionFile(req.params.fileId);
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }

      // Verify the file belongs to this submission
      const people = await storage.getRentalSubmissionPeople(req.params.submissionId);
      const personIds = people.map((p: { id: string }) => p.id);
      if (!personIds.includes(file.personId)) {
        return res.status(403).json({ message: "File not part of this submission" });
      }

      if (file.availabilityStatus === 'missing') {
        return res.status(404).json({ message: "File unavailable (lost during a workspace reset before cloud migration)" });
      }

      if (isObjstorePath(file.storedPath)) {
        const stream = await downloadApplicantStream(file.storedPath);
        if (!stream) {
          await db.update(rentalSubmissionFiles)
            .set({ availabilityStatus: 'missing' })
            .where(eq(rentalSubmissionFiles.id, file.id));
          return res.status(404).json({ message: "File unavailable (missing from storage)" });
        }
        res.setHeader("Content-Type", file.mimeType || "application/octet-stream");
        res.setHeader("Content-Disposition", `inline; filename="${file.originalName}"`);
        stream.pipe(res);
      } else if (file.storedPath.startsWith("uploads/")) {
        const localPath = path.join(process.cwd(), file.storedPath);
        if (!fsSync.existsSync(localPath)) {
          await db.update(rentalSubmissionFiles)
            .set({ availabilityStatus: 'missing' })
            .where(eq(rentalSubmissionFiles.id, file.id));
          return res.status(404).json({ message: "File unavailable (legacy local file missing)" });
        }
        res.download(localPath, file.originalName);
      } else {
        return res.status(400).json({ message: "Unrecognized file path format" });
      }
    } catch (error) {
      console.error("Error downloading file:", error);
      res.status(500).json({ message: "Failed to download file" });
    }
  });

  // Landlord: Upload a file to a submission (manual document upload)
  app.post('/api/rental/submissions/:submissionId/files', isAuthenticated, (req: any, res: any, next: any) => {
    applicantUpload.single('file')(req, res, (err: any) => {
      if (err) {
        console.error("Multer upload error (admin):", err.message);
        const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
        return res.status(status).json({ message: err.message || "File upload failed" });
      }
      next();
    });
  }, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const { personId, fileType } = req.body;
      if (!personId || !fileType) {
        return res.status(400).json({ message: "personId and fileType are required" });
      }

      const submission = await storage.getRentalSubmission(req.params.submissionId);
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      // Verify landlord owns the property via link -> unit -> property
      const link = await storage.getRentalApplicationLink(submission.applicationLinkId);
      if (!link) {
        return res.status(404).json({ message: "Link not found" });
      }
      
      const unit = await storage.getRentalUnit(link.unitId);
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }
      
      const property = await storage.getRentalProperty(unit.propertyId, userId);
      if (!property) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Verify the person belongs to this submission
      const people = await storage.getRentalSubmissionPeople(req.params.submissionId);
      const person = people.find((p: { id: string }) => p.id === personId);
      if (!person) {
        return res.status(400).json({ message: "Person not found in this submission" });
      }

      const ext = path.extname(req.file.originalname).toLowerCase() || "";
      const uuid = randomUUID();
      const filename = `${uuid}${ext}`;

      const { dbPath } = await uploadApplicantBuffer(
        req.file.buffer,
        filename,
        req.file.mimetype,
        req.file.originalname
      );

      const newFile = await storage.createRentalSubmissionFile({
        personId,
        fileType,
        originalName: req.file.originalname,
        storedPath: dbPath,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        availabilityStatus: 'available',
      });

      res.status(201).json(newFile);
    } catch (error) {
      console.error("Error uploading landlord file:", error);
      res.status(500).json({ message: "Failed to upload file" });
    }
  });

  // Landlord: Delete a file from a submission
  app.delete('/api/rental/submissions/:submissionId/files/:fileId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const submission = await storage.getRentalSubmission(req.params.submissionId);
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      // Verify landlord owns the property via link -> unit -> property
      const link = await storage.getRentalApplicationLink(submission.applicationLinkId);
      if (!link) {
        return res.status(404).json({ message: "Link not found" });
      }
      
      const unit = await storage.getRentalUnit(link.unitId);
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }
      
      const property = await storage.getRentalProperty(unit.propertyId, userId);
      if (!property) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const file = await storage.getRentalSubmissionFile(req.params.fileId);
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }

      // Verify the file belongs to this submission
      const people = await storage.getRentalSubmissionPeople(req.params.submissionId);
      const personIds = people.map((p: { id: string }) => p.id);
      if (!personIds.includes(file.personId)) {
        return res.status(403).json({ message: "File not part of this submission" });
      }

      if (isObjstorePath(file.storedPath)) {
        await deleteApplicantObject(file.storedPath);
      } else {
        try {
          await fs.unlink(file.storedPath);
        } catch (e) {
          console.error("Error deleting file from disk:", e);
        }
      }

      await storage.deleteRentalSubmissionFile(req.params.fileId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting landlord file:", error);
      res.status(500).json({ message: "Failed to delete file" });
    }
  });

  // ============================================
  // DOCUMENT RE-UPLOAD SYSTEM
  // ============================================

  const ALLOWED_DOC_TYPES: Record<string, string> = {
    id: "Government-issued ID",
    paystub: "Pay Stubs",
    w2: "W-2 / Tax Documents",
    employment_letter: "Employment Verification Letter",
    bank: "Bank Statements",
    reference: "Reference Letters",
    rental_history: "Rental History / Landlord Reference",
    pet_doc: "Pet Documentation",
    additional: "Additional Supporting Documents",
    other: "Other Document",
    income: "Proof of Income",
  };

  app.post('/api/admin/people/:personId/reupload-link', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      const { allowed_file_types, expires_in_days = 7 } = req.body;
      if (!Array.isArray(allowed_file_types) || allowed_file_types.length === 0) {
        return res.status(400).json({ message: "allowed_file_types is required and must be a non-empty array" });
      }

      const invalid = allowed_file_types.filter((t: string) => !ALLOWED_DOC_TYPES[t]);
      if (invalid.length > 0) {
        return res.status(400).json({ message: `Invalid file types: ${invalid.join(', ')}` });
      }

      const person = await storage.getRentalSubmissionPerson(req.params.personId);
      if (!person) return res.status(404).json({ message: "Person not found" });

      const submission = await storage.getRentalSubmission(person.submissionId);
      if (!submission) return res.status(404).json({ message: "Submission not found" });
      const link = await storage.getRentalApplicationLink(submission.applicationLinkId);
      if (!link) return res.status(404).json({ message: "Link not found" });
      const unit = await storage.getRentalUnit(link.unitId);
      if (!unit) return res.status(404).json({ message: "Unit not found" });
      const property = await storage.getRentalProperty(unit.propertyId, userId);
      if (!property) return res.status(403).json({ message: "Forbidden" });

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expires_in_days);

      await storage.revokeActiveTokensForPerson(req.params.personId);

      const token = await storage.createDocumentReuploadToken({
        personId: req.params.personId,
        allowedFileTypes: allowed_file_types,
        expiresAt,
        createdByUserId: userId,
      });

      const baseUrl = process.env.REPLIT_DOMAINS
        ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
        : 'https://leaseshieldapp.com';
      const reuploadLink = `${baseUrl}/reupload/${token.id}`;

      if (person.email) {
        const docList = allowed_file_types
          .map((t: string) => ALLOWED_DOC_TYPES[t] || t)
          .join(', ');
        const expiryDate = expiresAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        const firstName = person.firstName || 'there';

        const htmlBody = `
          <div style="font-family: Inter, -apple-system, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
            <p style="margin: 0 0 16px;">Hi ${firstName},</p>
            <p style="margin: 0 0 16px;">We're missing a couple items to finish your application: <strong>${docList}</strong>.</p>
            <p style="margin: 0 0 24px;">Please upload them using the button below:</p>
            <a href="${reuploadLink}" style="display: inline-block; background: #2DD4BF; color: #1a2e40; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600;">Upload Documents</a>
            <p style="margin: 24px 0 0; font-size: 13px; color: #6b7280;">This link expires on ${expiryDate}.</p>
            <p style="margin: 24px 0 0; font-size: 13px; color: #6b7280;">Thanks,<br/>Morgan<br/>LeaseShield</p>
          </div>
        `;
        const textBody = `Hi ${firstName},\n\nWe're missing a couple items to finish your application: ${docList}.\n\nPlease upload them here: ${reuploadLink}\n\nThis link expires on ${expiryDate}.\n\nThanks,\nMorgan\nLeaseShield`;

        try {
          const { Resend } = await import('resend');
          if (process.env.RESEND_API_KEY) {
            const resend = new Resend(process.env.RESEND_API_KEY);
            await resend.emails.send({
              from: 'LeaseShield App <support@leaseshieldapp.com>',
              to: person.email,
              subject: 'Upload the missing documents',
              html: htmlBody,
              text: textBody,
            });
          } else {
            console.log(`[Email] Would send re-upload link to ${person.email}: ${reuploadLink}`);
          }
        } catch (emailErr) {
          console.error("Error sending re-upload email:", emailErr);
        }
      }

      res.json({ ok: true, link: reuploadLink, tokenId: token.id });
    } catch (error) {
      console.error("Error creating re-upload link:", error);
      res.status(500).json({ message: "Failed to create re-upload link" });
    }
  });

  app.get('/api/reupload/:token', async (req, res) => {
    try {
      const token = await storage.getDocumentReuploadToken(req.params.token);
      if (!token) return res.status(404).json({ message: "Link not found" });

      if (token.revokedAt) {
        return res.status(410).json({ message: "This link has been revoked." });
      }
      if (token.usedAt) {
        return res.status(410).json({ message: "All documents have already been uploaded. You're all set." });
      }
      if (new Date() > token.expiresAt) {
        return res.status(410).json({ message: "This link has expired. Please contact your landlord for a new one." });
      }

      const currentFiles = await storage.getCurrentFiles(token.personId);
      const tokenCreatedAt = new Date(token.createdAt);
      const filesAfterToken = currentFiles.filter(f => new Date(f.createdAt) > tokenCreatedAt);
      const uploadedTypesAfterToken = new Set(filesAfterToken.map(f => f.fileType));
      const alreadyUploaded = (token.allowedFileTypes as string[]).filter(t => uploadedTypesAfterToken.has(t));
      const stillNeeded = (token.allowedFileTypes as string[]).filter(t => !uploadedTypesAfterToken.has(t));

      const person = await storage.getRentalSubmissionPerson(token.personId);

      res.json({
        allowed_file_types: (token.allowedFileTypes as string[]).map(t => ({
          type: t,
          label: ALLOWED_DOC_TYPES[t] || t,
          uploaded: alreadyUploaded.includes(t),
        })),
        expires_at: token.expiresAt,
        all_complete: stillNeeded.length === 0,
        first_name: person?.firstName || null,
      });
    } catch (error) {
      console.error("Error fetching re-upload token:", error);
      res.status(500).json({ message: "Failed to load upload page" });
    }
  });

  app.post('/api/reupload/:token/upload', (req: any, res: any, next: any) => {
    applicantUpload.single('file')(req, res, (err: any) => {
      if (err) {
        console.error("Multer upload error (reupload):", err.message);
        const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
        return res.status(status).json({ message: err.message || "File upload failed" });
      }
      next();
    });
  }, async (req: any, res) => {
    try {
      const token = await storage.getDocumentReuploadToken(req.params.token);
      if (!token) return res.status(404).json({ message: "Link not found" });

      if (token.revokedAt) return res.status(410).json({ message: "This link has been revoked." });
      if (token.usedAt) return res.status(410).json({ message: "All documents have already been uploaded." });
      if (new Date() > token.expiresAt) return res.status(410).json({ message: "This link has expired." });

      const { file_type } = req.body;
      if (!file_type) return res.status(400).json({ message: "file_type is required" });

      const allowedTypes = token.allowedFileTypes as string[];
      if (!allowedTypes.includes(file_type)) {
        return res.status(400).json({ message: `File type '${file_type}' is not allowed for this link.` });
      }

      if (!req.file) return res.status(400).json({ message: "No file uploaded" });

      const ext = path.extname(req.file.originalname).toLowerCase() || "";
      const uuid = randomUUID();
      const filename = `${uuid}${ext}`;

      const { dbPath } = await uploadApplicantBuffer(
        req.file.buffer,
        filename,
        req.file.mimetype,
        req.file.originalname
      );

      await storage.supersedeFilesForType(token.personId, file_type);

      const newFile = await storage.createRentalSubmissionFile({
        personId: token.personId,
        fileType: file_type,
        originalName: req.file.originalname,
        storedPath: dbPath,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        availabilityStatus: 'available',
      });

      const currentFiles = await storage.getCurrentFiles(token.personId);
      const tokenCreatedAt = new Date(token.createdAt);
      const filesAfterToken = currentFiles.filter(f => new Date(f.createdAt) > tokenCreatedAt);
      const uploadedTypesAfterToken = new Set(filesAfterToken.map(f => f.fileType));
      const allComplete = allowedTypes.every(t => uploadedTypesAfterToken.has(t));
      if (allComplete) {
        await storage.markDocumentReuploadTokenUsed(token.id);
      }

      res.status(201).json({
        file: newFile,
        all_complete: allComplete,
      });
    } catch (error) {
      console.error("Error uploading via re-upload link:", error);
      res.status(500).json({ message: "Failed to upload file" });
    }
  });

  app.post('/api/admin/reupload-tokens/:tokenId/revoke', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      const token = await storage.getDocumentReuploadToken(req.params.tokenId);
      if (!token) return res.status(404).json({ message: "Token not found" });

      await storage.revokeDocumentReuploadToken(req.params.tokenId);
      res.json({ ok: true });
    } catch (error) {
      console.error("Error revoking re-upload token:", error);
      res.status(500).json({ message: "Failed to revoke token" });
    }
  });

  app.get('/api/admin/people/:personId/reupload-tokens', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      const tokens = await storage.getDocumentReuploadTokensForPerson(req.params.personId);
      res.json(tokens);
    } catch (error) {
      console.error("Error fetching re-upload tokens:", error);
      res.status(500).json({ message: "Failed to fetch tokens" });
    }
  });

  // ============================================
  // ADMIN: DATABASE BACKUP/EXPORT ENDPOINTS
  // ============================================

  // Helper to safely export a table
  const safeExport = async (queryFn: any, tableName: string) => {
    try {
      if (queryFn && typeof queryFn.findMany === 'function') {
        return await queryFn.findMany();
      }
      return [];
    } catch (e) {
      console.warn(`Could not export table ${tableName}:`, e);
      return [];
    }
  };

  // Export all database tables as JSON (admin only)
  app.get('/api/admin/database-export', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const exportData: Record<string, any> = {
        exportedAt: new Date().toISOString(),
        exportedBy: req.user?.email || 'Unknown',
        tables: {}
      };

      // Core user/auth tables
      exportData.tables.users = await safeExport(db.query.users, 'users');
      exportData.tables.refreshTokens = await safeExport(db.query.refreshTokens, 'refreshTokens');
      exportData.tables.states = await safeExport(db.query.states, 'states');
      
      // Templates and compliance
      exportData.tables.templates = await safeExport(db.query.templates, 'templates');
      exportData.tables.templateVersions = await safeExport(db.query.templateVersions, 'templateVersions');
      exportData.tables.complianceCards = await safeExport(db.query.complianceCards, 'complianceCards');
      exportData.tables.applicationComplianceRules = await safeExport(db.query.applicationComplianceRules, 'applicationComplianceRules');
      exportData.tables.legalUpdates = await safeExport(db.query.legalUpdates, 'legalUpdates');
      
      // Notifications and analytics
      exportData.tables.userNotifications = await safeExport(db.query.userNotifications, 'userNotifications');
      exportData.tables.analyticsEvents = await safeExport(db.query.analyticsEvents, 'analyticsEvents');
      
      // Content
      exportData.tables.screeningContent = await safeExport(db.query.screeningContent, 'screeningContent');
      exportData.tables.tenantIssueWorkflows = await safeExport(db.query.tenantIssueWorkflows, 'tenantIssueWorkflows');
      exportData.tables.blogPosts = await safeExport(db.query.blogPosts, 'blogPosts');
      
      // Legislative monitoring
      exportData.tables.legislativeMonitoring = await safeExport(db.query.legislativeMonitoring, 'legislativeMonitoring');
      exportData.tables.caseLawMonitoring = await safeExport(db.query.caseLawMonitoring, 'caseLawMonitoring');
      exportData.tables.templateReviewQueue = await safeExport(db.query.templateReviewQueue, 'templateReviewQueue');
      exportData.tables.monitoringRuns = await safeExport(db.query.monitoringRuns, 'monitoringRuns');
      
      // Property/document management
      exportData.tables.properties = await safeExport(db.query.properties, 'properties');
      exportData.tables.retentionSettings = await safeExport(db.query.retentionSettings, 'retentionSettings');
      exportData.tables.savedDocuments = await safeExport(db.query.savedDocuments, 'savedDocuments');
      exportData.tables.uploadedDocuments = await safeExport(db.query.uploadedDocuments, 'uploadedDocuments');
      
      // Communications and emails
      exportData.tables.communicationTemplates = await safeExport(db.query.communicationTemplates, 'communicationTemplates');
      exportData.tables.broadcastMessages = await safeExport(db.query.broadcastMessages, 'broadcastMessages');
      exportData.tables.broadcastRecipients = await safeExport(db.query.broadcastRecipients, 'broadcastRecipients');
      exportData.tables.broadcastReplies = await safeExport(db.query.broadcastReplies, 'broadcastReplies');
      exportData.tables.emailSequences = await safeExport(db.query.emailSequences, 'emailSequences');
      exportData.tables.emailSequenceSteps = await safeExport(db.query.emailSequenceSteps, 'emailSequenceSteps');
      exportData.tables.emailSequenceEnrollments = await safeExport(db.query.emailSequenceEnrollments, 'emailSequenceEnrollments');
      exportData.tables.emailEvents = await safeExport(db.query.emailEvents, 'emailEvents');
      
      // Rent ledger
      exportData.tables.rentLedgerEntries = await safeExport(db.query.rentLedgerEntries, 'rentLedgerEntries');
      exportData.tables.trainingInterest = await safeExport(db.query.trainingInterest, 'trainingInterest');
      
      // Rental application system
      exportData.tables.rentalProperties = await safeExport(db.query.rentalProperties, 'rentalProperties');
      exportData.tables.rentalUnits = await safeExport(db.query.rentalUnits, 'rentalUnits');
      exportData.tables.rentalApplicationLinks = await safeExport(db.query.rentalApplicationLinks, 'rentalApplicationLinks');
      exportData.tables.rentalSubmissions = await safeExport(db.query.rentalSubmissions, 'rentalSubmissions');
      exportData.tables.rentalSubmissionPeople = await safeExport(db.query.rentalSubmissionPeople, 'rentalSubmissionPeople');
      exportData.tables.rentalSubmissionFiles = await safeExport(db.query.rentalSubmissionFiles, 'rentalSubmissionFiles');
      exportData.tables.rentalSubmissionAcknowledgements = await safeExport(db.query.rentalSubmissionAcknowledgements, 'rentalSubmissionAcknowledgements');
      exportData.tables.rentalScreeningOrders = await safeExport(db.query.rentalScreeningOrders, 'rentalScreeningOrders');
      exportData.tables.rentalDecisions = await safeExport(db.query.rentalDecisions, 'rentalDecisions');
      
      // Count records
      let totalRecords = 0;
      for (const tableName of Object.keys(exportData.tables)) {
        totalRecords += exportData.tables[tableName]?.length || 0;
      }
      exportData.totalRecords = totalRecords;
      exportData.tableCount = Object.keys(exportData.tables).length;

      res.json(exportData);
    } catch (error) {
      console.error("Error exporting database:", error);
      res.status(500).json({ message: "Failed to export database" });
    }
  });

  // Get list of tables and their record counts (admin only)
  app.get('/api/admin/database-stats', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const stats: { name: string; count: number }[] = [];
      
      // Build list of all table names to query stats for
      const tableNames = [
        'users', 'refreshTokens', 'states', 'templates', 'templateVersions',
        'complianceCards', 'applicationComplianceRules', 'legalUpdates',
        'userNotifications', 'analyticsEvents', 'screeningContent',
        'tenantIssueWorkflows', 'blogPosts', 'legislativeMonitoring',
        'caseLawMonitoring', 'templateReviewQueue', 'monitoringRuns',
        'properties', 'retentionSettings', 'savedDocuments', 'uploadedDocuments',
        'communicationTemplates', 'broadcastMessages', 'broadcastRecipients',
        'broadcastReplies', 'emailSequences', 'emailSequenceSteps',
        'emailSequenceEnrollments', 'emailEvents', 'rentLedgerEntries',
        'trainingInterest', 'rentalProperties', 'rentalUnits',
        'rentalApplicationLinks', 'rentalSubmissions', 'rentalSubmissionPeople',
        'rentalSubmissionFiles', 'rentalSubmissionAcknowledgements',
        'rentalScreeningOrders', 'rentalDecisions'
      ];

      for (const tableName of tableNames) {
        try {
          const queryFn = (db.query as any)[tableName];
          if (queryFn && typeof queryFn.findMany === 'function') {
            const records = await queryFn.findMany();
            stats.push({ name: tableName, count: records?.length || 0 });
          } else {
            stats.push({ name: tableName, count: 0 });
          }
        } catch (e) {
          stats.push({ name: tableName, count: 0 });
        }
      }

      res.json({ 
        stats, 
        totalRecords: stats.reduce((sum, s) => sum + s.count, 0),
        tableCount: stats.length 
      });
    } catch (error) {
      console.error("Error getting database stats:", error);
      res.status(500).json({ message: "Failed to get database stats" });
    }
  });

  // ===== State Notes API (for decoder state-specific snippets) =====
  
  // Public endpoint: Get approved state note for decoder runtime
  app.get('/api/state-notes', isAuthenticated, asyncHandler(async (req: any, res) => {
    const { stateId, decoder, topic } = req.query;
    
    if (!stateId || !decoder || !topic) {
      return res.status(400).json({ message: "stateId, decoder, and topic are required" });
    }
    
    if (!['credit', 'criminal_eviction'].includes(decoder)) {
      return res.status(400).json({ message: "decoder must be 'credit' or 'criminal_eviction'" });
    }
    
    const note = await storage.getApprovedStateNote(stateId, decoder as 'credit' | 'criminal_eviction', topic);
    res.json({ note: note || null });
  }));

  // Admin: List all state notes with filters
  app.get('/api/admin/state-notes', isAuthenticated, requireAdmin, asyncHandler(async (req: any, res) => {
    const { stateId, decoder, topic, status } = req.query;
    
    const filters: any = {};
    if (stateId) filters.stateId = stateId;
    if (decoder && ['credit', 'criminal_eviction'].includes(decoder)) filters.decoder = decoder;
    if (topic) filters.topic = topic;
    if (status) filters.status = status;
    
    const notes = await storage.getStateNotes(filters);
    res.json(notes);
  }));

  // Admin: Get single state note
  app.get('/api/admin/state-notes/:id', isAuthenticated, requireAdmin, asyncHandler(async (req: any, res) => {
    const note = await storage.getStateNote(req.params.id);
    if (!note) {
      return res.status(404).json({ message: "State note not found" });
    }
    res.json(note);
  }));

  // Admin: Create new state note (draft)
  app.post('/api/admin/state-notes', isAuthenticated, requireAdmin, asyncHandler(async (req: any, res) => {
    const { stateId, decoder, topic, title, bullets, sourceLinks } = req.body;
    
    if (!stateId || !decoder || !topic || !title || !bullets) {
      return res.status(400).json({ message: "stateId, decoder, topic, title, and bullets are required" });
    }
    
    if (!['credit', 'criminal_eviction'].includes(decoder)) {
      return res.status(400).json({ message: "decoder must be 'credit' or 'criminal_eviction'" });
    }
    
    // Validate topic is from allowed list to prevent arbitrary topics
    const { CREDIT_TOPICS, CRIMINAL_EVICTION_TOPICS } = await import('@shared/decoderTopics');
    const allowedTopics = decoder === 'credit' ? CREDIT_TOPICS : CRIMINAL_EVICTION_TOPICS;
    if (!allowedTopics.includes(topic as any)) {
      return res.status(400).json({ message: `Invalid topic '${topic}' for ${decoder} decoder. Allowed: ${allowedTopics.join(', ')}` });
    }
    
    if (!Array.isArray(bullets) || bullets.length === 0) {
      return res.status(400).json({ message: "bullets must be a non-empty array of strings" });
    }
    
    const note = await storage.createStateNote({
      stateId,
      decoder,
      topic,
      title,
      bullets,
      sourceLinks: sourceLinks || [],
      status: 'draft',
      isActive: false,
      version: 1,
    });
    
    res.status(201).json(note);
  }));

  // Admin: Update state note (only drafts can be edited)
  app.put('/api/admin/state-notes/:id', isAuthenticated, requireAdmin, asyncHandler(async (req: any, res) => {
    const existing = await storage.getStateNote(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: "State note not found" });
    }
    
    if (existing.status !== 'draft') {
      return res.status(400).json({ message: "Only draft notes can be edited. Create a new version instead." });
    }
    
    const { title, bullets, sourceLinks } = req.body;
    const updateData: any = {};
    if (title) updateData.title = title;
    if (bullets) updateData.bullets = bullets;
    if (sourceLinks !== undefined) updateData.sourceLinks = sourceLinks;
    
    const updated = await storage.updateStateNote(req.params.id, updateData);
    res.json(updated);
  }));

  // Admin: Submit state note for review
  app.post('/api/admin/state-notes/:id/submit', isAuthenticated, requireAdmin, asyncHandler(async (req: any, res) => {
    const note = await storage.submitStateNoteForReview(req.params.id);
    if (!note) {
      return res.status(400).json({ message: "Note not found or not in draft status" });
    }
    res.json(note);
  }));

  // Admin: Approve state note (requires approval checklist)
  app.post('/api/admin/state-notes/:id/approve', isAuthenticated, requireAdmin, asyncHandler(async (req: any, res) => {
    const { approvalChecklist } = req.body;
    
    if (!approvalChecklist || typeof approvalChecklist !== 'object') {
      return res.status(400).json({ message: "approvalChecklist is required" });
    }
    
    // Validate all checklist items are checked
    const requiredChecks = [
      'contentAccuracy',
      'neutralFraming',
      'fairHousingCompliance',
      'toneConsistency',
      'auditTrailComplete',
    ];
    
    const allChecked = requiredChecks.every(key => approvalChecklist[key] === true);
    if (!allChecked) {
      return res.status(400).json({ message: "All approval checklist items must be checked" });
    }
    
    const note = await storage.approveStateNote(req.params.id, req.user.id, approvalChecklist);
    if (!note) {
      return res.status(400).json({ message: "Note not found or approval failed" });
    }
    res.json(note);
  }));

  // Admin: Archive state note
  app.post('/api/admin/state-notes/:id/archive', isAuthenticated, requireAdmin, asyncHandler(async (req: any, res) => {
    const note = await storage.archiveStateNote(req.params.id);
    if (!note) {
      return res.status(404).json({ message: "State note not found" });
    }
    res.json(note);
  }));

  // ===== DENIAL DECISION ASSISTANT ENDPOINTS =====

  // Get cities by state
  app.get('/api/denial-decision/cities', isAuthenticated, asyncHandler(async (req: any, res) => {
    const { stateId } = req.query;
    if (!stateId) {
      return res.status(400).json({ message: "stateId is required" });
    }
    const cities = await storage.getCitiesByState(stateId as string);
    res.json(cities);
  }));

  // Get counties for a state (for denial decision wizard)
  app.get('/api/denial-decision/counties', isAuthenticated, asyncHandler(async (req: any, res) => {
    const { stateId } = req.query;
    if (!stateId) {
      return res.status(400).json({ message: "stateId is required" });
    }
    const countiesList = await storage.getCountiesByState(stateId as string);
    res.json(countiesList);
  }));

  // Get all known jurisdictions for dropdown fallback
  app.get('/api/denial-decision/jurisdictions', isAuthenticated, asyncHandler(async (req: any, res) => {
    const { stateId } = req.query;
    const { getAllKnownJurisdictions } = await import('./services/jurisdictionResolver');
    const jurisdictions = await getAllKnownJurisdictions(stateId as string | undefined);
    res.json(jurisdictions);
  }));

  // Resolve jurisdiction from property
  app.get('/api/denial-decision/resolve-jurisdiction', isAuthenticated, asyncHandler(async (req: any, res) => {
    const { propertyId, stateId, cityName, countyName } = req.query;
    const { resolveJurisdictionFromProperty, resolveJurisdictionFromLocation } = await import('./services/jurisdictionResolver');
    
    let resolved;
    if (propertyId) {
      resolved = await resolveJurisdictionFromProperty(propertyId as string);
      if (!resolved) {
        return res.status(404).json({ message: "Property not found or missing state" });
      }
    } else if (stateId) {
      resolved = await resolveJurisdictionFromLocation(
        stateId as string,
        cityName as string | undefined,
        countyName as string | undefined
      );
    } else {
      return res.status(400).json({ message: "Either propertyId or stateId is required" });
    }
    
    res.json(resolved);
  }));

  // Get audit history for the current user
  app.get('/api/denial-decision/audit-history', isAuthenticated, asyncHandler(async (req: any, res) => {
    const logs = await storage.getDenialDecisionAuditLogs(req.user.id);
    res.json(logs);
  }));

  // Delete an audit history entry
  app.delete('/api/denial-decision/audit-history/:id', isAuthenticated, asyncHandler(async (req: any, res) => {
    const { id } = req.params;
    const deleted = await storage.deleteDenialDecisionAuditLog(id, req.user.id);
    if (!deleted) {
      return res.status(404).json({ message: "Entry not found or not authorized" });
    }
    res.json({ success: true });
  }));

  // Update an audit history entry
  app.patch('/api/denial-decision/audit-history/:id', isAuthenticated, asyncHandler(async (req: any, res) => {
    const { id } = req.params;
    const { applicantName, outcome } = req.body;
    
    if (outcome && !['approve', 'conditional', 'deny'].includes(outcome)) {
      return res.status(400).json({ message: "Invalid outcome value" });
    }
    
    const updated = await storage.updateDenialDecisionAuditLog(id, req.user.id, { applicantName, outcome });
    if (!updated) {
      return res.status(404).json({ message: "Entry not found or not authorized" });
    }
    res.json(updated);
  }));

  // Get all denial criteria with rules for a jurisdiction
  app.get('/api/denial-decision/criteria', isAuthenticated, asyncHandler(async (req: any, res) => {
    const { stateId, cityId, countyId } = req.query;
    if (!stateId) {
      return res.status(400).json({ message: "stateId is required" });
    }

    // Get all criteria
    const criteria = await storage.getAllDenialCriteria();
    
    // Get rules for this jurisdiction (city, county, state chain)
    const rules = await storage.getDenialCriteriaRulesForJurisdiction(
      stateId as string, 
      cityId as string | undefined,
      countyId as string | undefined
    );

    // Build a map of criteriaId -> most specific rule
    // Priority: City (4) > County (2) > State (1) > Federal (0)
    const ruleMap = new Map<string, any>();
    for (const rule of rules) {
      const existing = ruleMap.get(rule.criteriaId);
      if (!existing) {
        ruleMap.set(rule.criteriaId, rule);
      } else {
        // Calculate specificity: city beats county beats state beats federal
        const getSpecificity = (r: any) => 
          (r.cityId ? 4 : 0) + (r.countyId ? 2 : 0) + (r.stateId ? 1 : 0);
        const existingSpecificity = getSpecificity(existing);
        const newSpecificity = getSpecificity(rule);
        if (newSpecificity > existingSpecificity) {
          ruleMap.set(rule.criteriaId, rule);
        }
      }
    }

    // Group criteria by category with their rules
    const grouped: Record<string, Array<{
      id: string;
      code: string;
      label: string;
      description: string | null;
      status: 'blocked' | 'allowed' | 'conditional';
      explanationPlain: string | null;
      whyItMatters: string | null;
      legalAlternative: string | null;
      requiredSteps: string[] | null;
    }>> = {};

    for (const criterion of criteria) {
      const rule = ruleMap.get(criterion.id);
      const status = rule?.status || 'allowed'; // Default to allowed if no rule
      
      if (!grouped[criterion.category]) {
        grouped[criterion.category] = [];
      }
      
      grouped[criterion.category].push({
        id: criterion.id,
        code: criterion.code,
        label: criterion.label,
        description: criterion.description,
        status,
        explanationPlain: rule?.explanationPlain || null,
        whyItMatters: rule?.whyItMatters || null,
        legalAlternative: rule?.legalAlternative || null,
        requiredSteps: rule?.requiredSteps || null,
      });
    }

    res.json(grouped);
  }));

  // Get sentence templates for selected criteria
  app.get('/api/denial-decision/sentence-templates', isAuthenticated, asyncHandler(async (req: any, res) => {
    const { criteriaIds, stateId, cityId } = req.query;
    
    if (!criteriaIds || !stateId) {
      return res.status(400).json({ message: "criteriaIds and stateId are required" });
    }

    const ids = Array.isArray(criteriaIds) ? criteriaIds : [criteriaIds];
    const templates = await storage.getDenialSentenceTemplates(
      ids as string[],
      stateId as string,
      cityId as string | undefined
    );

    res.json(templates);
  }));

  // Generate combined denial text
  app.post('/api/denial-decision/generate-text', isAuthenticated, asyncHandler(async (req: any, res) => {
    const { criteriaIds, stateId, cityId } = req.body;
    
    if (!criteriaIds || !Array.isArray(criteriaIds) || criteriaIds.length === 0) {
      return res.status(400).json({ message: "criteriaIds must be a non-empty array" });
    }
    if (!stateId) {
      return res.status(400).json({ message: "stateId is required" });
    }

    // SERVER-SIDE ENFORCEMENT: Check for blocked criteria and reject them
    const rules = await storage.getDenialCriteriaRulesForJurisdiction(stateId, cityId);
    const ruleMap = new Map<string, any>();
    for (const rule of rules) {
      const existing = ruleMap.get(rule.criteriaId);
      if (!existing) {
        ruleMap.set(rule.criteriaId, rule);
      } else {
        const existingSpecificity = (existing.cityId ? 2 : 0) + (existing.stateId ? 1 : 0);
        const newSpecificity = (rule.cityId ? 2 : 0) + (rule.stateId ? 1 : 0);
        if (newSpecificity > existingSpecificity) {
          ruleMap.set(rule.criteriaId, rule);
        }
      }
    }

    // Filter out blocked criteria - they cannot be used for denial
    const blockedCriteriaUsed = criteriaIds.filter((id: string) => {
      const rule = ruleMap.get(id);
      return rule?.status === 'blocked';
    });

    if (blockedCriteriaUsed.length > 0) {
      return res.status(400).json({ 
        message: "Cannot use blocked criteria for denial decisions",
        blockedCriteriaIds: blockedCriteriaUsed
      });
    }

    const templates = await storage.getDenialSentenceTemplates(criteriaIds, stateId, cityId);
    
    // Pick the most specific template for each criterion (city > state > universal)
    const templateMap = new Map<string, any>();
    for (const template of templates) {
      const existing = templateMap.get(template.criteriaId);
      if (!existing) {
        templateMap.set(template.criteriaId, template);
      } else {
        const existingSpecificity = (existing.cityId ? 2 : 0) + (existing.stateId ? 1 : 0) + (existing.isDefault ? 0 : 0.5);
        const newSpecificity = (template.cityId ? 2 : 0) + (template.stateId ? 1 : 0) + (template.isDefault ? 0 : 0.5);
        if (newSpecificity > existingSpecificity) {
          templateMap.set(template.criteriaId, template);
        }
      }
    }

    // Combine sentences
    const sentences = Array.from(templateMap.values()).map(t => t.sentenceText);
    const combinedText = sentences.join(' ');

    res.json({ 
      text: combinedText,
      sentences,
      templateCount: sentences.length 
    });
  }));

  // Save decision to audit log
  app.post('/api/denial-decision/save', isAuthenticated, asyncHandler(async (req: any, res) => {
    const { 
      stateId, 
      cityId,
      countyId, 
      outcome, 
      criteriaPresent, 
      criteriaSelected, 
      generatedText,
      conditions,
      fairChanceSteps,
      applicantName,
      propertyId,
      noticesProvided
    } = req.body;

    if (!stateId || !outcome || !criteriaPresent) {
      return res.status(400).json({ message: "stateId, outcome, and criteriaPresent are required" });
    }

    if (!['approve', 'conditional', 'deny'].includes(outcome)) {
      return res.status(400).json({ message: "outcome must be 'approve', 'conditional', or 'deny'" });
    }

    // Get city name if cityId is provided
    let cityName: string | undefined;
    if (cityId) {
      const city = await storage.getCity(cityId);
      cityName = city?.name;
    }

    // Get county name if countyId is provided
    let countyName: string | undefined;
    if (countyId) {
      const county = await storage.getCounty(countyId);
      countyName = county?.name;
    }

    // Create a version hash from current rules (now including county)
    const rules = await storage.getDenialCriteriaRulesForJurisdiction(stateId, cityId, countyId);
    
    // SERVER-SIDE ENFORCEMENT: Build rule map and check for blocked criteria in denial
    // Priority: City (4) > County (2) > State (1) > Federal (0)
    const ruleMap = new Map<string, any>();
    for (const rule of rules) {
      const existing = ruleMap.get(rule.criteriaId);
      if (!existing) {
        ruleMap.set(rule.criteriaId, rule);
      } else {
        const getSpecificity = (r: any) => 
          (r.cityId ? 4 : 0) + (r.countyId ? 2 : 0) + (r.stateId ? 1 : 0);
        const existingSpecificity = getSpecificity(existing);
        const newSpecificity = getSpecificity(rule);
        if (newSpecificity > existingSpecificity) {
          ruleMap.set(rule.criteriaId, rule);
        }
      }
    }

    // If outcome is deny, ensure no blocked criteria are in the selected list
    if (outcome === 'deny' && criteriaSelected && Array.isArray(criteriaSelected)) {
      const blockedCriteriaUsed = criteriaSelected.filter((id: string) => {
        const rule = ruleMap.get(id);
        return rule?.status === 'blocked';
      });

      if (blockedCriteriaUsed.length > 0) {
        return res.status(400).json({ 
          message: "Cannot use blocked criteria for denial decisions",
          blockedCriteriaIds: blockedCriteriaUsed
        });
      }
    }

    // Create rule version with snapshot of active rules
    const ruleVersion = `v${Date.now()}_${rules.length}rules`;

    const auditLog = await storage.createDenialDecisionAuditLog({
      userId: req.user.id,
      propertyId: propertyId || null,
      applicantName: applicantName || null,
      stateId,
      countyId: countyId || null,
      countyName: countyName || null,
      cityId: cityId || null,
      cityName: cityName || null,
      ruleVersion,
      outcome,
      criteriaPresent,
      criteriaSelectedForDenial: criteriaSelected || null,
      blockedCriteriaShown: null, // Could be populated if needed
      generatedDenialText: generatedText || null,
      adverseActionLetterGenerated: false,
      adverseActionLetterId: null,
      conditions: conditions || null,
      fairChanceStepsCompleted: fairChanceSteps || null,
      noticesProvided: noticesProvided || null,
      ipAddress: req.ip || null,
      userAgent: req.get('user-agent') || null,
    });

    res.status(201).json(auditLog);
  }));

  // Update user's preferred city
  app.patch('/api/user/preferred-city', isAuthenticated, asyncHandler(async (req: any, res) => {
    const { cityId } = req.body;
    
    // cityId can be null to clear the preference
    const user = await storage.updateUserPreferredCity(req.user.id, cityId || null);
    res.json(user);
  }));

  // Generate adverse action letter PDF (FCRA or non-FCRA)
  app.post('/api/denial-decision/adverse-action-letter', isAuthenticated, asyncHandler(async (req: any, res) => {
    const { 
      applicantName, 
      applicantAddress, 
      stateId, 
      cityId,
      countyId,
      denialReasons,
      criteriaIds,
      isFcra = true,
      letterType = 'adverse', // 'pre-adverse', 'adverse', or 'denial'
      auditLogId
    } = req.body;

    const isPreAdverse = letterType === 'pre-adverse';

    if (!stateId || !denialReasons) {
      return res.status(400).json({ message: "stateId and denialReasons are required" });
    }
    
    // Update audit log with the letter type if auditLogId is provided
    if (auditLogId) {
      try {
        const letterTypeDb = isPreAdverse ? 'pre_adverse' : 'adverse_action';
        await storage.updateDenialDecisionAuditLogLetterType(auditLogId, req.user.id, letterTypeDb);
      } catch (err) {
        console.error('Failed to update audit log with letter type:', err);
        // Don't fail the request, just log the error
      }
    }
    
    // Get jurisdiction info for disclosure (built separately from existing state/city lookups below)
    let jurisdictionDisclosure = '';
    if (cityId) {
      const cityInfo = await storage.getCity(cityId);
      if (cityInfo) {
        jurisdictionDisclosure = `${cityInfo.name}, `;
      }
    }
    if (countyId) {
      const countyInfo = await storage.getCounty(countyId);
      if (countyInfo) {
        jurisdictionDisclosure += `${countyInfo.name}, `;
      }
    }
    const stateInfo = await storage.getStateById(stateId);
    if (stateInfo) {
      jurisdictionDisclosure += stateInfo.name;
    }

    // HTML escape helper to prevent injection
    const escapeHtml = (str: string) => {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    // Sanitize user inputs
    const safeApplicantName = escapeHtml(applicantName || 'Applicant');
    const safeApplicantAddress = escapeHtml(applicantAddress || '');
    
    // For PRE-ADVERSE: Use a single ultra-defensive reason (no detailed text transformation)
    // For ADVERSE/FINAL: Use the detailed specific reasons
    let sanitizedReasons: string[] = [];
    
    if (isPreAdverse) {
      // PRE-ADVERSE: Single ultra-defensive reason - no detailed text transformation
      // This avoids bad English from cascading replacements
      sanitizedReasons = ['Certain information in the consumer report may not meet the qualification requirements for this property.'];
    } else {
      // ADVERSE/FINAL: Parse and use specific reasons
      const reasonLines = denialReasons.split('\n').filter((r: string) => r.trim().length > 0).slice(0, 5);
      sanitizedReasons = reasonLines.map((reason: string) => {
        let sanitized = escapeHtml(reason.trim());
        // Reason hygiene for adverse action letters
        sanitized = sanitized.replace(/bad credit/gi, 'credit history did not meet minimum criteria');
        sanitized = sanitized.replace(/poor credit/gi, 'credit history did not meet minimum criteria');
        sanitized = sanitized.replace(/low credit score/gi, 'credit score below required threshold');
        sanitized = sanitized.replace(/insufficient credit/gi, 'insufficient credit history to verify');
        sanitized = sanitized.replace(/too many late payments/gi, 'payment history did not meet criteria');
        sanitized = sanitized.replace(/bankruptcy/gi, 'bankruptcy filing within specified timeframe');
        sanitized = sanitized.replace(/criminal record/gi, 'criminal history pursuant to individualized assessment presents a documented risk to resident safety or property');
        sanitized = sanitized.replace(/arrest record/gi, 'conviction record pursuant to individualized assessment');
        sanitized = sanitized.replace(/eviction history/gi, 'prior eviction judgment within specified timeframe');
        sanitized = sanitized.replace(/evicted before/gi, 'prior eviction judgment within specified timeframe');
        sanitized = sanitized.replace(/not enough income/gi, 'income did not meet required threshold');
        sanitized = sanitized.replace(/income too low/gi, 'income did not meet required threshold');
        return sanitized;
      });
    }

    // Get state and city info
    const state = await storage.getStateById(stateId);
    let city = null;
    if (cityId) {
      city = await storage.getCity(cityId);
    }

    const jurisdictionLabel = city ? `${city.name}, ${state?.name}` : state?.name || '';
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const pdfId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Note: Audit log is already created by the denial decision wizard endpoint
    // This endpoint only generates the PDF letter, not a new audit record

    // CRA info
    const CRA = {
      name: 'Western Verify LLC',
      address: '489 W South Jordan Pkwy, Suite 200, South Jordan, UT 84095',
      phone: '(888) 610-WEST',
      website: 'www.westernverify.com',
      email: 'support@westernverify.com'
    };

    // Build reasons list HTML
    const reasonsListHtml = sanitizedReasons.map((r: string) => `<li>${r}</li>`).join('\n');

    // Generate clean single-page letter HTML based on letter type
    let letterTitle: string;
    let letterSubtitle: string;
    if (isPreAdverse) {
      letterTitle = 'PRE-ADVERSE ACTION NOTICE';
      letterSubtitle = 'Preliminary Rental Application Decision';
    } else if (isFcra) {
      letterTitle = 'ADVERSE ACTION NOTICE';
      letterSubtitle = 'Rental Application Decision';
    } else {
      letterTitle = 'RENTAL APPLICATION DENIAL';
      letterSubtitle = '';
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Georgia', 'Times New Roman', serif;
            font-size: 11pt;
            line-height: 1.5;
            color: #222;
            padding: 0.75in;
          }
          .header {
            text-align: center;
            margin-bottom: 24px;
            padding-bottom: 16px;
            border-bottom: 2px solid #333;
          }
          .header h1 { font-size: 16pt; font-weight: bold; margin-bottom: 4px; }
          .header p { font-size: 10pt; color: #555; }
          .meta { display: flex; justify-content: space-between; margin-bottom: 20px; }
          .meta .date { text-align: right; }
          .recipient { margin-bottom: 16px; }
          .section { margin-bottom: 16px; }
          .section-title { font-size: 10pt; font-weight: bold; text-transform: uppercase; color: #444; margin-bottom: 6px; border-bottom: 1px solid #ddd; padding-bottom: 2px; }
          .reasons-list { list-style-type: disc; margin-left: 20px; margin-top: 6px; }
          .reasons-list li { margin-bottom: 4px; }
          .cra-box { background: #f8f8f8; border: 1px solid #ddd; padding: 10px; margin-top: 6px; font-size: 10pt; }
          .rights-box { background: #fff; border: 1px solid #ccc; padding: 10px; margin-top: 6px; font-size: 9.5pt; }
          .rights-box ul { margin-left: 16px; margin-top: 4px; }
          .rights-box li { margin-bottom: 3px; }
          .signature { margin-top: 32px; }
          .signature-line { border-top: 1px solid #333; width: 250px; margin-top: 40px; padding-top: 4px; font-size: 10pt; }
          .footer { margin-top: 24px; font-size: 8pt; color: #666; text-align: center; border-top: 1px solid #ddd; padding-top: 8px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${letterTitle}</h1>
          ${letterSubtitle ? `<p>${letterSubtitle}</p>` : ''}
        </div>

        <div class="meta">
          <div class="recipient">
            <strong>${safeApplicantName}</strong><br>
            ${safeApplicantAddress ? safeApplicantAddress.replace(/,/g, '<br>') : ''}
          </div>
          <div class="date">${dateStr}</div>
        </div>

        <div class="section">
          <p>Dear ${safeApplicantName},</p>
          ${isPreAdverse ? `
          <p style="margin-top: 8px;">We are considering <strong>denying your rental application</strong> based, in whole or in part, on information obtained from a consumer reporting agency. This is not a final decision.</p>
          <p style="margin-top: 8px;">If you believe the information in the consumer report is inaccurate or incomplete, you may contact the consumer reporting agency listed below as soon as possible.</p>
          ` : `
          <p style="margin-top: 8px;">We regret to inform you that your rental application has been denied${isFcra ? ' based, in whole or in part, on information obtained from a consumer reporting agency' : ''}.</p>
          `}
        </div>

        <div class="section">
          <div class="section-title">${isPreAdverse ? 'Reason(s) Under Consideration' : 'Reason(s) for Denial'}</div>
          <ul class="reasons-list">
            ${reasonsListHtml}
          </ul>
        </div>

        ${isFcra || isPreAdverse ? `
        <div class="section">
          <div class="section-title">Consumer Reporting Agency</div>
          <div class="cra-box">
            <strong>${CRA.name}</strong><br>
            ${CRA.address}<br>
            Phone: ${CRA.phone}<br>
            Email: ${CRA.email}<br>
            Website: ${CRA.website}
          </div>
          <p style="margin-top: 6px; font-size: 9pt; font-style: italic;">The consumer reporting agency did not make this decision and cannot explain why it was made.</p>
        </div>

        <div class="section">
          <div class="section-title">Your Rights</div>
          <div class="rights-box">
            <ul>
              <li>You may obtain a <strong>free copy</strong> of your consumer report within 60 days by contacting the agency above.</li>
              <li>You have the right to <strong>dispute</strong> the accuracy or completeness of any information in your report.</li>
              ${isPreAdverse ? '<li>If you believe any information is inaccurate, please contact the consumer reporting agency as soon as possible before a final decision is made.</li>' : ''}
              <li>You may have additional rights under ${jurisdictionLabel || 'state'} law.</li>
            </ul>
          </div>
        </div>
        ` : `
        <div class="section">
          <p style="font-size: 10pt;">If you have questions about this decision, please contact the property manager.</p>
        </div>
        `}

        ${stateId ? getStateAdverseActionHtml(stateId) : ''}

        <div class="signature">
          <p>Sincerely,</p>
          <div class="signature-line">
            Property Manager / Owner
          </div>
        </div>

        <div class="footer">
          ${isPreAdverse ? 'This notice is provided in accordance with the Fair Credit Reporting Act (15 U.S.C. § 1681m(a))' : isFcra ? 'This notice is provided in accordance with the Fair Credit Reporting Act (15 U.S.C. § 1681m)' : 'This notice is provided for your records'}
          ${jurisdictionLabel ? ` and applicable ${jurisdictionLabel} fair housing laws` : ''}.
        </div>
      </body>
      </html>
    `;

    // Generate PDF using puppeteer with system Chromium
    const puppeteer = await import('puppeteer');
    const chromiumPath = execSync('which chromium').toString().trim();
    const browser = await puppeteer.default.launch({
      headless: true,
      executablePath: chromiumPath,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      const pdfBuffer = await page.pdf({
        format: 'Letter',
        margin: { top: '0.25in', right: '0.25in', bottom: '0.25in', left: '0.25in' },
        printBackground: true,
      });

      const filename = isFcra 
        ? `adverse-action-letter-${new Date().toISOString().split('T')[0]}.pdf`
        : `denial-notice-${new Date().toISOString().split('T')[0]}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(Buffer.from(pdfBuffer));
    } finally {
      await browser.close();
    }
  }));

  // Admin: Get coverage report (all states x topics matrix)
  app.get('/api/admin/state-notes/coverage', isAuthenticated, requireAdmin, asyncHandler(async (req: any, res) => {
    const coverage = await storage.getStateNotesCoverage();
    const allStates = await storage.getAllStates();
    
    // Import topics from shared module
    const { 
      CREDIT_TOPICS, 
      CRIMINAL_EVICTION_TOPICS, 
      HIGH_RISK_TOPICS,
      REQUIRED_CREDIT_TOPICS,
      REQUIRED_CRIMINAL_EVICTION_TOPICS,
    } = await import('@shared/decoderTopics');
    
    // Build full coverage matrix
    const matrix: Array<{
      stateId: string;
      stateName: string;
      decoder: string;
      topic: string;
      hasApproved: boolean;
      lastReviewedAt: Date | null;
      isHighRisk: boolean;
      isRequired: boolean;
    }> = [];
    
    // Per-state decoder-ready status
    const stateStatus: Array<{
      stateId: string;
      stateName: string;
      decoderNotesReady: boolean;
      requiredCriminalEvictionApproved: number;
      requiredCriminalEvictionTotal: number;
      requiredCreditApproved: number;
      requiredCreditTotal: number;
      isActuallyReady: boolean;
    }> = [];
    
    for (const state of allStates.filter(s => s.isActive)) {
      let requiredCriminalEvictionApproved = 0;
      let requiredCreditApproved = 0;
      
      // Credit topics
      for (const topic of CREDIT_TOPICS) {
        const existing = coverage.find(c => c.stateId === state.id && c.decoder === 'credit' && c.topic === topic);
        const isRequired = REQUIRED_CREDIT_TOPICS.includes(topic as any);
        const hasApproved = existing?.hasApproved || false;
        
        if (isRequired && hasApproved) requiredCreditApproved++;
        
        matrix.push({
          stateId: state.id,
          stateName: state.name,
          decoder: 'credit',
          topic,
          hasApproved,
          lastReviewedAt: existing?.lastReviewedAt || null,
          isHighRisk: HIGH_RISK_TOPICS.includes(topic as any),
          isRequired,
        });
      }
      
      // Criminal/eviction topics
      for (const topic of CRIMINAL_EVICTION_TOPICS) {
        const existing = coverage.find(c => c.stateId === state.id && c.decoder === 'criminal_eviction' && c.topic === topic);
        const isRequired = REQUIRED_CRIMINAL_EVICTION_TOPICS.includes(topic as any);
        const hasApproved = existing?.hasApproved || false;
        
        if (isRequired && hasApproved) requiredCriminalEvictionApproved++;
        
        matrix.push({
          stateId: state.id,
          stateName: state.name,
          decoder: 'criminal_eviction',
          topic,
          hasApproved,
          lastReviewedAt: existing?.lastReviewedAt || null,
          isHighRisk: HIGH_RISK_TOPICS.includes(topic as any),
          isRequired,
        });
      }
      
      // Compute actual readiness (all required topics approved)
      const isActuallyReady = 
        requiredCriminalEvictionApproved === REQUIRED_CRIMINAL_EVICTION_TOPICS.length &&
        requiredCreditApproved === REQUIRED_CREDIT_TOPICS.length;
      
      stateStatus.push({
        stateId: state.id,
        stateName: state.name,
        decoderNotesReady: state.decoderNotesReady || false,
        requiredCriminalEvictionApproved,
        requiredCriminalEvictionTotal: REQUIRED_CRIMINAL_EVICTION_TOPICS.length,
        requiredCreditApproved,
        requiredCreditTotal: REQUIRED_CREDIT_TOPICS.length,
        isActuallyReady,
      });
    }
    
    // Calculate summary stats
    const totalCells = matrix.length;
    const approvedCount = matrix.filter(m => m.hasApproved).length;
    const highRiskMissing = matrix.filter(m => m.isHighRisk && !m.hasApproved);
    const statesReady = stateStatus.filter(s => s.isActuallyReady).length;
    
    res.json({
      matrix,
      stateStatus,
      summary: {
        totalCells,
        approvedCount,
        coveragePercent: Math.round((approvedCount / totalCells) * 100),
        highRiskMissingCount: highRiskMissing.length,
        statesReady,
        statesTotal: stateStatus.length,
      }
    });
  }));

  const httpServer = createServer(app);
  return httpServer;
}
