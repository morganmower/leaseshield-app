import { Link, useLocation } from "wouter";
import { FileText, Scale, Gavel, CheckCircle2, ArrowRight, Sparkles, MapPin, Search, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SEO } from "@/components/seo";
import { MarketingLayout } from "@/components/marketing/marketing-layout";

export default function LandlordFormsAndNotices() {
  const [, setLocation] = useLocation();

  const categories = [
    { icon: FileText, title: "Lease agreements", body: "Residential leases tailored to each of the 16 supported states - with the disclosures and clauses that state actually requires." },
    { icon: Gavel, title: "Eviction notices", body: "Pay-or-quit, cure-or-quit, and termination notices with the right notice periods and service requirements per state." },
    { icon: Scale, title: "Adverse action letters", body: "FCRA-compliant denial letters generated from your screening decision - with the notice the law requires." },
  ];

  const states = [
    "Utah", "Texas", "North Dakota", "South Dakota", "North Carolina", "Ohio",
    "Michigan", "Idaho", "Wyoming", "California", "Virginia", "Nevada",
    "Arizona", "Florida", "Illinois", "New Mexico",
  ];

  return (
    <MarketingLayout>
      <SEO
        title="State-Compliant Landlord Forms & Notices"
        description="Attorney-style lease templates, eviction notices, and adverse action letters tailored to 16 US states - plus official court form overlays. $10/month, cancel anytime."
        canonical="/landlord-forms-and-notices"
      />

      <section className="relative pt-12 pb-16 md:pt-20 md:pb-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 via-background to-brand-500/5 pointer-events-none" />
        <div className="container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative text-center">
          <Badge variant="secondary" className="mb-6" data-testid="badge-product"><Sparkles className="h-3.5 w-3.5 mr-1.5" />16 states covered</Badge>
          <h1 className="font-display text-3xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground leading-tight mb-6" data-testid="text-hero-title">Landlord Legal Forms &amp; Notices</h1>
          <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground mb-4 leading-relaxed max-w-3xl mx-auto" data-testid="text-hero-sub">Attorney-style leases, state-specific eviction notices, and adverse action letters - generated from your data, not a fillable PDF you found on Google.</p>
          <p className="text-sm sm:text-base text-muted-foreground mb-10 max-w-2xl mx-auto">Plus official court form overlays for the moments where the form has to be the real one.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <Button size="lg" onClick={() => setLocation("/signup")} className="bg-brand-500 hover:bg-brand-600 text-white text-lg px-8 py-4 min-h-[52px]" data-testid="button-get-started">Get started - $10/month</Button>
            <Button size="lg" variant="outline" onClick={() => setLocation("/blog")} className="text-lg px-8 py-4 min-h-[52px]" data-testid="button-blog">Read the state-by-state guides</Button>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">Cancel anytime • 30-day money-back guarantee</p>
        </div>
      </section>

      <section className="py-16 md:py-20 border-t">
        <div className="container max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="font-display text-2xl md:text-4xl font-bold mb-4" data-testid="text-section-categories">What's in the library</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {categories.map((c) => (
              <Card key={c.title} className="p-6" data-testid={`card-category-${c.title.toLowerCase().replace(/\s+/g, "-")}`}>
                <div className="p-3 bg-primary/10 rounded-md w-fit mb-4"><c.icon className="h-6 w-6 text-primary" /></div>
                <h3 className="font-display text-lg font-semibold mb-2">{c.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{c.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20 border-t bg-muted/30">
        <div className="container max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="font-display text-2xl md:text-4xl font-bold mb-4" data-testid="text-section-states">Templates for every supported state</h2>
            <p className="text-base md:text-lg text-muted-foreground">Each form is built around the actual statutory requirements of the state - not a generic national template.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {states.map((s) => (
              <Card key={s} className="p-4 flex items-center gap-2" data-testid={`card-state-${s.toLowerCase().replace(/\s+/g, "-")}`}>
                <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
                <span className="text-sm font-medium">{s}</span>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20 border-t">
        <div className="container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card className="p-8 md:p-10 border-brand-500/30">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-primary/10 rounded-md flex-shrink-0"><Scale className="h-6 w-6 text-primary" /></div>
              <div>
                <h2 className="font-display text-xl md:text-2xl font-bold mb-3" data-testid="text-overlay-title">Official court form overlays</h2>
                <p className="text-base text-muted-foreground leading-relaxed mb-4">For evictions and disputes, courts often require their exact form - no substitutions. We overlay your data onto the real official PDF, so what you submit is the form the clerk expects.</p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" /><span>Routes deterministically based on output template - no AI guessing</span></li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" /><span>Versioned templates with admin approval before publishing</span></li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" /><span>DOCX exports when you need to edit before filing</span></li>
                </ul>
              </div>
            </div>
          </Card>
          <p className="mt-6 text-xs text-muted-foreground text-center max-w-2xl mx-auto">Educational information only - not legal advice. Final documents should be reviewed by a licensed attorney in your state.</p>
        </div>
      </section>

      <section className="py-16 md:py-20 border-t bg-muted/30">
        <div className="container max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="font-display text-2xl md:text-4xl font-bold mb-4" data-testid="text-section-related">Works with</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <Link href="/tenant-screening-services" data-testid="link-screening"><Card className="p-6 h-full hover-elevate cursor-pointer"><div className="p-3 bg-primary/10 rounded-md w-fit mb-4"><Search className="h-6 w-6 text-primary" /></div><h3 className="font-display text-lg font-semibold mb-2 flex items-center gap-2">Tenant Screening <ArrowRight className="h-4 w-4" /></h3><p className="text-sm text-muted-foreground leading-relaxed">Adverse action letters generated from your screening decision.</p></Card></Link>
            <Link href="/rent-collection-software" data-testid="link-rent"><Card className="p-6 h-full hover-elevate cursor-pointer"><div className="p-3 bg-primary/10 rounded-md w-fit mb-4"><Receipt className="h-6 w-6 text-primary" /></div><h3 className="font-display text-lg font-semibold mb-2 flex items-center gap-2">Rent Collection <ArrowRight className="h-4 w-4" /></h3><p className="text-sm text-muted-foreground leading-relaxed">Late notices when rent collection breaks down.</p></Card></Link>
            <Link href="/blog" data-testid="link-blog"><Card className="p-6 h-full hover-elevate cursor-pointer"><div className="p-3 bg-primary/10 rounded-md w-fit mb-4"><FileText className="h-6 w-6 text-primary" /></div><h3 className="font-display text-lg font-semibold mb-2 flex items-center gap-2">State-by-State Blog <ArrowRight className="h-4 w-4" /></h3><p className="text-sm text-muted-foreground leading-relaxed">Plain-English guides on notices, deposits, and evictions in each state.</p></Card></Link>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20 border-t">
        <div className="container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="font-display text-2xl md:text-4xl font-bold mb-4" data-testid="text-section-faq">Frequently asked</h2>
            <p className="text-base md:text-lg text-muted-foreground">What landlords ask before they trust a template with a real lease or eviction.</p>
          </div>
          <div className="space-y-4">
            <Card className="p-6" data-testid="card-faq-0"><h3 className="font-display text-base md:text-lg font-semibold mb-2">Are these lease and notice templates actually state-compliant?</h3><p className="text-sm md:text-base text-muted-foreground leading-relaxed">Each template is built around the actual statutory requirements of the state - required disclosures, notice periods, service rules, and lease clauses. Templates are versioned and admin-reviewed before publishing, so you&rsquo;re always working from the current version. As always, a licensed attorney in your state should review final documents.</p></Card>
            <Card className="p-6" data-testid="card-faq-1"><h3 className="font-display text-base md:text-lg font-semibold mb-2">Can I edit a template after generating it?</h3><p className="text-sm md:text-base text-muted-foreground leading-relaxed">Yes. Lease and notice templates can be exported as DOCX so you can adjust language, add custom clauses, or insert addenda. Court forms that require an exact format (see below) are exported as PDF to preserve the official layout.</p></Card>
            <Card className="p-6" data-testid="card-faq-2"><h3 className="font-display text-base md:text-lg font-semibold mb-2">Do you support official court eviction forms?</h3><p className="text-sm md:text-base text-muted-foreground leading-relaxed">Yes. For evictions and disputes where courts require their exact form, LeaseShield overlays your data onto the real official PDF. Routing is deterministic - the system uses the right form based on jurisdiction and notice type, not a guess.</p></Card>
            <Card className="p-6" data-testid="card-faq-3"><h3 className="font-display text-base md:text-lg font-semibold mb-2">Is this a substitute for an attorney?</h3><p className="text-sm md:text-base text-muted-foreground leading-relaxed">No. Templates are a strong starting point and reflect what the law requires, but every situation is different. For evictions, fair housing complaints, or any contested matter, retain a licensed attorney in your state.</p></Card>
            <Card className="p-6" data-testid="card-faq-4"><h3 className="font-display text-base md:text-lg font-semibold mb-2">What states are covered?</h3><p className="text-sm md:text-base text-muted-foreground leading-relaxed">16 states today: Utah, Texas, North Dakota, South Dakota, North Carolina, Ohio, Michigan, Idaho, Wyoming, California, Virginia, Nevada, Arizona, Florida, Illinois, and New Mexico. Each gets its own state-specific lease, notices, and disclosures.</p></Card>
            <Card className="p-6" data-testid="card-faq-5"><h3 className="font-display text-base md:text-lg font-semibold mb-2">Can I save filled-in forms for re-use across properties?</h3><p className="text-sm md:text-base text-muted-foreground leading-relaxed">Yes. Forms generated against a property carry over the property and unit data, so re-issuing a similar notice (rent increase, late notice, lease renewal) is a few clicks instead of starting from scratch.</p></Card>
          </div>
        </div>
      </section>

      <section className="py-20 md:py-24 border-t">
        <div className="container max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4" data-testid="text-final-cta-title">Use the right form. Avoid the rework.</h2>
          <p className="text-base md:text-lg text-muted-foreground mb-8">State-specific. Court-ready. Generated from your data.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <Button size="lg" onClick={() => setLocation("/signup")} className="bg-brand-500 hover:bg-brand-600 text-white text-lg px-8 py-4 min-h-[52px]" data-testid="button-final-signup">Get started - $10/month</Button>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">Cancel anytime • 30-day money-back guarantee</p>
        </div>
      </section>
    </MarketingLayout>
  );
}
