import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, ArrowRight, Shield } from 'lucide-react';
import { Link } from 'wouter';

interface ActivationGateProps {
  featureName: string;
  children: React.ReactNode;
  showPreview?: boolean;
  previewContent?: React.ReactNode;
}

export function useIsActivated() {
  const { user } = useAuth();
  const isActive = user?.subscriptionStatus === 'active' || user?.subscriptionStatus === 'cancel_at_period_end';
  const isAdmin = user?.isAdmin === true;
  return isActive || isAdmin;
}

export function ActivationGate({ 
  featureName, 
  children, 
  showPreview = false,
  previewContent
}: ActivationGateProps) {
  const { user } = useAuth();
  const isActivated = useIsActivated();

  if (isActivated) {
    return <>{children}</>;
  }

  if (showPreview && previewContent) {
    return <>{previewContent}</>;
  }

  return (
    <Card className="relative overflow-hidden border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
      <div className="p-8 text-center">
        <div className="mb-4 flex justify-center">
          <div className="rounded-full bg-primary/20 p-4">
            <Lock className="h-8 w-8 text-primary" />
          </div>
        </div>
        
        <h3 className="text-xl font-display font-semibold text-foreground mb-3">
          Activate LeaseShield to use {featureName}
        </h3>
        
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          Keep it ready so you don't have to guess when your next applicant comes up.
        </p>

        <Link href="/subscribe">
          <Button size="lg" data-testid={`button-activate-${featureName.toLowerCase().replace(/\s+/g, '-')}`}>
            Activate for $10/month
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
        
        <p className="text-sm text-muted-foreground mt-4">
          Cancel anytime
        </p>
      </div>

      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/10 to-transparent rounded-full -mr-16 -mt-16" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-primary/10 to-transparent rounded-full -ml-12 -mb-12" />
      </div>
    </Card>
  );
}

export function ActivationPrompt({ 
  featureName,
  inline = false 
}: { 
  featureName: string;
  inline?: boolean;
}) {
  if (inline) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-muted/50 rounded-lg border border-primary/20">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="h-5 w-5 text-primary" />
          <span className="font-medium text-foreground">Activate LeaseShield to {featureName}</span>
        </div>
        <p className="text-sm text-muted-foreground mb-4 text-center">
          Keep it ready so you don't have to guess when your next applicant comes up.
        </p>
        <Link href="/subscribe">
          <Button data-testid={`button-activate-inline-${featureName.toLowerCase().replace(/\s+/g, '-')}`}>
            Activate for $10/month
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
        <p className="text-xs text-muted-foreground mt-2">Cancel anytime</p>
      </div>
    );
  }

  return (
    <ActivationGate featureName={featureName}>
      <></>
    </ActivationGate>
  );
}
