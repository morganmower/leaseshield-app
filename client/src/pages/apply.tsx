import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Building2,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Save,
  Users,
  UserPlus,
  Loader2,
  Home,
  FileText,
  Clock,
  Upload,
  Trash2,
  File,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/logo";

interface ApplicationLinkData {
  id: string;
  propertyName: string;
  unitLabel: string;
  coverPage: {
    title: string;
    intro: string;
    sections: Array<{ id: string; heading: string; body: string }>;
    footerNote: string;
  };
  fieldSchema: {
    stateScope: string;
    fields: Record<string, { visibility: "required" | "optional" | "hidden" }>;
    historyRules: { minAddressYears: number; minEmploymentYears: number };
    uploads: Record<string, { required: boolean; label: string }>;
  };
}

interface PersonData {
  personId: string;
  personType: string;
  email: string;
  firstName: string;
  lastName: string;
  formData: Record<string, any>;
  submissionStatus: string;
}

const STEPS = [
  { id: "cover", label: "Welcome", icon: FileText },
  { id: "info", label: "Basic Info", icon: Users },
  { id: "address", label: "Address History", icon: Home },
  { id: "employment", label: "Employment", icon: Building2 },
  { id: "uploads", label: "Documents", icon: Upload },
  { id: "review", label: "Review & Submit", icon: CheckCircle },
];

export default function Apply() {
  const [location] = useLocation();
  const { toast } = useToast();
  
  // Detect if this is an invite flow (/apply/join/:token) vs regular (/apply/:token)
  const isInviteFlow = location.startsWith('/apply/join/');
  const token = location.split('/').pop() || '';
  
  const [currentStep, setCurrentStep] = useState(0);
  const [hasAcknowledged, setHasAcknowledged] = useState(false);
  const [personToken, setPersonToken] = useState<string | null>(() => {
    // For invite flows, the URL token IS the person token
    if (isInviteFlow) return token;
    return localStorage.getItem(`apply_${token}_personToken`);
  });
  const [applicationLinkId, setApplicationLinkId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveAbortController, setSaveAbortController] = useState<AbortController | null>(null);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", firstName: "", lastName: "", personType: "coapplicant" });

  // For invite flow, we need to get submission info from person endpoint
  const { data: personData, refetch: refetchPerson, isLoading: isLoadingPerson } = useQuery<PersonData & { applicationLinkId?: string }>({
    queryKey: ["/api/apply/person", personToken],
    queryFn: async () => {
      const res = await fetch(`/api/apply/person/${personToken}`);
      if (!res.ok) throw new Error("Failed to load application data");
      return res.json();
    },
    enabled: !!personToken,
  });

  // Fetch application link data (skip for invite flow until we get link ID from person data)
  const linkToken = isInviteFlow ? null : token;
  const { data: linkData, isLoading: isLoadingLink, error: linkError } = useQuery<ApplicationLinkData>({
    queryKey: ["/api/apply", linkToken],
    queryFn: async () => {
      const res = await fetch(`/api/apply/${linkToken}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to load application");
      }
      return res.json();
    },
    enabled: !!linkToken && !isInviteFlow,
  });

  // Initialize form data from saved data
  useEffect(() => {
    if (personData?.formData && Object.keys(personData.formData).length > 0) {
      setFormData(personData.formData);
      if (personData.submissionStatus === "submitted") {
        setCurrentStep(STEPS.length - 1);
      } else {
        setCurrentStep(1); // Skip cover page if resuming
      }
    }
  }, [personData]);

  // Start application mutation
  const startMutation = useMutation({
    mutationFn: async (data: { email: string; firstName: string; lastName: string }) => {
      const res = await fetch(`/api/apply/${token}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to start application");
      return res.json();
    },
    onSuccess: (data) => {
      setPersonToken(data.personToken);
      localStorage.setItem(`apply_${token}_personToken`, data.personToken);
      setCurrentStep(1);
      toast({ title: "Application Started", description: "Your progress will be saved automatically." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to start application.", variant: "destructive" });
    },
  });

  // Save progress mutation
  const saveMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await fetch(`/api/apply/person/${personToken}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formData: data }),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
  });

  // Debounced autosave
  const autosave = useCallback(
    async (data: Record<string, any>) => {
      if (!personToken) return;
      setIsSaving(true);
      try {
        await saveMutation.mutateAsync(data);
      } finally {
        setIsSaving(false);
      }
    },
    [personToken, saveMutation]
  );

  // Auto-save on form data change
  useEffect(() => {
    if (!personToken || Object.keys(formData).length === 0) return;
    const timer = setTimeout(() => autosave(formData), 2000);
    return () => clearTimeout(timer);
  }, [formData, personToken, autosave]);

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/apply/person/${personToken}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formData }),
      });
      if (!res.ok) throw new Error("Failed to submit");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Application Submitted!", description: "The landlord will review your application." });
      refetchPerson();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit application.", variant: "destructive" });
    },
  });

  // Invite mutation
  const inviteMutation = useMutation({
    mutationFn: async (data: typeof inviteForm) => {
      const res = await fetch(`/api/apply/${personToken}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to send invite");
      return res.json();
    },
    onSuccess: (data) => {
      const inviteUrl = `${window.location.origin}/apply/join/${data.inviteToken}`;
      navigator.clipboard.writeText(inviteUrl);
      toast({ title: "Invite Created", description: "Invite link copied to clipboard!" });
      setIsInviteDialogOpen(false);
      setInviteForm({ email: "", firstName: "", lastName: "", personType: "co_applicant" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create invite.", variant: "destructive" });
    },
  });

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const formatMonthYear = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}/${digits.slice(2, 6)}`;
  };

  const updateMonthYearField = (field: string, value: string) => {
    updateField(field, formatMonthYear(value));
  };

  const getFieldVisibility = (field: string): "required" | "optional" | "hidden" => {
    return linkData?.fieldSchema?.fields?.[field]?.visibility || "optional";
  };

  const isFieldVisible = (field: string) => getFieldVisibility(field) !== "hidden";
  const isFieldRequired = (field: string) => getFieldVisibility(field) === "required";

  if (isLoadingLink) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center">
            <Skeleton className="h-12 w-48 mx-auto mb-4" />
            <Skeleton className="h-6 w-64 mx-auto" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (linkError || !linkData) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center p-8">
          <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Application Not Available</h2>
          <p className="text-muted-foreground">
            {(linkError as Error)?.message || "This application link is invalid or has expired."}
          </p>
        </Card>
      </div>
    );
  }

  // Already submitted
  if (personData?.submissionStatus === "submitted") {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center p-8">
          <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Application Submitted</h2>
          <p className="text-muted-foreground mb-4">
            Thank you for applying to {linkData.propertyName}
            {linkData.unitLabel && ` - ${linkData.unitLabel}`}. 
            The landlord will review your application and contact you.
          </p>
          <Badge variant="secondary" className="text-base px-4 py-2">
            <Clock className="h-4 w-4 mr-2" />
            Under Review
          </Badge>
        </Card>
      </div>
    );
  }

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-3xl mx-auto p-4 sm:p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <Logo variant="stacked" size="md" className="mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground">
            {linkData.propertyName}
            {linkData.unitLabel && <span className="text-muted-foreground font-normal"> - {linkData.unitLabel}</span>}
          </h1>
          <p className="text-muted-foreground">Rental Application</p>
        </div>

        {/* Progress */}
        {currentStep > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">
                Step {currentStep + 1} of {STEPS.length}
              </span>
              {isSaving && (
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Saving...
                </span>
              )}
            </div>
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between mt-2">
              {STEPS.map((step, idx) => (
                <div
                  key={step.id}
                  className={`flex flex-col items-center ${
                    idx <= currentStep ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <step.icon className="h-4 w-4 hidden sm:block" />
                  <span className="text-xs hidden sm:block">{step.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Card>
          {/* Step 0: Cover Page */}
          {currentStep === 0 && (
            <>
              <CardHeader className="text-center border-b pb-6">
                <CardTitle className="text-2xl">{linkData.coverPage?.title || "Application Requirements"}</CardTitle>
                <CardDescription className="text-base mt-2">
                  {linkData.coverPage?.intro}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                {linkData.coverPage?.sections?.map((section) => (
                  <div key={section.id} className="border-b pb-4 last:border-0">
                    <h3 className="font-semibold mb-1">{section.heading}</h3>
                    <p className="text-sm text-muted-foreground">{section.body}</p>
                  </div>
                ))}

                {linkData.coverPage?.footerNote && (
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="acknowledge"
                        checked={hasAcknowledged}
                        onCheckedChange={(checked) => setHasAcknowledged(!!checked)}
                        data-testid="checkbox-acknowledge"
                      />
                      <Label htmlFor="acknowledge" className="text-sm cursor-pointer">
                        {linkData.coverPage.footerNote}
                      </Label>
                    </div>
                  </div>
                )}

                {/* Start form */}
                {!personToken && hasAcknowledged && (
                  <div className="space-y-4 pt-4 border-t">
                    <h3 className="font-semibold">Get Started</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>First Name *</Label>
                        <Input
                          value={formData.firstName || ""}
                          onChange={(e) => updateField("firstName", e.target.value)}
                          data-testid="input-apply-firstname"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Last Name *</Label>
                        <Input
                          value={formData.lastName || ""}
                          onChange={(e) => updateField("lastName", e.target.value)}
                          data-testid="input-apply-lastname"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Email *</Label>
                      <Input
                        type="email"
                        value={formData.email || ""}
                        onChange={(e) => updateField("email", e.target.value)}
                        data-testid="input-apply-email"
                      />
                    </div>
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex justify-end border-t pt-6">
                {!personToken ? (
                  <Button
                    onClick={() => startMutation.mutate({
                      email: formData.email,
                      firstName: formData.firstName,
                      lastName: formData.lastName,
                    })}
                    disabled={!hasAcknowledged || !formData.email || !formData.firstName || !formData.lastName || startMutation.isPending}
                    data-testid="button-start-application"
                  >
                    {startMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Start Application
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                ) : (
                  <Button onClick={() => setCurrentStep(1)} data-testid="button-continue-application">
                    Continue
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </CardFooter>
            </>
          )}

          {/* Step 1: Basic Info */}
          {currentStep === 1 && (
            <>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>Tell us about yourself</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>First Name *</Label>
                    <Input
                      value={formData.firstName || personData?.firstName || ""}
                      onChange={(e) => updateField("firstName", e.target.value)}
                      data-testid="input-info-firstname"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Last Name *</Label>
                    <Input
                      value={formData.lastName || personData?.lastName || ""}
                      onChange={(e) => updateField("lastName", e.target.value)}
                      data-testid="input-info-lastname"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    value={formData.email || personData?.email || ""}
                    onChange={(e) => updateField("email", e.target.value)}
                    data-testid="input-info-email"
                  />
                </div>

                {isFieldVisible("phone") && (
                  <div className="space-y-2">
                    <Label>Phone {isFieldRequired("phone") && "*"}</Label>
                    <Input
                      type="tel"
                      value={formData.phone || ""}
                      onChange={(e) => updateField("phone", e.target.value)}
                      placeholder="(555) 123-4567"
                      data-testid="input-info-phone"
                    />
                  </div>
                )}

                {isFieldVisible("dlNumber") && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Driver's License # {isFieldRequired("dlNumber") && "*"}</Label>
                      <Input
                        value={formData.dlNumber || ""}
                        onChange={(e) => updateField("dlNumber", e.target.value)}
                        data-testid="input-info-dl"
                      />
                    </div>
                    {isFieldVisible("dlState") && (
                      <div className="space-y-2">
                        <Label>DL State {isFieldRequired("dlState") && "*"}</Label>
                        <Input
                          value={formData.dlState || ""}
                          onChange={(e) => updateField("dlState", e.target.value)}
                          maxLength={2}
                          placeholder="UT"
                          data-testid="input-info-dlstate"
                        />
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex justify-between border-t pt-6">
                <Button variant="outline" onClick={() => setCurrentStep(0)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button onClick={() => setCurrentStep(2)} data-testid="button-next-step">
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardFooter>
            </>
          )}

          {/* Step 2: Address History */}
          {currentStep === 2 && (
            <>
              <CardHeader>
                <CardTitle>Address History</CardTitle>
                <CardDescription>
                  Please provide at least {linkData.fieldSchema?.historyRules?.minAddressYears || 2} years of address history
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Current Address *</Label>
                  <Input
                    value={formData.currentAddress || ""}
                    onChange={(e) => updateField("currentAddress", e.target.value)}
                    placeholder="123 Main St, City, State ZIP"
                    data-testid="input-address-current"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Move-in Date</Label>
                    <Input
                      type="text"
                      placeholder="MM/YYYY"
                      value={formatMonthYear(formData.currentMoveIn || "")}
                      onChange={(e) => updateMonthYearField("currentMoveIn", e.target.value)}
                      maxLength={7}
                      data-testid="input-address-movein"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Monthly Rent</Label>
                    <Input
                      type="number"
                      value={formData.currentRent || ""}
                      onChange={(e) => updateField("currentRent", e.target.value)}
                      placeholder="1200"
                      data-testid="input-address-rent"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Landlord Name</Label>
                  <Input
                    value={formData.currentLandlord || ""}
                    onChange={(e) => updateField("currentLandlord", e.target.value)}
                    data-testid="input-address-landlord"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Landlord Phone</Label>
                  <Input
                    type="tel"
                    value={formData.currentLandlordPhone || ""}
                    onChange={(e) => updateField("currentLandlordPhone", e.target.value)}
                    data-testid="input-address-landlordphone"
                  />
                </div>

                {isFieldVisible("previousAddresses") && (
                  <div className="pt-4 border-t">
                    <Label className="mb-2 block">Previous Address (if less than 2 years at current)</Label>
                    <Input
                      value={formData.previousAddress || ""}
                      onChange={(e) => updateField("previousAddress", e.target.value)}
                      placeholder="456 Oak Ave, City, State ZIP"
                      data-testid="input-address-previous"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Reason for Moving</Label>
                  <Textarea
                    value={formData.reasonForMoving || ""}
                    onChange={(e) => updateField("reasonForMoving", e.target.value)}
                    placeholder="Why are you looking for a new place?"
                    data-testid="input-address-reason"
                  />
                </div>
              </CardContent>
              <CardFooter className="flex justify-between border-t pt-6">
                <Button variant="outline" onClick={() => setCurrentStep(1)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button onClick={() => setCurrentStep(3)} data-testid="button-next-step-3">
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardFooter>
            </>
          )}

          {/* Step 3: Employment */}
          {currentStep === 3 && (
            <>
              <CardHeader>
                <CardTitle>Employment Information</CardTitle>
                <CardDescription>
                  Please provide at least {linkData.fieldSchema?.historyRules?.minEmploymentYears || 2} years of employment history
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Current Employer *</Label>
                  <Input
                    value={formData.employer || ""}
                    onChange={(e) => updateField("employer", e.target.value)}
                    data-testid="input-employment-employer"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Job Title *</Label>
                  <Input
                    value={formData.jobTitle || ""}
                    onChange={(e) => updateField("jobTitle", e.target.value)}
                    data-testid="input-employment-title"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input
                      type="text"
                      placeholder="MM/YYYY"
                      value={formatMonthYear(formData.employmentStart || "")}
                      onChange={(e) => updateMonthYearField("employmentStart", e.target.value)}
                      maxLength={7}
                      data-testid="input-employment-start"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Monthly Income *</Label>
                    <Input
                      type="number"
                      value={formData.monthlyIncome || ""}
                      onChange={(e) => updateField("monthlyIncome", e.target.value)}
                      placeholder="5000"
                      data-testid="input-employment-income"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Supervisor Name</Label>
                  <Input
                    value={formData.supervisorName || ""}
                    onChange={(e) => updateField("supervisorName", e.target.value)}
                    data-testid="input-employment-supervisor"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Supervisor Phone</Label>
                  <Input
                    type="tel"
                    value={formData.supervisorPhone || ""}
                    onChange={(e) => updateField("supervisorPhone", e.target.value)}
                    data-testid="input-employment-supervisorphone"
                  />
                </div>

                {isFieldVisible("emergencyContact") && (
                  <div className="pt-4 border-t space-y-4">
                    <h3 className="font-semibold">Emergency Contact {isFieldRequired("emergencyContact") && "*"}</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Name</Label>
                        <Input
                          value={formData.emergencyContactName || ""}
                          onChange={(e) => updateField("emergencyContactName", e.target.value)}
                          data-testid="input-emergency-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Phone</Label>
                        <Input
                          type="tel"
                          value={formData.emergencyContactPhone || ""}
                          onChange={(e) => updateField("emergencyContactPhone", e.target.value)}
                          data-testid="input-emergency-phone"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Relationship</Label>
                      <Input
                        value={formData.emergencyContactRelation || ""}
                        onChange={(e) => updateField("emergencyContactRelation", e.target.value)}
                        placeholder="e.g., Parent, Spouse, Sibling"
                        data-testid="input-emergency-relation"
                      />
                    </div>
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex justify-between border-t pt-6">
                <Button variant="outline" onClick={() => setCurrentStep(2)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button onClick={() => setCurrentStep(4)} data-testid="button-next-step-4">
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardFooter>
            </>
          )}

          {/* Step 4: Review & Submit */}
          {currentStep === 4 && (
            <>
              <CardHeader>
                <CardTitle>Review & Submit</CardTitle>
                <CardDescription>Review your application before submitting</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Basic Information
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-muted-foreground">Name:</span>
                    <span>{formData.firstName || personData?.firstName} {formData.lastName || personData?.lastName}</span>
                    <span className="text-muted-foreground">Email:</span>
                    <span>{formData.email || personData?.email}</span>
                    {formData.phone && (
                      <>
                        <span className="text-muted-foreground">Phone:</span>
                        <span>{formData.phone}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Home className="h-4 w-4" />
                    Current Address
                  </h3>
                  <p className="text-sm">{formData.currentAddress || "Not provided"}</p>
                </div>

                <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Employment
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-muted-foreground">Employer:</span>
                    <span>{formData.employer || "Not provided"}</span>
                    <span className="text-muted-foreground">Title:</span>
                    <span>{formData.jobTitle || "Not provided"}</span>
                    <span className="text-muted-foreground">Monthly Income:</span>
                    <span>{formData.monthlyIncome ? `$${formData.monthlyIncome}` : "Not provided"}</span>
                  </div>
                </div>

                {/* Add co-applicant option */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">Add Co-Applicant or Guarantor</h3>
                      <p className="text-sm text-muted-foreground">
                        You can invite additional people to join this application
                      </p>
                    </div>
                    <Button variant="outline" onClick={() => setIsInviteDialogOpen(true)} data-testid="button-invite-person">
                      <UserPlus className="h-4 w-4 mr-2" />
                      Invite
                    </Button>
                  </div>
                </div>

                <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="certify"
                      checked={formData.certifyAccurate || false}
                      onCheckedChange={(checked) => updateField("certifyAccurate", !!checked)}
                      data-testid="checkbox-certify"
                    />
                    <Label htmlFor="certify" className="text-sm cursor-pointer">
                      I certify that all information provided in this application is true and accurate. 
                      I authorize the landlord to verify the information provided and to obtain a 
                      consumer credit report and background check.
                    </Label>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between border-t pt-6">
                <Button variant="outline" onClick={() => setCurrentStep(3)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button
                  onClick={() => submitMutation.mutate()}
                  disabled={!formData.certifyAccurate || submitMutation.isPending}
                  data-testid="button-submit-application"
                >
                  {submitMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Submit Application
                </Button>
              </CardFooter>
            </>
          )}
        </Card>

        {/* Invite Dialog */}
        <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Someone to This Application</DialogTitle>
              <DialogDescription>
                Send an invite link to a co-applicant or guarantor
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First Name *</Label>
                  <Input
                    value={inviteForm.firstName}
                    onChange={(e) => setInviteForm({ ...inviteForm, firstName: e.target.value })}
                    data-testid="input-invite-firstname"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Last Name *</Label>
                  <Input
                    value={inviteForm.lastName}
                    onChange={(e) => setInviteForm({ ...inviteForm, lastName: e.target.value })}
                    data-testid="input-invite-lastname"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  data-testid="input-invite-email"
                />
              </div>
              <div className="space-y-2">
                <Label>Role *</Label>
                <Select
                  value={inviteForm.personType}
                  onValueChange={(value) => setInviteForm({ ...inviteForm, personType: value })}
                >
                  <SelectTrigger data-testid="select-invite-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="co_applicant">Co-Applicant</SelectItem>
                    <SelectItem value="guarantor">Guarantor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsInviteDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => inviteMutation.mutate(inviteForm)}
                disabled={!inviteForm.email || !inviteForm.firstName || !inviteForm.lastName || inviteMutation.isPending}
                data-testid="button-send-invite"
              >
                {inviteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Invite Link
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
