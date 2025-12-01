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
import type { ComplianceCard } from "@shared/schema";
import { Link, useLocation } from "wouter";

export default function Compliance() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [, setLocation] = useLocation();
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

  const { data: complianceCards, isLoading: cardsLoading, error: cardsError } = useQuery<ComplianceCard[]>({
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
            Stay current with state-specific requirements
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
          <TabsList className="grid w-full max-w-7xl grid-cols-8" data-testid="tabs-state-selector">
            <TabsTrigger value="UT" data-testid="tab-state-UT">Utah</TabsTrigger>
            <TabsTrigger value="TX" data-testid="tab-state-TX">Texas</TabsTrigger>
            <TabsTrigger value="ND" data-testid="tab-state-ND">North Dakota</TabsTrigger>
            <TabsTrigger value="SD" data-testid="tab-state-SD">South Dakota</TabsTrigger>
            <TabsTrigger value="NC" data-testid="tab-state-NC">North Carolina</TabsTrigger>
            <TabsTrigger value="OH" data-testid="tab-state-OH">Ohio</TabsTrigger>
            <TabsTrigger value="MI" data-testid="tab-state-MI">Michigan</TabsTrigger>
            <TabsTrigger value="ID" data-testid="tab-state-ID">Idaho</TabsTrigger>
          </TabsList>

          {["UT", "TX", "ND", "SD", "NC", "OH", "MI", "ID"].map((state) => (
            <TabsContent key={state} value={state} className="space-y-8">
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
                          className={`${isExpanded ? '' : 'hidden'} mt-4 pt-4 border-t space-y-4`}
                        >
                          {/* Statutes */}
                          {(card.content as any)?.statutes && Array.isArray((card.content as any).statutes) && (card.content as any).statutes.length > 0 && (
                            <div>
                              <h4 className="text-sm font-semibold text-foreground mb-2">Legal Authority</h4>
                              <ul className="space-y-1">
                                {((card.content as any).statutes as string[]).map((statute: string, idx: number) => (
                                  <li key={idx} className="text-sm text-muted-foreground">• {statute}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {/* Requirements */}
                          {(card.content as any)?.requirements && Array.isArray((card.content as any).requirements) && (card.content as any).requirements.length > 0 && (
                            <div>
                              <h4 className="text-sm font-semibold text-foreground mb-2">Key Requirements</h4>
                              <ul className="space-y-1">
                                {((card.content as any).requirements as string[]).map((req: string, idx: number) => (
                                  <li key={idx} className="text-sm text-muted-foreground">• {req}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {/* Actionable Steps */}
                          {(card.content as any)?.actionableSteps && Array.isArray((card.content as any).actionableSteps) && (card.content as any).actionableSteps.length > 0 && (
                            <div>
                              <h4 className="text-sm font-semibold text-foreground mb-2">Actionable Steps</h4>
                              <ol className="space-y-1">
                                {((card.content as any).actionableSteps as string[]).map((step: string, idx: number) => (
                                  <li key={idx} className="text-sm text-muted-foreground">{idx + 1}. {step}</li>
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
