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
import { ScreeningConnectionBanner } from "@/components/screening-connection-banner";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Search,
  Archive,
  ArchiveRestore,
  ArrowUp,
  ArrowDown,
  DollarSign,
  Copy,
  Check,
} from "lucide-react";
import { Input } from "@/components/ui/input";
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
  screeningStatus: 'not_sent' | 'pending' | 'complete';
  archivedAt: string | null;
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
  // Background check consent tracking (FCRA authorization captured on form submission)
  fcraAuthorized: boolean;
  fcraAuthorizedTimestamp: string | null;
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
  started: "Incomplete",
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
  paystub: "Pay Stub",
  w2: "W-2 / Tax Document",
  employment_letter: "Employment Verification Letter",
  bank: "Bank Statement",
  reference: "Reference Letter",
  rental_history: "Rental History / Landlord Reference",
  pet_doc: "Pet Documentation",
  additional: "Additional Supporting Document",
  other: "Other Document",
  income: "Proof of Income",
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function RentalSubmissions() {
  const { toast } = useToast();
  const initialSelectedId = (() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    return params.get("id");
  })();
  const [selectedSubmission, setSelectedSubmission] = useState<string | null>(initialSelectedId);
  const [isDecisionDialogOpen, setIsDecisionDialogOpen] = useState(false);
  const [decisionNotes, setDecisionNotes] = useState("");
  const [pendingDecision, setPendingDecision] = useState<string | null>(null);
  const [selectedDenialReasons, setSelectedDenialReasons] = useState<string[]>([]);
  const [denialReasonDetails, setDenialReasonDetails] = useState<Record<string, string>>({});
  const [sendNoticeMyself, setSendNoticeMyself] = useState(false);
  const [filterTab, setFilterTab] = useState<"all" | "decided" | "pending">("all");
  const [expandedProperties, setExpandedProperties] = useState<Set<string>>(new Set());
  const [isLetterPreviewOpen, setIsLetterPreviewOpen] = useState(false);
  const [draftLetterSubject, setDraftLetterSubject] = useState("");
  const [draftLetterBody, setDraftLetterBody] = useState("");
  const [savedDecisionId, setSavedDecisionId] = useState<string | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadPersonId, setUploadPersonId] = useState<string | null>(null);
  const [uploadFileType, setUploadFileType] = useState<string>("other");
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [deleteSubmissionId, setDeleteSubmissionId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isReuploadDialogOpen, setIsReuploadDialogOpen] = useState(false);
  const [reuploadPersonId, setReuploadPersonId] = useState<string | null>(null);
  const [selectedReuploadTypes, setSelectedReuploadTypes] = useState<string[]>([]);
  // One-click application fee
  const [chargeFeePerson, setChargeFeePerson] = useState<SubmissionPerson | null>(null);
  const [chargeFeeAmount, setChargeFeeAmount] = useState("25");
  const [chargeFeeEmail, setChargeFeeEmail] = useState("");
  const [chargeFeeLink, setChargeFeeLink] = useState<string | null>(null);
  const [chargeFeeCopied, setChargeFeeCopied] = useState(false);
  const [sortColumn, setSortColumn] = useState<"unit" | "applicant" | "decision" | "screening" | "date">("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const { data: submissions, isLoading: isLoadingSubmissions, refetch: refetchSubmissions } = useQuery<SubmissionSummary[]>({
    queryKey: ["/api/rental/submissions", { includeArchived: showArchived }],
    queryFn: async () => {
      const token = getAccessToken();
      const url = showArchived ? '/api/rental/submissions?includeArchived=true' : '/api/rental/submissions';
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to load submissions");
      return res.json();
    },
    refetchInterval: 20000,
    refetchOnWindowFocus: true,
  });

  const prevSelectedRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevSelectedRef.current && !selectedSubmission) {
      refetchSubmissions();
      lastBulkSyncCountRef.current = null;
    }
    prevSelectedRef.current = selectedSubmission;
  }, [selectedSubmission]);

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
    refetchInterval: 20000,
    refetchOnWindowFocus: true,
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

  // A screening that has been waiting too long likely had its completion
  // message missed (rare). Western Verify offers no reliable way to confirm
  // completion automatically, so we surface stale orders here and let the
  // landlord verify on the portal and use "Mark complete" manually. We never
  // auto-complete from this signal.
  const STALE_IN_PROGRESS_DAYS = 7;
  const STALE_SENT_DAYS = 7;
  const getScreeningStaleInfo = (
    order?: ScreeningOrder
  ): { kind: "in_progress" | "sent"; days: number } | null => {
    if (!order) return null;
    if (order.status !== "in_progress" && order.status !== "sent") return null;
    const created = new Date(order.createdAt).getTime();
    if (Number.isNaN(created)) return null;
    const days = Math.floor((Date.now() - created) / (1000 * 60 * 60 * 24));
    if (order.status === "in_progress" && days >= STALE_IN_PROGRESS_DAYS) {
      return { kind: "in_progress", days };
    }
    if (order.status === "sent" && days >= STALE_SENT_DAYS) {
      return { kind: "sent", days };
    }
    return null;
  };

  // ===== Application fee (one-click payment request) =====
  // Payment setup status, used both for the inbox banner and the charge dialog.
  const { data: connectStatus, isLoading: connectStatusLoading } = useQuery<{
    accountId: string | null;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    detailsSubmitted: boolean;
  }>({
    queryKey: ["/api/stripe-connect/status"],
    enabled: !!selectedSubmission,
    staleTime: 60_000,
  });
  const paymentsReady = !!connectStatus?.chargesEnabled;
  const paymentsStarted = !!connectStatus?.accountId;

  // Landlord's default service fee (cents), shown so the applicant total is clear.
  const { data: feeSettings } = useQuery<{ defaultServiceFeeAmount: number }>({
    queryKey: ["/api/rent-payments/fee-settings"],
    enabled: !!chargeFeePerson,
    staleTime: 5 * 60_000,
  });

  const onboardMutation = useMutation({
    mutationFn: async (returnTo: string) => {
      const res = await apiRequest("POST", "/api/stripe-connect/onboard", { returnTo });
      return res.json() as Promise<{ url?: string }>;
    },
    onSuccess: (data) => {
      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast({ title: "Couldn't open setup", description: "Please try again.", variant: "destructive" });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Couldn't start setup", description: error?.message || "Please try again.", variant: "destructive" });
    },
  });

  const chargeFeeMutation = useMutation({
    mutationFn: async ({ person, amountDollars, email }: { person: SubmissionPerson; amountDollars: string; email: string }) => {
      const today = new Date().toISOString().slice(0, 10);
      const res = await apiRequest("POST", "/api/rent-payments", {
        tenantName: `${person.firstName} ${person.lastName}`.trim(),
        tenantEmail: email.trim() || undefined,
        amountDollars,
        dueDate: today,
        description: "Application Fee",
        requestType: "application_fee",
      });
      return res.json() as Promise<{ paymentLink: string }>;
    },
    onSuccess: (data) => {
      setChargeFeeLink(data.paymentLink);
      queryClient.invalidateQueries({ queryKey: ["/api/rent-payments"] });
      toast({ title: "Payment link ready", description: "Copy it or email it to your applicant." });
    },
    onError: (error: Error) => {
      toast({ title: "Couldn't create the payment link", description: error?.message || "Please try again.", variant: "destructive" });
    },
  });

  const openChargeFeeDialog = (person: SubmissionPerson) => {
    setChargeFeePerson(person);
    setChargeFeeEmail(person.email || "");
    setChargeFeeAmount("25");
    setChargeFeeLink(null);
    setChargeFeeCopied(false);
  };

  const startPaymentSetup = () => {
    const returnTo = `/rental-submissions?id=${selectedSubmission}${chargeFeePerson ? `&chargeFee=${chargeFeePerson.id}` : ""}`;
    onboardMutation.mutate(returnTo);
  };

  // After returning from Stripe onboarding we land back on this page with a
  // ?chargeFee=<personId> param. Reopen the dialog for that applicant once the
  // submission detail has loaded, then strip the param so a refresh won't reopen.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const personId = params.get("chargeFee");
    if (!personId || !submissionDetail?.people) return;
    const person = submissionDetail.people.find((p) => p.id === personId);
    if (person) {
      openChargeFeeDialog(person);
      params.delete("chargeFee");
      params.delete("connect");
      const qs = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionDetail]);

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

  const markCompleteMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await apiRequest('POST', `/api/rental/screening/${orderId}/mark-complete`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rental/submissions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rental/submissions', selectedSubmission] });
      queryClient.invalidateQueries({ queryKey: ['/api/rental/submissions', selectedSubmission, 'screening'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rental/submissions/pending-count'] });
      toast({ title: 'Marked complete', description: 'Screening is now marked as complete.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to mark screening complete.', variant: 'destructive' });
    },
  });

  const syncScreeningMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await apiRequest("POST", `/api/rental/screening/${orderId}/sync`);
      return await res.json();
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

  // Auto-sync sent/in_progress screenings when viewing a submission
  const autoSyncedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!screeningOrders || screeningOrders.length === 0) return;
    
    const pendingOrders = screeningOrders.filter(
      order => (order.status === 'sent' || order.status === 'in_progress') && !autoSyncedRef.current.has(order.id)
    );
    
    if (pendingOrders.length > 0) {
      pendingOrders.forEach(order => {
        autoSyncedRef.current.add(order.id);
        syncScreeningMutation.mutate(order.id);
      });
    }
  }, [screeningOrders]);

  // Bulk sync all pending screenings when submissions list loads
  const lastBulkSyncCountRef = useRef<number | null>(null);
  useEffect(() => {
    if (!submissions || submissions.length === 0) return;
    
    const pendingCount = submissions.filter(s => s.screeningStatus === 'pending').length;
    if (pendingCount === 0) return;
    
    if (lastBulkSyncCountRef.current === pendingCount) return;
    lastBulkSyncCountRef.current = pendingCount;
    
    (async () => {
      try {
        const res = await apiRequest("POST", "/api/rental/screening/bulk-sync");
        const result = await res.json();
        if (result.completed > 0) {
          toast({ title: "Screenings Updated", description: `${result.completed} screening(s) marked complete.` });
        }
      } catch (err) {
        console.error("[BulkSync] Failed:", err);
      } finally {
        queryClient.invalidateQueries({ queryKey: ["/api/rental/submissions"] });
      }
    })();
  }, [submissions]);

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
    mutationFn: async ({ submissionId, personId, fileType, files }: { 
      submissionId: string; 
      personId: string;
      fileType: string;
      files: File[];
    }) => {
      const token = getAccessToken();
      const results = [];
      
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('personId', personId);
        formData.append('fileType', fileType);
        
        const res = await fetch(`/api/rental/submissions/${submissionId}/files`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });
        if (!res.ok) throw new Error(`Failed to upload file: ${file.name}`);
        results.push(await res.json());
      }
      return results;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/rental/submissions", selectedSubmission, "files"] });
      const count = variables.files.length;
      toast({ title: "Success", description: `${count} document${count > 1 ? 's' : ''} uploaded successfully.` });
      setIsUploadDialogOpen(false);
      setUploadFiles([]);
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

  const archiveMutation = useMutation({
    mutationFn: async ({ id, archive }: { id: string; archive: boolean }) => {
      return apiRequest("POST", `/api/rental/submissions/${id}/${archive ? 'archive' : 'unarchive'}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rental/submissions"] });
      toast({ title: "Success", description: "Application updated." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Failed to update application.", variant: "destructive" });
    },
  });

  const reuploadDocTypes = [
    { type: "id", label: "Government-issued ID" },
    { type: "paystub", label: "Pay Stubs" },
    { type: "w2", label: "W-2 / Tax Documents" },
    { type: "employment_letter", label: "Employment Verification Letter" },
    { type: "bank", label: "Bank Statements" },
    { type: "reference", label: "Reference Letters" },
    { type: "rental_history", label: "Rental History / Landlord Reference" },
    { type: "pet_doc", label: "Pet Documentation" },
    { type: "additional", label: "Additional Supporting Documents" },
    { type: "income", label: "Proof of Income" },
  ];

  const requestReuploadMutation = useMutation({
    mutationFn: async ({ personId, types }: { personId: string; types: string[] }) => {
      return apiRequest("POST", `/api/admin/people/${personId}/reupload-link`, {
        allowed_file_types: types,
        expires_in_days: 7,
      });
    },
    onSuccess: (data: any) => {
      setIsReuploadDialogOpen(false);
      setSelectedReuploadTypes([]);
      toast({ title: "Link sent", description: "The applicant will receive an email with the upload link." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Failed to send re-upload link.", variant: "destructive" });
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

  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const handleDownloadApplication = async () => {
    if (!selectedSubmission) return;
    setIsDownloadingPdf(true);
    try {
      const token = getAccessToken();
      const res = await fetch(`/api/rental/submissions/${selectedSubmission}/application-pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to download application");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rental-application.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Download Complete", description: "Application PDF downloaded successfully." });
    } catch (error) {
      toast({ title: "Download Failed", description: "Could not generate the application PDF. Please try again.", variant: "destructive" });
    } finally {
      setIsDownloadingPdf(false);
    }
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
    let result = submissions;

    switch (filterTab) {
      case "pending":
        result = result.filter(s => !s.decision);
        break;
      case "decided":
        result = result.filter(s => !!s.decision);
        break;
    }

    if (showArchived) {
      result = result.filter(s => !!s.archivedAt);
    } else {
      result = result.filter(s => !s.archivedAt);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(s => {
        const applicantName = s.primaryApplicant
          ? `${s.primaryApplicant.firstName} ${s.primaryApplicant.lastName}`.toLowerCase()
          : '';
        const email = s.primaryApplicant?.email?.toLowerCase() || '';
        const property = s.propertyName.toLowerCase();
        const unit = (s.unitLabel || '').toLowerCase();
        const date = new Date(s.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toLowerCase();
        return applicantName.includes(q) || email.includes(q) || property.includes(q) || unit.includes(q) || date.includes(q);
      });
    }

    return result;
  }, [submissions, filterTab, searchQuery, showArchived]);

  const countByTab = useMemo(() => {
    if (!submissions) return { all: 0, pending: 0, decided: 0, archived: 0 };
    const active = submissions.filter(s => !s.archivedAt);
    const pending = active.filter(s => !s.decision).length;
    const decided = active.filter(s => !!s.decision).length;
    const archived = submissions.filter(s => !!s.archivedAt).length;
    return {
      all: active.length,
      pending,
      decided,
      archived,
    };
  }, [submissions]);

  const sortSubmissions = (subs: SubmissionSummary[]) => {
    const dir = sortDirection === "asc" ? 1 : -1;
    return [...subs].sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case "unit":
          cmp = (a.unitLabel || "").localeCompare(b.unitLabel || "");
          break;
        case "applicant": {
          const nameA = a.primaryApplicant ? `${a.primaryApplicant.lastName} ${a.primaryApplicant.firstName}` : "";
          const nameB = b.primaryApplicant ? `${b.primaryApplicant.lastName} ${b.primaryApplicant.firstName}` : "";
          cmp = nameA.localeCompare(nameB);
          break;
        }
        case "decision": {
          const rank = (s: SubmissionSummary) => !s.decision ? 0 : s.decision.decision === "approved" ? 1 : 2;
          cmp = rank(a) - rank(b);
          break;
        }
        case "screening": {
          const rank = (s: SubmissionSummary) => s.screeningStatus === "complete" ? 2 : s.screeningStatus === "pending" ? 1 : 0;
          cmp = rank(a) - rank(b);
          break;
        }
        case "date":
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
      }
      return cmp * dir;
    });
  };

  const handleSort = (col: typeof sortColumn) => {
    if (sortColumn === col) {
      setSortDirection(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(col);
      setSortDirection(col === "date" ? "desc" : "asc");
    }
  };

  const groupedByProperty = useMemo(() => {
    const groups = new Map<string, { propertyName: string; submissions: SubmissionSummary[]; pendingCount: number; decidedCount: number }>();
    
    for (const sub of filteredSubmissions) {
      const key = sub.propertyName;
      if (!groups.has(key)) {
        groups.set(key, {
          propertyName: key,
          submissions: [],
          pendingCount: 0,
          decidedCount: 0,
        });
      }
      const group = groups.get(key)!;
      group.submissions.push(sub);
      if (sub.decision) {
        group.decidedCount++;
      } else {
        group.pendingCount++;
      }
    }
    
    const result = Array.from(groups.values()).sort((a, b) => 
      a.propertyName.localeCompare(b.propertyName)
    );
    for (const g of result) {
      g.submissions = sortSubmissions(g.submissions);
    }
    return result;
  }, [filteredSubmissions, sortColumn, sortDirection]);

  const toggleAllExpanded = () => {
    const allCurrentlyExpanded = groupedByProperty.every(g => expandedProperties.has(g.propertyName));
    if (allCurrentlyExpanded) {
      setExpandedProperties(new Set());
    } else {
      setExpandedProperties(new Set(groupedByProperty.map(g => g.propertyName)));
    }
  };

  const allExpanded = groupedByProperty.length > 0 && groupedByProperty.every(g => expandedProperties.has(g.propertyName));

  useEffect(() => {
    setExpandedProperties(new Set());
  }, [filterTab]);

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
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleDownloadApplication}
              disabled={isDownloadingPdf}
              data-testid="button-download-application"
            >
              {isDownloadingPdf ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {isDownloadingPdf ? "Generating..." : "Download PDF"}
            </Button>
            <Button
              variant="outline"
              onClick={handlePrint}
              data-testid="button-print-application"
            >
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
            {submissionDetail && (
              <Button
                variant="outline"
                onClick={() => {
                  archiveMutation.mutate(
                    { id: selectedSubmission!, archive: !submissionDetail.archivedAt },
                    { onSuccess: () => setSelectedSubmission(null) }
                  );
                }}
                disabled={archiveMutation.isPending}
                data-testid="button-archive-detail"
              >
                {submissionDetail.archivedAt ? (
                  <>
                    <ArchiveRestore className="mr-2 h-4 w-4" />
                    Unarchive
                  </>
                ) : (
                  <>
                    <Archive className="mr-2 h-4 w-4" />
                    Archive
                  </>
                )}
              </Button>
            )}
          </div>
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
                  Each person requires individual screening. Click "Request Screening" on each person's card below. Screening is handled in Western Verify — costs are billed there, not through LeaseShield or Stripe.
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

                      <div className="mt-3 pt-3 border-t flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">Application fee</span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openChargeFeeDialog(person)}
                          data-testid={`button-charge-app-fee-${person.id}`}
                        >
                          <DollarSign className="h-4 w-4 mr-1" />
                          Charge fee
                        </Button>
                      </div>

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
                                {(personOrder.status === 'sent' || personOrder.status === 'in_progress') && (
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
                                {(personOrder.status === 'sent' || personOrder.status === 'in_progress') && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      if (confirm(`Mark this screening as complete? Only do this after you've confirmed on Western Verify that the report is ready. This bypasses LeaseShield's automatic completion check.`)) {
                                        markCompleteMutation.mutate(personOrder.id);
                                      }
                                    }}
                                    disabled={markCompleteMutation.isPending}
                                    data-testid={`button-mark-complete-${person.id}`}
                                    title="Manually mark as complete (use only after verifying on Western Verify)"
                                  >
                                    {markCompleteMutation.isPending ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <CheckCircle className="h-4 w-4" />
                                    )}
                                    <span className="ml-1">Mark complete</span>
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
                          {(() => {
                            const personOrder = getScreeningOrderForPerson(person.id);
                            const stale = getScreeningStaleInfo(personOrder);
                            if (!stale) return null;
                            return (
                              <div
                                className="flex items-start gap-2 w-full mt-2 rounded-md border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40 p-2"
                                data-testid={`note-screening-stale-${person.id}`}
                              >
                                <Clock className="h-4 w-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                                <p className="text-sm text-amber-800 dark:text-amber-200">
                                  {stale.kind === 'in_progress'
                                    ? `This screening was requested ${stale.days} days ago and is still in progress. If Western Verify shows the report is ready, open it to confirm, then use "Mark complete" above.`
                                    : `The invitation was sent ${stale.days} days ago and the applicant hasn't started. Consider resending the invitation.`}
                                </p>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {/* Background Check Consent Status */}
                      {person.isCompleted && (
                        <div className="mt-3 pt-3 border-t">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">Background Check Authorization</span>
                            </div>
                            {person.fcraAuthorized ? (
                              <div className="flex items-center gap-2">
                                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Authorized
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {person.fcraAuthorizedTimestamp && formatDate(person.fcraAuthorizedTimestamp)}
                                </span>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={async () => {
                                    try {
                                      const token = getAccessToken();
                                      const res = await fetch(`/api/rental/submissions/${selectedSubmission}/person/${person.id}/consent-pdf`, {
                                        headers: token ? { Authorization: `Bearer ${token}` } : {},
                                      });
                                      if (!res.ok) throw new Error("Failed to download");
                                      const blob = await res.blob();
                                      const url = URL.createObjectURL(blob);
                                      const a = document.createElement("a");
                                      a.href = url;
                                      a.download = `consent-authorization-${person.firstName}-${person.lastName}.pdf`;
                                      a.click();
                                      URL.revokeObjectURL(url);
                                    } catch (error) {
                                      toast({ title: "Download failed", variant: "destructive" });
                                    }
                                  }}
                                  data-testid={`button-download-consent-${person.id}`}
                                >
                                  <Download className="h-4 w-4 mr-1" />
                                  Download PDF
                                </Button>
                              </div>
                            ) : (
                              <Badge variant="secondary" className="text-muted-foreground">
                                Not yet authorized
                              </Badge>
                            )}
                          </div>
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
                                {(person.formJson.smoker !== undefined || person.formJson.smokesOrVapes !== undefined) && (
                                  <div data-testid={`field-smoker-${person.id}`}>
                                    <span className="text-muted-foreground block text-xs">Smokes/Vapes</span>
                                    <span>{(person.formJson.smokesOrVapes ?? person.formJson.smoker) ? "Yes" : "No"}</span>
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
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setReuploadPersonId(person.id);
                              setSelectedReuploadTypes([]);
                              setIsReuploadDialogOpen(true);
                            }}
                            data-testid={`button-request-docs-${person.id}`}
                          >
                            <Mail className="h-4 w-4 mr-1" />
                            Request Docs
                          </Button>
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
                                      if (!res.ok) {
                                        const body = await res.json().catch(() => ({}));
                                        throw new Error(body.message || "Download failed");
                                      }
                                      const blob = await res.blob();
                                      const url = URL.createObjectURL(blob);
                                      const a = document.createElement('a');
                                      a.href = url;
                                      a.download = file.originalName;
                                      document.body.appendChild(a);
                                      a.click();
                                      document.body.removeChild(a);
                                      URL.revokeObjectURL(url);
                                    } catch (error: any) {
                                      toast({ title: "Error", description: error?.message || "Failed to download file", variant: "destructive" });
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
              <DialogTitle>Upload Documents</DialogTitle>
              <DialogDescription>
                Add one or more documents to this application. You can select multiple files at once (e.g., 3 pay stubs).
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
                    <SelectItem value="paystub">Pay Stub</SelectItem>
                    <SelectItem value="w2">W-2 / Tax Document</SelectItem>
                    <SelectItem value="employment_letter">Employment Verification Letter</SelectItem>
                    <SelectItem value="bank">Bank Statement</SelectItem>
                    <SelectItem value="reference">Reference Letter</SelectItem>
                    <SelectItem value="rental_history">Rental History / Landlord Reference</SelectItem>
                    <SelectItem value="pet_doc">Pet Documentation</SelectItem>
                    <SelectItem value="additional">Additional Supporting Document</SelectItem>
                    <SelectItem value="other">Other Document</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium">Files</Label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  multiple
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      setUploadFiles(Array.from(e.target.files));
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
                  Accepts PDF, JPG, or PNG files up to 10MB each. Select multiple files at once.
                </p>
                {uploadFiles.length > 0 && (
                  <div className="mt-2 p-2 bg-muted/50 rounded-md">
                    <p className="text-xs font-medium mb-1">{uploadFiles.length} file{uploadFiles.length > 1 ? 's' : ''} selected:</p>
                    <ul className="text-xs text-muted-foreground space-y-0.5">
                      {uploadFiles.map((file, idx) => (
                        <li key={idx} className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {file.name} ({formatFileSize(file.size)})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsUploadDialogOpen(false);
                  setUploadFiles([]);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (selectedSubmission && uploadPersonId && uploadFiles.length > 0) {
                    uploadFileMutation.mutate({
                      submissionId: selectedSubmission,
                      personId: uploadPersonId,
                      fileType: uploadFileType,
                      files: uploadFiles,
                    });
                  }
                }}
                disabled={!uploadPersonId || uploadFiles.length === 0 || uploadFileMutation.isPending}
                data-testid="button-confirm-upload"
              >
                {uploadFileMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Upload {uploadFiles.length > 0 ? `(${uploadFiles.length})` : ''}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isReuploadDialogOpen} onOpenChange={setIsReuploadDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request Missing Documents</DialogTitle>
              <DialogDescription>
                Select which documents to request from this applicant. They'll receive an email with a secure upload link that expires in 7 days.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {reuploadDocTypes.map((dt) => (
                <label
                  key={dt.type}
                  className="flex items-center gap-3 p-2 rounded-md hover-elevate cursor-pointer"
                  data-testid={`checkbox-reupload-${dt.type}`}
                >
                  <Checkbox
                    checked={selectedReuploadTypes.includes(dt.type)}
                    onCheckedChange={(checked) => {
                      setSelectedReuploadTypes((prev) =>
                        checked
                          ? [...prev, dt.type]
                          : prev.filter((t) => t !== dt.type)
                      );
                    }}
                  />
                  <span className="text-sm">{dt.label}</span>
                </label>
              ))}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsReuploadDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (reuploadPersonId && selectedReuploadTypes.length > 0) {
                    requestReuploadMutation.mutate({
                      personId: reuploadPersonId,
                      types: selectedReuploadTypes,
                    });
                  }
                }}
                disabled={selectedReuploadTypes.length === 0 || requestReuploadMutation.isPending}
                data-testid="button-send-reupload-link"
              >
                {requestReuploadMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Mail className="h-4 w-4 mr-1" />
                Send Upload Link
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

        <Dialog open={!!chargeFeePerson} onOpenChange={(open) => { if (!open) setChargeFeePerson(null); }}>
          <DialogContent className="max-w-md" data-testid="dialog-charge-app-fee">
            <DialogHeader>
              <DialogTitle>Charge application fee</DialogTitle>
              <DialogDescription>
                {chargeFeePerson ? `Send a one-time payment request to ${chargeFeePerson.firstName} ${chargeFeePerson.lastName}.` : ""}
              </DialogDescription>
            </DialogHeader>

            {connectStatusLoading ? (
              <div className="flex items-center justify-center py-8" data-testid="status-charge-fee-loading">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : !paymentsReady ? (
              <div className="space-y-4">
                <div className="rounded-md bg-muted p-4 space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    {paymentsStarted ? "Finish setting up payments" : "Set up payments first"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {paymentsStarted
                      ? "Your payment account isn't quite ready yet. Finishing the few remaining details with Stripe takes about a minute, then you can charge fees and collect rent."
                      : "To collect an application fee, connect a free Stripe account. It's a quick, guided setup (about 2 minutes) and lets you accept payments directly to your bank."}
                  </p>
                </div>
                <ol className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex gap-2"><span className="font-medium text-foreground">1.</span> Click the button below to open Stripe.</li>
                  <li className="flex gap-2"><span className="font-medium text-foreground">2.</span> Enter your business and bank details.</li>
                  <li className="flex gap-2"><span className="font-medium text-foreground">3.</span> You'll come right back here to finish charging the fee.</li>
                </ol>
                <Button
                  className="w-full"
                  onClick={startPaymentSetup}
                  disabled={onboardMutation.isPending}
                  data-testid="button-start-payment-setup"
                >
                  {onboardMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <DollarSign className="h-4 w-4 mr-1" />
                  )}
                  {paymentsStarted ? "Finish payment setup" : "Set up payments"}
                </Button>
              </div>
            ) : chargeFeeLink ? (
              <div className="space-y-4">
                <div className="rounded-md bg-muted p-4 flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <p className="text-sm text-foreground">Payment link created. Share it with your applicant.</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Payment link</Label>
                  <div className="flex items-center gap-2">
                    <Input readOnly value={chargeFeeLink} className="text-xs" data-testid="input-charge-fee-link" />
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(chargeFeeLink);
                        setChargeFeeCopied(true);
                        setTimeout(() => setChargeFeeCopied(false), 2000);
                      }}
                      data-testid="button-copy-charge-fee-link"
                    >
                      {chargeFeeCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="rounded-md border p-3 space-y-2">
                  <p className="text-sm font-medium text-foreground">How this works</p>
                  <ol className="space-y-1.5 text-sm text-muted-foreground">
                    <li className="flex gap-2"><span className="font-medium text-foreground">1.</span> Send this link to your applicant (paste it into an email or text).</li>
                    <li className="flex gap-2"><span className="font-medium text-foreground">2.</span> They open it and pay securely by card or bank.</li>
                    <li className="flex gap-2"><span className="font-medium text-foreground">3.</span> The payment shows up under Rent → History.</li>
                  </ol>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setChargeFeePerson(null)} data-testid="button-close-charge-fee">
                    Done
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="charge-fee-amount">Amount</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <Input
                      id="charge-fee-amount"
                      type="number"
                      min="1"
                      step="1"
                      value={chargeFeeAmount}
                      onChange={(e) => setChargeFeeAmount(e.target.value)}
                      className="pl-7"
                      data-testid="input-charge-fee-amount"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Labeled "Application Fee" on the applicant's payment page.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="charge-fee-email">Applicant email (optional)</Label>
                  <Input
                    id="charge-fee-email"
                    type="email"
                    value={chargeFeeEmail}
                    onChange={(e) => setChargeFeeEmail(e.target.value)}
                    placeholder="applicant@email.com"
                    data-testid="input-charge-fee-email"
                  />
                </div>
                {feeSettings && feeSettings.defaultServiceFeeAmount > 0 && (
                  <p className="text-xs text-muted-foreground" data-testid="text-charge-fee-service-note">
                    A {`$${(feeSettings.defaultServiceFeeAmount / 100).toFixed(2)}`} service fee is added at checkout, so your applicant pays{" "}
                    {`$${((parseFloat(chargeFeeAmount || "0") || 0) + feeSettings.defaultServiceFeeAmount / 100).toFixed(2)}`} total. You receive the full {`$${(parseFloat(chargeFeeAmount || "0") || 0).toFixed(2)}`}.
                  </p>
                )}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setChargeFeePerson(null)} data-testid="button-cancel-charge-fee">
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (!chargeFeePerson) return;
                      chargeFeeMutation.mutate({ person: chargeFeePerson, amountDollars: chargeFeeAmount, email: chargeFeeEmail });
                    }}
                    disabled={chargeFeeMutation.isPending || !(parseFloat(chargeFeeAmount || "0") >= 1)}
                    data-testid="button-create-charge-fee-link"
                  >
                    {chargeFeeMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <DollarSign className="h-4 w-4 mr-1" />
                    )}
                    Create payment link
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      {/* Hero Header */}
      <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-b">
        <div className="container max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-primary/10 rounded-md">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-display font-semibold text-foreground mb-1" data-testid="text-page-title">
                  Application Inbox
                </h1>
                <p className="text-sm sm:text-base text-muted-foreground">
                  Review and manage tenant applications for your properties.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div>
                <p className="text-2xl font-semibold text-foreground tabular-nums" data-testid="text-pending-count">
                  {countByTab.pending}
                </p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
              <div className="h-10 w-px bg-border" />
              <div>
                <p className="text-2xl font-semibold text-foreground tabular-nums" data-testid="text-total-count">
                  {countByTab.all}
                </p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-6xl mx-auto py-6 px-4">
      {/* Western Verify connection status / setup */}
      <ScreeningConnectionBanner className="mb-4" />
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

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, property, or date..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-submissions"
          />
        </div>
        <Button
          variant={showArchived ? "default" : "outline"}
          size="sm"
          onClick={() => setShowArchived(!showArchived)}
          data-testid="button-toggle-archived"
        >
          <Archive className="h-4 w-4 mr-1" />
          {showArchived ? `Archived (${countByTab.archived})` : "Show Archived"}
        </Button>
      </div>

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
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground" data-testid="text-grouped-summary">
              {groupedByProperty.length} {groupedByProperty.length === 1 ? 'property' : 'properties'} with {filteredSubmissions.length} {filteredSubmissions.length === 1 ? 'application' : 'applications'}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleAllExpanded}
              data-testid="button-toggle-all-properties"
            >
              <ChevronsUpDown className="h-4 w-4 mr-1" />
              {allExpanded ? 'Collapse All' : 'Expand All'}
            </Button>
          </div>

          {groupedByProperty.map((group) => {
            const isExpanded = expandedProperties.has(group.propertyName);
            return (
              <Card key={group.propertyName} data-testid={`card-property-${group.propertyName}`}>
                <Collapsible
                  open={isExpanded}
                  onOpenChange={(open) => {
                    setExpandedProperties(prev => {
                      const next = new Set(prev);
                      if (open) {
                        next.add(group.propertyName);
                      } else {
                        next.delete(group.propertyName);
                      }
                      return next;
                    });
                  }}
                >
                  <CollapsibleTrigger asChild>
                    <button
                      className="w-full text-left p-4 flex items-center justify-between gap-4"
                      data-testid={`button-toggle-${group.propertyName}`}
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        )}
                        <Building2 className="h-5 w-5 text-primary" />
                        <div>
                          <h3 className="font-semibold" data-testid={`text-property-name-${group.propertyName}`}>{group.propertyName}</h3>
                          <p className="text-sm text-muted-foreground" data-testid={`text-property-count-${group.propertyName}`}>
                            {group.submissions.length} {group.submissions.length === 1 ? 'application' : 'applications'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {group.pendingCount > 0 && (
                          <Badge variant="outline" data-testid={`badge-pending-${group.propertyName}`}>
                            {group.pendingCount} pending
                          </Badge>
                        )}
                        {group.decidedCount > 0 && (
                          <Badge variant="secondary" data-testid={`badge-decided-${group.propertyName}`}>
                            {group.decidedCount} decided
                          </Badge>
                        )}
                      </div>
                    </button>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="border-t">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {([
                            ["unit", "Unit"],
                            ["applicant", "Applicant"],
                            ["decision", "Decision"],
                            ["screening", "Screening"],
                            ["date", "Date"],
                          ] as const).map(([col, label]) => (
                            <TableHead
                              key={col}
                              className="cursor-pointer select-none"
                              onClick={() => handleSort(col)}
                              data-testid={`sort-${col}`}
                            >
                              <span className="inline-flex items-center gap-1">
                                {label}
                                {sortColumn === col ? (
                                  sortDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                                ) : (
                                  <ChevronsUpDown className="h-3 w-3 text-muted-foreground/50" />
                                )}
                              </span>
                            </TableHead>
                          ))}
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.submissions.map((sub) => (
                          <TableRow key={sub.id} data-testid={`row-submission-${sub.id}`}>
                            <TableCell>
                              <p className="font-medium" data-testid={`text-unit-${sub.id}`}>{sub.unitLabel || '-'}</p>
                            </TableCell>
                            <TableCell>
                              {sub.primaryApplicant ? (
                                <div>
                                  <p className="font-medium" data-testid={`text-applicant-name-${sub.id}`}>
                                    {sub.primaryApplicant.firstName} {sub.primaryApplicant.lastName}
                                  </p>
                                  <p className="text-xs text-muted-foreground" data-testid={`text-applicant-email-${sub.id}`}>{sub.primaryApplicant.email}</p>
                                  {sub.peopleCount > 1 && (
                                    <p className="text-xs text-muted-foreground">
                                      +{sub.peopleCount - 1} more
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {sub.decision ? (
                                  <Badge className={decisionColors[sub.decision.decision]} data-testid={`badge-decision-${sub.id}`}>
                                    {sub.decision.decision === "approved" ? "Approved" : "Denied"}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-muted-foreground" data-testid={`badge-decision-${sub.id}`}>
                                    Pending Review
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {sub.screeningStatus === 'complete' ? (
                                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" data-testid={`badge-screening-${sub.id}`}>
                                  Complete
                                </Badge>
                              ) : sub.screeningStatus === 'pending' ? (
                                <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100" data-testid={`badge-screening-${sub.id}`}>
                                  Pending
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-muted-foreground" data-testid={`badge-screening-${sub.id}`}>
                                  Not Sent
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <p className="text-sm" data-testid={`text-date-${sub.id}`}>{formatDate(sub.createdAt)}</p>
                              {sub.archivedAt && (
                                <Badge variant="secondary" className="text-xs mt-1" data-testid={`badge-archived-${sub.id}`}>
                                  Archived
                                </Badge>
                              )}
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
                                  onClick={() => archiveMutation.mutate({ id: sub.id, archive: !sub.archivedAt })}
                                  disabled={archiveMutation.isPending}
                                  title={sub.archivedAt ? "Unarchive" : "Archive"}
                                  data-testid={`button-archive-${sub.id}`}
                                >
                                  {sub.archivedAt ? (
                                    <ArchiveRestore className="h-4 w-4 text-muted-foreground" />
                                  ) : (
                                    <Archive className="h-4 w-4 text-muted-foreground" />
                                  )}
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
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}
