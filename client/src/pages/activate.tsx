import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Shield, FileText, Scale } from "lucide-react";
import logoHorizontal from "@/assets/logo-horizontal.png";

const valuePoints = [
  {
    icon: FileText,
    text: "Explain credit, criminal, and eviction results clearly",
  },
  {
    icon: Scale,
    text: "Keep decisions consistent and defensible",
  },
  {
    icon: Shield,
    text: "Keep it available for the moments that actually matter",
  },
];

export default function Activate() {
  const handleActivate = () => {
    window.location.href = "/subscribe";
  };

  const handleSkip = () => {
    window.location.href = "/dashboard";
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <Link href="/">
              <img 
                src={logoHorizontal} 
                alt="LeaseShield" 
                className="h-12 cursor-pointer"
                data-testid="link-logo-home"
              />
            </Link>
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-semibold" data-testid="text-activate-title">
              Activate LeaseShield
            </CardTitle>
            <CardDescription data-testid="text-activate-description">
              Keep it ready so you don't have to guess when your next applicant comes up.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            {valuePoints.map((point, index) => {
              const Icon = point.icon;
              return (
                <div key={index} className="flex items-start gap-3">
                  <div className="rounded-full bg-primary/10 p-1.5 mt-0.5">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-sm text-foreground">{point.text}</p>
                </div>
              );
            })}
          </div>

          <div className="bg-muted/50 rounded-lg p-4 text-center space-y-1">
            <p className="text-2xl font-bold text-foreground" data-testid="text-price">
              $10/month
            </p>
            <p className="text-sm text-muted-foreground">
              Cancel anytime. No contracts.
            </p>
            <p className="text-xs text-muted-foreground pt-1">
              Most landlords only use it a few times per year.
            </p>
          </div>

          <div className="space-y-3">
            <Button 
              onClick={handleActivate}
              className="w-full"
              size="lg"
              data-testid="button-activate"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Activate for $10/month
            </Button>
            
            <p className="text-xs text-muted-foreground text-center">
              You can cancel anytime from your account settings.
            </p>
            
            <div className="border-t border-border pt-3 space-y-2">
              <Button
                onClick={handleSkip}
                variant="outline"
                className="w-full"
                size="lg"
                data-testid="button-skip-activation"
              >
                Skip for now - keep looking around
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                You'll go to your dashboard. Subscribe whenever you're ready to unlock templates, compliance, and screening tools.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
