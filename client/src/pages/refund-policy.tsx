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
            Last updated: November 19, 2024
          </p>
        </div>

        <Card>
          <CardContent className="p-6 sm:p-8 space-y-8">
            {/* Free Trial */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">7-Day Free Trial</h2>
              <div className="space-y-3 text-muted-foreground leading-relaxed">
                <p>
                  New users receive a <strong>7-day free trial</strong> with full access to all LeaseShield App 
                  features, including:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Unlimited access to all state-specific legal templates</li>
                  <li>Compliance cards and legal updates for your state</li>
                  <li>Tenant screening resources and checklists</li>
                  <li>Step-by-step tenant issue workflows</li>
                </ul>
                <p>
                  <strong>No payment required</strong> during the trial period. You will not be charged unless 
                  you subscribe after the trial ends.
                </p>
                <p>
                  Your trial begins when you create your account and ends 7 days later. A countdown timer on 
                  your dashboard shows your remaining trial days.
                </p>
              </div>
            </section>

            {/* Subscription Billing */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Subscription Billing</h2>
              <div className="space-y-3 text-muted-foreground leading-relaxed">
                <p>
                  After your free trial ends, continued access to LeaseShield App requires a paid subscription 
                  of <strong>$10/month</strong>.
                </p>
                <p>
                  <strong>Auto-Renewal:</strong> Subscriptions automatically renew on a monthly basis unless 
                  canceled before the renewal date.
                </p>
                <p>
                  <strong>Billing Date:</strong> You will be charged on the same day each month that you 
                  subscribed. For example, if you subscribe on the 15th, you'll be billed on the 15th of each 
                  subsequent month.
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
                  You may cancel your subscription at any time, for any reason. There are no long-term 
                  commitments or cancellation fees.
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
              <h2 className="text-xl font-semibold text-foreground mb-3">Refund Policy</h2>
              <div className="space-y-3 text-muted-foreground leading-relaxed">
                <p className="font-semibold">
                  All subscription fees are non-refundable.
                </p>
                <p>
                  We provide a <strong>7-day free trial</strong> specifically to allow you to fully evaluate 
                  LeaseShield App before committing to a paid subscription. This trial gives you complete access 
                  to all features without any financial obligation.
                </p>
                <p>
                  Because of this generous trial period, we do not offer refunds for subscription fees once they 
                  have been charged.
                </p>
                <p>
                  <strong>Exceptions:</strong> We may consider refunds on a case-by-case basis for:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Billing errors or duplicate charges</li>
                  <li>Technical issues that prevented you from accessing the Service</li>
                  <li>Extraordinary circumstances at our sole discretion</li>
                </ul>
                <p>
                  To request a refund under exceptional circumstances, contact us at{" "}
                  <a 
                    href="mailto:support@leaseshieldapp.com" 
                    className="text-primary hover:underline"
                  >
                    support@leaseshieldapp.com
                  </a>{" "}
                  within 7 days of the charge.
                </p>
              </div>
            </section>

            {/* Downloaded Materials */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Downloaded Materials</h2>
              <p className="text-muted-foreground leading-relaxed">
                Any templates or materials you download during your active subscription (including during your 
                free trial) remain yours to use even after cancellation or subscription expiration. You do not 
                need to return or delete downloaded materials.
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
