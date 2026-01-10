import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest, getAccessToken } from '@/lib/queryClient';
import { Plus, FileText, CheckCircle, Clock, Archive, AlertTriangle, Edit, Trash2, Send, Check, X, Eye } from 'lucide-react';

const CREDIT_TOPICS = [
  'security_deposit_limits',
  'application_fees',
  'source_of_income',
  'late_fees_rules',
  'adverse_action_state_addons',
] as const;

const CRIMINAL_EVICTION_TOPICS = [
  'fair_chance_housing',
  'individualized_assessment',
  'eviction_record_sealing',
  'local_overrides_present',
  'eviction_filing_vs_judgment',
  'criminal_lookback_limits',
  'arrest_vs_conviction_rules',
] as const;

const HIGH_RISK_TOPICS = [
  'fair_chance_housing',
  'individualized_assessment',
  'local_overrides_present',
  'source_of_income',
];

interface StateNote {
  id: string;
  stateId: string;
  decoder: 'credit' | 'criminal_eviction';
  topic: string;
  title: string;
  bullets: string[];
  sourceLinks: string[];
  status: 'draft' | 'pending_review' | 'approved' | 'archived';
  isActive: boolean;
  version: number;
  createdAt: string;
  lastReviewedAt?: string;
  approvalChecklist?: {
    contentAccuracy: boolean;
    neutralFraming: boolean;
    fairHousingCompliance: boolean;
    toneConsistency: boolean;
    auditTrailComplete: boolean;
  };
}

interface CoverageData {
  matrix: Array<{
    stateId: string;
    stateName: string;
    decoder: string;
    topic: string;
    hasApproved: boolean;
    lastReviewedAt: string | null;
    isHighRisk: boolean;
  }>;
  summary: {
    totalCells: number;
    approvedCount: number;
    coveragePercent: number;
    highRiskMissingCount: number;
  };
}

function getStatusColor(status: StateNote['status']) {
  switch (status) {
    case 'draft': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    case 'pending_review': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300';
    case 'approved': return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
    case 'archived': return 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500';
  }
}

function getStatusIcon(status: StateNote['status']) {
  switch (status) {
    case 'draft': return <FileText className="h-3 w-3" />;
    case 'pending_review': return <Clock className="h-3 w-3" />;
    case 'approved': return <CheckCircle className="h-3 w-3" />;
    case 'archived': return <Archive className="h-3 w-3" />;
  }
}

export default function AdminStateNotes() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'list' | 'coverage'>('list');
  const [filterDecoder, setFilterDecoder] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterState, setFilterState] = useState<string>('all');
  const [selectedNote, setSelectedNote] = useState<StateNote | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);

  // Form state for create/edit
  const [formData, setFormData] = useState({
    stateId: '',
    decoder: 'credit' as 'credit' | 'criminal_eviction',
    topic: '',
    title: '',
    bullets: [''],
    sourceLinks: [''],
  });

  // Approval checklist state
  const [approvalChecklist, setApprovalChecklist] = useState({
    contentAccuracy: false,
    neutralFraming: false,
    fairHousingCompliance: false,
    toneConsistency: false,
    auditTrailComplete: false,
  });

  const getAuthHeaders = (): Record<string, string> => {
    const token = getAccessToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  };

  // Fetch states
  const { data: states } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['/api/states'],
    staleTime: 60 * 60 * 1000,
  });

  // Fetch state notes with filters
  const { data: stateNotes, isLoading: notesLoading, refetch: refetchNotes } = useQuery<StateNote[]>({
    queryKey: ['/api/admin/state-notes', filterDecoder, filterStatus, filterState],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterDecoder !== 'all') params.set('decoder', filterDecoder);
      if (filterStatus !== 'all') params.set('status', filterStatus);
      if (filterState !== 'all') params.set('stateId', filterState);
      
      const response = await fetch(`/api/admin/state-notes?${params.toString()}`, {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch state notes');
      return response.json();
    },
  });

  // Fetch coverage data
  const { data: coverageData, isLoading: coverageLoading } = useQuery<CoverageData>({
    queryKey: ['/api/admin/state-notes/coverage'],
    queryFn: async () => {
      const response = await fetch('/api/admin/state-notes/coverage', {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch coverage data');
      return response.json();
    },
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch('/api/admin/state-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          ...data,
          bullets: data.bullets.filter(b => b.trim()),
          sourceLinks: data.sourceLinks.filter(l => l.trim()),
        }),
        credentials: 'include',
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Failed to create');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'State note created', description: 'Draft saved successfully.' });
      setIsCreateDialogOpen(false);
      resetForm();
      refetchNotes();
      queryClient.invalidateQueries({ queryKey: ['/api/admin/state-notes/coverage'] });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const submitForReviewMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/admin/state-notes/${id}/submit`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to submit');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Submitted for review', description: 'Note is now pending review.' });
      refetchNotes();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to submit for review', variant: 'destructive' });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, checklist }: { id: string; checklist: typeof approvalChecklist }) => {
      const response = await fetch(`/api/admin/state-notes/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ approvalChecklist: checklist }),
        credentials: 'include',
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Failed to approve');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Approved', description: 'State note is now active and visible to users.' });
      setIsApproveDialogOpen(false);
      setSelectedNote(null);
      resetApprovalChecklist();
      refetchNotes();
      queryClient.invalidateQueries({ queryKey: ['/api/admin/state-notes/coverage'] });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/admin/state-notes/${id}/archive`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to archive');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Archived', description: 'State note has been archived.' });
      refetchNotes();
      queryClient.invalidateQueries({ queryKey: ['/api/admin/state-notes/coverage'] });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to archive', variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setFormData({
      stateId: '',
      decoder: 'credit',
      topic: '',
      title: '',
      bullets: [''],
      sourceLinks: [''],
    });
  };

  const resetApprovalChecklist = () => {
    setApprovalChecklist({
      contentAccuracy: false,
      neutralFraming: false,
      fairHousingCompliance: false,
      toneConsistency: false,
      auditTrailComplete: false,
    });
  };

  const addBullet = () => setFormData(prev => ({ ...prev, bullets: [...prev.bullets, ''] }));
  const removeBullet = (index: number) => setFormData(prev => ({
    ...prev,
    bullets: prev.bullets.filter((_, i) => i !== index),
  }));
  const updateBullet = (index: number, value: string) => setFormData(prev => ({
    ...prev,
    bullets: prev.bullets.map((b, i) => i === index ? value : b),
  }));

  const addSourceLink = () => setFormData(prev => ({ ...prev, sourceLinks: [...prev.sourceLinks, ''] }));
  const removeSourceLink = (index: number) => setFormData(prev => ({
    ...prev,
    sourceLinks: prev.sourceLinks.filter((_, i) => i !== index),
  }));
  const updateSourceLink = (index: number, value: string) => setFormData(prev => ({
    ...prev,
    sourceLinks: prev.sourceLinks.map((l, i) => i === index ? value : l),
  }));

  const allChecklistItemsChecked = Object.values(approvalChecklist).every(v => v);
  const currentTopics = formData.decoder === 'credit' ? CREDIT_TOPICS : CRIMINAL_EVICTION_TOPICS;

  // Group coverage by state for display
  const groupedCoverage = coverageData?.matrix.reduce((acc, item) => {
    if (!acc[item.stateId]) {
      acc[item.stateId] = { stateName: item.stateName, items: [] };
    }
    acc[item.stateId].items.push(item);
    return acc;
  }, {} as Record<string, { stateName: string; items: typeof coverageData.matrix }>) || {};

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">State Notes Management</h1>
          <p className="text-muted-foreground">Manage pre-vetted state-specific legal snippets for decoder responses</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-state-note">
          <Plus className="h-4 w-4 mr-2" />
          Create State Note
        </Button>
      </div>

      {/* Summary Stats */}
      {coverageData && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{coverageData.summary.totalCells}</div>
              <p className="text-muted-foreground text-sm">Total State/Topic Combinations</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-600">{coverageData.summary.approvedCount}</div>
              <p className="text-muted-foreground text-sm">Approved Snippets</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{coverageData.summary.coveragePercent}%</div>
              <p className="text-muted-foreground text-sm">Coverage Rate</p>
            </CardContent>
          </Card>
          <Card className={coverageData.summary.highRiskMissingCount > 0 ? 'border-amber-500' : ''}>
            <CardContent className="pt-4">
              <div className={`text-2xl font-bold ${coverageData.summary.highRiskMissingCount > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                {coverageData.summary.highRiskMissingCount}
              </div>
              <p className="text-muted-foreground text-sm">High-Risk Topics Missing</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'list' | 'coverage')}>
        <TabsList className="mb-4">
          <TabsTrigger value="list">State Notes List</TabsTrigger>
          <TabsTrigger value="coverage">Coverage Dashboard</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-4">
            <Select value={filterDecoder} onValueChange={setFilterDecoder}>
              <SelectTrigger className="w-40" data-testid="select-filter-decoder">
                <SelectValue placeholder="Decoder" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Decoders</SelectItem>
                <SelectItem value="credit">Credit</SelectItem>
                <SelectItem value="criminal_eviction">Criminal/Eviction</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40" data-testid="select-filter-status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending_review">Pending Review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterState} onValueChange={setFilterState}>
              <SelectTrigger className="w-40" data-testid="select-filter-state">
                <SelectValue placeholder="State" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                {states?.map(state => (
                  <SelectItem key={state.id} value={state.id}>{state.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes List */}
          {notesLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : stateNotes?.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No state notes found. Create one to get started.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {stateNotes?.map(note => (
                <Card key={note.id} data-testid={`card-state-note-${note.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          {note.title}
                          {HIGH_RISK_TOPICS.includes(note.topic) && (
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                          )}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          <Badge variant="outline">{note.stateId}</Badge>
                          <Badge variant="outline">{note.decoder}</Badge>
                          <Badge variant="outline">{note.topic}</Badge>
                          <Badge className={getStatusColor(note.status)}>
                            {getStatusIcon(note.status)}
                            <span className="ml-1">{note.status.replace('_', ' ')}</span>
                          </Badge>
                          <span className="text-xs">v{note.version}</span>
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        {note.status === 'draft' && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => submitForReviewMutation.mutate(note.id)}
                            data-testid={`button-submit-${note.id}`}
                          >
                            <Send className="h-3 w-3 mr-1" />
                            Submit
                          </Button>
                        )}
                        {note.status === 'pending_review' && (
                          <Button 
                            size="sm"
                            onClick={() => { setSelectedNote(note); setIsApproveDialogOpen(true); }}
                            data-testid={`button-approve-${note.id}`}
                          >
                            <Check className="h-3 w-3 mr-1" />
                            Review & Approve
                          </Button>
                        )}
                        {note.status !== 'archived' && (
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => archiveMutation.mutate(note.id)}
                            data-testid={`button-archive-${note.id}`}
                          >
                            <Archive className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc pl-5 space-y-1 text-sm">
                      {note.bullets.map((bullet, i) => (
                        <li key={i}>{bullet}</li>
                      ))}
                    </ul>
                    {note.sourceLinks.length > 0 && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        Sources: {note.sourceLinks.map((link, i) => (
                          <a key={i} href={link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline ml-1">
                            {i > 0 ? ', ' : ''}{new URL(link).hostname}
                          </a>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="coverage">
          {coverageLoading ? (
            <div className="text-center py-8">Loading coverage data...</div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedCoverage).map(([stateId, { stateName, items }]) => (
                <Card key={stateId}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">{stateName} ({stateId})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {items.map(item => (
                        <div 
                          key={`${item.decoder}-${item.topic}`}
                          className={`p-2 rounded border text-xs ${
                            item.hasApproved 
                              ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800' 
                              : item.isHighRisk
                                ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
                                : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
                          }`}
                        >
                          <div className="font-medium flex items-center gap-1">
                            {item.hasApproved ? (
                              <CheckCircle className="h-3 w-3 text-green-600" />
                            ) : item.isHighRisk ? (
                              <AlertTriangle className="h-3 w-3 text-red-600" />
                            ) : (
                              <Clock className="h-3 w-3 text-amber-600" />
                            )}
                            {item.topic.replace(/_/g, ' ')}
                          </div>
                          <div className="text-muted-foreground">{item.decoder}</div>
                          {!item.hasApproved && (
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="p-0 h-auto text-xs text-primary underline-offset-4 hover:underline"
                              onClick={() => {
                                setFormData(prev => ({
                                  ...prev,
                                  stateId,
                                  decoder: item.decoder as 'credit' | 'criminal_eviction',
                                  topic: item.topic,
                                }));
                                setIsCreateDialogOpen(true);
                              }}
                            >
                              Create Draft
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create State Note</DialogTitle>
            <DialogDescription>
              Create a new pre-vetted state-specific legal snippet for decoder responses.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>State</Label>
                <Select value={formData.stateId} onValueChange={v => setFormData(p => ({ ...p, stateId: v }))}>
                  <SelectTrigger data-testid="select-create-state">
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {states?.map(state => (
                      <SelectItem key={state.id} value={state.id}>{state.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Decoder</Label>
                <Select value={formData.decoder} onValueChange={v => setFormData(p => ({ ...p, decoder: v as 'credit' | 'criminal_eviction', topic: '' }))}>
                  <SelectTrigger data-testid="select-create-decoder">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credit">Credit</SelectItem>
                    <SelectItem value="criminal_eviction">Criminal/Eviction</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Topic</Label>
              <Select value={formData.topic} onValueChange={v => setFormData(p => ({ ...p, topic: v }))}>
                <SelectTrigger data-testid="select-create-topic">
                  <SelectValue placeholder="Select topic" />
                </SelectTrigger>
                <SelectContent>
                  {currentTopics.map(topic => (
                    <SelectItem key={topic} value={topic}>
                      {topic.replace(/_/g, ' ')}
                      {HIGH_RISK_TOPICS.includes(topic) && ' (high risk)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Title</Label>
              <Input 
                value={formData.title}
                onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
                placeholder="e.g., California Security Deposit Limits"
                data-testid="input-create-title"
              />
            </div>

            <div>
              <Label>Bullet Points</Label>
              <div className="space-y-2">
                {formData.bullets.map((bullet, i) => (
                  <div key={i} className="flex gap-2">
                    <Input 
                      value={bullet}
                      onChange={e => updateBullet(i, e.target.value)}
                      placeholder="Enter bullet point"
                      data-testid={`input-bullet-${i}`}
                    />
                    {formData.bullets.length > 1 && (
                      <Button size="icon" variant="ghost" onClick={() => removeBullet(i)}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addBullet}>
                  <Plus className="h-3 w-3 mr-1" /> Add Bullet
                </Button>
              </div>
            </div>

            <div>
              <Label>Source Links (optional)</Label>
              <div className="space-y-2">
                {formData.sourceLinks.map((link, i) => (
                  <div key={i} className="flex gap-2">
                    <Input 
                      value={link}
                      onChange={e => updateSourceLink(i, e.target.value)}
                      placeholder="https://..."
                      data-testid={`input-source-${i}`}
                    />
                    <Button size="icon" variant="ghost" onClick={() => removeSourceLink(i)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addSourceLink}>
                  <Plus className="h-3 w-3 mr-1" /> Add Source
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsCreateDialogOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button 
              onClick={() => createMutation.mutate(formData)}
              disabled={!formData.stateId || !formData.decoder || !formData.topic || !formData.title || formData.bullets.every(b => !b.trim())}
              data-testid="button-submit-create"
            >
              Create Draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Dialog */}
      <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Legal Review Checklist</DialogTitle>
            <DialogDescription>
              All items must be checked before approving this state note for production use.
            </DialogDescription>
          </DialogHeader>

          {selectedNote && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{selectedNote.title}</CardTitle>
                  <CardDescription>
                    {selectedNote.stateId} / {selectedNote.decoder} / {selectedNote.topic}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc pl-5 text-sm space-y-1">
                    {selectedNote.bullets.map((b, i) => <li key={i}>{b}</li>)}
                  </ul>
                </CardContent>
              </Card>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="contentAccuracy" 
                    checked={approvalChecklist.contentAccuracy}
                    onCheckedChange={v => setApprovalChecklist(p => ({ ...p, contentAccuracy: !!v }))}
                    data-testid="checkbox-content-accuracy"
                  />
                  <Label htmlFor="contentAccuracy" className="font-normal">
                    Content Accuracy: I have verified this information against current state statutes
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="neutralFraming" 
                    checked={approvalChecklist.neutralFraming}
                    onCheckedChange={v => setApprovalChecklist(p => ({ ...p, neutralFraming: !!v }))}
                    data-testid="checkbox-neutral-framing"
                  />
                  <Label htmlFor="neutralFraming" className="font-normal">
                    Neutral Framing: Language is neutral and informational (not prescriptive)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="fairHousingCompliance" 
                    checked={approvalChecklist.fairHousingCompliance}
                    onCheckedChange={v => setApprovalChecklist(p => ({ ...p, fairHousingCompliance: !!v }))}
                    data-testid="checkbox-fair-housing"
                  />
                  <Label htmlFor="fairHousingCompliance" className="font-normal">
                    Fair Housing Compliance: No language could encourage discriminatory practices
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="toneConsistency" 
                    checked={approvalChecklist.toneConsistency}
                    onCheckedChange={v => setApprovalChecklist(p => ({ ...p, toneConsistency: !!v }))}
                    data-testid="checkbox-tone-consistency"
                  />
                  <Label htmlFor="toneConsistency" className="font-normal">
                    Tone Consistency: Matches LeaseShield's "protective mentor" voice
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="auditTrailComplete" 
                    checked={approvalChecklist.auditTrailComplete}
                    onCheckedChange={v => setApprovalChecklist(p => ({ ...p, auditTrailComplete: !!v }))}
                    data-testid="checkbox-audit-trail"
                  />
                  <Label htmlFor="auditTrailComplete" className="font-normal">
                    Audit Trail: Source links are accurate and accessible
                  </Label>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsApproveDialogOpen(false); setSelectedNote(null); resetApprovalChecklist(); }}>
              Cancel
            </Button>
            <Button 
              onClick={() => selectedNote && approveMutation.mutate({ id: selectedNote.id, checklist: approvalChecklist })}
              disabled={!allChecklistItemsChecked}
              data-testid="button-confirm-approve"
            >
              <Check className="h-4 w-4 mr-1" />
              Approve & Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
