import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getAccessToken } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertCircle,
  AlertTriangle,
  FileText,
  DollarSign,
  Home,
  UserX,
  ArrowRight,
  TrendingUp,
  CheckCircle2,
  Download,
  Lock,
  Wrench,
} from "lucide-react";
import { SEO } from "@/components/seo";
import type { Template } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";

const workflows = [
  {
    id: "late-rent",
    title: "Late Rent Payment",
    description: "Step-by-step process for handling late rent, from first notice to legal action",
    icon: DollarSign,
    category: "Payment Issues",
    templates: ["Late Rent Notice", "3-Day Pay or Quit Notice"],
    steps: [
      "Review your lease agreement for late fee policies and grace periods",
      "Send a friendly reminder if within grace period",
      "Issue formal late rent notice after grace period expires",
      "Contact tenant to discuss payment options or payment plan",
      "If no response, issue Pay or Quit notice per state requirements",
      "Document all communication and maintain records",
      "Consider legal action only as last resort"
    ]
  },
  {
    id: "lease-violation",
    title: "Lease Violations",
    description: "Document and address lease violations while maintaining Fair Housing compliance",
    icon: AlertCircle,
    category: "Violations",
    templates: ["5-Day Lease Violation Notice"],
    steps: [
      "Document the specific violation with photos, dates, and details",
      "Review lease terms to confirm violation",
      "Issue written violation notice describing the issue",
      "Provide reasonable time to cure (check state requirements)",
      "Follow up to verify compliance",
      "If uncured, issue Cure or Quit notice",
      "Maintain Fair Housing compliance throughout process"
    ]
  },
  {
    id: "property-damage",
    title: "Property Damage",
    description: "Document damage, communicate with tenants, and handle security deposit deductions",
    icon: Home,
    category: "Property Issues",
    templates: ["Move-Out Inspection Checklist"],
    steps: [
      "Document damage with photos and detailed description",
      "Determine if damage exceeds normal wear and tear",
      "Obtain repair estimates from licensed contractors",
      "Notify tenant of damage and estimated costs",
      "Complete repairs with proper documentation",
      "Provide itemized deduction statement within state deadline",
      "Return remaining deposit per state requirements"
    ]
  },
  {
    id: "esa-pets",
    title: "ESA vs. Pets",
    description: "Verify emotional support animal requests and handle documentation requirements",
    icon: Home,
    category: "Animals",
    templates: ["Residential Lease Agreement"],
    steps: [
      "Receive request for emotional support animal accommodation",
      "Request verification from healthcare provider",
      "Verify provider credentials and patient relationship",
      "Review documentation for disability-related need",
      "Make reasonable accommodation decision",
      "Document approval or denial with clear reasoning",
      "Never charge pet fees/deposits for legitimate ESAs"
    ]
  },
  {
    id: "rent-increase",
    title: "Rent Increases",
    description: "Legally notify tenants of rent increases with proper timing and documentation",
    icon: TrendingUp,
    category: "Lease Changes",
    templates: ["Month-to-Month Rental Agreement"],
    steps: [
      "Research local rent control laws and limitations",
      "Verify required notice period (typically 30-60 days)",
      "Calculate new rent amount based on market conditions",
      "Prepare written notice with all required information",
      "Deliver notice via certified mail or per state requirements",
      "Keep proof of delivery and all documentation",
      "Offer lease renewal with new terms"
    ]
  },
  {
    id: "non-renewal",
    title: "Non-Renewal & Move-Out",
    description: "End tenancies properly with correct notices and move-out procedures",
    icon: UserX,
    category: "Lease Termination",
    templates: ["Move-Out Inspection Checklist", "Move-In Checklist"],
    steps: [
      "Review lease end date and notice requirements",
      "Send non-renewal notice within required timeframe",
      "Schedule move-out inspection with tenant",
      "Conduct walkthrough using detailed checklist",
      "Document property condition with photos",
      "Calculate security deposit deductions if applicable",
      "Return deposit within state deadline with itemization"
    ]
  },
];

export default function TenantIssues() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedWorkflow, setSelectedWorkflow] = useState<typeof workflows[0] | null>(null);
  const [showWorkflowDialog, setShowWorkflowDialog] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);

  // Fetch all templates to match workflow template names
  const { data: allTemplates, error: templatesError } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
    enabled: isAuthenticated,
    queryFn: async () => {
      const token = getAccessToken();
      const response = await fetch('/api/templates', { 
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (!response.ok) throw new Error('Failed to fetch templates');
      return response.json();
    },
  });

  const trialExpired = user?.subscriptionStatus === 'trialing' && user?.trialEndsAt && new Date(user.trialEndsAt).getTime() < Date.now();
  const hasActiveSubscription = user?.subscriptionStatus === 'active' || user?.subscriptionStatus === 'cancel_at_period_end';
  const hasActiveTrial = user?.subscriptionStatus === 'trialing' && !trialExpired;
  const isAdmin = user?.isAdmin === true;
  const hasAccess = hasActiveSubscription || hasActiveTrial || isAdmin;
  const isTrialing = user?.subscriptionStatus === 'trialing';

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

  const handleViewWorkflow = (workflow: typeof workflows[0]) => {
    setSelectedWorkflow(workflow);
    setShowWorkflowDialog(true);
  };

  const handleTemplateDownload = async (templateName: string) => {
    if (!hasAccess) {
      setShowUpgradeDialog(true);
      return;
    }

    // Find matching template by name
    const template = allTemplates?.find(t => 
      t.title.toLowerCase().includes(templateName.toLowerCase()) ||
      templateName.toLowerCase().includes(t.title.toLowerCase())
    );

    if (!template) {
      toast({
        title: "Template Not Found",
        description: "This template is not available yet.",
        variant: "destructive",
      });
      return;
    }

    try {
      toast({
        title: 'Download Started',
        description: 'Your template is being downloaded...',
      });

      // Fetch template details to get field definitions
      const token = getAccessToken();
      const templateResponse = await fetch(`/api/templates/${template.id}`, {
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      
      if (!templateResponse.ok) {
        throw new Error('Failed to fetch template details');
      }
      
      const templateData = await templateResponse.json();
      const fillableData = templateData.fillableFormData as { fields?: Array<{ id: string; label: string }> };
      
      // Create blank field values with underscores for manual filling
      const blankFieldValues: Record<string, string> = {};
      if (fillableData?.fields) {
        fillableData.fields.forEach(field => {
          blankFieldValues[field.id] = '___________________________';
        });
      }

      // Generate blank template with placeholder values
      const response = await fetch('/api/documents/generate', {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ templateId: template.id, fieldValues: blankFieldValues }),
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
      });

      if (!response.ok) {
        throw new Error('Failed to generate document');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${template.title.replace(/[^a-z0-9]/gi, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Download Complete',
        description: 'Your template has been downloaded successfully.',
      });
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "There was an error downloading the template.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading" />
      </div>
    );
  }

  if (!user) return null;

  const categories = ["All", ...Array.from(new Set(workflows.map(w => w.category)))];
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const visibleWorkflows = activeCategory === "All"
    ? workflows
    : workflows.filter(w => w.category === activeCategory);
  const totalTemplates = Array.from(new Set(workflows.flatMap(w => w.templates))).length;

  return (
    <div className="flex-1 overflow-auto">
      <SEO
        title="Tenant Issue Toolkit — Step-by-step landlord workflows"
        description="Step-by-step workflows for late rent, lease violations, ESAs, rent increases, property damage, and move-outs. Includes downloadable templates."
        canonical="/tenant-issues"
      />

      {/* Hero Header — matches Compliance page */}
      <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-b">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-primary/10 rounded-md">
                <Wrench className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-display font-semibold text-foreground mb-1">
                  Tenant Issue Toolkit
                </h1>
                <p className="text-sm sm:text-base text-muted-foreground">
                  Step-by-step workflows for handling common landlord challenges.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div>
                <p className="text-2xl font-semibold text-foreground tabular-nums" data-testid="text-workflows-count">{workflows.length}</p>
                <p className="text-xs text-muted-foreground">Workflows</p>
              </div>
              <div className="h-10 w-px bg-border" />
              <div>
                <p className="text-2xl font-semibold text-foreground tabular-nums" data-testid="text-templates-count">{totalTemplates}</p>
                <p className="text-xs text-muted-foreground">Templates</p>
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
              <strong className="text-foreground">Educational Only:</strong> Verify with local authorities or attorney for legal actions like evictions.
              <Link to="/disclaimers" className="text-primary hover:underline ml-1">Full disclaimers</Link>
            </p>
          </div>
        </div>

        {/* Subscription CTA if user doesn't have access */}
        {!hasAccess && (
          <Card className="p-8 bg-primary/10 border-primary/20 mb-6" data-testid="card-subscribe-gate">
            <div className="text-center">
              <Lock className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Subscribe to access tenant issue workflows
              </h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                Get step-by-step guidance plus downloadable templates for $10/month.
              </p>
              <Link to="/subscribe">
                <Button size="lg" data-testid="button-subscribe-tenant-issues">
                  Subscribe Now
                </Button>
              </Link>
            </div>
          </Card>
        )}

        {/* Category filter pills */}
        {hasAccess && (
          <div className="mb-6 flex flex-wrap gap-2" data-testid="category-filter">
            {categories.map((cat) => (
              <Button
                key={cat}
                size="sm"
                variant={activeCategory === cat ? "default" : "outline"}
                onClick={() => setActiveCategory(cat)}
                data-testid={`filter-${cat.toLowerCase().replace(/\s+/g, "-")}`}
              >
                {cat}
                {cat !== "All" && (
                  <span className="ml-2 text-xs opacity-70">
                    {workflows.filter(w => w.category === cat).length}
                  </span>
                )}
              </Button>
            ))}
          </div>
        )}

        {/* Workflows Grid */}
        {hasAccess && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {visibleWorkflows.map((workflow) => {
            const Icon = workflow.icon;
            return (
              <Card
                key={workflow.id}
                className="p-6 hover-elevate active-elevate-2 cursor-pointer transition-all flex flex-col h-full shadow-sm hover:shadow-md"
                data-testid={`workflow-card-${workflow.id}`}
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="rounded-md bg-primary/10 w-12 h-12 flex items-center justify-center flex-shrink-0">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <Badge variant="secondary" className="mb-2 text-xs">
                      {workflow.category}
                    </Badge>
                    <h3 className="font-semibold text-foreground">
                      {workflow.title}
                    </h3>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground mb-4 flex-1">
                  {workflow.description}
                </p>

                <div className="mb-4">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Included templates:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {workflow.templates.slice(0, 2).map((template, idx) => (
                      <div key={idx} className="flex items-center gap-1 text-xs">
                        <FileText className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">{template}</span>
                      </div>
                    ))}
                    {workflow.templates.length > 2 && (
                      <span className="text-xs text-muted-foreground">
                        +{workflow.templates.length - 2} more
                      </span>
                    )}
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => handleViewWorkflow(workflow)}
                  data-testid={`button-view-workflow-${workflow.id}`}
                >
                  View workflow
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Card>
            );
          })}
        </div>
        )}

        {/* Help Section */}
        {hasAccess && (
          <Card className="mt-10 p-6 bg-muted/30">
            <div className="flex items-start gap-4 flex-wrap">
              <div className="p-3 rounded-md bg-primary/10 flex-shrink-0">
                <AlertCircle className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-[240px]">
                <h2 className="text-lg font-display font-semibold text-foreground mb-1">
                  Need help with a specific situation?
                </h2>
                <p className="text-sm text-muted-foreground">
                  These workflows are general guidance. For complex legal matters, consult an attorney in your state.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => setLocation('/contact')}
                data-testid="button-contact-support"
              >
                Contact Support
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </Card>
        )}

        {/* Workflow Detail Dialog */}
        <Dialog open={showWorkflowDialog} onOpenChange={setShowWorkflowDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="dialog-workflow-detail">
            {selectedWorkflow && (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="rounded-md bg-primary/10 w-12 h-12 flex items-center justify-center flex-shrink-0">
                      <selectedWorkflow.icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <DialogTitle className="text-left">{selectedWorkflow.title}</DialogTitle>
                      <Badge variant="secondary" className="mt-1 text-xs">
                        {selectedWorkflow.category}
                      </Badge>
                    </div>
                  </div>
                  <DialogDescription className="text-left pt-2">
                    {selectedWorkflow.description}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 pt-4">
                  {/* Steps */}
                  <div>
                    <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                      Step-by-step guide
                    </h3>
                    <ol className="space-y-3">
                      {selectedWorkflow.steps.map((step, idx) => (
                        <li key={idx} className="flex gap-3">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-semibold flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <span className="text-sm text-foreground pt-0.5">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  {/* Related Templates */}
                  <div className="pt-4 border-t">
                    <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      Related templates
                    </h3>
                    <div className="space-y-2">
                      {selectedWorkflow.templates.map((template, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleTemplateDownload(template)}
                          className="w-full flex items-center justify-between gap-2 p-3 rounded-lg bg-muted/50 text-sm hover-elevate active-elevate-2 transition-all"
                          data-testid={`button-download-template-${idx}`}
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="text-foreground">{template}</span>
                          </div>
                          {hasAccess ? (
                            <Download className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Lock className="h-4 w-4 text-muted-foreground" />
                          )}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                      {hasAccess 
                        ? "Click any template to download instantly"
                        : "Upgrade to access and download templates"}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setShowWorkflowDialog(false)}
                    className="flex-1"
                    data-testid="button-close-workflow"
                  >
                    Close
                  </Button>
                  <Button
                    onClick={() => {
                      setShowWorkflowDialog(false);
                      setTimeout(() => setLocation('/templates'), 100);
                    }}
                    className="flex-1"
                    data-testid="button-view-templates"
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    View Templates
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Upgrade Dialog */}
        <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
          <DialogContent data-testid="dialog-upgrade-required">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" />
                Upgrade Required
              </DialogTitle>
              <DialogDescription className="pt-4 space-y-3">
                <p>
                  Template downloads are available to active members only.
                </p>
                <p>
                  Subscribe for just <strong>$10/month</strong> or <strong>$100/year</strong> (includes 2 months free) to access our complete library of 245+ state-specific templates.
                </p>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setShowUpgradeDialog(false)}
                data-testid="button-cancel-upgrade"
              >
                Not Now
              </Button>
              <Button
                onClick={() => setLocation('/subscribe')}
                data-testid="button-go-to-subscribe"
              >
                Upgrade to Pro
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
