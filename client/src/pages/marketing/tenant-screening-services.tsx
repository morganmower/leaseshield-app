import { Link, useLocation } from "wouter";
import { Search, MapPin, AlertTriangle, CheckCircle2, ArrowRight, Sparkles, ShieldCheck, FileText, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SEO } from "@/components/seo";
import { MarketingLayout } from "@/components/marketing/marketing-layout";

export default function TenantScreeningServices() {
  const [, setLocation] = useLocation();

  const reasons = [
    { icon: MapPin, title: "County-level verification", body: "National database checks miss county records. Real screening pulls the courts where the applicant actually lived." },
    { icon: Search, title: "Real eviction history", body: "Most reports surface filings without context. Ours distinguish dismissals, judgments, and active cases." },
    { icon: AlertTriangle, title: "What the report doesn't say", body: "The decoder explains gaps and ambiguous entries — and tells you the follow-up questions worth asking." },
  ];

  return (
    <MarketingLayout>
      <SEO
        title="Tenant Screening Services for Small Landlords"
        description="Deeper background checks with county-level verification, plus an AI decoder that explains every finding in plain English. $10/month, cancel anytime."
        canonical="/tenant-screening-services"
      />

      <section className="relative pt-12 pb-16 md:pt-20 md:pb-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 via-background to-brand-500/5 pointer-events-none" />
        <div className="container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative text-center">
          <Badge variant="secondary" className="mb-6" data-testid="badge-product"><Sparkles className="h-3.5 w-3.5 mr-1.5" />Built-in to LeaseShield</Badge>
          <h1 className="font-display text-3xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground leading-tight mb-6" data-testid="text-hero-title">Tenant Screening Services for Landlords</h1>
          <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground mb-4 leading-relaxed max-w-3xl mx-auto" data-testid="text-hero-sub">Most background checks are incomplete. Ours surface what the cheap reports miss — and our AI decoder explains every finding in plain English.</p>
          <p className="text-sm sm:text-base text-muted-foreground mb-10 max-w-2xl mx-auto">No surprises after move-in. No FCRA missteps before it.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <Button size="lg" onClick={() => setLocation("/screening/explain")} className="bg-brand-500 hover:bg-brand-600 text-white text-lg px-8 py-4 min-h-[52px]" data-testid="button-try-decoder"><Search className="mr-2 h-5 w-5" />Try the decoder</Button>
            <Button size="lg" variant="outline" onClick={() => setLocation("/signup")} className="text-lg px-8 py-4 min-h-[52px]" data-testid="button-signup">Get started — $10/month</Button>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">Cancel anytime • 30-day money-back guarantee</p>
        </div>
      </section>

      <section className="py-16 md:py-20 border-t">
        <div className="container max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="font-display text-2xl md:text-4xl font-bold mb-4" data-testid="text-section-why">Why most screening misses records</h2>
            <p className="text-base md:text-lg text-muted-foreground">A clean report doesn't always mean a clean record.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {reasons.map((r) => (
              <Card key={r.title} className="p-6" data-testid={`card-reason-${r.title.toLowerCase().replace(/\s+/g, "-")}`}>
                <div className="p-3 bg-primary/10 rounded-md w-fit mb-4"><r.icon className="h-6 w-6 text-primary" /></div>
                <h3 className="font-display text-lg font-semibold mb-2">{r.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{r.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20 border-t bg-muted/30">
        <div className="container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card className="p-8 md:p-10 border-brand-500/30">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-primary/10 rounded-md flex-shrink-0"><ShieldCheck className="h-6 w-6 text-primary" /></div>
              <div>
                <h2 className="font-display text-xl md:text-2xl font-bold mb-3" data-testid="text-flow-title">Application → Screening → Decoder → Decision</h2>
                <p className="text-base text-muted-foreground leading-relaxed mb-4">Applications you collect through LeaseShield flow straight into screening, and every finding lands in the decoder before you decide. No PDFs to email around. No re-keying.</p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" /><span>Auto-default applicant link per property — every property gets a shareable link</span></li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" /><span>Pause/resume the link, download a QR code, see per-link analytics</span></li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" /><span>Adverse action letters generated when you need them</span></li>
                </ul>
              </div>
            </div>
          </Card>
          <p className="mt-6 text-xs text-muted-foreground text-center max-w-2xl mx-auto">Screening services provided through Western Verify LLC. Educational information only — not legal advice.</p>
        </div>
      </section>

      <section className="py-16 md:py-20 border-t">
        <div className="container max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="font-display text-2xl md:text-4xl font-bold mb-4" data-testid="text-section-related">Pair it with</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <Link href="/screening-report-decoder" data-testid="link-decoder"><Card className="p-6 h-full hover-elevate cursor-pointer"><div className="p-3 bg-primary/10 rounded-md w-fit mb-4"><Sparkles className="h-6 w-6 text-primary" /></div><h3 className="font-display text-lg font-semibold mb-2 flex items-center gap-2">Screening Decoder <ArrowRight className="h-4 w-4" /></h3><p className="text-sm text-muted-foreground leading-relaxed">Plain-English explanations and FCRA-aware risk flags.</p></Card></Link>
            <Link href="/rental-application-software" data-testid="link-applications"><Card className="p-6 h-full hover-elevate cursor-pointer"><div className="p-3 bg-primary/10 rounded-md w-fit mb-4"><FileText className="h-6 w-6 text-primary" /></div><h3 className="font-display text-lg font-semibold mb-2 flex items-center gap-2">Applications <ArrowRight className="h-4 w-4" /></h3><p className="text-sm text-muted-foreground leading-relaxed">Online rental applications that flow straight into screening.</p></Card></Link>
            <Link href="/landlord-forms-and-notices" data-testid="link-forms"><Card className="p-6 h-full hover-elevate cursor-pointer"><div className="p-3 bg-primary/10 rounded-md w-fit mb-4"><Scale className="h-6 w-6 text-primary" /></div><h3 className="font-display text-lg font-semibold mb-2 flex items-center gap-2">Forms &amp; Notices <ArrowRight className="h-4 w-4" /></h3><p className="text-sm text-muted-foreground leading-relaxed">Adverse action letters and state-compliant lease templates.</p></Card></Link>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20 border-t bg-muted/30">
        <div className="container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="font-display text-2xl md:text-4xl font-bold mb-4" data-testid="text-section-faq">Frequently asked</h2>
            <p className="text-base md:text-lg text-muted-foreground">What landlords want to know before running their first screening through LeaseShield.</p>
          </div>
          <div className="space-y-4">
            <Card className="p-6" data-testid="card-faq-0"><h3 className="font-display text-base md:text-lg font-semibold mb-2">How long does a tenant background check take?</h3><p className="text-sm md:text-base text-muted-foreground leading-relaxed">Credit and national criminal results typically come back in minutes. County-level criminal and eviction searches can take a few hours up to a business day depending on the courts involved. You&rsquo;ll see the report inside LeaseShield as soon as it&rsquo;s ready.</p></Card>
            <Card className="p-6" data-testid="card-faq-1"><h3 className="font-display text-base md:text-lg font-semibold mb-2">Who pays for the screening — me or the applicant?</h3><p className="text-sm md:text-base text-muted-foreground leading-relaxed">You choose. Most landlords pass the screening fee to the applicant as part of the application; some absorb it as a cost of finding good tenants. LeaseShield supports either flow.</p></Card>
            <Card className="p-6" data-testid="card-faq-2"><h3 className="font-display text-base md:text-lg font-semibold mb-2">What&rsquo;s included in a full tenant screening?</h3><p className="text-sm md:text-base text-muted-foreground leading-relaxed">Credit report and score, national and county criminal records, eviction history, sex offender registry, and SSN/identity verification. Applicants authorize the pull through a secure consent flow before any record is requested.</p></Card>
            <Card className="p-6" data-testid="card-faq-3"><h3 className="font-display text-base md:text-lg font-semibold mb-2">Why do county-level checks matter if there&rsquo;s a national database?</h3><p className="text-sm md:text-base text-muted-foreground leading-relaxed">National criminal databases are aggregated and incomplete — many counties don&rsquo;t feed in. Pulling the actual courts where the applicant has lived in the last 7 years is the only way to be confident a report is real, not just clean by omission.</p></Card>
            <Card className="p-6" data-testid="card-faq-4"><h3 className="font-display text-base md:text-lg font-semibold mb-2">Do I need an application before I can run a screening?</h3><p className="text-sm md:text-base text-muted-foreground leading-relaxed">For FCRA compliance you need the applicant&rsquo;s written consent to pull their credit and background. The cleanest way is to use the LeaseShield application — consent is captured automatically and the data flows into screening without re-keying.</p></Card>
            <Card className="p-6" data-testid="card-faq-5"><h3 className="font-display text-base md:text-lg font-semibold mb-2">If I deny based on the report, do I have to send anything?</h3><p className="text-sm md:text-base text-muted-foreground leading-relaxed">Yes — FCRA requires an adverse action notice to the applicant explaining the basis and naming the reporting agency. LeaseShield generates a compliant adverse action letter directly from the screening decision.</p></Card>
          </div>
        </div>
      </section>

      <section className="py-20 md:py-24 border-t">
        <div className="container max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4" data-testid="text-final-cta-title">Run a screening you can actually trust.</h2>
          <p className="text-base md:text-lg text-muted-foreground mb-8">One subscription. No per-report surprises.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <Button size="lg" onClick={() => setLocation("/signup")} className="bg-brand-500 hover:bg-brand-600 text-white text-lg px-8 py-4 min-h-[52px]" data-testid="button-final-signup">Get started — $10/month</Button>
            <Button size="lg" variant="outline" onClick={() => setLocation("/screening/explain")} className="text-lg px-8 py-4 min-h-[52px]" data-testid="button-final-decoder">Try the decoder first</Button>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">Cancel anytime • 30-day money-back guarantee</p>
        </div>
      </section>
    </MarketingLayout>
  );
}
