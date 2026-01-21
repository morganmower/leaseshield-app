import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, ArrowRight, LogOut } from "lucide-react";
import { Link, useLocation } from "wouter";
import logoHorizontal from "@/assets/logo-horizontal.png";

interface SubscriptionGateProps {
  children: React.ReactNode;
}

// Routes that should bypass the subscription gate
const BYPASS_ROUTES = [
  '/subscribe',
  '/billing', 
  '/subscription',
  '/settings',
  '/activate',
  '/privacy',
  '/terms',
  '/refund-policy',
  '/disclaimers',
  '/contact',
  '/help',
  '/apply',
];

export function SubscriptionGate({ children }: SubscriptionGateProps) {
  const { user, needsActivation, isLoading, logout } = useAuth();
  const [location] = useLocation();

  // Check if current route should bypass the gate
  const shouldBypass = BYPASS_ROUTES.some(route => location.startsWith(route));

  // Allow bypass routes even when loading or needing activation
  if (shouldBypass) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <Shield className="h-12 w-12 text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (needsActivation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <img 
                src={logoHorizontal} 
                alt="LeaseShield" 
                className="h-12"
              />
            </div>
            <div>
              <CardTitle className="text-2xl font-semibold">
                Welcome Back, {user?.firstName || 'there'}!
              </CardTitle>
              <CardDescription className="mt-2">
                Your subscription is currently inactive. Activate your account to access all LeaseShield features.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <h3 className="font-medium text-sm">With an active subscription, you get:</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <Shield className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span>State-specific legal templates and forms</span>
                </li>
                <li className="flex items-start gap-2">
                  <Shield className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span>AI-powered screening report decoder</span>
                </li>
                <li className="flex items-start gap-2">
                  <Shield className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span>Compliance guidance for your state</span>
                </li>
                <li className="flex items-start gap-2">
                  <Shield className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span>Rental application management</span>
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <Link href="/subscribe">
                <Button className="w-full" size="lg" data-testid="button-activate-subscription">
                  Activate Your Account
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
              <p className="text-center text-xs text-muted-foreground">
                $10/month or $100/year • Cancel anytime
              </p>
            </div>

            <div className="border-t pt-4">
              <Button 
                variant="ghost" 
                className="w-full text-muted-foreground" 
                onClick={logout}
                data-testid="button-logout-inactive"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Log out and use a different account
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
