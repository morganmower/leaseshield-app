import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { State, City, County } from "@shared/schema";
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
  Eye,
  Download,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

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

const NOTICES_AUTO_INCLUDED = [
  { id: 'adverse_action', label: 'Adverse Action Notice' },
  { id: 'credit_report_source', label: 'Credit reporting agency contact info' },
  { id: 'dispute_rights', label: 'Right to dispute information' },
];

export default function DenialDecisionAssistant() {
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  
  const [selectedStateId, setSelectedStateId] = useState<string | null>(user?.preferredState || null);
  const [selectedCityId, setSelectedCityId] = useState<string | null>(user?.preferredCity || null);
  const [selectedCountyId, setSelectedCountyId] = useState<string | null>(null);
  const [criteriaPresent, setCriteriaPresent] = useState<Set<string>>(new Set());
  const [decisionOutcome, setDecisionOutcome] = useState<'approve' | 'conditional' | 'deny' | null>(null);
  const [selectedConditions, setSelectedConditions] = useState<Set<string>>(new Set());
  const [decisionSaved, setDecisionSaved] = useState(false);
  const [applicantName, setApplicantName] = useState('');
  const [applicantAddress, setApplicantAddress] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [usedConsumerReport, setUsedConsumerReport] = useState(false);

  const { data: states = [], isLoading: statesLoading } = useQuery<State[]>({
    queryKey: ['/api/states'],
    enabled: true,
  });

  const { data: cities = [], isLoading: citiesLoading } = useQuery<City[]>({
    queryKey: ['/api/denial-decision/cities', selectedStateId],
    queryFn: async () => {
      if (!selectedStateId) return [];
      const res = await apiRequest('GET', `/api/denial-decision/cities?stateId=${selectedStateId}`);
      return res.json();
    },
    enabled: !!selectedStateId,
  });

  const { data: counties = [], isLoading: countiesLoading } = useQuery<County[]>({
    queryKey: ['/api/denial-decision/counties', selectedStateId],
    queryFn: async () => {
      if (!selectedStateId) return [];
      const res = await apiRequest('GET', `/api/denial-decision/counties?stateId=${selectedStateId}`);
      return res.json();
    },
    enabled: !!selectedStateId,
  });

  const { data: criteriaByCategory, isLoading: criteriaLoading } = useQuery<CriteriaByCategory>({
    queryKey: ['/api/denial-decision/criteria', selectedStateId, selectedCityId, selectedCountyId],
    queryFn: async () => {
      if (!selectedStateId) return {};
      const params = new URLSearchParams({ stateId: selectedStateId });
      if (selectedCityId) params.set('cityId', selectedCityId);
      if (selectedCountyId) params.set('countyId', selectedCountyId);
      const res = await apiRequest('GET', `/api/denial-decision/criteria?${params.toString()}`);
      return res.json();
    },
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

  const selectedCounty = useMemo(() => 
    counties.find(c => c.id === selectedCountyId), 
    [counties, selectedCountyId]
  );

  const hasLocalRules = !!selectedCityId || !!selectedCountyId;

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
        countyId: selectedCountyId || undefined,
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
    setSelectedCountyId(null);
    setCriteriaPresent(new Set());
  };

  const handleCountyChange = (countyId: string | null) => {
    setSelectedCountyId(countyId);
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

  const autoSaveDenialDecision = () => {
    if (decisionSaved) return;
    
    saveDecisionMutation.mutate({
      outcome: 'deny',
      criteriaPresent: Array.from(criteriaPresent),
      criteriaSelected: Array.from(criteriaPresent),
      generatedText: generateTextMutation.data?.text,
      noticesProvided: NOTICES_AUTO_INCLUDED.map(n => n.id),
    }, {
      onSuccess: () => {
        setDecisionSaved(true);
      }
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

  const handleDownloadLetter = async (letterType: 'pre-adverse' | 'adverse' | 'denial') => {
    if (!generateTextMutation.data?.text) return;
    
    autoSaveDenialDecision();
    
    setIsDownloading(true);
    try {
      const res = await apiRequest('POST', '/api/denial-decision/adverse-action-letter', {
        applicantName: applicantName || 'Applicant',
        applicantAddress: applicantAddress || '',
        stateId: selectedStateId,
        cityId: selectedCityId || undefined,
        countyId: selectedCountyId || undefined,
        denialReasons: generateTextMutation.data.text,
        criteriaIds: Array.from(criteriaPresent),
        isFcra: usedConsumerReport,
        letterType: letterType,
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: 'Failed to generate letter' }));
        throw new Error(errorData.message || 'Failed to generate the letter');
      }
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const filenames: Record<string, string> = {
        'pre-adverse': `pre-adverse-action-notice-${new Date().toISOString().split('T')[0]}.pdf`,
        'adverse': `adverse-action-letter-${new Date().toISOString().split('T')[0]}.pdf`,
        'denial': `denial-notice-${new Date().toISOString().split('T')[0]}.pdf`,
      };
      a.download = filenames[letterType];
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      
      const titles: Record<string, string> = {
        'pre-adverse': 'Pre-Adverse Action Notice Downloaded',
        'adverse': 'Adverse Action Letter Downloaded',
        'denial': 'Denial Notice Downloaded',
      };
      toast({
        title: titles[letterType],
        description: "Decision saved to your audit trail.",
      });
    } catch (error: any) {
      toast({
        title: "Download Failed",
        description: error.message || "Failed to generate the letter",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadAdverseAction = () => handleDownloadLetter(usedConsumerReport ? 'adverse' : 'denial');

  const canProceedToStep2 = !!selectedStateId;
  const canProceedToStep3 = criteriaPresent.size > 0;
  
  const jurisdictionParts: string[] = [];
  if (selectedCity) jurisdictionParts.push(selectedCity.name);
  if (selectedCounty) jurisdictionParts.push(selectedCounty.name);
  if (selectedState) jurisdictionParts.push(selectedState.name);
  const jurisdictionLabel = jurisdictionParts.length > 0 
    ? jurisdictionParts.join(', ') 
    : 'Select Location';

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

      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold mb-2" data-testid="text-page-title">Denial Decision Assistant</h1>
          <p className="text-muted-foreground">
            Navigate tenant screening decisions while staying compliant with fair housing laws.
          </p>
        </div>
        <Link href="/audit-history">
          <Button variant="outline" size="sm" data-testid="button-view-history">
            <ClipboardCheck className="h-4 w-4 mr-1" /> View History
          </Button>
        </Link>
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

            {selectedStateId && counties.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  County <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <Select 
                  value={selectedCountyId || 'none'} 
                  onValueChange={(v) => handleCountyChange(v === 'none' ? null : v)}
                  disabled={countiesLoading}
                >
                  <SelectTrigger data-testid="select-county">
                    <SelectValue placeholder="Select a county (optional)..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No specific county</SelectItem>
                    {counties.map(county => (
                      <SelectItem key={county.id} value={county.id}>
                        {county.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Some counties have their own Fair Chance Housing or Source of Income protections.
                </p>
              </div>
            )}

            {hasLocalRules && (
              <Card className="border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-950/30">
                <CardContent className="py-3 px-4 flex items-start gap-3">
                  <Shield className="h-5 w-5 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-purple-800 dark:text-purple-200">
                      Local Rules Apply
                    </p>
                    <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                      {selectedCity?.name || selectedCounty?.name} has additional screening restrictions 
                      that may limit which denial reasons you can use.
                    </p>
                  </div>
                </CardContent>
              </Card>
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
              Check what appeared in the screening report. We'll tell you what you can and cannot use as a denial reason in your location.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {hasLocalRules && (
              <Card className="border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-950/30">
                <CardContent className="py-3 px-4 flex items-start gap-3">
                  <Shield className="h-5 w-5 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-purple-800 dark:text-purple-200">
                      Local Rules Apply
                    </p>
                    <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                      {selectedCity?.name || selectedCounty?.name} has additional screening restrictions.
                      Items marked with <Lock className="h-3 w-3 inline mx-1" /> cannot be used as denial reasons.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
            
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
              Use this compliant denial text and ensure all required notices are included. If a consumer report was used, you can download the required adverse action letter.
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
                  <h4 className="font-medium">Applicant Information (for adverse action letter)</h4>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-sm text-muted-foreground">Applicant Name</label>
                      <input
                        type="text"
                        value={applicantName}
                        onChange={(e) => setApplicantName(e.target.value)}
                        placeholder="Full name"
                        className="w-full px-3 py-2 border rounded-md text-sm"
                        data-testid="input-applicant-name"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm text-muted-foreground">Applicant Address</label>
                      <input
                        type="text"
                        value={applicantAddress}
                        onChange={(e) => setApplicantAddress(e.target.value)}
                        placeholder="Street, City, State ZIP"
                        className="w-full px-3 py-2 border rounded-md text-sm"
                        data-testid="input-applicant-address"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Required Notices (Automatically Included)
                  </h4>
                  <div className="space-y-2">
                    {NOTICES_AUTO_INCLUDED.map(notice => (
                      <div 
                        key={notice.id}
                        className="flex items-center gap-3 p-3 border rounded-md bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                        data-testid={`notice-auto-${notice.id}`}
                      >
                        <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <span className="text-sm">{notice.label}</span>
                      </div>
                    ))}
                  </div>
                  
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <div className="flex items-center justify-between p-3 border rounded-md">
                    <label htmlFor="consumer-report-toggle" className="text-sm cursor-pointer">
                      <span className="font-medium">Did you use a consumer report?</span>
                      <span className="text-muted-foreground block mt-0.5">
                        (credit, criminal, or eviction report from a screening provider)
                      </span>
                    </label>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm ${!usedConsumerReport ? 'font-medium' : 'text-muted-foreground'}`}>No</span>
                      <Switch
                        id="consumer-report-toggle"
                        checked={usedConsumerReport}
                        onCheckedChange={setUsedConsumerReport}
                        data-testid="switch-consumer-report"
                      />
                      <span className={`text-sm ${usedConsumerReport ? 'font-medium' : 'text-muted-foreground'}`}>Yes</span>
                    </div>
                  </div>

                  {usedConsumerReport ? (
                    <div className="space-y-3">
                      <Button
                        onClick={handleDownloadAdverseAction}
                        disabled={!generateTextMutation.data?.text || isDownloading}
                        className="w-full"
                        data-testid="button-download-adverse-action"
                      >
                        {isDownloading ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <FileText className="h-4 w-4 mr-2" />
                        )}
                        Download Adverse Action Letter
                      </Button>
                      
                      <div className="text-center">
                        <button
                          onClick={() => handleDownloadLetter('pre-adverse')}
                          disabled={!generateTextMutation.data?.text || isDownloading}
                          className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          data-testid="link-download-pre-adverse"
                        >
                          Optional: Download Pre-Adverse Notice
                        </button>
                        <p className="text-xs text-muted-foreground mt-1">
                          Use this if your decision is not final and you want to give the applicant a chance to dispute report information.
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 italic">
                          Note: Your decision details above are saved to your audit trail. The Pre-Adverse letter uses tentative language (e.g., "may not meet criteria") for FCRA compliance.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <Button
                      onClick={() => handleDownloadLetter('denial')}
                      disabled={!generateTextMutation.data?.text || isDownloading}
                      data-testid="button-download-denial-notice"
                    >
                      {isDownloading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <FileText className="h-4 w-4 mr-2" />
                      )}
                      Download Denial Notice
                    </Button>
                  )}
                  
                  {decisionSaved && (
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Decision saved automatically for your records
                    </p>
                  )}
                </div>

                {decisionSaved && (
                  <Card className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
                    <CardContent className="py-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="h-6 w-6 text-green-600" />
                        <div>
                          <p className="font-medium text-green-800 dark:text-green-200">
                            Denial Decision Logged
                          </p>
                          <p className="text-sm text-green-600 dark:text-green-400">
                            This denial has been recorded in your audit trail.
                          </p>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-green-200 dark:border-green-700">
                        <p className="text-sm text-green-700 dark:text-green-300">
                          <span className="font-medium">What this means:</span> This record shows which rules applied, what information you relied on, and the exact notice provided — in case the decision is ever questioned.
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
                <Badge variant="secondary" className="text-xs gap-1 bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400">
                  <Lock className="h-3 w-3" /> Not Allowed
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-sm font-medium mb-1">You cannot use this for denial</p>
                <p className="text-sm">{criterion.explanationPlain || criterion.whyItMatters || 'This criterion cannot be used for denial in this jurisdiction.'}</p>
                {criterion.legalAlternative && (
                  <p className="text-sm mt-2 text-muted-foreground">
                    <strong>Alternative:</strong> {criterion.legalAlternative}
                  </p>
                )}
              </TooltipContent>
            </Tooltip>
          )}
          {isConditional && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-xs gap-1 border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                  <AlertTriangle className="h-3 w-3" /> Extra Steps Required (we'll guide you)
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-sm font-medium mb-1">Allowed, but extra steps required</p>
                <p className="text-sm">{criterion.explanationPlain || 'This criterion requires additional steps before it can be used.'}</p>
                {criterion.requiredSteps && criterion.requiredSteps.length > 0 && (
                  <ul className="text-sm mt-2 list-disc pl-4">
                    {criterion.requiredSteps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ul>
                )}
              </TooltipContent>
            </Tooltip>
          )}
          {!isBlocked && !isConditional && (
            <Badge variant="outline" className="text-xs gap-1 border-green-400 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400">
              <CheckCircle className="h-3 w-3" /> Allowed (if consistent with your criteria)
            </Badge>
          )}
        </div>
        {criterion.description && (
          <p className="text-xs text-muted-foreground mt-1">{criterion.description}</p>
        )}
      </div>
    </div>
  );
}
