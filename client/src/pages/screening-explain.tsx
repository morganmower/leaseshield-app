import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CreditCard, Scale } from "lucide-react";
import { Link } from "wouter";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

export default function ScreeningExplain() {
  return (
    <div className="min-h-screen bg-background">
      {/* Simple Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex items-center justify-between max-w-4xl mx-auto px-4 py-4">
          <Link to="/" className="flex items-center hover:opacity-80 transition-opacity" data-testid="link-home">
            <Logo variant="horizontal" size="md" />
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="container max-w-2xl mx-auto px-4 py-12 md:py-16">
        <div className="text-center mb-10">
          <p className="text-sm text-muted-foreground mb-3">
            You're reviewing this report in plain English.
          </p>
          <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-semibold text-foreground mb-4">
            Explain a Screening Report
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground">
            What would you like help understanding?
          </p>
        </div>

        {/* Two report options */}
        <div className="space-y-4">
          <Card 
            className="p-6 cursor-pointer transition-all hover:border-primary/50 hover:shadow-lg"
            onClick={() => window.location.href = "/screening#credit-helper"}
            data-testid="button-credit-report"
          >
            <div className="flex items-center gap-4">
              <div className="rounded-xl bg-blue-100 dark:bg-blue-950/30 p-4 flex-shrink-0">
                <CreditCard className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg text-foreground mb-1">Credit Report</h3>
                <p className="text-sm text-muted-foreground">
                  Understand credit scores, payment history, and debt levels
                </p>
              </div>
            </div>
          </Card>

          <Card 
            className="p-6 cursor-pointer transition-all hover:border-primary/50 hover:shadow-lg"
            onClick={() => window.location.href = "/screening#criminal-helper"}
            data-testid="button-criminal-eviction-report"
          >
            <div className="flex items-center gap-4">
              <div className="rounded-xl bg-amber-100 dark:bg-amber-950/30 p-4 flex-shrink-0">
                <Scale className="h-8 w-8 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg text-foreground mb-1">Criminal & Eviction Report</h3>
                <p className="text-sm text-muted-foreground">
                  Interpret criminal records and eviction history with Fair Housing compliance
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Hint */}
        <p className="text-center text-sm text-muted-foreground mt-6">
          Most landlords start with the credit report they just ran.
        </p>

        {/* Back link */}
        <div className="mt-10 text-center">
          <Link 
            to="/" 
            className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
            data-testid="link-back-home"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to LeaseShield
          </Link>
        </div>
      </main>
    </div>
  );
}
