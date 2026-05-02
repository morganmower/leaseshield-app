import type { Express } from "express";
import Stripe from "stripe";
import { eq, and } from "drizzle-orm";
import { storage } from "../storage";
import { isAuthenticated } from "../jwtAuth";
import { users, rentLedgerEntries } from "@shared/schema";
import { db } from "../db";
import { emailService } from "../emailService";
import { stripe, getUserId } from "./_shared";

export async function registerSubscriptionRoutes(app: Express) {
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

  // Idempotently finalize a successful rent payment: create the rent_ledger
  // entry exactly once, mark the request paid, and email the receipt.
  // Safe to call from both `checkout.session.completed` and `payment_intent.succeeded`.
  async function finalizeRentPaymentSuccess(
    requestId: string,
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    // Cheap pre-check: skip if already truly finalized (ledger linkage present).
    // Note: we deliberately do NOT short-circuit on `status === 'paid'` alone,
    // because a previous attempt could have failed mid-way and left the row
    // marked paid without a ledger entry. The transactional finalize below
    // handles that case correctly by re-creating the ledger entry.
    const existing = await storage.getRentPaymentRequestById(requestId);
    if (!existing) return;
    if (existing.ledgerEntryId) return;

    const property = existing.rentalPropertyId
      ? await storage.getRentalPropertyById(existing.rentalPropertyId)
      : null;
    const monthStr = new Date(existing.dueDate).toISOString().slice(0, 7);
    const amountReceived = paymentIntent.amount_received || paymentIntent.amount;
    // The rent ledger should record only the rent portion of what the tenant
    // paid (not rent + tenant convenience fee). The convenience fee is
    // routed to LeaseShield via application_fee_amount and is recorded on
    // the request itself for landlord transparency.
    const tenantPaidServiceFee =
      existing.serviceFeePayer === 'tenant' ? (existing.serviceFeeAmount || 0) : 0;
    const rentPortionReceived = Math.max(0, amountReceived - tenantPaidServiceFee);

    // Atomically insert the ledger entry AND mark the request paid in a single
    // DB transaction with row-level locking. Either both writes commit or both
    // roll back — guaranteeing eventual consistency even on partial failures.
    // Build a fee-aware notes line so landlords have a clear audit trail of
    // exactly how much went where: rent vs. convenience fee vs. platform fee.
    const feeNotesParts: string[] = [];
    if (property) feeNotesParts.push(`Property: ${property.name}`);
    if (existing.serviceFeePayer === 'tenant' && (existing.serviceFeeAmount || 0) > 0) {
      feeNotesParts.push(`Tenant paid $${(existing.serviceFeeAmount/100).toFixed(2)} service fee on top of rent`);
    } else if (existing.serviceFeePayer === 'landlord' && (existing.serviceFeeAmount || 0) > 0) {
      feeNotesParts.push(`Service fee $${(existing.serviceFeeAmount/100).toFixed(2)} absorbed by landlord`);
    }
    if ((existing.platformFeeAmount || 0) > 0) {
      feeNotesParts.push(`LeaseShield platform fee $${(existing.platformFeeAmount/100).toFixed(2)} deducted at settlement`);
    }
    const feeNotes = feeNotesParts.length > 0 ? feeNotesParts.join(' • ') : null;

    const result = await storage.finalizeRentPaymentInTransaction(
      requestId,
      paymentIntent.id,
      rentPortionReceived,
      {
        userId: existing.userId,
        // NOTE: rent_ledger_entries.propertyId FK still references the legacy
        // `properties` table; new rental_properties IDs cannot be set directly
        // here without a separate schema migration. Property name is preserved
        // in description/notes for visibility and is rendered in the UI.
        propertyId: null,
        tenantName: existing.tenantName,
        month: monthStr,
        effectiveDate: new Date(),
        type: 'payment',
        category: 'Rent',
        description: `Online ACH payment via Stripe (req ${existing.id.slice(0, 8)})`,
        // Record the rent portion only — fees are separately accounted for on
        // the request row and surfaced to the landlord as informational notes.
        amountExpected: existing.amount,
        amountReceived: rentPortionReceived,
        paymentMethod: 'ACH (Stripe)',
        referenceNumber: paymentIntent.id,
        notes: feeNotes,
      },
    );

    if (!result) {
      console.log(`⏭️  Rent payment ${requestId} already finalized by another worker — skipping.`);
      return;
    }

    const { request: r, ledgerEntry } = result;
    console.log(`✅ Rent payment finalized: request ${r.id}, ledger ${ledgerEntry.id}`);

    // Send tenant receipt email (best-effort, runs after the transaction commits)
    if (r.tenantEmail) {
      try {
        const landlord = await storage.getUser(r.userId);
        const landlordName = landlord
          ? (landlord.firstName && landlord.lastName
              ? `${landlord.firstName} ${landlord.lastName}`
              : (landlord.businessName || landlord.email || 'Your Landlord'))
          : 'Your Landlord';
        let receiptUrl: string | null = null;
        if (paymentIntent.latest_charge) {
          try {
            const chargeId = typeof paymentIntent.latest_charge === 'string'
              ? paymentIntent.latest_charge
              : paymentIntent.latest_charge.id;
            const charge = await stripe.charges.retrieve(chargeId);
            receiptUrl = charge.receipt_url || null;
          } catch {}
        }
        await emailService.sendRentReceiptEmail(
          { email: r.tenantEmail, tenantName: r.tenantName },
          {
            landlordName,
            amountDollars: (amountReceived / 100).toFixed(2),
            paidDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
            propertyName: property?.name || null,
            receiptUrl,
          },
        );
      } catch (emailErr) {
        console.error('Failed to send rent receipt email:', emailErr);
      }
    }
  }

  // Records a ledger entry for a failed/returned ACH payment attempt so the
  // landlord has a complete audit trail (paid + failed events on one timeline).
  // Idempotent: dedupes on referenceNumber = `failed:${paymentIntentId}`.
  // Does NOT affect balance math — uses amountExpected:0 / amountReceived:0.
  async function recordFailedRentPaymentAttempt(
    requestId: string,
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    try {
      const r = await storage.getRentPaymentRequestById(requestId);
      if (!r) return;

      const refKey = `failed:${paymentIntent.id}`;
      const existing = await db
        .select({ id: rentLedgerEntries.id })
        .from(rentLedgerEntries)
        .where(and(
          eq(rentLedgerEntries.userId, r.userId),
          eq(rentLedgerEntries.referenceNumber, refKey),
        ))
        .limit(1);
      if (existing.length > 0) {
        console.log(`⏭️  Failed-payment ledger entry already exists for ${paymentIntent.id} — skipping.`);
        return;
      }

      const property = r.rentalPropertyId
        ? await storage.getRentalPropertyById(r.rentalPropertyId)
        : null;
      const monthStr = new Date(r.dueDate).toISOString().slice(0, 7);
      const attemptedDollars = (r.amount / 100).toFixed(2);
      const reason = paymentIntent.last_payment_error?.message
        || paymentIntent.last_payment_error?.code
        || 'Bank declined or returned the transfer';

      await storage.createRentLedgerEntry({
        userId: r.userId,
        // Same FK caveat as the success path: rent_ledger_entries.propertyId
        // references the legacy `properties` table; new rentalProperties IDs
        // can't be set directly without a migration.
        propertyId: null,
        tenantName: r.tenantName,
        month: monthStr,
        effectiveDate: new Date(),
        type: 'payment',
        category: 'Failed Payment',
        description: `ACH payment of $${attemptedDollars} failed: ${reason}`,
        amountExpected: 0,
        amountReceived: 0,
        paymentMethod: 'ACH (Failed)',
        referenceNumber: refKey,
        notes: property ? `Property: ${property.name} • Request ${r.id.slice(0, 8)}` : `Request ${r.id.slice(0, 8)}`,
      });

      console.log(`📒 Failed rent payment logged to ledger: request ${r.id}, intent ${paymentIntent.id}`);
    } catch (err: any) {
      console.error('Failed to record failed-payment ledger entry:', err?.message);
    }
  }

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
              const { emailService } = await import("../emailService");
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
                const { emailService } = await import("../emailService");
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

        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          const meta = session.metadata || {};

          // Recurring auto-pay setup (mode: 'setup'). The PaymentMethod attaches via
          // setup_intent.succeeded — this case just records that the session completed
          // so we have a paper trail even if the SI event arrives out of order.
          if (meta.leaseshield_kind === 'rent_auto_pay_setup' && session.mode === 'setup') {
            console.log(`🏦 Auto-pay setup session completed: ${session.id}`);
            // Heavy lifting (PM activation, mandate capture) happens in setup_intent.succeeded.
            break;
          }

          if (meta.leaseshield_kind === 'rent_payment' && meta.rent_payment_request_id) {
            const requestId = meta.rent_payment_request_id;
            const r = await storage.getRentPaymentRequestById(requestId);
            if (r) {
              const piId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
              await storage.updateRentPaymentRequest(r.id, {
                stripePaymentIntentId: piId || r.stripePaymentIntentId,
                ...(r.status === 'paid' ? {} : { status: 'processing' as const }),
              });
              console.log(`💰 Rent checkout session completed for request ${r.id} (payment_status=${session.payment_status})`);

              // If the session already shows paid (e.g., card-style instant settle),
              // retrieve the PaymentIntent and finalize so we never miss the ledger entry.
              if (session.payment_status === 'paid' && piId) {
                try {
                  const pi = await stripe.paymentIntents.retrieve(piId);
                  await finalizeRentPaymentSuccess(r.id, pi);
                } catch (err: any) {
                  console.error(`Failed to finalize rent payment from checkout session for ${r.id}:`, err?.message);
                }
              }
            }
          }
          break;
        }

        case 'payment_intent.processing': {
          const pi = event.data.object as Stripe.PaymentIntent;
          const meta = pi.metadata || {};
          if (meta.leaseshield_kind === 'rent_payment' && meta.rent_payment_request_id) {
            const r = await storage.getRentPaymentRequestById(meta.rent_payment_request_id);
            if (r && r.status !== 'paid') {
              await storage.updateRentPaymentRequest(r.id, {
                stripePaymentIntentId: pi.id,
                status: 'processing',
              });
              console.log(`⏳ Rent payment processing (ACH initiated) for request ${r.id}`);
            }
          }
          break;
        }

        case 'payment_intent.payment_failed': {
          const pi = event.data.object as Stripe.PaymentIntent;
          const meta = pi.metadata || {};
          if ((meta.leaseshield_kind === 'rent_payment' || meta.leaseshield_kind === 'rent_payment_recurring')
              && meta.rent_payment_request_id) {
            if (meta.leaseshield_kind === 'rent_payment_recurring' && meta.rent_subscription_id) {
              await storage.updateRentSubscription(meta.rent_subscription_id, {
                lastDebitAttemptAt: new Date(),
              });
            }
            const r = await storage.getRentPaymentRequestById(meta.rent_payment_request_id);
            if (r && r.status !== 'paid') {
              await storage.updateRentPaymentRequest(r.id, {
                status: r.lateFeeAppliedAt ? 'overdue' : 'pending',
              });
              console.log(`❌ Rent payment failed for request ${r.id}: ${pi.last_payment_error?.message || 'unknown'}`);
              // Auto-write a "Failed Payment" row to the ledger so the landlord
              // sees both successful and failed attempts on one timeline.
              await recordFailedRentPaymentAttempt(r.id, pi);
            }
          }
          break;
        }

        case 'account.updated': {
          const acct = event.data.object as Stripe.Account;
          // Find user by connected account id
          const userResults = await db.select().from(users).where(eq(users.stripeConnectAccountId, acct.id)).limit(1);
          if (userResults.length > 0) {
            await storage.updateUserStripeConnect(userResults[0].id, {
              stripeConnectChargesEnabled: !!acct.charges_enabled,
              stripeConnectPayoutsEnabled: !!acct.payouts_enabled,
              stripeConnectDetailsSubmitted: !!acct.details_submitted,
            });
            console.log(`🔗 Connect account updated for user ${userResults[0].id}: charges=${acct.charges_enabled}, payouts=${acct.payouts_enabled}`);
          }
          break;
        }

        case 'payment_intent.succeeded': {
          const paymentIntent = event.data.object as Stripe.PaymentIntent & { invoice?: string };
          const invoiceId = paymentIntent.invoice;
          const meta = paymentIntent.metadata || {};

          // Rent payment via Stripe Connect (one-time + recurring share the finalizer)
          if ((meta.leaseshield_kind === 'rent_payment' || meta.leaseshield_kind === 'rent_payment_recurring')
              && meta.rent_payment_request_id) {
            try {
              await finalizeRentPaymentSuccess(meta.rent_payment_request_id, paymentIntent);
              if (meta.leaseshield_kind === 'rent_payment_recurring' && meta.rent_subscription_id) {
                await storage.updateRentSubscription(meta.rent_subscription_id, {
                  lastDebitAttemptAt: new Date(),
                });
              }
            } catch (e: any) {
              console.error('Failed to record rent payment:', e?.message);
            }
            break;
          }

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

        // ===== Recurring auto-pay (Plan B) lifecycle events =====

        case 'setup_intent.succeeded': {
          const si = event.data.object as Stripe.SetupIntent;
          const meta = si.metadata || {};
          if (meta.leaseshield_kind !== 'rent_auto_pay_setup' || !meta.rent_subscription_id) break;
          try {
            const sub = await storage.getRentSubscriptionById(meta.rent_subscription_id);
            if (!sub) {
              console.warn(`setup_intent.succeeded: subscription ${meta.rent_subscription_id} not found`);
              break;
            }
            const pmId = typeof si.payment_method === 'string' ? si.payment_method : si.payment_method?.id;
            const mandateId = typeof si.mandate === 'string' ? si.mandate : (si.mandate as any)?.id || null;
            if (!pmId) {
              console.warn(`setup_intent.succeeded for ${sub.id} has no payment_method`);
              break;
            }
            // Pull bank info for the tenant-facing UI
            let last4: string | null = null;
            let bankName: string | null = null;
            try {
              const pm = await stripe.paymentMethods.retrieve(pmId);
              if (pm.us_bank_account) {
                last4 = pm.us_bank_account.last4 || null;
                bankName = pm.us_bank_account.bank_name || null;
              }
            } catch (pmErr: any) {
              console.warn(`Could not retrieve PM ${pmId}:`, pmErr?.message);
            }

            // Snapshot the mandate text shown to the tenant. We rebuild it here
            // so it matches the most recent disclosure shown on the auth page.
            const landlord = await storage.getUser(sub.userId);
            const property = sub.rentalPropertyId
              ? await storage.getRentalPropertyById(sub.rentalPropertyId)
              : null;
            const landlordName =
              [landlord?.firstName, landlord?.lastName].filter(Boolean).join(' ').trim() ||
              landlord?.email || 'your landlord';

            // Compute initial nextScheduledDate = max(startDate, today aligned to dayOfMonth)
            const today = new Date().toISOString().slice(0, 10);
            const initialNext = sub.startDate > today ? sub.startDate : today;

            await storage.updateRentSubscription(sub.id, {
              status: 'active',
              stripeSetupIntentId: si.id,
              stripePaymentMethodId: pmId,
              stripeMandateId: mandateId,
              bankAccountLast4: last4 ?? sub.bankAccountLast4 ?? null,
              bankAccountBankName: bankName ?? sub.bankAccountBankName ?? null,
              mandateAcceptedAt: new Date(),
              activatedAt: new Date(),
              nextScheduledDate: initialNext,
            });
            console.log(`✅ Auto-pay activated for subscription ${sub.id} (PM ${pmId})`);
          } catch (err: any) {
            console.error('Failed to handle setup_intent.succeeded:', err?.message);
          }
          break;
        }

        case 'payment_method.detached': {
          const pm = event.data.object as Stripe.PaymentMethod;
          try {
            const sub = await storage.getRentSubscriptionByPaymentMethodId(pm.id);
            if (!sub) break;
            if (sub.status === 'active' || sub.status === 'paused') {
              await storage.updateRentSubscription(sub.id, {
                status: 'revoked_by_tenant',
                revokedAt: new Date(),
                revokedReason: sub.revokedReason || 'Bank PaymentMethod detached',
                nextScheduledDate: null,
              });
              console.log(`🚫 Auto-pay subscription ${sub.id} marked revoked (PM detached)`);
            }
          } catch (err: any) {
            console.error('Failed to handle payment_method.detached:', err?.message);
          }
          break;
        }

        case 'mandate.updated': {
          const mandate = event.data.object as Stripe.Mandate;
          if (mandate.status === 'active') break;
          try {
            const sub = await storage.getRentSubscriptionByMandateId(mandate.id);
            if (!sub) break;
            if (sub.status === 'active' || sub.status === 'paused') {
              await storage.updateRentSubscription(sub.id, {
                status: 'revoked_by_tenant',
                revokedAt: new Date(),
                revokedReason: `Stripe mandate became ${mandate.status}`,
                nextScheduledDate: null,
              });
              console.log(`🚫 Auto-pay subscription ${sub.id} marked revoked (mandate ${mandate.status})`);
            }
          } catch (err: any) {
            console.error('Failed to handle mandate.updated:', err?.message);
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
}
