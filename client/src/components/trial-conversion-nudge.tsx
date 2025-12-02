import { useTrialProgress } from '@/hooks/useTrialProgress';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, AlertCircle, Clock, ArrowRight, Gift, Sparkles, X } from 'lucide-react';
import { Link } from 'wouter';
import { useState, useEffect } from 'react';

export function TrialConversionNudge() {
  const { currentDay, daysRemaining, isTrialing, isDay6OrLater, hasActiveSubscription } = useTrialProgress();
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (currentDay !== null) {
      const dismissKey = `leaseshield_nudge_dismissed_day${currentDay}`;
      const wasDismissed = localStorage.getItem(dismissKey) === 'true';
      setDismissed(wasDismissed);
    }
  }, [currentDay]);

  const handleDismiss = () => {
    if (currentDay !== null) {
      const dismissKey = `leaseshield_nudge_dismissed_day${currentDay}`;
      localStorage.setItem(dismissKey, 'true');
      setDismissed(true);
    }
  };

  if (dismissed || hasActiveSubscription || user?.isAdmin || !isTrialing || currentDay === null) {
    return null;
  }

  if (isDay6OrLater) {
    return (
      <Card className="mb-6 p-5 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-2 border-amber-300 dark:border-amber-700 relative">
        <button 
          onClick={handleDismiss}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="rounded-full bg-amber-500/20 p-3 flex-shrink-0">
            <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-500" />
          </div>
          
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-display font-semibold text-foreground">
                Your Trial Ends Tomorrow!
              </h3>
              <Badge variant="destructive" className="text-xs">
                <Clock className="h-3 w-3 mr-1" />
                {daysRemaining} Day{daysRemaining !== 1 ? 's' : ''} Left
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Don't lose access to your templates and compliance updates. Lock in $10/month before your trial ends.
            </p>
          </div>

          <Link to="/subscribe">
            <Button className="whitespace-nowrap" data-testid="button-nudge-subscribe">
              Subscribe Now
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </Card>
    );
  }

  if (currentDay >= 3 && currentDay < 6) {
    return (
      <Card className="mb-6 p-4 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20 relative">
        <button 
          onClick={handleDismiss}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="rounded-full bg-primary/20 p-3 flex-shrink-0">
            <Gift className="h-6 w-6 text-primary" />
          </div>
          
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-display font-semibold text-foreground">
                Enjoying LeaseShield?
              </h3>
              <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/30 text-xs">
                Day {currentDay} of 7
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              You've unlocked the AI Credit Decoder! Subscribe now to keep access and unlock the full toolkit.
            </p>
          </div>

          <Link to="/subscribe">
            <Button variant="outline" className="whitespace-nowrap" data-testid="button-mid-trial-subscribe">
              View Plans
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </Card>
    );
  }

  return null;
}

export function TrialValueMessage() {
  return (
    <div className="text-center py-2 px-4 bg-gradient-to-r from-success/10 via-success/5 to-success/10 border-y border-success/20">
      <p className="text-sm text-foreground">
        <Sparkles className="inline h-4 w-4 mr-1 text-success" />
        <strong>7 days to test everything</strong> — no card needed. Instant access to leases, decoder, and all tools.
      </p>
    </div>
  );
}

export function TrialNote() {
  return (
    <p className="text-sm text-muted-foreground text-center">
      <strong>7 days to test everything</strong> — no card needed. Instant access to leases, decoder, and ledger.
    </p>
  );
}
