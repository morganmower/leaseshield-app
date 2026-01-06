import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
  Bell,
  Lightbulb,
  MessageCircle,
  Sparkles,
  Building2,
  AlertTriangle,
  Gavel,
  CheckCircle2,
  Wand2,
  Play,
  GraduationCap,
  Clock,
  Users,
  ClipboardList
} from "lucide-react";
import type { LegalUpdate, Template } from "@shared/schema";
import { Link } from "wouter";
import { useDashboardTour } from "@/hooks/useDashboardTour";
import { OnboardingVideoModal } from "@/components/onboarding-video-modal";
import { ThemeToggle } from "@/components/theme-toggle";
import { TrialConversionNudge } from "@/components/trial-conversion-nudge";

export default function Dashboard() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [selectedUpdate, setSelectedUpdate] = useState<LegalUpdate | null>(null);
  const [showTour, setShowTour] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const { restartTour } = useDashboardTour(showTour);

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

  // Show tour on first visit, then video modal (disabled for now)
  useEffect(() => {
    if (user && !isLoading) {
      const hasSeenTour = localStorage.getItem('leaseshield_tour_seen');
      const hasSeenVideo = localStorage.getItem('leaseshield_video_seen');
      
      // Tour disabled - users can restart it manually if needed via "Quick Guide" button
      localStorage.setItem('leaseshield_tour_seen', 'true');
      
      if (!hasSeenVideo) {
        // Show video after tour is done
        setTimeout(() => setShowVideoModal(true), 500);
      }
    }
  }, [user, isLoading]);

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

  // AI Training interest
  const { data: trainingInterest } = useQuery<{ registered: boolean }>({
    queryKey: ["/api/training-interest"],
    enabled: isAuthenticated,
  });

  const registerTrainingInterest = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/training-interest");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training-interest"] });
      toast({
        title: "You're on the list!",
        description: "We'll notify you when AI Training for Landlords launches.",
      });
    },
    onError: () => {
      toast({
        title: "Something went wrong",
        description: "Please try again later.",
        variant: "destructive",
      });
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

  const isTrialing = user.subscriptionStatus === 'trialing';
  const isIncomplete = user.subscriptionStatus === 'incomplete';
  const isCancelAtPeriodEnd = user.subscriptionStatus === 'cancel_at_period_end';
  const trialExpired = isTrialing && user.trialEndsAt && new Date(user.trialEndsAt).getTime() < Date.now();
  const needsSubscription = isTrialing || isIncomplete || !user.stripeCustomerId || !user.subscriptionStatus;
  const hasActiveSubscription = user.subscriptionStatus === 'active' || isCancelAtPeriodEnd || (isTrialing && !trialExpired);

  // If trial has expired, show blocking screen
  if (trialExpired) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="mb-6">
            <Bell className="h-16 w-16 text-primary mx-auto mb-4" />
          </div>
          <h1 className="text-3xl font-display font-semibold text-foreground mb-2">
            Trial Expired
          </h1>
          <p className="text-muted-foreground mb-8">
            Your free trial has ended. Subscribe now to continue accessing all templates, compliance guidance, and AI tools.
          </p>
          <div className="flex flex-col gap-3">
            <Link to="/subscribe?period=monthly">
              <Button size="lg" className="w-full" data-testid="button-subscribe-monthly">
                Subscribe - $10/month
              </Button>
            </Link>
            <Link to="/subscribe?period=yearly">
              <Button size="lg" variant="outline" className="w-full" data-testid="button-subscribe-yearly">
                Subscribe - $100/year
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Header with Help Button */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-semibold text-foreground mb-2">
              Welcome back{user.firstName ? `, ${user.firstName}` : ''}
            </h1>
            <p className="text-muted-foreground">
              Your protective toolkit for confident property management
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowVideoModal(true)}
              data-testid="button-video-guide"
              className="whitespace-nowrap"
            >
              <Play className="h-4 w-4 mr-2" />
              Quick Guide
            </Button>
            <ThemeToggle />
          </div>
        </div>

        {/* Subscription Banner - for trial, incomplete, or no subscription */}
        {needsSubscription && user.subscriptionStatus !== 'active' && (
          <Card className="mb-8 p-4 bg-primary/10 border-primary/20">
            <div className="flex items-start gap-3">
              <Bell className="h-5 w-5 text-primary mt-0.5" />
              <div className="flex-1">
                {(isTrialing || user.subscriptionStatus === 'incomplete') && user.trialEndsAt ? (
                  <>
                    {(() => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const endDate = new Date(user.trialEndsAt);
                      endDate.setHours(0, 0, 0, 0);
                      const daysLeft = Math.round((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                      const trialExpired = daysLeft <= 0;
                      
                      return (
                        <>
                          <p className="font-medium text-foreground">
                            {trialExpired ? (
                              <>Your free trial has ended ({new Date(user.trialEndsAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })})</>
                            ) : (
                              <>Your free trial ends in {daysLeft} day{daysLeft !== 1 ? 's' : ''} ({new Date(user.trialEndsAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })})</>
                            )}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {trialExpired ? 'Subscribe now to regain access to all templates and compliance updates' : 'Subscribe now to continue accessing all templates and compliance updates'}
                          </p>
                        </>
                      );
                    })()}
                  </>
                ) : (
                  <>
                    <p className="font-medium text-foreground">
                      Complete Your Subscription
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Subscribe to LeaseShield for $10/month and get access to all templates and compliance updates
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

        {/* Active Subscription Banner - simple confirmation */}
        {user.subscriptionStatus === 'active' && (
          <Card className="mb-8 p-4 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-500 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-emerald-900 dark:text-emerald-100">
                  Active Subscriber
                </p>
                <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
                  You have full access to all LeaseShield features
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Trial Conversion Nudge - Day 3-6 reminders */}
        <TrialConversionNudge />

        {/* Legal Updates Alert */}
        {unreadCount && unreadCount.count > 0 && (
          <Card className="mb-8 p-4 bg-warning/10 border-warning/20">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-warning mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-foreground">
                  {unreadCount.count} new legislation {unreadCount.count === 1 ? 'update' : 'updates'} for your state
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Review important legal changes that could affect your leases
                </p>
              </div>
              <Link to="/legal-updates">
                <Button size="sm" variant="outline" data-testid="button-view-updates">
                  View Updates
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </Card>
        )}

        {/* Hero Panel - Protect Your Rentals in 3 Steps */}
        <div className="mb-10">
          <div className="bg-gradient-to-br from-primary/15 via-primary/8 to-primary/3 dark:from-primary/10 dark:via-primary/5 dark:to-transparent border-2 border-primary/30 dark:border-primary/20 rounded-xl p-6 sm:p-8" data-testid="section-hero-panel">
            <h2 className="text-2xl sm:text-3xl font-display font-semibold text-foreground mb-3">
              Protect your rentals in 3 steps.
            </h2>
            <p className="text-foreground/80 dark:text-foreground/90 mb-6 max-w-3xl">
              Run applications through Western Verify, decode screening reports in plain English, and use updated state-specific leases & notices when legislation changes.
            </p>

            {/* Pill Badges */}
            <div className="flex flex-wrap gap-2 mb-6">
              <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 px-3 py-1">
                <ClipboardList className="h-3 w-3 mr-1.5" />
                Application → Western Verify Screening
              </Badge>
              <Badge className="bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 border-cyan-500/30 px-3 py-1">
                <Search className="h-3 w-3 mr-1.5" />
                AI Screening Helpers
              </Badge>
              <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30 px-3 py-1">
                <FileText className="h-3 w-3 mr-1.5" />
                Updated Leases & Notices
              </Badge>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-wrap gap-3 mb-4">
              <Link to="/rental-applications">
                <Button size="lg" className="bg-primary hover:bg-primary/90 text-lg px-6 min-h-[48px]" data-testid="button-hero-start-application">
                  <ClipboardList className="h-5 w-5 mr-2" />
                  Start an Application
                </Button>
              </Link>
              <Link to="/screening">
                <Button size="lg" variant="outline" className="min-h-[48px]" data-testid="button-hero-use-decoder">
                  <Search className="h-5 w-5 mr-2" />
                  Use the Decoder
                </Button>
              </Link>
              <Link to="/templates">
                <Button size="lg" variant="outline" className="min-h-[48px]" data-testid="button-hero-open-documents">
                  <FileText className="h-5 w-5 mr-2" />
                  Open Leases & Notices
                </Button>
              </Link>
            </div>

            {/* Tip Line */}
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500 flex-shrink-0" />
              <span>Tip: Most landlords misinterpret at least one item on every screening report. The decoder highlights what matters and what to ask next.</span>
            </p>
          </div>
        </div>

        {/* Start Here (Recommended) Section */}
        <div className="mb-10">
          <div className="mb-4">
            <h2 className="text-xl font-display font-semibold text-foreground flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Start Here (Recommended)
            </h2>
            <p className="text-sm text-muted-foreground mt-1">If you do nothing else today, follow this flow.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {/* Step 1: Applications */}
            <Card className="p-5 border-l-4 border-l-emerald-500" data-testid="card-step-1">
              <div className="flex items-start gap-3 mb-3">
                <div className="rounded-full bg-emerald-500/20 w-8 h-8 flex items-center justify-center flex-shrink-0 text-emerald-600 dark:text-emerald-500 font-bold text-sm">
                  1
                </div>
                <h3 className="font-semibold text-foreground">Collect an application + route screening through Western Verify</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                One link to the applicant → authorization captured → screening runs → status updates inside LeaseShield.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link to="/rental-applications">
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" data-testid="button-create-application-link">
                    Create Application Link
                  </Button>
                </Link>
                <Link to="/rental-submissions">
                  <Button size="sm" variant="outline" data-testid="button-view-app-status">
                    View Application Status
                  </Button>
                </Link>
              </div>
            </Card>

            {/* Step 2: AI Screening Helpers */}
            <Card className="p-5 border-l-4 border-l-cyan-500" data-testid="card-step-2">
              <div className="flex items-start gap-3 mb-3">
                <div className="rounded-full bg-cyan-500/20 w-8 h-8 flex items-center justify-center flex-shrink-0 text-cyan-600 dark:text-cyan-500 font-bold text-sm">
                  2
                </div>
                <h3 className="font-semibold text-foreground">Review results using AI Screening Helpers</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Paste/upload report text. Get plain-English explanations, risk flags, and the best follow-up questions.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link to="/screening">
                  <Button size="sm" className="bg-cyan-600 hover:bg-cyan-700 text-white" data-testid="button-open-screening-decoder">
                    Open Screening Decoder
                  </Button>
                </Link>
              </div>
            </Card>

            {/* Step 3: Documents */}
            <Card className="p-5 border-l-4 border-l-amber-500" data-testid="card-step-3">
              <div className="flex items-start gap-3 mb-3">
                <div className="rounded-full bg-amber-500/20 w-8 h-8 flex items-center justify-center flex-shrink-0 text-amber-600 dark:text-amber-500 font-bold text-sm">
                  3
                </div>
                <h3 className="font-semibold text-foreground">Use updated state-specific documents when you need to act</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Leases and notices updated as legislation changes — late rent, violations, non-renewal, and more.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link to="/templates">
                  <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white" data-testid="button-browse-leases-notices">
                    Browse Leases & Notices
                  </Button>
                </Link>
              </div>
            </Card>
          </div>
        </div>

        {/* Three Pillars */}
        <div className="mb-10">
          <div className="grid md:grid-cols-3 gap-6">
            {/* Pillar A: Applications + Western Verify Screening */}
            <Card className="p-6 flex flex-col" data-testid="card-pillar-applications">
              <div className="flex items-start gap-3 mb-4">
                <div className="rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 w-12 h-12 flex items-center justify-center flex-shrink-0">
                  <Users className="h-6 w-6 text-emerald-600 dark:text-emerald-500" />
                </div>
                <div className="flex-1">
                  <h3 className="font-display font-semibold text-foreground mb-1">Applications + Western Verify Screening</h3>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                LeaseShield manages the workflow. Western Verify performs the screening.
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                The easiest compliant flow: apply → authorize → screen → decide.
              </p>
              <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside flex-1">
                <li>Applicant completes application</li>
                <li>Authorization captured</li>
                <li>Screening runs through Western Verify</li>
                <li>Status updates + reports ready</li>
              </ul>
              <div className="flex flex-wrap gap-2 mt-5">
                <Link to="/rental-applications">
                  <Button size="sm" data-testid="button-pillar-create-application">
                    Create Application
                  </Button>
                </Link>
                <Link to="/settings">
                  <Button size="sm" variant="outline" data-testid="button-pillar-integration-settings">
                    Integration Settings
                  </Button>
                </Link>
              </div>
            </Card>

            {/* Pillar B: AI Screening Helpers */}
            <Card className="p-6 flex flex-col" data-testid="card-pillar-ai-helpers">
              <div className="flex items-start gap-3 mb-4">
                <div className="rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 w-12 h-12 flex items-center justify-center flex-shrink-0">
                  <Search className="h-6 w-6 text-cyan-600 dark:text-cyan-500" />
                </div>
                <div className="flex-1">
                  <h3 className="font-display font-semibold text-foreground mb-1">AI Screening Helpers</h3>
                  <Badge variant="secondary" className="text-xs bg-primary/20 text-primary border-primary/30">
                    <Sparkles className="h-3 w-3 mr-1" />
                    AI Powered
                  </Badge>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Credit / Criminal / Eviction explained in plain English — with the best follow-up questions.
              </p>
              <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside flex-1">
                <li>Key risk flags (and what they mean)</li>
                <li>Suggested questions to ask applicants</li>
                <li>Decision notes you can save</li>
              </ul>
              <div className="flex flex-wrap gap-2 mt-5">
                <Link to="/screening">
                  <Button size="sm" data-testid="button-pillar-open-decoder">
                    Open Decoder
                  </Button>
                </Link>
              </div>
            </Card>

            {/* Pillar C: Updated Leases & Notices */}
            <Card className="p-6 flex flex-col" data-testid="card-pillar-documents">
              <div className="flex items-start gap-3 mb-4">
                <div className="rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 w-12 h-12 flex items-center justify-center flex-shrink-0">
                  <FileText className="h-6 w-6 text-amber-600 dark:text-amber-500" />
                </div>
                <div className="flex-1">
                  <h3 className="font-display font-semibold text-foreground mb-1">Updated Leases & Notices</h3>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                State-specific templates updated when laws change.
              </p>
              <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside flex-1">
                <li>Leases</li>
                <li>Late rent + violation notices</li>
                <li>Move-in / move-out checklists</li>
                <li>Adverse action letters</li>
              </ul>
              <div className="flex flex-wrap gap-2 mt-5">
                <Link to="/templates">
                  <Button size="sm" data-testid="button-pillar-browse-documents">
                    Browse Documents
                  </Button>
                </Link>
                <Link to="/legal-updates">
                  <Button size="sm" variant="outline" data-testid="button-pillar-see-updates">
                    See Recent Updates
                  </Button>
                </Link>
              </div>
            </Card>
          </div>
        </div>

        {/* Recent Legislation Updates */}
        {!updatesLoading && recentUpdates && recentUpdates.length > 0 && (
          <div className="mb-12" data-testid="card-recent-updates">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-display font-semibold text-foreground">
                Recent Legislation Updates
              </h2>
              <Link to="/legal-updates">
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

        {/* Trust Line / Compliance Disclaimer */}
        <div className="mt-12 pt-6 border-t text-center">
          <p className="text-xs text-muted-foreground">
            Built for compliance-minded landlords. Always confirm local requirements with counsel.
          </p>
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

      {/* Onboarding Video Modal */}
      <OnboardingVideoModal 
        isOpen={showVideoModal} 
        onClose={() => setShowVideoModal(false)} 
      />
    </div>
  );
}
