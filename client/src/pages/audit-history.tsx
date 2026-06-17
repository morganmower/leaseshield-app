import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Link } from "wouter";
import {
  CheckCircle,
  AlertTriangle,
  Lock,
  ArrowLeft,
  ClipboardList,
  Calendar,
  MapPin,
  FileText,
  Loader2,
  Pencil,
  Trash2,
  Eye,
  Building,
  Scale,
} from "lucide-react";

interface AuditLog {
  id: string;
  userId: string;
  applicantName: string | null;
  stateId: string;
  countyId: string | null;
  countyName: string | null;
  cityId: string | null;
  cityName: string | null;
  ruleVersion: string;
  outcome: 'approve' | 'conditional' | 'deny';
  criteriaPresent: string[];
  criteriaSelectedForDenial: string[] | null;
  generatedDenialText: string | null;
  adverseActionLetterGenerated: boolean;
  conditionsApplied: string[] | null;
  fairChanceStepsCompleted: Record<string, boolean> | null;
  noticesProvided: string[] | null;
  createdAt: string;
}

const OUTCOME_STYLES = {
  approve: {
    icon: CheckCircle,
    label: "Approved",
    badgeClass: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
    iconClass: "text-green-600",
  },
  conditional: {
    icon: AlertTriangle,
    label: "Conditional",
    badgeClass: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
    iconClass: "text-amber-600",
  },
  deny: {
    icon: Lock,
    label: "Denied",
    badgeClass: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
    iconClass: "text-red-600",
  },
};

export default function AuditHistory() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [editingLog, setEditingLog] = useState<AuditLog | null>(null);
  const [viewingLog, setViewingLog] = useState<AuditLog | null>(null);
  const [deleteLogId, setDeleteLogId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editOutcome, setEditOutcome] = useState<'approve' | 'conditional' | 'deny'>('approve');
  const [isDownloading, setIsDownloading] = useState(false);

  const { data: logs = [], isLoading } = useQuery<AuditLog[]>({
    queryKey: ['/api/denial-decision/audit-history'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/denial-decision/audit-history');
      return res.json();
    },
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('DELETE', `/api/denial-decision/audit-history/${id}`);
      if (!res.ok) throw new Error('Failed to delete');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/denial-decision/audit-history'] });
      toast({ title: "Entry Deleted", description: "The decision record has been removed." });
      setDeleteLogId(null);
    },
    onError: () => {
      toast({ title: "Delete Failed", description: "Could not delete this entry.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, applicantName, outcome }: { id: string; applicantName: string; outcome: 'approve' | 'conditional' | 'deny' }) => {
      const res = await apiRequest('PATCH', `/api/denial-decision/audit-history/${id}`, { applicantName, outcome });
      if (!res.ok) throw new Error('Failed to update');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/denial-decision/audit-history'] });
      toast({ title: "Entry Updated", description: "The decision record has been updated." });
      setEditingLog(null);
    },
    onError: () => {
      toast({ title: "Update Failed", description: "Could not update this entry.", variant: "destructive" });
    },
  });

  const openEditDialog = (log: AuditLog) => {
    setEditingLog(log);
    setEditName(log.applicantName || "");
    setEditOutcome(log.outcome);
  };

  const handleSaveEdit = () => {
    if (!editingLog) return;
    updateMutation.mutate({ id: editingLog.id, applicantName: editName, outcome: editOutcome });
  };

  const handleDownloadLetter = async (log: AuditLog, letterType: 'pre-adverse' | 'adverse') => {
    if (!log.generatedDenialText) return;
    
    setIsDownloading(true);
    try {
      const res = await apiRequest('POST', '/api/denial-decision/adverse-action-letter', {
        applicantName: log.applicantName || 'Applicant',
        applicantAddress: '',
        stateId: log.stateId,
        cityId: log.cityId || undefined,
        countyId: log.countyId || undefined,
        denialReasons: log.generatedDenialText,
        criteriaIds: log.criteriaSelectedForDenial || [],
        isFcra: true,
        letterType: letterType,
        auditLogId: log.id,
      });
      
      if (!res.ok) {
        throw new Error('Failed to generate letter');
      }
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const filename = letterType === 'pre-adverse' 
        ? `pre-adverse-action-notice-${new Date().toISOString().split('T')[0]}.pdf`
        : `adverse-action-letter-${new Date().toISOString().split('T')[0]}.pdf`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      
      // Refresh to show updated letter type
      queryClient.invalidateQueries({ queryKey: ['/api/denial-decision/audit-history'] });
      
      toast({
        title: letterType === 'pre-adverse' ? 'Pre-Adverse Notice Downloaded' : 'Adverse Action Letter Downloaded',
        description: "Letter type has been updated in the record.",
      });
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Could not generate the letter.",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="h-full overflow-y-auto">
      {/* Hero Header */}
      <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-primary/10 rounded-md">
                <ClipboardList className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-display font-semibold text-foreground mb-1" data-testid="text-page-title">
                  Screening Decision History
                </h1>
                <p className="text-sm sm:text-base text-muted-foreground">
                  Review your past screening decisions and compliance documentation.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div>
                <p className="text-2xl font-semibold text-foreground tabular-nums" data-testid="text-decisions-count">
                  {logs.length}
                </p>
                <p className="text-xs text-muted-foreground">Decisions</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/denial-decision">
          <Button variant="ghost" size="sm" data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Decision Assistant
          </Button>
        </Link>
      </div>

      {logs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardList className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium mb-2">No Decisions Yet</h3>
            <p className="text-muted-foreground mb-4">
              Your screening decisions will appear here after you use the Denial Decision Assistant.
            </p>
            <Link href="/denial-decision">
              <Button data-testid="button-start-decision">
                Start a Decision
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {logs.map((log) => {
            const style = OUTCOME_STYLES[log.outcome];
            const Icon = style.icon;
            
            return (
              <Card key={log.id} data-testid={`card-audit-${log.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full bg-muted ${style.iconClass}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          {log.applicantName || "Applicant"}
                          <Badge className={style.badgeClass}>
                            {style.label}
                          </Badge>
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(log.createdAt)}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {log.cityName 
                          ? `${log.cityName}, ${log.stateId}` 
                          : log.countyName 
                            ? `${log.countyName}, ${log.stateId}`
                            : log.stateId}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setViewingLog(log)}
                        data-testid={`button-view-${log.id}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(log)}
                        data-testid={`button-edit-${log.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteLogId(log.id)}
                        className="text-destructive hover:text-destructive"
                        data-testid={`button-delete-${log.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  {log.criteriaPresent && log.criteriaPresent.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-1">Criteria Present:</p>
                      <div className="flex flex-wrap gap-1">
                        {log.criteriaPresent.map((code, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {code}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {log.outcome === 'conditional' && log.conditionsApplied && log.conditionsApplied.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-1">Conditions Applied:</p>
                      <ul className="text-sm text-muted-foreground list-disc list-inside">
                        {log.conditionsApplied.map((condition, i) => (
                          <li key={i}>{condition}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {log.outcome === 'deny' && log.adverseActionLetterGenerated && (
                    <div className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1 text-primary">
                        <FileText className="h-4 w-4" />
                        {(log as any).letterTypeDownloaded === 'pre_adverse' 
                          ? 'Pre-Adverse Action Notice Generated' 
                          : 'Adverse Action Letter Generated'}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!editingLog} onOpenChange={(open) => !open && setEditingLog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Decision Record</DialogTitle>
            <DialogDescription>
              Update the applicant name or change the decision outcome.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Applicant Name</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Enter applicant name"
                data-testid="input-edit-name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Decision Outcome</label>
              <Select
                value={editOutcome}
                onValueChange={(v) => setEditOutcome(v as any)}
                disabled={!!editingLog?.adverseActionLetterGenerated}
              >
                <SelectTrigger data-testid="select-edit-outcome">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="approve">Approved</SelectItem>
                  <SelectItem value="conditional">Conditional</SelectItem>
                  <SelectItem value="deny">Denied</SelectItem>
                </SelectContent>
              </Select>
              {editingLog?.adverseActionLetterGenerated && (
                <p className="text-xs text-muted-foreground" data-testid="text-outcome-locked">
                  The outcome is locked because an adverse action notice has already been
                  generated for this decision — changing it would conflict with the letter on
                  record. To record a different decision, create a new screening decision.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingLog(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={updateMutation.isPending} data-testid="button-save-edit">
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingLog} onOpenChange={(open) => !open && setViewingLog(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Decision Details
            </DialogTitle>
            <DialogDescription>
              Full record of this screening decision
            </DialogDescription>
          </DialogHeader>
          
          {viewingLog && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Applicant</p>
                  <p className="font-medium">{viewingLog.applicantName || "Not specified"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Decision</p>
                  <Badge className={OUTCOME_STYLES[viewingLog.outcome].badgeClass}>
                    {OUTCOME_STYLES[viewingLog.outcome].label}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Date</p>
                  <p className="flex items-center gap-1 text-sm">
                    <Calendar className="h-3 w-3" />
                    {formatDate(viewingLog.createdAt)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Jurisdiction</p>
                  <div className="flex items-center gap-1 text-sm">
                    <MapPin className="h-3 w-3" />
                    <span>
                      {viewingLog.cityName && `${viewingLog.cityName}, `}
                      {viewingLog.countyName && `${viewingLog.countyName}, `}
                      {viewingLog.stateId}
                    </span>
                  </div>
                </div>
              </div>

              {viewingLog.criteriaPresent && viewingLog.criteriaPresent.length > 0 && (
                <div className="space-y-2 pt-2 border-t">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <ClipboardList className="h-4 w-4" />
                    Criteria Present in Report
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {viewingLog.criteriaPresent.map((code, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {code}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {viewingLog.criteriaSelectedForDenial && viewingLog.criteriaSelectedForDenial.length > 0 && (
                <div className="space-y-2 pt-2 border-t">
                  <p className="text-sm font-medium flex items-center gap-2 text-destructive">
                    <Scale className="h-4 w-4" />
                    Criteria Used for Denial
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {viewingLog.criteriaSelectedForDenial.map((code, i) => (
                      <Badge key={i} variant="destructive" className="text-xs">
                        {code}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {viewingLog.outcome === 'conditional' && viewingLog.conditionsApplied && viewingLog.conditionsApplied.length > 0 && (
                <div className="space-y-2 pt-2 border-t">
                  <p className="text-sm font-medium flex items-center gap-2 text-amber-600">
                    <AlertTriangle className="h-4 w-4" />
                    Conditions Applied
                  </p>
                  <ul className="text-sm list-disc list-inside space-y-1">
                    {viewingLog.conditionsApplied.map((condition, i) => (
                      <li key={i}>{condition}</li>
                    ))}
                  </ul>
                </div>
              )}

              {viewingLog.generatedDenialText && (
                <div className="space-y-2 pt-2 border-t">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    {(viewingLog as any).letterTypeDownloaded === 'pre_adverse' 
                      ? 'Preliminary Decision (Pre-Adverse)' 
                      : 'Internal Decision Record'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(viewingLog as any).letterTypeDownloaded === 'pre_adverse'
                      ? 'Tentative decision pending applicant response. Final decision not yet made.'
                      : 'Your detailed reasoning (kept on file).'}
                  </p>
                  <div className="bg-muted p-3 rounded-md text-sm whitespace-pre-wrap">
                    {(viewingLog as any).letterTypeDownloaded === 'pre_adverse'
                      ? viewingLog.generatedDenialText
                          .replace(/was denied/gi, 'could be denied')
                          .replace(/has been denied/gi, 'may be denied')
                          .replace(/is denied/gi, 'could be denied')
                          .replace(/The application was denied/gi, 'The application could be denied')
                      : viewingLog.generatedDenialText}
                  </div>
                </div>
              )}

              {viewingLog.noticesProvided && viewingLog.noticesProvided.length > 0 && (
                <div className="space-y-2 pt-2 border-t">
                  <p className="text-sm font-medium">Notices Provided</p>
                  <div className="flex flex-wrap gap-1">
                    {viewingLog.noticesProvided.map((notice, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {notice.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {viewingLog.outcome === 'deny' && viewingLog.adverseActionLetterGenerated && (
                <div className="space-y-1 pt-2 border-t">
                  <p className="text-sm font-medium">Letter Downloaded</p>
                  <div className="flex items-center gap-2 text-sm text-primary">
                    <FileText className="h-4 w-4" />
                    {(viewingLog as any).letterTypeDownloaded === 'pre_adverse' 
                      ? 'Pre-Adverse Action Notice' 
                      : (viewingLog as any).letterTypeDownloaded === 'adverse_action'
                        ? 'Adverse Action Letter (Final)'
                        : 'Letter generated'}
                  </div>
                </div>
              )}

              {viewingLog.outcome === 'deny' && viewingLog.generatedDenialText && (
                <div className="space-y-2 pt-3 border-t">
                  <p className="text-sm font-medium">Download Letter</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownloadLetter(viewingLog, 'pre-adverse')}
                      disabled={isDownloading}
                      data-testid="button-download-pre-adverse"
                    >
                      {isDownloading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileText className="h-4 w-4 mr-1" />}
                      Pre-Adverse Notice
                    </Button>
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleDownloadLetter(viewingLog, 'adverse')}
                      disabled={isDownloading}
                      data-testid="button-download-adverse"
                    >
                      {isDownloading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileText className="h-4 w-4 mr-1" />}
                      Adverse Action Letter
                    </Button>
                  </div>
                </div>
              )}

              <div className="pt-2 border-t text-xs text-muted-foreground">
                Rule Version: {viewingLog.ruleVersion}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingLog(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteLogId} onOpenChange={(open) => !open && setDeleteLogId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this record?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this screening decision from your history. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteLogId && deleteMutation.mutate(deleteLogId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </div>
  );
}
