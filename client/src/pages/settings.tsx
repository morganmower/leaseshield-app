import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Settings as SettingsIcon, Save, CreditCard, X } from "lucide-react";

export default function Settings() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [preferredState, setPreferredState] = useState<string>("");

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

  useEffect(() => {
    if (user?.preferredState) {
      setPreferredState(user.preferredState);
    }
  }, [user]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: { preferredState: string }) => {
      await apiRequest("PATCH", "/api/user/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Settings Updated",
        description: "Your preferences have been saved successfully.",
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
        description: "Failed to update settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!preferredState) {
      toast({
        title: "Error",
        description: "Please select a preferred state.",
        variant: "destructive",
      });
      return;
    }
    updateSettingsMutation.mutate({ preferredState });
  };

  const cancelSubscriptionMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/cancel-subscription", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Subscription Cancelled",
        description: "Your subscription will end at the end of your current billing period. You'll keep access until then.",
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
        description: "Failed to cancel subscription. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex-1 overflow-auto">
      <div className="container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-display font-semibold text-foreground mb-2">
            Settings
          </h1>
          <p className="text-muted-foreground">
            Manage your account preferences and settings
          </p>
        </div>

        {/* Account Information */}
        <Card className="p-6 mb-6">
          <div className="flex items-center gap-2 mb-6">
            <SettingsIcon className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold text-foreground">Account Information</h2>
          </div>

          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-foreground">Email</Label>
              <p className="text-muted-foreground mt-1">{user.email || "Not provided"}</p>
            </div>

            {user.firstName && user.lastName && (
              <div>
                <Label className="text-sm font-medium text-foreground">Name</Label>
                <p className="text-muted-foreground mt-1">
                  {user.firstName} {user.lastName}
                </p>
              </div>
            )}

            <div>
              <Label className="text-sm font-medium text-foreground">
                Member Since
              </Label>
              <p className="text-muted-foreground mt-1">
                {user.createdAt
                  ? new Date(user.createdAt).toLocaleDateString()
                  : "Unknown"}
              </p>
            </div>
          </div>
        </Card>

        {/* Preferences */}
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold text-foreground mb-6">Preferences</h2>

          <div className="space-y-6">
            <div>
              <Label htmlFor="preferred-state" className="text-sm font-medium">
                Preferred State
              </Label>
              <p className="text-sm text-muted-foreground mt-1 mb-3">
                Choose where your properties are located. Templates and Compliance pages will automatically show content for this state.
              </p>
              <Select value={preferredState} onValueChange={setPreferredState}>
                <SelectTrigger id="preferred-state" data-testid="select-preferred-state">
                  <SelectValue placeholder="Select your state" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UT">Utah</SelectItem>
                  <SelectItem value="TX">Texas</SelectItem>
                  <SelectItem value="ND">North Dakota</SelectItem>
                  <SelectItem value="SD">South Dakota</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleSave}
              disabled={updateSettingsMutation.isPending}
              data-testid="button-save-settings"
            >
              {updateSettingsMutation.isPending ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </Card>

        {/* Subscription Management */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <CreditCard className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold text-foreground">Subscription</h2>
          </div>

          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-foreground">Status</Label>
              <div className="mt-2">
                {user.subscriptionStatus ? (
                  <Badge
                    variant={
                      user.subscriptionStatus === "active"
                        ? "default"
                        : user.subscriptionStatus === "trialing"
                        ? "secondary"
                        : "outline"
                    }
                    data-testid="badge-subscription-status"
                  >
                    {user.subscriptionStatus}
                  </Badge>
                ) : (
                  <Badge variant="outline" data-testid="badge-subscription-status">
                    No active subscription
                  </Badge>
                )}
              </div>
            </div>

            {user.trialEndsAt && user.subscriptionStatus === "trialing" && (
              <div>
                <Label className="text-sm font-medium text-foreground">Trial Ends</Label>
                <p className="text-muted-foreground mt-1">
                  {new Date(user.trialEndsAt).toLocaleDateString()}
                </p>
              </div>
            )}

            {user.subscriptionEndsAt && user.subscriptionStatus === "active" && (
              <div>
                <Label className="text-sm font-medium text-foreground">Next Billing Date</Label>
                <p className="text-muted-foreground mt-1">
                  {new Date(user.subscriptionEndsAt).toLocaleDateString()}
                </p>
              </div>
            )}

            {(user.subscriptionStatus === "active" || user.subscriptionStatus === "trialing") && (
              <div className="pt-4 border-t">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      data-testid="button-cancel-subscription"
                    >
                      <X className="mr-2 h-4 w-4" />
                      Cancel Subscription
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel Subscription?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Your subscription will be cancelled at the end of your current billing period.
                        You'll keep access to all features until then. This action can be undone by
                        resubscribing before the period ends.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel data-testid="button-cancel-dialog">
                        Keep Subscription
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => cancelSubscriptionMutation.mutate()}
                        className="bg-destructive hover:bg-destructive/90"
                        data-testid="button-confirm-cancel"
                      >
                        {cancelSubscriptionMutation.isPending ? "Cancelling..." : "Yes, Cancel"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
