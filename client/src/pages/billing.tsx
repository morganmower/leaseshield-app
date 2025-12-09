import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CreditCard, AlertTriangle, ArrowRight } from "lucide-react";

export default function Billing() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const cancelSubscriptionMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/cancel-subscription", {});
      return await res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      const cancelDate = data.cancelAt 
        ? new Date(data.cancelAt * 1000).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
        : 'the end of your billing period';
      toast({
        title: "Subscription Cancelled",
        description: `Your subscription will end on ${cancelDate}. You'll retain access until then.`,
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to cancel subscription. Please try again or contact support.",
        variant: "destructive",
      });
    },
  });

  const syncSubscriptionMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/sync-subscription", {});
      return await res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Subscription Synced",
        description: data.status === 'active' 
          ? "Your active subscription has been restored!" 
          : `Status: ${data.status}`,
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to sync subscription. Please try again.",
        variant: "destructive",
      });
    },
  });

  const cancelIncompleteSubscriptionMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/cancel-incomplete-subscription", {});
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Subscription Cancelled",
        description: "Incomplete subscription has been cancelled. You can try subscribing again.",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to cancel subscription. Please try again.",
        variant: "destructive",
      });
    },
  });

  const managePaymentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/create-portal-session", {});
      return await res.json();
    },
    onSuccess: (data: any) => {
      if (data.url) {
        // Open in new tab since Stripe portal doesn't work in iframes
        window.open(data.url, '_blank');
      }
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to open billing portal. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-8">
        <CreditCard className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold text-foreground">Billing & Subscription</h1>
      </div>

      <div className="space-y-6">
        {/* Payment Failed Alert */}
        {user.subscriptionStatus === 'past_due' && (
          <Card className="p-6 border-red-500 bg-red-50 dark:bg-red-950/30">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-red-800 dark:text-red-200 mb-2">Payment Failed</h2>
                <p className="text-sm text-red-700 dark:text-red-300 mb-4">
                  We were unable to process your payment. Please update your payment method to continue using LeaseShield without interruption.
                </p>
                <Button 
                  onClick={() => managePaymentMutation.mutate()}
                  disabled={managePaymentMutation.isPending}
                  className="bg-red-600 hover:bg-red-700 text-white"
                  data-testid="button-fix-payment"
                >
                  {managePaymentMutation.isPending ? "Opening..." : "Update Payment Method"}
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Incomplete Subscription - Payment didn't go through */}
        {user.subscriptionStatus === 'incomplete' && (
          <Card className="p-6 border-yellow-500 bg-yellow-50 dark:bg-yellow-950/30">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-yellow-800 dark:text-yellow-200 mb-2">Incomplete Subscription</h2>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-4">
                  Your subscription payment didn't complete. You can cancel this incomplete subscription and try again.
                </p>
                <div className="flex gap-3 flex-wrap">
                  <Button 
                    onClick={() => cancelIncompleteSubscriptionMutation.mutate()}
                    disabled={cancelIncompleteSubscriptionMutation.isPending}
                    variant="outline"
                    className="border-yellow-600 text-yellow-700 hover:bg-yellow-100"
                    data-testid="button-cancel-incomplete"
                  >
                    {cancelIncompleteSubscriptionMutation.isPending ? "Cancelling..." : "Cancel & Start Fresh"}
                  </Button>
                  <Button 
                    onClick={() => window.location.href = '/subscribe'}
                    data-testid="button-retry-subscribe"
                  >
                    Try Payment Again <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* No Stripe Customer - Need to Subscribe */}
        {!user.stripeCustomerId && (user.subscriptionStatus === 'trialing' || user.subscriptionStatus === 'active') && (
          <Card className="p-6 border-primary/50 bg-primary/5">
            <h2 className="text-xl font-semibold text-foreground mb-4">Complete Your Subscription Setup</h2>
            <p className="text-sm text-muted-foreground mb-4">
              You have trial access but haven't set up billing yet. To manage your payment method or subscription, please complete the subscription setup process.
            </p>
            <Button 
              onClick={() => window.location.href = '/subscribe'}
              data-testid="button-setup-subscription"
            >
              Complete Subscription Setup
            </Button>
          </Card>
        )}

        {/* Sync Subscription - for users who have a Stripe customer but wrong status */}
        {user.stripeCustomerId && user.subscriptionStatus === 'trialing' && (
          <Card className="p-6 border-blue-500 bg-blue-50 dark:bg-blue-950/30">
            <div className="flex items-start gap-3">
              <CreditCard className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-blue-800 dark:text-blue-200 mb-2">Subscription Out of Sync?</h2>
                <p className="text-sm text-blue-700 dark:text-blue-300 mb-4">
                  If you've already paid but your subscription isn't showing as active, click below to sync your status from Stripe.
                </p>
                <Button 
                  onClick={() => syncSubscriptionMutation.mutate()}
                  disabled={syncSubscriptionMutation.isPending}
                  data-testid="button-sync-subscription"
                >
                  {syncSubscriptionMutation.isPending ? "Syncing..." : "Sync Subscription Status"}
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Subscription Status */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-foreground mb-6">Subscription Status</h2>

          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-foreground">Current Plan</Label>
              <p className="text-muted-foreground mt-1">
                {user.subscriptionStatus === 'cancel_at_period_end' 
                  ? 'Cancelling at period end' 
                  : user.subscriptionStatus === 'past_due'
                  ? 'LeaseShield App - Payment Required'
                  : user.subscriptionStatus === 'active'
                  ? `LeaseShield App - ${(user as any).billingInterval === 'year' ? '$100/year' : '$10/month'}`
                  : user.subscriptionStatus === 'trialing'
                  ? 'LeaseShield App - 7-Day Free Trial'
                  : "No active subscription"}
              </p>
              {user.subscriptionStatus && (
                <p className="text-xs text-muted-foreground mt-1">
                  Status: {user.subscriptionStatus === 'past_due' ? 'Payment Failed' : user.subscriptionStatus}
                </p>
              )}
            </div>

            {user.subscriptionEndsAt && user.subscriptionStatus !== 'cancel_at_period_end' && (
              <div>
                <Label className="text-sm font-medium text-foreground">
                  Next Renewal
                </Label>
                <p className="text-muted-foreground mt-1">
                  {new Date(user.subscriptionEndsAt).toLocaleDateString('en-US', { 
                    weekday: 'long',
                    month: 'long', 
                    day: 'numeric', 
                    year: 'numeric' 
                  })}
                </p>
              </div>
            )}

            {user.trialEndsAt && (
              <div>
                <Label className="text-sm font-medium text-foreground">
                  Trial Ends
                </Label>
                <p className="text-muted-foreground mt-1">
                  {new Date(user.trialEndsAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {Math.ceil((new Date(user.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days remaining
                </p>
              </div>
            )}

            {user.subscriptionStatus === 'cancel_at_period_end' && user.stripeCustomerId && (
              <div className="p-4 bg-muted rounded-lg border">
                <p className="text-sm text-muted-foreground">
                  Your subscription has been cancelled and will end at the end of your billing period. 
                  You'll retain access to all features until then.
                </p>
              </div>
            )}

            {/* Upgrade Button for Trial Users */}
            {user.subscriptionStatus === 'trialing' && !user.stripeCustomerId && (
              <div className="pt-4 border-t">
                <Button 
                  onClick={() => window.location.href = '/subscribe'}
                  size="lg"
                  className="w-full sm:w-auto"
                  data-testid="button-upgrade-to-paid"
                >
                  Upgrade to Paid - $10/month
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Start your paid subscription now and skip the trial wait
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Manage Billing - Opens Stripe Portal */}
        {user.stripeCustomerId && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">Manage Billing</h2>
            
            <p className="text-sm text-muted-foreground mb-6">
              Opens Stripe's secure billing center where you can:
            </p>
            
            <ul className="text-sm text-muted-foreground mb-6 space-y-2">
              <li className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" />
                Update or change your payment card
              </li>
              <li className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" />
                View all invoices and payment history
              </li>
              <li className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" />
                Cancel your subscription
              </li>
            </ul>
            
            <Button 
              onClick={() => managePaymentMutation.mutate()}
              disabled={managePaymentMutation.isPending}
              size="lg"
              data-testid="button-manage-billing"
            >
              {managePaymentMutation.isPending ? "Opening..." : "Open Billing Portal"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            
            <p className="text-xs text-muted-foreground mt-3">
              Opens in a new tab for security
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
