import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  FileText,
  Building2,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  ArrowLeft,
  AlertCircle,
  Loader2,
  Paperclip,
  Download,
  Printer,
  ExternalLink,
  ShieldCheck,
  Upload,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, getAccessToken } from "@/lib/queryClient";

interface SubmissionSummary {
  id: string;
  applicationLinkId: string;
  status: string;
  screeningTier: string | null;
  landlordNotes: string | null;
  createdAt: string;
  updatedAt: string;
  propertyName: string;
  unitLabel: string;
  primaryApplicant: {
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  peopleCount: number;
}

interface SubmissionPerson {
  id: string;
  submissionId: string;
  role: string;
  email: string;
  firstName: string;
  lastName: string;
  formJson: Record<string, any>;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface SubmissionEvent {
  id: string;
  submissionId: string;
  eventType: string;
  metadataJson: Record<string, any>;
  createdAt: string;
}

interface SubmissionFile {
  id: string;
  fileType: string;
  originalName: string;
  fileSize: number;
  createdAt: string;
}

interface SubmissionDetail extends SubmissionSummary {
  people: SubmissionPerson[];
  events: SubmissionEvent[];
}

interface DenialReason {
  id: string;
  decisionId: string;
  category: string;
  detail: string | null;
  createdAt: string;
}

interface Decision {
  id: string;
  submissionId: string;
  decision: "approved" | "denied";
  decidedAt: string;
  notes: string | null;
  denialReasons?: DenialReason[];
}

interface ScreeningOrder {
  id: string;
  submissionId: string;
  referenceNumber: string;
  status: "not_sent" | "sent" | "in_progress" | "complete" | "error";
  invitationId: string | null;
  reportId: string | null;
  reportUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

const denialReasonCategories = [
  { value: "credit", label: "Credit History", description: "Low credit score, derogatory marks, or credit report issues" },
  { value: "criminal", label: "Criminal Background", description: "Criminal record found in background check" },
  { value: "rental_history", label: "Rental History", description: "Negative rental history, prior evictions, or landlord references" },
  { value: "income", label: "Income Insufficient", description: "Income does not meet minimum requirements" },
  { value: "incomplete", label: "Incomplete Application", description: "Missing required information or documents" },
  { value: "other", label: "Other", description: "Other reason not listed above" },
] as const;

const statusColors: Record<string, string> = {
  started: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
  submitted: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  screening_requested: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
  in_progress: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100",
  complete: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100",
};

const statusLabels: Record<string, string> = {
  started: "In Progress",
  submitted: "Submitted",
  screening_requested: "Screening Requested",
  in_progress: "Screening In Progress",
  complete: "Complete",
};

const decisionColors: Record<string, string> = {
  approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  denied: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
};

const roleLabels: Record<string, string> = {
  applicant: "Primary Applicant",
  coapplicant: "Co-Applicant",
  guarantor: "Guarantor",
};

const fileTypeLabels: Record<string, string> = {
  id: "ID / Driver's License",
  income: "Proof of Income",
  bank: "Bank Statement",
  reference: "Reference Letter",
  other: "Other Document",
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function RentalSubmissions() {
  const { toast } = useToast();
  const [selectedSubmission, setSelectedSubmission] = useState<string | null>(null);
  const [isDecisionDialogOpen, setIsDecisionDialogOpen] = useState(false);
  const [decisionNotes, setDecisionNotes] = useState("");
  const [pendingDecision, setPendingDecision] = useState<string | null>(null);
  const [selectedDenialReasons, setSelectedDenialReasons] = useState<string[]>([]);
  const [denialReasonDetails, setDenialReasonDetails] = useState<Record<string, string>>({});
  const [filterTab, setFilterTab] = useState<"all" | "approved" | "denied" | "pending">("all");
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadPersonId, setUploadPersonId] = useState<string | null>(null);
  const [uploadFileType, setUploadFileType] = useState<string>("other");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const { data: submissions, isLoading: isLoadingSubmissions } = useQuery<SubmissionSummary[]>({
    queryKey: ["/api/rental/submissions"],
  });

  const { data: submissionDetail, isLoading: isLoadingDetail } = useQuery<SubmissionDetail>({
    queryKey: ["/api/rental/submissions", selectedSubmission],
    queryFn: async () => {
      const token = getAccessToken();
      const res = await fetch(`/api/rental/submissions/${selectedSubmission}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to load submission details");
      return res.json();
    },
    enabled: !!selectedSubmission,
  });

  const { data: existingDecision } = useQuery<Decision | null>({
    queryKey: ["/api/rental/submissions", selectedSubmission, "decision"],
    queryFn: async () => {
      const token = getAccessToken();
      const res = await fetch(`/api/rental/submissions/${selectedSubmission}/decision`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!selectedSubmission,
  });

  const { data: submissionFiles, isLoading: isLoadingFiles } = useQuery<Record<string, SubmissionFile[]>>({
    queryKey: ["/api/rental/submissions", selectedSubmission, "files"],
    queryFn: async () => {
      const token = getAccessToken();
      const res = await fetch(`/api/rental/submissions/${selectedSubmission}/files`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return {};
      return res.json();
    },
    enabled: !!selectedSubmission,
  });

  const { data: screeningOrder, refetch: refetchScreening } = useQuery<ScreeningOrder | null>({
    queryKey: ["/api/rental/submissions", selectedSubmission, "screening"],
    queryFn: async () => {
      const token = getAccessToken();
      const res = await fetch(`/api/rental/submissions/${selectedSubmission}/screening`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!selectedSubmission,
  });

  const screeningMutation = useMutation({
    mutationFn: async (submissionId: string) => {
      return apiRequest("POST", `/api/rental/submissions/${submissionId}/screening`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rental/submissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rental/submissions", selectedSubmission] });
      queryClient.invalidateQueries({ queryKey: ["/api/rental/submissions", selectedSubmission, "screening"] });
      toast({ title: "Screening Requested", description: "The applicant will receive an email to complete screening." });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error?.message || "Failed to request screening. Please check DigitalDelve credentials.", 
        variant: "destructive" 
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return apiRequest("PATCH", `/api/rental/submissions/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rental/submissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rental/submissions", selectedSubmission] });
      toast({ title: "Success", description: "Application status updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update status.", variant: "destructive" });
    },
  });

  const decisionMutation = useMutation({
    mutationFn: async ({ id, decision, notes, denialReasons }: { 
      id: string; 
      decision: string; 
      notes?: string;
      denialReasons?: { category: string; detail?: string }[];
    }) => {
      return apiRequest("POST", `/api/rental/submissions/${id}/decision`, { decision, notes, denialReasons });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rental/submissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rental/submissions", selectedSubmission] });
      queryClient.invalidateQueries({ queryKey: ["/api/rental/submissions", selectedSubmission, "decision"] });
      toast({ title: "Decision Recorded", description: `Application has been ${pendingDecision}.` });
      setIsDecisionDialogOpen(false);
      setDecisionNotes("");
      setPendingDecision(null);
      setSelectedDenialReasons([]);
      setDenialReasonDetails({});
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error?.message || "Failed to record decision.", 
        variant: "destructive" 
      });
    },
  });

  const uploadFileMutation = useMutation({
    mutationFn: async ({ submissionId, personId, fileType, file }: { 
      submissionId: string; 
      personId: string;
      fileType: string;
      file: File;
    }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('personId', personId);
      formData.append('fileType', fileType);
      
      const token = getAccessToken();
      const res = await fetch(`/api/rental/submissions/${submissionId}/files`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to upload file");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rental/submissions", selectedSubmission, "files"] });
      toast({ title: "Success", description: "Document uploaded successfully." });
      setIsUploadDialogOpen(false);
      setUploadFile(null);
      setUploadPersonId(null);
      setUploadFileType("other");
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error?.message || "Failed to upload document.", 
        variant: "destructive" 
      });
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: async ({ submissionId, fileId }: { submissionId: string; fileId: string }) => {
      return apiRequest("DELETE", `/api/rental/submissions/${submissionId}/files/${fileId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rental/submissions", selectedSubmission, "files"] });
      toast({ title: "Success", description: "Document deleted." });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error?.message || "Failed to delete document.", 
        variant: "destructive" 
      });
    },
  });

  const handleStatusChange = (status: string) => {
    if (selectedSubmission) {
      updateMutation.mutate({ id: selectedSubmission, status });
    }
  };

  const handleDecision = (decision: string) => {
    setPendingDecision(decision);
    setSelectedDenialReasons([]);
    setDenialReasonDetails({});
    setDecisionNotes("");
    setIsDecisionDialogOpen(true);
  };

  const confirmDecision = () => {
    if (selectedSubmission && pendingDecision) {
      const denialReasons = pendingDecision === "denied" && selectedDenialReasons.length > 0
        ? selectedDenialReasons.map(cat => ({
            category: cat,
            detail: denialReasonDetails[cat] || undefined,
          }))
        : undefined;
      
      decisionMutation.mutate({
        id: selectedSubmission,
        decision: pendingDecision,
        notes: decisionNotes || undefined,
        denialReasons,
      });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const filteredSubmissions = useMemo(() => {
    if (!submissions) return [];
    switch (filterTab) {
      case "pending":
        return submissions.filter(s => s.status !== "complete");
      case "approved":
      case "denied":
        return submissions.filter(s => s.status === "complete");
      default:
        return submissions;
    }
  }, [submissions, filterTab]);

  const countByTab = useMemo(() => {
    if (!submissions) return { all: 0, pending: 0, approved: 0, denied: 0 };
    const pending = submissions.filter(s => s.status !== "complete").length;
    const complete = submissions.filter(s => s.status === "complete").length;
    return {
      all: submissions.length,
      pending,
      approved: complete,
      denied: complete,
    };
  }, [submissions]);

  if (selectedSubmission && submissionDetail) {
    return (
      <div className="container max-w-6xl mx-auto py-6 px-4 print:max-w-full print:p-2">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4 print:hidden">
          <Button
            variant="ghost"
            onClick={() => setSelectedSubmission(null)}
            data-testid="button-back-to-list"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Applications
          </Button>
          <Button
            variant="outline"
            onClick={handlePrint}
            data-testid="button-print-application"
          >
            <Printer className="mr-2 h-4 w-4" />
            Print Application
          </Button>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-xl" data-testid="text-submission-property">
                    {submissionDetail.propertyName}
                    {submissionDetail.unitLabel && ` - ${submissionDetail.unitLabel}`}
                  </CardTitle>
                  <CardDescription>
                    Application submitted {formatDate(submissionDetail.createdAt)}
                  </CardDescription>
                </div>
                <Badge className={statusColors[submissionDetail.status] || ""} data-testid="badge-submission-status">
                  {statusLabels[submissionDetail.status] || submissionDetail.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="text-sm text-muted-foreground">Change Status:</span>
                <Select
                  value={submissionDetail.status}
                  onValueChange={handleStatusChange}
                  disabled={updateMutation.isPending}
                >
                  <SelectTrigger className="w-48" data-testid="select-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="screening_requested">Screening Requested</SelectItem>
                    <SelectItem value="in_progress">Screening In Progress</SelectItem>
                    <SelectItem value="complete">Complete</SelectItem>
                  </SelectContent>
                </Select>
                {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>
              
              {existingDecision ? (
                <div className="mt-4 pt-4 border-t">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">Final Decision:</span>
                    <Badge className={decisionColors[existingDecision.decision]} data-testid="badge-decision">
                      {existingDecision.decision === "approved" ? "Approved" : "Denied"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      on {formatDate(existingDecision.decidedAt)}
                    </span>
                  </div>
                  {existingDecision.notes && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Note: {existingDecision.notes}
                    </p>
                  )}
                  {existingDecision.denialReasons && existingDecision.denialReasons.length > 0 && (
                    <div className="mt-3 p-3 bg-red-50 dark:bg-red-950 rounded-md">
                      <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">Denial Reasons:</p>
                      <ul className="space-y-1">
                        {existingDecision.denialReasons.map((reason) => {
                          const cat = denialReasonCategories.find(c => c.value === reason.category);
                          return (
                            <li key={reason.id} className="text-sm text-red-700 dark:text-red-300">
                              <span className="font-medium">{cat?.label || reason.category}</span>
                              {reason.detail && <span className="text-red-600 dark:text-red-400"> - {reason.detail}</span>}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              ) : submissionDetail.status === "complete" && (
                <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
                  <span className="text-sm font-medium">Final Decision:</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-green-500 text-green-700 dark:text-green-300"
                    onClick={() => handleDecision("approved")}
                    disabled={decisionMutation.isPending}
                    data-testid="button-approve"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-500 text-red-700 dark:text-red-300"
                    onClick={() => handleDecision("denied")}
                    disabled={decisionMutation.isPending}
                    data-testid="button-deny"
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Deny
                  </Button>
                </div>
              )}

              <div className="mt-4 pt-4 border-t">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Background Screening</span>
                  </div>
                  {!screeningOrder ? (
                    <Button
                      size="sm"
                      onClick={() => selectedSubmission && screeningMutation.mutate(selectedSubmission)}
                      disabled={screeningMutation.isPending || submissionDetail.status === 'started'}
                      data-testid="button-request-screening"
                    >
                      {screeningMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          Requesting...
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="h-4 w-4 mr-1" />
                          Request Screening
                        </>
                      )}
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={screeningOrder.status === 'complete' ? 'default' : 'secondary'}
                        data-testid="badge-screening-status"
                      >
                        {screeningOrder.status === 'sent' && 'Invitation Sent'}
                        {screeningOrder.status === 'in_progress' && 'In Progress'}
                        {screeningOrder.status === 'complete' && 'Complete'}
                        {screeningOrder.status === 'error' && 'Error'}
                        {screeningOrder.status === 'not_sent' && 'Not Sent'}
                      </Badge>
                      {screeningOrder.status === 'complete' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const token = getAccessToken();
                            fetch(`/api/rental/submissions/${screeningOrder.submissionId}/screening/report-url`, {
                              headers: token ? { Authorization: `Bearer ${token}` } : {},
                            })
                              .then(res => res.json())
                              .then(data => {
                                if (data.url) {
                                  window.open(data.url, '_blank');
                                }
                              });
                          }}
                          data-testid="button-view-report"
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          View Report
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                {screeningOrder?.status === 'error' && screeningOrder.errorMessage && (
                  <p className="text-sm text-red-500 mt-2">{screeningOrder.errorMessage}</p>
                )}
                {screeningOrder && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Reference: {screeningOrder.referenceNumber}
                  </p>
                )}
              </div>

              {submissionDetail.landlordNotes && (
                <div className="bg-muted p-3 rounded-md mt-4">
                  <p className="text-sm font-medium mb-1">Notes</p>
                  <p className="text-sm text-muted-foreground">{submissionDetail.landlordNotes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Applicants ({submissionDetail.people.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {submissionDetail.people.map((person) => (
                  <Card key={person.id} className="bg-muted/50" data-testid={`card-person-${person.id}`}>
                    <CardContent className="pt-4">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">
                              {person.firstName} {person.lastName}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {roleLabels[person.role] || person.role}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{person.email}</p>
                        </div>
                        <Badge className={statusColors[person.status] || ""}>
                          {statusLabels[person.status] || person.status}
                        </Badge>
                      </div>

                      {person.formJson && Object.keys(person.formJson).length > 0 && (
                        <div className="mt-4 pt-4 border-t space-y-4">
                          <div>
                            <p className="text-sm font-medium mb-3">Personal Information</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                              {person.formJson.phone && (
                                <div data-testid={`field-phone-${person.id}`}>
                                  <span className="text-muted-foreground block text-xs">Phone</span>
                                  <span>{person.formJson.phone}</span>
                                </div>
                              )}
                              {person.formJson.dateOfBirth && (
                                <div data-testid={`field-dob-${person.id}`}>
                                  <span className="text-muted-foreground block text-xs">Date of Birth</span>
                                  <span>{person.formJson.dateOfBirth}</span>
                                </div>
                              )}
                              {person.formJson.ssn && (
                                <div data-testid={`field-ssn-${person.id}`}>
                                  <span className="text-muted-foreground block text-xs">SSN (last 4)</span>
                                  <span>***-**-{person.formJson.ssn.slice(-4)}</span>
                                </div>
                              )}
                              {person.formJson.driversLicense && (
                                <div data-testid={`field-license-${person.id}`}>
                                  <span className="text-muted-foreground block text-xs">Driver's License</span>
                                  <span>{person.formJson.driversLicense}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div>
                            <p className="text-sm font-medium mb-3">Current Residence</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                              {person.formJson.currentAddress && (
                                <div className="md:col-span-2" data-testid={`field-address-${person.id}`}>
                                  <span className="text-muted-foreground block text-xs">Address</span>
                                  <span>{person.formJson.currentAddress}</span>
                                </div>
                              )}
                              {(person.formJson.currentCity || person.formJson.currentState || person.formJson.currentZip) && (
                                <div className="md:col-span-2" data-testid={`field-citystatezip-${person.id}`}>
                                  <span className="text-muted-foreground block text-xs">City, State, ZIP</span>
                                  <span>
                                    {[person.formJson.currentCity, person.formJson.currentState, person.formJson.currentZip].filter(Boolean).join(", ")}
                                  </span>
                                </div>
                              )}
                              {person.formJson.currentLandlordName && (
                                <div data-testid={`field-landlord-${person.id}`}>
                                  <span className="text-muted-foreground block text-xs">Landlord Name</span>
                                  <span>{person.formJson.currentLandlordName}</span>
                                </div>
                              )}
                              {person.formJson.currentLandlordPhone && (
                                <div data-testid={`field-landlordphone-${person.id}`}>
                                  <span className="text-muted-foreground block text-xs">Landlord Phone</span>
                                  <span>{person.formJson.currentLandlordPhone}</span>
                                </div>
                              )}
                              {person.formJson.currentRent && (
                                <div data-testid={`field-rent-${person.id}`}>
                                  <span className="text-muted-foreground block text-xs">Current Rent</span>
                                  <span>${person.formJson.currentRent}/mo</span>
                                </div>
                              )}
                              {person.formJson.moveInDate && (
                                <div data-testid={`field-movein-${person.id}`}>
                                  <span className="text-muted-foreground block text-xs">Move-In Date</span>
                                  <span>{person.formJson.moveInDate}</span>
                                </div>
                              )}
                              {person.formJson.reasonForMoving && (
                                <div className="md:col-span-2" data-testid={`field-reason-${person.id}`}>
                                  <span className="text-muted-foreground block text-xs">Reason for Moving</span>
                                  <span>{person.formJson.reasonForMoving}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div>
                            <p className="text-sm font-medium mb-3">Employment & Income</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                              {person.formJson.currentEmployer && (
                                <div data-testid={`field-employer-${person.id}`}>
                                  <span className="text-muted-foreground block text-xs">Employer</span>
                                  <span>{person.formJson.currentEmployer}</span>
                                </div>
                              )}
                              {person.formJson.employerPhone && (
                                <div data-testid={`field-employerphone-${person.id}`}>
                                  <span className="text-muted-foreground block text-xs">Employer Phone</span>
                                  <span>{person.formJson.employerPhone}</span>
                                </div>
                              )}
                              {person.formJson.jobTitle && (
                                <div data-testid={`field-jobtitle-${person.id}`}>
                                  <span className="text-muted-foreground block text-xs">Job Title</span>
                                  <span>{person.formJson.jobTitle}</span>
                                </div>
                              )}
                              {person.formJson.monthlyIncome && (
                                <div data-testid={`field-income-${person.id}`}>
                                  <span className="text-muted-foreground block text-xs">Monthly Income</span>
                                  <span>${person.formJson.monthlyIncome}</span>
                                </div>
                              )}
                              {person.formJson.employmentLength && (
                                <div data-testid={`field-emptime-${person.id}`}>
                                  <span className="text-muted-foreground block text-xs">Time at Job</span>
                                  <span>{person.formJson.employmentLength}</span>
                                </div>
                              )}
                              {person.formJson.additionalIncome && (
                                <div data-testid={`field-additionalincome-${person.id}`}>
                                  <span className="text-muted-foreground block text-xs">Additional Income</span>
                                  <span>${person.formJson.additionalIncome}</span>
                                </div>
                              )}
                              {person.formJson.additionalIncomeSource && (
                                <div data-testid={`field-additionalsource-${person.id}`}>
                                  <span className="text-muted-foreground block text-xs">Additional Income Source</span>
                                  <span>{person.formJson.additionalIncomeSource}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {(person.formJson.emergencyContactName || person.formJson.emergencyContactPhone) && (
                            <div>
                              <p className="text-sm font-medium mb-3">Emergency Contact</p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                {person.formJson.emergencyContactName && (
                                  <div data-testid={`field-emname-${person.id}`}>
                                    <span className="text-muted-foreground block text-xs">Name</span>
                                    <span>{person.formJson.emergencyContactName}</span>
                                  </div>
                                )}
                                {person.formJson.emergencyContactPhone && (
                                  <div data-testid={`field-emphone-${person.id}`}>
                                    <span className="text-muted-foreground block text-xs">Phone</span>
                                    <span>{person.formJson.emergencyContactPhone}</span>
                                  </div>
                                )}
                                {person.formJson.emergencyContactRelationship && (
                                  <div data-testid={`field-emrelation-${person.id}`}>
                                    <span className="text-muted-foreground block text-xs">Relationship</span>
                                    <span>{person.formJson.emergencyContactRelationship}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {(person.formJson.hasPets !== undefined || person.formJson.pets || person.formJson.vehicles) && (
                            <div>
                              <p className="text-sm font-medium mb-3">Additional Information</p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                {person.formJson.hasPets !== undefined && (
                                  <div data-testid={`field-haspets-${person.id}`}>
                                    <span className="text-muted-foreground block text-xs">Has Pets</span>
                                    <span>{person.formJson.hasPets ? "Yes" : "No"}</span>
                                  </div>
                                )}
                                {person.formJson.pets && Array.isArray(person.formJson.pets) && person.formJson.pets.length > 0 && (
                                  <div data-testid={`field-pets-${person.id}`} className="col-span-2">
                                    <span className="text-muted-foreground block text-xs mb-1">Pets</span>
                                    <div className="space-y-1">
                                      {person.formJson.pets.map((p: any, idx: number) => (
                                        <div key={idx} className="text-sm">
                                          {p.type} {p.breed && `(${p.breed})`} {p.age && `- ${p.age} years old`} {p.weight && `- ${p.weight} lbs`} {p.isServiceAnimal && "- Service Animal"}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {person.formJson.vehicles && Array.isArray(person.formJson.vehicles) && person.formJson.vehicles.length > 0 && (
                                  <div data-testid={`field-vehicles-${person.id}`} className="col-span-2">
                                    <span className="text-muted-foreground block text-xs mb-1">Vehicles</span>
                                    <div className="space-y-1">
                                      {person.formJson.vehicles.map((v: any, idx: number) => (
                                        <div key={idx} className="text-sm">
                                          {v.year} {v.make} {v.model} {v.color && `(${v.color})`} {v.licensePlate && `- ${v.licensePlate}`} {v.plateState && `(${v.plateState})`}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {person.formJson.smoker !== undefined && (
                                  <div data-testid={`field-smoker-${person.id}`}>
                                    <span className="text-muted-foreground block text-xs">Smoker</span>
                                    <span>{person.formJson.smoker ? "Yes" : "No"}</span>
                                  </div>
                                )}
                                {person.formJson.hasBeenEvicted !== undefined && (
                                  <div data-testid={`field-evicted-${person.id}`}>
                                    <span className="text-muted-foreground block text-xs">Prior Eviction</span>
                                    <span>{person.formJson.hasBeenEvicted ? "Yes" : "No"}</span>
                                  </div>
                                )}
                                {person.formJson.hasFelony !== undefined && (
                                  <div data-testid={`field-felony-${person.id}`}>
                                    <span className="text-muted-foreground block text-xs">Felony Conviction</span>
                                    <span>{person.formJson.hasFelony ? "Yes" : "No"}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-documents">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Paperclip className="h-5 w-5" />
                Uploaded Documents
              </CardTitle>
              <Button
                size="sm"
                onClick={() => {
                  if (submissionDetail.people.length > 0) {
                    setUploadPersonId(submissionDetail.people[0].id);
                  }
                  setIsUploadDialogOpen(true);
                }}
                data-testid="button-upload-document"
              >
                <Upload className="h-4 w-4 mr-1" />
                Add Document
              </Button>
            </CardHeader>
            <CardContent>
              {isLoadingFiles ? (
                <div className="space-y-3" data-testid="loading-documents">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : (
                submissionDetail.people.map((person) => {
                  const personFiles = submissionFiles?.[person.id] || [];
                  return (
                    <div key={`docs-${person.id}`} className="mb-4 last:mb-0" data-testid={`docs-person-${person.id}`}>
                      <div className="text-sm font-medium mb-2 flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span>{person.firstName} {person.lastName}</span>
                          <Badge variant="outline" className="text-xs">
                            {roleLabels[person.role] || person.role}
                          </Badge>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setUploadPersonId(person.id);
                            setIsUploadDialogOpen(true);
                          }}
                          data-testid={`button-upload-for-${person.id}`}
                        >
                          <Upload className="h-4 w-4" />
                        </Button>
                      </div>
                      {personFiles.length === 0 ? (
                        <p className="text-sm text-muted-foreground" data-testid={`text-no-docs-${person.id}`}>No documents uploaded.</p>
                      ) : (
                        <div className="space-y-2">
                          {personFiles.map((file) => (
                            <div
                              key={file.id}
                              className="flex flex-wrap items-center justify-between gap-2 p-2 bg-muted/50 rounded-md"
                              data-testid={`row-file-${file.id}`}
                            >
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <p className="text-sm font-medium" data-testid={`text-filename-${file.id}`}>{file.originalName}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {fileTypeLabels[file.fileType] || file.fileType} · {formatFileSize(file.fileSize)}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    window.open(`/api/rental/submissions/${selectedSubmission}/files/${file.id}/download`, '_blank');
                                  }}
                                  data-testid={`button-download-${file.id}`}
                                >
                                  <Download className="h-4 w-4 mr-1" />
                                  Download
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => {
                                    if (confirm("Are you sure you want to delete this document?")) {
                                      deleteFileMutation.mutate({ 
                                        submissionId: selectedSubmission!, 
                                        fileId: file.id 
                                      });
                                    }
                                  }}
                                  data-testid={`button-delete-${file.id}`}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Activity Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              {submissionDetail.events.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {submissionDetail.events.map((event) => (
                    <div key={event.id} className="flex items-start gap-3 text-sm">
                      <div className="w-2 h-2 mt-1.5 rounded-full bg-primary shrink-0" />
                      <div>
                        <p className="font-medium">{event.eventType.replace(/_/g, " ")}</p>
                        <p className="text-muted-foreground text-xs">{formatDate(event.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Dialog open={isDecisionDialogOpen} onOpenChange={setIsDecisionDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {pendingDecision === "approved" ? "Approve Application" : "Deny Application"}
              </DialogTitle>
              <DialogDescription>
                {pendingDecision === "approved"
                  ? "This will notify the applicant that their application has been approved."
                  : "This will notify the applicant that their application has been denied."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              {pendingDecision === "denied" && (
                <div>
                  <Label className="text-sm font-medium">Denial Reasons (select all that apply)</Label>
                  <p className="text-xs text-muted-foreground mb-3">
                    Required for adverse action letter compliance
                  </p>
                  <div className="space-y-3">
                    {denialReasonCategories.map((reason) => (
                      <div key={reason.value} className="space-y-2">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            id={`reason-${reason.value}`}
                            checked={selectedDenialReasons.includes(reason.value)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedDenialReasons([...selectedDenialReasons, reason.value]);
                              } else {
                                setSelectedDenialReasons(selectedDenialReasons.filter(r => r !== reason.value));
                                setDenialReasonDetails(prev => {
                                  const next = { ...prev };
                                  delete next[reason.value];
                                  return next;
                                });
                              }
                            }}
                            data-testid={`checkbox-reason-${reason.value}`}
                          />
                          <div className="flex-1">
                            <Label 
                              htmlFor={`reason-${reason.value}`}
                              className="text-sm font-medium cursor-pointer"
                            >
                              {reason.label}
                            </Label>
                            <p className="text-xs text-muted-foreground">{reason.description}</p>
                          </div>
                        </div>
                        {selectedDenialReasons.includes(reason.value) && (
                          <Textarea
                            placeholder={`Additional details about ${reason.label.toLowerCase()}...`}
                            value={denialReasonDetails[reason.value] || ""}
                            onChange={(e) => setDenialReasonDetails(prev => ({
                              ...prev,
                              [reason.value]: e.target.value,
                            }))}
                            className="ml-6 text-sm"
                            rows={2}
                            data-testid={`input-reason-detail-${reason.value}`}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <Label className="text-sm font-medium">Notes (optional)</Label>
                <Textarea
                  placeholder="Add any notes about this decision..."
                  value={decisionNotes}
                  onChange={(e) => setDecisionNotes(e.target.value)}
                  data-testid="input-decision-notes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDecisionDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                variant={pendingDecision === "approved" ? "default" : "destructive"}
                onClick={confirmDecision}
                disabled={decisionMutation.isPending || (pendingDecision === "denied" && selectedDenialReasons.length === 0)}
                data-testid="button-confirm-decision"
              >
                {decisionMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {pendingDecision === "approved" ? "Approve" : "Deny"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Document</DialogTitle>
              <DialogDescription>
                Add a document to this application. Select the person and document type.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Person</Label>
                <Select 
                  value={uploadPersonId || ""} 
                  onValueChange={setUploadPersonId}
                >
                  <SelectTrigger data-testid="select-upload-person">
                    <SelectValue placeholder="Select person" />
                  </SelectTrigger>
                  <SelectContent>
                    {submissionDetail?.people.map((person) => (
                      <SelectItem key={person.id} value={person.id}>
                        {person.firstName} {person.lastName} ({roleLabels[person.role] || person.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium">Document Type</Label>
                <Select 
                  value={uploadFileType} 
                  onValueChange={setUploadFileType}
                >
                  <SelectTrigger data-testid="select-upload-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="id">ID / Driver's License</SelectItem>
                    <SelectItem value="income">Proof of Income</SelectItem>
                    <SelectItem value="bank">Bank Statement</SelectItem>
                    <SelectItem value="reference">Reference Letter</SelectItem>
                    <SelectItem value="other">Other Document</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium">File</Label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setUploadFile(e.target.files[0]);
                    }
                  }}
                  className="mt-1 block w-full text-sm text-muted-foreground
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-md file:border-0
                    file:text-sm file:font-medium
                    file:bg-primary file:text-primary-foreground
                    hover:file:bg-primary/90
                    cursor-pointer"
                  data-testid="input-upload-file"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Accepts PDF, JPG, or PNG files up to 10MB
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsUploadDialogOpen(false);
                  setUploadFile(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (selectedSubmission && uploadPersonId && uploadFile) {
                    uploadFileMutation.mutate({
                      submissionId: selectedSubmission,
                      personId: uploadPersonId,
                      fileType: uploadFileType,
                      file: uploadFile,
                    });
                  }
                }}
                disabled={!uploadPersonId || !uploadFile || uploadFileMutation.isPending}
                data-testid="button-confirm-upload"
              >
                {uploadFileMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Upload
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl mx-auto py-6 px-4">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            Rental Applications
          </h1>
          <p className="text-muted-foreground">
            Review and manage tenant applications for your properties
          </p>
        </div>
      </div>

      <Tabs value={filterTab} onValueChange={(v) => setFilterTab(v as typeof filterTab)} className="mb-4">
        <TabsList data-testid="tabs-filter">
          <TabsTrigger value="all" data-testid="tab-all">
            All ({countByTab.all})
          </TabsTrigger>
          <TabsTrigger value="pending" data-testid="tab-pending">
            Pending ({countByTab.pending})
          </TabsTrigger>
          <TabsTrigger value="approved" data-testid="tab-approved">
            <CheckCircle className="h-4 w-4 mr-1 text-green-600" />
            Decided
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoadingSubmissions ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : filteredSubmissions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Applications Yet</h3>
            <p className="text-muted-foreground text-center max-w-md">
              When tenants submit applications through your rental links, they will appear here for review.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Property</TableHead>
                <TableHead>Applicant</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSubmissions.map((sub) => (
                <TableRow key={sub.id} data-testid={`row-submission-${sub.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{sub.propertyName}</p>
                        {sub.unitLabel && (
                          <p className="text-xs text-muted-foreground">{sub.unitLabel}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {sub.primaryApplicant ? (
                      <div>
                        <p className="font-medium">
                          {sub.primaryApplicant.firstName} {sub.primaryApplicant.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">{sub.primaryApplicant.email}</p>
                        {sub.peopleCount > 1 && (
                          <p className="text-xs text-muted-foreground">
                            +{sub.peopleCount - 1} more
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[sub.status] || ""}>
                      {statusLabels[sub.status] || sub.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm">{formatDate(sub.createdAt)}</p>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedSubmission(sub.id)}
                      data-testid={`button-view-${sub.id}`}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
