import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Shield, Lock, Sparkles } from 'lucide-react';

type ABVariant = 'trial' | 'paywall' | null;

interface ABTestWrapperProps {
  children: React.ReactNode;
  testId?: string;
}

const AB_STORAGE_KEY = 'leaseshield_ab_variant';

function getOrAssignVariant(): ABVariant {
  if (typeof window === 'undefined') return 'trial';
  
  const stored = localStorage.getItem(AB_STORAGE_KEY);
  if (stored === 'trial' || stored === 'paywall') {
    return stored;
  }
  
  const variant: ABVariant = Math.random() < 0.5 ? 'trial' : 'paywall';
  localStorage.setItem(AB_STORAGE_KEY, variant);
  
  return variant;
}

export function ABTestWrapper({ children, testId = 'landing' }: ABTestWrapperProps) {
  const [variant, setVariant] = useState<ABVariant>(null);

  useEffect(() => {
    setVariant(getOrAssignVariant());
  }, []);

  if (variant === null) {
    return null;
  }

  if (variant === 'paywall') {
    return <PaywallVariant testId={testId} />;
  }

  return <>{children}</>;
}

function PaywallVariant({ testId }: { testId: string }) {
  const handlePaywallClick = () => {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'paywall_start', { 
        variant: 'paywall',
        test_id: testId 
      });
    }
    window.location.href = '/api/login?redirect=/subscribe';
  };

  return (
    <div className="relative overflow-hidden">
      <Card className="max-w-2xl mx-auto p-8 text-center border-2 border-primary/20">
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/20 mb-4">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <Badge className="mb-4 bg-success text-success-foreground">
            <Sparkles className="h-3 w-3 mr-1" />
            Limited Time Offer
          </Badge>
        </div>

        <h2 className="text-3xl font-display font-semibold text-foreground mb-4">
          Full Access — Everything Small Landlords Need to Stay Compliant
        </h2>
        
        <p className="text-lg text-muted-foreground mb-6">
          Instant access to all state-specific leases, notices, checklists, compliance letters, and screening tools.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="text-center p-4 rounded-lg border-2 border-muted">
            <p className="text-sm text-muted-foreground mb-1">Monthly</p>
            <p className="text-3xl font-bold text-foreground">$10</p>
            <p className="text-xs text-muted-foreground">/month</p>
          </div>
          <div className="text-center p-4 rounded-lg border-2 border-success/50 bg-success/5">
            <p className="text-sm text-success font-semibold mb-1">BEST VALUE</p>
            <p className="text-3xl font-bold text-foreground">$100</p>
            <p className="text-xs text-muted-foreground">/year (save $20)</p>
          </div>
        </div>

        <div className="rounded-lg p-4 mb-6 border-2 border-muted">
          <p className="text-sm text-foreground font-medium mb-3">Everything Included:</p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
            {[
              'State-specific leases & legal notices',
              'Move-in / move-out checklists',
              'Screening steps checklist',
              'Adverse action letter templates',
              'Credit report decoder (simple explanations)',
              'Monthly legal & regulation updates',
              'Tenant issue workflows',
              'Document assembly wizard',
              '24/7 landlord compliance assistant',
            ].map((feature) => (
              <li key={feature} className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0 mt-[3px]" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        <Button 
          size="lg" 
          className="w-full sm:w-auto px-8"
          onClick={handlePaywallClick}
          data-testid="button-paywall-signup"
        >
          <Lock className="mr-2 h-4 w-4" />
          Choose Plan & Get Started
        </Button>

        <p className="text-xs text-muted-foreground mt-4">
          Cancel anytime. Money-back guarantee.
        </p>
      </Card>
    </div>
  );
}

export function trackTrialStart() {
  if (typeof window !== 'undefined') {
    const variant = localStorage.getItem(AB_STORAGE_KEY);
    if (variant !== 'paywall' && (window as any).gtag) {
      (window as any).gtag('event', 'trial_start', { variant: variant || 'trial' });
    }
  }
}

export function trackABEvent(eventName: string, additionalData?: Record<string, any>) {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    const variant = localStorage.getItem(AB_STORAGE_KEY) || 'trial';
    (window as any).gtag('event', eventName, { 
      variant, 
      ...additionalData 
    });
  }
}
