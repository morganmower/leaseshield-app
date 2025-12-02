import { useMemo } from 'react';
import { useAuth } from './useAuth';

interface TrialProgress {
  trialStartDate: Date | null;
  trialEndDate: Date | null;
  currentDay: number | null;
  daysRemaining: number;
  totalDays: number;
  isTrialing: boolean;
  isDay1: boolean;
  isDay3OrLater: boolean;
  isDay5OrLater: boolean;
  isDay6OrLater: boolean;
  hasActiveSubscription: boolean;
  isExpired: boolean;
}

export function useTrialProgress(): TrialProgress {
  const { user } = useAuth();

  return useMemo(() => {
    const isTrialing = user?.subscriptionStatus === 'trialing';
    const hasActiveSubscription = user?.subscriptionStatus === 'active';
    const trialEndDate = user?.trialEndsAt ? new Date(user.trialEndsAt) : null;
    
    const totalDays = 7;
    
    let trialStartDate: Date | null = null;
    let currentDay: number | null = null;
    let daysRemaining = 0;
    let isExpired = false;

    if (isTrialing && trialEndDate) {
      trialStartDate = new Date(trialEndDate.getTime() - (totalDays * 24 * 60 * 60 * 1000));
      const now = new Date();
      const elapsedMs = now.getTime() - trialStartDate.getTime();
      currentDay = Math.max(1, Math.min(totalDays, Math.ceil(elapsedMs / (24 * 60 * 60 * 1000))));
      daysRemaining = Math.max(0, Math.ceil((trialEndDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
      isExpired = daysRemaining <= 0;
    }

    return {
      trialStartDate,
      trialEndDate,
      currentDay,
      daysRemaining,
      totalDays,
      isTrialing,
      isDay1: isTrialing && currentDay !== null && currentDay >= 1,
      isDay3OrLater: hasActiveSubscription || (isTrialing && currentDay !== null && currentDay >= 3),
      isDay5OrLater: hasActiveSubscription || (isTrialing && currentDay !== null && currentDay >= 5),
      isDay6OrLater: isTrialing && currentDay !== null && currentDay >= 6,
      hasActiveSubscription,
      isExpired,
    };
  }, [user]);
}
