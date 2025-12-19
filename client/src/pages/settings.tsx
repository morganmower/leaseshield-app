import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  User, 
  Bell, 
  Building2, 
  CreditCard, 
  Save, 
  ExternalLink,
  Shield,
  Mail,
  FileText,
  Lightbulb,
  UserCheck,
  Trash2,
  Check,
  X,
  Eye,
  EyeOff,
} from "lucide-react";
import { Link } from "wouter";

export default function Settings() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  
  // Form state
  const [preferredState, setPreferredState] = useState<string>("");
  const [businessName, setBusinessName] = useState<string>("");
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [notifyLegalUpdates, setNotifyLegalUpdates] = useState(true);
  const [notifyTemplateRevisions, setNotifyTemplateRevisions] = useState(true);
  const [notifyBillingAlerts, setNotifyBillingAlerts] = useState(true);
  const [notifyTips, setNotifyTips] = useState(false);
  
  // Screening credentials state
  const [screeningUsername, setScreeningUsername] = useState("");
  const [screeningPassword, setScreeningPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [selectedInvitation, setSelectedInvitation] = useState<string>("");
  const [testInvitations, setTestInvitations] = useState<Array<{id: string; name: string; description: string}>>([]);

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

  useEffect(() => {
    if (user) {
      setPreferredState(user.preferredState || "");
      setBusinessName(user.businessName || "");
      setPhoneNumber(user.phoneNumber || "");
      setNotifyLegalUpdates(user.notifyLegalUpdates ?? true);
      setNotifyTemplateRevisions(user.notifyTemplateRevisions ?? true);
      setNotifyBillingAlerts(user.notifyBillingAlerts ?? true);
      setNotifyTips(user.notifyTips ?? false);
    }
  }, [user]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: {
      preferredState?: string;
      businessName?: string | null;
      phoneNumber?: string | null;
      notifyLegalUpdates?: boolean;
      notifyTemplateRevisions?: boolean;
      notifyBillingAlerts?: boolean;
      notifyTips?: boolean;
    }) => {
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
          window.location.href = "/login";
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

  const handleSavePreferences = () => {
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

  const handleSaveProfile = () => {
    updateSettingsMutation.mutate({
      businessName: businessName || null,
      phoneNumber: phoneNumber || null,
    });
  };

  const handleSaveNotifications = () => {
    updateSettingsMutation.mutate({
      notifyLegalUpdates,
      notifyTemplateRevisions,
      notifyBillingAlerts,
      notifyTips,
    });
  };

  // Screening credentials query
  const { data: credentialsStatus, isLoading: credentialsLoading } = useQuery<{
    configured: boolean;
    status: string;
    lastVerifiedAt?: string;
    lastErrorMessage?: string;
    hasDefaultInvitation?: boolean;
  }>({
    queryKey: ["/api/screening-credentials"],
    enabled: isAuthenticated,
  });

  // Test credentials mutation
  const testCredentialsMutation = useMutation({
    mutationFn: async (data: { username: string; password: string }) => {
      const res = await apiRequest("POST", "/api/screening-credentials/test", data);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setTestInvitations(data.invitations || []);
        toast({
          title: "Credentials Verified",
          description: "Your Western Verify credentials are valid. You can now save them.",
        });
      } else {
        toast({
          title: "Verification Failed",
          description: data.message || "Invalid credentials. Please check your username and password.",
          variant: "destructive",
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to verify credentials. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Save credentials mutation
  const saveCredentialsMutation = useMutation({
    mutationFn: async (data: { username: string; password: string; defaultInvitationId?: string }) => {
      const res = await apiRequest("POST", "/api/screening-credentials", data);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["/api/screening-credentials"] });
        setScreeningUsername("");
        setScreeningPassword("");
        setSelectedInvitation("");
        setTestInvitations([]);
        toast({
          title: "Credentials Saved",
          description: "Your Western Verify credentials have been securely saved.",
        });
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to save credentials.",
          variant: "destructive",
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save credentials. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete credentials mutation
  const deleteCredentialsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/screening-credentials");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/screening-credentials"] });
      toast({
        title: "Credentials Removed",
        description: "Your Western Verify credentials have been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove credentials. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleTestCredentials = () => {
    if (!screeningUsername || !screeningPassword) {
      toast({
        title: "Missing Information",
        description: "Please enter both username and password.",
        variant: "destructive",
      });
      return;
    }
    testCredentialsMutation.mutate({ username: screeningUsername, password: screeningPassword });
  };

  const handleSaveCredentials = () => {
    if (!screeningUsername || !screeningPassword) {
      toast({
        title: "Missing Information",
        description: "Please enter both username and password.",
        variant: "destructive",
      });
      return;
    }
    saveCredentialsMutation.mutate({
      username: screeningUsername,
      password: screeningPassword,
      defaultInvitationId: selectedInvitation || undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading" />
      </div>
    );
  }

  if (!user) return null;

  const getSubscriptionStatusBadge = () => {
    const status = user.subscriptionStatus;
    if (user.isAdmin) {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">Admin Access</span>;
    }
    switch (status) {
      case 'active':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Active</span>;
      case 'trialing':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Trial</span>;
      case 'canceled':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">Canceled</span>;
      case 'past_due':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Past Due</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">No Subscription</span>;
    }
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-display font-semibold text-foreground mb-2">
            Settings
          </h1>
          <p className="text-muted-foreground">
            Manage your account, preferences, and notification settings
          </p>
        </div>

        <div className="space-y-6">
          {/* Account Information */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                <CardTitle>Account Information</CardTitle>
              </div>
              <CardDescription>
                Your account is managed through Replit. To change your email or password, visit your Replit account settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Email</Label>
                  <p className="mt-1 text-foreground" data-testid="text-email">{user.email || "Not provided"}</p>
                </div>
                {(user.firstName || user.lastName) && (
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Name</Label>
                    <p className="mt-1 text-foreground" data-testid="text-name">
                      {[user.firstName, user.lastName].filter(Boolean).join(" ")}
                    </p>
                  </div>
                )}
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Member Since</Label>
                  <p className="mt-1 text-foreground" data-testid="text-member-since">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "Unknown"}
                  </p>
                </div>
              </div>
              <Separator />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield className="h-4 w-4" />
                <span>Your login credentials are securely managed by Replit.</span>
              </div>
            </CardContent>
          </Card>

          {/* Profile Information */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <CardTitle>Profile</CardTitle>
              </div>
              <CardDescription>
                Add your business details for use in generated documents and communications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="business-name">Business Name</Label>
                  <Input
                    id="business-name"
                    placeholder="ABC Property Management"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    data-testid="input-business-name"
                  />
                  <p className="text-xs text-muted-foreground">Used in document headers and communications</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone-number">Phone Number</Label>
                  <Input
                    id="phone-number"
                    placeholder="(555) 123-4567"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    data-testid="input-phone-number"
                  />
                  <p className="text-xs text-muted-foreground">Contact number for tenant communications</p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={handleSaveProfile}
                  disabled={updateSettingsMutation.isPending}
                  data-testid="button-save-profile"
                >
                  {updateSettingsMutation.isPending ? (
                    <>
                      <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Profile
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Preferences */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <CardTitle>Preferences</CardTitle>
              </div>
              <CardDescription>
                Set your default state for templates and compliance information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="preferred-state">Preferred State</Label>
                <Select value={preferredState} onValueChange={setPreferredState}>
                  <SelectTrigger id="preferred-state" className="w-full sm:w-64" data-testid="select-preferred-state">
                    <SelectValue placeholder="Select your state" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UT">Utah</SelectItem>
                    <SelectItem value="TX">Texas</SelectItem>
                    <SelectItem value="ND">North Dakota</SelectItem>
                    <SelectItem value="SD">South Dakota</SelectItem>
                    <SelectItem value="NC">North Carolina</SelectItem>
                    <SelectItem value="OH">Ohio</SelectItem>
                    <SelectItem value="MI">Michigan</SelectItem>
                    <SelectItem value="ID">Idaho</SelectItem>
                    <SelectItem value="WY">Wyoming</SelectItem>
                    <SelectItem value="CA">California</SelectItem>
                    <SelectItem value="VA">Virginia</SelectItem>
                    <SelectItem value="NV">Nevada</SelectItem>
                    <SelectItem value="AZ">Arizona</SelectItem>
                    <SelectItem value="FL">Florida</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Templates, compliance cards, and legal updates will be filtered for this state</p>
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={handleSavePreferences}
                  disabled={updateSettingsMutation.isPending}
                  data-testid="button-save-preferences"
                >
                  {updateSettingsMutation.isPending ? (
                    <>
                      <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Preferences
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                <CardTitle>Email Notifications</CardTitle>
              </div>
              <CardDescription>
                Choose which email notifications you want to receive
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-3">
                    <Shield className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <Label htmlFor="notify-legal" className="font-medium">Legal Updates</Label>
                      <p className="text-sm text-muted-foreground">Get notified when new laws or regulations affect landlords in your state</p>
                    </div>
                  </div>
                  <Switch
                    id="notify-legal"
                    checked={notifyLegalUpdates}
                    onCheckedChange={setNotifyLegalUpdates}
                    data-testid="switch-notify-legal"
                  />
                </div>
                
                <Separator />
                
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <Label htmlFor="notify-templates" className="font-medium">Template Revisions</Label>
                      <p className="text-sm text-muted-foreground">Get notified when templates are updated to reflect new requirements</p>
                    </div>
                  </div>
                  <Switch
                    id="notify-templates"
                    checked={notifyTemplateRevisions}
                    onCheckedChange={setNotifyTemplateRevisions}
                    data-testid="switch-notify-templates"
                  />
                </div>
                
                <Separator />
                
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-3">
                    <CreditCard className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <Label htmlFor="notify-billing" className="font-medium">Billing Alerts</Label>
                      <p className="text-sm text-muted-foreground">Receive notifications about subscription renewals and payment issues</p>
                    </div>
                  </div>
                  <Switch
                    id="notify-billing"
                    checked={notifyBillingAlerts}
                    onCheckedChange={setNotifyBillingAlerts}
                    data-testid="switch-notify-billing"
                  />
                </div>
                
                <Separator />
                
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-3">
                    <Lightbulb className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <Label htmlFor="notify-tips" className="font-medium">Tips & Best Practices</Label>
                      <p className="text-sm text-muted-foreground">Occasional tips to help you be a better landlord</p>
                    </div>
                  </div>
                  <Switch
                    id="notify-tips"
                    checked={notifyTips}
                    onCheckedChange={setNotifyTips}
                    data-testid="switch-notify-tips"
                  />
                </div>
              </div>
              
              <div className="flex justify-end">
                <Button
                  onClick={handleSaveNotifications}
                  disabled={updateSettingsMutation.isPending}
                  data-testid="button-save-notifications"
                >
                  {updateSettingsMutation.isPending ? (
                    <>
                      <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Notification Settings
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Tenant Screening Credentials */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-primary" />
                <CardTitle>Tenant Screening</CardTitle>
              </div>
              <CardDescription>
                Connect your Western Verify account for tenant screening
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {credentialsLoading ? (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
                </div>
              ) : credentialsStatus?.configured ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${
                        credentialsStatus.status === 'verified' ? 'bg-green-500' :
                        credentialsStatus.status === 'failed' ? 'bg-red-500' :
                        'bg-yellow-500'
                      }`} />
                      <div>
                        <p className="font-medium">Western Verify Connected</p>
                        <p className="text-sm text-muted-foreground">
                          {credentialsStatus.status === 'verified' ? (
                            <>Last verified: {credentialsStatus.lastVerifiedAt 
                              ? new Date(credentialsStatus.lastVerifiedAt).toLocaleDateString()
                              : 'Unknown'}</>
                          ) : credentialsStatus.status === 'failed' ? (
                            <>Error: {credentialsStatus.lastErrorMessage || 'Verification failed'}</>
                          ) : (
                            'Pending verification'
                          )}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteCredentialsMutation.mutate()}
                      disabled={deleteCredentialsMutation.isPending}
                      data-testid="button-remove-credentials"
                    >
                      {deleteCredentialsMutation.isPending ? (
                        <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remove
                        </>
                      )}
                    </Button>
                  </div>
                  {credentialsStatus.hasDefaultInvitation && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>Default screening package configured</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Enter your Western Verify credentials to enable tenant screening. Your credentials are encrypted and stored securely.
                  </p>
                  
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="screening-username">Username</Label>
                      <Input
                        id="screening-username"
                        placeholder="Your Western Verify username"
                        value={screeningUsername}
                        onChange={(e) => setScreeningUsername(e.target.value)}
                        data-testid="input-screening-username"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="screening-password">Password</Label>
                      <div className="relative">
                        <Input
                          id="screening-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Your Western Verify password"
                          value={screeningPassword}
                          onChange={(e) => setScreeningPassword(e.target.value)}
                          data-testid="input-screening-password"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setShowPassword(!showPassword)}
                          data-testid="button-toggle-password"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {testInvitations.length > 0 && (
                    <div className="space-y-2">
                      <Label htmlFor="screening-invitation">Default Screening Package</Label>
                      <Select value={selectedInvitation} onValueChange={setSelectedInvitation}>
                        <SelectTrigger id="screening-invitation" data-testid="select-screening-invitation">
                          <SelectValue placeholder="Select a package (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          {testInvitations.map((inv) => (
                            <SelectItem key={inv.id} value={inv.id}>
                              {inv.name || inv.description || inv.id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Choose a default screening package for new applications
                      </p>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 justify-end">
                    <Button
                      variant="outline"
                      onClick={handleTestCredentials}
                      disabled={testCredentialsMutation.isPending || !screeningUsername || !screeningPassword}
                      data-testid="button-test-credentials"
                    >
                      {testCredentialsMutation.isPending ? (
                        <>
                          <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                          Testing...
                        </>
                      ) : (
                        <>
                          <Shield className="mr-2 h-4 w-4" />
                          Test Credentials
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={handleSaveCredentials}
                      disabled={saveCredentialsMutation.isPending || !screeningUsername || !screeningPassword}
                      data-testid="button-save-credentials"
                    >
                      {saveCredentialsMutation.isPending ? (
                        <>
                          <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save Credentials
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
              
              <Separator />
              
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <Shield className="h-4 w-4 mt-0.5" />
                <div>
                  <p>Your credentials are encrypted using AES-256-GCM before storage.</p>
                  <p className="mt-1">
                    Don't have a Western Verify account?{" "}
                    <a 
                      href="https://www.westernverify.com" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      Sign up here
                      <ExternalLink className="inline-block ml-1 h-3 w-3" />
                    </a>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Subscription */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                <CardTitle>Subscription</CardTitle>
              </div>
              <CardDescription>
                Manage your LeaseShield subscription and billing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium">Current Plan</p>
                  <div className="flex items-center gap-2 mt-1">
                    {getSubscriptionStatusBadge()}
                    {user.subscriptionStatus === 'trialing' && user.trialEndsAt && (
                      <span className="text-sm text-muted-foreground">
                        Trial ends {new Date(user.trialEndsAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <Link href="/billing">
                  <Button variant="outline" data-testid="button-manage-subscription">
                    <Mail className="mr-2 h-4 w-4" />
                    Manage Subscription
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
              <p className="text-sm text-muted-foreground">
                View billing history, update payment methods, or change your subscription plan.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
