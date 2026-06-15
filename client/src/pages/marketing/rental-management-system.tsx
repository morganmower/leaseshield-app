import { Link, useLocation } from "wouter";
import { CheckCircle2, ArrowRight, Sparkles, Building2, FileText, Search, Receipt, Scale, ShieldCheck, X, ClipboardList, FilePenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SEO } from "@/components/seo";
import { MarketingLayout } from "@/components/marketing/marketing-layout";

export default function RentalManagementSystem() {
  const [, setLocation] = useLocation();

  const features = [
    { icon: Building2, title: "Multi-property management", body: "CRUD properties, attach documents, filter by status - without enterprise overhead." },
    { icon: FileText, title: "State-compliant lease library", body: "Attorney-style templates for 16 states, plus official court forms when you need them." },
    { icon: Search, title: "AI screening helpers", body: "Plain-English decoder for credit, criminal, and eviction reports - Fair Housing built in." },
    { icon: Receipt, title: "Online rent collection", body: "ACH payments, recurring auto-pay, late fees, and a clean rent ledger tied to your lease." },
    { icon: Scale, title: "Compliance guidance", body: "State-specific deposit limits, notice timelines, and disclosure requirements." },
    { icon: ShieldCheck, title: "Legislative monitoring", body: "Approval-gated alerts when state landlord-tenant law changes." },
  ];

  const comparison = [
    { feature: "Built for small landlords (1–50 units)", us: true, them: false },
    { feature: "Flat $10/month - no per-unit pricing", us: true, them: false },
    { feature: "AI screening report decoder", us: true, them: false },
    { feature: "Available nationwide; state-specific forms in 16 states", us: true, them: false },
    { feature: "Official court form overlays", us: true, them: false },
    { feature: "Online rent collection (ACH + auto-pay)", us: true, them: true },
    { feature: "Multi-property management", us: true, them: true },
  ];

  return (
    <MarketingLayout>
      <SEO
        title="Simple Rental Management System for Small Landlords"
        description="Application, screening, decoder, leases, rent collection, and compliance - in one workflow built for small landlords. $10/month, cancel anytime."
        canonical="/rental-management-system"
      />

      <section className="relative pt-12 pb-16 md:pt-20 md:pb-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 via-background to-brand-500/5 pointer-events-none" />
        <div className="container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative text-center">
          <Badge variant="secondary" className="mb-6" data-testid="badge-product"><Sparkles className="h-3.5 w-3.5 mr-1.5" />For independent landlords</Badge>
          <h1 className="font-display text-3xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground leading-tight mb-6" data-testid="text-hero-title">Simple rental management system for landlords</h1>
          <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground mb-4 leading-relaxed max-w-3xl mx-auto" data-testid="text-hero-sub">One simpler system built for independent landlords - application, screening, leases, rent collection, and compliance, all flowing into reliable monthly rent.</p>
          <p className="text-sm sm:text-base text-muted-foreground mb-10 max-w-2xl mx-auto">Most landlords only face these decisions a few times per year. LeaseShield is there when they do.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <Button size="lg" onClick={() => setLocation("/signup")} className="bg-brand-500 hover:bg-brand-600 text-white text-lg px-8 py-4 min-h-[52px]" data-testid="button-get-started">Get started - $10/month</Button>
            <Button size="lg" variant="outline" onClick={() => setLocation("/screening/explain")} className="text-lg px-8 py-4 min-h-[52px]" data-testid="button-try-decoder">Try the screening decoder</Button>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">Cancel anytime • No per-unit fees • 30-day money-back guarantee</p>
        </div>
      </section>

      <section className="py-16 md:py-20 border-t bg-muted/30">
        <div className="container max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="font-display text-2xl md:text-4xl font-bold mb-4" data-testid="text-section-flow">Every step builds toward reliable monthly rent</h2>
            <p className="text-base md:text-lg text-muted-foreground">Application → Screening → Decoder → Lease → Rent. One workflow, no re-keying.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { icon: ClipboardList, label: "Application" },
              { icon: Search, label: "Screening" },
              { icon: Sparkles, label: "Decoder" },
              { icon: FilePenLine, label: "Lease" },
              { icon: Receipt, label: "Rent" },
            ].map((s, i) => (
              <Card key={s.label} className="p-6 text-center" data-testid={`card-flow-step-${i + 1}`}>
                <div className="p-3 bg-primary/10 rounded-md w-fit mx-auto mb-3"><s.icon className="h-6 w-6 text-primary" /></div>
                <div className="font-display text-sm font-semibold">{s.label}</div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20 border-t">
        <div className="container max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="font-display text-2xl md:text-4xl font-bold mb-4" data-testid="text-section-features">Everything in one workflow</h2>
            <p className="text-base md:text-lg text-muted-foreground">Six tools, one subscription, no add-on fees.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {features.map((f) => (
              <Card key={f.title} className="p-6" data-testid={`card-feature-${f.title.toLowerCase().replace(/\s+/g, "-")}`}>
                <div className="p-3 bg-primary/10 rounded-md w-fit mb-4"><f.icon className="h-6 w-6 text-primary" /></div>
                <h3 className="font-display text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20 border-t bg-muted/30">
        <div className="container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="font-display text-2xl md:text-4xl font-bold mb-4" data-testid="text-section-compare">Why small landlords choose LeaseShield</h2>
            <p className="text-base md:text-lg text-muted-foreground">Property management software was built for property managers with hundreds of units. We built LeaseShield for the rest of us.</p>
          </div>
          <Card className="overflow-hidden">
            <div className="grid grid-cols-3 border-b bg-muted/50 px-6 py-4 text-sm font-semibold">
              <div>Feature</div>
              <div className="text-center">LeaseShield</div>
              <div className="text-center">Enterprise tools</div>
            </div>
            {comparison.map((c, i) => (
              <div key={c.feature} className={`grid grid-cols-3 px-6 py-4 text-sm ${i < comparison.length - 1 ? "border-b" : ""}`} data-testid={`row-compare-${i}`}>
                <div>{c.feature}</div>
                <div className="text-center">{c.us ? <CheckCircle2 className="h-5 w-5 text-primary mx-auto" /> : <X className="h-5 w-5 text-muted-foreground mx-auto" />}</div>
                <div className="text-center">{c.them ? <CheckCircle2 className="h-5 w-5 text-primary mx-auto" /> : <X className="h-5 w-5 text-muted-foreground mx-auto" />}</div>
              </div>
            ))}
          </Card>
        </div>
      </section>

      <section className="py-16 md:py-20 border-t">
        <div className="container max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="font-display text-2xl md:text-4xl font-bold mb-4" data-testid="text-section-explore">Explore each tool</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <Link href="/tenant-screening-services" data-testid="link-screening"><Card className="p-6 h-full hover-elevate cursor-pointer"><div className="p-3 bg-primary/10 rounded-md w-fit mb-4"><Search className="h-6 w-6 text-primary" /></div><h3 className="font-display text-lg font-semibold mb-2 flex items-center gap-2">Tenant Screening <ArrowRight className="h-4 w-4" /></h3><p className="text-sm text-muted-foreground leading-relaxed">County-level verification with the decoder built in.</p></Card></Link>
            <Link href="/rent-collection-software" data-testid="link-rent"><Card className="p-6 h-full hover-elevate cursor-pointer"><div className="p-3 bg-primary/10 rounded-md w-fit mb-4"><Receipt className="h-6 w-6 text-primary" /></div><h3 className="font-display text-lg font-semibold mb-2 flex items-center gap-2">Rent Collection <ArrowRight className="h-4 w-4" /></h3><p className="text-sm text-muted-foreground leading-relaxed">ACH payments and recurring auto-pay tied to your lease terms.</p></Card></Link>
            <Link href="/landlord-forms-and-notices" data-testid="link-forms"><Card className="p-6 h-full hover-elevate cursor-pointer"><div className="p-3 bg-primary/10 rounded-md w-fit mb-4"><FileText className="h-6 w-6 text-primary" /></div><h3 className="font-display text-lg font-semibold mb-2 flex items-center gap-2">Forms &amp; Notices <ArrowRight className="h-4 w-4" /></h3><p className="text-sm text-muted-foreground leading-relaxed">State-compliant leases, notices, and adverse action letters.</p></Card></Link>
          </div>
        </div>
      </section>

      <section className="py-20 md:py-24 border-t">
        <div className="container max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4" data-testid="text-final-cta-title">One workflow. One subscription. One protective mentor.</h2>
          <p className="text-base md:text-lg text-muted-foreground mb-8">Stop stitching together five tools to manage three properties.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <Button size="lg" onClick={() => setLocation("/signup")} className="bg-brand-500 hover:bg-brand-600 text-white text-lg px-8 py-4 min-h-[52px]" data-testid="button-final-signup">Get started - $10/month</Button>
            <Button size="lg" variant="outline" onClick={() => setLocation("/contact")} className="text-lg px-8 py-4 min-h-[52px]" data-testid="button-final-contact">Talk to us first</Button>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">Cancel anytime • 30-day money-back guarantee</p>
        </div>
      </section>
    </MarketingLayout>
  );
}
