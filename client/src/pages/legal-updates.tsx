import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StateBadge } from "@/components/state-badge";
import { AlertTriangle, ExternalLink, ChevronDown, ChevronUp, BookMarked, Gavel, FileText, Home, Clock, CheckCircle, ListTodo, Calendar, Building2, ArrowUpDown, Flame, CalendarDays } from "lucide-react";
import type { LegalUpdate, CaseLawMonitoring, Template } from "@shared/schema";
import { format } from "date-fns";
import { Link } from "wouter";
import { getAccessToken } from "@/lib/queryClient";
import { SEO } from "@/components/seo";

export default function LegalUpdatesPage() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [selectedState, setSelectedState] = useState<string>(user?.preferredState || "UT");
  const [expandedUpdates, setExpandedUpdates] = useState<Set<string>>(new Set());
  const [expandedCases, setExpandedCases] = useState<Set<string>>(new Set());
  const [sortOrder, setSortOrder] = useState<'newest' | 'impact'>('newest');

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

  const isTribalUpdate = (update: LegalUpdate) => {
    const category = (update as any).category;
    if (category === 'tribal') return true;
    if (category === 'section8') {
      const title = update.title.toLowerCase();
      return title.includes('tribal') || title.includes('tribe') || title.includes('indian') || title.includes('native american') || title.includes('tiac');
    }
    return false;
  };

  const impactRank: Record<string, number> = { high: 0, medium: 1, low: 2 };

  const sortedLegalUpdates = [...(legalUpdates || [])].sort((a, b) => {
    if (sortOrder === 'impact') {
      const rankA = impactRank[a.impactLevel] ?? 3;
      const rankB = impactRank[b.impactLevel] ?? 3;
      if (rankA !== rankB) return rankA - rankB;
    }
    // Newest first (default and tiebreaker for impact sort)
    const dateA = a.effectiveDate ? new Date(a.effectiveDate).getTime() : new Date(a.createdAt).getTime();
    const dateB = b.effectiveDate ? new Date(b.effectiveDate).getTime() : new Date(b.createdAt).getTime();
    return dateB - dateA;
  });

  // Tribal Housing updates - category='tribal' plus tribal-named section8 entries
  const tribalUpdates = (legalUpdates || []).filter(isTribalUpdate);

  // Section 8 / HUD specific updates (exclude items already in tribal tab)
  const section8Updates = (legalUpdates || []).filter(
    update => (update as any).category === 'section8' && !isTribalUpdate(update)
  );

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

  const getSourceBadge = (update: LegalUpdate) => {
    const category = (update as any).category;
    const stateId = update.stateId;

    // Tribal Housing items
    if (category === 'tribal' || isTribalUpdate(update)) {
      return (
        <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 text-xs">
          Tribal Housing
        </Badge>
      );
    }
    
    // Section 8 / HUD specific items
    if (category === 'section8') {
      return (
        <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 text-xs">
          Section 8 / HUD
        </Badge>
      );
    }
    
    // Federal (non-Section 8)
    if (stateId === 'US') {
      return (
        <Badge variant="outline" className="bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 text-xs">
          Federal
        </Badge>
      );
    }
    
    // State-specific
    if (stateId) {
      return <StateBadge stateId={stateId} />;
    }
    
    return null;
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
      <SEO
        title="Legal Updates - New Landlord-Tenant Laws & Case Law"
        description="Track new statutes, regulations, and court decisions affecting landlords across 16 US states. Plain-English summaries with source citations."
        canonical="/legal-updates"
      />
      {/* Hero Header */}
      <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-b">
        <div className="container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-primary/10 rounded-md">
                <Gavel className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-display font-semibold text-foreground mb-1">
                  Legal Updates
                </h1>
                <p className="text-sm sm:text-base text-muted-foreground">
                  New legislation and court decisions affecting landlord-tenant law.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div>
                <p className="text-2xl font-semibold text-foreground tabular-nums" data-testid="text-updates-count">
                  {legalUpdates?.length ?? 0}
                </p>
                <p className="text-xs text-muted-foreground">Updates</p>
              </div>
              <div className="h-10 w-px bg-border" />
              <div>
                <p className="text-2xl font-semibold text-foreground tabular-nums" data-testid="text-cases-count">
                  {caseLaw?.length ?? 0}
                </p>
                <p className="text-xs text-muted-foreground">Court decisions</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Legal Disclaimer - Compact */}
        <div className="mb-6 bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200/50 dark:border-amber-800/50 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">Educational only:</strong> Verify current requirements with local authorities or a licensed attorney.
              <Link to="/disclaimers" className="text-primary hover:underline ml-1">Full disclaimers</Link>
            </p>
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

        {/* Sort Toggle */}
        <div className="flex items-center gap-2 mb-4">
          <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Sort by:</span>
          <Button
            size="sm"
            variant={sortOrder === 'newest' ? 'default' : 'outline'}
            onClick={() => setSortOrder('newest')}
            data-testid="button-sort-newest"
            className="gap-1"
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Most Recent
          </Button>
          <Button
            size="sm"
            variant={sortOrder === 'impact' ? 'default' : 'outline'}
            onClick={() => setSortOrder('impact')}
            data-testid="button-sort-impact"
            className="gap-1"
          >
            <Flame className="h-3.5 w-3.5" />
            Highest Impact
          </Button>
        </div>

        <Tabs defaultValue="recent" className="space-y-6" data-testid="tabs-legal-updates">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="recent" data-testid="tab-recent-updates">Recent Updates ({(legalUpdates?.length || 0) + (caseLaw?.length || 0)})</TabsTrigger>
            <TabsTrigger value="section8" data-testid="tab-section8">Section 8 / HUD ({section8Updates.length})</TabsTrigger>
            <TabsTrigger value="tribal" data-testid="tab-tribal">Tribal Housing ({tribalUpdates.length})</TabsTrigger>
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
                {sortedLegalUpdates.length > 0 ? (
                  <div className="space-y-4 mb-8">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <BookMarked className="h-5 w-5" />
                      Legislative Changes
                    </h3>
                    {sortedLegalUpdates.map((update) => (
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
                                {getSourceBadge(update)}
                                {(update as any).isRecent && (
                                  <Badge variant="default" className="bg-green-600 text-white text-xs" data-testid={`badge-new-${update.id}`}>
                                    New
                                  </Badge>
                                )}
                                {getImpactBadge(update.impactLevel)}
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-2">{update.summary}</p>
                              <div className="flex items-center gap-3 mt-2 flex-wrap">
                                {update.effectiveDate && (
                                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    Effective: {format(new Date(update.effectiveDate), "MMM d, yyyy")}
                                  </p>
                                )}
                                {update.createdAt && (
                                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    Added: {format(new Date(update.createdAt), "MMM d, yyyy")}
                                  </p>
                                )}
                              </div>
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
                            {/* Status & Timeline Row */}
                            {((update as any).billStatus || (update as any).expectedTimeline || update.effectiveDate) && (
                              <div className="flex flex-wrap gap-4 py-2 bg-muted/30 rounded-lg px-3">
                                {(update as any).billStatus && (update as any).billStatus !== 'unknown' && (
                                  <div className="flex items-center gap-2">
                                    <CheckCircle className="h-4 w-4 text-primary" />
                                    <span className="text-sm">
                                      <span className="text-muted-foreground">Status:</span>{' '}
                                      <span className="font-medium capitalize">{(update as any).billStatus.replace(/_/g, ' ')}</span>
                                    </span>
                                  </div>
                                )}
                                {update.effectiveDate && (
                                  <div className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-primary" />
                                    <span className="text-sm">
                                      <span className="text-muted-foreground">Effective:</span>{' '}
                                      <span className="font-medium">{format(new Date(update.effectiveDate), "MMMM d, yyyy")}</span>
                                    </span>
                                  </div>
                                )}
                                {(update as any).expectedTimeline && (
                                  <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm text-muted-foreground">{(update as any).expectedTimeline}</span>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Why It Matters */}
                            <div>
                              <h4 className="font-semibold text-sm mb-2">Why It Matters</h4>
                              <p className="text-sm text-muted-foreground">{update.whyItMatters}</p>
                            </div>

                            {/* Before/After Comparison */}
                            {(update.beforeText && !update.beforeText.includes('Previous regulations applied')) || 
                             (update.afterText && !update.afterText.includes('New requirements may be')) ? (
                              <div className="grid gap-4 md:grid-cols-2">
                                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                                  <h4 className="font-semibold text-sm mb-2 text-amber-700 dark:text-amber-400 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                                    Before
                                  </h4>
                                  <p className="text-sm text-muted-foreground">{update.beforeText}</p>
                                </div>
                                <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                                  <h4 className="font-semibold text-sm mb-2 text-green-700 dark:text-green-400 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-green-500" />
                                    After
                                  </h4>
                                  <p className="text-sm text-muted-foreground">{update.afterText}</p>
                                </div>
                              </div>
                            ) : (
                              <div>
                                <h4 className="font-semibold text-sm mb-2">Summary</h4>
                                <p className="text-sm text-muted-foreground">{update.summary || update.title}</p>
                              </div>
                            )}

                            {/* Action Items */}
                            {(update as any).actionItems && (
                              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                                <h4 className="font-semibold text-sm mb-2 text-blue-700 dark:text-blue-400 flex items-center gap-2">
                                  <ListTodo className="h-4 w-4" />
                                  What You Should Do
                                </h4>
                                {(() => {
                                  const items = (update as any).actionItems;
                                  try {
                                    const parsed = JSON.parse(items);
                                    if (Array.isArray(parsed)) {
                                      return (
                                        <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                                          {parsed.map((item: string, idx: number) => (
                                            <li key={idx}>{item}</li>
                                          ))}
                                        </ul>
                                      );
                                    }
                                  } catch {}
                                  return <p className="text-sm text-muted-foreground">{items}</p>;
                                })()}
                              </div>
                            )}

                            {/* Source Link */}
                            {(update as any).sourceUrl && (
                              <Button
                                variant="outline"
                                size="sm"
                                asChild
                                data-testid={`button-source-${update.id}`}
                              >
                                <a href={(update as any).sourceUrl} target="_blank" rel="noopener noreferrer">
                                  View Source <ExternalLink className="h-3 w-3 ml-2" />
                                </a>
                              </Button>
                            )}

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
                              <div className="flex items-start gap-2 mb-1 flex-wrap">
                                <h3 className="font-semibold text-foreground line-clamp-2">{caseItem.caseName}</h3>
                                {caseItem.stateId && (
                                  <StateBadge stateId={caseItem.stateId} />
                                )}
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

          {/* Section 8 / HUD Tab */}
          <TabsContent value="section8" className="space-y-4">
            {updatesLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin w-6 h-6 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : section8Updates.length > 0 ? (
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <Home className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm text-foreground">
                        <strong>Section 8 & HUD Updates:</strong> These updates specifically affect Housing Choice Voucher (Section 8) properties, subsidized housing, and HUD-regulated rentals.
                      </p>
                    </div>
                  </div>
                </div>
                {section8Updates.map((update) => (
                  <Card key={update.id} className="overflow-hidden" data-testid={`card-section8-${update.id}`}>
                    <button
                      onClick={() => toggleUpdateExpanded(update.id)}
                      className="w-full p-4 text-left hover-elevate transition-colors"
                      data-testid={`button-expand-section8-${update.id}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-start gap-2 mb-1 flex-wrap">
                            <h3 className="font-semibold text-foreground line-clamp-2">{update.title}</h3>
                            {getSourceBadge(update)}
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
                      <div className="px-4 pb-4 border-t space-y-4" data-testid={`expanded-section8-${update.id}`}>
                        <div>
                          <h4 className="font-semibold text-sm mb-2">Why This Matters</h4>
                          <p className="text-sm text-muted-foreground">{update.whyItMatters}</p>
                        </div>

                        {/* Before/After Comparison */}
                        {(update.beforeText && !update.beforeText.includes('Previous regulations applied')) ||
                         (update.afterText && !update.afterText.includes('New requirements may be')) ? (
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                              <h4 className="font-semibold text-sm mb-2 text-amber-700 dark:text-amber-400 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-amber-500" />
                                Before
                              </h4>
                              <p className="text-sm text-muted-foreground">{update.beforeText}</p>
                            </div>
                            <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                              <h4 className="font-semibold text-sm mb-2 text-green-700 dark:text-green-400 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-green-500" />
                                After
                              </h4>
                              <p className="text-sm text-muted-foreground">{update.afterText}</p>
                            </div>
                          </div>
                        ) : null}

                        {update.affectedTemplateIds && update.affectedTemplateIds.length > 0 && (
                          <div>
                            <h4 className="font-semibold text-sm mb-2">Affected Documents</h4>
                            <div className="flex flex-wrap gap-2">
                              {update.affectedTemplateIds.map((templateId) => {
                                const template = getTemplateById(templateId);
                                return template ? (
                                  <Link key={templateId} to={`/templates?id=${templateId}`}>
                                    <Badge variant="outline" className="cursor-pointer hover:bg-muted">
                                      <FileText className="h-3 w-3 mr-1" />
                                      {template.title}
                                    </Badge>
                                  </Link>
                                ) : null;
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Home className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No Section 8 or HUD updates for {selectedState === "NATIONAL" ? "any state" : states?.find(s => s.id === selectedState)?.name} yet.</p>
                <p className="text-sm text-muted-foreground mt-2">Check back regularly for updates affecting housing voucher properties.</p>
              </div>
            )}
          </TabsContent>

          {/* Tribal Housing Tab */}
          <TabsContent value="tribal" className="space-y-4">
            {updatesLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin w-6 h-6 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : tribalUpdates.length > 0 ? (
              <div className="space-y-4">
                <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <Building2 className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm text-foreground">
                        <strong>Tribal Housing Updates:</strong> These updates affect Tribal Housing Authorities, Native American Housing Assistance and Self-Determination Act (NAHASDA) programs, Tribal HUD-VASH, and Section 184 Indian Housing Loan Guarantee programs.
                      </p>
                    </div>
                  </div>
                </div>
                {tribalUpdates.map((update) => (
                  <Card key={update.id} className="overflow-hidden" data-testid={`card-tribal-${update.id}`}>
                    <button
                      onClick={() => toggleUpdateExpanded(update.id)}
                      className="w-full p-4 text-left hover-elevate transition-colors"
                      data-testid={`button-expand-tribal-${update.id}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-start gap-2 mb-1 flex-wrap">
                            <h3 className="font-semibold text-foreground line-clamp-2">{update.title}</h3>
                            {getSourceBadge(update)}
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
                      <div className="px-4 pb-4 border-t space-y-4" data-testid={`expanded-tribal-${update.id}`}>
                        {/* Status & Timeline Row */}
                        {((update as any).billStatus || (update as any).expectedTimeline || update.effectiveDate) && (
                          <div className="flex flex-wrap gap-4 py-2 bg-muted/30 rounded-lg px-3">
                            {(update as any).billStatus && (update as any).billStatus !== 'unknown' && (
                              <div className="flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-primary" />
                                <span className="text-sm">
                                  <span className="text-muted-foreground">Status:</span>{' '}
                                  <span className="font-medium capitalize">{(update as any).billStatus.replace(/_/g, ' ')}</span>
                                </span>
                              </div>
                            )}
                            {update.effectiveDate && (
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-primary" />
                                <span className="text-sm">
                                  <span className="text-muted-foreground">Effective:</span>{' '}
                                  <span className="font-medium">{format(new Date(update.effectiveDate), "MMMM d, yyyy")}</span>
                                </span>
                              </div>
                            )}
                            {(update as any).expectedTimeline && (
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">{(update as any).expectedTimeline}</span>
                              </div>
                            )}
                          </div>
                        )}

                        <div>
                          <h4 className="font-semibold text-sm mb-2">Why This Matters</h4>
                          <p className="text-sm text-muted-foreground">{update.whyItMatters}</p>
                        </div>

                        {/* Before/After Comparison */}
                        {(update.beforeText && !update.beforeText.includes('Previous regulations applied')) ||
                         (update.afterText && !update.afterText.includes('New requirements may be')) ? (
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                              <h4 className="font-semibold text-sm mb-2 text-amber-700 dark:text-amber-400 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-amber-500" />
                                Before
                              </h4>
                              <p className="text-sm text-muted-foreground">{update.beforeText}</p>
                            </div>
                            <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                              <h4 className="font-semibold text-sm mb-2 text-green-700 dark:text-green-400 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-green-500" />
                                After
                              </h4>
                              <p className="text-sm text-muted-foreground">{update.afterText}</p>
                            </div>
                          </div>
                        ) : null}

                        {/* Action Items */}
                        {(update as any).actionItems && (
                          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                            <h4 className="font-semibold text-sm mb-2 text-blue-700 dark:text-blue-400 flex items-center gap-2">
                              <ListTodo className="h-4 w-4" />
                              What You Should Do
                            </h4>
                            {(() => {
                              const items = (update as any).actionItems;
                              try {
                                const parsed = JSON.parse(items);
                                if (Array.isArray(parsed)) {
                                  return (
                                    <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                                      {parsed.map((item: string, idx: number) => (
                                        <li key={idx}>{item}</li>
                                      ))}
                                    </ul>
                                  );
                                }
                              } catch {}
                              return <p className="text-sm text-muted-foreground">{items}</p>;
                            })()}
                          </div>
                        )}

                        {(update as any).sourceUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                            data-testid={`button-source-tribal-${update.id}`}
                          >
                            <a href={(update as any).sourceUrl} target="_blank" rel="noopener noreferrer">
                              View Source <ExternalLink className="h-3 w-3 ml-2" />
                            </a>
                          </Button>
                        )}

                        {update.affectedTemplateIds && update.affectedTemplateIds.length > 0 && (
                          <div className="pt-2">
                            <h4 className="font-semibold text-sm mb-3">Affected Documents</h4>
                            <div className="flex flex-wrap gap-2">
                              {update.affectedTemplateIds.map((templateId) => {
                                const template = getTemplateById(templateId);
                                return template ? (
                                  <Link key={templateId} to={`/templates?id=${templateId}`}>
                                    <Badge variant="outline" className="cursor-pointer hover:bg-muted">
                                      <FileText className="h-3 w-3 mr-1" />
                                      {template.title}
                                    </Badge>
                                  </Link>
                                ) : null;
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No tribal housing updates for {selectedState === "NATIONAL" ? "any state" : states?.find(s => s.id === selectedState)?.name || "this state"} yet.</p>
                <p className="text-sm text-muted-foreground mt-2">Select "All States" to view all tribal housing authority updates across the country.</p>
              </div>
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
                          <div className="flex items-start gap-2 mb-1 flex-wrap">
                            <h3 className="font-semibold text-foreground line-clamp-2">{caseItem.caseName}</h3>
                            {caseItem.stateId && (
                              <StateBadge stateId={caseItem.stateId} />
                            )}
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
