import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, AlertTriangle, Shield, Scale, ExternalLink } from "lucide-react";
import { Logo } from "@/components/logo";

export default function Disclaimers() {
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
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-950/20 mb-4">
            <AlertTriangle className="h-8 w-8 text-amber-600" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">
            Legal Disclaimers
          </h1>
          <p className="text-muted-foreground">
            Important notices about using LeaseShield App
          </p>
        </div>

        {/* Critical Warning */}
        <div className="mb-8 bg-amber-50 dark:bg-amber-950/20 border-2 border-amber-200 dark:border-amber-800 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-6 w-6 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-2">
                Please Read Carefully
              </h2>
              <p className="text-sm text-foreground">
                The following disclaimers are critical to understanding the nature of LeaseShield App's services. 
                By using this platform, you acknowledge that you have read and understood these disclaimers.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Not Legal Advice */}
          <Card>
            <CardContent className="p-6 sm:p-8">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Scale className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-foreground mb-3">
                    Not Legal Advice
                  </h2>
                  <div className="space-y-3 text-muted-foreground leading-relaxed">
                    <p className="font-semibold text-foreground">
                      LeaseShield App is not a law firm and does not provide legal advice.
                    </p>
                    <p>
                      All information, templates, compliance guidance, and materials provided on this platform 
                      are for <strong>informational and educational purposes only</strong>. Nothing on this 
                      website should be construed as legal advice or a substitute for consultation with a 
                      licensed attorney.
                    </p>
                    <p>
                      The information provided is general in nature and may not be appropriate for your specific 
                      situation. Laws vary significantly by jurisdiction and change frequently. What works in one 
                      state or situation may not be appropriate in another.
                    </p>
                    <p className="font-semibold text-foreground">
                      For specific legal guidance regarding your situation, you must consult a licensed attorney 
                      in your jurisdiction.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* No Attorney-Client Relationship */}
          <Card>
            <CardContent className="p-6 sm:p-8">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Shield className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-foreground mb-3">
                    No Attorney-Client Relationship
                  </h2>
                  <div className="space-y-3 text-muted-foreground leading-relaxed">
                    <p>
                      Use of LeaseShield App and any templates, resources, or information provided <strong>does 
                      not create an attorney-client relationship</strong> between you and LeaseShield App, its 
                      owners, operators, employees, or affiliates.
                    </p>
                    <p>
                      Communications through this platform, including contact forms, support emails, or any other 
                      correspondence, are <strong>not confidential or privileged</strong> and do not establish a 
                      professional legal relationship.
                    </p>
                    <p>
                      If you need legal representation or confidential legal advice, you must engage a licensed 
                      attorney directly.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* State-Specific Limitations */}
          <Card>
            <CardContent className="p-6 sm:p-8">
              <h2 className="text-xl font-semibold text-foreground mb-3">
                State-Specific Limitations
              </h2>
              <div className="space-y-3 text-muted-foreground leading-relaxed">
                <p>
                  Legal requirements for landlord-tenant relationships, lease agreements, eviction procedures, 
                  and property management vary <strong>significantly by state, county, and municipality</strong>.
                </p>
                <p>
                  While LeaseShield App provides state-specific templates and guidance for Utah, Texas, North Dakota, 
                  and South Dakota, you are responsible for:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Verifying that information is current and accurate for your jurisdiction</li>
                  <li>Checking for local ordinances or county-specific requirements</li>
                  <li>Ensuring compliance with federal fair housing laws</li>
                  <li>Customizing templates to meet your specific needs and local requirements</li>
                  <li>Consulting local authorities or legal counsel when in doubt</li>
                </ul>
                <p className="font-semibold text-foreground">
                  Laws change frequently. Always verify current requirements before taking action.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Accuracy and Currency */}
          <Card>
            <CardContent className="p-6 sm:p-8">
              <h2 className="text-xl font-semibold text-foreground mb-3">
                Accuracy and Currency Disclaimer
              </h2>
              <div className="space-y-3 text-muted-foreground leading-relaxed">
                <p>
                  While we strive to keep our templates, compliance guidance, and legal updates current and 
                  accurate, <strong>we make no warranties or guarantees</strong> about:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>The accuracy or completeness of any information provided</li>
                  <li>The timeliness or currency of templates and guidance</li>
                  <li>The suitability of any template for your specific situation</li>
                  <li>The absence of errors or omissions in any materials</li>
                </ul>
                <p>
                  Laws, regulations, and legal interpretations change regularly. Information that was accurate 
                  when published may become outdated. Courts may interpret laws differently in different jurisdictions.
                </p>
                <p className="font-semibold text-foreground">
                  You are responsible for verifying all information is current and applicable before using any 
                  template or taking action based on our guidance.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Templates Are General Forms */}
          <Card>
            <CardContent className="p-6 sm:p-8">
              <h2 className="text-xl font-semibold text-foreground mb-3">
                Templates Are General Forms
              </h2>
              <div className="space-y-3 text-muted-foreground leading-relaxed">
                <p>
                  All templates provided by LeaseShield App are <strong>general forms</strong> designed to cover 
                  common situations. They are starting points that require customization.
                </p>
                <p>
                  Templates may not:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Address all aspects of your specific situation</li>
                  <li>Include provisions required by your local jurisdiction</li>
                  <li>Be appropriate for complex or unusual circumstances</li>
                  <li>Replace the need for professional legal review</li>
                </ul>
                <p>
                  <strong>You must customize templates to your needs</strong> and have them reviewed by an 
                  attorney if you have any questions about their suitability or legality.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Limitation of Liability */}
          <Card>
            <CardContent className="p-6 sm:p-8">
              <h2 className="text-xl font-semibold text-foreground mb-3">
                Limitation of Liability
              </h2>
              <div className="space-y-3 text-muted-foreground leading-relaxed">
                <p className="font-semibold text-foreground">
                  TO THE MAXIMUM EXTENT PERMITTED BY LAW, LEASESHIELD APP SHALL NOT BE LIABLE FOR ANY DAMAGES 
                  ARISING FROM YOUR USE OF THE SERVICE OR RELIANCE ON ANY INFORMATION PROVIDED.
                </p>
                <p>
                  This includes but is not limited to:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Legal disputes with tenants, including evictions</li>
                  <li>Financial losses from rental property operations</li>
                  <li>Violations of housing laws or regulations</li>
                  <li>Rejected court filings or invalid legal documents</li>
                  <li>Damages from errors or omissions in templates</li>
                  <li>Consequences of using outdated or incorrect information</li>
                  <li>Any other direct, indirect, incidental, or consequential damages</li>
                </ul>
                <p>
                  <strong>You assume all risk</strong> for the use of templates and information provided by 
                  LeaseShield App.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Third-Party Referrals and Affiliations */}
          <Card>
            <CardContent className="p-6 sm:p-8">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <ExternalLink className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-foreground mb-3">
                    Third-Party Referrals and Affiliations
                  </h2>
                  <div className="space-y-3 text-muted-foreground leading-relaxed">
                    <p>
                      <strong>Tenant Screening Referrals:</strong> LeaseShield App may provide referrals to 
                      Western Verify LLC (<a href="https://www.westernverify.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">www.westernverify.com</a>) 
                      for tenant screening services.
                    </p>
                    <p className="font-semibold text-foreground">
                      Important Disclosure:
                    </p>
                    <ul className="list-disc list-inside space-y-2 ml-4">
                      <li>Western Verify LLC is a separate business entity owned and operated by the same ownership as LeaseShield App</li>
                      <li>LeaseShield App may receive compensation or benefit from referrals to Western Verify LLC</li>
                      <li>You are not obligated to use Western Verify LLC and may choose any tenant screening service provider</li>
                      <li>Any services purchased from Western Verify LLC are subject to their own separate terms and conditions</li>
                      <li>LeaseShield App is not responsible for the services, pricing, or performance of Western Verify LLC</li>
                    </ul>
                    <p>
                      This disclosure is provided for transparency and in compliance with applicable consumer protection laws. 
                      All referrals to Western Verify LLC are clearly identified within the platform.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* User Responsibility */}
          <Card>
            <CardContent className="p-6 sm:p-8">
              <h2 className="text-xl font-semibold text-foreground mb-3">
                User Responsibility
              </h2>
              <div className="space-y-3 text-muted-foreground leading-relaxed">
                <p>
                  By using LeaseShield App, you acknowledge and agree that:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>
                    You are solely responsible for determining whether any template or information is appropriate 
                    for your specific situation
                  </li>
                  <li>
                    You will consult with a licensed attorney before taking any significant legal action
                  </li>
                  <li>
                    You will verify all information is current and compliant with applicable laws
                  </li>
                  <li>
                    You will customize templates to meet your specific needs and local requirements
                  </li>
                  <li>
                    You understand that using templates does not guarantee any particular outcome
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Third-Party References */}
          <Card>
            <CardContent className="p-6 sm:p-8">
              <h2 className="text-xl font-semibold text-foreground mb-3">
                Third-Party References
              </h2>
              <div className="space-y-3 text-muted-foreground leading-relaxed">
                <p>
                  LeaseShield App may reference or link to third-party services, such as Western Verify for 
                  tenant screening. These references are provided for informational purposes only.
                </p>
                <p>
                  We do not endorse, guarantee, or assume responsibility for any third-party services. You are 
                  responsible for evaluating third-party services and their terms before use.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Questions */}
          <Card>
            <CardContent className="p-6 sm:p-8">
              <h2 className="text-xl font-semibold text-foreground mb-3">
                Questions About These Disclaimers?
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                If you have questions about these disclaimers or need clarification, please contact us:
              </p>
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-foreground font-medium">support@leaseshieldapp.com</p>
              </div>
            </CardContent>
          </Card>
        </div>

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
