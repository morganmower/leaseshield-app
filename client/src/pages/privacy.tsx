import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, ArrowLeft } from "lucide-react";
import { Logo } from "@/components/logo";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity" data-testid="link-home">
            <Logo iconSize={24} />
            <span className="font-display text-base sm:text-xl font-semibold text-foreground">
              LeaseShield Pro
            </span>
          </a>
          <Button
            variant="ghost"
            onClick={() => window.location.href = "/"}
            data-testid="button-back-home"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </div>
      </header>

      {/* Privacy Policy Content */}
      <div className="container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-foreground mb-4">
            Privacy Policy
          </h1>
          <p className="text-muted-foreground">
            Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-8">
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Introduction</h2>
              <p className="text-muted-foreground leading-relaxed">
                LeaseShield Pro ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy
                explains how we collect, use, disclose, and safeguard your information when you use our service.
                Please read this privacy policy carefully. If you do not agree with the terms of this privacy policy,
                please do not access the service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Information We Collect</h2>
              <div className="space-y-4 text-muted-foreground leading-relaxed">
                <div>
                  <h3 className="font-medium text-foreground mb-2">Account Information</h3>
                  <p>
                    When you create an account, we collect your email address, name, and profile information.
                    We use this information to create and manage your account, communicate with you, and provide
                    our services.
                  </p>
                </div>
                <div>
                  <h3 className="font-medium text-foreground mb-2">Payment Information</h3>
                  <p>
                    Payment processing is handled securely by Stripe, our payment processor. We do not store your
                    full credit card information on our servers. Stripe collects and processes payment data in
                    accordance with their privacy policy and PCI-DSS compliance standards.
                  </p>
                </div>
                <div>
                  <h3 className="font-medium text-foreground mb-2">Usage Data</h3>
                  <p>
                    We collect information about how you interact with our service, including which templates you
                    download, compliance cards you view, and features you use. This helps us improve our service
                    and provide you with relevant updates and recommendations.
                  </p>
                </div>
                <div>
                  <h3 className="font-medium text-foreground mb-2">State Preferences</h3>
                  <p>
                    We store your selected state(s) to provide you with relevant state-specific legal templates,
                    compliance updates, and resources tailored to your jurisdiction.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">How We Use Your Information</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                We use the information we collect to:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>Provide, operate, and maintain our service</li>
                <li>Process your subscription and payments</li>
                <li>Send you legal compliance updates for your selected state(s)</li>
                <li>Respond to your inquiries and provide customer support</li>
                <li>Send you administrative information, such as updates to our terms and policies</li>
                <li>Improve and personalize your experience with our service</li>
                <li>Monitor usage patterns and analyze trends to enhance our service</li>
                <li>Detect, prevent, and address technical issues or fraudulent activity</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Information Sharing and Disclosure</h2>
              <div className="space-y-4 text-muted-foreground leading-relaxed">
                <p>
                  We do not sell, trade, or rent your personal information to third parties. We may share your
                  information only in the following circumstances:
                </p>
                <div>
                  <h3 className="font-medium text-foreground mb-2">Service Providers</h3>
                  <p>
                    We share information with trusted third-party service providers who assist us in operating our
                    service, including:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4 mt-2">
                    <li>Stripe for payment processing</li>
                    <li>Cloud hosting providers for data storage and application hosting</li>
                    <li>Email service providers for sending notifications and updates</li>
                  </ul>
                  <p className="mt-2">
                    These service providers are contractually obligated to protect your information and use it only
                    for the purposes we specify.
                  </p>
                </div>
                <div>
                  <h3 className="font-medium text-foreground mb-2">Legal Requirements</h3>
                  <p>
                    We may disclose your information if required to do so by law or in response to valid requests
                    by public authorities (e.g., a court order or subpoena).
                  </p>
                </div>
                <div>
                  <h3 className="font-medium text-foreground mb-2">Business Transfers</h3>
                  <p>
                    If LeaseShield Pro is involved in a merger, acquisition, or sale of assets, your information
                    may be transferred. We will provide notice before your information is transferred and becomes
                    subject to a different privacy policy.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Data Security</h2>
              <p className="text-muted-foreground leading-relaxed">
                We implement appropriate technical and organizational security measures to protect your personal
                information against unauthorized access, alteration, disclosure, or destruction. These measures
                include encryption of data in transit and at rest, regular security audits, and restricted access
                to personal information. However, no method of transmission over the Internet or electronic storage
                is 100% secure, and we cannot guarantee absolute security.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Data Retention</h2>
              <p className="text-muted-foreground leading-relaxed">
                We retain your personal information for as long as necessary to provide you with our services and
                as described in this privacy policy. When you cancel your subscription, we will retain your account
                information for a reasonable period to allow you to reactivate your account if desired. After this
                period, or upon your request, we will delete or anonymize your personal information in accordance
                with applicable laws.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Your Rights and Choices</h2>
              <div className="space-y-3 text-muted-foreground leading-relaxed">
                <p>You have the following rights regarding your personal information:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>
                    <strong className="text-foreground">Access:</strong> You can request a copy of the personal
                    information we hold about you
                  </li>
                  <li>
                    <strong className="text-foreground">Correction:</strong> You can update or correct your account
                    information at any time through your account settings
                  </li>
                  <li>
                    <strong className="text-foreground">Deletion:</strong> You can request deletion of your personal
                    information by contacting us
                  </li>
                  <li>
                    <strong className="text-foreground">Opt-out:</strong> You can opt out of receiving marketing
                    communications, but you will continue to receive essential service-related emails
                  </li>
                  <li>
                    <strong className="text-foreground">Data Portability:</strong> You can request a copy of your
                    data in a machine-readable format
                  </li>
                </ul>
                <p className="mt-3">
                  To exercise any of these rights, please contact us using the information provided below.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Third-Party Links and Services</h2>
              <p className="text-muted-foreground leading-relaxed">
                Our service may contain links to third-party websites or services, such as{" "}
                <a 
                  href="https://www.westernverify.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-medium"
                >
                  Western Verify
                </a>{" "}
                for tenant screening. We are not responsible for the privacy practices of these third parties. We
                encourage you to review the privacy policies of any third-party services before providing them
                with your information.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Children's Privacy</h2>
              <p className="text-muted-foreground leading-relaxed">
                Our service is not intended for individuals under the age of 18. We do not knowingly collect
                personal information from children. If we become aware that we have collected personal information
                from a child without parental consent, we will take steps to delete that information.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">California Privacy Rights</h2>
              <p className="text-muted-foreground leading-relaxed">
                If you are a California resident, you have specific rights under the California Consumer Privacy
                Act (CCPA), including the right to know what personal information we collect, the right to delete
                your personal information, and the right to opt-out of the sale of personal information. We do not
                sell personal information. To exercise your rights under CCPA, please contact us.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Changes to This Privacy Policy</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may update this privacy policy from time to time to reflect changes in our practices or for
                other operational, legal, or regulatory reasons. We will notify you of any material changes by
                posting the new privacy policy on this page and updating the "Last updated" date. Your continued
                use of our service after any changes indicates your acceptance of the updated privacy policy.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Contact Us</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                If you have questions or concerns about this privacy policy or our data practices, please contact us at:
              </p>
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-foreground font-medium">support@leaseshieldpro.com</p>
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
