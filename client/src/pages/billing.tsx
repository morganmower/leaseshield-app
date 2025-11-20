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
import { CreditCard, AlertTriangle } from "lucide-react";

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
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const cancelSubscriptionMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/cancel-subscription", {});
    },
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      const cancelDate = response.cancelAt 
        ? new Date(response.cancelAt * 1000).toLocaleDateString()
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
          window.location.href = "/api/login";
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

  const managePaymentMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/create-portal-session", {});
    },
    onSuccess: (response: any) => {
      if (response.url) {
        window.location.href = response.url;
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
          window.location.href = "/api/login";
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

        {/* Subscription Status */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-foreground mb-6">Subscription Status</h2>

          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-foreground">Current Plan</Label>
              <p className="text-muted-foreground mt-1 capitalize">
                {user.subscriptionStatus === 'cancel_at_period_end' 
                  ? 'Cancelling at period end' 
                  : user.subscriptionStatus === 'active'
                  ? 'LeaseShield Pro - $12/month'
                  : user.subscriptionStatus === 'trialing'
                  ? 'LeaseShield Pro - 7-Day Free Trial'
                  : "No active subscription"}
              </p>
            </div>

            {user.trialEndsAt && user.subscriptionStatus === "trialing" && (
              <div>
                <Label className="text-sm font-medium text-foreground">
                  Trial Ends
                </Label>
                <p className="text-muted-foreground mt-1">
                  {new Date(user.trialEndsAt).toLocaleDateString()}
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
          </div>
        </Card>

        {/* Payment Method */}
        {(user.subscriptionStatus === 'active' || user.subscriptionStatus === 'cancel_at_period_end') && user.stripeCustomerId && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-foreground mb-6">Payment Method</h2>
            
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Manage your payment method, view billing history, and update your card details.
              </p>
              
              <Button 
                variant="outline"
                onClick={() => managePaymentMutation.mutate()}
                disabled={managePaymentMutation.isPending}
                data-testid="button-manage-payment"
              >
                {managePaymentMutation.isPending ? "Opening..." : "Manage Payment Method"}
              </Button>
            </div>
          </Card>
        )}

        {/* Cancel Subscription */}
        {(user.subscriptionStatus === 'active' || user.subscriptionStatus === 'trialing') && user.stripeSubscriptionId && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-foreground mb-6">Cancel Subscription</h2>
            
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Cancel your subscription at any time. You'll retain access to all features until the end of your billing period.
              </p>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="destructive" 
                    disabled={cancelSubscriptionMutation.isPending}
                    data-testid="button-cancel-subscription"
                  >
                    {cancelSubscriptionMutation.isPending ? "Cancelling..." : "Cancel Subscription"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                      Cancel Subscription?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Your subscription will be cancelled at the end of your current billing period. 
                      You'll continue to have access to all features until then, and your card will 
                      not be charged again.
                      <br /><br />
                      Are you sure you want to cancel?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel data-testid="button-cancel-dialog">
                      Keep Subscription
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => cancelSubscriptionMutation.mutate()}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      data-testid="button-confirm-cancel"
                    >
                      Yes, Cancel Subscription
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
