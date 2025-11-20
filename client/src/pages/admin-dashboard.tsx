import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, CheckCircle, Clock, FileText, XCircle, Eye, History } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type TemplateReview = {
  id: string;
  templateId: string;
  billId?: string;
  priority: number;
  status: "pending" | "approved" | "rejected" | "published";
  reason?: string;
  recommendedChanges?: string;
  approvalNotes?: string;
  createdAt: string;
  template?: {
    id: string;
    title: string;
    stateId: string;
    version: number;
    category: string;
  };
  bill?: {
    billNumber: string;
    title: string;
    state: string;
    status: string;
  };
};

type TemplateVersion = {
  id: number;
  templateId: string;
  versionNumber: number;
  versionNotes: string;
  lastUpdateReason: string;
  createdBy: string;
  createdAt: string;
};

export default function AdminDashboard() {
  const [selectedReview, setSelectedReview] = useState<TemplateReview | null>(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [versionNotes, setVersionNotes] = useState("");
  const [lastUpdateReason, setLastUpdateReason] = useState("");
  const [approvalNotes, setApprovalNotes] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");
  const { toast } = useToast();

  const { data: reviewData, isLoading } = useQuery({
    queryKey: ["/api/admin/template-review-queue"],
  });

  const { data: versionData } = useQuery({
    queryKey: ["/api/templates", selectedReview?.templateId, "versions"],
    enabled: !!selectedReview?.templateId && showVersionHistory,
  });

  const approveMutation = useMutation({
    mutationFn: async (reviewId: string) => {
      const response = await fetch(`/api/admin/template-review-queue/${reviewId}/approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          versionNotes,
          lastUpdateReason,
          approvalNotes,
          pdfUrl: pdfUrl || undefined,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to approve template");
      }
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/template-review-queue"] });
      toast({
        title: "Template Updated!",
        description: `Successfully published template update. ${data.notificationsSent} users notified.`,
      });
      setShowApproveDialog(false);
      setSelectedReview(null);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Approval Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (reviewId: string) => {
      const response = await fetch(`/api/admin/template-review-queue/${reviewId}/reject`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalNotes }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to reject template");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/template-review-queue"] });
      toast({
        title: "Review Rejected",
        description: "Template update has been rejected.",
      });
      setShowRejectDialog(false);
      setSelectedReview(null);
      resetForm();
    },
  });

  const resetForm = () => {
    setVersionNotes("");
    setLastUpdateReason("");
    setApprovalNotes("");
    setPdfUrl("");
  };

  const handleApprove = (review: TemplateReview) => {
    setSelectedReview(review);
    setVersionNotes(review.recommendedChanges || "");
    setLastUpdateReason(review.reason || "");
    setShowApproveDialog(true);
  };

  const handleReject = (review: TemplateReview) => {
    setSelectedReview(review);
    setShowRejectDialog(true);
  };

  const handleViewVersionHistory = (review: TemplateReview) => {
    setSelectedReview(review);
    setShowVersionHistory(true);
  };

  const reviews = (reviewData as any)?.reviews || [];
  const pendingReviews = reviews.filter((r: TemplateReview) => r.status === "pending");
  const completedReviews = reviews.filter((r: TemplateReview) => r.status !== "pending");

  const getPriorityColor = (priority: number) => {
    if (priority >= 7) return "destructive"; // high
    if (priority >= 4) return "default"; // medium
    return "secondary"; // low
  };

  const getPriorityLabel = (priority: number) => {
    if (priority >= 7) return "HIGH";
    if (priority >= 4) return "MEDIUM";
    return "LOW";
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending": return <Clock className="h-4 w-4" />;
      case "approved": return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "rejected": return <XCircle className="h-4 w-4 text-red-600" />;
      case "published": return <CheckCircle className="h-4 w-4 text-blue-600" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Clock className="h-12 w-12 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading review queue...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Template Review Queue</h1>
        <p className="text-muted-foreground">
          Review and approve template updates flagged by legislative monitoring
        </p>
      </div>

      <Tabs defaultValue="pending" className="space-y-6">
        <TabsList>
          <TabsTrigger value="pending" data-testid="tab-pending">
            Pending ({pendingReviews.length})
          </TabsTrigger>
          <TabsTrigger value="completed" data-testid="tab-completed">
            Completed ({completedReviews.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {pendingReviews.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-600" />
                  <h3 className="text-lg font-semibold mb-2">All Caught Up!</h3>
                  <p className="text-muted-foreground">
                    No pending template reviews. The next monitoring run is scheduled for the 1st of next month.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            pendingReviews.map((review: TemplateReview) => (
              <Card key={review.id} data-testid={`review-card-${review.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={getPriorityColor(review.priority)} data-testid="badge-priority">
                          {getPriorityLabel(review.priority)}
                        </Badge>
                        <Badge variant="outline" data-testid="badge-state">
                          {review.template?.stateId}
                        </Badge>
                        <Badge variant="outline" data-testid="badge-category">
                          {review.template?.category}
                        </Badge>
                      </div>
                      <CardTitle className="text-xl" data-testid="text-template-title">
                        {review.template?.title}
                      </CardTitle>
                      <CardDescription data-testid="text-current-version">
                        Current Version: {review.template?.version || 1}.0
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewVersionHistory(review)}
                      data-testid="button-view-history"
                    >
                      <History className="h-4 w-4 mr-2" />
                      History
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {review.bill && (
                    <div className="bg-muted p-4 rounded-lg">
                      <div className="flex items-start gap-3">
                        <FileText className="h-5 w-5 mt-1 text-muted-foreground" />
                        <div className="flex-1">
                          <h4 className="font-semibold mb-1" data-testid="text-bill-number">
                            {review.bill.billNumber} - {review.bill.title}
                          </h4>
                          <p className="text-sm text-muted-foreground" data-testid="text-bill-status">
                            Status: {review.bill.status}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {review.reason && (
                    <div>
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        Why This Needs Review
                      </h4>
                      <p className="text-sm text-muted-foreground" data-testid="text-reason">
                        {review.reason}
                      </p>
                    </div>
                  )}

                  {review.recommendedChanges && (
                    <div>
                      <h4 className="font-semibold mb-2">Recommended Changes</h4>
                      <p className="text-sm text-muted-foreground" data-testid="text-recommended-changes">
                        {review.recommendedChanges}
                      </p>
                    </div>
                  )}
                </CardContent>

                <CardFooter className="flex gap-2">
                  <Button
                    onClick={() => handleApprove(review)}
                    className="flex-1"
                    data-testid="button-approve"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve & Publish
                  </Button>
                  <Button
                    onClick={() => handleReject(review)}
                    variant="outline"
                    className="flex-1"
                    data-testid="button-reject"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                </CardFooter>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          {completedReviews.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground">
                  No completed reviews yet
                </div>
              </CardContent>
            </Card>
          ) : (
            completedReviews.map((review: TemplateReview) => (
              <Card key={review.id} data-testid={`completed-review-${review.id}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {getStatusIcon(review.status)}
                        <Badge variant="outline" data-testid="badge-status">
                          {review.status.toUpperCase()}
                        </Badge>
                        <Badge variant="outline">{review.template?.stateId}</Badge>
                      </div>
                      <CardTitle>{review.template?.title}</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                {review.approvalNotes && (
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{review.approvalNotes}</p>
                  </CardContent>
                )}
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Approve Template Update</DialogTitle>
            <DialogDescription>
              Review and publish the updated template. All users in {selectedReview?.template?.stateId} will be notified.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="version-notes">Version Notes *</Label>
              <Textarea
                id="version-notes"
                value={versionNotes}
                onChange={(e) => setVersionNotes(e.target.value)}
                placeholder="e.g., Updated security deposit return timeline from 30 to 45 days"
                className="mt-1"
                rows={3}
                data-testid="input-version-notes"
              />
              <p className="text-sm text-muted-foreground mt-1">
                What changed in this template?
              </p>
            </div>

            <div>
              <Label htmlFor="update-reason">Legal Update Reason *</Label>
              <Textarea
                id="update-reason"
                value={lastUpdateReason}
                onChange={(e) => setLastUpdateReason(e.target.value)}
                placeholder="e.g., Compliance with Utah HB 123 (effective January 1, 2025)"
                className="mt-1"
                rows={3}
                data-testid="input-update-reason"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Why did this template need to be updated?
              </p>
            </div>

            <div>
              <Label htmlFor="pdf-url">Updated Template URL (optional)</Label>
              <Input
                id="pdf-url"
                value={pdfUrl}
                onChange={(e) => setPdfUrl(e.target.value)}
                placeholder="https://..."
                className="mt-1"
                data-testid="input-pdf-url"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Leave blank to keep existing template file
              </p>
            </div>

            <div>
              <Label htmlFor="approval-notes">Attorney Notes (optional)</Label>
              <Textarea
                id="approval-notes"
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder="Internal notes about this review..."
                className="mt-1"
                rows={2}
                data-testid="input-approval-notes"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowApproveDialog(false)}
              data-testid="button-cancel-approve"
            >
              Cancel
            </Button>
            <Button
              onClick={() => approveMutation.mutate(selectedReview!.id)}
              disabled={!versionNotes || !lastUpdateReason || approveMutation.isPending}
              data-testid="button-confirm-approve"
            >
              {approveMutation.isPending ? "Publishing..." : "Approve & Publish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Template Update</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this template update
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Label htmlFor="reject-notes">Rejection Reason *</Label>
            <Textarea
              id="reject-notes"
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              placeholder="e.g., Bill does not materially affect this template"
              className="mt-1"
              rows={3}
              data-testid="input-reject-notes"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRejectDialog(false)}
              data-testid="button-cancel-reject"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => rejectMutation.mutate(selectedReview!.id)}
              disabled={!approvalNotes || rejectMutation.isPending}
              data-testid="button-confirm-reject"
            >
              {rejectMutation.isPending ? "Rejecting..." : "Reject Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Version History Dialog */}
      <Dialog open={showVersionHistory} onOpenChange={setShowVersionHistory}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Version History</DialogTitle>
            <DialogDescription>
              {selectedReview?.template?.title}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {(versionData as any)?.versions?.map((version: TemplateVersion) => (
              <div key={version.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold">Version {version.versionNumber}.0</h4>
                  <span className="text-sm text-muted-foreground">
                    {new Date(version.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Changes: </span>
                    <span className="text-muted-foreground">{version.versionNotes}</span>
                  </div>
                  <div>
                    <span className="font-medium">Reason: </span>
                    <span className="text-muted-foreground">{version.lastUpdateReason}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button onClick={() => setShowVersionHistory(false)} data-testid="button-close-history">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
