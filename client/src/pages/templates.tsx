import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StateBadge } from "@/components/state-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileText, Download, Search, Filter, Lock, AlertTriangle } from "lucide-react";
import type { Template } from "@shared/schema";

export default function Templates() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedState, setSelectedState] = useState<string>(user?.preferredState || "UT");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);

  const isPayingMember = user?.subscriptionStatus === 'active' || user?.isAdmin === true;
  const isTrialing = user?.subscriptionStatus === 'trialing';

  const handleTemplateAction = async (action: 'download' | 'fill', templateId: string) => {
    if (!isPayingMember) {
      setShowUpgradeDialog(true);
      return;
    }

    if (action === 'fill') {
      // Navigate to document wizard
      setLocation(`/templates/${templateId}/fill`);
    } else {
      // Download blank template
      try {
        toast({
          title: 'Download Started',
          description: 'Your template is being downloaded...',
        });

        // Fetch template details to get field definitions
        const templateResponse = await fetch(`/api/templates/${templateId}`, {
          credentials: 'include',
        });
        
        if (!templateResponse.ok) {
          throw new Error('Failed to fetch template details');
        }
        
        const template = await templateResponse.json();
        const fillableData = template.fillableFormData as { fields?: Array<{ id: string; label: string }> };
        
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
          body: JSON.stringify({ templateId, fieldValues: blankFieldValues }),
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to generate document');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${template?.title.replace(/[^a-z0-9]/gi, '_') || 'template'}.pdf`;
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
          title: 'Download Failed',
          description: 'Failed to download template. Please try again.',
          variant: 'destructive',
        });
      }
    }
  };

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

  // Initialize filters from URL query parameters or user preferences
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const categoryParam = params.get('category');
    const stateParam = params.get('stateId');
    
    if (categoryParam && categoryParam !== selectedCategory) {
      setSelectedCategory(categoryParam);
    }
    if (stateParam && stateParam !== selectedState) {
      setSelectedState(stateParam);
    } else if (user?.preferredState && !stateParam) {
      // If no URL param, use user's preferred state
      setSelectedState(user.preferredState);
    }
  }, [user]); // Run when user loads

  const { data: templates, isLoading: templatesLoading, error: templatesError } = useQuery<Template[]>({
    queryKey: ["/api/templates", selectedState, selectedCategory],
    enabled: isAuthenticated,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedState && selectedState !== "all") {
        params.append("stateId", selectedState);
      }
      if (selectedCategory && selectedCategory !== "all") {
        params.append("category", selectedCategory);
      }
      const url = `/api/templates${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Failed to fetch templates');
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
  if (templatesError) {
    return (
      <div className="flex-1 overflow-auto flex items-center justify-center">
        <Card className="p-12 bg-primary/10 border-primary/20 max-w-md">
          <div className="text-center">
            <FileText className="h-16 w-16 text-primary mx-auto mb-6" />
            <h2 className="text-2xl font-display font-semibold text-foreground mb-3">
              Subscribe to receive updates
            </h2>
            <p className="text-muted-foreground mb-8">
              Get access to 37+ state-specific legal templates, automated wizards, and expert guidance
            </p>
            <Link to="/subscribe">
              <Button size="lg" data-testid="button-subscribe-templates-cta">
                Subscribe Now
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const filteredTemplates = templates?.filter((template) => {
    const matchesSearch = template.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  }) || [];

  const categoryLabels: Record<string, string> = {
    leasing: "Leasing",
    screening: "Screening",
    compliance: "Compliance",
    tenant_issues: "Tenant Issues",
    notices: "Notices",
    move_in_out: "Move-In/Out",
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-display font-semibold text-foreground mb-2">
            Template Library
          </h1>
          <p className="text-muted-foreground">
            State-specific templates ready to download or fill online
          </p>
        </div>

        {/* Legal Disclaimer */}
        <div className="mb-8 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-foreground">
                <strong>Not Legal Advice:</strong> These templates are general forms for informational purposes only. 
                They must be customized for your specific situation and reviewed by a licensed attorney. Using these 
                templates does not create an attorney-client relationship. <Link to="/disclaimers" className="text-primary hover:underline" data-testid="link-disclaimers">Read full disclaimers</Link>
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-8">
          <div className="grid md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-templates"
                />
              </div>
            </div>
            <Select value={selectedState} onValueChange={setSelectedState}>
              <SelectTrigger data-testid="select-state-filter">
                <SelectValue placeholder="All States" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                <SelectItem value="UT">Utah</SelectItem>
                <SelectItem value="TX">Texas</SelectItem>
                <SelectItem value="ND">North Dakota</SelectItem>
                <SelectItem value="SD">South Dakota</SelectItem>
                <SelectItem value="NC">North Carolina</SelectItem>
                <SelectItem value="OH">Ohio</SelectItem>
                <SelectItem value="MI">Michigan</SelectItem>
                <SelectItem value="ID">Idaho</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger data-testid="select-category-filter">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="leasing">Leasing</SelectItem>
                <SelectItem value="screening">Screening</SelectItem>
                <SelectItem value="compliance">Compliance</SelectItem>
                <SelectItem value="tenant_issues">Tenant Issues</SelectItem>
                <SelectItem value="notices">Notices</SelectItem>
                <SelectItem value="move_in_out">Move-In/Out</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Results Count */}
        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {templatesLoading ? (
              "Loading templates..."
            ) : (
              `${filteredTemplates.length} ${filteredTemplates.length === 1 ? 'template' : 'templates'} found`
            )}
          </p>
          {(selectedState !== "all" || selectedCategory !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedState("all");
                setSelectedCategory("all");
                setSearchQuery("");
              }}
              data-testid="button-clear-filters"
            >
              <Filter className="mr-2 h-4 w-4" />
              Clear Filters
            </Button>
          )}
        </div>

        {/* Templates Grid */}
        {templatesLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="p-6">
                <div className="h-40 animate-pulse bg-muted rounded-md" />
              </Card>
            ))}
          </div>
        ) : filteredTemplates.length === 0 ? (
          <Card className="p-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">No templates found</h3>
            <p className="text-muted-foreground mb-4">
              Try adjusting your search or filter criteria
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery("");
                setSelectedState("all");
                setSelectedCategory("all");
              }}
              data-testid="button-reset-search"
            >
              Reset Filters
            </Button>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.map((template) => (
              <Card
                key={template.id}
                className="p-6 hover-elevate transition-all flex flex-col"
                data-testid={`template-card-${template.id}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="rounded-lg bg-primary/10 w-12 h-12 flex items-center justify-center flex-shrink-0">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    <StateBadge stateId={template.stateId} />
                    <Badge variant="secondary" className="text-xs">
                      {categoryLabels[template.category]}
                    </Badge>
                  </div>
                </div>

                <h3 className="font-semibold text-foreground mb-2 line-clamp-2">
                  {template.title}
                </h3>
                <p className="text-sm text-muted-foreground mb-4 flex-1 line-clamp-3">
                  {template.description}
                </p>

                <div className="flex gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleTemplateAction('download', template.id)}
                    data-testid={`button-download-${template.id}`}
                  >
                    {!isPayingMember ? (
                      <Lock className="mr-2 h-4 w-4" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    Download
                  </Button>
                  {template.fillableFormData ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleTemplateAction('fill', template.id)}
                      data-testid={`button-fill-${template.id}`}
                    >
                      {!isPayingMember && <Lock className="mr-2 h-4 w-4" />}
                      Fill Online
                    </Button>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        )}

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
                  Template downloads are available to paying members only.
                  {isTrialing && " Your free trial gives you access to all other features, but templates require a paid subscription."}
                </p>
                <p>
                  Upgrade now for just <strong>$10/month</strong> to access our complete library of 37+ state-specific templates.
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
