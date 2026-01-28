import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { State, City } from "@shared/schema";
import {
  AlertTriangle,
  Lock,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Copy,
  FileText,
  MapPin,
  Shield,
  ThumbsUp,
  ClipboardCheck,
  Info,
  AlertCircle,
  Loader2,
} from "lucide-react";

interface CriterionWithRule {
  id: string;
  code: string;
  label: string;
  description: string | null;
  status: 'blocked' | 'allowed' | 'conditional';
  explanationPlain: string | null;
  whyItMatters: string | null;
  legalAlternative: string | null;
  requiredSteps: string[] | null;
}

type CriteriaByCategory = Record<string, CriterionWithRule[]>;

const CATEGORY_LABELS: Record<string, string> = {
  criminal: "Criminal History",
  eviction: "Eviction History",
  credit: "Credit History",
  income: "Income & Employment",
  verification: "Verification Issues",
};

const CATEGORY_ORDER = ['criminal', 'eviction', 'credit', 'income', 'verification'];

const CONDITION_OPTIONS = [
  { id: 'co_signer', label: 'Require co-signer or guarantor' },
  { id: 'higher_deposit', label: 'Require higher security deposit' },
  { id: 'additional_docs', label: 'Request additional documentation' },
  { id: 'shorter_lease', label: 'Offer shorter initial lease term' },
  { id: 'prepaid_rent', label: 'Require prepaid rent' },
];

const NOTICES_REQUIRED = [
  { id: 'adverse_action', label: 'Adverse Action Notice', required: true },
  { id: 'pre_adverse', label: 'Pre-Adverse Action Notice (if using screening report)', required: false },
  { id: 'credit_report_source', label: 'Include credit reporting agency contact info', required: true },
  { id: 'dispute_rights', label: 'Include right to dispute information', required: true },
];

export default function DenialDecisionAssistant() {
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  
  const [selectedStateId, setSelectedStateId] = useState<string | null>(user?.preferredState || null);
  const [selectedCityId, setSelectedCityId] = useState<string | null>(user?.preferredCity || null);
  const [criteriaPresent, setCriteriaPresent] = useState<Set<string>>(new Set());
  const [decisionOutcome, setDecisionOutcome] = useState<'approve' | 'conditional' | 'deny' | null>(null);
  const [selectedConditions, setSelectedConditions] = useState<Set<string>>(new Set());
  const [noticesChecked, setNoticesChecked] = useState<Set<string>>(new Set());
  const [applicantName, setApplicantName] = useState('');

  const { data: states = [], isLoading: statesLoading } = useQuery<State[]>({
    queryKey: ['/api/states'],
    enabled: true,
  });

  const { data: cities = [], isLoading: citiesLoading } = useQuery<City[]>({
    queryKey: ['/api/denial-decision/cities', selectedStateId],
    enabled: !!selectedStateId,
  });

  const { data: criteriaByCategory, isLoading: criteriaLoading } = useQuery<CriteriaByCategory>({
    queryKey: ['/api/denial-decision/criteria', selectedStateId, selectedCityId],
    enabled: !!selectedStateId,
  });

  const selectedState = useMemo(() => 
    states.find(s => s.id === selectedStateId), 
    [states, selectedStateId]
  );

  const selectedCity = useMemo(() => 
    cities.find(c => c.id === selectedCityId), 
    [cities, selectedCityId]
  );

  const generateTextMutation = useMutation({
    mutationFn: async () => {
      const selectedCriteriaIds = Array.from(criteriaPresent);
      if (selectedCriteriaIds.length === 0) {
        throw new Error("No criteria selected");
      }
      const res = await apiRequest('POST', '/api/denial-decision/generate-text', {
        criteriaIds: selectedCriteriaIds,
        stateId: selectedStateId,
        cityId: selectedCityId || undefined,
      });
      return res.json();
    },
  });

  const saveDecisionMutation = useMutation({
    mutationFn: async (data: {
      outcome: 'approve' | 'conditional' | 'deny';
      criteriaPresent: string[];
      criteriaSelected?: string[];
      generatedText?: string;
      conditions?: string[];
      noticesProvided?: string[];
    }) => {
      const res = await apiRequest('POST', '/api/denial-decision/save', {
        stateId: selectedStateId,
        cityId: selectedCityId || undefined,
        outcome: data.outcome,
        criteriaPresent: data.criteriaPresent,
        criteriaSelected: data.criteriaSelected,
        generatedText: data.generatedText,
        conditions: data.conditions,
        noticesProvided: data.noticesProvided,
        applicantName: applicantName || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Decision Saved",
        description: "Your decision has been logged to the audit trail.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save decision",
        variant: "destructive",
      });
    },
  });

  const updateCityMutation = useMutation({
    mutationFn: async (cityId: string | null) => {
      const res = await apiRequest('PATCH', '/api/user/preferred-city', { cityId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    },
  });

  const handleStateChange = (stateId: string) => {
    setSelectedStateId(stateId);
    setSelectedCityId(null);
    setCriteriaPresent(new Set());
  };

  const handleCityChange = (cityId: string | null) => {
    setSelectedCityId(cityId);
    updateCityMutation.mutate(cityId);
  };

  const toggleCriterion = (criterionId: string, status: string) => {
    if (status === 'blocked') return;
    
    setCriteriaPresent(prev => {
      const next = new Set(prev);
      if (next.has(criterionId)) {
        next.delete(criterionId);
      } else {
        next.add(criterionId);
      }
      return next;
    });
  };

  const handleDecisionSelect = (outcome: 'approve' | 'conditional' | 'deny') => {
    setDecisionOutcome(outcome);
    
    if (outcome === 'approve') {
      saveDecisionMutation.mutate({
        outcome: 'approve',
        criteriaPresent: Array.from(criteriaPresent),
      });
    } else if (outcome === 'deny') {
      generateTextMutation.mutate();
    }
  };

  const handleConditionalApprove = () => {
    saveDecisionMutation.mutate({
      outcome: 'conditional',
      criteriaPresent: Array.from(criteriaPresent),
      conditions: Array.from(selectedConditions),
    });
  };

  const handleSaveDenial = () => {
    const requiredNotices = NOTICES_REQUIRED.filter(n => n.required);
    const missingRequired = requiredNotices.filter(n => !noticesChecked.has(n.id));
    
    if (missingRequired.length > 0) {
      toast({
        title: "Required Notices",
        description: "Please confirm all required notices are included.",
        variant: "destructive",
      });
      return;
    }

    saveDecisionMutation.mutate({
      outcome: 'deny',
      criteriaPresent: Array.from(criteriaPresent),
      criteriaSelected: Array.from(criteriaPresent),
      generatedText: generateTextMutation.data?.text,
      noticesProvided: Array.from(noticesChecked),
    });
  };

  const copyDenialText = () => {
    if (generateTextMutation.data?.text) {
      navigator.clipboard.writeText(generateTextMutation.data.text);
      toast({
        title: "Copied",
        description: "Denial text copied to clipboard.",
      });
    }
  };

  const canProceedToStep2 = !!selectedStateId;
  const canProceedToStep3 = criteriaPresent.size > 0;
  const jurisdictionLabel = selectedCity 
    ? `${selectedCity.name}, ${selectedState?.name}` 
    : selectedState?.name || 'Select Location';

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <Card className="mb-4 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
        <CardContent className="py-3 px-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            This tool helps you follow fair housing and screening laws but is not legal advice. 
            Consult a qualified attorney for legal guidance specific to your situation.
          </p>
        </CardContent>
      </Card>

      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2" data-testid="text-page-title">Denial Decision Assistant</h1>
        <p className="text-muted-foreground">
          Navigate tenant screening decisions while staying compliant with fair housing laws.
        </p>
      </div>

      <div className="flex items-center gap-2 mb-6" data-testid="step-indicator">
        {[1, 2, 3, 4].map((step) => (
          <div key={step} className="flex items-center">
            <div 
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                currentStep === step 
                  ? 'bg-primary text-primary-foreground' 
                  : currentStep > step 
                    ? 'bg-green-500 text-white'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {currentStep > step ? <CheckCircle className="h-4 w-4" /> : step}
            </div>
            {step < 4 && <ChevronRight className="h-4 w-4 text-muted-foreground mx-1" />}
          </div>
        ))}
      </div>

      {selectedStateId && (
        <Card className="mb-4 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
          <CardContent className="py-3 px-4 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
              Rules for: {jurisdictionLabel}
            </span>
            <Button 
              variant="ghost" 
              size="sm" 
              className="ml-auto h-7 text-xs"
              onClick={() => setCurrentStep(1)}
              data-testid="button-change-location"
            >
              Change
            </Button>
          </CardContent>
        </Card>
      )}

      {currentStep === 1 && (
        <Card data-testid="card-step-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Step 1: Location Setup
            </CardTitle>
            <CardDescription>
              Select your state and optionally a city with specific screening rules.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">State *</label>
              <Select 
                value={selectedStateId || ''} 
                onValueChange={handleStateChange}
                disabled={statesLoading}
              >
                <SelectTrigger data-testid="select-state">
                  <SelectValue placeholder="Select a state..." />
                </SelectTrigger>
                <SelectContent>
                  {states.filter(s => s.isActive).map(state => (
                    <SelectItem key={state.id} value={state.id}>
                      {state.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedStateId && (
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  City <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <Select 
                  value={selectedCityId || 'none'} 
                  onValueChange={(v) => handleCityChange(v === 'none' ? null : v)}
                  disabled={citiesLoading}
                >
                  <SelectTrigger data-testid="select-city">
                    <SelectValue placeholder="Select a city (optional)..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No specific city</SelectItem>
                    {cities.map(city => (
                      <SelectItem key={city.id} value={city.id}>
                        {city.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Some cities have additional screening restrictions. Select your city if applicable.
                </p>
              </div>
            )}

            <div className="pt-4">
              <Button 
                onClick={() => setCurrentStep(2)} 
                disabled={!canProceedToStep2}
                data-testid="button-next-step-1"
              >
                Continue <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 2 && (
        <Card data-testid="card-step-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              Step 2: What Showed Up?
            </CardTitle>
            <CardDescription>
              Check the items that appeared in the applicant's screening report.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {criteriaLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : criteriaByCategory && Object.keys(criteriaByCategory).length > 0 ? (
              CATEGORY_ORDER.filter(cat => criteriaByCategory[cat]?.length > 0).map(category => (
                <div key={category} className="space-y-3">
                  <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                    {CATEGORY_LABELS[category] || category}
                  </h3>
                  <div className="space-y-2">
                    {criteriaByCategory[category].map(criterion => (
                      <CriterionRow
                        key={criterion.id}
                        criterion={criterion}
                        isChecked={criteriaPresent.has(criterion.id)}
                        onToggle={() => toggleCriterion(criterion.id, criterion.status)}
                      />
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No criteria configured for this jurisdiction yet.</p>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setCurrentStep(1)}
                data-testid="button-back-step-2"
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button 
                onClick={() => setCurrentStep(3)} 
                disabled={!canProceedToStep3}
                data-testid="button-next-step-2"
              >
                Continue <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 3 && (
        <Card data-testid="card-step-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Step 3: Decision Outcome
            </CardTitle>
            <CardDescription>
              Based on what showed up, what is your decision?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Button
                variant={decisionOutcome === 'approve' ? 'default' : 'outline'}
                className="h-auto py-4 flex flex-col items-center gap-2"
                onClick={() => handleDecisionSelect('approve')}
                disabled={saveDecisionMutation.isPending}
                data-testid="button-approve"
              >
                <ThumbsUp className="h-6 w-6" />
                <span className="font-semibold">Approve</span>
                <span className="text-xs opacity-70">Accept the applicant</span>
              </Button>
              
              <Button
                variant={decisionOutcome === 'conditional' ? 'default' : 'outline'}
                className="h-auto py-4 flex flex-col items-center gap-2"
                onClick={() => handleDecisionSelect('conditional')}
                disabled={saveDecisionMutation.isPending}
                data-testid="button-conditional"
              >
                <AlertTriangle className="h-6 w-6" />
                <span className="font-semibold">Conditional</span>
                <span className="text-xs opacity-70">Approve with conditions</span>
              </Button>
              
              <Button
                variant={decisionOutcome === 'deny' ? 'default' : 'outline'}
                className="h-auto py-4 flex flex-col items-center gap-2"
                onClick={() => handleDecisionSelect('deny')}
                disabled={saveDecisionMutation.isPending || generateTextMutation.isPending}
                data-testid="button-deny"
              >
                <Lock className="h-6 w-6" />
                <span className="font-semibold">Deny</span>
                <span className="text-xs opacity-70">Decline the application</span>
              </Button>
            </div>

            {decisionOutcome === 'approve' && saveDecisionMutation.isSuccess && (
              <Card className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
                <CardContent className="py-4 flex items-center gap-3">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                  <div>
                    <p className="font-medium text-green-800 dark:text-green-200">
                      Decision Logged: Approved
                    </p>
                    <p className="text-sm text-green-600 dark:text-green-400">
                      This approval has been recorded in your audit trail.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {decisionOutcome === 'conditional' && (
              <div className="space-y-4 pt-4">
                <h4 className="font-medium">Select conditions to apply:</h4>
                <div className="space-y-2">
                  {CONDITION_OPTIONS.map(condition => (
                    <label 
                      key={condition.id}
                      className="flex items-center gap-3 p-3 border rounded-md cursor-pointer hover-elevate"
                    >
                      <Checkbox
                        checked={selectedConditions.has(condition.id)}
                        onCheckedChange={(checked) => {
                          setSelectedConditions(prev => {
                            const next = new Set(prev);
                            if (checked) {
                              next.add(condition.id);
                            } else {
                              next.delete(condition.id);
                            }
                            return next;
                          });
                        }}
                        data-testid={`checkbox-condition-${condition.id}`}
                      />
                      <span className="text-sm">{condition.label}</span>
                    </label>
                  ))}
                </div>
                <Button 
                  onClick={handleConditionalApprove}
                  disabled={selectedConditions.size === 0 || saveDecisionMutation.isPending}
                  data-testid="button-save-conditional"
                >
                  {saveDecisionMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  Save Conditional Approval
                </Button>
              </div>
            )}

            {decisionOutcome === 'deny' && (
              <div className="pt-4">
                <Button 
                  onClick={() => setCurrentStep(4)}
                  disabled={generateTextMutation.isPending}
                  data-testid="button-proceed-denial"
                >
                  {generateTextMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  Generate Safe Denial <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}

            <div className="flex gap-3 pt-4 border-t">
              <Button 
                variant="outline" 
                onClick={() => setCurrentStep(2)}
                data-testid="button-back-step-3"
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 4 && (
        <Card data-testid="card-step-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Step 4: Generate Safe Denial
            </CardTitle>
            <CardDescription>
              Use this compliant denial text and ensure all required notices are included.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {generateTextMutation.isPending ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Generating denial text...</span>
              </div>
            ) : generateTextMutation.data?.text ? (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Generated Denial Text</label>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={copyDenialText}
                      data-testid="button-copy-denial"
                    >
                      <Copy className="h-4 w-4 mr-1" /> Copy
                    </Button>
                  </div>
                  <div 
                    className="p-4 bg-muted rounded-md text-sm whitespace-pre-wrap"
                    data-testid="text-denial-content"
                  >
                    {generateTextMutation.data.text}
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                    Required Notices Checklist
                  </h4>
                  <div className="space-y-2">
                    {NOTICES_REQUIRED.map(notice => (
                      <label 
                        key={notice.id}
                        className="flex items-center gap-3 p-3 border rounded-md cursor-pointer hover-elevate"
                      >
                        <Checkbox
                          checked={noticesChecked.has(notice.id)}
                          onCheckedChange={(checked) => {
                            setNoticesChecked(prev => {
                              const next = new Set(prev);
                              if (checked) {
                                next.add(notice.id);
                              } else {
                                next.delete(notice.id);
                              }
                              return next;
                            });
                          }}
                          data-testid={`checkbox-notice-${notice.id}`}
                        />
                        <span className="text-sm flex-1">{notice.label}</span>
                        {notice.required && (
                          <Badge variant="outline" className="text-xs">Required</Badge>
                        )}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button 
                    onClick={handleSaveDenial}
                    disabled={saveDecisionMutation.isPending}
                    data-testid="button-save-denial"
                  >
                    {saveDecisionMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : null}
                    Save & Log Decision
                  </Button>
                </div>

                {saveDecisionMutation.isSuccess && (
                  <Card className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
                    <CardContent className="py-4 flex items-center gap-3">
                      <CheckCircle className="h-6 w-6 text-green-600" />
                      <div>
                        <p className="font-medium text-green-800 dark:text-green-200">
                          Denial Decision Logged
                        </p>
                        <p className="text-sm text-green-600 dark:text-green-400">
                          This denial has been recorded in your audit trail with full compliance documentation.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No denial text generated. Please go back and try again.</p>
              </div>
            )}

            <div className="flex gap-3 pt-4 border-t">
              <Button 
                variant="outline" 
                onClick={() => setCurrentStep(3)}
                data-testid="button-back-step-4"
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CriterionRow({ 
  criterion, 
  isChecked, 
  onToggle 
}: { 
  criterion: CriterionWithRule; 
  isChecked: boolean; 
  onToggle: () => void;
}) {
  const isBlocked = criterion.status === 'blocked';
  const isConditional = criterion.status === 'conditional';

  return (
    <div 
      className={`flex items-start gap-3 p-3 border rounded-md ${
        isBlocked 
          ? 'bg-gray-100 dark:bg-gray-900 opacity-60 cursor-not-allowed' 
          : isConditional
            ? 'border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20'
            : 'cursor-pointer hover-elevate'
      }`}
      onClick={isBlocked ? undefined : onToggle}
      data-testid={`criterion-row-${criterion.code}`}
    >
      <Checkbox
        checked={isChecked}
        disabled={isBlocked}
        className="mt-0.5"
        data-testid={`checkbox-criterion-${criterion.code}`}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-medium ${isBlocked ? 'line-through' : ''}`}>
            {criterion.label}
          </span>
          {isBlocked && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary" className="text-xs gap-1">
                  <Lock className="h-3 w-3" /> Not Allowed
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-sm">{criterion.explanationPlain || criterion.whyItMatters || 'This criterion cannot be used for denial in this jurisdiction.'}</p>
                {criterion.legalAlternative && (
                  <p className="text-sm mt-1 text-muted-foreground">
                    Alternative: {criterion.legalAlternative}
                  </p>
                )}
              </TooltipContent>
            </Tooltip>
          )}
          {isConditional && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-xs gap-1 border-amber-400 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-3 w-3" /> Conditional
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-sm">{criterion.explanationPlain || 'This criterion requires additional steps before it can be used.'}</p>
                {criterion.requiredSteps && criterion.requiredSteps.length > 0 && (
                  <ul className="text-sm mt-1 list-disc pl-4">
                    {criterion.requiredSteps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ul>
                )}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        {criterion.description && (
          <p className="text-xs text-muted-foreground mt-1">{criterion.description}</p>
        )}
      </div>
    </div>
  );
}
