import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Plus, FileText, Edit, Trash2, ChevronRight, ArrowLeft, Calendar,
  Clock, Shield, AlertTriangle, Scale, Hash, Type, Settings, Eye,
  Loader2, Check, X, List, Layers, BookOpen, Gavel
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

type NoticeForm = {
  id: string;
  stateId: string;
  key: string;
  displayName: string;
  category: string;
  localOverlayRisk: string;
  disclaimerText: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type FormVersion = {
  id: string;
  formId: string;
  versionNumber: number;
  effectiveStart: string | null;
  effectiveEnd: string | null;
  status: string;
  approvalNotes: string | null;
  statuteSnapshotText: string | null;
  statuteRetrievedAt: string | null;
  statuteSourceCitation: string | null;
  createdAt: string;
  updatedAt: string;
};

type FormDayRule = {
  id: string;
  formVersionId: string;
  dayType: string;
  noticePeriodDays: number;
  countingConvention: string;
  holidayCalendarId: string | null;
};

type ServiceMethod = {
  id: string;
  key: string;
  displayName: string;
};

type FormServiceRule = {
  id: string;
  formVersionId: string;
  methodId: string;
  isAllowed: boolean;
  requiresPriorAttempts: boolean;
  priorAttemptMethodIds: string[];
  requiresAdditionalMethods: boolean;
  additionalMethodIds: string[];
  ackText: string | null;
  requiresAck: boolean;
  sortOrder: number;
};

type FormServiceLeaseGate = {
  id: string;
  formVersionId: string;
  gateKey: string;
  promptText: string;
  required: boolean;
  type: string;
  selectOptions: string[] | null;
  affectsNoticePeriod: boolean;
  affectsServiceMethods: boolean;
  affectedMethodIds: string[];
};

type LanguageBlock = {
  id: string;
  key: string;
  text: string;
  sourceCitation: string | null;
  retrievedAt: string | null;
};

type FormRequiredLanguage = {
  id: string;
  formVersionId: string;
  blockType: string;
  languageBlockId: string;
  isRequired: boolean;
  sortOrder: number;
};

type FormField = {
  id: string;
  formVersionId: string;
  key: string;
  label: string;
  type: string;
  required: boolean;
  helpText: string | null;
  defaultValue: string | null;
  selectOptions: string[] | null;
  visibilityRule: any;
  sortOrder: number;
  fieldGroup: string | null;
};

type FieldValidation = {
  id: string;
  fieldId: string;
  validationType: string;
  params: any;
  errorMessage: string;
};

type HolidayCalendar = {
  id: string;
  stateId: string;
  name: string;
  year: number;
  version: string;
  sourceName: string | null;
  sourceCitation: string | null;
  isActive: boolean;
};

type OutputTemplate = {
  id: string;
  formVersionId: string;
  mode: string;
  basePdfAttachmentPath: string | null;
  htmlTemplate: string | null;
  docxTemplateAttachmentPath: string | null;
  pageCount: number | null;
};

type OverlayFieldType = {
  id: string;
  outputTemplateId: string;
  fieldKey: string;
  pageNumber: number;
  x: number;
  y: number;
  font: string;
  fontSize: number;
  maxWidth: number | null;
  align: string;
  wrap: boolean;
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  review_required: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  retired: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
};

const RISK_COLORS: Record<string, string> = {
  low: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  med: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  high: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export default function AdminNoticeFormsPage() {
  const [activeTab, setActiveTab] = useState("forms");
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl" data-testid="admin-notice-forms-page">
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <Scale className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Compliance Matrix</h1>
        <Badge variant="outline">State-Specific Legal Notice Forms</Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap gap-1 h-auto">
          <TabsTrigger value="forms" data-testid="tab-forms">
            <FileText className="h-4 w-4 mr-1" /> Forms
          </TabsTrigger>
          <TabsTrigger value="service-methods" data-testid="tab-service-methods">
            <Gavel className="h-4 w-4 mr-1" /> Service Methods
          </TabsTrigger>
          <TabsTrigger value="language-blocks" data-testid="tab-language-blocks">
            <BookOpen className="h-4 w-4 mr-1" /> Language Blocks
          </TabsTrigger>
          <TabsTrigger value="holiday-calendars" data-testid="tab-holiday-calendars">
            <Calendar className="h-4 w-4 mr-1" /> Holiday Calendars
          </TabsTrigger>
        </TabsList>

        <TabsContent value="forms">
          {selectedVersionId ? (
            <FormVersionDetail
              versionId={selectedVersionId}
              onBack={() => setSelectedVersionId(null)}
            />
          ) : selectedFormId ? (
            <FormDetail
              formId={selectedFormId}
              onBack={() => setSelectedFormId(null)}
              onSelectVersion={setSelectedVersionId}
            />
          ) : (
            <FormsListPanel onSelectForm={setSelectedFormId} />
          )}
        </TabsContent>

        <TabsContent value="service-methods">
          <ServiceMethodsPanel />
        </TabsContent>

        <TabsContent value="language-blocks">
          <LanguageBlocksPanel />
        </TabsContent>

        <TabsContent value="holiday-calendars">
          <HolidayCalendarsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================================
// FORMS LIST
// ============================================================================

function FormsListPanel({ onSelectForm }: { onSelectForm: (id: string) => void }) {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [formData, setFormData] = useState({
    stateId: "", key: "", displayName: "", category: "nonpayment",
    localOverlayRisk: "low", disclaimerText: "", isActive: true,
  });

  const { data: forms = [], isLoading } = useQuery<NoticeForm[]>({
    queryKey: ['/api/admin/notice-forms'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => apiRequest('POST', '/api/admin/notice-forms', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/notice-forms'] });
      setShowCreate(false);
      setFormData({ stateId: "", key: "", displayName: "", category: "nonpayment", localOverlayRisk: "low", disclaimerText: "", isActive: true });
      toast({ title: "Form created" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest('DELETE', `/api/admin/notice-forms/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/notice-forms'] });
      toast({ title: "Form deleted" });
    },
  });

  if (isLoading) return <div className="flex items-center gap-2 py-8"><Loader2 className="h-5 w-5 animate-spin" /> Loading forms...</div>;

  const grouped = forms.reduce((acc, form) => {
    (acc[form.stateId] = acc[form.stateId] || []).push(form);
    return acc;
  }, {} as Record<string, NoticeForm[]>);

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-muted-foreground text-sm">{forms.length} forms across {Object.keys(grouped).length} states</p>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-form"><Plus className="h-4 w-4 mr-1" /> Create Form</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Notice Form</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>State Code</Label>
                  <Input data-testid="input-form-state" placeholder="MI" maxLength={2} value={formData.stateId}
                    onChange={e => setFormData(p => ({ ...p, stateId: e.target.value.toUpperCase() }))} />
                </div>
                <div>
                  <Label>Category</Label>
                  <Select value={formData.category} onValueChange={v => setFormData(p => ({ ...p, category: v }))}>
                    <SelectTrigger data-testid="select-form-category"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nonpayment">Nonpayment</SelectItem>
                      <SelectItem value="termination">Termination</SelectItem>
                      <SelectItem value="noncompliance">Noncompliance</SelectItem>
                      <SelectItem value="lease_violation">Lease Violation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Display Name</Label>
                <Input data-testid="input-form-name" placeholder="e.g., Demand for Possession - Nonpayment"
                  value={formData.displayName} onChange={e => setFormData(p => ({ ...p, displayName: e.target.value }))} />
              </div>
              <div>
                <Label>Key (slug)</Label>
                <Input data-testid="input-form-key" placeholder="e.g., mi_dc_100a_nonpayment"
                  value={formData.key} onChange={e => setFormData(p => ({ ...p, key: e.target.value }))} />
              </div>
              <div>
                <Label>Local Overlay Risk</Label>
                <Select value={formData.localOverlayRisk} onValueChange={v => setFormData(p => ({ ...p, localOverlayRisk: v }))}>
                  <SelectTrigger data-testid="select-form-risk"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="med">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(formData.localOverlayRisk === 'med' || formData.localOverlayRisk === 'high') && (
                <div>
                  <Label>Disclaimer Text</Label>
                  <Textarea data-testid="input-form-disclaimer" value={formData.disclaimerText}
                    onChange={e => setFormData(p => ({ ...p, disclaimerText: e.target.value }))} />
                </div>
              )}
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button data-testid="button-save-form" onClick={() => createMutation.mutate(formData)} disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([stateId, stateForms]) => (
        <div key={stateId}>
          <h3 className="font-semibold text-sm text-muted-foreground mb-2">{stateId}</h3>
          <div className="space-y-2">
            {stateForms.map(form => (
              <Card key={form.id} className="hover-elevate cursor-pointer" data-testid={`card-form-${form.id}`}
                onClick={() => onSelectForm(form.id)}>
                <CardContent className="flex items-center justify-between gap-3 py-3 px-4 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{form.displayName}</span>
                    <Badge variant="outline" className="text-xs">{form.category}</Badge>
                    <Badge className={`text-xs ${RISK_COLORS[form.localOverlayRisk] || ''}`}>
                      {form.localOverlayRisk} risk
                    </Badge>
                    {!form.isActive && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-mono">{form.key}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {forms.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No forms created yet. Click "Create Form" to add your first state-specific notice form.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================================
// FORM DETAIL — versions list
// ============================================================================

function FormDetail({ formId, onBack, onSelectVersion }: {
  formId: string; onBack: () => void; onSelectVersion: (id: string) => void;
}) {
  const { toast } = useToast();
  const [showCreateVersion, setShowCreateVersion] = useState(false);
  const [versionData, setVersionData] = useState({
    formId, versionNumber: 1, effectiveStart: "", effectiveEnd: "",
    status: "draft", approvalNotes: "", statuteSnapshotText: "",
    statuteSourceCitation: "",
  });

  const { data: form } = useQuery<NoticeForm>({
    queryKey: ['/api/admin/notice-forms', formId],
  });

  const { data: versions = [], isLoading } = useQuery<FormVersion[]>({
    queryKey: ['/api/admin/notice-forms', formId, 'versions'],
    queryFn: async () => {
      const res = await fetch(`/api/admin/notice-forms/${formId}/versions`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch versions');
      return res.json();
    },
  });

  const createVersionMutation = useMutation({
    mutationFn: async (data: any) => apiRequest('POST', '/api/admin/form-versions', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/notice-forms', formId, 'versions'] });
      setShowCreateVersion(false);
      toast({ title: "Version created" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteVersionMutation = useMutation({
    mutationFn: async (id: string) => apiRequest('DELETE', `/api/admin/form-versions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/notice-forms', formId, 'versions'] });
      toast({ title: "Version deleted" });
    },
  });

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-forms">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <h2 className="text-lg font-semibold">{form?.displayName || formId}</h2>
        {form && <Badge variant="outline" className="text-xs font-mono">{form.key}</Badge>}
        {form && <Badge className={`text-xs ${RISK_COLORS[form.localOverlayRisk] || ''}`}>{form.localOverlayRisk} risk</Badge>}
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-muted-foreground text-sm">{versions.length} version(s)</p>
        <Dialog open={showCreateVersion} onOpenChange={setShowCreateVersion}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-version"><Plus className="h-4 w-4 mr-1" /> New Version</Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>Create Form Version</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Version Number</Label>
                  <Input data-testid="input-version-number" type="number" value={versionData.versionNumber}
                    onChange={e => setVersionData(p => ({ ...p, versionNumber: parseInt(e.target.value) || 1 }))} />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={versionData.status} onValueChange={v => setVersionData(p => ({ ...p, status: v }))}>
                    <SelectTrigger data-testid="select-version-status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Effective Start</Label>
                  <Input data-testid="input-version-start" type="date" value={versionData.effectiveStart}
                    onChange={e => setVersionData(p => ({ ...p, effectiveStart: e.target.value }))} />
                </div>
                <div>
                  <Label>Effective End (optional)</Label>
                  <Input data-testid="input-version-end" type="date" value={versionData.effectiveEnd}
                    onChange={e => setVersionData(p => ({ ...p, effectiveEnd: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Statute Source Citation</Label>
                <Input data-testid="input-version-citation" value={versionData.statuteSourceCitation}
                  onChange={e => setVersionData(p => ({ ...p, statuteSourceCitation: e.target.value }))} />
              </div>
              <div>
                <Label>Statute Snapshot Text</Label>
                <Textarea data-testid="input-version-statute" className="min-h-[120px]"
                  value={versionData.statuteSnapshotText}
                  onChange={e => setVersionData(p => ({ ...p, statuteSnapshotText: e.target.value }))} />
              </div>
              <div>
                <Label>Approval Notes</Label>
                <Textarea data-testid="input-version-notes" value={versionData.approvalNotes}
                  onChange={e => setVersionData(p => ({ ...p, approvalNotes: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button data-testid="button-save-version" onClick={() => createVersionMutation.mutate({
                ...versionData,
                effectiveStart: versionData.effectiveStart || null,
                effectiveEnd: versionData.effectiveEnd || null,
              })} disabled={createVersionMutation.isPending}>
                {createVersionMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading && <div className="flex items-center gap-2 py-4"><Loader2 className="h-5 w-5 animate-spin" /> Loading...</div>}

      {versions.map(version => (
        <Card key={version.id} className="hover-elevate cursor-pointer" data-testid={`card-version-${version.id}`}
          onClick={() => onSelectVersion(version.id)}>
          <CardContent className="flex items-center justify-between gap-3 py-3 px-4 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">v{version.versionNumber}</span>
              <Badge className={`text-xs ${STATUS_COLORS[version.status] || ''}`}>{version.status.replace('_', ' ')}</Badge>
              {version.effectiveStart && (
                <span className="text-xs text-muted-foreground">
                  {version.effectiveStart}{version.effectiveEnd ? ` — ${version.effectiveEnd}` : ' — present'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" data-testid={`button-delete-version-${version.id}`}
                onClick={e => { e.stopPropagation(); deleteVersionMutation.mutate(version.id); }}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      ))}

      {versions.length === 0 && !isLoading && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No versions yet. Create a version to start configuring this form.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================================
// FORM VERSION DETAIL — the mega-editor
// ============================================================================

function FormVersionDetail({ versionId, onBack }: { versionId: string; onBack: () => void }) {
  const { toast } = useToast();
  const [versionTab, setVersionTab] = useState("info");

  const { data: fullDef, isLoading } = useQuery<any>({
    queryKey: ['/api/admin/form-versions', versionId, 'full'],
    queryFn: async () => {
      const res = await fetch(`/api/admin/form-versions/${versionId}/full`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });

  const updateVersionMutation = useMutation({
    mutationFn: async (data: any) => apiRequest('PUT', `/api/admin/form-versions/${versionId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/form-versions', versionId, 'full'] });
      toast({ title: "Version updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="flex items-center gap-2 py-8"><Loader2 className="h-5 w-5 animate-spin" /> Loading form definition...</div>;
  if (!fullDef) return <div className="py-8 text-center text-muted-foreground">Version not found</div>;

  const { form, version, dayRules, serviceRules, leaseGates, requiredLanguage, fields, outputTemplates: outputs } = fullDef;

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-version">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <h2 className="text-lg font-semibold">{form?.displayName}</h2>
        <Badge className={`text-xs ${STATUS_COLORS[version.status] || ''}`}>{version.status.replace('_', ' ')}</Badge>
        <span className="text-sm text-muted-foreground">v{version.versionNumber}</span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {version.status === 'draft' && (
          <Button size="sm" variant="default" data-testid="button-approve-version"
            onClick={() => updateVersionMutation.mutate({ status: 'approved' })}>
            <Check className="h-4 w-4 mr-1" /> Approve
          </Button>
        )}
        {version.status === 'approved' && (
          <Button size="sm" variant="destructive" data-testid="button-lock-version"
            onClick={() => updateVersionMutation.mutate({ status: 'review_required' })}>
            <AlertTriangle className="h-4 w-4 mr-1" /> Mark Review Required
          </Button>
        )}
        {version.status === 'review_required' && (
          <>
            <Button size="sm" variant="default" data-testid="button-re-approve-version"
              onClick={() => updateVersionMutation.mutate({ status: 'approved' })}>
              <Check className="h-4 w-4 mr-1" /> Re-Approve
            </Button>
            <Button size="sm" variant="outline" data-testid="button-retire-version"
              onClick={() => updateVersionMutation.mutate({ status: 'retired' })}>
              Retire
            </Button>
          </>
        )}
      </div>

      <Tabs value={versionTab} onValueChange={setVersionTab}>
        <TabsList className="flex flex-wrap gap-1 h-auto">
          <TabsTrigger value="info" data-testid="vtab-info"><Settings className="h-3 w-3 mr-1" /> Info</TabsTrigger>
          <TabsTrigger value="day-rules" data-testid="vtab-day-rules"><Clock className="h-3 w-3 mr-1" /> Day Rules ({dayRules.length})</TabsTrigger>
          <TabsTrigger value="fields" data-testid="vtab-fields"><Type className="h-3 w-3 mr-1" /> Fields ({fields.length})</TabsTrigger>
          <TabsTrigger value="service" data-testid="vtab-service"><Gavel className="h-3 w-3 mr-1" /> Service ({serviceRules.length})</TabsTrigger>
          <TabsTrigger value="language" data-testid="vtab-language"><BookOpen className="h-3 w-3 mr-1" /> Language ({requiredLanguage.length})</TabsTrigger>
          <TabsTrigger value="output" data-testid="vtab-output"><Eye className="h-3 w-3 mr-1" /> Output ({outputs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <VersionInfoPanel version={version} onUpdate={updateVersionMutation.mutate} />
        </TabsContent>
        <TabsContent value="day-rules">
          <DayRulesPanel versionId={versionId} rules={dayRules} />
        </TabsContent>
        <TabsContent value="fields">
          <FieldsPanel versionId={versionId} fields={fields} />
        </TabsContent>
        <TabsContent value="service">
          <ServiceRulesPanel versionId={versionId} rules={serviceRules} leaseGates={leaseGates} />
        </TabsContent>
        <TabsContent value="language">
          <RequiredLanguagePanel versionId={versionId} items={requiredLanguage} />
        </TabsContent>
        <TabsContent value="output">
          <OutputPanel versionId={versionId} templates={outputs} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================================
// VERSION INFO PANEL
// ============================================================================

function VersionInfoPanel({ version, onUpdate }: { version: FormVersion; onUpdate: (data: any) => void }) {
  const [citation, setCitation] = useState(version.statuteSourceCitation || "");
  const [snapshot, setSnapshot] = useState(version.statuteSnapshotText || "");
  const [notes, setNotes] = useState(version.approvalNotes || "");

  return (
    <Card className="mt-3">
      <CardContent className="space-y-4 pt-4">
        <div>
          <Label>Statute Source Citation</Label>
          <Input data-testid="input-edit-citation" value={citation} onChange={e => setCitation(e.target.value)} />
        </div>
        <div>
          <Label>Statute Snapshot Text</Label>
          <Textarea data-testid="input-edit-statute" className="min-h-[150px]" value={snapshot} onChange={e => setSnapshot(e.target.value)} />
        </div>
        <div>
          <Label>Approval Notes</Label>
          <Textarea data-testid="input-edit-notes" value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
        <Button data-testid="button-save-version-info" onClick={() => onUpdate({
          statuteSourceCitation: citation, statuteSnapshotText: snapshot, approvalNotes: notes,
        })}>Save Changes</Button>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// DAY RULES PANEL
// ============================================================================

function DayRulesPanel({ versionId, rules: initialRules }: { versionId: string; rules: FormDayRule[] }) {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [newRule, setNewRule] = useState({
    formVersionId: versionId, dayType: "calendar" as string, noticePeriodDays: 7,
    countingConvention: "day0_service_plus_n" as string, holidayCalendarId: null as string | null,
  });

  const { data: rules = initialRules } = useQuery<FormDayRule[]>({
    queryKey: ['/api/admin/form-versions', versionId, 'day-rules'],
    queryFn: async () => {
      const res = await fetch(`/api/admin/form-versions/${versionId}/day-rules`, { credentials: 'include' });
      return res.json();
    },
    initialData: initialRules,
  });

  const { data: calendars = [] } = useQuery<HolidayCalendar[]>({
    queryKey: ['/api/admin/holiday-calendars'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => apiRequest('POST', '/api/admin/day-rules', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/form-versions', versionId, 'day-rules'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/form-versions', versionId, 'full'] });
      setShowCreate(false);
      toast({ title: "Day rule created" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest('DELETE', `/api/admin/day-rules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/form-versions', versionId, 'day-rules'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/form-versions', versionId, 'full'] });
      toast({ title: "Day rule deleted" });
    },
  });

  return (
    <div className="space-y-3 mt-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">Configure how notice periods are counted</p>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-add-day-rule"><Plus className="h-4 w-4 mr-1" /> Add Day Rule</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Day Rule</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Day Type</Label>
                <Select value={newRule.dayType} onValueChange={v => setNewRule(p => ({ ...p, dayType: v }))}>
                  <SelectTrigger data-testid="select-day-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="calendar">Calendar Days</SelectItem>
                    <SelectItem value="business">Business Days</SelectItem>
                    <SelectItem value="judicial">Judicial Days</SelectItem>
                    <SelectItem value="judicial_holidays_excluded">Judicial (Holidays Excluded)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Notice Period (Days)</Label>
                <Input data-testid="input-notice-days" type="number" value={newRule.noticePeriodDays}
                  onChange={e => setNewRule(p => ({ ...p, noticePeriodDays: parseInt(e.target.value) || 0 }))} />
              </div>
              {newRule.dayType !== 'calendar' && (
                <div>
                  <Label>Holiday Calendar (optional)</Label>
                  <Select value={newRule.holidayCalendarId || "none"} onValueChange={v => setNewRule(p => ({ ...p, holidayCalendarId: v === "none" ? null : v }))}>
                    <SelectTrigger data-testid="select-holiday-cal"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {calendars.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.stateId} - {c.name} ({c.year})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button data-testid="button-save-day-rule" onClick={() => createMutation.mutate(newRule)} disabled={createMutation.isPending}>
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {rules.map(rule => (
        <Card key={rule.id} data-testid={`card-day-rule-${rule.id}`}>
          <CardContent className="flex items-center justify-between gap-3 py-3 px-4 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <Badge variant="outline">{rule.dayType.replace(/_/g, ' ')}</Badge>
              <span className="font-medium">{rule.noticePeriodDays} days</span>
              <span className="text-xs text-muted-foreground">{rule.countingConvention.replace(/_/g, ' ')}</span>
              {rule.holidayCalendarId && <Badge variant="secondary" className="text-xs">Has holiday calendar</Badge>}
            </div>
            <Button variant="ghost" size="icon" data-testid={`button-delete-day-rule-${rule.id}`}
              onClick={() => deleteMutation.mutate(rule.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </CardContent>
        </Card>
      ))}

      {rules.length === 0 && (
        <Card><CardContent className="py-6 text-center text-muted-foreground text-sm">No day rules configured</CardContent></Card>
      )}
    </div>
  );
}

// ============================================================================
// FIELDS PANEL
// ============================================================================

function FieldsPanel({ versionId, fields: initialFields }: { versionId: string; fields: FormField[] }) {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [newField, setNewField] = useState({
    formVersionId: versionId, key: "", label: "", type: "text" as string,
    required: true, helpText: "", defaultValue: "", sortOrder: 0, fieldGroup: "",
  });

  const { data: fields = initialFields } = useQuery<FormField[]>({
    queryKey: ['/api/admin/form-versions', versionId, 'fields'],
    queryFn: async () => {
      const res = await fetch(`/api/admin/form-versions/${versionId}/fields`, { credentials: 'include' });
      return res.json();
    },
    initialData: initialFields,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => apiRequest('POST', '/api/admin/form-fields', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/form-versions', versionId, 'fields'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/form-versions', versionId, 'full'] });
      setShowCreate(false);
      setNewField({ formVersionId: versionId, key: "", label: "", type: "text", required: true, helpText: "", defaultValue: "", sortOrder: 0, fieldGroup: "" });
      toast({ title: "Field created" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest('DELETE', `/api/admin/form-fields/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/form-versions', versionId, 'fields'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/form-versions', versionId, 'full'] });
      toast({ title: "Field deleted" });
    },
  });

  const FIELD_TYPE_ICONS: Record<string, string> = {
    text: "Aa", money: "$", date: "D", select: "v", checkbox: "Y", textarea: "T", number: "#",
  };

  return (
    <div className="space-y-3 mt-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">{fields.length} wizard fields configured</p>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-add-field"><Plus className="h-4 w-4 mr-1" /> Add Field</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Wizard Field</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Field Key</Label>
                  <Input data-testid="input-field-key" placeholder="tenant_name" value={newField.key}
                    onChange={e => setNewField(p => ({ ...p, key: e.target.value }))} />
                </div>
                <div>
                  <Label>Type</Label>
                  <Select value={newField.type} onValueChange={v => setNewField(p => ({ ...p, type: v }))}>
                    <SelectTrigger data-testid="select-field-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="money">Money</SelectItem>
                      <SelectItem value="date">Date</SelectItem>
                      <SelectItem value="select">Select</SelectItem>
                      <SelectItem value="checkbox">Checkbox</SelectItem>
                      <SelectItem value="textarea">Textarea</SelectItem>
                      <SelectItem value="number">Number</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Label</Label>
                <Input data-testid="input-field-label" placeholder="Tenant Full Name" value={newField.label}
                  onChange={e => setNewField(p => ({ ...p, label: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Sort Order</Label>
                  <Input data-testid="input-field-sort" type="number" value={newField.sortOrder}
                    onChange={e => setNewField(p => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))} />
                </div>
                <div>
                  <Label>Field Group</Label>
                  <Input data-testid="input-field-group" placeholder="tenant_info" value={newField.fieldGroup}
                    onChange={e => setNewField(p => ({ ...p, fieldGroup: e.target.value }))} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={newField.required} onCheckedChange={v => setNewField(p => ({ ...p, required: v }))} />
                <Label>Required</Label>
              </div>
              <div>
                <Label>Help Text</Label>
                <Input data-testid="input-field-help" value={newField.helpText}
                  onChange={e => setNewField(p => ({ ...p, helpText: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button data-testid="button-save-field" onClick={() => createMutation.mutate({
                ...newField,
                helpText: newField.helpText || null,
                defaultValue: newField.defaultValue || null,
                fieldGroup: newField.fieldGroup || null,
              })} disabled={createMutation.isPending}>
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {fields.map(field => (
        <Card key={field.id} data-testid={`card-field-${field.id}`}>
          <CardContent className="flex items-center justify-between gap-3 py-3 px-4 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{FIELD_TYPE_ICONS[field.type] || '?'}</span>
              <span className="font-medium">{field.label}</span>
              <span className="text-xs text-muted-foreground font-mono">{field.key}</span>
              {field.required && <Badge variant="outline" className="text-xs">Required</Badge>}
              {field.fieldGroup && <Badge variant="secondary" className="text-xs">{field.fieldGroup}</Badge>}
              <span className="text-xs text-muted-foreground">#{field.sortOrder}</span>
            </div>
            <Button variant="ghost" size="icon" data-testid={`button-delete-field-${field.id}`}
              onClick={() => deleteMutation.mutate(field.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </CardContent>
        </Card>
      ))}

      {fields.length === 0 && (
        <Card><CardContent className="py-6 text-center text-muted-foreground text-sm">No fields configured</CardContent></Card>
      )}
    </div>
  );
}

// ============================================================================
// SERVICE RULES PANEL
// ============================================================================

function ServiceRulesPanel({ versionId, rules: initialRules, leaseGates: initialGates }: {
  versionId: string; rules: FormServiceRule[]; leaseGates: FormServiceLeaseGate[];
}) {
  const { toast } = useToast();
  const [showAddRule, setShowAddRule] = useState(false);
  const [showAddGate, setShowAddGate] = useState(false);

  const { data: allMethods = [] } = useQuery<ServiceMethod[]>({
    queryKey: ['/api/admin/service-methods'],
  });

  const { data: rules = initialRules } = useQuery<FormServiceRule[]>({
    queryKey: ['/api/admin/form-versions', versionId, 'service-rules'],
    queryFn: async () => {
      const res = await fetch(`/api/admin/form-versions/${versionId}/service-rules`, { credentials: 'include' });
      return res.json();
    },
    initialData: initialRules,
  });

  const { data: gates = initialGates } = useQuery<FormServiceLeaseGate[]>({
    queryKey: ['/api/admin/form-versions', versionId, 'lease-gates'],
    queryFn: async () => {
      const res = await fetch(`/api/admin/form-versions/${versionId}/lease-gates`, { credentials: 'include' });
      return res.json();
    },
    initialData: initialGates,
  });

  const [newRule, setNewRule] = useState({
    formVersionId: versionId, methodId: "", isAllowed: true,
    requiresPriorAttempts: false, priorAttemptMethodIds: [] as string[],
    requiresAdditionalMethods: false, additionalMethodIds: [] as string[],
    ackText: "", requiresAck: false, sortOrder: 0,
  });

  const [newGate, setNewGate] = useState({
    formVersionId: versionId, gateKey: "", promptText: "",
    required: true, type: "boolean" as string,
    affectsNoticePeriod: false, affectsServiceMethods: false,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/admin/form-versions', versionId, 'service-rules'] });
    queryClient.invalidateQueries({ queryKey: ['/api/admin/form-versions', versionId, 'lease-gates'] });
    queryClient.invalidateQueries({ queryKey: ['/api/admin/form-versions', versionId, 'full'] });
  };

  const createRuleMutation = useMutation({
    mutationFn: async (data: any) => apiRequest('POST', '/api/admin/service-rules', data),
    onSuccess: () => { invalidateAll(); setShowAddRule(false); toast({ title: "Service rule created" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (id: string) => apiRequest('DELETE', `/api/admin/service-rules/${id}`),
    onSuccess: () => { invalidateAll(); toast({ title: "Rule deleted" }); },
  });

  const createGateMutation = useMutation({
    mutationFn: async (data: any) => apiRequest('POST', '/api/admin/lease-gates', data),
    onSuccess: () => { invalidateAll(); setShowAddGate(false); toast({ title: "Lease gate created" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteGateMutation = useMutation({
    mutationFn: async (id: string) => apiRequest('DELETE', `/api/admin/lease-gates/${id}`),
    onSuccess: () => { invalidateAll(); toast({ title: "Gate deleted" }); },
  });

  const getMethodName = (id: string) => allMethods.find(m => m.id === id)?.displayName || id;

  return (
    <div className="space-y-4 mt-3">
      <div>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
          <h3 className="font-semibold text-sm">Service Methods ({rules.length})</h3>
          <Dialog open={showAddRule} onOpenChange={setShowAddRule}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-add-service-rule"><Plus className="h-4 w-4 mr-1" /> Add Rule</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Service Rule</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Service Method</Label>
                  <Select value={newRule.methodId} onValueChange={v => setNewRule(p => ({ ...p, methodId: v }))}>
                    <SelectTrigger data-testid="select-service-method"><SelectValue placeholder="Select method" /></SelectTrigger>
                    <SelectContent>
                      {allMethods.map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.displayName} ({m.key})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={newRule.isAllowed} onCheckedChange={v => setNewRule(p => ({ ...p, isAllowed: v }))} />
                  <Label>Allowed</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={newRule.requiresPriorAttempts} onCheckedChange={v => setNewRule(p => ({ ...p, requiresPriorAttempts: v }))} />
                  <Label>Requires Prior Attempts</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={newRule.requiresAdditionalMethods} onCheckedChange={v => setNewRule(p => ({ ...p, requiresAdditionalMethods: v }))} />
                  <Label>Requires Additional Methods</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={newRule.requiresAck} onCheckedChange={v => setNewRule(p => ({ ...p, requiresAck: v }))} />
                  <Label>Requires Acknowledgment</Label>
                </div>
                {newRule.requiresAck && (
                  <div>
                    <Label>Acknowledgment Text</Label>
                    <Textarea data-testid="input-ack-text" value={newRule.ackText}
                      onChange={e => setNewRule(p => ({ ...p, ackText: e.target.value }))} />
                  </div>
                )}
                <div>
                  <Label>Sort Order</Label>
                  <Input data-testid="input-rule-sort" type="number" value={newRule.sortOrder}
                    onChange={e => setNewRule(p => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))} />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                <Button data-testid="button-save-service-rule" onClick={() => createRuleMutation.mutate({
                  ...newRule, ackText: newRule.ackText || null,
                })} disabled={createRuleMutation.isPending}>
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {rules.map(rule => (
          <Card key={rule.id} className="mb-2" data-testid={`card-service-rule-${rule.id}`}>
            <CardContent className="flex items-center justify-between gap-3 py-3 px-4 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <Gavel className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{getMethodName(rule.methodId)}</span>
                {rule.isAllowed ? (
                  <Badge variant="outline" className="text-xs text-green-700 dark:text-green-300">Allowed</Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-red-700 dark:text-red-300">Blocked</Badge>
                )}
                {rule.requiresPriorAttempts && <Badge variant="secondary" className="text-xs">Requires prior</Badge>}
                {rule.requiresAdditionalMethods && <Badge variant="secondary" className="text-xs">Requires additional</Badge>}
                {rule.requiresAck && <Badge variant="secondary" className="text-xs">Requires ack</Badge>}
              </div>
              <Button variant="ghost" size="icon" onClick={() => deleteRuleMutation.mutate(rule.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Separator />

      <div>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
          <h3 className="font-semibold text-sm">Lease Gates ({gates.length})</h3>
          <Dialog open={showAddGate} onOpenChange={setShowAddGate}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" data-testid="button-add-lease-gate"><Plus className="h-4 w-4 mr-1" /> Add Gate</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Lease Gate</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Gate Key</Label>
                  <Input data-testid="input-gate-key" placeholder="lease_notice_period_override" value={newGate.gateKey}
                    onChange={e => setNewGate(p => ({ ...p, gateKey: e.target.value }))} />
                </div>
                <div>
                  <Label>Prompt Text</Label>
                  <Textarea data-testid="input-gate-prompt" value={newGate.promptText}
                    onChange={e => setNewGate(p => ({ ...p, promptText: e.target.value }))} />
                </div>
                <div>
                  <Label>Type</Label>
                  <Select value={newGate.type} onValueChange={v => setNewGate(p => ({ ...p, type: v }))}>
                    <SelectTrigger data-testid="select-gate-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="boolean">Boolean</SelectItem>
                      <SelectItem value="number">Number</SelectItem>
                      <SelectItem value="select">Select</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={newGate.affectsNoticePeriod} onCheckedChange={v => setNewGate(p => ({ ...p, affectsNoticePeriod: v }))} />
                  <Label>Affects Notice Period</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={newGate.affectsServiceMethods} onCheckedChange={v => setNewGate(p => ({ ...p, affectsServiceMethods: v }))} />
                  <Label>Affects Service Methods</Label>
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                <Button data-testid="button-save-lease-gate" onClick={() => createGateMutation.mutate(newGate)} disabled={createGateMutation.isPending}>
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {gates.map(gate => (
          <Card key={gate.id} className="mb-2" data-testid={`card-lease-gate-${gate.id}`}>
            <CardContent className="flex items-center justify-between gap-3 py-3 px-4 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{gate.gateKey}</span>
                <Badge variant="outline" className="text-xs">{gate.type}</Badge>
                {gate.affectsNoticePeriod && <Badge variant="secondary" className="text-xs">Affects period</Badge>}
                {gate.affectsServiceMethods && <Badge variant="secondary" className="text-xs">Affects methods</Badge>}
              </div>
              <Button variant="ghost" size="icon" onClick={() => deleteGateMutation.mutate(gate.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </CardContent>
          </Card>
        ))}

        {gates.length === 0 && (
          <Card><CardContent className="py-4 text-center text-muted-foreground text-sm">No lease gates configured</CardContent></Card>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// REQUIRED LANGUAGE PANEL
// ============================================================================

function RequiredLanguagePanel({ versionId, items: initialItems }: { versionId: string; items: any[] }) {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [newItem, setNewItem] = useState({
    formVersionId: versionId, blockType: "statutory_language" as string,
    languageBlockId: "", isRequired: true, sortOrder: 0,
  });

  const { data: allBlocks = [] } = useQuery<LanguageBlock[]>({
    queryKey: ['/api/admin/language-blocks'],
  });

  const { data: items = initialItems } = useQuery<FormRequiredLanguage[]>({
    queryKey: ['/api/admin/form-versions', versionId, 'required-language'],
    queryFn: async () => {
      const res = await fetch(`/api/admin/form-versions/${versionId}/required-language`, { credentials: 'include' });
      return res.json();
    },
    initialData: initialItems,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => apiRequest('POST', '/api/admin/required-language', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/form-versions', versionId, 'required-language'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/form-versions', versionId, 'full'] });
      setShowAdd(false);
      toast({ title: "Language requirement added" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest('DELETE', `/api/admin/required-language/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/form-versions', versionId, 'required-language'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/form-versions', versionId, 'full'] });
      toast({ title: "Removed" });
    },
  });

  const getBlockKey = (id: string) => allBlocks.find(b => b.id === id)?.key || id;

  return (
    <div className="space-y-3 mt-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">Bind canonical language blocks to this form version</p>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-add-language"><Plus className="h-4 w-4 mr-1" /> Add Block</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Required Language</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Block Type</Label>
                <Select value={newItem.blockType} onValueChange={v => setNewItem(p => ({ ...p, blockType: v }))}>
                  <SelectTrigger data-testid="select-block-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="statutory_language">Statutory Language</SelectItem>
                    <SelectItem value="tenant_warning">Tenant Warning</SelectItem>
                    <SelectItem value="tenant_options_cure">Tenant Options/Cure</SelectItem>
                    <SelectItem value="local_disclaimer">Local Disclaimer</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Language Block</Label>
                <Select value={newItem.languageBlockId} onValueChange={v => setNewItem(p => ({ ...p, languageBlockId: v }))}>
                  <SelectTrigger data-testid="select-language-block"><SelectValue placeholder="Select block" /></SelectTrigger>
                  <SelectContent>
                    {allBlocks.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.key}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Sort Order</Label>
                <Input data-testid="input-lang-sort" type="number" value={newItem.sortOrder}
                  onChange={e => setNewItem(p => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button data-testid="button-save-language" onClick={() => createMutation.mutate(newItem)} disabled={createMutation.isPending}>
                Add
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {items.map((item: any) => (
        <Card key={item.id} data-testid={`card-language-${item.id}`}>
          <CardContent className="flex items-center justify-between gap-3 py-3 px-4 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <Badge variant="outline" className="text-xs">{item.blockType?.replace(/_/g, ' ')}</Badge>
              <span className="font-medium font-mono text-sm">{getBlockKey(item.languageBlockId)}</span>
              {item.isRequired && <Badge variant="secondary" className="text-xs">Required</Badge>}
              <span className="text-xs text-muted-foreground">#{item.sortOrder}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(item.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </CardContent>
        </Card>
      ))}

      {items.length === 0 && (
        <Card><CardContent className="py-6 text-center text-muted-foreground text-sm">No language blocks attached</CardContent></Card>
      )}
    </div>
  );
}

// ============================================================================
// OUTPUT TEMPLATES PANEL
// ============================================================================

function OutputPanel({ versionId, templates: initialTemplates }: { versionId: string; templates: any[] }) {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    formVersionId: versionId, mode: "leaseshield_formatted" as string,
    basePdfAttachmentPath: "", htmlTemplate: "", pageCount: 1,
  });

  const { data: templates = initialTemplates } = useQuery<OutputTemplate[]>({
    queryKey: ['/api/admin/form-versions', versionId, 'output-templates'],
    queryFn: async () => {
      const res = await fetch(`/api/admin/form-versions/${versionId}/output-templates`, { credentials: 'include' });
      return res.json();
    },
    initialData: initialTemplates,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => apiRequest('POST', '/api/admin/output-templates', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/form-versions', versionId, 'output-templates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/form-versions', versionId, 'full'] });
      setShowCreate(false);
      toast({ title: "Output template created" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest('DELETE', `/api/admin/output-templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/form-versions', versionId, 'output-templates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/form-versions', versionId, 'full'] });
      toast({ title: "Template deleted" });
    },
  });

  return (
    <div className="space-y-3 mt-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">Configure how forms are rendered (PDF overlay vs formatted template)</p>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-add-output"><Plus className="h-4 w-4 mr-1" /> Add Template</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Output Template</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Output Mode</Label>
                <Select value={newTemplate.mode} onValueChange={v => setNewTemplate(p => ({ ...p, mode: v }))}>
                  <SelectTrigger data-testid="select-output-mode"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="official_pdf_overlay">Official PDF Overlay</SelectItem>
                    <SelectItem value="leaseshield_formatted">LeaseShield Formatted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {newTemplate.mode === 'official_pdf_overlay' && (
                <div>
                  <Label>Base PDF Path</Label>
                  <Input data-testid="input-base-pdf" value={newTemplate.basePdfAttachmentPath}
                    onChange={e => setNewTemplate(p => ({ ...p, basePdfAttachmentPath: e.target.value }))}
                    placeholder="path/to/base.pdf" />
                </div>
              )}
              <div>
                <Label>Page Count</Label>
                <Input data-testid="input-page-count" type="number" value={newTemplate.pageCount}
                  onChange={e => setNewTemplate(p => ({ ...p, pageCount: parseInt(e.target.value) || 1 }))} />
              </div>
              {newTemplate.mode === 'leaseshield_formatted' && (
                <div>
                  <Label>HTML Template</Label>
                  <Textarea data-testid="input-html-template" className="min-h-[150px] font-mono text-xs"
                    value={newTemplate.htmlTemplate}
                    onChange={e => setNewTemplate(p => ({ ...p, htmlTemplate: e.target.value }))} />
                </div>
              )}
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button data-testid="button-save-output" onClick={() => createMutation.mutate({
                ...newTemplate,
                basePdfAttachmentPath: newTemplate.basePdfAttachmentPath || null,
                htmlTemplate: newTemplate.htmlTemplate || null,
              })} disabled={createMutation.isPending}>
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {templates.map((tmpl: any) => (
        <Card key={tmpl.id} data-testid={`card-output-${tmpl.id}`}>
          <CardContent className="space-y-3 pt-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <Badge variant="outline" className="text-xs">{tmpl.mode?.replace(/_/g, ' ')}</Badge>
                {tmpl.pageCount && <span className="text-xs text-muted-foreground">{tmpl.pageCount} page(s)</span>}
                {tmpl.basePdfAttachmentPath && <span className="text-xs text-muted-foreground font-mono">{tmpl.basePdfAttachmentPath}</span>}
              </div>
              <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(tmpl.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
            {tmpl.overlayFields && tmpl.overlayFields.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">{tmpl.overlayFields.length} overlay field(s)</p>
                <div className="flex flex-wrap gap-1">
                  {tmpl.overlayFields.map((f: any) => (
                    <Badge key={f.id} variant="secondary" className="text-xs font-mono">
                      {f.fieldKey} (p{f.pageNumber} {f.x},{f.y})
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {templates.length === 0 && (
        <Card><CardContent className="py-6 text-center text-muted-foreground text-sm">No output templates configured</CardContent></Card>
      )}
    </div>
  );
}

// ============================================================================
// SERVICE METHODS — master list tab
// ============================================================================

function ServiceMethodsPanel() {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [newMethod, setNewMethod] = useState({ key: "", displayName: "" });

  const { data: methods = [], isLoading } = useQuery<ServiceMethod[]>({
    queryKey: ['/api/admin/service-methods'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => apiRequest('POST', '/api/admin/service-methods', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/service-methods'] });
      setShowCreate(false);
      setNewMethod({ key: "", displayName: "" });
      toast({ title: "Method created" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest('DELETE', `/api/admin/service-methods/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/service-methods'] });
      toast({ title: "Method deleted" });
    },
  });

  if (isLoading) return <div className="flex items-center gap-2 py-8"><Loader2 className="h-5 w-5 animate-spin" /> Loading...</div>;

  return (
    <div className="space-y-3 mt-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-muted-foreground text-sm">Master list of service methods reused across all states</p>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-method"><Plus className="h-4 w-4 mr-1" /> Add Method</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Service Method</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Key</Label>
                <Input data-testid="input-method-key" placeholder="registered_mail" value={newMethod.key}
                  onChange={e => setNewMethod(p => ({ ...p, key: e.target.value }))} />
              </div>
              <div>
                <Label>Display Name</Label>
                <Input data-testid="input-method-name" placeholder="Registered Mail" value={newMethod.displayName}
                  onChange={e => setNewMethod(p => ({ ...p, displayName: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button data-testid="button-save-method" onClick={() => createMutation.mutate(newMethod)} disabled={createMutation.isPending}>
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {methods.map(method => (
        <Card key={method.id} data-testid={`card-method-${method.id}`}>
          <CardContent className="flex items-center justify-between gap-3 py-3 px-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Gavel className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{method.displayName}</span>
              <span className="text-xs text-muted-foreground font-mono">{method.key}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(method.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============================================================================
// LANGUAGE BLOCKS — master list tab
// ============================================================================

function LanguageBlocksPanel() {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [newBlock, setNewBlock] = useState({ key: "", text: "", sourceCitation: "" });

  const { data: blocks = [], isLoading } = useQuery<LanguageBlock[]>({
    queryKey: ['/api/admin/language-blocks'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => apiRequest('POST', '/api/admin/language-blocks', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/language-blocks'] });
      setShowCreate(false);
      setNewBlock({ key: "", text: "", sourceCitation: "" });
      toast({ title: "Block created" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest('DELETE', `/api/admin/language-blocks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/language-blocks'] });
      toast({ title: "Block deleted" });
    },
  });

  if (isLoading) return <div className="flex items-center gap-2 py-8"><Loader2 className="h-5 w-5 animate-spin" /> Loading...</div>;

  return (
    <div className="space-y-3 mt-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-muted-foreground text-sm">Canonical language blocks (exact statutory text) reused across forms</p>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-block"><Plus className="h-4 w-4 mr-1" /> Add Block</Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>Add Language Block</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Key</Label>
                <Input data-testid="input-block-key" placeholder="mi_dc100a_statutory_warning" value={newBlock.key}
                  onChange={e => setNewBlock(p => ({ ...p, key: e.target.value }))} />
              </div>
              <div>
                <Label>Text (exact statutory language)</Label>
                <Textarea data-testid="input-block-text" className="min-h-[200px]" value={newBlock.text}
                  onChange={e => setNewBlock(p => ({ ...p, text: e.target.value }))} />
              </div>
              <div>
                <Label>Source Citation</Label>
                <Input data-testid="input-block-citation" placeholder="MCL 600.5714" value={newBlock.sourceCitation}
                  onChange={e => setNewBlock(p => ({ ...p, sourceCitation: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button data-testid="button-save-block" onClick={() => createMutation.mutate({
                ...newBlock, sourceCitation: newBlock.sourceCitation || null,
              })} disabled={createMutation.isPending}>
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {blocks.map(block => (
        <Card key={block.id} data-testid={`card-block-${block.id}`}>
          <CardContent className="space-y-2 pt-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium font-mono text-sm">{block.key}</span>
                {block.sourceCitation && <span className="text-xs text-muted-foreground">{block.sourceCitation}</span>}
              </div>
              <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(block.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">{block.text}</p>
          </CardContent>
        </Card>
      ))}

      {blocks.length === 0 && (
        <Card><CardContent className="py-6 text-center text-muted-foreground text-sm">No language blocks created yet</CardContent></Card>
      )}
    </div>
  );
}

// ============================================================================
// HOLIDAY CALENDARS — master tab
// ============================================================================

function HolidayCalendarsPanel() {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [newCal, setNewCal] = useState({
    stateId: "", name: "", year: new Date().getFullYear(), version: "2026.1",
    sourceName: "", sourceCitation: "", isActive: true,
  });

  const { data: calendars = [], isLoading } = useQuery<HolidayCalendar[]>({
    queryKey: ['/api/admin/holiday-calendars'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => apiRequest('POST', '/api/admin/holiday-calendars', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/holiday-calendars'] });
      setShowCreate(false);
      toast({ title: "Calendar created" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest('DELETE', `/api/admin/holiday-calendars/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/holiday-calendars'] });
      toast({ title: "Calendar deleted" });
    },
  });

  if (isLoading) return <div className="flex items-center gap-2 py-8"><Loader2 className="h-5 w-5 animate-spin" /> Loading...</div>;

  return (
    <div className="space-y-3 mt-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-muted-foreground text-sm">Versioned holiday tables for business/judicial day counting</p>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-calendar"><Plus className="h-4 w-4 mr-1" /> Add Calendar</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Holiday Calendar</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>State Code</Label>
                  <Input data-testid="input-cal-state" placeholder="NV" maxLength={2} value={newCal.stateId}
                    onChange={e => setNewCal(p => ({ ...p, stateId: e.target.value.toUpperCase() }))} />
                </div>
                <div>
                  <Label>Year</Label>
                  <Input data-testid="input-cal-year" type="number" value={newCal.year}
                    onChange={e => setNewCal(p => ({ ...p, year: parseInt(e.target.value) || 2026 }))} />
                </div>
              </div>
              <div>
                <Label>Name</Label>
                <Input data-testid="input-cal-name" placeholder="NV Judicial Holidays" value={newCal.name}
                  onChange={e => setNewCal(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Version</Label>
                  <Input data-testid="input-cal-version" value={newCal.version}
                    onChange={e => setNewCal(p => ({ ...p, version: e.target.value }))} />
                </div>
                <div>
                  <Label>Source Name</Label>
                  <Input data-testid="input-cal-source" value={newCal.sourceName}
                    onChange={e => setNewCal(p => ({ ...p, sourceName: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Source Citation</Label>
                <Input data-testid="input-cal-citation" value={newCal.sourceCitation}
                  onChange={e => setNewCal(p => ({ ...p, sourceCitation: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button data-testid="button-save-calendar" onClick={() => createMutation.mutate({
                ...newCal, sourceName: newCal.sourceName || null, sourceCitation: newCal.sourceCitation || null,
              })} disabled={createMutation.isPending}>
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {calendars.map(cal => (
        <Card key={cal.id} data-testid={`card-calendar-${cal.id}`}>
          <CardContent className="flex items-center justify-between gap-3 py-3 px-4 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Badge variant="outline" className="text-xs">{cal.stateId}</Badge>
              <span className="font-medium">{cal.name}</span>
              <span className="text-xs text-muted-foreground">{cal.year} (v{cal.version})</span>
              {!cal.isActive && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
            </div>
            <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(cal.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </CardContent>
        </Card>
      ))}

      {calendars.length === 0 && (
        <Card><CardContent className="py-6 text-center text-muted-foreground text-sm">No holiday calendars created yet</CardContent></Card>
      )}
    </div>
  );
}
