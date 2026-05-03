import { Link, useLocation } from "wouter";
import {
  Search,
  FileText,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Scale,
  CreditCard,
  Gavel,
  Home,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SEO } from "@/components/seo";
import { MarketingLayout } from "@/components/marketing/marketing-layout";

export default function ScreeningReportDecoder() {
  const [, setLocation] = useLocation();

  const breakdowns = [
    { icon: CreditCard, title: "Credit reports", body: "Translates trade lines, collections, charge-offs, and utilization into plain-English risk signals — without telling you who to deny." },
    { icon: Gavel, title: "Criminal records", body: "Surfaces what each charge actually means, how old it is, and the Fair Housing factors you should weigh before deciding." },
    { icon: Scale, title: "Eviction history", body: "Distinguishes filings, dismissals, and judgments — and flags ambiguous entries that warrant a follow-up question." },
  ];

  const steps = [
    { n: "1", title: "Paste or list the findings", body: "Drop in the report text, or list the flagged items one per line. No file upload required." },
    { n: "2", title: "Get plain-English explanations", body: "Each item comes back with a triaged caution level (high / medium / low) and what it actually means." },
    { n: "3", title: "Decide with confidence", body: "Use the suggested follow-up questions and your written tenant-selection criteria to make a defensible decision." },
  ];

  return (
    <MarketingLayout>
      <SEO
        title="Screening Report Decoder — Plain-English Tenant Screening Explained"
        description="Paste any tenant screening report and get plain-English explanations, risk flags, and Fair Housing guidance. Built for small landlords. $10/month, cancel anytime."
        canonical="/screening-report-decoder"
      />

      <section className="relative pt-12 pb-16 md:pt-20 md:pb-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 via-background to-brand-500/5 pointer-events-none" />
        <div className="container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative text-center">
          <Badge variant="secondary" className="mb-6" data-testid="badge-tool"><Sparkles className="h-3.5 w-3.5 mr-1.5" />AI-powered tool</Badge>
          <h1 className="font-display text-3xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground leading-tight mb-6" data-testid="text-hero-title">Screening Report Decoder</h1>
          <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground mb-4 leading-relaxed max-w-3xl mx-auto" data-testid="text-hero-sub">Paste any tenant screening report and get plain-English explanations, triaged risk flags, and Fair Housing guidance — in seconds.</p>
          <p className="text-sm sm:text-base text-muted-foreground mb-10 max-w-2xl mx-auto">Built for the moments small landlords rarely face but can't afford to get wrong.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <Button size="lg" onClick={() => setLocation("/screening/explain")} className="bg-brand-500 hover:bg-brand-600 text-white text-lg px-8 py-4 min-h-[52px]" data-testid="button-try-decoder"><Search className="mr-2 h-5 w-5" />Try the decoder</Button>
            <Button size="lg" variant="outline" onClick={() => setLocation("/signup")} className="text-lg px-8 py-4 min-h-[52px]" data-testid="button-start-account">Start an account</Button>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">$10/month • Cancel anytime • 30-day money-back guarantee</p>
        </div>
      </section>

      <section className="py-16 md:py-20 border-t">
        <div className="container max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="font-display text-2xl md:text-4xl font-bold mb-4" data-testid="text-section-decodes">What it decodes</h2>
            <p className="text-base md:text-lg text-muted-foreground">Three sections of every screening report, translated into language you can act on.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {breakdowns.map((b) => (
              <Card key={b.title} className="p-6" data-testid={`card-breakdown-${b.title.toLowerCase().replace(/\s+/g, "-")}`}>
                <div className="p-3 bg-primary/10 rounded-md w-fit mb-4"><b.icon className="h-6 w-6 text-primary" /></div>
                <h3 className="font-display text-lg font-semibold mb-2">{b.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{b.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20 border-t bg-muted/30">
        <div className="container max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="font-display text-2xl md:text-4xl font-bold mb-4" data-testid="text-section-how">How it works</h2>
            <p className="text-base md:text-lg text-muted-foreground">No spreadsheets, no legal jargon, no guesswork.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {steps.map((s) => (
              <Card key={s.n} className="p-6" data-testid={`card-step-${s.n}`}>
                <div className="flex items-center justify-center h-10 w-10 rounded-md bg-brand-500 text-white font-display font-bold text-lg mb-4">{s.n}</div>
                <h3 className="font-display text-lg font-semibold mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20 border-t">
        <div className="container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card className="p-8 md:p-10 border-brand-500/30">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-primary/10 rounded-md flex-shrink-0"><ShieldCheck className="h-6 w-6 text-primary" /></div>
              <div>
                <h2 className="font-display text-xl md:text-2xl font-bold mb-3" data-testid="text-compliance-title">FCRA &amp; Fair Housing built in</h2>
                <p className="text-base text-muted-foreground leading-relaxed mb-4">The decoder never tells you whom to approve or deny. It explains what each finding means, surfaces the questions worth asking, and reminds you of the Fair Housing factors that protect you when you do make a call.</p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" /><span>Triaged caution levels (high / medium / low) sorted automatically</span></li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" /><span>"Ask the applicant" follow-up questions you can copy to clipboard</span></li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" /><span>State-aware quick starts based on your preferred state</span></li>
                </ul>
              </div>
            </div>
          </Card>
          <p className="mt-6 text-xs text-muted-foreground text-center max-w-2xl mx-auto">Educational information only — not legal advice. Decisions should follow your written tenant-selection criteria and applicable federal, state, and local fair-housing law.</p>
        </div>
      </section>

      <section className="py-16 md:py-20 border-t bg-muted/30">
        <div className="container max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="font-display text-2xl md:text-4xl font-bold mb-4" data-testid="text-section-related">Goes hand-in-hand with</h2>
            <p className="text-base md:text-lg text-muted-foreground">The decoder is one piece of the workflow. Here's what landlords usually pair it with.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <Link href="/tenant-screening-services" data-testid="link-related-screening"><Card className="p-6 h-full hover-elevate cursor-pointer"><div className="p-3 bg-primary/10 rounded-md w-fit mb-4"><Search className="h-6 w-6 text-primary" /></div><h3 className="font-display text-lg font-semibold mb-2 flex items-center gap-2">Tenant Screening <ArrowRight className="h-4 w-4" /></h3><p className="text-sm text-muted-foreground leading-relaxed">County-level verification that catches what most reports miss.</p></Card></Link>
            <Link href="/landlord-forms-and-notices" data-testid="link-related-forms"><Card className="p-6 h-full hover-elevate cursor-pointer"><div className="p-3 bg-primary/10 rounded-md w-fit mb-4"><Home className="h-6 w-6 text-primary" /></div><h3 className="font-display text-lg font-semibold mb-2 flex items-center gap-2">Forms &amp; Notices <ArrowRight className="h-4 w-4" /></h3><p className="text-sm text-muted-foreground leading-relaxed">Adverse action letters and state-compliant lease templates.</p></Card></Link>
            <Link href="/blog" data-testid="link-related-blog"><Card className="p-6 h-full hover-elevate cursor-pointer"><div className="p-3 bg-primary/10 rounded-md w-fit mb-4"><FileText className="h-6 w-6 text-primary" /></div><h3 className="font-display text-lg font-semibold mb-2 flex items-center gap-2">Landlord blog <ArrowRight className="h-4 w-4" /></h3><p className="text-sm text-muted-foreground leading-relaxed">State-by-state guides on screening, eviction notices, and security deposits.</p></Card></Link>
          </div>
        </div>
      </section>

      <section className="py-20 md:py-24 border-t">
        <div className="container max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4" data-testid="text-final-cta-title">Decode your next screening report in under a minute.</h2>
          <p className="text-base md:text-lg text-muted-foreground mb-8">Most landlords only face these decisions a few times per year. LeaseShield is there when they do.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <Button size="lg" onClick={() => setLocation("/screening/explain")} className="bg-brand-500 hover:bg-brand-600 text-white text-lg px-8 py-4 min-h-[52px]" data-testid="button-final-try"><Search className="mr-2 h-5 w-5" />Try the decoder</Button>
            <Button size="lg" variant="outline" onClick={() => setLocation("/signup")} className="text-lg px-8 py-4 min-h-[52px]" data-testid="button-final-signup">Get started — $10/month</Button>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">Cancel anytime • No per-report fees • 30-day money-back guarantee</p>
        </div>
      </section>
    </MarketingLayout>
  );
}
