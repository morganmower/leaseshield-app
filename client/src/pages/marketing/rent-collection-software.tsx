import { Link, useLocation } from "wouter";
import { Receipt, Banknote, Repeat, CheckCircle2, ArrowRight, Sparkles, FileText, Search, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SEO } from "@/components/seo";
import { MarketingLayout } from "@/components/marketing/marketing-layout";

export default function RentCollectionSoftware() {
  const [, setLocation] = useLocation();

  const features = [
    { icon: Banknote, title: "ACH payments", body: "NACHA-compliant ACH debits direct from the tenant's bank — no card fees eating your margin." },
    { icon: Repeat, title: "Recurring auto-pay", body: "Tenants enroll once, rent collects itself every month, and you stop chasing payments." },
    { icon: Receipt, title: "Rent ledger + late fees", body: "A clean ledger per lease, automatic late-fee handling, and exportable history when tax season comes." },
  ];

  return (
    <MarketingLayout>
      <SEO
        title="Online Rent Collection Software for Landlords"
        description="ACH rent collection with recurring auto-pay, tied to your lease terms. Clean rent ledger, late fee automation, and export-ready history. $10/month, cancel anytime."
        canonical="/rent-collection-software"
      />

      <section className="relative pt-12 pb-16 md:pt-20 md:pb-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 via-background to-brand-500/5 pointer-events-none" />
        <div className="container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative text-center">
          <Badge variant="secondary" className="mb-6" data-testid="badge-product"><Sparkles className="h-3.5 w-3.5 mr-1.5" />ACH + auto-pay</Badge>
          <h1 className="font-display text-3xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground leading-tight mb-6" data-testid="text-hero-title">Online Rent Collection Software for Landlords</h1>
          <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground mb-4 leading-relaxed max-w-3xl mx-auto" data-testid="text-hero-sub">ACH payments tied to your lease, recurring auto-pay so you stop chasing rent, and a clean ledger you can hand to your accountant.</p>
          <p className="text-sm sm:text-base text-muted-foreground mb-10 max-w-2xl mx-auto">Tenant-paid service fee. No card-processing fees on your end.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <Button size="lg" onClick={() => setLocation("/signup")} className="bg-brand-500 hover:bg-brand-600 text-white text-lg px-8 py-4 min-h-[52px]" data-testid="button-get-started">Get started — $10/month</Button>
            <Button size="lg" variant="outline" onClick={() => setLocation("/rental-management-system")} className="text-lg px-8 py-4 min-h-[52px]" data-testid="button-tour">See the full system</Button>
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
        <div className="container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card className="p-8 md:p-10 border-brand-500/30">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-primary/10 rounded-md flex-shrink-0"><Scale className="h-6 w-6 text-primary" /></div>
              <div>
                <h2 className="font-display text-xl md:text-2xl font-bold mb-3" data-testid="text-tied-title">Tied to your lease — not a separate spreadsheet</h2>
                <p className="text-base text-muted-foreground leading-relaxed mb-4">Every payment is tied to a lease, a unit, and a tenant. When rent terms change, the ledger updates. When a late fee triggers, it follows the rules in your lease — not a generic default.</p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" /><span>Requests / History / Recurring / Export tabs for clean separation</span></li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" /><span>Per-unit security deposit overrides when you need them</span></li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" /><span>Token-based tenant payment links — no tenant account required</span></li>
                </ul>
              </div>
            </div>
          </Card>
        </div>
      </section>

      <section className="py-16 md:py-20 border-t">
        <div className="container max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="font-display text-2xl md:text-4xl font-bold mb-4" data-testid="text-section-related">Works with</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <Link href="/landlord-forms-and-notices" data-testid="link-forms"><Card className="p-6 h-full hover-elevate cursor-pointer"><div className="p-3 bg-primary/10 rounded-md w-fit mb-4"><FileText className="h-6 w-6 text-primary" /></div><h3 className="font-display text-lg font-semibold mb-2 flex items-center gap-2">Forms &amp; Notices <ArrowRight className="h-4 w-4" /></h3><p className="text-sm text-muted-foreground leading-relaxed">Late notices and pay-or-quit forms when rent collection breaks down.</p></Card></Link>
            <Link href="/rental-management-system" data-testid="link-system"><Card className="p-6 h-full hover-elevate cursor-pointer"><div className="p-3 bg-primary/10 rounded-md w-fit mb-4"><Sparkles className="h-6 w-6 text-primary" /></div><h3 className="font-display text-lg font-semibold mb-2 flex items-center gap-2">Full System <ArrowRight className="h-4 w-4" /></h3><p className="text-sm text-muted-foreground leading-relaxed">Application → Screening → Lease → Rent Collection in one workflow.</p></Card></Link>
            <Link href="/tenant-screening-services" data-testid="link-screening"><Card className="p-6 h-full hover-elevate cursor-pointer"><div className="p-3 bg-primary/10 rounded-md w-fit mb-4"><Search className="h-6 w-6 text-primary" /></div><h3 className="font-display text-lg font-semibold mb-2 flex items-center gap-2">Tenant Screening <ArrowRight className="h-4 w-4" /></h3><p className="text-sm text-muted-foreground leading-relaxed">Pick tenants who actually pay before they sign.</p></Card></Link>
          </div>
        </div>
      </section>

      <section className="py-20 md:py-24 border-t">
        <div className="container max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4" data-testid="text-final-cta-title">Stop chasing rent. Start collecting it.</h2>
          <p className="text-base md:text-lg text-muted-foreground mb-8">Set it up once, let auto-pay do the rest.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <Button size="lg" onClick={() => setLocation("/signup")} className="bg-brand-500 hover:bg-brand-600 text-white text-lg px-8 py-4 min-h-[52px]" data-testid="button-final-signup">Get started — $10/month</Button>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">Cancel anytime • 30-day money-back guarantee</p>
        </div>
      </section>
    </MarketingLayout>
  );
}
