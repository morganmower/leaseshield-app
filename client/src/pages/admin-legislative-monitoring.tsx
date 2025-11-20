import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { AlertCircle, CheckCircle, XCircle, Clock, FileText, ExternalLink, PlayCircle } from 'lucide-react';
import { format } from 'date-fns';

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
  relevanceLevel: 'high' | 'medium' | 'low' | 'dismissed';
  aiAnalysis: string;
  affectedTemplateIds: string[];
  isReviewed: boolean;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
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

export default function AdminLegislativeMonitoring() {
  const { toast } = useToast();

  const { data: pendingBills = [] } = useQuery<LegislativeBill[]>({
    queryKey: ['/api/admin/legislative-bills', { isReviewed: false }],
  });

  const { data: reviewedBills = [] } = useQuery<LegislativeBill[]>({
    queryKey: ['/api/admin/legislative-bills', { isReviewed: true }],
  });

  // Auto-published updates (no longer pending, all auto-approved)
  const { data: publishedUpdates = [] } = useQuery<TemplateReview[]>({
    queryKey: ['/api/admin/template-review-queue', { status: 'approved' }],
  });

  const runMonitoringMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/admin/legislative-monitoring/run', {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/template-review-queue'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/legislative-bills'] });
      toast({
        title: 'Monitoring Run Started',
        description: 'Checking for new legislative bills and analyzing them...',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to run legislative monitoring',
        variant: 'destructive',
      });
    },
  });

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
          <Button 
            onClick={() => runMonitoringMutation.mutate()}
            disabled={runMonitoringMutation.isPending}
            data-testid="button-run-monitoring"
          >
            <PlayCircle className="h-4 w-4 mr-2" />
            {runMonitoringMutation.isPending ? 'Running...' : 'Run Monitoring Now'}
          </Button>
        </div>

        <Tabs defaultValue="published-updates" className="space-y-4">
          <TabsList data-testid="tabs-monitoring">
            <TabsTrigger value="published-updates" data-testid="tab-published-updates">
              Published Updates ({publishedUpdates.length})
            </TabsTrigger>
            <TabsTrigger value="pending-bills" data-testid="tab-pending-bills">
              Pending Bills ({pendingBills.length})
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
                            {format(new Date(review.approvedAt), 'MMM d, yyyy h:mm a')}
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
              pendingBills.map((bill) => (
                <Card key={bill.id} data-testid={`card-bill-${bill.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg" data-testid={`text-bill-number-${bill.id}`}>
                            {bill.billNumber}
                          </CardTitle>
                          {getRelevanceBadge(bill.relevanceLevel)}
                          <Badge variant="outline">{bill.stateId}</Badge>
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

                    <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2 border-t">
                      <Clock className="h-4 w-4" />
                      <span data-testid={`text-bill-date-${bill.id}`}>
                        Status updated: {format(new Date(bill.statusDate), 'MMM d, yyyy')}
                      </span>
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
                                Approved {review.approvedAt && format(new Date(review.approvedAt), 'MMM d, yyyy')}
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
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-foreground">{bill.billNumber}</span>
                                <Badge variant="outline">{bill.stateId}</Badge>
                                {getRelevanceBadge(bill.relevanceLevel)}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Reviewed {bill.reviewedAt && format(new Date(bill.reviewedAt), 'MMM d, yyyy')}
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
