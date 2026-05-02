import type { Express } from "express";
import { randomBytes } from "crypto";
import { storage } from "../storage";
import { isAuthenticated } from "../jwtAuth";
import { emailService } from "../emailService";
import { getAppBaseUrl } from "../utils/appUrl";
import { stripe, getUserId } from "./_shared";

// NACHA-compliant mandate disclosure template. Snapshotted onto each mandate
// at acceptance time so wording changes never alter prior authorizations.
function buildMandateText(args: {
  landlordName: string;
  amountDollars: string;
  dayOfMonth: number;
  startDate: string;
  propertyDescriptor: string;
}): string {
  const ord = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };
  return [
    `By clicking "Authorize Auto-Pay", I authorize ${args.landlordName} (via LeaseShield, acting as Stripe's third-party sender) to electronically debit my checking or savings account on or about the ${ord(args.dayOfMonth)} of each month, beginning ${args.startDate}, in the amount of $${args.amountDollars}, for rent at ${args.propertyDescriptor}.`,
    `This authorization will remain in effect until I cancel it. I may revoke this authorization at any time by clicking "Stop Auto-Pay" on this page, by emailing my landlord, or by contacting my bank. I will provide my landlord with at least 3 business days' notice before the next scheduled debit so they have a reasonable opportunity to act.`,
    `I acknowledge that NACHA rules apply to ACH transactions, that I have the right to receive notice of variable amounts at least 10 days before each debit, and that I have the right to dispute unauthorized debits with my bank within 60 days.`,
  ].join('\n\n');
}

function generateToken(): string {
  return randomBytes(32).toString('hex');
}

// Compute next month's same day-of-month as a YYYY-MM-DD string. Day-of-month
// is constrained to 1-28 in the schema so we never have to worry about
// February or 31-day rollovers.
function addOneMonth(dateStr: string, dayOfMonth: number): string {
  const [y, m] = dateStr.split('-').map(Number);
  const nextMonth = m === 12 ? 1 : m + 1;
  const nextYear = m === 12 ? y + 1 : y;
  const dom = String(Math.min(28, Math.max(1, dayOfMonth))).padStart(2, '0');
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}-${dom}`;
}

export async function registerRentSubscriptionsRoutes(app: Express) {
  // ===== Landlord-facing endpoints =====

  app.get('/api/rent-subscriptions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const list = await storage.getRentSubscriptions(userId);
      res.json(list);
    } catch (error) {
      console.error('Error fetching rent subscriptions:', error);
      res.status(500).json({ message: 'Failed to fetch rent subscriptions' });
    }
  });

  app.get('/api/rent-subscriptions/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const sub = await storage.getRentSubscription(req.params.id, userId);
      if (!sub) return res.status(404).json({ message: 'Subscription not found' });
      const baseUrl = getAppBaseUrl(req);
      res.json({ ...sub, authorizationLink: `${baseUrl}/auto-pay/${sub.publicToken}` });
    } catch (error) {
      console.error('Error fetching rent subscription:', error);
      res.status(500).json({ message: 'Failed to fetch rent subscription' });
    }
  });

  app.post('/api/rent-subscriptions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: 'User not found' });
      if (!user.stripeConnectChargesEnabled || !user.stripeConnectAccountId) {
        return res.status(400).json({
          message: 'Connect your Stripe account before creating recurring auto-pay subscriptions.',
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
      if (!body.tenantName || !body.tenantEmail || !body.startDate) {
        return res.status(400).json({ message: 'tenantName, tenantEmail and startDate are required' });
      }
      const dayOfMonth = Math.min(28, Math.max(1, parseInt(body.dayOfMonth ?? '1', 10) || 1));
      const gracePeriodDays = Math.max(0, parseInt(body.gracePeriodDays ?? '5', 10) || 0);

      // Validate property ownership if provided
      let rentalPropertyId: string | null = null;
      if (body.rentalPropertyId) {
        const p = await storage.getRentalPropertyById(body.rentalPropertyId);
        if (!p || p.userId !== userId) {
          return res.status(400).json({ message: 'Invalid property' });
        }
        rentalPropertyId = p.id;
      }

      const created = await storage.createRentSubscription({
        userId,
        rentalPropertyId,
        tenantName: String(body.tenantName).trim(),
        tenantEmail: String(body.tenantEmail).trim().toLowerCase(),
        amount,
        dayOfMonth,
        startDate: body.startDate,
        endDate: body.endDate || null,
        lateFeeAmount,
        gracePeriodDays,
        description: body.description ? String(body.description).trim() : null,
        publicToken: generateToken(),
        status: 'pending_authorization',
      });

      const baseUrl = getAppBaseUrl(req);
      const authorizationLink = `${baseUrl}/auto-pay/${created.publicToken}`;

      // Best-effort: email the tenant the authorization link
      try {
        const property = rentalPropertyId
          ? await storage.getRentalPropertyById(rentalPropertyId)
          : null;
        const landlordName =
          (user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : null) ||
          user.businessName || user.email || 'your landlord';
        await emailService.sendRentAutoPayAuthorizationEmail(
          { email: created.tenantEmail, tenantName: created.tenantName },
          {
            landlordName,
            amountDollars: (amount / 100).toFixed(2),
            dayOfMonth,
            startDate: body.startDate,
            propertyName: property?.name || null,
            authorizationLink,
          },
        );
      } catch (emailErr: any) {
        console.error('Failed to send auto-pay authorization email:', emailErr?.message);
      }

      res.status(201).json({ ...created, authorizationLink });
    } catch (error: any) {
      console.error('Error creating rent subscription:', error);
      // Catch the partial unique index violation
      if (error?.code === '23505') {
        return res.status(409).json({
          message: 'There is already an active auto-pay subscription for this tenant on this property.',
        });
      }
      res.status(500).json({ message: error?.message || 'Failed to create rent subscription' });
    }
  });

  // Landlord-side update: pause / resume / cancel; or edit amount/lateFee/dayOfMonth
  // (only allowed while pending_authorization or paused — never on active to
  // avoid changing the authorized amount without a fresh mandate).
  app.patch('/api/rent-subscriptions/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const sub = await storage.getRentSubscription(req.params.id, userId);
      if (!sub) return res.status(404).json({ message: 'Subscription not found' });

      const body = req.body || {};
      const updates: any = {};

      // Status transitions
      if (typeof body.status === 'string') {
        const next = body.status;
        const allowed = new Set(['paused', 'active', 'canceled']);
        if (!allowed.has(next)) {
          return res.status(400).json({ message: 'Invalid status transition' });
        }
        if (next === 'paused' && sub.status === 'active') {
          updates.status = 'paused';
        } else if (next === 'active' && sub.status === 'paused') {
          updates.status = 'active';
        } else if (next === 'canceled') {
          updates.status = 'canceled';
          updates.revokedAt = new Date();
          updates.revokedReason = body.reason || 'Canceled by landlord';
          // Detach PM so Stripe stops accepting future debits on this mandate
          if (sub.stripePaymentMethodId) {
            try {
              await stripe.paymentMethods.detach(sub.stripePaymentMethodId);
            } catch (detachErr: any) {
              console.warn(`Could not detach PM ${sub.stripePaymentMethodId}:`, detachErr?.message);
            }
          }
        } else {
          return res.status(400).json({
            message: `Cannot transition from ${sub.status} to ${next}`,
          });
        }
      }

      // Amount / fee / day-of-month edits — only allowed pre-authorization or while paused
      const editFields: string[] = ['amountDollars', 'lateFeeDollars', 'dayOfMonth', 'gracePeriodDays', 'endDate', 'description'];
      const wantsEdit = editFields.some((k) => body[k] !== undefined);
      if (wantsEdit) {
        if (sub.status === 'active') {
          return res.status(400).json({
            message: 'Cannot edit an active subscription. Pause it first, then edit, then resume — the tenant will need to re-authorize if the amount changes.',
          });
        }
        if (body.amountDollars !== undefined) {
          const amt = Math.round(parseFloat(body.amountDollars) * 100);
          if (!amt || amt < 100) return res.status(400).json({ message: 'Amount must be at least $1.00' });
          updates.amount = amt;
        }
        if (body.lateFeeDollars !== undefined) {
          updates.lateFeeAmount = Math.max(0, Math.round(parseFloat(body.lateFeeDollars) * 100));
        }
        if (body.dayOfMonth !== undefined) {
          updates.dayOfMonth = Math.min(28, Math.max(1, parseInt(body.dayOfMonth, 10) || 1));
        }
        if (body.gracePeriodDays !== undefined) {
          updates.gracePeriodDays = Math.max(0, parseInt(body.gracePeriodDays, 10) || 0);
        }
        if (body.endDate !== undefined) {
          updates.endDate = body.endDate || null;
        }
        if (body.description !== undefined) {
          updates.description = body.description ? String(body.description).trim() : null;
        }
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: 'No valid updates provided' });
      }

      const updated = await storage.updateRentSubscription(sub.id, updates);
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating rent subscription:', error);
      res.status(500).json({ message: error?.message || 'Failed to update rent subscription' });
    }
  });

  // Landlord deletes a subscription that was never authorized (cleanup).
  // For active/revoked subs we keep the record for audit and use PATCH ... canceled instead.
  app.delete('/api/rent-subscriptions/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const sub = await storage.getRentSubscription(req.params.id, userId);
      if (!sub) return res.status(404).json({ message: 'Subscription not found' });
      if (sub.status === 'active') {
        return res.status(400).json({
          message: 'Cancel an active subscription instead of deleting it (so the audit trail is preserved).',
        });
      }
      // Detach PM if any (defensive)
      if (sub.stripePaymentMethodId) {
        try { await stripe.paymentMethods.detach(sub.stripePaymentMethodId); } catch {}
      }
      const ok = await storage.deleteRentSubscription(sub.id, userId);
      if (!ok) return res.status(404).json({ message: 'Subscription not found' });
      res.status(204).end();
    } catch (error: any) {
      console.error('Error deleting rent subscription:', error);
      res.status(500).json({ message: error?.message || 'Failed to delete rent subscription' });
    }
  });

  // Landlord re-sends the authorization email to the tenant.
  app.post('/api/rent-subscriptions/:id/resend-authorization', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const sub = await storage.getRentSubscription(req.params.id, userId);
      if (!sub) return res.status(404).json({ message: 'Subscription not found' });
      if (sub.status !== 'pending_authorization') {
        return res.status(400).json({ message: 'This subscription has already been authorized.' });
      }
      const user = await storage.getUser(userId);
      const property = sub.rentalPropertyId
        ? await storage.getRentalPropertyById(sub.rentalPropertyId)
        : null;
      const baseUrl = getAppBaseUrl(req);
      const landlordName =
        (user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : null) ||
        user?.businessName || user?.email || 'your landlord';
      await emailService.sendRentAutoPayAuthorizationEmail(
        { email: sub.tenantEmail, tenantName: sub.tenantName },
        {
          landlordName,
          amountDollars: (sub.amount / 100).toFixed(2),
          dayOfMonth: sub.dayOfMonth,
          startDate: sub.startDate,
          propertyName: property?.name || null,
          authorizationLink: `${baseUrl}/auto-pay/${sub.publicToken}`,
        },
      );
      res.json({ message: 'Authorization email sent.' });
    } catch (error: any) {
      console.error('Error resending authorization email:', error);
      res.status(500).json({ message: error?.message || 'Failed to send authorization email' });
    }
  });

  // ===== Public tenant-facing endpoints =====

  app.get('/api/rent-subscriptions/public/:token', async (req, res) => {
    try {
      const sub = await storage.getRentSubscriptionByToken(req.params.token);
      if (!sub) return res.status(404).json({ message: 'Auto-pay link not found' });
      const landlord = await storage.getUser(sub.userId);
      const property = sub.rentalPropertyId
        ? await storage.getRentalPropertyById(sub.rentalPropertyId)
        : null;
      const landlordName = landlord
        ? (landlord.firstName && landlord.lastName
            ? `${landlord.firstName} ${landlord.lastName}`
            : (landlord.businessName || 'Your Landlord'))
        : 'Your Landlord';
      const propertyDescriptor = property
        ? (property.address ? `${property.name} (${property.address})` : property.name)
        : 'your rental';
      const mandateText = buildMandateText({
        landlordName,
        amountDollars: (sub.amount / 100).toFixed(2),
        dayOfMonth: sub.dayOfMonth,
        startDate: sub.startDate,
        propertyDescriptor,
      });
      res.json({
        id: sub.id,
        tenantName: sub.tenantName,
        tenantEmail: sub.tenantEmail,
        amount: sub.amount,
        dayOfMonth: sub.dayOfMonth,
        startDate: sub.startDate,
        endDate: sub.endDate,
        nextScheduledDate: sub.nextScheduledDate,
        lateFeeAmount: sub.lateFeeAmount,
        gracePeriodDays: sub.gracePeriodDays,
        status: sub.status,
        bankAccountLast4: sub.bankAccountLast4,
        bankAccountBankName: sub.bankAccountBankName,
        mandateAcceptedAt: sub.mandateAcceptedAt,
        landlordName,
        propertyName: property?.name || null,
        propertyAddress: property?.address || null,
        proposedMandateText: mandateText,
      });
    } catch (error) {
      console.error('Error fetching public auto-pay:', error);
      res.status(500).json({ message: 'Failed to load auto-pay details' });
    }
  });

  // Tenant initiates the SetupIntent flow. We use Stripe Checkout in `mode: 'setup'`
  // because it's the same NACHA-compliant hosted UX as our one-time payment flow,
  // and Stripe handles the PaymentMethod attachment + mandate capture for us.
  app.post('/api/rent-subscriptions/public/:token/setup', async (req, res) => {
    try {
      const sub = await storage.getRentSubscriptionByToken(req.params.token);
      if (!sub) return res.status(404).json({ message: 'Auto-pay link not found' });
      if (sub.status === 'active') {
        return res.status(400).json({ message: 'Auto-pay is already authorized.' });
      }
      if (sub.status === 'canceled' || sub.status === 'completed') {
        return res.status(400).json({ message: 'This auto-pay subscription is no longer active.' });
      }

      const landlord = await storage.getUser(sub.userId);
      if (!landlord?.stripeConnectAccountId || !landlord.stripeConnectChargesEnabled) {
        return res.status(400).json({
          message: 'Landlord cannot accept auto-pay yet. They need to finish connecting their bank account.',
        });
      }

      // Create or reuse a platform-side Customer scoped to this subscription.
      let customerId = sub.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: sub.tenantEmail,
          name: sub.tenantName,
          metadata: {
            leaseshield_kind: 'rent_auto_pay',
            rent_subscription_id: sub.id,
            landlord_user_id: sub.userId,
          },
        });
        customerId = customer.id;
        await storage.updateRentSubscription(sub.id, { stripeCustomerId: customerId });
      }

      // Reuse open setup session if one already exists
      if (sub.stripeSetupCheckoutSessionId) {
        try {
          const existing = await stripe.checkout.sessions.retrieve(sub.stripeSetupCheckoutSessionId);
          if (existing.status === 'open' && existing.url) {
            return res.json({ url: existing.url });
          }
        } catch {}
      }

      const baseUrl = getAppBaseUrl(req);
      const landlordDisplayName =
        [landlord.firstName, landlord.lastName].filter(Boolean).join(' ').trim() ||
        landlord.email || 'your landlord';

      const session = await stripe.checkout.sessions.create({
        mode: 'setup',
        payment_method_types: ['us_bank_account'],
        customer: customerId,
        currency: 'usd',
        // The hosted Stripe page captures the NACHA mandate as part of ACH
        // PaymentMethod setup. We surface our own mandate disclosure in the
        // tenant portal as well (double coverage per arch report §3).
        setup_intent_data: {
          metadata: {
            leaseshield_kind: 'rent_auto_pay_setup',
            rent_subscription_id: sub.id,
            landlord_user_id: sub.userId,
          },
        },
        custom_text: {
          submit: {
            message: `By saving your bank account, you authorize automatic monthly rent debits of $${(sub.amount / 100).toFixed(2)} to ${landlordDisplayName} starting ${sub.startDate}. You can cancel anytime from the auto-pay page.`,
          },
        },
        metadata: {
          leaseshield_kind: 'rent_auto_pay_setup',
          rent_subscription_id: sub.id,
          landlord_user_id: sub.userId,
        },
        success_url: `${baseUrl}/auto-pay/${sub.publicToken}?authorized=1`,
        cancel_url: `${baseUrl}/auto-pay/${sub.publicToken}?canceled=1`,
      });

      await storage.updateRentSubscription(sub.id, {
        stripeSetupCheckoutSessionId: session.id,
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error('Error creating setup session:', error);
      res.status(500).json({ message: error?.message || 'Failed to start authorization' });
    }
  });

  // Tenant self-cancel — NACHA right-to-revoke.
  app.post('/api/rent-subscriptions/public/:token/cancel', async (req, res) => {
    try {
      const sub = await storage.getRentSubscriptionByToken(req.params.token);
      if (!sub) return res.status(404).json({ message: 'Auto-pay link not found' });
      if (sub.status !== 'active' && sub.status !== 'paused') {
        return res.status(400).json({ message: 'This subscription is not active.' });
      }

      // Detach the saved PaymentMethod so Stripe rejects any future PaymentIntents.
      if (sub.stripePaymentMethodId) {
        try {
          await stripe.paymentMethods.detach(sub.stripePaymentMethodId);
        } catch (detachErr: any) {
          console.warn(`Could not detach PM ${sub.stripePaymentMethodId}:`, detachErr?.message);
        }
      }

      await storage.updateRentSubscription(sub.id, {
        status: 'revoked_by_tenant',
        revokedAt: new Date(),
        revokedReason: 'Tenant clicked Stop Auto-Pay',
        nextScheduledDate: null,
      });

      // Best-effort: notify the landlord
      try {
        const landlord = await storage.getUser(sub.userId);
        if (landlord?.email) {
          await emailService.sendRentAutoPayRevokedEmail(
            { email: landlord.email, firstName: landlord.firstName || undefined },
            {
              tenantName: sub.tenantName,
              tenantEmail: sub.tenantEmail,
              amountDollars: (sub.amount / 100).toFixed(2),
            },
          );
        }
      } catch (emailErr: any) {
        console.error('Failed to notify landlord of revocation:', emailErr?.message);
      }

      res.json({ message: 'Auto-pay canceled. Your bank will not be debited again under this authorization.' });
    } catch (error: any) {
      console.error('Error canceling subscription:', error);
      res.status(500).json({ message: error?.message || 'Failed to cancel' });
    }
  });
}
