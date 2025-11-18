import { Shield, FileText, Search, Users, CheckCircle2, ArrowRight, Star, TrendingUp, Clock, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { motion } from "framer-motion";

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            <span className="font-display text-base sm:text-xl font-semibold text-foreground">
              LeaseShield<span className="hidden sm:inline"> Pro</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.location.href = "/api/login"}
              data-testid="button-login"
              className="text-xs sm:text-sm"
            >
              Log In
            </Button>
            <Button
              size="sm"
              onClick={() => window.location.href = "/api/login"}
              data-testid="button-start-trial"
              className="text-xs sm:text-sm px-2 sm:px-4"
            >
              <span className="hidden xs:inline">Start </span>Trial
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-20 md:py-32 overflow-hidden">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/10 pointer-events-none" />
        
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={staggerContainer}
            >
              <motion.div variants={fadeInUp} className="mb-4">
                <Badge className="px-3 py-1 text-sm">
                  <Star className="h-3 w-3 mr-1 fill-current" />
                  Trusted by 500+ Landlords
                </Badge>
              </motion.div>
              
              <motion.h1 
                variants={fadeInUp}
                className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-semibold text-foreground leading-tight mb-6"
              >
                Protect Your Rental Business from{" "}
                <span className="text-primary">Costly Legal Mistakes</span>
              </motion.h1>
              
              <motion.p 
                variants={fadeInUp}
                className="text-base sm:text-lg text-muted-foreground mb-8 leading-relaxed"
              >
                State-specific leases, compliance guidance, and screening resources designed
                specifically for small and midsize landlords. Your protective mentor for
                confident, risk-free property management.
              </motion.p>
              
              <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row gap-4 mb-8">
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
              </motion.div>
              
              <motion.div 
                variants={fadeInUp}
                className="flex flex-col xs:flex-row items-start xs:items-center gap-3 xs:gap-6 text-sm text-muted-foreground"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
                  <span>No credit card required</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
                  <span>Cancel anytime</span>
                </div>
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="relative hidden lg:block"
            >
              <div className="aspect-square rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-border p-8 flex items-center justify-center">
                <div className="grid grid-cols-2 gap-4 w-full">
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <Card className="p-4 hover-elevate transition-all">
                      <FileText className="h-8 w-8 text-primary mb-2" />
                      <p className="text-sm font-medium">State-Specific Leases</p>
                    </Card>
                  </motion.div>
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <Card className="p-4 hover-elevate transition-all">
                      <Shield className="h-8 w-8 text-primary mb-2" />
                      <p className="text-sm font-medium">Compliance Guidance</p>
                    </Card>
                  </motion.div>
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <Card className="p-4 hover-elevate transition-all">
                      <Search className="h-8 w-8 text-primary mb-2" />
                      <p className="text-sm font-medium">Screening Toolkit</p>
                    </Card>
                  </motion.div>
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <Card className="p-4 hover-elevate transition-all">
                      <Users className="h-8 w-8 text-primary mb-2" />
                      <p className="text-sm font-medium">Helpful Resources</p>
                    </Card>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="py-8 sm:py-12 border-y bg-muted/30">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8"
          >
            <motion.div variants={fadeInUp} className="text-center">
              <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-1 sm:mb-2">
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                <div className="text-2xl sm:text-3xl font-bold text-foreground">500+</div>
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground">Active Landlords</div>
            </motion.div>
            <motion.div variants={fadeInUp} className="text-center">
              <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-1 sm:mb-2">
                <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                <div className="text-2xl sm:text-3xl font-bold text-foreground">37+</div>
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground">Legal Templates</div>
            </motion.div>
            <motion.div variants={fadeInUp} className="text-center">
              <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-1 sm:mb-2">
                <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                <div className="text-2xl sm:text-3xl font-bold text-foreground">4</div>
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground">States Covered</div>
            </motion.div>
            <motion.div variants={fadeInUp} className="text-center">
              <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-1 sm:mb-2">
                <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                <div className="text-2xl sm:text-3xl font-bold text-foreground">24/7</div>
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground">Access Anytime</div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 md:py-28">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="text-center mb-12 sm:mb-16"
          >
            <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-semibold text-foreground mb-4">
              Everything You Need to Operate Confidently
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-4">
              Simple, protective, state-specific guidance that prevents legal and financial mistakes
            </p>
          </motion.div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid md:grid-cols-3 gap-8"
          >
            <motion.div variants={fadeInUp}>
              <Card className="p-6 h-full hover-elevate transition-all">
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
            </motion.div>

            <motion.div variants={fadeInUp}>
              <Card className="p-6 h-full hover-elevate transition-all">
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
                    <span>Before/after comparisons</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                    <span>Email alerts for your state</span>
                  </li>
                </ul>
              </Card>
            </motion.div>

            <motion.div variants={fadeInUp}>
              <Card className="p-6 h-full hover-elevate transition-all">
                <div className="rounded-lg bg-primary/10 w-12 h-12 flex items-center justify-center mb-4">
                  <Search className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-display text-xl font-semibold mb-3">Screening Toolkit</h3>
                <p className="text-muted-foreground mb-4">
                  Step-by-step guidance on tenant screening, red flags to watch for, and
                  direct access to Western Verify for background checks.
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                    <span>Screening best practices</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                    <span>Red flag checklists</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                    <span>Western Verify integration</span>
                  </li>
                </ul>
              </Card>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 md:py-28 bg-muted/30">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="text-center mb-12"
          >
            <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-semibold text-foreground mb-4">
              Trusted by Landlords Nationwide
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-4">
              See how LeaseShield Pro is protecting rental businesses just like yours
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid md:grid-cols-3 gap-8"
          >
            <motion.div variants={fadeInUp}>
              <Card className="p-6 h-full">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                  ))}
                </div>
                <p className="text-muted-foreground mb-4">
                  "LeaseShield Pro saved me from a costly mistake. Their Utah lease template
                  included a clause I didn't know about that protected me during a difficult eviction."
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-semibold text-primary">SJ</span>
                  </div>
                  <div>
                    <div className="font-medium text-sm">Sarah Johnson</div>
                    <div className="text-xs text-muted-foreground">4 units in Salt Lake City, UT</div>
                  </div>
                </div>
              </Card>
            </motion.div>

            <motion.div variants={fadeInUp}>
              <Card className="p-6 h-full">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                  ))}
                </div>
                <p className="text-muted-foreground mb-4">
                  "The compliance updates are worth the subscription alone. I got an alert about a
                  new Texas security deposit law before my property manager even knew about it."
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-semibold text-primary">MC</span>
                  </div>
                  <div>
                    <div className="font-medium text-sm">Michael Chen</div>
                    <div className="text-xs text-muted-foreground">12 units in Dallas, TX</div>
                  </div>
                </div>
              </Card>
            </motion.div>

            <motion.div variants={fadeInUp}>
              <Card className="p-6 h-full">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                  ))}
                </div>
                <p className="text-muted-foreground mb-4">
                  "Finally, legal documents I can actually understand! The screening toolkit helped me
                  avoid a nightmare tenant. Best $12/month I spend on my business."
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-semibold text-primary">RP</span>
                  </div>
                  <div>
                    <div className="font-medium text-sm">Rachel Peterson</div>
                    <div className="text-xs text-muted-foreground">6 units in Fargo, ND</div>
                  </div>
                </div>
              </Card>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 md:py-28">
        <div className="container max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="text-center mb-12"
          >
            <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-semibold text-foreground mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground px-4">
              Everything you need to protect your rental business
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
          >
            <Card className="p-8 border-2 border-primary/20 shadow-lg">
              <div className="text-center mb-6">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Award className="h-6 w-6 text-primary" />
                  <Badge variant="outline" className="text-sm">Most Popular</Badge>
                </div>
                <h3 className="font-display text-2xl font-semibold mb-2">LeaseShield Pro</h3>
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-5xl font-bold text-foreground">$12</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">7-day free trial • No credit card required</p>
              </div>

              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                  <span>Unlimited access to 37+ state-specific templates</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                  <span>Real-time legal compliance updates for your state</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                  <span>Complete tenant screening toolkit & resources</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                  <span>Step-by-step guidance for every document</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                  <span>Email alerts when laws change in your state</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                  <span>Cancel anytime, no questions asked</span>
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
            </Card>
          </motion.div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 md:py-28 bg-muted/30">
        <div className="container max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="text-center mb-12"
          >
            <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-semibold text-foreground mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground px-4">
              Everything you need to know about LeaseShield Pro
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
          >
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger>What states does LeaseShield Pro currently support?</AccordionTrigger>
                <AccordionContent>
                  We currently serve landlords in Utah, Texas, North Dakota, and South Dakota with
                  comprehensive state-specific templates and compliance guidance. We're expanding to
                  additional states soon—sign up to get notified when your state is added!
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2">
                <AccordionTrigger>Are the templates really attorney-reviewed?</AccordionTrigger>
                <AccordionContent>
                  Yes! Every template in our library has been reviewed and approved by licensed
                  attorneys in each respective state. We also update templates whenever state laws
                  change to ensure you're always compliant.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-3">
                <AccordionTrigger>Can I cancel my subscription anytime?</AccordionTrigger>
                <AccordionContent>
                  Absolutely. You can cancel your subscription at any time with no cancellation fees
                  or penalties. Your access will continue until the end of your current billing period.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-4">
                <AccordionTrigger>Do I need a credit card for the free trial?</AccordionTrigger>
                <AccordionContent>
                  No! Your 7-day free trial starts immediately with just your email address. You'll
                  only need to add payment information if you choose to continue after the trial ends.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-5">
                <AccordionTrigger>How often are legal updates published?</AccordionTrigger>
                <AccordionContent>
                  We monitor state legislatures and courts continuously. When a law changes that could
                  affect your liability or requirements, we'll send you an email alert within 48 hours
                  along with clear before/after explanations and updated templates if needed.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-6">
                <AccordionTrigger>What if I have properties in multiple states?</AccordionTrigger>
                <AccordionContent>
                  One subscription gives you access to all supported states. You can easily switch
                  between states in your dashboard to access the correct templates and compliance
                  information for each property.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </motion.div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 md:py-28 bg-gradient-to-br from-primary/10 to-primary/5">
        <div className="container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
          >
            <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-semibold text-foreground mb-4">
              Ready to Protect Your Rental Business?
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground mb-8 max-w-2xl mx-auto px-4">
              Join hundreds of landlords who sleep better knowing their leases, notices, and
              compliance are handled correctly. Start your free trial today.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                onClick={() => window.location.href = "/api/login"}
                data-testid="button-final-cta"
                className="text-base px-8"
              >
                Start 7-Day Free Trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => {
                  document.getElementById('features')?.scrollIntoView({ 
                    behavior: 'smooth',
                    block: 'start'
                  });
                }}
                data-testid="button-final-learn"
                className="text-base px-8"
              >
                Learn More About Features
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-6">
              No credit card required • 7-day free trial • Cancel anytime
            </p>
          </motion.div>
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
              <h4 className="font-semibold mb-3 text-sm">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Templates</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-sm">States</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Utah</li>
                <li>Texas</li>
                <li>North Dakota</li>
                <li>South Dakota</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-sm">Support</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="/help" className="hover:text-foreground transition-colors">Help Center</a></li>
                <li><a href="/contact" className="hover:text-foreground transition-colors">Contact</a></li>
                <li><a href="/privacy" className="hover:text-foreground transition-colors">Privacy</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t pt-8 text-center text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} LeaseShield Pro. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
