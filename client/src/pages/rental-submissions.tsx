import { useState, useMemo, useEffect, useRef } from "react";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  User,
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
  RefreshCw,
  Mail,
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
  decision: {
    decision: "approved" | "denied";
    decidedAt: string;
  } | null;
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
  isCompleted: boolean;
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
  personId: string | null;
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
  const [sendNoticeMyself, setSendNoticeMyself] = useState(false);
  const [filterTab, setFilterTab] = useState<"all" | "decided" | "pending">("all");
  const [isLetterPreviewOpen, setIsLetterPreviewOpen] = useState(false);
  const [draftLetterSubject, setDraftLetterSubject] = useState("");
  const [draftLetterBody, setDraftLetterBody] = useState("");
  const [savedDecisionId, setSavedDecisionId] = useState<string | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadPersonId, setUploadPersonId] = useState<string | null>(null);
  const [uploadFileType, setUploadFileType] = useState<string>("other");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [deleteSubmissionId, setDeleteSubmissionId] = useState<string | null>(null);

  const { data: submissions, isLoading: isLoadingSubmissions } = useQuery<SubmissionSummary[]>({
    queryKey: ["/api/rental/submissions"],
  });

  // Check screening integration status
  const { data: screeningCredentials } = useQuery<{
    configured: boolean;
    status: string;
    integrationReady?: boolean;
    pendingAdminSetup?: boolean;
  }>({
    queryKey: ["/api/screening-credentials"],
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

  const { data: screeningOrders, refetch: refetchScreening } = useQuery<ScreeningOrder[]>({
    queryKey: ["/api/rental/submissions", selectedSubmission, "screening"],
    queryFn: async () => {
      const token = getAccessToken();
      const res = await fetch(`/api/rental/submissions/${selectedSubmission}/screening`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedSubmission,
  });

  const getScreeningOrderForPerson = (personId: string) => {
    return screeningOrders?.find(order => order.personId === personId);
  };

  const screeningMutation = useMutation({
    mutationFn: async ({ submissionId, personId }: { submissionId: string; personId?: string }) => {
      return apiRequest("POST", `/api/rental/submissions/${submissionId}/screening`, { personId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rental/submissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rental/submissions", selectedSubmission] });
      queryClient.invalidateQueries({ queryKey: ["/api/rental/submissions", selectedSubmission, "screening"] });
      toast({ title: "Screening Requested", description: "The person will receive an email to complete screening." });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error?.message || "Failed to request screening. Please check DigitalDelve credentials.", 
        variant: "destructive" 
      });
    },
  });

  const syncScreeningMutation = useMutation({
    mutationFn: async (orderId: string) => {
      return apiRequest("POST", `/api/rental/screening/${orderId}/sync`);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/rental/submissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rental/submissions", selectedSubmission] });
      queryClient.invalidateQueries({ queryKey: ["/api/rental/submissions", selectedSubmission, "screening"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rental/submissions/pending-count"] });
      if (data.status === 'complete') {
        toast({ title: "Status Updated", description: "Screening is now marked as complete." });
      }
    },
    onError: () => {},
  });

  // Auto-sync in_progress screenings when viewing a submission
  const autoSyncedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!screeningOrders || screeningOrders.length === 0) return;
    
    const inProgressOrders = screeningOrders.filter(
      order => order.status === 'in_progress' && !autoSyncedRef.current.has(order.id)
    );
    
    if (inProgressOrders.length > 0) {
      inProgressOrders.forEach(order => {
        autoSyncedRef.current.add(order.id);
        syncScreeningMutation.mutate(order.id);
      });
    }
  }, [screeningOrders]);

  const resendInviteMutation = useMutation({
    mutationFn: async ({ submissionId, personId }: { submissionId: string; personId: string }) => {
      return apiRequest("POST", `/api/rental/submissions/${submissionId}/people/${personId}/resend-invite`);
    },
    onSuccess: () => {
      toast({ title: "Invitation Sent", description: "A new invitation email has been sent." });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error?.message || "Failed to resend invitation.", 
        variant: "destructive" 
      });
    },
  });

  const deletePersonMutation = useMutation({
    mutationFn: async ({ submissionId, personId }: { submissionId: string; personId: string }) => {
      return apiRequest("DELETE", `/api/rental/submissions/${submissionId}/people/${personId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rental/submissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rental/submissions", selectedSubmission] });
      toast({ title: "Removed", description: "Person has been removed from the application." });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error?.message || "Failed to remove person.", 
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
    mutationFn: async ({ id, decision, notes, denialReasons, skipNotification }: { 
      id: string; 
      decision: string; 
      notes?: string;
      denialReasons?: { category: string; detail?: string }[];
      skipNotification?: boolean;
    }) => {
      return apiRequest("POST", `/api/rental/submissions/${id}/decision`, { decision, notes, denialReasons, skipNotification });
    },
    onSuccess: (data: any, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/rental/submissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rental/submissions", selectedSubmission] });
      queryClient.invalidateQueries({ queryKey: ["/api/rental/submissions", selectedSubmission, "decision"] });
      
      setIsDecisionDialogOpen(false);
      
      // If user wants to send themselves, just show success toast
      if (sendNoticeMyself) {
        toast({ title: "Decision Recorded", description: `Application has been ${pendingDecision}. You'll send the notification yourself.` });
        setDecisionNotes("");
        setPendingDecision(null);
        setSelectedDenialReasons([]);
        setDenialReasonDetails({});
        setSendNoticeMyself(false);
      } else {
        // Show letter preview for editing before sending
        const isApproved = variables.decision === "approved";
        const applicantName = submissionDetail?.people.find(p => p.role === "applicant")?.firstName || "Applicant";
        const propertyName = submissionDetail?.propertyName || "the rental property";
        
        // Generate default letter content
        const defaultSubject = isApproved 
          ? "Great news! Your rental application has been approved"
          : "Update on your rental application";
        
        const defaultBody = isApproved
          ? `Dear ${applicantName},

Great news! Your rental application for ${propertyName} has been approved.

We will be in touch with you soon regarding next steps, including signing the lease and move-in details.

Congratulations on your new home!

Best regards`
          : `Dear ${applicantName},

Thank you for your interest in ${propertyName}.

After careful consideration, we have decided not to move forward with your application at this time.

If your application was denied based on information from a credit report or background check, you have the right to:
- Request a free copy of the report used in making this decision
- Dispute any inaccurate information with the reporting agency

We wish you the best in your housing search.

Best regards`;
        
        setDraftLetterSubject(defaultSubject);
        setDraftLetterBody(defaultBody);
        setSavedDecisionId(data?.id || null);
        setIsLetterPreviewOpen(true);
        toast({ title: "Decision Recorded", description: "Now you can review and edit the notification before sending." });
      }
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error?.message || "Failed to record decision.", 
        variant: "destructive" 
      });
    },
  });
  
  const sendNotificationMutation = useMutation({
    mutationFn: async ({ submissionId, subject, body }: { submissionId: string; subject: string; body: string }) => {
      return apiRequest("POST", `/api/rental/submissions/${submissionId}/send-notification`, { subject, body });
    },
    onSuccess: () => {
      toast({ title: "Notification Sent", description: "The applicant has been notified." });
      setIsLetterPreviewOpen(false);
      setDraftLetterSubject("");
      setDraftLetterBody("");
      setSavedDecisionId(null);
      setDecisionNotes("");
      setPendingDecision(null);
      setSelectedDenialReasons([]);
      setDenialReasonDetails({});
      setSendNoticeMyself(false);
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error?.message || "Failed to send notification.", 
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

  const deleteSubmissionMutation = useMutation({
    mutationFn: async (submissionId: string) => {
      return apiRequest("DELETE", `/api/rental/submissions/${submissionId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rental/submissions"] });
      toast({ title: "Success", description: "Application deleted." });
      setDeleteSubmissionId(null);
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error?.message || "Failed to delete application.", 
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
    setSendNoticeMyself(false);
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
      
      // If landlord wants to send themselves, skip notification entirely (no preview)
      // Otherwise, skip initially so we can show preview, then send after
      decisionMutation.mutate({
        id: selectedSubmission,
        decision: pendingDecision,
        notes: decisionNotes || undefined,
        denialReasons,
        skipNotification: true, // Always skip initially, we handle sending separately
      });
    }
  };
  
  const handleSendNotification = () => {
    if (selectedSubmission && draftLetterSubject && draftLetterBody) {
      sendNotificationMutation.mutate({
        submissionId: selectedSubmission,
        subject: draftLetterSubject,
        body: draftLetterBody,
      });
    }
  };
  
  const handleSkipNotification = () => {
    setIsLetterPreviewOpen(false);
    setDraftLetterSubject("");
    setDraftLetterBody("");
    setSavedDecisionId(null);
    setDecisionNotes("");
    setPendingDecision(null);
    setSelectedDenialReasons([]);
    setDenialReasonDetails({});
    setSendNoticeMyself(false);
    toast({ title: "Notification Skipped", description: "The decision was recorded but no notification was sent." });
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
        return submissions.filter(s => !s.decision);
      case "decided":
        return submissions.filter(s => !!s.decision);
      default:
        return submissions;
    }
  }, [submissions, filterTab]);

  const countByTab = useMemo(() => {
    if (!submissions) return { all: 0, pending: 0, decided: 0 };
    const pending = submissions.filter(s => !s.decision).length;
    const decided = submissions.filter(s => !!s.decision).length;
    return {
      all: submissions.length,
      pending,
      decided,
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
                {existingDecision && (
                  <Badge className={decisionColors[existingDecision.decision]} data-testid="badge-decision-header">
                    {existingDecision.decision === "approved" ? "Approved" : "Denied"}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
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
              ) : (
                <div className="flex flex-wrap gap-2 mb-4">
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
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Background Screening</span>
                  </div>
                  {(() => {
                    const completedPeople = submissionDetail.people.filter(p => p.isCompleted);
                    const screenedCount = completedPeople.filter(p => {
                      const order = getScreeningOrderForPerson(p.id);
                      return order?.status === 'complete';
                    }).length;
                    const pendingCount = completedPeople.filter(p => {
                      const order = getScreeningOrderForPerson(p.id);
                      return order?.status === 'sent' || order?.status === 'in_progress';
                    }).length;
                    const needsInviteCount = completedPeople.filter(p => {
                      const order = getScreeningOrderForPerson(p.id);
                      return !order || order.status === 'error' || order.status === 'not_sent';
                    }).length;
                    
                    if (completedPeople.length === 0) return null;
                    
                    return (
                      <div className="flex items-center gap-2">
                        <Badge variant={screenedCount === completedPeople.length ? "default" : "secondary"} data-testid="badge-screening-progress">
                          {screenedCount} of {completedPeople.length} screened
                        </Badge>
                        {pendingCount > 0 && (
                          <Badge variant="outline" className="text-amber-600 border-amber-500">
                            {pendingCount} pending
                          </Badge>
                        )}
                        {needsInviteCount > 0 && (
                          <Badge variant="outline" className="text-blue-600 border-blue-500">
                            {needsInviteCount} need invite
                          </Badge>
                        )}
                      </div>
                    );
                  })()}
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Each person requires individual screening. Click "Request Screening" on each person's card below.
                </p>
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
                {submissionDetail.people.map((person) => {
                  const personOrder = getScreeningOrderForPerson(person.id);
                  const needsScreeningInvite = person.isCompleted && (!personOrder || personOrder.status === 'error' || personOrder.status === 'not_sent');
                  const screeningComplete = personOrder?.status === 'complete';
                  const screeningInProgress = personOrder?.status === 'in_progress';
                  const screeningPending = personOrder?.status === 'sent';
                  
                  return (
                  <Card 
                    key={person.id} 
                    className={`bg-muted/50 ${needsScreeningInvite ? 'ring-2 ring-blue-500 ring-offset-2' : ''} ${screeningComplete ? 'ring-2 ring-green-500 ring-offset-2' : ''}`}
                    data-testid={`card-person-${person.id}`}
                  >
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
                            {needsScreeningInvite && (
                              <Badge className="bg-blue-500 text-white text-xs">
                                Action needed
                              </Badge>
                            )}
                            {screeningComplete && (
                              <Badge className="bg-green-500 text-white text-xs">
                                Screening Complete
                              </Badge>
                            )}
                            {screeningInProgress && (
                              <Badge className="bg-blue-500 text-white text-xs">
                                In Progress
                              </Badge>
                            )}
                            {screeningPending && (
                              <Badge variant="outline" className="text-amber-600 border-amber-500 text-xs">
                                Pending
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{person.email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={statusColors[person.status] || ""}>
                            {statusLabels[person.status] || person.status}
                          </Badge>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              const message = person.role === 'applicant' 
                                ? `Are you sure you want to remove ${person.firstName} ${person.lastName}? This will delete the entire application.`
                                : `Are you sure you want to remove ${person.firstName} ${person.lastName} from this application?`;
                              if (confirm(message)) {
                                if (person.role === 'applicant') {
                                  setDeleteSubmissionId(selectedSubmission);
                                } else {
                                  selectedSubmission && deletePersonMutation.mutate({ submissionId: selectedSubmission, personId: person.id });
                                }
                              }
                            }}
                            disabled={deletePersonMutation.isPending}
                            data-testid={`button-delete-person-${person.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </div>
                      
                      {!person.isCompleted && person.role === 'applicant' && (
                        <div className="mt-3 pt-3 border-t flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-amber-500" />
                            <span className="text-sm text-amber-600">Application incomplete - awaiting signature</span>
                          </div>
                          <Badge variant="outline" className="text-amber-600 border-amber-500">
                            Awaiting Signature
                          </Badge>
                        </div>
                      )}

                      {!person.isCompleted && person.role !== 'applicant' && (
                        <div className="mt-3 pt-3 border-t flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Waiting for {person.firstName} to complete their application</span>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => selectedSubmission && resendInviteMutation.mutate({ submissionId: selectedSubmission, personId: person.id })}
                            disabled={resendInviteMutation.isPending}
                            data-testid={`button-resend-invite-${person.id}`}
                          >
                            {resendInviteMutation.isPending ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <Mail className="h-4 w-4 mr-1" />
                            )}
                            Resend Invitation
                          </Button>
                        </div>
                      )}

                      {person.isCompleted && (
                        <div className="mt-3 pt-3 border-t flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">Screening</span>
                          </div>
                          {(() => {
                            const personOrder = getScreeningOrderForPerson(person.id);
                            if (!personOrder || personOrder.status === 'error' || personOrder.status === 'not_sent') {
                              return (
                                <div className="flex items-center gap-2">
                                  {personOrder?.status === 'error' && (
                                    <Badge variant="destructive" data-testid={`badge-screening-status-${person.id}`}>Error</Badge>
                                  )}
                                  {personOrder?.status === 'not_sent' && (
                                    <Badge variant="secondary" data-testid={`badge-screening-status-${person.id}`}>Not Sent</Badge>
                                  )}
                                  <Button
                                    size="sm"
                                    onClick={() => selectedSubmission && screeningMutation.mutate({ submissionId: selectedSubmission, personId: person.id })}
                                    disabled={screeningMutation.isPending}
                                    data-testid={`button-request-screening-${person.id}`}
                                  >
                                    {screeningMutation.isPending ? (
                                      <>
                                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                        Requesting...
                                      </>
                                    ) : (
                                      <>
                                        <ShieldCheck className="h-4 w-4 mr-1" />
                                        {personOrder?.status === 'error' || personOrder?.status === 'not_sent' ? 'Retry Screening' : 'Request Screening'}
                                      </>
                                    )}
                                  </Button>
                                </div>
                              );
                            }
                            return (
                              <div className="flex items-center gap-2">
                                <Badge 
                                  variant={personOrder.status === 'complete' ? 'default' : 'secondary'}
                                  data-testid={`badge-screening-status-${person.id}`}
                                >
                                  {personOrder.status === 'sent' && 'Invitation Sent'}
                                  {personOrder.status === 'in_progress' && 'In Progress'}
                                  {personOrder.status === 'complete' && 'Complete'}
                                </Badge>
                                {personOrder.status === 'sent' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => selectedSubmission && screeningMutation.mutate({ submissionId: selectedSubmission, personId: person.id })}
                                    disabled={screeningMutation.isPending}
                                    data-testid={`button-resend-screening-${person.id}`}
                                  >
                                    {screeningMutation.isPending ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Mail className="h-4 w-4" />
                                    )}
                                    <span className="ml-1">Resend Invitation</span>
                                  </Button>
                                )}
                                {personOrder.status === 'in_progress' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => syncScreeningMutation.mutate(personOrder.id)}
                                    disabled={syncScreeningMutation.isPending}
                                    data-testid={`button-sync-screening-${person.id}`}
                                  >
                                    {syncScreeningMutation.isPending ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <RefreshCw className="h-4 w-4" />
                                    )}
                                    <span className="ml-1">Sync Status</span>
                                  </Button>
                                )}
                                {personOrder.status === 'complete' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      apiRequest('POST', '/api/analytics/track', {
                                        eventType: 'western_verify_click',
                                        eventData: { source: 'rental_submissions', action: 'view_report' },
                                      }).catch(() => {});
                                      window.open('https://secure.westernverify.com/login.cfm', '_blank');
                                    }}
                                    data-testid={`button-view-report-${person.id}`}
                                  >
                                    <ExternalLink className="h-4 w-4 mr-1" />
                                    View on Western Verify
                                  </Button>
                                )}
                              </div>
                            );
                          })()}
                          {(() => {
                            const personOrder = getScreeningOrderForPerson(person.id);
                            if (personOrder?.status === 'error' && personOrder.errorMessage) {
                              return <p className="text-sm text-red-500 w-full mt-2">{personOrder.errorMessage}</p>;
                            }
                            return null;
                          })()}
                        </div>
                      )}

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
                  );
                })}
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
                                  onClick={async () => {
                                    try {
                                      const token = getAccessToken();
                                      const res = await fetch(`/api/rental/submissions/${selectedSubmission}/files/${file.id}/download`, {
                                        headers: token ? { Authorization: `Bearer ${token}` } : {},
                                      });
                                      if (!res.ok) throw new Error("Download failed");
                                      const blob = await res.blob();
                                      const url = URL.createObjectURL(blob);
                                      const a = document.createElement('a');
                                      a.href = url;
                                      a.download = file.originalName;
                                      document.body.appendChild(a);
                                      a.click();
                                      document.body.removeChild(a);
                                      URL.revokeObjectURL(url);
                                    } catch (error) {
                                      toast({ title: "Error", description: "Failed to download file", variant: "destructive" });
                                    }
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
              ) : (() => {
                const primaryApplicant = submissionDetail.people.find(p => p.role === 'applicant');
                const otherPeople = submissionDetail.people.filter(p => p.role !== 'applicant');
                
                const getEventPerson = (event: any) => {
                  const metadata = event.metadataJson as any;
                  const personId = metadata?.personId || metadata?.invitedPersonId;
                  return personId ? submissionDetail.people.find(p => p.id === personId) : null;
                };
                
                const primaryEvents = submissionDetail.events.filter(e => {
                  const person = getEventPerson(e);
                  return !person || person.role === 'applicant';
                });
                
                const otherEvents = submissionDetail.events.filter(e => {
                  const person = getEventPerson(e);
                  return person && person.role !== 'applicant';
                });
                
                const renderEvent = (event: any) => {
                  const metadata = event.metadataJson as any;
                  const personId = metadata?.personId || metadata?.invitedPersonId;
                  const person = personId ? submissionDetail.people.find(p => p.id === personId) : null;
                  const personName = metadata?.personName || (person ? `${person.firstName} ${person.lastName}` : null);
                  
                  return (
                    <div key={event.id} className="flex items-start gap-2 text-sm">
                      <div className="w-1.5 h-1.5 mt-1.5 rounded-full bg-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium capitalize text-xs">{event.eventType.replace(/_/g, " ")}</p>
                        <p className="text-muted-foreground text-xs truncate">{formatDate(event.createdAt)}</p>
                      </div>
                    </div>
                  );
                };
                
                return (
                  <div className={`grid gap-4 ${otherPeople.length > 0 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 pb-2 border-b">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-sm">
                          {primaryApplicant ? `${primaryApplicant.firstName} ${primaryApplicant.lastName}` : 'Primary Applicant'}
                        </span>
                        <Badge variant="outline" className="text-xs">Applicant</Badge>
                      </div>
                      <div className="space-y-2">
                        {primaryEvents.map(renderEvent)}
                      </div>
                      {primaryEvents.length === 0 && (
                        <p className="text-sm text-muted-foreground">No activity yet</p>
                      )}
                    </div>
                    
                    {otherPeople.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 pb-2 border-b">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-sm">Co-Applicants & Guarantors</span>
                        </div>
                        {otherPeople.map(person => {
                          const personEvents = submissionDetail.events.filter(e => {
                            const eventPerson = getEventPerson(e);
                            return eventPerson?.id === person.id;
                          });
                          
                          if (personEvents.length === 0) return null;
                          
                          return (
                            <div key={person.id} className="bg-muted/30 rounded-md p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-sm font-medium">{person.firstName} {person.lastName}</span>
                                <Badge variant="outline" className="text-xs">
                                  {roleLabels[person.role] || person.role}
                                </Badge>
                              </div>
                              <div className="space-y-2">
                                {personEvents.map(renderEvent)}
                              </div>
                            </div>
                          );
                        })}
                        {otherEvents.length === 0 && (
                          <p className="text-sm text-muted-foreground">No activity yet</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
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
                  ? "Record the approval and optionally notify the applicant."
                  : "Record the denial and optionally send an adverse action notice."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              {pendingDecision === "approved" && (
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="send-approval-myself"
                    checked={sendNoticeMyself}
                    onCheckedChange={(checked) => setSendNoticeMyself(checked === true)}
                    data-testid="checkbox-send-approval-myself"
                  />
                  <div className="flex-1">
                    <Label 
                      htmlFor="send-approval-myself"
                      className="text-sm font-medium cursor-pointer"
                    >
                      I will notify the applicant myself
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Check this if you prefer to send the approval notification yourself instead of using the automated email.
                    </p>
                  </div>
                </div>
              )}
              {pendingDecision === "denied" && (
                <div>
                  <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md p-3 mb-4">
                    <p className="text-xs text-amber-800 dark:text-amber-200">
                      <strong>Disclaimer:</strong> This tool is provided for informational purposes only and does not constitute legal advice. 
                      You should consult with your own attorney to ensure compliance with federal, state, and local fair housing laws. 
                      LeaseShield is not responsible for any legal consequences arising from your use of this feature.
                    </p>
                  </div>
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
                  
                  <div className="flex items-start gap-3 mt-4 pt-4 border-t">
                    <Checkbox
                      id="send-notice-myself"
                      checked={sendNoticeMyself}
                      onCheckedChange={(checked) => setSendNoticeMyself(checked === true)}
                      data-testid="checkbox-send-notice-myself"
                    />
                    <div className="flex-1">
                      <Label 
                        htmlFor="send-notice-myself"
                        className="text-sm font-medium cursor-pointer"
                      >
                        I will send my own adverse action notice
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Check this if you prefer to send the denial letter yourself instead of using the automated notification.
                      </p>
                    </div>
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
                disabled={decisionMutation.isPending || (pendingDecision === "denied" && selectedDenialReasons.length === 0 && !sendNoticeMyself)}
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

        <Dialog open={isLetterPreviewOpen} onOpenChange={setIsLetterPreviewOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                Review & Send Notification
              </DialogTitle>
              <DialogDescription>
                Edit the email below before sending it to the applicant. You can modify the subject and body as needed.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <Label className="text-sm font-medium">Email Subject</Label>
                <input
                  type="text"
                  value={draftLetterSubject}
                  onChange={(e) => setDraftLetterSubject(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  data-testid="input-letter-subject"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Email Body</Label>
                <Textarea
                  value={draftLetterBody}
                  onChange={(e) => setDraftLetterBody(e.target.value)}
                  rows={12}
                  className="mt-1 font-mono text-sm"
                  data-testid="input-letter-body"
                />
              </div>
              <div className="bg-muted/50 rounded-md p-3">
                <p className="text-xs text-muted-foreground">
                  This email will be sent to the primary applicant: <strong>{submissionDetail?.people.find(p => p.role === "applicant")?.email}</strong>
                </p>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button 
                variant="outline" 
                onClick={handleSkipNotification}
                data-testid="button-skip-notification"
              >
                Skip Notification
              </Button>
              <Button
                onClick={handleSendNotification}
                disabled={sendNotificationMutation.isPending || !draftLetterSubject || !draftLetterBody}
                data-testid="button-send-notification"
              >
                {sendNotificationMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Mail className="h-4 w-4 mr-1" />
                Send Email
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
          <TabsTrigger value="decided" data-testid="tab-decided">
            <CheckCircle className="h-4 w-4 mr-1 text-green-600" />
            Decided ({countByTab.decided})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Screening integration opt-in banner */}
      {screeningCredentials && !screeningCredentials.configured && (
        <Card className="mb-4 border-primary/30 bg-primary/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-8 w-8 text-primary" />
              <div>
                <p className="font-medium">Enable Tenant Screening Integration</p>
                <p className="text-sm text-muted-foreground">
                  Connect your Western Verify account to request background checks directly from this page.
                </p>
              </div>
            </div>
            <Button asChild data-testid="button-setup-screening">
              <a href="/settings">Set Up Screening</a>
            </Button>
          </CardContent>
        </Card>
      )}

      {screeningCredentials?.pendingAdminSetup && (
        <Card className="mb-4 border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20">
          <CardContent className="flex items-center gap-3 py-4">
            <Clock className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            <div>
              <p className="font-medium text-yellow-800 dark:text-yellow-200">Screening Setup In Progress</p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                Your credentials are saved. You'll receive an email when your screening integration is ready.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!deleteSubmissionId} onOpenChange={(open) => !open && setDeleteSubmissionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Application?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the application from your list. The data is preserved for record-keeping but will no longer appear in your active applications.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteSubmissionId && deleteSubmissionMutation.mutate(deleteSubmissionId)}
              disabled={deleteSubmissionMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteSubmissionMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                <TableHead>Decision</TableHead>
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
                    <div className="flex flex-wrap gap-1">
                      {sub.decision ? (
                        <Badge className={decisionColors[sub.decision.decision]}>
                          {sub.decision.decision === "approved" ? "Approved" : "Denied"}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Pending Review
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm">{formatDate(sub.createdAt)}</p>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedSubmission(sub.id)}
                        data-testid={`button-view-${sub.id}`}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setDeleteSubmissionId(sub.id)}
                        data-testid={`button-delete-${sub.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
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
