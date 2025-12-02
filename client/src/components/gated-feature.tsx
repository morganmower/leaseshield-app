import { useTrialProgress } from '@/hooks/useTrialProgress';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lock, Clock, Unlock, ArrowRight } from 'lucide-react';
import { Link } from 'wouter';

interface GatedFeatureProps {
  dayRequired: number;
  featureName: string;
  children: React.ReactNode;
  showLockedState?: boolean;
}

export function GatedFeature({ 
  dayRequired, 
  featureName, 
  children, 
  showLockedState = true 
}: GatedFeatureProps) {
  const { user } = useAuth();
  const { currentDay, isTrialing, hasActiveSubscription } = useTrialProgress();

  const isAdmin = user?.isAdmin;
  const isUnlocked = isAdmin || hasActiveSubscription || (isTrialing && currentDay !== null && currentDay >= dayRequired);

  if (isUnlocked) {
    return <>{children}</>;
  }

  if (!showLockedState) {
    return null;
  }

  const isActiveTrialer = isTrialing && currentDay !== null;
  const daysUntilUnlock = currentDay !== null ? dayRequired - currentDay : dayRequired;

  return (
    <Card className="relative overflow-hidden border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
      <div className="p-6 text-center">
        <div className="mb-4 flex justify-center">
          <div className="rounded-full bg-primary/20 p-4">
            <Lock className="h-8 w-8 text-primary" />
          </div>
        </div>
        
        <h3 className="text-xl font-display font-semibold text-foreground mb-2">
          {isActiveTrialer ? `Unlock ${featureName}` : `${featureName} - Premium Feature`}
        </h3>
        
        {isActiveTrialer ? (
          <>
            <div className="flex items-center justify-center gap-2 mb-4">
              <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/30">
                <Clock className="h-3 w-3 mr-1" />
                Available on Day {dayRequired}
              </Badge>
            </div>

            <p className="text-muted-foreground mb-4">
              You're on <span className="font-semibold text-foreground">Day {currentDay}</span> of your trial.
              {daysUntilUnlock > 0 ? (
                <> Keep exploring to unlock this feature in <span className="font-semibold text-primary">{daysUntilUnlock} more day{daysUntilUnlock !== 1 ? 's' : ''}</span>!</>
              ) : (
                <> This feature will unlock soon!</>
              )}
            </p>

            <div className="bg-card/50 rounded-lg p-4 mb-4">
              <p className="text-sm text-muted-foreground">
                <Unlock className="inline h-4 w-4 mr-1 text-success" />
                Or <Link to="/subscribe" className="text-primary hover:underline font-medium">subscribe now</Link> to unlock all features instantly!
              </p>
            </div>
          </>
        ) : (
          <>
            <p className="text-muted-foreground mb-4">
              This premium feature is available with an active subscription.
            </p>
          </>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/subscribe">
            <Button data-testid={`button-unlock-${featureName.toLowerCase().replace(/\s+/g, '-')}`}>
              {isActiveTrialer ? 'Subscribe & Unlock All' : 'Subscribe Now'}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/10 to-transparent rounded-full -mr-16 -mt-16" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-primary/10 to-transparent rounded-full -ml-12 -mb-12" />
      </div>
    </Card>
  );
}

export function TrialProgressBanner() {
  const { currentDay, daysRemaining, isTrialing, totalDays, hasActiveSubscription } = useTrialProgress();
  const { user } = useAuth();

  if (!isTrialing || hasActiveSubscription || user?.isAdmin || currentDay === null) {
    return null;
  }

  const progressPercent = (currentDay / totalDays) * 100;

  const unlockedFeatures = [
    { day: 1, name: 'Basic Templates & Leases' },
    { day: 3, name: 'AI Credit Decoder' },
    { day: 5, name: 'Full Toolkit & Comms' },
  ];

  return (
    <Card className="mb-6 p-4 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border-primary/20">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/30">
              Day {currentDay} of {totalDays}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining
            </span>
          </div>
          
          <div className="w-full bg-muted rounded-full h-2 mb-3">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {unlockedFeatures.map((feature) => (
              <Badge 
                key={feature.day}
                variant={currentDay >= feature.day ? "default" : "outline"}
                className={currentDay >= feature.day 
                  ? "bg-success text-success-foreground" 
                  : "border-muted-foreground/30 text-muted-foreground"
                }
              >
                {currentDay >= feature.day ? (
                  <Unlock className="h-3 w-3 mr-1" />
                ) : (
                  <Lock className="h-3 w-3 mr-1" />
                )}
                Day {feature.day}: {feature.name}
              </Badge>
            ))}
          </div>
        </div>

        <Link to="/subscribe">
          <Button size="sm" data-testid="button-unlock-all">
            Unlock All Now
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>
    </Card>
  );
}
