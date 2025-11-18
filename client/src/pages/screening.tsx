import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Search,
  CreditCard,
  AlertTriangle,
  FileText,
  ExternalLink,
  CheckCircle,
  XCircle,
  HelpCircle,
} from "lucide-react";

export default function Screening() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex-1 overflow-auto">
      <div className="container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-display font-semibold text-foreground mb-2">
            Screening Toolkit
          </h1>
          <p className="text-muted-foreground">
            Learn to read credit reports, spot red flags, and avoid costly screening mistakes
          </p>
        </div>

        {/* Western Verify CTA */}
        <Card className="p-6 mb-8 bg-primary/5 border-primary/20">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-primary/10 w-12 h-12 flex items-center justify-center flex-shrink-0">
              <Search className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg text-foreground mb-2">
                Professional Tenant Screening
              </h3>
              <p className="text-muted-foreground mb-4">
                Ready to screen a tenant? We've partnered with{" "}
                <a 
                  href="https://www.westernverify.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-medium"
                >
                  Western Verify
                </a>{" "}
                to provide comprehensive, compliant tenant screening services.
              </p>
              <Button 
                data-testid="button-western-verify"
                onClick={() => window.open('https://www.westernverify.com', '_blank')}
              >
                Screen with Western Verify
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>

        {/* Credit Report Decoder */}
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <CreditCard className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-display font-semibold text-foreground">
              Credit Report Decoder
            </h2>
          </div>

          <Card className="p-6 mb-6">
            <h3 className="font-semibold text-lg mb-4">Understanding Credit Reports</h3>
            <p className="text-muted-foreground mb-6">
              Credit reports can be overwhelming. Here's what matters most for landlords and
              how to spot potential issues before they become problems.
            </p>

            <Accordion type="single" collapsible className="space-y-2">
              <AccordionItem value="credit-score" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary">Key Metric</Badge>
                    <span className="font-semibold">Credit Score Ranges</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pt-4">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                      <div>
                        <strong className="text-foreground">740+ (Excellent):</strong> Very low risk.
                        Strong payment history and credit management.
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                      <div>
                        <strong className="text-foreground">670-739 (Good):</strong> Low risk.
                        Generally reliable with minor past issues.
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <HelpCircle className="h-5 w-5 text-warning mt-0.5 flex-shrink-0" />
                      <div>
                        <strong className="text-foreground">580-669 (Fair):</strong> Moderate risk.
                        Review payment history carefully and consider requiring co-signer or larger deposit.
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                      <div>
                        <strong className="text-foreground">Below 580 (Poor):</strong> High risk.
                        Significant credit issues. Proceed with extreme caution.
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="tradelines" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary">Important</Badge>
                    <span className="font-semibold">Reading Tradelines</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pt-4">
                  <p className="mb-4">
                    Tradelines show individual credit accounts. Look for these patterns:
                  </p>
                  <div className="space-y-3">
                    <div>
                      <strong className="text-foreground">Payment History:</strong> Look for
                      30/60/90 day late payments. Recent lates (within 12 months) are red flags.
                    </div>
                    <div>
                      <strong className="text-foreground">Account Types:</strong> Mix of
                      revolving (credit cards) and installment (auto, student loans) is normal.
                    </div>
                    <div>
                      <strong className="text-foreground">Credit Utilization:</strong> Using
                      more than 80% of available credit suggests financial stress.
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="red-flags" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3">
                    <Badge variant="destructive">Critical</Badge>
                    <span className="font-semibold">Red Flags to Watch For</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pt-4">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <XCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                      <div>
                        <strong className="text-foreground">Collections & Charge-offs:</strong> Unpaid
                        debts sent to collections indicate inability or unwillingness to pay.
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <XCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                      <div>
                        <strong className="text-foreground">Recent Bankruptcies:</strong> Within
                        the last 2-3 years suggests ongoing financial instability.
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <XCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                      <div>
                        <strong className="text-foreground">Multiple Recent Late Payments:</strong> Pattern
                        of 30+ day lates in the past 6-12 months.
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <XCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                      <div>
                        <strong className="text-foreground">Maxed Out Credit Cards:</strong> High
                        utilization (&gt;90%) across multiple accounts suggests cash flow problems.
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="questions" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary">Strategy</Badge>
                    <span className="font-semibold">Questions to Ask Applicants</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pt-4">
                  <p className="mb-4">
                    When you spot issues, ask these fair, compliant questions:
                  </p>
                  <ul className="space-y-2 list-disc pl-5">
                    <li>
                      "I noticed some late payments in [timeframe]. Can you explain what happened?"
                    </li>
                    <li>
                      "There's a collection account from [creditor]. What's the status of that debt?"
                    </li>
                    <li>
                      "Your credit report shows a bankruptcy in [year]. What circumstances led to that?"
                    </li>
                    <li>
                      "I see several accounts with high balances. What's your monthly income?"
                    </li>
                  </ul>
                  <p className="mt-4 text-sm">
                    <strong className="text-foreground">Important:</strong> Document their answers
                    and use the same questions for all applicants to maintain Fair Housing compliance.
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Card>
        </div>

        {/* Criminal & Eviction Screening */}
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <AlertTriangle className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-display font-semibold text-foreground">
              Criminal & Eviction Screening
            </h2>
          </div>

          <div className="space-y-6">
            <Card className="p-6">
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Criminal Background Checks
              </h3>
              <p className="text-muted-foreground mb-4">
                Criminal screening is heavily regulated. Here's what you need to know:
              </p>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                  <div>
                    <strong className="text-foreground">Use Consistent Criteria:</strong> Apply
                    the same criminal screening standards to all applicants.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                  <div>
                    <strong className="text-foreground">Consider Context:</strong> Look at
                    severity, how long ago, and relevance to tenancy (e.g., property-related crimes).
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-warning mt-0.5 flex-shrink-0" />
                  <div>
                    <strong className="text-foreground">Follow State Laws:</strong> Some states
                    limit how far back you can look or what convictions you can consider.
                  </div>
                </li>
              </ul>
            </Card>

            <Card className="p-6">
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-primary" />
                Eviction History
              </h3>
              <p className="text-muted-foreground mb-4">
                Past evictions are strong predictors of future problems, but verify the details:
              </p>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                  <div>
                    <strong className="text-foreground">Check Dates:</strong> Recent evictions
                    (within 3 years) are more concerning than older ones.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                  <div>
                    <strong className="text-foreground">Ask for Context:</strong> Sometimes
                    evictions result from landlord disputes, not tenant fault.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                  <div>
                    <strong className="text-foreground">Verify Outcomes:</strong> Was the
                    eviction completed or dismissed? Did they owe money?
                  </div>
                </li>
              </ul>
            </Card>
          </div>
        </div>

        {/* Adverse Action */}
        <div>
          <div className="flex items-center gap-2 mb-6">
            <FileText className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-display font-semibold text-foreground">
              Adverse Action Compliance
            </h2>
          </div>

          <Card className="p-6">
            <p className="text-muted-foreground mb-6">
              If you deny an applicant based on their credit, criminal, or eviction report, federal
              law requires you to provide an Adverse Action Notice within 3-5 business days.
            </p>

            <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-warning mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-foreground mb-2">Required by Federal Law</h4>
                  <p className="text-sm text-muted-foreground">
                    Failing to provide proper adverse action notices can result in lawsuits and
                    penalties. Use our attorney-reviewed templates to stay compliant.
                  </p>
                </div>
              </div>
            </div>

            <Button variant="default" data-testid="button-adverse-action-template">
              <FileText className="mr-2 h-4 w-4" />
              Get Adverse Action Templates
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
