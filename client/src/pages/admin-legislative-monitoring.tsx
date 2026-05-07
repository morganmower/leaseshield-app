import { useQuery, useMutation } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { AlertCircle, AlertTriangle, CheckCircle, XCircle, Clock, FileText, ExternalLink, PlayCircle, Calendar, RefreshCw } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface LegislativeBill {
  id: string;
  billId: string;
  sessionId: string;
  billNumber: string;
  title: string;
  description: string;
  status: string;
  statusDate: string;
  url: string;
  stateId: string;
  dataSource?: 'legiscan' | 'plural_policy' | 'federal_register' | 'manual';
  relevanceLevel: 'high' | 'medium' | 'low' | 'dismissed';
  aiAnalysis: string;
  affectedTemplateIds: string[];
  affectedComplianceCategories?: string[];
  isReviewed: boolean;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
}

interface CaseLaw {
  id: string;
  caseId: string;
  stateId: string;
  caseName: string;
  caseNameFull: string;
  citation: string;
  court: string;
  dateFiled: string;
  caseNumber: string;
  url: string;
  relevanceLevel: 'high' | 'medium' | 'low' | 'dismissed';
  aiAnalysis: string;
  affectedTemplateIds: string[];
  isReviewed: boolean;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
}

interface DraftedChanges {
  draftedClause: string;
  clauseLocation: string;
  beforeText: string;
  afterText: string;
  changeType: 'add_clause' | 'modify_clause' | 'add_disclosure' | 'update_notice_period' | 'other';
  changeSummary: string;
  legalReference: string;
}

interface TemplateReview {
  id: string;
  templateId: string;
  billId: string;
  reason: string;
  recommendedChanges: string;
  status: 'pending' | 'approved' | 'rejected';
  approvalNotes: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
  template?: {
    id: string;
    title: string;
    stateId: string;
  };
  bill?: {
    billNumber: string;
    title: string;
  };
}

interface MonitoringStatus {
  lastRun: {
    id: string;
    runDate: string;
    billsFound: number;
    relevantBills: number;
    templatesQueued: number;
    status: string;
    createdAt: string;
  } | null;
  hasRunThisMonth: boolean;
  nextScheduledDay: number;
  jobInProgress?: boolean;
  currentJob?: string | null;
  jobStartedAt?: string | null;
}

const safeFormatDate = (dateString: string | null | undefined, formatStr: string): string => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return format(date, formatStr);
  } catch {
    return '';
  }
};

export default function AdminLegislativeMonitoring() {
  const { toast } = useToast();
  const wasJobInProgress = useRef(false);

  const { data: pendingBills = [] } = useQuery<LegislativeBill[]>({
    queryKey: ['/api/admin/legislative-bills?isReviewed=false'],
  });

  const { data: reviewedBills = [] } = useQuery<LegislativeBill[]>({
    queryKey: ['/api/admin/legislative-bills?isReviewed=true'],
  });

  // Auto-published updates (no longer pending, all auto-approved)
  const { data: publishedUpdates = [] } = useQuery<TemplateReview[]>({
    queryKey: ['/api/admin/template-review-queue?status=approved'],
  });

  const { data: caseLaws = [] } = useQuery<CaseLaw[]>({
    queryKey: ['/api/admin/case-law'],
  });

  const { data: monitoringStatus } = useQuery<MonitoringStatus>({
    queryKey: ['/api/admin/monitoring-status'],
    refetchInterval: (query) => {
      const data = query.state.data as MonitoringStatus | undefined;
      return data?.jobInProgress ? 3000 : 30000;
    },
  });

  useEffect(() => {
    if (wasJobInProgress.current && !monitoringStatus?.jobInProgress) {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/legislative-bills'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/template-review-queue'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/case-law'] });
      toast({
        title: 'Monitoring Complete',
        description: 'Legislative monitoring job has finished.',
      });
    }
    wasJobInProgress.current = !!monitoringStatus?.jobInProgress;
  }, [monitoringStatus?.jobInProgress, toast]);

  const runMonitoringMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/admin/legislative-monitoring/run', {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/monitoring-status'] });
      toast({
        title: 'Monitoring Job Started',
        description: 'Running in background. This page will update when complete.',
      });
    },
    onError: (error: any) => {
      if (error?.status === 409) {
        toast({
          title: 'Job Already Running',
          description: 'A monitoring job is already in progress. Please wait.',
          variant: 'default',
        });
      } else {
        toast({
          title: 'Error',
          description: 'Failed to start legislative monitoring',
          variant: 'destructive',
        });
      }
    },
  });

  const reanalyzeMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/admin/legislative-monitoring/reanalyze', {});
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/legislative-bills'] });
      toast({
        title: 'Re-analysis Complete',
        description: data.message || 'Bills have been re-analyzed for compliance categories.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to re-analyze bills',
        variant: 'destructive',
      });
    },
  });

  const dismissBillMutation = useMutation({
    mutationFn: async (billId: string) => {
      return await apiRequest('PATCH', `/api/admin/legislative-bills/${billId}/dismiss`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/legislative-bills'] });
      toast({
        title: 'Bill Dismissed',
        description: 'Bill has been marked as reviewed and removed from pending list.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to dismiss bill',
        variant: 'destructive',
      });
    },
  });

  const approveBillMutation = useMutation({
    mutationFn: async (billId: string) => {
      return await apiRequest('PATCH', `/api/admin/legislative-bills/${billId}/approve`, {});
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/legislative-bills'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/template-review-queue'] });
      toast({
        title: 'AI Drafts Created',
        description: data.message || 'Template drafts have been created. Review them in the Template Drafts tab.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create drafts',
        variant: 'destructive',
      });
    },
  });

  // Query for pending template drafts
  const { data: templateDrafts } = useQuery<TemplateReview[]>({
    queryKey: ['/api/admin/template-review-queue', 'pending'],
    queryFn: async () => {
      const response = await fetch('/api/admin/template-review-queue?status=pending', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch template drafts');
      return response.json();
    },
  });

  const pendingDrafts = (templateDrafts || []).filter(d => d.status === 'pending');

  // Parse drafted changes from JSON
  const parseDraftedChanges = (recommendedChanges: string): DraftedChanges | null => {
    try {
      return JSON.parse(recommendedChanges);
    } catch {
      return null;
    }
  };

  // One-click approve mutation
  const quickApproveMutation = useMutation({
    mutationFn: async (reviewId: string) => {
      return await apiRequest('PATCH', `/api/admin/template-review-queue/${reviewId}/quick-approve`, {});
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/template-review-queue'] });
      toast({
        title: 'Version bumped — engineering action needed',
        description: 'Template version incremented and landlords notified. Lease body text is still hardcoded — forward the drafted clause to engineering to update leaseAgreementGenerator.ts before the next release.',
        duration: 12000,
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to apply template update',
        variant: 'destructive',
      });
    },
  });

  const getActionRecommendation = (bill: LegislativeBill) => {
    const hasAffectedTemplates = bill.affectedTemplateIds && bill.affectedTemplateIds.length > 0;
    
    if (bill.relevanceLevel === 'high' && hasAffectedTemplates) {
      return { 
        label: 'Review Required', 
        className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
        description: 'High priority with affected templates - review for template updates'
      };
    } else if (bill.relevanceLevel === 'high') {
      return { 
        label: 'Review Required', 
        className: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
        description: 'High priority - review manually'
      };
    } else if (bill.relevanceLevel === 'medium') {
      return { 
        label: 'Monitor', 
        className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
        description: 'Keep an eye on this - may become relevant'
      };
    } else {
      return { 
        label: 'Safe to Dismiss', 
        className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
        description: 'Low impact - can be dismissed'
      };
    }
  };

  const priorityCounts = {
    high: pendingBills.filter(b => b.relevanceLevel === 'high').length,
    medium: pendingBills.filter(b => b.relevanceLevel === 'medium').length,
    low: pendingBills.filter(b => b.relevanceLevel === 'low' || b.relevanceLevel === 'dismissed').length,
  };

  const getRelevanceBadge = (level: string) => {
    const config = {
      high: { variant: 'destructive' as const, label: 'High Priority' },
      medium: { variant: 'default' as const, label: 'Medium' },
      low: { variant: 'secondary' as const, label: 'Low' },
      dismissed: { variant: 'outline' as const, label: 'Dismissed' },
    };
    const { variant, label } = config[level as keyof typeof config] || config.dismissed;
    return <Badge variant={variant} data-testid={`badge-relevance-${level}`}>{label}</Badge>;
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground" data-testid="heading-legislative-monitoring">
              Legislative Monitoring
            </h1>
            <p className="text-muted-foreground mt-1">
              Monitor legislative changes and review auto-published template updates
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline"
              onClick={() => reanalyzeMutation.mutate()}
              disabled={reanalyzeMutation.isPending}
              data-testid="button-reanalyze"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              {reanalyzeMutation.isPending ? 'Analyzing...' : 'Re-analyze Bills'}
            </Button>
            <Button 
              onClick={() => runMonitoringMutation.mutate()}
              disabled={runMonitoringMutation.isPending || monitoringStatus?.jobInProgress}
              data-testid="button-run-monitoring"
            >
              {monitoringStatus?.jobInProgress ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Job Running...
                </>
              ) : (
                <>
                  <PlayCircle className="h-4 w-4 mr-2" />
                  {runMonitoringMutation.isPending ? 'Starting...' : 'Run Monitoring Now'}
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Monitoring Status Card */}
        <Card className={monitoringStatus?.jobInProgress ? "bg-primary/10 border-primary/30" : "bg-muted/30"}>
          <CardContent className="py-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-6">
                {monitoringStatus?.jobInProgress ? (
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 text-primary animate-spin" />
                    <span className="text-sm font-medium text-primary">Job In Progress</span>
                    {monitoringStatus.jobStartedAt && (
                      <span className="text-sm text-muted-foreground">
                        (started {formatDistanceToNow(new Date(monitoringStatus.jobStartedAt), { addSuffix: true })})
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Last Monitored:</span>
                    <span className="text-sm text-muted-foreground" data-testid="text-last-monitored">
                      {monitoringStatus?.lastRun 
                        ? `${safeFormatDate(monitoringStatus.lastRun.createdAt, 'MMM d, yyyy h:mm a')} (${formatDistanceToNow(new Date(monitoringStatus.lastRun.createdAt), { addSuffix: true })})`
                        : 'Never'}
                    </span>
                  </div>
                )}
                {monitoringStatus?.lastRun && (
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>Bills found: <strong className="text-foreground">{monitoringStatus.lastRun.billsFound}</strong></span>
                    <span>Relevant: <strong className="text-foreground">{monitoringStatus.lastRun.relevantBills}</strong></span>
                    <span>Templates updated: <strong className="text-foreground">{monitoringStatus.lastRun.templatesQueued}</strong></span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {monitoringStatus?.hasRunThisMonth ? (
                  <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Ran this month
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Scheduled for 1st
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="published-updates" className="space-y-4">
          <TabsList data-testid="tabs-monitoring">
            <TabsTrigger value="published-updates" data-testid="tab-published-updates">
              Published Updates ({publishedUpdates.length})
            </TabsTrigger>
            <TabsTrigger value="pending-bills" data-testid="tab-pending-bills">
              Pending Bills ({pendingBills.length})
            </TabsTrigger>
            <TabsTrigger value="template-drafts" data-testid="tab-template-drafts">
              Template Drafts ({pendingDrafts.length})
            </TabsTrigger>
            <TabsTrigger value="case-law" data-testid="tab-case-law">
              Case Law ({caseLaws.length})
            </TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="published-updates" className="space-y-4">
            <Card className="mb-4">
              <CardContent className="py-3">
                <p className="text-sm text-muted-foreground">
                  <CheckCircle className="h-4 w-4 inline mr-2" />
                  Template updates are automatically published when relevant legislation is detected. Users are notified immediately.
                </p>
              </CardContent>
            </Card>
            
            {publishedUpdates.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground" data-testid="text-no-published-updates">
                    No template updates published yet
                  </p>
                </CardContent>
              </Card>
            ) : (
              publishedUpdates.map((review) => (
                <Card key={review.id} data-testid={`card-review-${review.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1">
                        <CardTitle className="text-xl" data-testid={`text-template-${review.id}`}>
                          {review.template?.title || 'Unknown Template'}
                        </CardTitle>
                        <CardDescription data-testid={`text-bill-${review.id}`}>
                          Related to: {review.bill?.billNumber || 'Unknown Bill'} - {review.bill?.title}
                        </CardDescription>
                      </div>
                      <Badge variant="outline" data-testid={`badge-state-${review.id}`}>
                        {review.template?.stateId}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="font-semibold text-sm text-foreground mb-2">Reason for Update:</h4>
                      <p className="text-sm text-muted-foreground" data-testid={`text-reason-${review.id}`}>
                        {review.reason}
                      </p>
                    </div>

                    <div>
                      <h4 className="font-semibold text-sm text-foreground mb-2">Published Changes:</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap" data-testid={`text-changes-${review.id}`}>
                        {review.recommendedChanges}
                      </p>
                    </div>

                    <div className="pt-4 border-t">
                      <div className="flex items-center gap-2 text-sm">
                        <Badge variant="default" data-testid={`badge-status-${review.id}`}>
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Auto-Published
                        </Badge>
                        {review.approvedAt && (
                          <span className="text-muted-foreground" data-testid={`text-published-at-${review.id}`}>
                            {safeFormatDate(review.approvedAt, 'MMM d, yyyy h:mm a')}
                          </span>
                        )}
                      </div>
                      {review.approvalNotes && (
                        <p className="text-xs text-muted-foreground mt-2" data-testid={`text-approval-notes-${review.id}`}>
                          {review.approvalNotes}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="pending-bills" className="space-y-4">
            {pendingBills.length > 0 && (
              <Card className="mb-4">
                <CardContent className="py-4">
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="text-sm font-medium text-foreground">Quick Summary:</span>
                    {priorityCounts.high > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500" />
                        <span className="text-sm">
                          <span className="font-semibold">{priorityCounts.high}</span> need review
                        </span>
                      </div>
                    )}
                    {priorityCounts.medium > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-amber-500" />
                        <span className="text-sm">
                          <span className="font-semibold">{priorityCounts.medium}</span> to monitor
                        </span>
                      </div>
                    )}
                    {priorityCounts.low > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-gray-400" />
                        <span className="text-sm">
                          <span className="font-semibold">{priorityCounts.low}</span> can dismiss
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
            
            {pendingBills.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CheckCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground" data-testid="text-no-pending-bills">
                    No pending bills to review
                  </p>
                </CardContent>
              </Card>
            ) : (
              pendingBills.map((bill) => {
                const recommendation = getActionRecommendation(bill);
                return (
                <Card key={bill.id} data-testid={`card-bill-${bill.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-lg" data-testid={`text-bill-number-${bill.id}`}>
                            {bill.billNumber}
                          </CardTitle>
                          <Badge className={recommendation.className} data-testid={`badge-action-${bill.id}`}>
                            {recommendation.label}
                          </Badge>
                          {getRelevanceBadge(bill.relevanceLevel)}
                          <Badge variant="outline">{bill.stateId}</Badge>
                          {bill.dataSource && (
                            <Badge 
                              variant="secondary" 
                              className={
                                bill.dataSource === 'plural_policy' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' : 
                                bill.dataSource === 'federal_register' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                                'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              }
                              data-testid={`badge-source-${bill.id}`}
                            >
                              {bill.dataSource === 'plural_policy' ? 'Plural Policy' : 
                               bill.dataSource === 'federal_register' ? 'Federal Register' :
                               bill.dataSource === 'legiscan' ? 'LegiScan' : 'Manual'}
                            </Badge>
                          )}
                        </div>
                        <CardDescription data-testid={`text-bill-title-${bill.id}`}>
                          {bill.title}
                        </CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        data-testid={`link-bill-external-${bill.id}`}
                      >
                        <a href={bill.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="font-semibold text-sm text-foreground mb-1">Description:</h4>
                      <p className="text-sm text-muted-foreground" data-testid={`text-bill-description-${bill.id}`}>
                        {bill.description}
                      </p>
                    </div>

                    <div>
                      <h4 className="font-semibold text-sm text-foreground mb-1">AI Analysis:</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap" data-testid={`text-bill-analysis-${bill.id}`}>
                        {bill.aiAnalysis}
                      </p>
                    </div>

                    {bill.affectedTemplateIds && bill.affectedTemplateIds.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-sm text-foreground mb-2">
                          Affected Templates ({bill.affectedTemplateIds.length}):
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {bill.affectedTemplateIds.map((templateId, idx) => (
                            <Badge key={idx} variant="secondary" data-testid={`badge-template-${bill.id}-${idx}`}>
                              <FileText className="h-3 w-3 mr-1" />
                              {templateId}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {bill.affectedComplianceCategories && bill.affectedComplianceCategories.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-sm text-foreground mb-2">
                          Affected Compliance Categories ({bill.affectedComplianceCategories.length}):
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {bill.affectedComplianceCategories.map((category, idx) => (
                            <Badge 
                              key={idx} 
                              variant="outline" 
                              className="bg-primary/10 border-primary/30"
                              data-testid={`badge-compliance-${bill.id}-${idx}`}
                            >
                              {category === 'rent_increases' ? 'Rent Increases' :
                               category === 'deposits' ? 'Security Deposits' :
                               category === 'evictions' ? 'Evictions' :
                               category === 'disclosures' ? 'Disclosures' :
                               category === 'fair_housing' ? 'Fair Housing' :
                               category}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="bg-muted/50 rounded-md p-3 mt-2">
                      <p className="text-sm text-muted-foreground mb-2">
                        <strong>What to do:</strong> {recommendation.description}
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span data-testid={`text-bill-date-${bill.id}`}>
                            Updated: {bill.statusDate ? safeFormatDate(bill.statusDate, 'MMM d, yyyy') : 'Unknown'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {bill.affectedTemplateIds && bill.affectedTemplateIds.length > 0 && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => approveBillMutation.mutate(bill.id)}
                              disabled={approveBillMutation.isPending}
                              data-testid={`button-approve-${bill.id}`}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Approve Updates
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => dismissBillMutation.mutate(bill.id)}
                            disabled={dismissBillMutation.isPending}
                            data-testid={`button-dismiss-${bill.id}`}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Dismiss
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
              })
            )}
          </TabsContent>

          <TabsContent value="template-drafts" className="space-y-4">
            {pendingDrafts.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CheckCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground" data-testid="text-no-drafts">
                    No template drafts pending approval
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Approve bills with affected templates to generate AI drafts
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800" data-testid="card-lease-text-warning">
                  <CardContent className="py-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle aria-hidden="true" className="h-5 w-5 text-amber-700 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                      <div className="space-y-2 text-sm">
                        <p className="font-semibold text-amber-900 dark:text-amber-100">
                          Important: What "Apply Draft" actually does today
                        </p>
                        <p className="text-amber-900 dark:text-amber-100">
                          Approving here bumps the template version number, records the change history, and notifies landlords that an update was published. <strong>It does not yet rewrite the legal clause text inside generated lease PDFs/DOCX files.</strong> Lease body text is currently hardcoded in the generator and requires an engineering deploy to change.
                        </p>
                        <p className="text-amber-900 dark:text-amber-100">
                          <strong>Action required after approval:</strong> copy the drafted clause below and notify engineering to update <code className="text-xs bg-amber-100 dark:bg-amber-900/40 px-1 py-0.5 rounded">server/utils/leaseAgreementGenerator.ts</code> for this state. Until that ships, new leases will still use the previous clause text even though the version number has incremented.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                {pendingDrafts.map((draft) => {
                  const changes = parseDraftedChanges(draft.recommendedChanges);
                  return (
                    <Card key={draft.id} data-testid={`card-draft-${draft.id}`}>
                      <CardHeader>
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <CardTitle className="text-lg">
                                {draft.template?.title || 'Unknown Template'}
                              </CardTitle>
                              <Badge variant="outline">{draft.template?.stateId}</Badge>
                              {changes?.changeType && (
                                <Badge variant="secondary">
                                  {changes.changeType === 'add_clause' ? 'Add Clause' :
                                   changes.changeType === 'modify_clause' ? 'Modify Clause' :
                                   changes.changeType === 'add_disclosure' ? 'Add Disclosure' :
                                   changes.changeType === 'update_notice_period' ? 'Update Notice' :
                                   'Other Change'}
                                </Badge>
                              )}
                            </div>
                            <CardDescription>
                              {draft.bill ? `${draft.bill.billNumber}: ${draft.bill.title}` : draft.reason}
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {changes ? (
                          <>
                            <div className="bg-muted/50 rounded-lg p-4">
                              <h4 className="font-semibold text-sm mb-2">Summary</h4>
                              <p className="text-sm text-muted-foreground">{changes.changeSummary}</p>
                              {changes.legalReference && (
                                <p className="text-xs text-muted-foreground mt-2">
                                  Reference: {changes.legalReference}
                                </p>
                              )}
                            </div>
                            
                            <div>
                              <h4 className="font-semibold text-sm mb-2">Drafted Clause</h4>
                              <p className="text-xs text-muted-foreground mb-2">
                                Location: {changes.clauseLocation}
                              </p>
                              <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                                <pre className="text-sm whitespace-pre-wrap font-mono">
                                  {changes.draftedClause}
                                </pre>
                              </div>
                            </div>

                            {changes.beforeText && (
                              <div>
                                <h4 className="font-semibold text-sm mb-2">Before / After</h4>
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                                    <p className="text-xs font-medium mb-1 text-red-800 dark:text-red-200">Before</p>
                                    <p className="text-sm">{changes.beforeText}</p>
                                  </div>
                                  <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                                    <p className="text-xs font-medium mb-1 text-green-800 dark:text-green-200">After</p>
                                    <p className="text-sm">{changes.afterText}</p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="bg-muted/50 rounded-lg p-4">
                            <p className="text-sm text-muted-foreground">
                              {draft.recommendedChanges || 'No drafted changes available'}
                            </p>
                          </div>
                        )}

                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-2 border-t">
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5" data-testid={`text-engineering-reminder-${draft.id}`}>
                            <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                            Bumps version &amp; notifies landlords. Engineering must edit the generator for the new clause to appear in leases.
                          </p>
                          <Button
                            variant="default"
                            onClick={() => quickApproveMutation.mutate(draft.id)}
                            disabled={quickApproveMutation.isPending}
                            data-testid={`button-apply-draft-${draft.id}`}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Apply Draft
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="case-law" className="space-y-4">
            {caseLaws.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground" data-testid="text-no-case-law">
                    No case law monitored yet
                  </p>
                </CardContent>
              </Card>
            ) : (
              caseLaws.map((caseItem) => (
                <Card key={caseItem.id} data-testid={`card-case-${caseItem.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg" data-testid={`text-case-name-${caseItem.id}`}>
                            {caseItem.caseName}
                          </CardTitle>
                          {getRelevanceBadge(caseItem.relevanceLevel)}
                          <Badge variant="outline">{caseItem.stateId}</Badge>
                        </div>
                        <CardDescription data-testid={`text-case-citation-${caseItem.id}`}>
                          {caseItem.citation}
                        </CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        data-testid={`link-case-external-${caseItem.id}`}
                      >
                        <a href={caseItem.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="font-semibold text-sm text-foreground mb-2">Court & Details:</h4>
                      <p className="text-sm text-muted-foreground" data-testid={`text-court-${caseItem.id}`}>
                        {caseItem.court} • Case #: {caseItem.caseNumber}
                      </p>
                    </div>

                    <div>
                      <h4 className="font-semibold text-sm text-foreground mb-2">AI Analysis:</h4>
                      <p className="text-sm text-muted-foreground" data-testid={`text-analysis-${caseItem.id}`}>
                        {caseItem.aiAnalysis}
                      </p>
                    </div>

                    {caseItem.affectedTemplateIds && caseItem.affectedTemplateIds.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-sm text-foreground mb-2">Affected Templates:</h4>
                        <div className="flex flex-wrap gap-2">
                          {caseItem.affectedTemplateIds.map((templateId) => (
                            <Badge key={templateId} variant="secondary" data-testid={`badge-template-${templateId}`}>
                              {templateId}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="pt-4 border-t text-sm text-muted-foreground">
                      Filed: {safeFormatDate(caseItem.dateFiled, 'MMM d, yyyy')}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-3">Published Updates</h3>
                {publishedUpdates.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      No published updates yet
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {publishedUpdates.map((review: TemplateReview) => (
                      <Card key={review.id} data-testid={`card-approved-${review.id}`}>
                        <CardContent className="py-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                <span className="font-medium text-foreground" data-testid={`text-approved-template-${review.id}`}>
                                  {review.template?.title}
                                </span>
                                <Badge variant="outline">{review.template?.stateId}</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground" data-testid={`text-approved-date-${review.id}`}>
                                Approved {review.approvedAt && safeFormatDate(review.approvedAt, 'MMM d, yyyy')}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-lg font-semibold text-foreground mb-3">Reviewed Bills</h3>
                {reviewedBills.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      No reviewed bills yet
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {reviewedBills.map((bill) => (
                      <Card key={bill.id} data-testid={`card-reviewed-bill-${bill.id}`}>
                        <CardContent className="py-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="font-medium text-foreground">{bill.billNumber}</span>
                                <Badge variant="outline">{bill.stateId}</Badge>
                                {getRelevanceBadge(bill.relevanceLevel)}
                                {bill.dataSource && (
                                  <Badge 
                                    variant="secondary" 
                                    className={
                                      bill.dataSource === 'plural_policy' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' : 
                                      bill.dataSource === 'federal_register' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                                      'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                    }
                                  >
                                    {bill.dataSource === 'plural_policy' ? 'Plural Policy' : 
                                     bill.dataSource === 'federal_register' ? 'Federal Register' :
                                     bill.dataSource === 'legiscan' ? 'LegiScan' : 'Manual'}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Reviewed {bill.reviewedAt && safeFormatDate(bill.reviewedAt, 'MMM d, yyyy')}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
