import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StateBadge } from "@/components/state-badge";
import { Shield, AlertTriangle, CheckCircle, ArrowRight, ArrowLeft } from "lucide-react";
import type { ComplianceCard, LegalUpdate } from "@shared/schema";
import { Link, useLocation } from "wouter";

export default function Compliance() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedState, setSelectedState] = useState<string>(user?.preferredState || "UT");
  const [expandedUpdates, setExpandedUpdates] = useState<Set<string>>(new Set());
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  useEffect(() => {
    if (user?.preferredState && !selectedState) {
      setSelectedState(user.preferredState);
    }
  }, [user, selectedState]);

  const { data: complianceCards, isLoading: cardsLoading } = useQuery<ComplianceCard[]>({
    queryKey: ["/api/compliance-cards", selectedState],
    enabled: isAuthenticated && !!selectedState,
    queryFn: async () => {
      const url = `/api/compliance-cards?stateId=${selectedState}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Failed to fetch compliance cards');
      }
      return response.json();
    },
  });

  const { data: legalUpdates, isLoading: updatesLoading } = useQuery<LegalUpdate[]>({
    queryKey: ["/api/legal-updates", selectedState],
    enabled: isAuthenticated && !!selectedState,
    queryFn: async () => {
      const url = `/api/legal-updates?stateId=${selectedState}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Failed to fetch legal updates');
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

  return (
    <div className="flex-1 overflow-auto">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-display font-semibold text-foreground mb-2">
            Compliance Toolkit
          </h1>
          <p className="text-muted-foreground">
            Stay current with state-specific requirements and legal updates
          </p>
        </div>

        {/* Legal Disclaimer */}
        <div className="mb-8 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-foreground">
                <strong>Not Legal Advice:</strong> This compliance guidance is educational only and may not reflect 
                the most current laws in your jurisdiction. Always verify requirements with local authorities or a 
                licensed attorney before taking action. <Link to="/disclaimers" className="text-primary hover:underline">Read full disclaimers</Link>
              </p>
            </div>
          </div>
        </div>

        {/* State Tabs */}
        <Tabs value={selectedState} onValueChange={setSelectedState} className="mb-8">
          <TabsList className="grid w-full max-w-2xl grid-cols-4" data-testid="tabs-state-selector">
            <TabsTrigger value="UT" data-testid="tab-state-UT">Utah</TabsTrigger>
            <TabsTrigger value="TX" data-testid="tab-state-TX">Texas</TabsTrigger>
            <TabsTrigger value="ND" data-testid="tab-state-ND">North Dakota</TabsTrigger>
            <TabsTrigger value="SD" data-testid="tab-state-SD">South Dakota</TabsTrigger>
          </TabsList>

          {["UT", "TX", "ND", "SD"].map((state) => (
            <TabsContent key={state} value={state} className="space-y-8">
              {/* Legal Updates Section */}
              <div>
                <div className="flex items-center gap-2 mb-6">
                  <AlertTriangle className="h-6 w-6 text-warning" />
                  <h2 className="text-2xl font-display font-semibold text-foreground">
                    Recent Legal Updates
                  </h2>
                </div>

                {updatesLoading ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <Card key={i} className="p-6">
                        <div className="h-32 animate-pulse bg-muted rounded-md" />
                      </Card>
                    ))}
                  </div>
                ) : legalUpdates && legalUpdates.length > 0 ? (
                  <div className="space-y-4">
                    {legalUpdates.filter((update, index, self) => 
                      index === self.findIndex(u => u.id === update.id)
                    ).map((update) => {
                      const isExpanded = expandedUpdates.has(update.id);
                      return (
                      <Card
                        key={update.id}
                        className="p-6 hover-elevate transition-all"
                        data-testid={`legal-update-${update.id}`}
                      >
                        <div className="flex items-start justify-between gap-4 mb-4">
                          <div className="flex items-center gap-3">
                            <Badge
                              variant={update.impactLevel === 'high' ? 'default' : 'secondary'}
                              className={update.impactLevel === 'high' ? 'bg-warning text-warning-foreground' : ''}
                            >
                              {update.impactLevel.toUpperCase()} IMPACT
                            </Badge>
                            {update.effectiveDate && (
                              <span className="text-sm text-muted-foreground">
                                Effective {new Date(update.effectiveDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>

                        <h3 className="font-semibold text-lg text-foreground mb-3">
                          {update.title}
                        </h3>

                        <p className="text-muted-foreground mb-4">{update.summary}</p>

                        <div 
                          data-testid={`update-details-${update.id}`}
                          className={`${isExpanded ? '' : 'hidden'} mt-4 pt-4 border-t space-y-4`}
                        >
                          <div className="bg-muted/50 rounded-lg p-4">
                            <h4 className="font-semibold text-sm text-foreground mb-2 flex items-center gap-2">
                              <Shield className="h-4 w-4 text-primary" />
                              Why This Matters
                            </h4>
                            <p className="text-sm text-muted-foreground">{update.whyItMatters}</p>
                          </div>

                          {update.beforeText && update.afterText && (
                            <div className="grid md:grid-cols-2 gap-4">
                              <div className="border border-destructive/20 rounded-lg p-4 bg-destructive/5">
                                <h4 className="font-semibold text-sm text-destructive mb-2">Before</h4>
                                <p className="text-sm text-muted-foreground">{update.beforeText}</p>
                              </div>
                              <div className="border border-success/20 rounded-lg p-4 bg-success/5">
                                <h4 className="font-semibold text-sm text-success mb-2">After (New)</h4>
                                <p className="text-sm text-muted-foreground">{update.afterText}</p>
                              </div>
                            </div>
                          )}
                        </div>

                        <Button 
                          variant="outline" 
                          size="sm" 
                          data-testid={`button-view-update-${update.id}`}
                          onClick={() => {
                            const newExpanded = new Set(expandedUpdates);
                            if (newExpanded.has(update.id)) {
                              newExpanded.delete(update.id);
                            } else {
                              newExpanded.add(update.id);
                            }
                            setExpandedUpdates(newExpanded);
                          }}
                        >
                          {isExpanded ? (
                            <>
                              Back
                              <ArrowLeft className="ml-2 h-4 w-4" />
                            </>
                          ) : (
                            <>
                              View Full Details
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </>
                          )}
                        </Button>
                      </Card>
                    );
                    })}
                  </div>
                ) : (
                  <Card className="p-12 text-center">
                    <CheckCircle className="h-12 w-12 text-success mx-auto mb-4" />
                    <h3 className="font-semibold text-lg mb-2">You're all up to date!</h3>
                    <p className="text-muted-foreground">
                      No new compliance updates for {state}. We'll notify you when something changes.
                    </p>
                  </Card>
                )}
              </div>

              {/* Compliance Cards Section */}
              <div>
                <div className="flex items-center gap-2 mb-6">
                  <Shield className="h-6 w-6 text-primary" />
                  <h2 className="text-2xl font-display font-semibold text-foreground">
                    Compliance Requirements
                  </h2>
                </div>

                {cardsLoading ? (
                  <div className="grid md:grid-cols-2 gap-6">
                    {[...Array(4)].map((_, i) => (
                      <Card key={i} className="p-6">
                        <div className="h-40 animate-pulse bg-muted rounded-md" />
                      </Card>
                    ))}
                  </div>
                ) : complianceCards && complianceCards.length > 0 ? (
                  <div className="grid md:grid-cols-2 gap-6">
                    {complianceCards.filter((card, index, self) => 
                      index === self.findIndex(c => c.id === card.id)
                    ).map((card) => {
                      const isExpanded = expandedCards.has(card.id);
                      return (
                      <Card
                        key={card.id}
                        className="p-6 hover-elevate transition-all"
                        data-testid={`compliance-card-${card.id}`}
                      >
                        <div className="flex items-start justify-between mb-4">
                          <Badge variant="secondary">{card.category}</Badge>
                          <StateBadge stateId={card.stateId} />
                        </div>

                        <h3 className="font-semibold text-lg text-foreground mb-3">
                          {card.title}
                        </h3>

                        <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                          {card.summary}
                        </p>

                        <div 
                          data-testid={`card-details-${card.id}`} 
                          className={`${isExpanded ? '' : 'hidden'} mt-4 pt-4 border-t space-y-3`}
                        >
                          <div>
                            <h4 className="text-sm font-semibold text-foreground mb-1">Category</h4>
                            <p className="text-sm text-muted-foreground">{card.category}</p>
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-foreground mb-1">Details</h4>
                            <p className="text-sm text-muted-foreground">{card.summary}</p>
                          </div>
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
