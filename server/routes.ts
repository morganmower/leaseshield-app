import type { Express } from "express";
import { createServer, type Server } from "http";
import cookieParser from "cookie-parser";
import { storage } from "./storage";
import { isAuthenticated, requireAccess, requireAdmin } from "./jwtAuth";
import authRoutes from "./authRoutes";
import Stripe from "stripe";
import { insertTemplateSchema, insertComplianceCardSchema, insertLegalUpdateSchema, insertBlogPostSchema, users, insertUploadedDocumentSchema, insertCommunicationTemplateSchema, insertRentLedgerEntrySchema, insertPropertySchema, insertSavedDocumentSchema } from "@shared/schema";
import { z } from "zod";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { emailService } from "./emailService";
import OpenAI from "openai";
import { getUncachableResendClient } from "./resend";
import { generateLegalUpdateEmail } from "./email-templates";
import { notifyUsersOfTemplateUpdate } from "./templateNotifications";
import { asyncHandler, RateLimiter } from "./utils/validation";
import multer from "multer";
import path from "path";
import { randomUUID } from "crypto";
import fs from "fs/promises";

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

export async function registerRoutes(app: Express): Promise<Server> {
  // Trust proxy - required for secure cookies behind Replit's HTTPS proxy
  app.set('trust proxy', 1);
  
  // Cookie parser for refresh tokens
  app.use(cookieParser());
  
  // JWT Auth routes
  app.use('/api/auth', authRoutes);

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
      
      // Only allow supported states
      const supportedStates = ['UT', 'TX', 'ND', 'SD', 'NC', 'OH', 'MI', 'ID', 'WY', 'CA', 'VA', 'NV', 'AZ', 'FL'];
      if (validatedData.preferredState && !supportedStates.includes(validatedData.preferredState)) {
        return res.status(400).json({ message: "Invalid state selection" });
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
            const subscriptionEndsAt = periodEnd 
              ? new Date(periodEnd * 1000)
              : undefined;
            
            await storage.updateUserStripeInfo(userResults[0].id, {
              subscriptionStatus: status,
              billingInterval,
              subscriptionEndsAt,
              // Clear payment failed timestamp if subscription is now active
              paymentFailedAt: status === 'active' ? null : undefined,
            });
            console.log(`Updated user ${userResults[0].id} subscription: status=${status}, interval=${billingInterval}, ends=${subscriptionEndsAt?.toISOString()}`);
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
            // Payment successful - update to active and clear any payment failure state
            await storage.updateUserStripeInfo(userResults[0].id, {
              subscriptionStatus: 'active',
              paymentFailedAt: null, // Clear payment failed timestamp on successful payment
            });
            console.log(`User ${userResults[0].id} payment succeeded - marked as active, cleared payment failed state`);
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

      let pdfBuffer: Buffer;
      
      // Route to appropriate generator based on template type
      if (template.templateType === 'move_out_checklist' || template.templateType === 'move_in_checklist') {
        // Use move-out/move-in checklist generator
        const { generateMoveOutChecklistPdf } = await import('./utils/moveOutChecklistGenerator');
        pdfBuffer = await generateMoveOutChecklistPdf({
          templateTitle: template.title,
          stateId: template.stateId,
          version: template.version || 1,
          updatedAt: template.updatedAt || new Date(),
        });
      } else {
        // Default to rental application generator for other static templates
        const { generateBlankApplicationPdf } = await import('./utils/blankApplicationGenerator');
        pdfBuffer = await generateBlankApplicationPdf({
          templateTitle: template.title,
          stateId: template.stateId,
          version: template.version || 1,
          updatedAt: template.updatedAt || new Date(),
        });
      }

      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${template.title.replace(/[^a-z0-9]/gi, '_')}.pdf"`);
      res.send(pdfBuffer);

      // Track analytics event
      await storage.trackEvent({
        userId,
        eventType: 'blank_template_downloaded',
        eventData: { templateId: template.id, templateTitle: template.title },
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

      // Import document generator
      const { generateDocument } = await import('./utils/documentGenerator');

      // Generate PDF using default template (all user input is HTML-escaped)
      const pdfBuffer = await generateDocument({
        templateTitle: template.title,
        templateContent: '', // Always empty - use default generation only
        fieldValues: document.formData as Record<string, string>,
        stateId: template.stateId,
        version: template.version || 1,
        updatedAt: template.updatedAt || new Date(),
      });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${document.documentName}.pdf"`);
      res.send(pdfBuffer);

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
        // Get legal updates from all 4 monitored states
        const utUpdates = await storage.getLegalUpdatesByState('UT');
        const txUpdates = await storage.getLegalUpdatesByState('TX');
        const ndUpdates = await storage.getLegalUpdatesByState('ND');
        const sdUpdates = await storage.getLegalUpdatesByState('SD');
        updates = [...utUpdates, ...txUpdates, ...ndUpdates, ...sdUpdates];
      } else {
        updates = await storage.getLegalUpdatesByState(stateId as string);
      }
      
      // Also fetch recent legislative monitoring records (high/medium relevance) for this state(s)
      let legislativeUpdates: any[] = [];
      if (stateId === 'NATIONAL') {
        const allBills = await storage.getAllLegislativeMonitoring({});
        legislativeUpdates = allBills.filter(b => b.relevanceLevel === 'high' || b.relevanceLevel === 'medium');
      } else {
        const bills = await storage.getAllLegislativeMonitoring({ stateId: stateId as string });
        legislativeUpdates = bills.filter(b => b.relevanceLevel === 'high' || b.relevanceLevel === 'medium');
      }
      
      // Combine and sort by date (most recent first)
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
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      res.json(combined);
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

      const validated = insertRentLedgerEntrySchema.parse({
        ...req.body,
        userId,
      });

      const entry = await storage.createRentLedgerEntry(validated);
      res.json(entry);
    } catch (error) {
      console.error("Error creating rent ledger entry:", error);
      res.status(500).json({ message: "Failed to create entry" });
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

  // States routes
  app.get('/api/states', async (req, res) => {
    try {
      const states = await storage.getAllStates();
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
      const users = update.impactLevel === 'high' 
        ? await storage.getAllActiveUsers() 
        : await storage.getUsersByState(update.stateId);
      
      const { client, fromEmail } = await getUncachableResendClient();
      
      let successCount = 0;
      let errorCount = 0;
      
      // Send emails to all users
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

  // Admin - Get template review queue
  app.get("/api/admin/template-review-queue", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const reviews = await storage.getAllTemplateReviewQueue({
        status: req.query.status as string | undefined,
      });

      const enrichedReviews = await Promise.all(
        reviews.map(async (review) => {
          const template = await storage.getTemplate(review.templateId);
          return { ...review, template };
        })
      );

      res.json({ reviews: enrichedReviews, total: enrichedReviews.length });
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

  // Generate filled document (PDF)
  app.post('/api/documents/generate', isAuthenticated, async (req: any, res) => {
    try {
      const { templateId, fieldValues } = req.body;

      if (!templateId || !fieldValues) {
        return res.status(400).json({ message: "Template ID and field values are required" });
      }

      console.log('📄 Document generation request:', {
        templateId,
        fieldCount: Object.keys(fieldValues || {}).length,
        fieldIds: Object.keys(fieldValues || {}),
        sampleValues: Object.entries(fieldValues || {}).slice(0, 3).map(([k, v]) => `${k}=${v}`)
      });

      // Get template
      const template = await storage.getTemplate(templateId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      console.log('📄 Template found:', template.title, '- Generating PDF with field values...');

      // SECURITY: We NEVER use custom templateContent from the database to prevent HTML injection.
      // All documents are generated using the default template generator with fully escaped user input.
      // If custom templates are needed in the future, they MUST be:
      // 1. Created only by admin users
      // 2. Stored as safe placeholder-based templates (not raw HTML)
      // 3. Rendered through a safe templating engine with auto-escaping

      // Import document generator
      const { generateDocument } = await import('./utils/documentGenerator');

      // Generate PDF using default template (all user input is HTML-escaped)
      const pdfBuffer = await generateDocument({
        templateTitle: template.title,
        templateContent: '', // Always empty - use default generation only
        fieldValues,
        stateId: template.stateId,
        version: template.version || 1,
        updatedAt: template.updatedAt || new Date(),
      });

      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${template.title.replace(/[^a-z0-9]/gi, '_')}.pdf"`);
      res.send(pdfBuffer);
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
        // Get all cases across all states
        cases = await db.query.caseLawMonitoring.findMany({
          where: (table) => eq(table.isMonitored, true),
          limit: 100,
          orderBy: (table) => [table.dateFiled],
        });
      } else {
        // Get cases for specific state
        cases = await db.query.caseLawMonitoring.findMany({
          where: (table, { eq, and }) => and(
            eq(table.stateId, stateId as string),
            eq(table.isMonitored, true),
          ),
          limit: 50,
          orderBy: (table) => [table.dateFiled],
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

  // Get template review queue (admin only)
  app.get('/api/admin/template-review-queue', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);

      if (!user?.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const filters: any = {};
      if (req.query.status) filters.status = req.query.status as string;
      if (req.query.templateId) filters.templateId = req.query.templateId as string;

      const reviews = await storage.getAllTemplateReviewQueue(filters);
      res.json(reviews);
    } catch (error) {
      console.error('Error fetching review queue:', error);
      res.status(500).json({ message: 'Failed to fetch review queue' });
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

  // Manually trigger legislative monitoring run (admin only)
  app.post('/api/admin/legislative-monitoring/run', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);

      if (!user?.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      console.log('📋 Manually triggered legislative monitoring run by admin:', user.email);
      
      // Run the monitoring service in background (don't await)
      const { legislativeMonitoringService } = await import('./legislativeMonitoringService');
      legislativeMonitoringService.runMonthlyMonitoring().catch(err => {
        console.error('Background monitoring error:', err);
      });

      return res.json({
        success: true,
        message: 'Monitoring run started in background',
      });
    } catch (error) {
      console.error('Error running legislative monitoring:', error);
      return res.status(500).json({ 
        success: false,
        message: "Something went wrong. Please try again."
      });
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

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a helpful assistant that explains credit report information to landlords reviewing tenant applications. Help them understand risk, protect themselves from liability, and know what questions to ask.

REQUIRED RESPONSE STRUCTURE (use these exact headers):

**WHAT THIS MEANS**
[1-2 sentences in plain English explaining the term or credit situation]

**YOUR LIABILITY AS A LANDLORD**
• [How this could affect you financially - unpaid rent, property damage, legal costs]
• [Risk level: low/medium/high and why]

**RED FLAGS TO WATCH FOR**
• [Specific warning sign]
• [Another warning sign]
• [Pattern to look for]

**FCRA & FAIR HOUSING COMPLIANCE**
• [FCRA adverse action notice requirement if denying based on credit]
• [Equal application of criteria to all applicants]
• [Documentation requirement]

**QUESTIONS TO ASK THE APPLICANT**
1. "[Specific conversational question]"
2. "[Follow-up question to dig deeper]"
3. "[Question about their current stability]"

**STEPS TO PROTECT YOURSELF**
• [Specific protective action - verify income, require larger deposit, etc.]
• [Documentation step]
• [Additional safeguard if applicable]

CRITICAL RULES:
- ALWAYS explain the landlord's financial risk/liability
- ALWAYS include 2-3 specific questions to ask the applicant
- ALWAYS include protective steps they can take
- Use bullet points and numbered lists - easy to scan
- Be direct about risks but not alarmist
- Focus on: Will this person pay rent? Will they damage my property?

EXAMPLE FOR "charge-off":

**WHAT THIS MEANS**
A charge-off means the lender gave up trying to collect this debt after many missed payments. The applicant still owes the money and it severely damages their credit score.

**YOUR LIABILITY AS A LANDLORD**
• If they didn't pay a creditor, there's increased risk they won't pay you
• You could face 2-3 months of unpaid rent plus eviction costs ($2,000-5,000)
• Risk level: MEDIUM to HIGH depending on recency and amount

**RED FLAGS TO WATCH FOR**
• Multiple charge-offs = pattern of not paying debts
• Recent charge-offs (within 2 years) are more concerning
• Large dollar amounts indicate bigger financial problems

**FCRA & FAIR HOUSING COMPLIANCE**
• FCRA requires: If you deny based on credit, you MUST provide an adverse action notice with the credit bureau's contact info
• Apply the same credit criteria to ALL applicants equally - inconsistency = discrimination lawsuit risk
• Document your minimum credit score/criteria IN WRITING before screening

**QUESTIONS TO ASK THE APPLICANT**
1. "I see there was an issue with [account type] - can you tell me what happened?"
2. "Have you been able to pay this off or set up a payment plan?"
3. "What's your current income and employment situation?"

**STEPS TO PROTECT YOURSELF**
• Verify current income is at least 3x monthly rent
• Request a larger security deposit (if state law allows)
• Require a co-signer with good credit
• Get employer verification and recent pay stubs

TONE: Protective mentor looking out for the landlord's investment.`
          },
          {
            role: "user",
            content: `Analyze this credit report information for a landlord: "${trimmedTerm}"`
          }
        ],
        temperature: 0.7,
        max_tokens: 800,
      });

      const explanation = completion.choices[0]?.message?.content || 
        "I couldn't generate an explanation. Please try rephrasing your question.";

      // Track credit helper usage
      const userId = getUserId(req);
      if (userId) {
        await storage.trackEvent({
          userId,
          eventType: 'credit_helper_use',
          eventData: { termLength: trimmedTerm.length },
        });
      }

      res.json({ explanation });
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

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a helpful assistant that explains criminal background and eviction screening findings to landlords. Help them understand their liability, screen tenants FAIRLY and LEGALLY, and protect their investment.

REQUIRED RESPONSE STRUCTURE (use these exact headers):

**WHAT THIS MEANS**
[1-2 sentences in plain English explaining the term, charge, or eviction record]

**YOUR LIABILITY AS A LANDLORD**
• [Property damage risk, safety concerns for other tenants, or legal exposure]
• [Financial risk - unpaid rent, eviction costs, potential lawsuits]
• [Risk level and what factors increase/decrease it]

**FAIR HOUSING & HUD REQUIREMENTS**
• [Key legal requirement - you MUST do individual assessment per HUD 2016 guidance]
• [What you CAN deny for: specific crimes with clear connection to tenant safety or property protection]
• [What you CANNOT do: blanket bans denying anyone with ANY criminal history regardless of offense type, severity, or recency]
• [Discrimination warning - blanket policies have disparate impact and lawsuits can cost $50,000+]

**QUESTIONS TO ASK THE APPLICANT**
1. "[Specific conversational question about the situation]"
2. "[Question about rehabilitation or what's changed]"
3. "[Question about current stability - job, references, etc.]"

**STEPS TO PROTECT YOURSELF**
• [Specific protective action you can legally take]
• [Documentation requirement]
• [Additional safeguard - references, larger deposit if legal, etc.]

CRITICAL RULES:
- ALWAYS explain landlord's potential liability (financial AND legal)
- ALWAYS include 2-3 specific questions to ask the applicant
- ALWAYS include protective steps they can take
- ALWAYS mention Fair Housing - they can be sued for discrimination
- NEVER suggest automatic denial - individual assessment required
- Use bullet points and numbered lists - easy to scan
- Be direct about risks while staying legally compliant

EXAMPLE FOR "felony drug possession 5 years ago":

**WHAT THIS MEANS**
A felony drug possession conviction is a serious criminal offense related to controlled substances. This occurred 5 years ago, which provides time to assess rehabilitation.

**YOUR LIABILITY AS A LANDLORD**
• Drug-related activity could put other tenants at risk and expose you to lawsuits
• If they're still using, you may face property damage and eviction costs
• 5-year gap reduces risk - look for signs of stability and recovery
• Risk level: MEDIUM - requires individual assessment

**FAIR HOUSING & HUD REQUIREMENTS**
• HUD's 2016 guidance: You CAN deny for SPECIFIC crimes that directly relate to tenant safety or property protection
• What you CANNOT do: Have a blanket policy that denies EVERYONE with ANY criminal history regardless of offense type, severity, or recency
• Individual assessment REQUIRED: Consider the nature of the crime, severity, time elapsed, and relevance to being a good tenant
• Blanket bans have "disparate impact" on protected classes - lawsuits can cost $50,000+. Document criteria and apply equally to ALL applicants

**QUESTIONS TO ASK THE APPLICANT**
1. "I see something on your background check from 2019 - would you like to share what happened and what's changed since then?"
2. "Can you tell me about your living situation for the past few years?"
3. "Do you have references from recent landlords or employers I could contact?"

**STEPS TO PROTECT YOURSELF**
• Document your screening criteria IN WRITING and apply to ALL applicants equally
• Verify current employment and income (3x rent minimum)
• Contact previous landlords for rental history
• If you deny, provide written reason based on your documented criteria
• Consider consulting a Fair Housing attorney about your policies

TONE: Protective mentor who helps landlords avoid BOTH bad tenants AND discrimination lawsuits.`
          },
          {
            role: "user",
            content: `Analyze this criminal/eviction screening information for a landlord: "${trimmedTerm}"`
          }
        ],
        temperature: 0.7,
        max_tokens: 800,
      });

      const explanation = completion.choices[0]?.message?.content || 
        "I couldn't generate an explanation. Please try rephrasing your question.";

      // Track criminal/eviction helper usage
      const userId = getUserId(req);
      if (userId) {
        await storage.trackEvent({
          userId,
          eventType: 'criminal_helper_use',
          eventData: { termLength: trimmedTerm.length },
        });
      }

      res.json({ explanation });
    } catch (error) {
      console.error('Error explaining criminal/eviction term:', error);
      res.status(500).json({
        explanation: "Sorry, something went wrong. Please try again in a moment."
      });
    }
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

  const httpServer = createServer(app);
  return httpServer;
}
