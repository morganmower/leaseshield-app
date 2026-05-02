import type { Express } from "express";
import Stripe from "stripe";
import crypto, { randomBytes } from "crypto";
import { storage } from "../storage";
import { isAuthenticated } from "../jwtAuth";
import { insertRentPaymentRequestSchema, type RentPaymentRequest } from "@shared/schema";
import { emailService } from "../emailService";
import { getAppBaseUrl } from "../utils/appUrl";
import { stripe, getUserId } from "./_shared";

export async function registerRentPaymentsRoutes(app: Express) {
  // =====================================================================
  app.get('/api/rent-payments', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const list = await storage.getRentPaymentRequests(userId);
      res.json(list);
    } catch (error) {
      console.error('Error fetching rent payments:', error);
      res.status(500).json({ message: 'Failed to fetch rent payments' });
    }
  });

  app.post('/api/rent-payments', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: 'User not found' });
      if (!user.stripeConnectChargesEnabled || !user.stripeConnectAccountId) {
        return res.status(400).json({
          message: 'Connect your Stripe account before creating rent payment requests.',
        });
      }

      const body = req.body || {};
      const amountDollars = parseFloat(body.amountDollars ?? '0');
      const lateFeeDollars = parseFloat(body.lateFeeDollars ?? '0');
      const amount = Math.round(amountDollars * 100);
      const lateFeeAmount = Math.max(0, Math.round(lateFeeDollars * 100));
      if (!amount || amount < 100) {
        return res.status(400).json({ message: 'Amount must be at least $1.00' });
      }
      if (!body.tenantName || !body.dueDate) {
        return res.status(400).json({ message: 'tenantName and dueDate are required' });
      }

      // Validate property ownership if provided
      let rentalPropertyId: string | null = null;
      if (body.rentalPropertyId) {
        const p = await storage.getRentalPropertyById(body.rentalPropertyId);
        if (!p || p.userId !== userId) {
          return res.status(400).json({ message: 'Invalid property' });
        }
        rentalPropertyId = p.id;
      }

      const insertData = {
        userId,
        rentalPropertyId,
        tenantName: String(body.tenantName).trim(),
        tenantEmail: body.tenantEmail ? String(body.tenantEmail).trim() : null,
        amount,
        dueDate: body.dueDate,
        description: body.description || null,
        lateFeeAmount,
        gracePeriodDays: Number.isFinite(parseInt(body.gracePeriodDays)) ? parseInt(body.gracePeriodDays) : 5,
        reminderDaysBefore: Number.isFinite(parseInt(body.reminderDaysBefore)) ? parseInt(body.reminderDaysBefore) : 5,
      };
      const validated = insertRentPaymentRequestSchema.parse(insertData);
      const publicToken = crypto.randomBytes(24).toString('hex');
      const created = await storage.createRentPaymentRequest({ ...validated, publicToken });

      const baseUrl = getAppBaseUrl(req);
      res.json({ ...created, paymentLink: `${baseUrl}/pay-rent/${publicToken}` });
    } catch (error: any) {
      console.error('Error creating rent payment request:', error);
      if (error?.issues) {
        return res.status(400).json({ message: 'Validation failed', issues: error.issues });
      }
      res.status(500).json({ message: error?.message || 'Failed to create rent payment request' });
    }
  });

  // PATCH: edit an unpaid rent payment request (amount, due date, late fee,
  // grace period, reminder window, description, property, tenant info).
  // Blocked when status is paid or processing. If the amount or due date
  // changes AND there's an open Stripe Checkout session, expire it so the
  // tenant can't pay against stale terms — they'll get a fresh session on
  // their next click. Mirrors the DELETE endpoint's session-expiry pattern.
  app.patch('/api/rent-payments/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const existing = await storage.getRentPaymentRequest(req.params.id, userId);
      if (!existing) return res.status(404).json({ message: 'Not found' });
      if (existing.status === 'paid' || existing.status === 'processing') {
        return res.status(400).json({
          message: 'This payment is already paid or processing and can no longer be edited.',
        });
      }

      const body = req.body || {};
      const updates: Partial<RentPaymentRequest> = {};

      if (body.tenantName !== undefined) {
        const t = String(body.tenantName).trim();
        if (!t) return res.status(400).json({ message: 'tenantName cannot be empty' });
        updates.tenantName = t;
      }
      if (body.tenantEmail !== undefined) {
        updates.tenantEmail = body.tenantEmail ? String(body.tenantEmail).trim() : null;
      }
      if (body.amountDollars !== undefined) {
        const parsed = parseFloat(body.amountDollars);
        if (!Number.isFinite(parsed)) return res.status(400).json({ message: 'amountDollars must be a number' });
        const amt = Math.round(parsed * 100);
        if (!amt || amt < 100) return res.status(400).json({ message: 'Amount must be at least $1.00' });
        updates.amount = amt;
      }
      if (body.dueDate !== undefined) {
        if (!body.dueDate) return res.status(400).json({ message: 'dueDate is required' });
        const d = new Date(body.dueDate);
        if (isNaN(d.getTime())) return res.status(400).json({ message: 'dueDate is not a valid date' });
        updates.dueDate = body.dueDate;
      }
      if (body.description !== undefined) {
        updates.description = body.description || null;
      }
      if (body.lateFeeDollars !== undefined) {
        const parsed = parseFloat(body.lateFeeDollars);
        if (!Number.isFinite(parsed) || parsed < 0) {
          return res.status(400).json({ message: 'lateFeeDollars must be a non-negative number' });
        }
        updates.lateFeeAmount = Math.round(parsed * 100);
      }
      if (body.gracePeriodDays !== undefined) {
        const g = parseInt(body.gracePeriodDays);
        if (!Number.isFinite(g) || g < 0) {
          return res.status(400).json({ message: 'gracePeriodDays must be a non-negative integer' });
        }
        updates.gracePeriodDays = g;
      }
      if (body.reminderDaysBefore !== undefined) {
        const r = parseInt(body.reminderDaysBefore);
        if (!Number.isFinite(r) || r < 0) {
          return res.status(400).json({ message: 'reminderDaysBefore must be a non-negative integer' });
        }
        updates.reminderDaysBefore = r;
      }
      if (body.rentalPropertyId !== undefined) {
        if (body.rentalPropertyId) {
          const p = await storage.getRentalPropertyById(body.rentalPropertyId);
          if (!p || p.userId !== userId) return res.status(400).json({ message: 'Invalid property' });
          updates.rentalPropertyId = p.id;
        } else {
          updates.rentalPropertyId = null;
        }
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: 'No changes provided' });
      }

      // If amount or due date changed, expire any open checkout session so the
      // tenant can't complete payment against the old terms.
      const amountChanged = updates.amount !== undefined && updates.amount !== existing.amount;
      const dueChanged = updates.dueDate !== undefined &&
        new Date(updates.dueDate as any).toISOString() !== new Date(existing.dueDate).toISOString();
      if ((amountChanged || dueChanged) && existing.stripeCheckoutSessionId) {
        try {
          const session = await stripe.checkout.sessions.retrieve(existing.stripeCheckoutSessionId);
          if (session.status === 'open') {
            await stripe.checkout.sessions.expire(existing.stripeCheckoutSessionId);
          }
        } catch (err: any) {
          if (err?.code !== 'resource_missing') {
            console.error(`Failed to expire checkout session for rent request ${existing.id}:`, err?.message);
            return res.status(409).json({
              message: 'Could not refresh the active checkout session. Please try again in a moment.',
            });
          }
        }
        // Clear the stale session id; a fresh one will be created on the next
        // tenant click via /api/rent-payments/public/:token/checkout.
        updates.stripeCheckoutSessionId = null;
      }

      const updated = await storage.updateRentPaymentRequest(existing.id, updates);
      if (!updated) return res.status(500).json({ message: 'Update failed' });
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating rent payment request:', error);
      res.status(500).json({ message: error?.message || 'Failed to update' });
    }
  });

  app.delete('/api/rent-payments/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const existing = await storage.getRentPaymentRequest(req.params.id, userId);
      if (!existing) return res.status(404).json({ message: 'Not found' });
      if (existing.status === 'paid' || existing.status === 'processing') {
        return res.status(400).json({ message: 'Cannot delete a payment that is paid or processing' });
      }

      // If there is an active (open) Stripe Checkout Session, expire it first
      // so the tenant cannot complete payment against a deleted request and
      // leave us with an unreconciled webhook.
      if (existing.stripeCheckoutSessionId) {
        try {
          const session = await stripe.checkout.sessions.retrieve(existing.stripeCheckoutSessionId);
          if (session.status === 'open') {
            await stripe.checkout.sessions.expire(existing.stripeCheckoutSessionId);
          }
        } catch (err: any) {
          // If the session no longer exists or is already complete/expired,
          // continue — but if it was open and expire failed, abort the delete
          // so the user can retry rather than risk a charge against a deleted request.
          if (err?.code !== 'resource_missing') {
            console.error(`Failed to expire checkout session for rent request ${existing.id}:`, err?.message);
            return res.status(409).json({
              message: 'Could not cancel the active checkout session. Please try again in a moment.',
            });
          }
        }
      }

      await storage.deleteRentPaymentRequest(req.params.id, userId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting rent payment request:', error);
      res.status(500).json({ message: 'Failed to delete' });
    }
  });

  app.post('/api/rent-payments/:id/send-reminder', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const r = await storage.getRentPaymentRequest(req.params.id, userId);
      if (!r) return res.status(404).json({ message: 'Not found' });
      if (!r.tenantEmail) return res.status(400).json({ message: 'Tenant has no email on file' });

      const landlord = await storage.getUser(userId);
      const property = r.rentalPropertyId ? await storage.getRentalPropertyById(r.rentalPropertyId) : null;
      const baseUrl = getAppBaseUrl(req);
      const landlordName = landlord
        ? (landlord.firstName && landlord.lastName ? `${landlord.firstName} ${landlord.lastName}` : (landlord.businessName || landlord.email || 'Your Landlord'))
        : 'Your Landlord';

      const sent = await emailService.sendRentReminderEmail(
        { email: r.tenantEmail, tenantName: r.tenantName },
        {
          landlordName,
          amountDollars: (r.amount / 100).toFixed(2),
          dueDate: new Date(r.dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
          propertyName: property?.name || null,
          paymentLink: `${baseUrl}/pay-rent/${r.publicToken}`,
          lateFeeDollars: r.lateFeeAmount > 0 ? (r.lateFeeAmount / 100).toFixed(2) : undefined,
          gracePeriodDays: r.gracePeriodDays,
        }
      );
      if (sent) {
        await storage.updateRentPaymentRequest(r.id, { reminderSentAt: new Date(), status: r.status === 'pending' ? 'reminded' : r.status });
      }
      res.json({ sent });
    } catch (error: any) {
      console.error('Error sending reminder:', error);
      res.status(500).json({ message: error?.message || 'Failed to send reminder' });
    }
  });

  // ===== Public tenant-facing endpoints =====
  app.get('/api/rent-payments/public/:token', async (req, res) => {
    try {
      const r = await storage.getRentPaymentRequestByToken(req.params.token);
      if (!r) return res.status(404).json({ message: 'Payment request not found' });
      const landlord = await storage.getUser(r.userId);
      const property = r.rentalPropertyId ? await storage.getRentalPropertyById(r.rentalPropertyId) : null;
      res.json({
        id: r.id,
        tenantName: r.tenantName,
        amount: r.amount,
        amountPaid: r.amountPaid,
        dueDate: r.dueDate,
        description: r.description,
        status: r.status,
        lateFeeAmount: r.lateFeeAmount,
        gracePeriodDays: r.gracePeriodDays,
        landlordName: landlord
          ? (landlord.firstName && landlord.lastName ? `${landlord.firstName} ${landlord.lastName}` : (landlord.businessName || 'Your Landlord'))
          : 'Your Landlord',
        propertyName: property?.name || null,
        propertyAddress: property?.address || null,
      });
    } catch (error) {
      console.error('Error fetching public rent payment:', error);
      res.status(500).json({ message: 'Failed to load payment request' });
    }
  });

  app.post('/api/rent-payments/public/:token/checkout', async (req, res) => {
    try {
      const r = await storage.getRentPaymentRequestByToken(req.params.token);
      if (!r) return res.status(404).json({ message: 'Payment request not found' });
      if (r.status === 'paid') return res.status(400).json({ message: 'This rent has already been paid' });
      // Note: a `canceled` status is reserved in the schema for future
      // soft-cancel semantics. Today, deletion is a hard delete (the row is
      // removed via DELETE /api/rent-payments/:id), so a canceled request
      // would 404 above before reaching this check. The branch is kept as a
      // defensive guard for the future when soft-cancel is introduced.
      if (r.status === 'canceled') return res.status(400).json({ message: 'This payment request has been canceled' });
      if (r.status === 'processing') {
        return res.status(409).json({
          message: 'A payment for this rent is already in progress. ACH transfers take 3-5 business days to settle. If your previous attempt failed, please contact your landlord.',
        });
      }

      const landlord = await storage.getUser(r.userId);
      if (!landlord?.stripeConnectAccountId || !landlord.stripeConnectChargesEnabled) {
        return res.status(400).json({ message: 'Landlord cannot accept online payments yet.' });
      }

      // If we already have an open Checkout Session for this request, reuse it
      // instead of creating a duplicate (prevents accidental double-payments
      // from page reloads/retries) — but ONLY if the session amount still
      // matches the request amount. If the request amount changed (e.g. a late
      // fee was applied), expire the stale session so the tenant cannot pay
      // the old, lower amount.
      if (r.stripeCheckoutSessionId) {
        try {
          const existing = await stripe.checkout.sessions.retrieve(r.stripeCheckoutSessionId);
          if (existing.status === 'open' && existing.url) {
            if (existing.amount_total === r.amount) {
              return res.json({ url: existing.url });
            }
            // Amount drift detected — expire the stale session before creating a new one.
            try {
              await stripe.checkout.sessions.expire(r.stripeCheckoutSessionId);
              console.log(`Expired stale rent checkout session ${r.stripeCheckoutSessionId} (amount drift: ${existing.amount_total} → ${r.amount})`);
            } catch (expireErr: any) {
              console.warn(`Could not expire stale session ${r.stripeCheckoutSessionId}:`, expireErr?.message);
            }
          }
        } catch (lookupErr) {
          console.warn(`Existing checkout session ${r.stripeCheckoutSessionId} could not be retrieved; creating new one.`);
        }
      }

      const baseUrl = getAppBaseUrl(req);
      const successUrl = `${baseUrl}/pay-rent/${r.publicToken}?paid=1`;
      const cancelUrl = `${baseUrl}/pay-rent/${r.publicToken}?canceled=1`;

      const landlordDisplayName =
        [landlord.firstName, landlord.lastName].filter(Boolean).join(' ').trim() ||
        landlord.email ||
        'your landlord';
      const dueDateStr = r.dueDate ? new Date(r.dueDate).toLocaleDateString() : '';
      const productName = `Rent payment to ${landlordDisplayName}${dueDateStr ? ` — due ${dueDateStr}` : ''}`;
      // Statement descriptors must be 5-22 chars, no special chars besides space/dot/dash
      const safeDescriptorSuffix = `RENT ${landlordDisplayName}`
        .replace(/[^A-Za-z0-9 .-]/g, '')
        .slice(0, 22)
        .trim() || 'RENT';

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['us_bank_account'],
        customer_email: r.tenantEmail || undefined,
        line_items: [{
          price_data: {
            currency: 'usd',
            unit_amount: r.amount,
            product_data: {
              name: productName,
              description: r.description || (dueDateStr ? `Due ${dueDateStr}` : undefined),
            },
          },
          quantity: 1,
        }],
        // Show the LANDLORD as merchant of record on the ACH mandate so the
        // tenant sees "direct debits from [Landlord]" instead of "from LeaseShield".
        // Required: this must be a connected account on our platform.
        payment_intent_data: {
          transfer_data: { destination: landlord.stripeConnectAccountId },
          on_behalf_of: landlord.stripeConnectAccountId,
          statement_descriptor_suffix: safeDescriptorSuffix,
          metadata: {
            leaseshield_kind: 'rent_payment',
            rent_payment_request_id: r.id,
            landlord_user_id: r.userId,
          },
        },
        // Rent-specific framing shown above Stripe's NACHA mandate text.
        custom_text: {
          submit: {
            message: `By authorizing, you'll pay $${(r.amount / 100).toFixed(2)} in rent${dueDateStr ? ` for ${dueDateStr}` : ''} to ${landlordDisplayName} via bank transfer (ACH). This is a one-time payment — your bank account will not be saved or auto-charged again. ACH transfers typically settle in 3-5 business days.`,
          },
        },
        metadata: {
          leaseshield_kind: 'rent_payment',
          rent_payment_request_id: r.id,
          landlord_user_id: r.userId,
        },
        success_url: successUrl,
        cancel_url: cancelUrl,
      }, {
        // Idempotency key prevents duplicate session creation if this endpoint
        // is hit twice in quick succession (network retry, double-click).
        idempotencyKey: `rent-checkout-${r.id}-${r.amount}-${r.updatedAt instanceof Date ? r.updatedAt.getTime() : new Date(r.updatedAt as unknown as string).getTime()}`,
      });

      await storage.updateRentPaymentRequest(r.id, {
        stripeCheckoutSessionId: session.id,
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error('Error creating checkout session:', error);
      res.status(500).json({ message: error?.message || 'Failed to create checkout session' });
    }
  });
}
