import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StateBadge } from "@/components/state-badge";
import { AlertTriangle, ExternalLink, ChevronDown, ChevronUp, BookMarked, Gavel, FileText } from "lucide-react";
import type { LegalUpdate, CaseLawMonitoring, Template } from "@shared/schema";
import { format } from "date-fns";
import { Link } from "wouter";
import { getAccessToken } from "@/lib/queryClient";

export default function LegalUpdatesPage() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [selectedState, setSelectedState] = useState<string>(user?.preferredState || "UT");
  const [expandedUpdates, setExpandedUpdates] = useState<Set<string>>(new Set());
  const [expandedCases, setExpandedCases] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  useEffect(() => {
    if (user?.preferredState && !selectedState) {
      setSelectedState(user.preferredState);
    }
  }, [user, selectedState]);

  const { data: legalUpdates, isLoading: updatesLoading, error: updatesError } = useQuery<LegalUpdate[]>({
    queryKey: ["/api/legal-updates", selectedState],
    enabled: isAuthenticated && !!selectedState,
    queryFn: async () => {
      const url = `/api/legal-updates?stateId=${selectedState}`;
      const token = getAccessToken();
      const response = await fetch(url, { 
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (!response.ok) throw new Error('Failed to fetch legal updates');
      return response.json();
    },
  });

  const { data: caseLaw, isLoading: casesLoading } = useQuery<CaseLawMonitoring[]>({
    queryKey: ["/api/case-law", selectedState],
    enabled: isAuthenticated && !!selectedState,
    queryFn: async () => {
      const url = `/api/case-law?stateId=${selectedState}`;
      const token = getAccessToken();
      const response = await fetch(url, { 
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (!response.ok) throw new Error('Failed to fetch case law');
      return response.json();
    },
  });

  const { data: states } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["/api/states"],
    enabled: isAuthenticated,
  });

  // Collect all affected template IDs from legal updates to fetch them
  const affectedTemplateIds = new Set(
    (legalUpdates || []).flatMap(update => update.affectedTemplateIds || [])
  );

  // Fetch templates for the affected template IDs
  const { data: templates } = useQuery<Template[]>({
    queryKey: ["/api/templates", selectedState, "all-categories"],
    enabled: isAuthenticated && !!selectedState && affectedTemplateIds.size > 0,
    queryFn: async () => {
      // Fetch all templates for the state (no category filter) to ensure we get all affected templates
      const url = `/api/templates?stateId=${selectedState}`;
      const token = getAccessToken();
      const response = await fetch(url, { 
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (!response.ok) return [];
      return response.json();
    },
  });

  // Helper to get template details by ID - returns template info or a fallback
  const getTemplateById = (templateId: string): { id: string; title: string } | undefined => {
    const template = templates?.find(t => t.id === templateId);
    return template ? { id: template.id, title: template.title } : undefined;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return null;

  // If trial expired (API returns 403), show only subscription CTA
  if (updatesError) {
    return (
      <div className="flex-1 overflow-auto flex items-center justify-center">
        <Card className="p-12 bg-primary/10 border-primary/20 max-w-md">
          <div className="text-center">
            <Gavel className="h-16 w-16 text-primary mx-auto mb-6" />
            <h2 className="text-2xl font-display font-semibold text-foreground mb-3">
              Subscribe to receive updates
            </h2>
            <p className="text-muted-foreground mb-8">
              Get real-time legal updates and court decisions affecting landlords in your state
            </p>
            <Link to="/subscribe">
              <Button size="lg" data-testid="button-subscribe-legal-updates-cta">
                Subscribe Now
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const getImpactBadge = (level: string) => {
    switch (level) {
      case "high":
        return <Badge variant="destructive" className="text-xs">High Impact</Badge>;
      case "medium":
        return <Badge variant="default" className="text-xs">Medium Impact</Badge>;
      case "low":
        return <Badge variant="secondary" className="text-xs">Low Impact</Badge>;
      default:
        return null;
    }
  };

  const toggleUpdateExpanded = (id: string) => {
    const newExpanded = new Set(expandedUpdates);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedUpdates(newExpanded);
  };

  const toggleCaseExpanded = (id: string) => {
    const newExpanded = new Set(expandedCases);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedCases(newExpanded);
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-display font-semibold text-foreground mb-2">
            Legal Updates
          </h1>
          <p className="text-muted-foreground">
            Recent legislative changes and court decisions affecting landlord-tenant law
          </p>
        </div>

        {/* Legal Disclaimer */}
        <div className="mb-8 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-foreground">
                <strong>Not Legal Advice:</strong> This information is educational only. Always verify current requirements with local authorities or consult a licensed attorney. <Link to="/disclaimers" className="text-primary hover:underline">Read full disclaimers</Link>
              </p>
            </div>
          </div>
        </div>

        {/* State Selector */}
        {states && states.length > 1 && (
          <div className="mb-8 flex flex-wrap gap-2">
            <Button
              variant={selectedState === "NATIONAL" ? "default" : "outline"}
              onClick={() => setSelectedState("NATIONAL")}
              data-testid="button-state-NATIONAL"
              size="sm"
            >
              All States
            </Button>
            {states.map((state) => (
              <Button
                key={state.id}
                variant={selectedState === state.id ? "default" : "outline"}
                onClick={() => setSelectedState(state.id)}
                data-testid={`button-state-${state.id}`}
                size="sm"
              >
                {state.name}
              </Button>
            ))}
          </div>
        )}

        <Tabs defaultValue="recent" className="space-y-6" data-testid="tabs-legal-updates">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="recent" data-testid="tab-recent-updates">Recent Updates ({(legalUpdates?.length || 0) + (caseLaw?.length || 0)})</TabsTrigger>
            <TabsTrigger value="case-law" data-testid="tab-case-law">Court Decisions ({caseLaw?.length || 0})</TabsTrigger>
          </TabsList>

          {/* Recent Updates Tab */}
          <TabsContent value="recent" className="space-y-4">
            {updatesLoading || casesLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin w-6 h-6 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : (
              <>
                {/* Legal Updates */}
                {legalUpdates && legalUpdates.length > 0 ? (
                  <div className="space-y-4 mb-8">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <BookMarked className="h-5 w-5" />
                      Legislative Changes
                    </h3>
                    {legalUpdates.map((update) => (
                      <Card key={update.id} className="overflow-hidden" data-testid={`card-legal-update-${update.id}`}>
                        <button
                          onClick={() => toggleUpdateExpanded(update.id)}
                          className="w-full p-4 text-left hover-elevate transition-colors"
                          data-testid={`button-expand-update-${update.id}`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-start gap-2 mb-1 flex-wrap">
                                <h3 className="font-semibold text-foreground">{update.title}</h3>
                                {(update as any).isNewest && (
                                  <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-white" data-testid={`badge-new-${update.id}`}>
                                    New
                                  </Badge>
                                )}
                                {getImpactBadge(update.impactLevel)}
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-2">{update.summary}</p>
                              {update.effectiveDate && (
                                <p className="text-xs text-muted-foreground mt-2">
                                  Effective: {format(new Date(update.effectiveDate), "MMMM d, yyyy")}
                                </p>
                              )}
                            </div>
                            <div className="flex-shrink-0">
                              {expandedUpdates.has(update.id) ? (
                                <ChevronUp className="h-5 w-5 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-5 w-5 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                        </button>
                        {expandedUpdates.has(update.id) && (
                          <div className="px-4 pb-4 border-t space-y-4" data-testid={`expanded-update-${update.id}`}>
                            <div>
                              <h4 className="font-semibold text-sm mb-2">Why It Matters</h4>
                              <p className="text-sm text-muted-foreground">{update.whyItMatters}</p>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                              <div>
                                <h4 className="font-semibold text-sm mb-2 text-amber-600">Before</h4>
                                <p className="text-sm text-muted-foreground">{update.beforeText}</p>
                              </div>
                              <div>
                                <h4 className="font-semibold text-sm mb-2 text-green-600">After</h4>
                                <p className="text-sm text-muted-foreground">{update.afterText}</p>
                              </div>
                            </div>
                            {/* View Updated Templates section */}
                            {update.affectedTemplateIds && update.affectedTemplateIds.length > 0 && (
                              <div className="pt-2">
                                <h4 className="font-semibold text-sm mb-3">Updated Documents</h4>
                                <div className="flex flex-wrap gap-2">
                                  {update.affectedTemplateIds.map((templateId) => {
                                    const template = getTemplateById(templateId);
                                    if (!template) return null;
                                    return (
                                      <Link key={templateId} to={`/templates?highlight=${templateId}`}>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="gap-2"
                                          data-testid={`button-view-template-${templateId}`}
                                        >
                                          <FileText className="h-4 w-4" />
                                          {template.title.replace(` (${update.stateId})`, '')}
                                        </Button>
                                      </Link>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>
                ) : null}

                {/* Case Law */}
                {caseLaw && caseLaw.length > 0 ? (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <Gavel className="h-5 w-5" />
                      Court Decisions
                    </h3>
                    {caseLaw.map((caseItem) => (
                      <Card key={caseItem.id} className="overflow-hidden" data-testid={`card-case-${caseItem.id}`}>
                        <button
                          onClick={() => toggleCaseExpanded(caseItem.id)}
                          className="w-full p-4 text-left hover-elevate transition-colors"
                          data-testid={`button-expand-case-${caseItem.id}`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-start gap-2 mb-1">
                                <h3 className="font-semibold text-foreground line-clamp-2">{caseItem.caseName}</h3>
                                {caseItem.relevanceLevel && getImpactBadge(caseItem.relevanceLevel)}
                              </div>
                              <p className="text-sm text-muted-foreground">{caseItem.citation}</p>
                              {caseItem.dateFiled && (
                                <p className="text-xs text-muted-foreground mt-2">
                                  {caseItem.court} • {format(new Date(caseItem.dateFiled), "MMMM d, yyyy")}
                                </p>
                              )}
                            </div>
                            <div className="flex-shrink-0">
                              {expandedCases.has(caseItem.id) ? (
                                <ChevronUp className="h-5 w-5 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-5 w-5 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                        </button>
                        {expandedCases.has(caseItem.id) && (
                          <div className="px-4 pb-4 border-t space-y-4" data-testid={`expanded-case-${caseItem.id}`}>
                            {caseItem.aiAnalysis && (
                              <div>
                                <h4 className="font-semibold text-sm mb-2">What This Means for Landlords</h4>
                                <p className="text-sm text-muted-foreground">{caseItem.aiAnalysis}</p>
                              </div>
                            )}
                            {caseItem.url && (
                              <Button
                                variant="outline"
                                size="sm"
                                asChild
                                data-testid={`button-read-case-${caseItem.id}`}
                              >
                                <a href={caseItem.url} target="_blank" rel="noopener noreferrer">
                                  Read Full Case <ExternalLink className="h-3 w-3 ml-2" />
                                </a>
                              </Button>
                            )}
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>
                ) : null}

                {!legalUpdates?.length && !caseLaw?.length && (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">No legal updates for {states?.find(s => s.id === selectedState)?.name} yet.</p>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* Case Law Only Tab */}
          <TabsContent value="case-law" className="space-y-4">
            {casesLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin w-6 h-6 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : caseLaw && caseLaw.length > 0 ? (
              <div className="space-y-4">
                {caseLaw.map((caseItem) => (
                  <Card key={caseItem.id} className="overflow-hidden" data-testid={`card-case-detail-${caseItem.id}`}>
                    <button
                      onClick={() => toggleCaseExpanded(caseItem.id)}
                      className="w-full p-4 text-left hover-elevate transition-colors"
                      data-testid={`button-expand-case-detail-${caseItem.id}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-start gap-2 mb-1">
                            <h3 className="font-semibold text-foreground line-clamp-2">{caseItem.caseName}</h3>
                            {caseItem.relevanceLevel && getImpactBadge(caseItem.relevanceLevel)}
                          </div>
                          <p className="text-sm text-muted-foreground">{caseItem.citation}</p>
                          {caseItem.dateFiled && (
                            <p className="text-xs text-muted-foreground mt-2">
                              {caseItem.court} • {format(new Date(caseItem.dateFiled), "MMMM d, yyyy")}
                            </p>
                          )}
                        </div>
                        <div className="flex-shrink-0">
                          {expandedCases.has(caseItem.id) ? (
                            <ChevronUp className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </button>
                    {expandedCases.has(caseItem.id) && (
                      <div className="px-4 pb-4 border-t space-y-4" data-testid={`expanded-case-detail-${caseItem.id}`}>
                        {caseItem.aiAnalysis && (
                          <div>
                            <h4 className="font-semibold text-sm mb-2">What This Means for Landlords</h4>
                            <p className="text-sm text-muted-foreground">{caseItem.aiAnalysis}</p>
                          </div>
                        )}
                        {caseItem.url && (
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                            data-testid={`button-read-case-detail-${caseItem.id}`}
                          >
                            <a href={caseItem.url} target="_blank" rel="noopener noreferrer">
                              Read Full Case on CourtListener <ExternalLink className="h-3 w-3 ml-2" />
                            </a>
                          </Button>
                        )}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No court decisions for {states?.find(s => s.id === selectedState)?.name} yet.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
