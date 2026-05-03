import { Link, useLocation } from "wouter";
import { FileText, Search, Send, CheckCircle2, ArrowRight, Sparkles, Building2, Scale, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SEO } from "@/components/seo";
import { MarketingLayout } from "@/components/marketing/marketing-layout";

export default function RentalApplicationSoftware() {
  const [, setLocation] = useLocation();

  const features = [
    { icon: Send, title: "Auto-default link per property", body: "Every property gets a shareable applicant link the moment you create it. Pause, resume, or download a QR code anytime." },
    { icon: FileText, title: "Document upload built in", body: "Pay stubs, IDs, references - uploaded once and attached to the application. Token-based re-upload links if anything's missing." },
    { icon: Search, title: "Flows straight into screening", body: "Approved-to-screen applicants move into the screening decoder without you re-keying a thing." },
  ];

  const steps = [
    { n: "1", title: "Share the link", body: "Send the auto-generated applicant link, or post the QR code on your listing." },
    { n: "2", title: "Get notified", body: "Email lands the moment an application comes in - with a link straight to the inbox." },
    { n: "3", title: "Decide and document", body: "Run screening, review the decoder, and send an adverse action letter if needed." },
  ];

  return (
    <MarketingLayout>
      <SEO
        title="Rental Application Software for Small Landlords"
        description="Online rental applications with auto-generated links per property, document upload, and a direct path into screening and the decoder. $10/month, cancel anytime."
        canonical="/rental-application-software"
      />

      <section className="relative pt-12 pb-16 md:pt-20 md:pb-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 via-background to-brand-500/5 pointer-events-none" />
        <div className="container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative text-center">
          <Badge variant="secondary" className="mb-6" data-testid="badge-product"><Sparkles className="h-3.5 w-3.5 mr-1.5" />Online applications</Badge>
          <h1 className="font-display text-3xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground leading-tight mb-6" data-testid="text-hero-title">Rental Application Software</h1>
          <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground mb-4 leading-relaxed max-w-3xl mx-auto" data-testid="text-hero-sub">Applications that flow directly into screening, the decoder, and your decision - without spreadsheets, PDFs, or re-keying.</p>
          <p className="text-sm sm:text-base text-muted-foreground mb-10 max-w-2xl mx-auto">Auto-generated link per property. QR code download. Per-link analytics.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <Button size="lg" onClick={() => setLocation("/signup")} className="bg-brand-500 hover:bg-brand-600 text-white text-lg px-8 py-4 min-h-[52px]" data-testid="button-get-started">Get started - $10/month</Button>
            <Button size="lg" variant="outline" onClick={() => setLocation("/screening/explain")} className="text-lg px-8 py-4 min-h-[52px]" data-testid="button-decoder">See the decoder</Button>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">Cancel anytime • 30-day money-back guarantee</p>
        </div>
      </section>

      <section className="py-16 md:py-20 border-t">
        <div className="container max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="font-display text-2xl md:text-4xl font-bold mb-4" data-testid="text-section-features">What you get</h2>
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
        <div className="container max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="font-display text-2xl md:text-4xl font-bold mb-4" data-testid="text-section-how">How it works</h2>
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
        <div className="container max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="font-display text-2xl md:text-4xl font-bold mb-4" data-testid="text-section-related">Pair it with</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <Link href="/tenant-screening-services" data-testid="link-screening"><Card className="p-6 h-full hover-elevate cursor-pointer"><div className="p-3 bg-primary/10 rounded-md w-fit mb-4"><Search className="h-6 w-6 text-primary" /></div><h3 className="font-display text-lg font-semibold mb-2 flex items-center gap-2">Tenant Screening <ArrowRight className="h-4 w-4" /></h3><p className="text-sm text-muted-foreground leading-relaxed">Background checks with county-level verification.</p></Card></Link>
            <Link href="/screening-report-decoder" data-testid="link-decoder"><Card className="p-6 h-full hover-elevate cursor-pointer"><div className="p-3 bg-primary/10 rounded-md w-fit mb-4"><Sparkles className="h-6 w-6 text-primary" /></div><h3 className="font-display text-lg font-semibold mb-2 flex items-center gap-2">Screening Decoder <ArrowRight className="h-4 w-4" /></h3><p className="text-sm text-muted-foreground leading-relaxed">Plain-English explanations of every finding.</p></Card></Link>
            <Link href="/rent-collection-software" data-testid="link-rent"><Card className="p-6 h-full hover-elevate cursor-pointer"><div className="p-3 bg-primary/10 rounded-md w-fit mb-4"><Receipt className="h-6 w-6 text-primary" /></div><h3 className="font-display text-lg font-semibold mb-2 flex items-center gap-2">Rent Collection <ArrowRight className="h-4 w-4" /></h3><p className="text-sm text-muted-foreground leading-relaxed">ACH payments and recurring auto-pay tied to your lease.</p></Card></Link>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20 border-t bg-muted/30">
        <div className="container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="font-display text-2xl md:text-4xl font-bold mb-4" data-testid="text-section-faq">Frequently asked</h2>
            <p className="text-base md:text-lg text-muted-foreground">How LeaseShield handles applications, fees, and what tenants see on the other side.</p>
          </div>
          <div className="space-y-4">
            <Card className="p-6" data-testid="card-faq-0"><h3 className="font-display text-base md:text-lg font-semibold mb-2">Is there a per-application fee from LeaseShield?</h3><p className="text-sm md:text-base text-muted-foreground leading-relaxed">No. Applications are unlimited at the $10/month subscription. The only per-application charge is the screening fee, and that only applies if you choose to run a paid background check.</p></Card>
            <Card className="p-6" data-testid="card-faq-1"><h3 className="font-display text-base md:text-lg font-semibold mb-2">Can applicants pay an application fee through LeaseShield?</h3><p className="text-sm md:text-base text-muted-foreground leading-relaxed">Yes - the screening fee can be passed to the applicant at the time of application. They pay once, securely, and the fee covers the report you receive inside LeaseShield.</p></Card>
            <Card className="p-6" data-testid="card-faq-2"><h3 className="font-display text-base md:text-lg font-semibold mb-2">Do applicants need to create an account?</h3><p className="text-sm md:text-base text-muted-foreground leading-relaxed">No. Applicants fill out the application from the link or QR code you share - no account, no password. They can come back with a token-based link if you ask for an extra document.</p></Card>
            <Card className="p-6" data-testid="card-faq-3"><h3 className="font-display text-base md:text-lg font-semibold mb-2">Can I require specific documents like pay stubs or photo ID?</h3><p className="text-sm md:text-base text-muted-foreground leading-relaxed">Yes. The application supports document upload for pay stubs, photo ID, references, and any custom file you ask for. If something&rsquo;s missing after submission, send a token-based re-upload link from inside LeaseShield.</p></Card>
            <Card className="p-6" data-testid="card-faq-4"><h3 className="font-display text-base md:text-lg font-semibold mb-2">What happens after an application is submitted?</h3><p className="text-sm md:text-base text-muted-foreground leading-relaxed">You get an email notification with a direct link. From the application you can run screening, decode the report, and - if you decide to deny - generate the adverse action letter, all in the same workflow.</p></Card>
            <Card className="p-6" data-testid="card-faq-5"><h3 className="font-display text-base md:text-lg font-semibold mb-2">Is the application form different per state?</h3><p className="text-sm md:text-base text-muted-foreground leading-relaxed">The core application is consistent across the 16 supported states. State-specific disclosures and requirements show up at the lease and notice stage, where the law actually differs.</p></Card>
          </div>
        </div>
      </section>

      <section className="py-20 md:py-24 border-t">
        <div className="container max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4" data-testid="text-final-cta-title">Take applications the modern way.</h2>
          <p className="text-base md:text-lg text-muted-foreground mb-8">No more PDF emails. No more re-keying.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <Button size="lg" onClick={() => setLocation("/signup")} className="bg-brand-500 hover:bg-brand-600 text-white text-lg px-8 py-4 min-h-[52px]" data-testid="button-final-signup">Get started - $10/month</Button>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">Cancel anytime • 30-day money-back guarantee</p>
        </div>
      </section>
    </MarketingLayout>
  );
}
