import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { LogoOption1, LogoOption2, LogoOption3, LogoOption4, LogoOption5 } from "@/components/logo-options";

export default function LogoPicker() {
  const logos = [
    {
      id: 1,
      name: "House + Shield with Glow",
      description: "Current design - overlapping icons with gradient and glow effect",
      component: LogoOption1,
    },
    {
      id: 2,
      name: "House Inside Shield",
      description: "Integrated design - home protected within the shield",
      component: LogoOption2,
    },
    {
      id: 3,
      name: "Document + Shield",
      description: "Lease protection focus - document with shield badge",
      component: LogoOption3,
    },
    {
      id: 4,
      name: "Shield with Key",
      description: "Security emphasis - key symbol within shield",
      component: LogoOption4,
    },
    {
      id: 5,
      name: "Bold Geometric Shield",
      description: "Modern and bold - filled shield with house icon and pulse effect",
      component: LogoOption5,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="font-display text-xl font-semibold text-foreground">
            Choose Your Logo
          </h1>
          <Button
            variant="ghost"
            onClick={() => window.location.href = "/"}
            data-testid="button-back-home"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </div>
      </header>

      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h2 className="text-2xl font-display font-semibold text-foreground mb-2">
            Logo Options
          </h2>
          <p className="text-muted-foreground">
            Select the logo design that best represents LeaseShield App
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {logos.map((logo) => {
            const LogoComponent = logo.component;
            return (
              <Card key={logo.id} className="p-8 hover-elevate transition-all">
                <div className="flex flex-col items-center text-center">
                  <div className="mb-6 flex items-center justify-center h-32">
                    <LogoComponent iconSize={64} />
                  </div>
                  <h3 className="font-semibold text-lg text-foreground mb-2">
                    Option {logo.id}
                  </h3>
                  <p className="font-medium text-foreground mb-2">
                    {logo.name}
                  </p>
                  <p className="text-sm text-muted-foreground mb-6">
                    {logo.description}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-display font-semibold text-foreground">LeaseShield App</span>
                    <LogoComponent iconSize={20} />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="mt-12 p-6 bg-muted/30 rounded-lg">
          <p className="text-sm text-muted-foreground text-center">
            Once you choose a logo option, let me know which number you prefer and I'll update the entire site with that design.
          </p>
        </div>
      </div>
    </div>
  );
}
