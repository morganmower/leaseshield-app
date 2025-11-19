import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Shield } from "lucide-react";
import { Logo } from "@/components/logo";

export default function Terms() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background sticky top-0 z-50">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <a href="/" className="flex items-center gap-2">
              <Logo className="h-8 w-8" />
              <span className="font-display text-lg font-semibold">LeaseShield App</span>
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
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">
            Terms of Service
          </h1>
          <p className="text-muted-foreground">
            Last updated: November 19, 2024
          </p>
        </div>

        <Card>
          <CardContent className="p-6 sm:p-8 space-y-8">
            {/* Critical Disclaimer */}
            <section className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-foreground mb-3 flex items-center gap-2">
                <Shield className="h-5 w-5 text-amber-600" />
                Important Legal Notice
              </h2>
              <div className="space-y-3 text-sm text-foreground">
                <p className="font-semibold">
                  LeaseShield App is not a law firm and does not provide legal advice.
                </p>
                <p>
                  The information, templates, and guidance provided on this platform are for informational 
                  and educational purposes only and should not be construed as legal advice. Use of this 
                  website and any templates does not create an attorney-client relationship between you 
                  and LeaseShield App.
                </p>
                <p>
                  For specific legal guidance regarding your situation, you should consult a licensed 
                  attorney in your jurisdiction. Legal requirements vary significantly by state and 
                  change frequently.
                </p>
              </div>
            </section>

            {/* Agreement to Terms */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">1. Agreement to Terms</h2>
              <p className="text-muted-foreground leading-relaxed">
                By accessing or using LeaseShield App ("Service"), you agree to be bound by these Terms of 
                Service ("Terms"). If you disagree with any part of these terms, you may not access the Service.
              </p>
            </section>

            {/* Service Description */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">2. Service Description</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                LeaseShield App provides landlords with:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>State-specific legal document templates</li>
                <li>Educational compliance guidance and legal updates</li>
                <li>Tenant screening resources and checklists</li>
                <li>Step-by-step workflows for common landlord issues</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-3">
                All materials are provided for informational purposes only. Templates are general forms 
                that may require customization for your specific situation.
              </p>
            </section>

            {/* Subscription Terms */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">3. Subscription Terms</h2>
              <div className="space-y-3 text-muted-foreground leading-relaxed">
                <p>
                  <strong>Free Trial:</strong> New users receive a 7-day free trial with full access to all features.
                </p>
                <p>
                  <strong>Paid Subscription:</strong> After the trial period, continued access requires a paid 
                  subscription at $15/month (pricing subject to change with notice).
                </p>
                <p>
                  <strong>Auto-Renewal:</strong> Subscriptions automatically renew monthly unless canceled before 
                  the renewal date.
                </p>
                <p>
                  <strong>Cancellation:</strong> You may cancel your subscription at any time through your account 
                  settings. Cancellation takes effect at the end of your current billing period.
                </p>
                <p>
                  <strong>Payment:</strong> By providing payment information, you authorize us to charge the 
                  subscription fee to your chosen payment method.
                </p>
              </div>
            </section>

            {/* Third-Party Referrals */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">4. Third-Party Referrals and Affiliations</h2>
              <div className="space-y-3 text-muted-foreground leading-relaxed">
                <p>
                  <strong>Tenant Screening Referrals:</strong> LeaseShield App may provide referrals to Western Verify LLC 
                  (www.westernverify.com) for tenant screening services. Western Verify LLC is a separate business entity 
                  owned and operated by the same ownership as LeaseShield App.
                </p>
                <p>
                  By using LeaseShield App and clicking on referral links to Western Verify LLC, you acknowledge and 
                  agree that:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Western Verify LLC is a separate legal entity providing tenant screening services</li>
                  <li>Any services purchased from Western Verify LLC are subject to their own terms and conditions</li>
                  <li>LeaseShield App may receive compensation or benefit from referrals to Western Verify LLC</li>
                  <li>You are not obligated to use Western Verify LLC and may choose any screening service provider</li>
                  <li>LeaseShield App is not responsible for the services, pricing, or performance of Western Verify LLC</li>
                </ul>
                <p>
                  This disclosure is provided for transparency. All referrals to Western Verify LLC are clearly identified 
                  within the platform.
                </p>
              </div>
            </section>

            {/* License and Restrictions */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">5. License and Restrictions</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                We grant you a limited, non-exclusive, non-transferable license to:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4 mb-3">
                <li>Access and use the Service for your personal or business purposes</li>
                <li>Download and customize templates for your own rental business</li>
                <li>Access educational content and compliance updates</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mb-3">
                You may NOT:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Resell, redistribute, or sublicense any templates or materials</li>
                <li>Share your account credentials with others</li>
                <li>Use the Service to provide services to third parties</li>
                <li>Reverse engineer, decompile, or attempt to extract source code</li>
                <li>Remove or modify any copyright, trademark, or proprietary notices</li>
                <li>Use the Service for any illegal or unauthorized purpose</li>
              </ul>
            </section>

            {/* User Responsibilities */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">6. User Responsibilities</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                You are responsible for:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Customizing all templates to your specific needs and situation</li>
                <li>Verifying that all information is current and applicable to your jurisdiction</li>
                <li>Consulting with a licensed attorney before taking legal action</li>
                <li>Ensuring compliance with all applicable federal, state, and local laws</li>
                <li>Maintaining the confidentiality of your account credentials</li>
                <li>All activity that occurs under your account</li>
              </ul>
            </section>

            {/* Disclaimers and Warranties */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">7. Disclaimers and Warranties</h2>
              <div className="space-y-3 text-muted-foreground leading-relaxed">
                <p className="font-semibold">
                  THE SERVICE AND ALL MATERIALS ARE PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND.
                </p>
                <p>
                  We disclaim all warranties, express or implied, including but not limited to:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Warranties of merchantability and fitness for a particular purpose</li>
                  <li>Warranties that templates are suitable for your specific situation</li>
                  <li>Warranties of accuracy, completeness, or timeliness of information</li>
                  <li>Warranties that the Service will be uninterrupted or error-free</li>
                </ul>
                <p>
                  <strong>State-Specific Limitations:</strong> Laws change frequently. While we strive to keep 
                  templates and guidance current, we make no guarantee that information is up-to-date for your 
                  state or jurisdiction.
                </p>
                <p>
                  <strong>No Legal Advice:</strong> Nothing on this platform constitutes legal advice. All 
                  information is general in nature and may not apply to your specific circumstances.
                </p>
              </div>
            </section>

            {/* Limitation of Liability */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">8. Limitation of Liability</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                To the maximum extent permitted by law, LeaseShield App and its officers, directors, employees, 
                and agents shall not be liable for:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Any indirect, incidental, special, consequential, or punitive damages</li>
                <li>Loss of profits, revenue, data, or business opportunities</li>
                <li>Damages arising from your use or inability to use the Service</li>
                <li>Damages arising from reliance on any templates or information provided</li>
                <li>Legal disputes, evictions, or tenant issues</li>
                <li>Any errors, omissions, or inaccuracies in templates or guidance</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-3">
                Our total liability for any claims arising from your use of the Service shall not exceed 
                the amount you paid us in the 12 months preceding the claim.
              </p>
            </section>

            {/* Intellectual Property */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">9. Intellectual Property</h2>
              <p className="text-muted-foreground leading-relaxed">
                All content, templates, logos, trademarks, and materials on LeaseShield App are owned by or 
                licensed to us and are protected by copyright, trademark, and other intellectual property laws. 
                You may not copy, modify, distribute, or create derivative works without our express written permission.
              </p>
            </section>

            {/* Account Termination */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">10. Account Termination</h2>
              <p className="text-muted-foreground leading-relaxed">
                We reserve the right to suspend or terminate your account at any time for violations of these 
                Terms, fraudulent activity, or any reason at our sole discretion. You may terminate your account 
                at any time through your account settings. Upon termination, your right to access the Service 
                ceases immediately.
              </p>
            </section>

            {/* Modifications to Terms */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">11. Modifications to Terms</h2>
              <p className="text-muted-foreground leading-relaxed">
                We reserve the right to modify these Terms at any time. We will notify you of material changes 
                by email or through a notice on the Service. Your continued use of the Service after changes 
                become effective constitutes acceptance of the modified Terms.
              </p>
            </section>

            {/* Governing Law */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">12. Governing Law</h2>
              <p className="text-muted-foreground leading-relaxed">
                These Terms shall be governed by and construed in accordance with the laws of the State of Utah, 
                without regard to its conflict of law provisions. Any disputes shall be resolved in the courts 
                located in Utah.
              </p>
            </section>

            {/* Contact */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">13. Contact Information</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                If you have questions about these Terms, please contact us:
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
