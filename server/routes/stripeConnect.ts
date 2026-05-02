import type { Express } from "express";
import Stripe from "stripe";
import { storage } from "../storage";
import { isAuthenticated } from "../jwtAuth";
import { getAppBaseUrl } from "../utils/appUrl";
import { stripe, getUserId } from "./_shared";

export async function registerStripeConnectRoutes(app: Express) {

  app.get('/api/stripe-connect/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: 'User not found' });

      let acctInfo: {
        accountId: string | null;
        chargesEnabled: boolean;
        payoutsEnabled: boolean;
        detailsSubmitted: boolean;
      } = {
        accountId: user.stripeConnectAccountId || null,
        chargesEnabled: !!user.stripeConnectChargesEnabled,
        payoutsEnabled: !!user.stripeConnectPayoutsEnabled,
        detailsSubmitted: !!user.stripeConnectDetailsSubmitted,
      };

      // If we have an account, refresh state from Stripe
      if (user.stripeConnectAccountId) {
        try {
          const acct = await stripe.accounts.retrieve(user.stripeConnectAccountId);
          acctInfo = {
            accountId: acct.id,
            chargesEnabled: !!acct.charges_enabled,
            payoutsEnabled: !!acct.payouts_enabled,
            detailsSubmitted: !!acct.details_submitted,
          };
          // Persist any drift (map response keys → DB column keys)
          if (
            acctInfo.chargesEnabled !== user.stripeConnectChargesEnabled ||
            acctInfo.payoutsEnabled !== user.stripeConnectPayoutsEnabled ||
            acctInfo.detailsSubmitted !== user.stripeConnectDetailsSubmitted
          ) {
            await storage.updateUserStripeConnect(userId, {
              stripeConnectChargesEnabled: acctInfo.chargesEnabled,
              stripeConnectPayoutsEnabled: acctInfo.payoutsEnabled,
              stripeConnectDetailsSubmitted: acctInfo.detailsSubmitted,
            });
          }
        } catch (e: any) {
          console.error('Failed to retrieve connected account:', e?.message);
        }
      }

      res.json(acctInfo);
    } catch (error: any) {
      console.error('Stripe Connect status error:', error);
      res.status(500).json({ message: error?.message || 'Failed to load Connect status' });
    }
  });

  app.post('/api/stripe-connect/onboard', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: 'User not found' });

      let accountId = user.stripeConnectAccountId;
      if (!accountId) {
        const acct = await stripe.accounts.create({
          type: 'express',
          email: user.email || undefined,
          capabilities: {
            transfers: { requested: true },
            us_bank_account_ach_payments: { requested: true },
          },
          business_type: 'individual',
          metadata: { leaseshield_user_id: userId },
        });
        accountId = acct.id;
        await storage.updateUserStripeConnect(userId, { stripeConnectAccountId: accountId });
      }

      const baseUrl = getAppBaseUrl(req);
      const link = await stripe.accountLinks.create({
        account: accountId!,
        refresh_url: `${baseUrl}/rent-ledger?connect=refresh`,
        return_url: `${baseUrl}/rent-ledger?connect=return`,
        type: 'account_onboarding',
      });
      res.json({ url: link.url });
    } catch (error: any) {
      console.error('Stripe Connect onboard error:', error);
      const msg = error?.message || 'Failed to start Stripe Connect onboarding';
      res.status(500).json({ message: msg });
    }
  });

  app.post('/api/stripe-connect/login-link', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);
      if (!user?.stripeConnectAccountId) {
        return res.status(400).json({ message: 'No connected account yet' });
      }
      const link = await stripe.accounts.createLoginLink(user.stripeConnectAccountId);
      res.json({ url: link.url });
    } catch (error: any) {
      console.error('Stripe Connect login link error:', error);
      res.status(500).json({ message: error?.message || 'Failed to create login link' });
    }
  });
}
