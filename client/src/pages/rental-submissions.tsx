import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
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

interface Decision {
  id: string;
  submissionId: string;
  decision: "approved" | "denied";
  decidedAt: string;
  notes: string | null;
}

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

  const { data: submissionFiles } = useQuery<Record<string, SubmissionFile[]>>({
    queryKey: ["/api/rental-submissions", selectedSubmission, "files"],
    queryFn: async () => {
      const token = getAccessToken();
      const res = await fetch(`/api/rental-submissions/${selectedSubmission}/files`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return {};
      return res.json();
    },
    enabled: !!selectedSubmission,
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
    mutationFn: async ({ id, decision, notes }: { id: string; decision: string; notes?: string }) => {
      return apiRequest("POST", `/api/rental/submissions/${id}/decision`, { decision, notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rental/submissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rental/submissions", selectedSubmission] });
      queryClient.invalidateQueries({ queryKey: ["/api/rental/submissions", selectedSubmission, "decision"] });
      toast({ title: "Decision Recorded", description: `Application has been ${pendingDecision}.` });
      setIsDecisionDialogOpen(false);
      setDecisionNotes("");
      setPendingDecision(null);
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error?.message || "Failed to record decision.", 
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
    setIsDecisionDialogOpen(true);
  };

  const confirmDecision = () => {
    if (selectedSubmission && pendingDecision) {
      decisionMutation.mutate({
        id: selectedSubmission,
        decision: pendingDecision,
        notes: decisionNotes || undefined,
      });
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

  if (selectedSubmission && submissionDetail) {
    return (
      <div className="container max-w-6xl mx-auto py-6 px-4">
        <Button
          variant="ghost"
          onClick={() => setSelectedSubmission(null)}
          className="mb-4"
          data-testid="button-back-to-list"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Applications
        </Button>

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
                <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t">
                  <span className="text-sm font-medium">Final Decision:</span>
                  <Badge className={decisionColors[existingDecision.decision]} data-testid="badge-decision">
                    {existingDecision.decision === "approved" ? "Approved" : "Denied"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    on {formatDate(existingDecision.decidedAt)}
                  </span>
                  {existingDecision.notes && (
                    <p className="w-full text-sm text-muted-foreground mt-2">
                      Note: {existingDecision.notes}
                    </p>
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

              {submissionDetail.landlordNotes && (
                <div className="bg-muted p-3 rounded-md">
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
                        <div className="mt-4 pt-4 border-t">
                          <p className="text-sm font-medium mb-2">Application Details</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            {person.formJson.phone && (
                              <div>
                                <span className="text-muted-foreground">Phone:</span>{" "}
                                {person.formJson.phone}
                              </div>
                            )}
                            {person.formJson.dateOfBirth && (
                              <div>
                                <span className="text-muted-foreground">DOB:</span>{" "}
                                {person.formJson.dateOfBirth}
                              </div>
                            )}
                            {person.formJson.currentAddress && (
                              <div className="md:col-span-2">
                                <span className="text-muted-foreground">Current Address:</span>{" "}
                                {person.formJson.currentAddress}
                              </div>
                            )}
                            {person.formJson.currentEmployer && (
                              <div>
                                <span className="text-muted-foreground">Employer:</span>{" "}
                                {person.formJson.currentEmployer}
                              </div>
                            )}
                            {person.formJson.monthlyIncome && (
                              <div>
                                <span className="text-muted-foreground">Monthly Income:</span> $
                                {person.formJson.monthlyIncome}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Paperclip className="h-5 w-5" />
                Uploaded Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              {submissionDetail.people.map((person) => {
                const personFiles = submissionFiles?.[person.id] || [];
                return (
                  <div key={`docs-${person.id}`} className="mb-4 last:mb-0">
                    <p className="text-sm font-medium mb-2">
                      {person.firstName} {person.lastName}
                      <Badge variant="outline" className="ml-2 text-xs">
                        {roleLabels[person.role] || person.role}
                      </Badge>
                    </p>
                    {personFiles.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No documents uploaded.</p>
                    ) : (
                      <div className="space-y-2">
                        {personFiles.map((file) => (
                          <div
                            key={file.id}
                            className="flex flex-wrap items-center justify-between gap-2 p-2 bg-muted/50 rounded-md"
                            data-testid={`file-${file.id}`}
                          >
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="text-sm font-medium">{file.originalName}</p>
                                <p className="text-xs text-muted-foreground">
                                  {fileTypeLabels[file.fileType] || file.fileType} · {formatFileSize(file.fileSize)}
                                </p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                window.open(`/api/rental-submissions/${selectedSubmission}/files/${file.id}/download`, '_blank');
                              }}
                              data-testid={`button-download-${file.id}`}
                            >
                              <Download className="h-4 w-4 mr-1" />
                              Download
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
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
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Notes (optional)</label>
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
                disabled={decisionMutation.isPending}
                data-testid="button-confirm-decision"
              >
                {decisionMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {pendingDecision === "approved" ? "Approve" : "Deny"}
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

      {isLoadingSubmissions ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : !submissions || submissions.length === 0 ? (
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
              {submissions.map((sub) => (
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
