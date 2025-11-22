import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Shield, 
  FileText, 
  Search, 
  AlertCircle,
  ArrowRight,
  Download,
  Bell
} from "lucide-react";
import type { LegalUpdate, Template } from "@shared/schema";
import { Link } from "wouter";

export default function Dashboard() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [selectedUpdate, setSelectedUpdate] = useState<LegalUpdate | null>(null);

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

  const { data: recentUpdates, isLoading: updatesLoading } = useQuery<LegalUpdate[]>({
    queryKey: ["/api/legal-updates/recent"],
    enabled: isAuthenticated,
  });

  const { data: unreadCount } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    enabled: isAuthenticated,
  });

  const { data: allTemplates } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
    enabled: isAuthenticated,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading" />
      </div>
    );
  }

  if (!user) return null;

  const isTrialing = user.subscriptionStatus === 'trialing';
  const isIncomplete = user.subscriptionStatus === 'incomplete';
  const needsSubscription = isTrialing || isIncomplete || !user.stripeCustomerId;
  const hasActiveSubscription = user.subscriptionStatus === 'active' || isTrialing;

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-display font-semibold text-foreground mb-2">
            Welcome back{user.firstName ? `, ${user.firstName}` : ''}
          </h1>
          <p className="text-muted-foreground">
            Your protective toolkit for confident property management
          </p>
        </div>

        {/* Subscription Banner - for trial, incomplete, or no subscription */}
        {needsSubscription && user.subscriptionStatus !== 'active' && (
          <Card className="mb-8 p-4 bg-primary/10 border-primary/20">
            <div className="flex items-start gap-3">
              <Bell className="h-5 w-5 text-primary mt-0.5" />
              <div className="flex-1">
                {isTrialing && user.trialEndsAt ? (
                  <>
                    <p className="font-medium text-foreground">
                      Your free trial ends {new Date(user.trialEndsAt).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Subscribe now to continue accessing all templates and compliance updates
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-medium text-foreground">
                      Complete Your Subscription
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Subscribe to LeaseShield for $12/month and get access to all templates and compliance updates
                    </p>
                  </>
                )}
              </div>
              <Link to="/subscribe">
                <Button size="sm" variant="default" data-testid="button-subscribe-now">
                  Subscribe Now
                </Button>
              </Link>
            </div>
          </Card>
        )}

        {/* Legal Updates Alert */}
        {unreadCount && unreadCount.count > 0 && (
          <Card className="mb-8 p-4 bg-warning/10 border-warning/20">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-warning mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-foreground">
                  {unreadCount.count} new compliance {unreadCount.count === 1 ? 'update' : 'updates'} for your state
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Review important legal changes that could affect your leases
                </p>
              </div>
              <Link to="/compliance">
                <Button size="sm" variant="outline" data-testid="button-view-updates">
                  View Updates
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </Card>
        )}

        {/* Start Here - Core Toolkits */}
        <div className="mb-12">
          <h2 className="text-xl font-display font-semibold text-foreground mb-6">
            Start Here
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {/* Leasing Toolkit - Amber/Gold */}
            <Link to="/templates">
              <Card className="p-6 hover-elevate active-elevate-2 cursor-pointer transition-all relative overflow-hidden" data-testid="card-leasing-toolkit">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-500/10 to-transparent rounded-full -mr-16 -mt-16" />
                <div className="relative">
                  <div className="rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 w-14 h-14 flex items-center justify-center mb-4 shadow-sm">
                    <FileText className="h-7 w-7 text-amber-600 dark:text-amber-500" />
                  </div>
                  <h3 className="font-display text-lg font-semibold mb-2">Leasing Toolkit</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    State-specific leases, applications, and rental agreements
                  </p>
                  <div className="text-sm font-medium text-amber-600 dark:text-amber-500 hover:text-amber-700 dark:hover:text-amber-400 flex items-center">
                    Browse Templates
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </div>
                </div>
              </Card>
            </Link>

            {/* Screening Toolkit - Teal/Cyan */}
            <Link to="/screening">
              <Card className="p-6 hover-elevate active-elevate-2 cursor-pointer transition-all relative overflow-hidden" data-testid="card-screening-toolkit">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-cyan-500/10 to-transparent rounded-full -mr-16 -mt-16" />
                <div className="relative">
                  <div className="rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 w-14 h-14 flex items-center justify-center mb-4 shadow-sm">
                    <Search className="h-7 w-7 text-cyan-600 dark:text-cyan-500" />
                  </div>
                  <h3 className="font-display text-lg font-semibold mb-2">Screening Toolkit</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Learn to read credit reports and avoid screening mistakes
                  </p>
                  <div className="text-sm font-medium text-cyan-600 dark:text-cyan-500 hover:text-cyan-700 dark:hover:text-cyan-400 flex items-center">
                    Get Started
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </div>
                </div>
              </Card>
            </Link>

            {/* Compliance Toolkit - Blue/Primary */}
            <Link to="/compliance">
              <Card className="p-6 hover-elevate active-elevate-2 cursor-pointer transition-all relative overflow-hidden" data-testid="card-compliance-toolkit">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/10 to-transparent rounded-full -mr-16 -mt-16" />
                <div className="relative">
                  <div className="rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 w-14 h-14 flex items-center justify-center mb-4 shadow-sm">
                    <Shield className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="font-display text-lg font-semibold mb-2">Compliance Toolkit</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Stay current with state-specific requirements and updates
                  </p>
                  <div className="text-sm font-medium flex items-center">
                    View Compliance
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </div>
                </div>
              </Card>
            </Link>
          </div>
        </div>

        {/* Recent Legal Updates */}
        {!updatesLoading && recentUpdates && recentUpdates.length > 0 && (
          <div className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-display font-semibold text-foreground">
                Recent Compliance Updates
              </h2>
              <Link to="/compliance">
                <Button variant="ghost" size="sm" data-testid="button-all-updates">
                  View All
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div className="space-y-4">
              {recentUpdates.slice(0, 3).map((update) => (
                <Card key={update.id} className="p-6 hover-elevate transition-all" data-testid={`card-update-${update.id}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge 
                          variant={update.impactLevel === 'high' ? 'default' : 'secondary'}
                          data-testid={`badge-impact-${update.impactLevel}`}
                        >
                          {update.impactLevel.toUpperCase()} IMPACT
                        </Badge>
                        <Badge variant="outline" data-testid={`badge-state-${update.stateId}`}>
                          {update.stateId}
                        </Badge>
                        {update.effectiveDate && (
                          <span className="text-sm text-muted-foreground">
                            Effective {new Date(update.effectiveDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-foreground mb-2">{update.title}</h3>
                      <p className="text-sm text-muted-foreground mb-3">{update.summary}</p>
                      <p className="text-sm font-medium text-foreground">
                        Why it matters: <span className="font-normal text-muted-foreground">{update.whyItMatters}</span>
                      </p>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setSelectedUpdate(update)}
                      data-testid={`button-view-detail-${update.id}`}
                    >
                      View Details
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Popular Templates */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-display font-semibold text-foreground">
              Most Used Templates
            </h2>
            <Link to="/templates">
              <Button variant="ghost" size="sm" data-testid="button-all-templates">
                View All Templates
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { name: 'Residential Lease Agreement', state: user.preferredState || 'UT', type: 'lease' },
              { name: 'Rental Application', state: user.preferredState || 'UT', type: 'application' },
              { name: 'Move-In Checklist', state: user.preferredState || 'UT', type: 'move_in_out' },
              { name: 'Late Rent Notice', state: user.preferredState || 'UT', type: 'notices' },
              { name: 'Lease Violation Notice', state: user.preferredState || 'UT', type: 'notices' },
              { name: 'Security Deposit Return', state: user.preferredState || 'UT', type: 'move_in_out' },
            ].map((templateInfo, index) => {
              // Find matching template from database
              const matchedTemplate = allTemplates?.find(t => 
                t.title.toLowerCase().includes(templateInfo.name.toLowerCase()) &&
                t.stateId === templateInfo.state
              );
              
              return (
                <Link 
                  key={index} 
                  to={matchedTemplate ? `/templates/${matchedTemplate.id}/fill` : "/templates"}
                >
                  <Card 
                    className="p-4 hover-elevate active-elevate-2 cursor-pointer transition-all" 
                    data-testid={`template-card-${index}`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1">
                        <h3 className="font-medium text-foreground mb-1">{templateInfo.name}</h3>
                        <Badge variant="secondary" className="text-xs">
                          {templateInfo.state}
                        </Badge>
                      </div>
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <Button variant="outline" size="sm" className="w-full" data-testid={`button-download-${index}`}>
                      <Download className="mr-2 h-4 w-4" />
                      View Template
                    </Button>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legal Update Details Modal */}
      <Dialog open={!!selectedUpdate} onOpenChange={(open) => !open && setSelectedUpdate(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Badge 
                variant={selectedUpdate?.impactLevel === 'high' ? 'default' : 'secondary'}
              >
                {selectedUpdate?.impactLevel.toUpperCase()} IMPACT
              </Badge>
              <Badge variant="outline">
                {selectedUpdate?.stateId}
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-lg font-semibold text-foreground pt-2">
              {selectedUpdate?.title}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 pt-4">
            {selectedUpdate?.effectiveDate && (
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-1">Effective Date</h4>
                <p className="text-sm text-muted-foreground">
                  {new Date(selectedUpdate.effectiveDate).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </p>
              </div>
            )}

            <div>
              <h4 className="text-sm font-semibold text-foreground mb-1">Summary</h4>
              <p className="text-sm text-muted-foreground">{selectedUpdate?.summary}</p>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-foreground mb-1">Why It Matters</h4>
              <p className="text-sm text-muted-foreground">{selectedUpdate?.whyItMatters}</p>
            </div>

            {selectedUpdate?.beforeText && (
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-1">Before</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedUpdate.beforeText}</p>
              </div>
            )}

            {selectedUpdate?.afterText && (
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-1">After</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedUpdate.afterText}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
