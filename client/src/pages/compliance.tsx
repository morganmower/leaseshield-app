import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { useStates } from "@/hooks/useStates";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { StateBadge } from "@/components/state-badge";
import { Shield, AlertTriangle, CheckCircle, ArrowRight, ArrowLeft, MapPin, FileText, Scale, Home, Users, DollarSign, Clock, BookOpen, Gavel } from "lucide-react";
import type { ComplianceCard } from "@shared/schema";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { getAccessToken } from "@/lib/queryClient";

const CATEGORY_CONFIG: Record<string, { label: string; icon: any; color: string; bgColor: string }> = {
  deposits: { 
    label: "Security Deposits", 
    icon: DollarSign, 
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
  },
  disclosures: { 
    label: "Disclosures", 
    icon: FileText, 
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800"
  },
  evictions: { 
    label: "Evictions", 
    icon: Gavel, 
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"
  },
  fair_housing: { 
    label: "Fair Housing", 
    icon: Users, 
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800"
  },
  rent_increases: { 
    label: "Rent Increases", 
    icon: Scale, 
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
  },
};

function formatCategory(category: string): string {
  return CATEGORY_CONFIG[category]?.label || category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function getCategoryIcon(category: string) {
  return CATEGORY_CONFIG[category]?.icon || Shield;
}

function getCategoryColor(category: string) {
  return CATEGORY_CONFIG[category]?.color || "text-primary";
}

function getCategoryBgColor(category: string) {
  return CATEGORY_CONFIG[category]?.bgColor || "bg-muted";
}

export default function Compliance() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [, setLocation] = useLocation();
  const { states } = useStates();
  const [selectedState, setSelectedState] = useState<string>(user?.preferredState || "UT");
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

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

  const { data: complianceCards, isLoading: cardsLoading, error: cardsError } = useQuery<ComplianceCard[]>({
    queryKey: ["/api/compliance-cards", selectedState],
    enabled: isAuthenticated && !!selectedState,
    queryFn: async () => {
      const url = `/api/compliance-cards?stateId=${selectedState}`;
      const token = getAccessToken();
      const response = await fetch(url, { 
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (!response.ok) {
        throw new Error('Failed to fetch compliance cards');
      }
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading" />
      </div>
    );
  }

  if (!user) return null;

  // If trial expired (API returns 403), show only subscription CTA
  if (cardsError) {
    return (
      <div className="flex-1 overflow-auto flex items-center justify-center">
        <Card className="p-12 bg-primary/10 border-primary/20 max-w-md">
          <div className="text-center">
            <Shield className="h-16 w-16 text-primary mx-auto mb-6" />
            <h2 className="text-2xl font-display font-semibold text-foreground mb-3">
              Subscribe to receive updates
            </h2>
            <p className="text-muted-foreground mb-8">
              Get access to state-specific compliance guidance, legal requirements, and automatic updates when laws change
            </p>
            <Link to="/subscribe">
              <Button size="lg" data-testid="button-subscribe-compliance-cta">
                Subscribe Now
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const selectedStateName = SUPPORTED_STATES.find(s => s.code === selectedState)?.name || selectedState;
  const cardCount = complianceCards?.length || 0;
  const categoryCount = complianceCards ? new Set(complianceCards.map(c => c.category)).size : 0;

  return (
    <div className="flex-1 overflow-auto">
      {/* Hero Header with Gradient */}
      <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-b">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-primary/10 rounded-xl">
                <Shield className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-display font-bold text-foreground mb-1">
                  Compliance Toolkit
                </h1>
                <p className="text-muted-foreground">
                  State-specific landlord requirements, updated as laws change
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-md">
                    <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">{cardCount}</span>
                    <span className="text-muted-foreground ml-1">Requirements</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-md">
                    <BookOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">{categoryCount}</span>
                    <span className="text-muted-foreground ml-1">Categories</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Legal Disclaimer - Compact */}
        <div className="mb-6 bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200/50 dark:border-amber-800/50 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">Educational Only:</strong> Verify with local authorities or attorney. 
              <Link to="/disclaimers" className="text-primary hover:underline ml-1">Full disclaimers</Link>
            </p>
          </div>
        </div>

        {/* State Selector - Mobile Dropdown */}
        <div className="md:hidden mb-6">
          <Select value={selectedState} onValueChange={setSelectedState}>
            <SelectTrigger className="w-full bg-card" data-testid="select-state-mobile">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <SelectValue placeholder="Select a state" />
              </div>
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_STATES.map((state) => (
                <SelectItem key={state.code} value={state.code} data-testid={`select-state-${state.code}`}>
                  {state.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* State Tabs - Desktop with enhanced styling */}
        <Tabs value={selectedState} onValueChange={setSelectedState} className="mb-6">
          <div className="hidden md:block mb-6">
            <div className="flex items-center gap-3 mb-3">
              <MapPin className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-muted-foreground">Select your state:</span>
            </div>
            <ScrollArea className="w-full whitespace-nowrap">
              <TabsList className="inline-flex h-11 items-center justify-start gap-1 bg-muted/50 p-1.5 rounded-lg border" data-testid="tabs-state-selector">
                {SUPPORTED_STATES.map((state) => (
                  <TabsTrigger 
                    key={state.code} 
                    value={state.code} 
                    data-testid={`tab-state-${state.code}`}
                    className="px-4 py-2 text-sm font-medium whitespace-nowrap rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all"
                  >
                    {state.name}
                  </TabsTrigger>
                ))}
              </TabsList>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>

          {SUPPORTED_STATES.map(({ code: state }) => (
            <TabsContent key={state} value={state} className="space-y-6 mt-0">
              {/* State Header Card */}
              <Card className="p-4 bg-gradient-to-r from-primary/5 to-transparent border-primary/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <StateBadge stateId={state} />
                    <div>
                      <h2 className="text-lg font-display font-semibold text-foreground">
                        {SUPPORTED_STATES.find(s => s.code === state)?.name} Compliance
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {complianceCards?.length || 0} requirements across {categoryCount} categories
                      </p>
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Updated {format(new Date(), 'MMM yyyy')}</span>
                  </div>
                </div>
              </Card>

              {/* Compliance Cards Section */}
              <div>

                {cardsLoading ? (
                  <div className="grid md:grid-cols-2 gap-6">
                    {[...Array(4)].map((_, i) => (
                      <Card key={i} className="p-6">
                        <div className="h-40 animate-pulse bg-muted rounded-md" />
                      </Card>
                    ))}
                  </div>
                ) : cardsError ? (
                  <Card className="p-8 bg-primary/10 border-primary/20">
                    <div className="text-center">
                      <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-foreground mb-2">
                        Subscribe to receive updates
                      </h3>
                      <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                        Get access to state-specific compliance guidance, legal requirements, and automatic updates when laws change
                      </p>
                      <Link to="/subscribe">
                        <Button size="lg" data-testid="button-subscribe-compliance">
                          Subscribe Now
                        </Button>
                      </Link>
                    </div>
                  </Card>
                ) : complianceCards && complianceCards.length > 0 ? (
                  <div className="grid md:grid-cols-2 gap-5">
                    {complianceCards.filter((card, index, self) => 
                      index === self.findIndex(c => c.id === card.id)
                    ).map((card) => {
                      const isExpanded = expandedCards.has(card.id);
                      const CategoryIcon = getCategoryIcon(card.category);
                      const categoryColor = getCategoryColor(card.category);
                      const categoryBgColor = getCategoryBgColor(card.category);
                      return (
                      <Card
                        key={card.id}
                        className="overflow-hidden hover-elevate transition-all"
                        data-testid={`compliance-card-${card.id}`}
                      >
                        {/* Card Header with Category Color */}
                        <div className={`px-5 py-3 ${categoryBgColor}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={`p-1.5 rounded-md ${
                                card.category === 'deposits' ? 'bg-emerald-100 dark:bg-emerald-900/50' :
                                card.category === 'disclosures' ? 'bg-blue-100 dark:bg-blue-900/50' :
                                card.category === 'evictions' ? 'bg-red-100 dark:bg-red-900/50' :
                                card.category === 'fair_housing' ? 'bg-purple-100 dark:bg-purple-900/50' :
                                card.category === 'rent_increases' ? 'bg-amber-100 dark:bg-amber-900/50' :
                                'bg-primary/20'
                              }`}>
                                <CategoryIcon className={`h-4 w-4 ${categoryColor}`} />
                              </div>
                              <span className={`text-sm font-medium ${categoryColor}`}>
                                {formatCategory(card.category)}
                              </span>
                            </div>
                            <StateBadge stateId={card.stateId} />
                          </div>
                        </div>

                        {/* Card Body */}
                        <div className="p-5">
                          <h3 className="font-semibold text-lg text-foreground mb-2 leading-tight">
                            {card.title}
                          </h3>

                          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                            {card.summary}
                          </p>

                          <div 
                            data-testid={`card-details-${card.id}`} 
                            className={`${isExpanded ? '' : 'hidden'} mb-4 space-y-4`}
                          >
                            {/* Sections format (used by rent_increases, evictions) */}
                            {(card.content as any)?.sections && Array.isArray((card.content as any).sections) && (card.content as any).sections.length > 0 && (
                              <div className="space-y-3 bg-muted/30 rounded-lg p-4">
                                {((card.content as any).sections as Array<{title: string; content: string}>).map((section, idx) => (
                                  <div key={idx} className="border-l-2 border-primary/30 pl-3">
                                    <h4 className="text-sm font-semibold text-foreground mb-1">{section.title}</h4>
                                    <p className="text-sm text-muted-foreground">{section.content}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            {/* Statutes */}
                            {(card.content as any)?.statutes && Array.isArray((card.content as any).statutes) && (card.content as any).statutes.length > 0 && (
                              <div className="bg-muted/30 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-2">
                                  <Gavel className="h-4 w-4 text-muted-foreground" />
                                  <h4 className="text-sm font-semibold text-foreground">Legal Authority</h4>
                                </div>
                                <ul className="space-y-1.5 ml-6">
                                  {((card.content as any).statutes as string[]).map((statute: string, idx: number) => (
                                    <li key={idx} className="text-sm text-muted-foreground list-disc">{statute}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            
                            {/* Requirements */}
                            {(card.content as any)?.requirements && Array.isArray((card.content as any).requirements) && (card.content as any).requirements.length > 0 && (
                              <div className="bg-muted/30 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-2">
                                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                                  <h4 className="text-sm font-semibold text-foreground">Key Requirements</h4>
                                </div>
                                <ul className="space-y-1.5">
                                  {((card.content as any).requirements as string[]).map((req: string, idx: number) => (
                                    <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                                      <CheckCircle className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                                      <span>{req}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            
                            {/* Actionable Steps */}
                            {(card.content as any)?.actionableSteps && Array.isArray((card.content as any).actionableSteps) && (card.content as any).actionableSteps.length > 0 && (
                              <div className="bg-primary/5 rounded-lg p-4 border border-primary/10">
                                <div className="flex items-center gap-2 mb-2">
                                  <ArrowRight className="h-4 w-4 text-primary" />
                                  <h4 className="text-sm font-semibold text-foreground">Actionable Steps</h4>
                                </div>
                                <ol className="space-y-2">
                                  {((card.content as any).actionableSteps as string[]).map((step: string, idx: number) => (
                                    <li key={idx} className="flex items-start gap-3 text-sm text-muted-foreground">
                                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-semibold flex-shrink-0">
                                        {idx + 1}
                                      </span>
                                      <span>{step}</span>
                                    </li>
                                  ))}
                                </ol>
                              </div>
                            )}
                          </div>
                        
                          <Button 
                            variant="outline" 
                            size="sm" 
                            data-testid={`button-view-card-${card.id}`}
                            onClick={() => {
                              if (card.relatedTemplateId) {
                                setLocation(`/templates/${card.relatedTemplateId}/fill`);
                              } else {
                                const newExpanded = new Set(expandedCards);
                                if (newExpanded.has(card.id)) {
                                  newExpanded.delete(card.id);
                                } else {
                                  newExpanded.add(card.id);
                                }
                                setExpandedCards(newExpanded);
                              }
                            }}
                          >
                            {card.relatedTemplateId ? (
                              <>
                                View Template
                                <ArrowRight className="ml-2 h-4 w-4" />
                              </>
                            ) : isExpanded ? (
                              <>
                                Back
                                <ArrowLeft className="ml-2 h-4 w-4" />
                              </>
                            ) : (
                              <>
                                View Requirements
                                <ArrowRight className="ml-2 h-4 w-4" />
                              </>
                            )}
                          </Button>
                        </div>
                      </Card>
                    );
                    })}
                  </div>
                ) : (
                  <Card className="p-12 text-center">
                    <p className="text-muted-foreground">
                      Compliance cards for {state} are being prepared.
                    </p>
                  </Card>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
