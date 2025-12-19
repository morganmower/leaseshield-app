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
  PawPrint,
  Plus,
  Car,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/logo";

interface DocumentRequirementsConfig {
  id: boolean;
  income: boolean;
  bank: boolean;
  reference: boolean;
}

interface ComplianceRule {
  id: string;
  stateId: string;
  ruleType: 'acknowledgment' | 'disclosure' | 'authorization' | 'document_required' | 'link_required';
  ruleKey: string;
  title: string;
  description?: string;
  checkboxLabel?: string;
  disclosureText?: string;
  linkUrl?: string;
  linkText?: string;
  statuteReference?: string;
  sortOrder: number;
  isActive: boolean;
  effectiveDate?: string;
  version: number;
}

interface ApplicationLinkData {
  id: string;
  propertyName: string;
  unitLabel: string;
  propertyState: string | null; // For state-specific compliance (e.g., TX)
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
  documentRequirements?: DocumentRequirementsConfig;
  complianceRules?: ComplianceRule[]; // Dynamic compliance rules from database
}

interface PersonData {
  personId: string;
  personType: string;
  email: string;
  firstName: string;
  lastName: string;
  formData: Record<string, any>;
  submissionStatus: string;
  isCompleted?: boolean;
}

const STEPS = [
  { id: "cover", label: "Welcome", icon: FileText },
  { id: "info", label: "Basic Info", icon: Users },
  { id: "address", label: "Address History", icon: Home },
  { id: "employment", label: "Employment", icon: Building2 },
  { id: "pets", label: "Pets", icon: PawPrint },
  { id: "vehicles", label: "Vehicles", icon: Car },
  { id: "uploads", label: "Documents", icon: Upload },
  { id: "review", label: "Review & Submit", icon: CheckCircle },
];

interface UploadedFile {
  id: string;
  fileType: string;
  originalName: string;
  fileSize: number;
  createdAt: string;
}

const getUploadTypes = (requirements?: DocumentRequirementsConfig) => [
  { id: "id", label: "Government-issued ID", required: true }, // Always required
  { id: "income", label: "Proof of Income (paystubs, employment letter)", required: requirements?.income ?? false },
  { id: "bank", label: "Bank Statements", required: requirements?.bank ?? false },
  { id: "reference", label: "Reference Letters", required: requirements?.reference ?? false },
  { id: "other", label: "Other Documents", required: false },
];

function UploadDocumentsStep({ personToken, onBack, onNext, documentRequirements }: { 
  personToken: string; 
  onBack: () => void; 
  onNext: () => void;
  documentRequirements?: DocumentRequirementsConfig;
}) {
  const UPLOAD_TYPES = getUploadTypes(documentRequirements);
  const { toast } = useToast();
  const [uploadingType, setUploadingType] = useState<string | null>(null);

  const { data: files = [], refetch: refetchFiles, isLoading } = useQuery<UploadedFile[]>({
    queryKey: ["/api/apply/person", personToken, "files"],
    queryFn: async () => {
      const res = await fetch(`/api/apply/person/${personToken}/files`);
      if (!res.ok) throw new Error("Failed to load files");
      return res.json();
    },
    enabled: !!personToken,
  });

  const uploadFile = async (file: globalThis.File, fileType: string) => {
    setUploadingType(fileType);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("fileType", fileType);

    try {
      const res = await fetch(`/api/apply/person/${personToken}/upload`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Upload failed");
      }
      toast({ title: "File Uploaded", description: `${file.name} uploaded successfully.` });
      refetchFiles();
    } catch (error: any) {
      toast({ title: "Upload Error", description: error.message, variant: "destructive" });
    } finally {
      setUploadingType(null);
    }
  };

  const deleteFile = async (fileId: string) => {
    try {
      const res = await fetch(`/api/apply/person/${personToken}/files/${fileId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      toast({ title: "File Deleted" });
      refetchFiles();
    } catch (error) {
      toast({ title: "Delete Error", description: "Failed to delete file.", variant: "destructive" });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFilesForType = (fileType: string) => files.filter((f) => f.fileType === fileType);

  return (
    <>
      <CardHeader>
        <CardTitle>Upload Documents</CardTitle>
        <CardDescription>
          Upload required documents to support your application. Accepted formats: PDF, JPG, PNG (max 10MB each).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="text-sm text-amber-800 dark:text-amber-200">
              <p className="font-medium">Document Review Notice</p>
              <p className="mt-1">
                Documents uploaded here are provided for landlord/property manager review only. 
                LeaseShield does not verify authenticity or interpret financial documents.
              </p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {UPLOAD_TYPES.map((type) => {
              const typeFiles = getFilesForType(type.id);
              const isUploading = uploadingType === type.id;

              return (
                <div
                  key={type.id}
                  className="border rounded-lg p-4 space-y-3"
                  data-testid={`upload-section-${type.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Upload className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{type.label}</span>
                      {type.required && (
                        <Badge variant="secondary" className="text-xs">Required</Badge>
                      )}
                    </div>
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) uploadFile(file, type.id);
                          e.target.value = "";
                        }}
                        disabled={isUploading}
                        data-testid={`input-file-${type.id}`}
                      />
                      <Button variant="outline" size="sm" disabled={isUploading} asChild>
                        <span>
                          {isUploading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Upload className="h-4 w-4 mr-1" />
                              Upload
                            </>
                          )}
                        </span>
                      </Button>
                    </label>
                  </div>

                  {typeFiles.length > 0 && (
                    <div className="space-y-2">
                      {typeFiles.map((f) => (
                        <div
                          key={f.id}
                          className="flex items-center justify-between bg-muted/50 p-2 rounded"
                          data-testid={`file-item-${f.id}`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <File className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="text-sm truncate">{f.originalName}</span>
                            <span className="text-xs text-muted-foreground">({formatFileSize(f.fileSize)})</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteFile(f.id)}
                            data-testid={`button-delete-file-${f.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {typeFiles.length === 0 && (
                    <p className="text-sm text-muted-foreground">No files uploaded yet</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          <p>
            <strong>Document Storage & Retention:</strong> Uploaded documents are stored to support the rental 
            application process and recordkeeping. By default, documents for denied or withdrawn applications 
            are retained for 2 years, and documents for approved tenants are retained for the duration of 
            tenancy plus 7 years, unless the landlord/property manager configures different retention settings.
          </p>
        </div>

        {/* Required documents validation */}
        {(() => {
          const missingRequired = UPLOAD_TYPES.filter(
            (type) => type.required && files.filter(f => f.fileType === type.id).length === 0
          );
          if (missingRequired.length > 0) {
            return (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive">
                <strong>Missing required documents:</strong>
                <ul className="mt-1 list-disc list-inside">
                  {missingRequired.map(type => (
                    <li key={type.id}>{type.label}</li>
                  ))}
                </ul>
              </div>
            );
          }
          return null;
        })()}
      </CardContent>
      <CardFooter className="flex justify-between border-t pt-6">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button 
          onClick={onNext} 
          data-testid="button-next-step-6"
          disabled={UPLOAD_TYPES.some(type => type.required && files.filter(f => f.fileType === type.id).length === 0)}
        >
          Next
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </CardFooter>
    </>
  );
}

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
      // Don't reset step if person has already completed - confirmation page will show
      if (!personData.isCompleted) {
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
        body: JSON.stringify({ 
          formData,
          userAgent: navigator.userAgent, // Capture for screening disclosure audit
        }),
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

  // Already submitted - allow starting a new application for a different person
  const handleStartNewApplication = () => {
    localStorage.removeItem(`apply_${token}_personToken`);
    setPersonToken(null);
    setFormData({});
    setCurrentStep(0);
    setHasAcknowledged(false);
  };

  if (personData?.isCompleted) {
    const allSubmitted = personData.submissionStatus === "submitted";
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center p-8">
          <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">
            {allSubmitted ? "Application Submitted" : "Your Application is Complete"}
          </h2>
          <p className="text-muted-foreground mb-4">
            Thank you for applying to {linkData.propertyName}
            {linkData.unitLabel && ` - ${linkData.unitLabel}`}. 
            {allSubmitted 
              ? "The landlord will review your application and contact you."
              : "We're waiting for other applicants to complete their portions. Once everyone submits, your application will be sent to the landlord for review."
            }
          </p>
          <Badge variant="secondary" className="text-base px-4 py-2 mb-6">
            <Clock className="h-4 w-4 mr-2" />
            {allSubmitted ? "Under Review" : "Waiting for Co-Applicants"}
          </Badge>
          <div className="border-t pt-4 mt-4">
            <p className="text-sm text-muted-foreground mb-3">
              Not {personData.firstName}? Start a new application.
            </p>
            <Button variant="outline" onClick={handleStartNewApplication} data-testid="button-start-new-application">
              Start New Application
            </Button>
          </div>
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
          <Logo variant="stacked" className="h-64 w-auto mx-auto mb-4" />
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

                <div className="space-y-2">
                  <Label>Desired Move-in Date *</Label>
                  <Input
                    type="date"
                    value={formData.desiredMoveInDate || ""}
                    onChange={(e) => updateField("desiredMoveInDate", e.target.value)}
                    data-testid="input-desired-movein"
                  />
                  <p className="text-xs text-muted-foreground">When would you like to move into this property?</p>
                </div>

                {/* Occupants Section */}
                <div className="pt-4 border-t space-y-4">
                  <div>
                    <h3 className="font-semibold">Additional Occupants</h3>
                    <p className="text-sm text-muted-foreground">
                      List any other people who will live in the unit but are not signing the lease (e.g., children, elderly parents)
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Will anyone else be living with you?</Label>
                    <div className="flex gap-4">
                      <Button
                        type="button"
                        variant={formData.hasOccupants === true ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          updateField("hasOccupants", true);
                          if (!formData.occupants?.length) {
                            updateField("occupants", [{ name: "", relationship: "", age: "" }]);
                          }
                        }}
                        data-testid="button-occupants-yes"
                      >
                        Yes
                      </Button>
                      <Button
                        type="button"
                        variant={formData.hasOccupants === false ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          updateField("hasOccupants", false);
                          updateField("occupants", []);
                        }}
                        data-testid="button-occupants-no"
                      >
                        No
                      </Button>
                    </div>
                  </div>

                  {formData.hasOccupants && (
                    <div className="space-y-3">
                      {(formData.occupants || []).map((occupant: { name: string; relationship: string; age: string }, idx: number) => (
                        <div key={idx} className="border rounded-lg p-3 space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium">Occupant {idx + 1}</span>
                            {idx > 0 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const updated = [...(formData.occupants || [])];
                                  updated.splice(idx, 1);
                                  updateField("occupants", updated);
                                }}
                                data-testid={`button-remove-occupant-${idx}`}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Full Name</Label>
                              <Input
                                value={occupant.name || ""}
                                onChange={(e) => {
                                  const updated = [...(formData.occupants || [])];
                                  updated[idx] = { ...updated[idx], name: e.target.value };
                                  updateField("occupants", updated);
                                }}
                                placeholder="John Doe"
                                data-testid={`input-occupant-name-${idx}`}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Relationship</Label>
                              <Input
                                value={occupant.relationship || ""}
                                onChange={(e) => {
                                  const updated = [...(formData.occupants || [])];
                                  updated[idx] = { ...updated[idx], relationship: e.target.value };
                                  updateField("occupants", updated);
                                }}
                                placeholder="Child, Parent, etc."
                                data-testid={`input-occupant-relationship-${idx}`}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Age</Label>
                              <Input
                                type="number"
                                value={occupant.age || ""}
                                onChange={(e) => {
                                  const updated = [...(formData.occupants || [])];
                                  updated[idx] = { ...updated[idx], age: e.target.value };
                                  updateField("occupants", updated);
                                }}
                                placeholder="Age"
                                data-testid={`input-occupant-age-${idx}`}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const updated = [...(formData.occupants || []), { name: "", relationship: "", age: "" }];
                          updateField("occupants", updated);
                        }}
                        data-testid="button-add-occupant"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Another Occupant
                      </Button>
                    </div>
                  )}
                </div>
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
                  <Label>Current Housing Situation *</Label>
                  <Select
                    value={formData.housingSituation || ""}
                    onValueChange={(value) => updateField("housingSituation", value)}
                  >
                    <SelectTrigger data-testid="select-housing-situation">
                      <SelectValue placeholder="Select your current situation" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="renting">Renting</SelectItem>
                      <SelectItem value="owning">Own my home</SelectItem>
                      <SelectItem value="family">Living with family/friends</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

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
                    <Label>{formData.housingSituation === "owning" ? "Monthly Mortgage" : "Monthly Rent"}</Label>
                    <Input
                      type="number"
                      value={formData.currentRent || ""}
                      onChange={(e) => updateField("currentRent", e.target.value)}
                      placeholder="1200"
                      data-testid="input-address-rent"
                    />
                  </div>
                </div>

                {formData.housingSituation === "renting" && (
                  <>
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
                  </>
                )}

                {/* Previous Addresses Section */}
                {(formData.previousAddresses || []).map((addr: any, index: number) => (
                  <div key={index} className="pt-4 border-t space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm text-muted-foreground">Previous Address {index + 1}</h3>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const updated = [...(formData.previousAddresses || [])];
                          updated.splice(index, 1);
                          updateField("previousAddresses", updated);
                        }}
                        data-testid={`button-remove-address-${index}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <Label>Housing Situation</Label>
                      <Select
                        value={addr.housingSituation || ""}
                        onValueChange={(value) => {
                          const updated = [...(formData.previousAddresses || [])];
                          updated[index] = { ...updated[index], housingSituation: value };
                          updateField("previousAddresses", updated);
                        }}
                      >
                        <SelectTrigger data-testid={`select-prev-housing-${index}`}>
                          <SelectValue placeholder="Select situation" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="renting">Renting</SelectItem>
                          <SelectItem value="owning">Owned</SelectItem>
                          <SelectItem value="family">Lived with family/friends</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Address *</Label>
                      <Input
                        value={addr.address || ""}
                        onChange={(e) => {
                          const updated = [...(formData.previousAddresses || [])];
                          updated[index] = { ...updated[index], address: e.target.value };
                          updateField("previousAddresses", updated);
                        }}
                        placeholder="456 Oak Ave, City, State ZIP"
                        data-testid={`input-prev-address-${index}`}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Move-in Date</Label>
                        <Input
                          type="text"
                          placeholder="MM/YYYY"
                          value={formatMonthYear(addr.moveIn || "")}
                          onChange={(e) => {
                            const updated = [...(formData.previousAddresses || [])];
                            const raw = e.target.value.replace(/\D/g, "");
                            let formatted = raw;
                            if (raw.length >= 2) {
                              formatted = raw.slice(0, 2) + "/" + raw.slice(2, 6);
                            }
                            updated[index] = { ...updated[index], moveIn: formatted };
                            updateField("previousAddresses", updated);
                          }}
                          maxLength={7}
                          data-testid={`input-prev-movein-${index}`}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Move-out Date</Label>
                        <Input
                          type="text"
                          placeholder="MM/YYYY"
                          value={formatMonthYear(addr.moveOut || "")}
                          onChange={(e) => {
                            const updated = [...(formData.previousAddresses || [])];
                            const raw = e.target.value.replace(/\D/g, "");
                            let formatted = raw;
                            if (raw.length >= 2) {
                              formatted = raw.slice(0, 2) + "/" + raw.slice(2, 6);
                            }
                            updated[index] = { ...updated[index], moveOut: formatted };
                            updateField("previousAddresses", updated);
                          }}
                          maxLength={7}
                          data-testid={`input-prev-moveout-${index}`}
                        />
                      </div>
                    </div>
                    {addr.housingSituation === "renting" && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Landlord Name</Label>
                          <Input
                            value={addr.landlordName || ""}
                            onChange={(e) => {
                              const updated = [...(formData.previousAddresses || [])];
                              updated[index] = { ...updated[index], landlordName: e.target.value };
                              updateField("previousAddresses", updated);
                            }}
                            data-testid={`input-prev-landlord-${index}`}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Landlord Phone</Label>
                          <Input
                            type="tel"
                            value={addr.landlordPhone || ""}
                            onChange={(e) => {
                              const updated = [...(formData.previousAddresses || [])];
                              updated[index] = { ...updated[index], landlordPhone: e.target.value };
                              updateField("previousAddresses", updated);
                            }}
                            data-testid={`input-prev-landlordphone-${index}`}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    const current = formData.previousAddresses || [];
                    updateField("previousAddresses", [...current, { housingSituation: "", address: "", moveIn: "", moveOut: "", landlordName: "", landlordPhone: "" }]);
                  }}
                  data-testid="button-add-address"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Previous Address
                </Button>

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
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                  <Checkbox
                    id="notCurrentlyEmployed"
                    checked={formData.notCurrentlyEmployed === true}
                    onCheckedChange={(checked) => updateField("notCurrentlyEmployed", checked)}
                    data-testid="checkbox-not-employed"
                  />
                  <Label htmlFor="notCurrentlyEmployed" className="cursor-pointer text-sm">
                    I am not currently employed
                  </Label>
                </div>

                {!formData.notCurrentlyEmployed && (
                  <>
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
                  </>
                )}

                {/* Previous Employers Section */}
                {(formData.previousEmployers || []).map((emp: any, index: number) => (
                  <div key={index} className="pt-4 border-t space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm text-muted-foreground">Previous Employer {index + 1}</h3>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const updated = [...(formData.previousEmployers || [])];
                          updated.splice(index, 1);
                          updateField("previousEmployers", updated);
                        }}
                        data-testid={`button-remove-employer-${index}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <Label>Employer Name *</Label>
                      <Input
                        value={emp.employer || ""}
                        onChange={(e) => {
                          const updated = [...(formData.previousEmployers || [])];
                          updated[index] = { ...updated[index], employer: e.target.value };
                          updateField("previousEmployers", updated);
                        }}
                        data-testid={`input-prev-employer-${index}`}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Job Title</Label>
                      <Input
                        value={emp.jobTitle || ""}
                        onChange={(e) => {
                          const updated = [...(formData.previousEmployers || [])];
                          updated[index] = { ...updated[index], jobTitle: e.target.value };
                          updateField("previousEmployers", updated);
                        }}
                        data-testid={`input-prev-title-${index}`}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Start Date</Label>
                        <Input
                          type="text"
                          placeholder="MM/YYYY"
                          value={formatMonthYear(emp.startDate || "")}
                          onChange={(e) => {
                            const updated = [...(formData.previousEmployers || [])];
                            const raw = e.target.value.replace(/\D/g, "");
                            let formatted = raw;
                            if (raw.length >= 2) {
                              formatted = raw.slice(0, 2) + "/" + raw.slice(2, 6);
                            }
                            updated[index] = { ...updated[index], startDate: formatted };
                            updateField("previousEmployers", updated);
                          }}
                          maxLength={7}
                          data-testid={`input-prev-start-${index}`}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>End Date</Label>
                        <Input
                          type="text"
                          placeholder="MM/YYYY"
                          value={formatMonthYear(emp.endDate || "")}
                          onChange={(e) => {
                            const updated = [...(formData.previousEmployers || [])];
                            const raw = e.target.value.replace(/\D/g, "");
                            let formatted = raw;
                            if (raw.length >= 2) {
                              formatted = raw.slice(0, 2) + "/" + raw.slice(2, 6);
                            }
                            updated[index] = { ...updated[index], endDate: formatted };
                            updateField("previousEmployers", updated);
                          }}
                          maxLength={7}
                          data-testid={`input-prev-end-${index}`}
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    const current = formData.previousEmployers || [];
                    updateField("previousEmployers", [...current, { employer: "", jobTitle: "", startDate: "", endDate: "" }]);
                  }}
                  data-testid="button-add-employer"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Previous Employer
                </Button>

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

          {/* Step 4: Pets */}
          {currentStep === 4 && (
            <>
              <CardHeader>
                <CardTitle>Pets</CardTitle>
                <CardDescription>Tell us about any pets that will reside in the unit</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <Label className="text-base font-medium">Do you have any pets that will reside in the unit?</Label>
                  <div className="flex gap-6">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="hasPetsYes"
                        checked={formData.hasPets === true}
                        onCheckedChange={() => updateField("hasPets", true)}
                        data-testid="checkbox-has-pets-yes"
                      />
                      <Label htmlFor="hasPetsYes" className="cursor-pointer">Yes</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="hasPetsNo"
                        checked={formData.hasPets === false}
                        onCheckedChange={() => {
                          setFormData(prev => ({ ...prev, hasPets: false, pets: [] }));
                        }}
                        data-testid="checkbox-has-pets-no"
                      />
                      <Label htmlFor="hasPetsNo" className="cursor-pointer">No</Label>
                    </div>
                  </div>
                </div>

                {formData.hasPets === true && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-medium">Pet Details</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const currentPets = formData.pets || [];
                          updateField("pets", [
                            ...currentPets,
                            { id: Date.now().toString(), type: "", breed: "", weight: "", age: "", isServiceAnimal: "" }
                          ]);
                        }}
                        data-testid="button-add-pet"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Pet
                      </Button>
                    </div>

                    {(formData.pets || []).length === 0 && (
                      <p className="text-sm text-muted-foreground">Click "Add Pet" to add your pets.</p>
                    )}

                    {(formData.pets || []).map((pet: any, index: number) => (
                      <div key={pet.id} className="border rounded-lg p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">Pet {index + 1}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const updatedPets = formData.pets.filter((_: any, i: number) => i !== index);
                              updateField("pets", updatedPets);
                            }}
                            data-testid={`button-remove-pet-${index}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Type (dog, cat, etc.) *</Label>
                            <Input
                              value={pet.type || ""}
                              onChange={(e) => {
                                const updatedPets = [...formData.pets];
                                updatedPets[index] = { ...pet, type: e.target.value };
                                updateField("pets", updatedPets);
                              }}
                              placeholder="e.g., Dog, Cat, Bird"
                              data-testid={`input-pet-type-${index}`}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Breed (if applicable)</Label>
                            <Input
                              value={pet.breed || ""}
                              onChange={(e) => {
                                const updatedPets = [...formData.pets];
                                updatedPets[index] = { ...pet, breed: e.target.value };
                                updateField("pets", updatedPets);
                              }}
                              placeholder="e.g., Golden Retriever"
                              data-testid={`input-pet-breed-${index}`}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Weight</Label>
                            <Input
                              value={pet.weight || ""}
                              onChange={(e) => {
                                const updatedPets = [...formData.pets];
                                updatedPets[index] = { ...pet, weight: e.target.value };
                                updateField("pets", updatedPets);
                              }}
                              placeholder="e.g., 25 lbs"
                              data-testid={`input-pet-weight-${index}`}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Age</Label>
                            <Input
                              value={pet.age || ""}
                              onChange={(e) => {
                                const updatedPets = [...formData.pets];
                                updatedPets[index] = { ...pet, age: e.target.value };
                                updateField("pets", updatedPets);
                              }}
                              placeholder="e.g., 3 years"
                              data-testid={`input-pet-age-${index}`}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Is this a service or assistance animal?</Label>
                          <Select
                            value={pet.isServiceAnimal || ""}
                            onValueChange={(value) => {
                              const updatedPets = [...formData.pets];
                              updatedPets[index] = { ...pet, isServiceAnimal: value };
                              updateField("pets", updatedPets);
                            }}
                          >
                            <SelectTrigger data-testid={`select-pet-service-${index}`}>
                              <SelectValue placeholder="Select an option (optional)" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="yes">Yes</SelectItem>
                              <SelectItem value="no">No</SelectItem>
                              <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ))}

                    <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        <strong>Fair Housing Notice:</strong> Under the Fair Housing Act, landlords cannot require documentation 
                        for service or assistance animals at the application stage and cannot charge pet fees or deposits for 
                        service/assistance animals. This question is optional and for informational purposes only.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex justify-between border-t pt-6">
                <Button variant="outline" onClick={() => setCurrentStep(3)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button onClick={() => setCurrentStep(5)} data-testid="button-next-step-5">
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardFooter>
            </>
          )}

          {/* Step 5: Vehicles */}
          {currentStep === 5 && (
            <>
              <CardHeader>
                <CardTitle>Vehicles</CardTitle>
                <CardDescription>Tell us about any vehicles that will be parked at the property</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <Label className="text-base font-medium">Do you have any vehicles that will be parked at the property?</Label>
                  <div className="flex gap-6">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="hasVehiclesYes"
                        checked={formData.hasVehicles === true}
                        onCheckedChange={() => updateField("hasVehicles", true)}
                        data-testid="checkbox-has-vehicles-yes"
                      />
                      <Label htmlFor="hasVehiclesYes" className="cursor-pointer">Yes</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="hasVehiclesNo"
                        checked={formData.hasVehicles === false}
                        onCheckedChange={() => {
                          setFormData(prev => ({ ...prev, hasVehicles: false, vehicles: [] }));
                        }}
                        data-testid="checkbox-has-vehicles-no"
                      />
                      <Label htmlFor="hasVehiclesNo" className="cursor-pointer">No</Label>
                    </div>
                  </div>
                </div>

                {formData.hasVehicles === true && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-medium">Vehicle Details</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const currentVehicles = formData.vehicles || [];
                          updateField("vehicles", [
                            ...currentVehicles,
                            { id: Date.now().toString(), year: "", make: "", model: "", color: "", licensePlate: "", plateState: "" }
                          ]);
                        }}
                        data-testid="button-add-vehicle"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Vehicle
                      </Button>
                    </div>

                    {(formData.vehicles || []).length === 0 && (
                      <p className="text-sm text-muted-foreground">Click "Add Vehicle" to add your vehicles.</p>
                    )}

                    {(formData.vehicles || []).map((vehicle: any, index: number) => (
                      <div key={vehicle.id} className="border rounded-lg p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">Vehicle {index + 1}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const updatedVehicles = formData.vehicles.filter((_: any, i: number) => i !== index);
                              updateField("vehicles", updatedVehicles);
                            }}
                            data-testid={`button-remove-vehicle-${index}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Year *</Label>
                            <Input
                              value={vehicle.year || ""}
                              onChange={(e) => {
                                const updatedVehicles = [...formData.vehicles];
                                updatedVehicles[index] = { ...vehicle, year: e.target.value };
                                updateField("vehicles", updatedVehicles);
                              }}
                              placeholder="e.g., 2020"
                              data-testid={`input-vehicle-year-${index}`}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Make *</Label>
                            <Input
                              value={vehicle.make || ""}
                              onChange={(e) => {
                                const updatedVehicles = [...formData.vehicles];
                                updatedVehicles[index] = { ...vehicle, make: e.target.value };
                                updateField("vehicles", updatedVehicles);
                              }}
                              placeholder="e.g., Toyota"
                              data-testid={`input-vehicle-make-${index}`}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Model *</Label>
                            <Input
                              value={vehicle.model || ""}
                              onChange={(e) => {
                                const updatedVehicles = [...formData.vehicles];
                                updatedVehicles[index] = { ...vehicle, model: e.target.value };
                                updateField("vehicles", updatedVehicles);
                              }}
                              placeholder="e.g., Camry"
                              data-testid={`input-vehicle-model-${index}`}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Color</Label>
                            <Input
                              value={vehicle.color || ""}
                              onChange={(e) => {
                                const updatedVehicles = [...formData.vehicles];
                                updatedVehicles[index] = { ...vehicle, color: e.target.value };
                                updateField("vehicles", updatedVehicles);
                              }}
                              placeholder="e.g., Silver"
                              data-testid={`input-vehicle-color-${index}`}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>License Plate *</Label>
                            <Input
                              value={vehicle.licensePlate || ""}
                              onChange={(e) => {
                                const updatedVehicles = [...formData.vehicles];
                                updatedVehicles[index] = { ...vehicle, licensePlate: e.target.value };
                                updateField("vehicles", updatedVehicles);
                              }}
                              placeholder="e.g., ABC1234"
                              data-testid={`input-vehicle-plate-${index}`}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>State of Registration *</Label>
                            <Input
                              value={vehicle.plateState || ""}
                              onChange={(e) => {
                                const updatedVehicles = [...formData.vehicles];
                                updatedVehicles[index] = { ...vehicle, plateState: e.target.value };
                                updateField("vehicles", updatedVehicles);
                              }}
                              placeholder="e.g., UT"
                              data-testid={`input-vehicle-state-${index}`}
                            />
                          </div>
                        </div>
                      </div>
                    ))}

                    <p className="text-xs text-muted-foreground">
                      Vehicle information is collected for parking and property management purposes only.
                    </p>
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex justify-between border-t pt-6">
                <Button variant="outline" onClick={() => setCurrentStep(4)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button onClick={() => setCurrentStep(6)} data-testid="button-next-step-6">
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardFooter>
            </>
          )}

          {/* Step 6: Upload Documents */}
          {currentStep === 6 && (
            <UploadDocumentsStep
              personToken={personToken!}
              onBack={() => setCurrentStep(5)}
              onNext={() => setCurrentStep(7)}
              documentRequirements={linkData?.documentRequirements}
            />
          )}

          {/* Step 7: Review & Submit */}
          {currentStep === 7 && (
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
                    {formData.desiredMoveInDate && (
                      <>
                        <span className="text-muted-foreground">Desired Move-in:</span>
                        <span>{new Date(formData.desiredMoveInDate).toLocaleDateString()}</span>
                      </>
                    )}
                  </div>
                  {formData.hasOccupants && formData.occupants?.length > 0 && (
                    <div className="pt-2 border-t mt-2">
                      <span className="text-sm text-muted-foreground">Additional Occupants:</span>
                      <ul className="text-sm mt-1 space-y-1">
                        {formData.occupants.map((occ: { name: string; relationship: string; age: string }, idx: number) => (
                          <li key={idx}>
                            {occ.name} ({occ.relationship}{occ.age ? `, age ${occ.age}` : ""})
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
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

                <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <PawPrint className="h-4 w-4" />
                    Pets
                  </h3>
                  {formData.hasPets === false && (
                    <p className="text-sm">No pets</p>
                  )}
                  {formData.hasPets === true && (formData.pets || []).length > 0 ? (
                    <div className="space-y-2">
                      {formData.pets.map((pet: any, index: number) => (
                        <div key={pet.id || index} className="text-sm border-l-2 border-primary/30 pl-3 py-1">
                          <span className="font-medium">{pet.type || "Pet"}</span>
                          {pet.breed && <span className="text-muted-foreground"> - {pet.breed}</span>}
                          <div className="text-muted-foreground">
                            {pet.weight && <span>Weight: {pet.weight}</span>}
                            {pet.weight && pet.age && <span> | </span>}
                            {pet.age && <span>Age: {pet.age}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : formData.hasPets === true ? (
                    <p className="text-sm text-muted-foreground">Has pets (no details provided)</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Not specified</p>
                  )}
                </div>

                <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Car className="h-4 w-4" />
                    Vehicles
                  </h3>
                  {formData.hasVehicles === false && (
                    <p className="text-sm">No vehicles</p>
                  )}
                  {formData.hasVehicles === true && (formData.vehicles || []).length > 0 ? (
                    <div className="space-y-2">
                      {formData.vehicles.map((vehicle: any, index: number) => (
                        <div key={vehicle.id || index} className="text-sm border-l-2 border-primary/30 pl-3 py-1">
                          <span className="font-medium">{vehicle.year} {vehicle.make} {vehicle.model}</span>
                          {vehicle.color && <span className="text-muted-foreground"> ({vehicle.color})</span>}
                          <div className="text-muted-foreground">
                            {vehicle.licensePlate && <span>Plate: {vehicle.licensePlate}</span>}
                            {vehicle.licensePlate && vehicle.plateState && <span> | </span>}
                            {vehicle.plateState && <span>State: {vehicle.plateState}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : formData.hasVehicles === true ? (
                    <p className="text-sm text-muted-foreground">Has vehicles (no details provided)</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Not specified</p>
                  )}
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

                {/* Background Screening Disclosure & Acknowledgment */}
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 rounded-lg space-y-4">
                  <div className="space-y-1">
                    <h3 className="font-semibold text-amber-900 dark:text-amber-100">Background Screening Disclosure & Acknowledgment</h3>
                    <p className="text-xs text-amber-700 dark:text-amber-300 font-medium uppercase tracking-wide">Please Read Carefully</p>
                  </div>
                  
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    As part of the rental application process, the landlord or property manager may request a background screening report about you for housing purposes.
                  </p>
                  
                  <div className="text-sm text-amber-800 dark:text-amber-200 space-y-2">
                    <p className="font-medium">If screening is requested:</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>You will receive a separate invitation directly from Western Verify, the consumer reporting agency, delivered through its screening platform DigitalDelve</li>
                      <li>That invitation will include a standalone disclosure and authorization, which you must review and complete before any consumer report is obtained</li>
                      <li>LeaseShield does not collect or store your Social Security number, date of birth, or screening authorization</li>
                    </ul>
                  </div>
                  
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    The background screening report, if obtained, may include information permitted by law, such as credit history, rental history, employment-related information, criminal records, and eviction records.
                  </p>
                  
                  <div className="border-t border-amber-200 dark:border-amber-700 pt-3 space-y-2">
                    <p className="font-medium text-sm text-amber-900 dark:text-amber-100">Adverse Action Notice</p>
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      If adverse action is taken based in whole or in part on information contained in a consumer report, you will be provided an adverse action notice that includes:
                    </p>
                    <ul className="list-disc list-inside space-y-1 ml-2 text-sm text-amber-800 dark:text-amber-200">
                      <li>The name, address, and phone number of the consumer reporting agency (Western Verify) that provided the report</li>
                      <li>A statement that the consumer reporting agency did not make the decision and cannot explain why the decision was made</li>
                      <li>Notice of your rights under the Fair Credit Reporting Act (FCRA), including your right to obtain a free copy of your consumer report and to dispute inaccurate or incomplete information</li>
                    </ul>
                  </div>
                  
                  <div className="border-t border-amber-200 dark:border-amber-700 pt-3 space-y-3">
                    <p className="font-medium text-sm text-amber-900 dark:text-amber-100">Acknowledgment</p>
                    <p className="text-sm text-amber-800 dark:text-amber-200">By checking the box below, you acknowledge that:</p>
                    <ul className="list-disc list-inside space-y-1 ml-2 text-sm text-amber-800 dark:text-amber-200">
                      <li>You understand that a background screening may be requested in connection with your rental application</li>
                      <li>You understand that any screening authorization will be collected directly by Western Verify, through its screening platform DigitalDelve, and not by LeaseShield</li>
                      <li>You understand that LeaseShield does not make rental decisions</li>
                    </ul>
                    <div className="flex items-start gap-3 pt-2 bg-amber-100/50 dark:bg-amber-900/30 p-3 rounded-md">
                      <Checkbox
                        id="screeningDisclosure"
                        checked={formData.acknowledgeScreeningDisclosure || false}
                        onCheckedChange={(checked) => updateField("acknowledgeScreeningDisclosure", !!checked)}
                        data-testid="checkbox-screening-disclosure"
                      />
                      <Label htmlFor="screeningDisclosure" className="text-sm cursor-pointer font-medium text-amber-900 dark:text-amber-100">
                        I understand and acknowledge the above
                      </Label>
                    </div>
                  </div>
                </div>

                {/* Dynamic Compliance Rules from Database */}
                {linkData?.complianceRules?.map((rule) => {
                  const isStateSpecific = rule.stateId !== 'ALL';
                  const bgColor = isStateSpecific 
                    ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800' 
                    : 'bg-slate-50 dark:bg-slate-950/30 border-slate-200 dark:border-slate-700';
                  const textColor = isStateSpecific
                    ? 'text-blue-900 dark:text-blue-100'
                    : 'text-slate-900 dark:text-slate-100';
                  const secondaryTextColor = isStateSpecific
                    ? 'text-blue-800 dark:text-blue-200'
                    : 'text-slate-700 dark:text-slate-300';
                  const labelColor = isStateSpecific
                    ? 'text-blue-700 dark:text-blue-300'
                    : 'text-slate-600 dark:text-slate-400';
                  const checkboxBg = isStateSpecific
                    ? 'bg-blue-100/50 dark:bg-blue-900/30'
                    : 'bg-slate-100/50 dark:bg-slate-800/30';
                  const borderColor = isStateSpecific
                    ? 'border-blue-200 dark:border-blue-700'
                    : 'border-slate-200 dark:border-slate-600';
                  
                  return (
                    <div key={rule.id} className={`${bgColor} border p-4 rounded-lg space-y-4`}>
                      <div className="space-y-1">
                        <h3 className={`font-semibold ${textColor}`}>{rule.title}</h3>
                        {rule.statuteReference && (
                          <p className={`text-xs ${labelColor} font-medium uppercase tracking-wide`}>
                            {isStateSpecific ? 'Required Under State Law' : 'Federal Requirement'} • {rule.statuteReference}
                          </p>
                        )}
                      </div>
                      
                      {rule.disclosureText && (
                        <p className={`text-sm ${secondaryTextColor}`}>
                          {rule.disclosureText}
                        </p>
                      )}
                      
                      {rule.linkUrl && rule.linkText && (
                        <a 
                          href={rule.linkUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className={`inline-flex items-center gap-2 text-sm font-medium ${labelColor} hover:underline`}
                        >
                          <FileText className="h-4 w-4" />
                          {rule.linkText}
                        </a>
                      )}
                      
                      {(rule.ruleType === 'acknowledgment' || rule.ruleType === 'authorization') && rule.checkboxLabel && (
                        <div className={`border-t ${borderColor} pt-3`}>
                          <div className={`flex items-start gap-3 ${checkboxBg} p-3 rounded-md`}>
                            <Checkbox
                              id={`compliance-${rule.ruleKey}`}
                              checked={formData[`compliance_${rule.ruleKey}`] || false}
                              onCheckedChange={(checked) => updateField(`compliance_${rule.ruleKey}`, !!checked)}
                              data-testid={`checkbox-${rule.ruleKey}`}
                            />
                            <Label htmlFor={`compliance-${rule.ruleKey}`} className={`text-sm cursor-pointer ${textColor}`}>
                              {rule.checkboxLabel}
                            </Label>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Certification */}
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
                      I authorize the landlord to verify the information provided.
                    </Label>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between border-t pt-6">
                <Button variant="outline" onClick={() => setCurrentStep(6)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button
                  onClick={() => submitMutation.mutate()}
                  disabled={
                    !formData.certifyAccurate || 
                    !formData.acknowledgeScreeningDisclosure || 
                    // Check all dynamic compliance rules that require acknowledgment/authorization
                    (linkData?.complianceRules?.some(rule => 
                      (rule.ruleType === 'acknowledgment' || rule.ruleType === 'authorization') && 
                      rule.checkboxLabel && 
                      !formData[`compliance_${rule.ruleKey}`]
                    )) ||
                    submitMutation.isPending
                  }
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
