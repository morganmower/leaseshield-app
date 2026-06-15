import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, CreditCard } from "lucide-react";
import { Logo } from "@/components/logo";

export default function RefundPolicy() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background sticky top-0 z-50">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <a href="/" className="flex items-center">
              <Logo variant="horizontal" size="md" />
            </a>
            <Button
              onClick={() => window.location.href = "/"}
              variant="ghost"
              size="sm"
              data-testid="button-back-home"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <CreditCard className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">
            Refund & Cancellation Policy
          </h1>
          <p className="text-muted-foreground">
            Last updated: June 15, 2026
          </p>
        </div>

        <Card>
          <CardContent className="p-6 sm:p-8 space-y-8">
            {/* Subscription Billing */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Subscription Billing</h2>
              <div className="space-y-3 text-muted-foreground leading-relaxed">
                <p>
                  Access to LeaseShield App requires a paid subscription 
                  of <strong>$10/month</strong> or <strong>$100/year</strong> (includes 2 months free). Your subscription includes:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Unlimited access to all state-specific legal templates</li>
                  <li>Compliance cards and legal updates for your state</li>
                  <li>Tenant screening resources and AI-powered decoder tools</li>
                  <li>Step-by-step tenant issue workflows</li>
                </ul>
                <p>
                  <strong>Auto-Renewal:</strong> Subscriptions automatically renew at the end of each billing
                  cycle &mdash; monthly for the $10/month plan and annually for the $100/year plan &mdash; unless
                  canceled before the renewal date.
                </p>
                <p>
                  <strong>Billing Date:</strong> You are charged on the same calendar day that you subscribed.
                  On the monthly plan that means each month (subscribe on the 15th, billed on the 15th of each
                  following month); on the annual plan that means once each year on your subscription date.
                </p>
                <p>
                  <strong>Payment Methods:</strong> We accept major credit cards and debit cards through our 
                  secure payment processor, Stripe.
                </p>
              </div>
            </section>

            {/* Cancellation Policy */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Cancellation Policy</h2>
              <div className="space-y-3 text-muted-foreground leading-relaxed">
                <p>
                  You may cancel your subscription at any time, for any reason, with no cancellation fees.
                  Canceling stops future renewals; it does not refund a payment that has already been billed
                  for the current term (see our 30-Day Money-Back Guarantee below for the one exception).
                </p>
                <p>
                  <strong>How to Cancel:</strong>
                </p>
                <ol className="list-decimal list-inside space-y-2 ml-4">
                  <li>Log in to your LeaseShield App account</li>
                  <li>Go to Settings or Billing</li>
                  <li>Click "Cancel Subscription"</li>
                  <li>Confirm your cancellation</li>
                </ol>
                <p>
                  <strong>When Cancellation Takes Effect:</strong> Your cancellation takes effect at the end of 
                  your current billing period. You will continue to have full access to LeaseShield App until 
                  that date.
                </p>
                <p>
                  For example, if you're billed on the 15th of each month and cancel on the 20th, you'll retain 
                  access until the 15th of the following month.
                </p>
                <p>
                  <strong>After Cancellation:</strong> Once your subscription ends, you will no longer be able 
                  to access templates, compliance updates, or other subscriber features. However, any templates 
                  you downloaded during your subscription remain yours to use.
                </p>
              </div>
            </section>

            {/* Refund Policy */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">30-Day Money-Back Guarantee</h2>
              <div className="space-y-3 text-muted-foreground leading-relaxed">
                <p className="font-semibold">
                  New subscribers may request a full refund within 30 days of their first payment.
                </p>
                <p>
                  If LeaseShield App isn't the right fit, email us within 30 days of your initial
                  subscription charge and we'll refund that first payment in full. The 30-day money-back
                  guarantee applies only to your first payment as a new subscriber.
                </p>
                <p>
                  <strong>After the first 30 days, all fees are non-refundable.</strong> This includes any
                  charge made more than 30 days after you first subscribed and every renewal payment
                  (monthly or annual) after your first one. Because you can cancel at any time to stop
                  future charges, we do not refund past charges or renewals once they have been billed.
                </p>
                <p>
                  <strong>Annual plans:</strong> The 30-day guarantee covers your first annual payment.
                  After 30 days the annual fee is non-refundable for the remainder of that term, though you
                  may cancel at any time to prevent the next year's renewal.
                </p>
                <p>
                  <strong>Other exceptions:</strong> Outside the 30-day guarantee, we may still consider
                  refunds on a case-by-case basis, at our sole discretion, for:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Billing errors or duplicate charges</li>
                  <li>Technical issues that prevented you from accessing the Service</li>
                </ul>
                <p>
                  To request a refund, contact us at{" "}
                  <a 
                    href="mailto:support@leaseshieldapp.com" 
                    className="text-primary hover:underline"
                  >
                    support@leaseshieldapp.com
                  </a>.
                </p>
              </div>
            </section>

            {/* Downloaded Materials */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Downloaded Materials</h2>
              <p className="text-muted-foreground leading-relaxed">
                Any templates or materials you download during your active subscription remain yours to use 
                even after cancellation or subscription expiration. You do not need to return or delete 
                downloaded materials.
              </p>
            </section>

            {/* Price Changes */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Price Changes</h2>
              <div className="space-y-3 text-muted-foreground leading-relaxed">
                <p>
                  We reserve the right to modify our subscription pricing at any time.
                </p>
                <p>
                  <strong>Notice:</strong> We will provide at least 30 days' advance notice of any price changes 
                  via email and through a notice on the Service.
                </p>
                <p>
                  <strong>Existing Subscribers:</strong> If you have an active subscription when a price change 
                  is announced, the new pricing will not affect you until your next renewal after the notice period.
                </p>
                <p>
                  You may cancel your subscription before the new pricing takes effect if you do not wish to 
                  continue at the new rate.
                </p>
              </div>
            </section>

            {/* Payment Issues */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Failed Payments</h2>
              <div className="space-y-3 text-muted-foreground leading-relaxed">
                <p>
                  If your payment method fails at renewal time:
                </p>
                <ol className="list-decimal list-inside space-y-2 ml-4">
                  <li>We will notify you via email</li>
                  <li>We will attempt to process payment again over the next 7 days</li>
                  <li>Your access may be temporarily restricted if payment continues to fail</li>
                  <li>If payment cannot be collected, your subscription will be canceled</li>
                </ol>
                <p>
                  <strong>Updating Payment Information:</strong> You can update your payment method at any time 
                  in your account settings to avoid service interruption.
                </p>
              </div>
            </section>

            {/* Contact */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Questions About Billing?</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                If you have questions about billing, cancellation, or refunds, please contact us:
              </p>
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-foreground font-medium">support@leaseshieldapp.com</p>
              </div>
            </section>
          </CardContent>
        </Card>

        <div className="mt-8 text-center">
          <Button
            onClick={() => window.location.href = "/"}
            data-testid="button-back-home-bottom"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
}
