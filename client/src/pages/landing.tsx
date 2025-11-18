import { Shield, FileText, Search, Users, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <span className="font-display text-xl font-semibold text-foreground">
              LeaseShield Pro
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              onClick={() => window.location.href = "/api/login"}
              data-testid="button-login"
            >
              Log In
            </Button>
            <Button
              onClick={() => window.location.href = "/api/login"}
              data-testid="button-start-trial"
            >
              Start Free Trial
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-20 md:py-28 overflow-hidden">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-semibold text-foreground leading-tight mb-6">
                Protect Your Rental Business from Costly Legal Mistakes
              </h1>
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                State-specific leases, compliance guidance, and screening resources designed
                specifically for small and midsize landlords. Your protective mentor for
                confident, risk-free property management.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <Button
                  size="lg"
                  onClick={() => window.location.href = "/api/login"}
                  data-testid="button-hero-trial"
                  className="text-base px-8"
                >
                  Start 7-Day Free Trial
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  data-testid="button-hero-learn"
                  className="text-base px-8"
                  onClick={() => {
                    document.getElementById('features')?.scrollIntoView({ 
                      behavior: 'smooth',
                      block: 'start'
                    });
                  }}
                >
                  Learn More
                </Button>
              </div>
              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span>No credit card required</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span>Cancel anytime</span>
                </div>
              </div>
            </div>
            <div className="relative hidden lg:block">
              <div className="aspect-square rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-border p-8 flex items-center justify-center">
                <div className="grid grid-cols-2 gap-4 w-full">
                  <Card className="p-4 hover-elevate transition-all">
                    <FileText className="h-8 w-8 text-primary mb-2" />
                    <p className="text-sm font-medium">State-Specific Leases</p>
                  </Card>
                  <Card className="p-4 hover-elevate transition-all">
                    <Shield className="h-8 w-8 text-primary mb-2" />
                    <p className="text-sm font-medium">Legal Protection</p>
                  </Card>
                  <Card className="p-4 hover-elevate transition-all">
                    <Search className="h-8 w-8 text-primary mb-2" />
                    <p className="text-sm font-medium">Screening Toolkit</p>
                  </Card>
                  <Card className="p-4 hover-elevate transition-all">
                    <Users className="h-8 w-8 text-primary mb-2" />
                    <p className="text-sm font-medium">Expert Guidance</p>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Bar */}
      <section className="py-8 border-y bg-muted/30">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-muted-foreground text-sm">
            Trusted by landlords across <strong>Utah, Texas, North Dakota, and South Dakota</strong>
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 md:py-28">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl sm:text-4xl font-semibold text-foreground mb-4">
              Everything You Need to Operate Confidently
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Simple, protective, state-specific guidance that prevents legal and financial mistakes
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="p-6">
              <div className="rounded-lg bg-primary/10 w-12 h-12 flex items-center justify-center mb-4">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-display text-xl font-semibold mb-3">State-Specific Templates</h3>
              <p className="text-muted-foreground mb-4">
                Attorney-reviewed leases, applications, notices, and forms tailored to your state's
                exact requirements. Download as PDF or fill online.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                  <span>Residential leases & applications</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                  <span>Move-in/move-out checklists</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                  <span>All required notices by state</span>
                </li>
              </ul>
            </Card>

            <Card className="p-6">
              <div className="rounded-lg bg-primary/10 w-12 h-12 flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-display text-xl font-semibold mb-3">Compliance Protection</h3>
              <p className="text-muted-foreground mb-4">
                Stay ahead of changing laws with curated updates that only include what could
                create liability. Clear before/after comparisons included.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                  <span>Impact-only legal updates</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                  <span>State compliance cards</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                  <span>Instant dashboard alerts</span>
                </li>
              </ul>
            </Card>

            <Card className="p-6">
              <div className="rounded-lg bg-primary/10 w-12 h-12 flex items-center justify-center mb-4">
                <Search className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-display text-xl font-semibold mb-3">Screening Toolkit</h3>
              <p className="text-muted-foreground mb-4">
                Learn how to read credit reports, spot red flags, and follow adverse action
                requirements. Integrated with Western Verify for professional screening.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                  <span>Credit report decoder</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                  <span>Criminal & eviction guidance</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                  <span>Adverse action templates</span>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 md:py-28 bg-muted/30">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl sm:text-4xl font-semibold text-foreground mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-lg text-muted-foreground">
              Less than the cost of a single tenant mistake
            </p>
          </div>

          <Card className="max-w-lg mx-auto p-8">
            <div className="text-center mb-6">
              <div className="flex items-baseline justify-center gap-2 mb-2">
                <span className="text-5xl font-display font-bold text-foreground">$15</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <p className="text-sm text-muted-foreground">Billed monthly, cancel anytime</p>
            </div>

            <ul className="space-y-4 mb-8">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                <span>All state-specific templates and forms</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                <span>Curated compliance updates</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                <span>Complete screening toolkit</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                <span>Tenant issue workflows</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                <span>7-day free trial included</span>
              </li>
            </ul>

            <Button
              size="lg"
              className="w-full text-base"
              onClick={() => window.location.href = "/api/login"}
              data-testid="button-pricing-trial"
            >
              Start Your Free Trial
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>

            <p className="text-center text-sm text-muted-foreground mt-4">
              No credit card required for trial
            </p>
          </Card>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 md:py-28">
        <div className="container max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl sm:text-4xl font-semibold text-foreground mb-4">
              Frequently Asked Questions
            </h2>
          </div>

          <Accordion type="single" collapsible className="space-y-4">
            <AccordionItem value="item-1" className="border rounded-lg px-6">
              <AccordionTrigger className="text-left hover:no-underline">
                What states are supported?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                We currently support Utah, Texas, North Dakota, and South Dakota with state-specific
                templates and compliance guidance. We're expanding to additional states based on
                landlord demand.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2" className="border rounded-lg px-6">
              <AccordionTrigger className="text-left hover:no-underline">
                How often are templates updated?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Our legal team monitors state and local law changes continuously. When a meaningful
                update occurs, you'll receive a dashboard notification and email with clear
                before/after comparisons explaining exactly what changed and why it matters.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3" className="border rounded-lg px-6">
              <AccordionTrigger className="text-left hover:no-underline">
                Can I cancel my subscription anytime?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Yes. You can cancel your subscription at any time from your account settings. You'll
                continue to have access through the end of your billing period.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4" className="border rounded-lg px-6">
              <AccordionTrigger className="text-left hover:no-underline">
                Is this legal advice?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                No. LeaseShield Pro provides educational resources and attorney-reviewed templates,
                but this is not legal advice. For specific legal questions about your situation,
                consult with a licensed attorney in your state.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-5" className="border rounded-lg px-6">
              <AccordionTrigger className="text-left hover:no-underline">
                What's included in the screening toolkit?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                The screening toolkit includes guidance on reading credit reports, identifying red
                flags, criminal and eviction screening best practices, and adverse action compliance.
                We integrate with Western Verify for professional tenant screening services.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-6" className="border rounded-lg px-6">
              <AccordionTrigger className="text-left hover:no-underline">
                How many properties can I manage?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Your subscription covers all your properties. LeaseShield Pro is designed for
                landlords managing 1-100 units, with unlimited access to all templates and resources.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 bg-muted/30">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Shield className="h-5 w-5 text-primary" />
                <span className="font-display font-semibold">LeaseShield Pro</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Your protective mentor for confident, risk-free property management.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Templates</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Compliance</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Screening</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Pricing</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Help Center</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Contact Us</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Disclaimers</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t pt-8 text-center text-sm text-muted-foreground">
            <p>© 2024 LeaseShield Pro. All rights reserved.</p>
            <p className="mt-2">
              LeaseShield Pro provides educational resources only. This is not legal advice.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
