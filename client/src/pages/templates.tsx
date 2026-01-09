import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { getAccessToken } from "@/lib/queryClient";
import type { LegalUpdate } from "@shared/schema";
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
import { 
  FileText, 
  Download, 
  Search, 
  Filter, 
  Lock, 
  AlertTriangle, 
  ClipboardList, 
  UserCheck, 
  Scale, 
  MessageSquareWarning, 
  Bell, 
  Home,
  FolderOpen,
  X,
  ChevronDown
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Template } from "@shared/schema";
import { SessionExpired, isSessionExpiredError, hasExpiredSession } from "@/components/session-expired";

export default function Templates() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedState, setSelectedState] = useState<string>(user?.preferredState || "UT");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [highlightedTemplateId, setHighlightedTemplateId] = useState<string | null>(null);
  const templateRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const trialExpired = user?.subscriptionStatus === 'trialing' && user?.trialEndsAt && new Date(user.trialEndsAt).getTime() < Date.now();
  const isPayingMember = (user?.subscriptionStatus === 'active' || user?.subscriptionStatus === 'cancel_at_period_end' || (user?.subscriptionStatus === 'trialing' && !trialExpired) || user?.isAdmin === true);
  const isTrialing = user?.subscriptionStatus === 'trialing';

  const handleTemplateAction = async (action: 'download' | 'download-blank' | 'fill', templateId: string, format: 'pdf' | 'docx' = 'pdf') => {
    if (action === 'fill') {
      setLocation(`/templates/${templateId}/fill`);
    } else if (action === 'download-blank') {
      try {
        const formatLabel = format === 'docx' ? 'Word document' : 'PDF';
        toast({
          title: 'Download Started',
          description: `Your blank ${formatLabel} is being generated...`,
        });

        const token = getAccessToken();
        const response = await fetch(`/api/templates/${templateId}/download-blank?format=${format}`, {
          credentials: 'include',
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });

        if (response.status === 403) {
          setShowUpgradeDialog(true);
          return;
        }

        if (!response.ok) {
          throw new Error('Failed to download blank form');
        }

        const blob = await response.blob();
        const extension = format === 'docx' ? 'docx' : 'pdf';
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const contentDisposition = response.headers.get('Content-Disposition');
        const defaultFilename = `Rental_Application.${extension}`;
        const filename = contentDisposition?.match(/filename="(.+)"/)?.[1] || defaultFilename;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast({
          title: 'Download Complete',
          description: `Your blank ${formatLabel} has been downloaded successfully.`,
        });
      } catch (error) {
        toast({
          title: 'Download Failed',
          description: 'Failed to download blank form. Please try again.',
          variant: 'destructive',
        });
      }
    } else {
      try {
        toast({
          title: 'Download Started',
          description: 'Your template is being downloaded...',
        });

        const token = getAccessToken();
        const templateResponse = await fetch(`/api/templates/${templateId}`, {
          credentials: 'include',
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        
        if (templateResponse.status === 403) {
          setShowUpgradeDialog(true);
          return;
        }
        
        if (!templateResponse.ok) {
          throw new Error('Failed to fetch template details');
        }
        
        const template = await templateResponse.json();
        const fillableData = template.fillableFormData as { fields?: Array<{ id: string; label: string }> };
        
        const blankFieldValues: Record<string, string> = {};
        if (fillableData?.fields) {
          fillableData.fields.forEach(field => {
            blankFieldValues[field.id] = '___________________________';
          });
        }

        const response = await fetch(`/api/documents/generate?format=${format}`, {
          method: 'POST',
          credentials: 'include',
          body: JSON.stringify({ templateId, fieldValues: blankFieldValues }),
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
        });

        if (response.status === 403) {
          setShowUpgradeDialog(true);
          return;
        }

        if (!response.ok) {
          throw new Error('Failed to generate document');
        }

        const blob = await response.blob();
        const extension = format === 'docx' ? 'docx' : 'pdf';
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${template?.title.replace(/[^a-z0-9]/gi, '_') || 'template'}.${extension}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        const formatLabel = format === 'docx' ? 'Word document' : 'PDF';
        toast({
          title: 'Download Complete',
          description: `Your ${formatLabel} has been downloaded successfully.`,
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

  // Note: Removed auto-redirect to /login here - SessionExpired component handles 401s
  // Users who aren't logged in at all will see the !user return null below

  // Initialize filters from URL query parameters or user preferences
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const categoryParam = params.get('category');
    const stateParam = params.get('stateId');
    const highlightParam = params.get('highlight');
    
    if (categoryParam && categoryParam !== selectedCategory) {
      setSelectedCategory(categoryParam);
    }
    if (stateParam && stateParam !== selectedState) {
      setSelectedState(stateParam);
    } else if (user?.preferredState && !stateParam) {
      // If no URL param, use user's preferred state
      setSelectedState(user.preferredState);
    }
    // Handle highlight parameter for navigating from legal updates
    if (highlightParam) {
      setHighlightedTemplateId(highlightParam);
    }
  }, [user]); // Run when user loads

  // Fetch legal updates to identify recently updated templates
  const { data: legalUpdates } = useQuery<LegalUpdate[]>({
    queryKey: ["/api/legal-updates", selectedState],
    enabled: isAuthenticated && !!selectedState,
    queryFn: async () => {
      const url = `/api/legal-updates?stateId=${selectedState}`;
      const token = getAccessToken();
      const response = await fetch(url, { 
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (!response.ok) return [];
      return response.json();
    },
  });

  // Get template IDs that have been recently updated due to legal changes (within 30 days)
  const recentlyUpdatedTemplateIds = new Set(
    (legalUpdates || [])
      .filter(update => {
        if (!update.effectiveDate) return false;
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return new Date(update.effectiveDate) >= thirtyDaysAgo;
      })
      .flatMap(update => update.affectedTemplateIds || [])
  );

  const { data: templates, isLoading: templatesLoading, error: templatesError, refetch } = useQuery<Template[]>({
    queryKey: ["/api/templates", selectedState, selectedCategory],
    enabled: isAuthenticated,
    retry: 1,
    staleTime: 0,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedState && selectedState !== "all") {
        params.append("stateId", selectedState);
      }
      if (selectedCategory && selectedCategory !== "all") {
        params.append("category", selectedCategory);
      }
      const url = `/api/templates${params.toString() ? `?${params.toString()}` : ''}`;
      const token = getAccessToken();
      const response = await fetch(url, { 
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(errorData.message || 'Failed to fetch templates') as Error & { status?: number };
        error.status = response.status;
        throw error;
      }
      return response.json();
    },
  });

  // Scroll to highlighted template when it becomes available
  useEffect(() => {
    if (highlightedTemplateId && templateRefs.current[highlightedTemplateId]) {
      setTimeout(() => {
        templateRefs.current[highlightedTemplateId]?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
        // Remove highlight after a few seconds
        setTimeout(() => setHighlightedTemplateId(null), 3000);
      }, 300);
    }
  }, [highlightedTemplateId, templates]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading" />
      </div>
    );
  }

  // Check for session expired - either from 401 error or stale token with no auth
  if (isSessionExpiredError(templatesError)) {
    return <SessionExpired />;
  }
  
  // If not authenticated but has a token in storage, session expired
  if (!isLoading && !isAuthenticated && hasExpiredSession()) {
    return <SessionExpired />;
  }

  if (!user) return null;

  // Only show subscription CTA if API explicitly returns 403 (subscription required)
  const is403Error = templatesError && (templatesError as Error & { status?: number }).status === 403;
  if (is403Error) {
    return (
      <div className="flex-1 overflow-auto flex items-center justify-center">
        <Card className="p-12 bg-primary/10 border-primary/20 max-w-md">
          <div className="text-center">
            <FileText className="h-16 w-16 text-primary mx-auto mb-6" />
            <h2 className="text-2xl font-display font-semibold text-foreground mb-3">
              Subscribe to Access Templates
            </h2>
            <p className="text-muted-foreground mb-8">
              Get access to 37+ state-specific legal templates, automated wizards, and expert guidance
            </p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => refetch()} data-testid="button-retry-templates">
                Retry
              </Button>
              <Link to="/subscribe">
                <Button size="lg" data-testid="button-subscribe-templates-cta">
                  Subscribe Now
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>
    );
  }
  
  // For non-403 errors, show retry option
  if (templatesError) {
    return (
      <div className="flex-1 overflow-auto flex items-center justify-center">
        <Card className="p-12 max-w-md">
          <div className="text-center">
            <AlertTriangle className="h-16 w-16 text-amber-500 mx-auto mb-6" />
            <h2 className="text-2xl font-display font-semibold text-foreground mb-3">
              Unable to Load Templates
            </h2>
            <p className="text-muted-foreground mb-8">
              There was an issue loading templates. Please try again.
            </p>
            <Button onClick={() => refetch()} data-testid="button-retry-templates">
              Try Again
            </Button>
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

  // Category icon mapping
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'leasing': return ClipboardList;
      case 'screening': return UserCheck;
      case 'compliance': return Scale;
      case 'tenant_issues': return MessageSquareWarning;
      case 'notices': return Bell;
      case 'move_in_out': return Home;
      default: return FileText;
    }
  };

  // Category color mapping
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'leasing': return 'text-blue-600 dark:text-blue-400';
      case 'screening': return 'text-emerald-600 dark:text-emerald-400';
      case 'compliance': return 'text-purple-600 dark:text-purple-400';
      case 'tenant_issues': return 'text-red-600 dark:text-red-400';
      case 'notices': return 'text-amber-600 dark:text-amber-400';
      case 'move_in_out': return 'text-teal-600 dark:text-teal-400';
      default: return 'text-primary';
    }
  };

  const getCategoryBgColor = (category: string) => {
    switch (category) {
      case 'leasing': return 'bg-blue-100 dark:bg-blue-900/50';
      case 'screening': return 'bg-emerald-100 dark:bg-emerald-900/50';
      case 'compliance': return 'bg-purple-100 dark:bg-purple-900/50';
      case 'tenant_issues': return 'bg-red-100 dark:bg-red-900/50';
      case 'notices': return 'bg-amber-100 dark:bg-amber-900/50';
      case 'move_in_out': return 'bg-teal-100 dark:bg-teal-900/50';
      default: return 'bg-primary/20';
    }
  };

  // Count unique categories in templates
  const uniqueCategories = new Set(templates?.map(t => t.category) || []);
  const categoryCount = uniqueCategories.size;

  // Get most recent update date from templates
  const mostRecentUpdate = templates?.reduce((latest, template) => {
    const templateDate = template.updatedAt ? new Date(template.updatedAt) : null;
    if (!templateDate) return latest;
    return !latest || templateDate > latest ? templateDate : latest;
  }, null as Date | null) ?? null;

  const formatLastUpdated = (date: Date | null) => {
    if (!date) return 'Current';
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    // For older dates, just show "Current" since templates are always kept up-to-date
    return 'Current';
  };

  // Quick filter categories
  const quickFilterCategories = [
    { key: 'leasing', label: 'Leasing', icon: ClipboardList },
    { key: 'notices', label: 'Notices', icon: Bell },
    { key: 'screening', label: 'Screening', icon: UserCheck },
    { key: 'tenant_issues', label: 'Issues', icon: MessageSquareWarning },
    { key: 'compliance', label: 'Compliance', icon: Scale },
    { key: 'move_in_out', label: 'Move-In/Out', icon: Home },
  ];

  return (
    <div className="flex-1 overflow-auto">
      {/* Hero Header with Gradient */}
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 rounded-xl bg-primary/15">
                  <FolderOpen className="h-6 w-6 text-primary" />
                </div>
                <h1 className="text-3xl font-display font-semibold text-foreground">
                  Leases & Notices
                </h1>
              </div>
              <p className="text-muted-foreground max-w-2xl">
                <span className="font-medium text-foreground">Documents are updated as legislation changes. Older versions may create enforceability risk.</span>
              </p>
            </div>
            
            {/* Metrics */}
            <div className="flex flex-wrap gap-4 md:gap-6">
              <div className="text-center min-w-[60px]">
                <div className="text-2xl md:text-3xl font-bold text-primary">{templates?.length || 0}</div>
                <div className="text-xs md:text-sm text-muted-foreground">Templates</div>
              </div>
              <div className="text-center min-w-[60px]">
                <div className="text-2xl md:text-3xl font-bold text-primary">{categoryCount}</div>
                <div className="text-xs md:text-sm text-muted-foreground">Categories</div>
              </div>
              <div className="text-center min-w-[60px]">
                <div className="text-2xl md:text-3xl font-bold text-primary">14</div>
                <div className="text-xs md:text-sm text-muted-foreground">States</div>
              </div>
              <div className="text-center min-w-[60px]">
                <div className="text-2xl md:text-3xl font-bold text-primary">
                  {formatLastUpdated(mostRecentUpdate)}
                </div>
                <div className="text-xs md:text-sm text-muted-foreground">Updated</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Legal Disclaimer - More Compact */}
        <div className="mb-6 bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200/50 dark:border-amber-800/50 rounded-lg px-4 py-3">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Not Legal Advice:</strong> Templates must be reviewed by a licensed attorney. <Link to="/disclaimers" className="text-primary hover:underline" data-testid="link-disclaimers">Read disclaimers</Link>
            </p>
          </div>
        </div>

        {/* Filter Section */}
        <Card className="mb-6 p-4">
          <div className="space-y-4">
            {/* Search and Selects Row */}
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
                  <SelectItem value="WY">Wyoming</SelectItem>
                  <SelectItem value="CA">California</SelectItem>
                  <SelectItem value="VA">Virginia</SelectItem>
                  <SelectItem value="NV">Nevada</SelectItem>
                  <SelectItem value="AZ">Arizona</SelectItem>
                  <SelectItem value="FL">Florida</SelectItem>
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

            {/* Quick Filter Chips */}
            <div className="flex flex-wrap gap-2">
              {quickFilterCategories.map(({ key, label, icon: Icon }) => {
                const isSelected = selectedCategory === key;
                const colorClasses = {
                  leasing: 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600',
                  screening: 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600',
                  compliance: 'bg-purple-600 hover:bg-purple-700 text-white border-purple-600',
                  tenant_issues: 'bg-red-600 hover:bg-red-700 text-white border-red-600',
                  notices: 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600',
                  move_in_out: 'bg-teal-600 hover:bg-teal-700 text-white border-teal-600',
                }[key] || '';
                
                return (
                  <Button
                    key={key}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(selectedCategory === key ? "all" : key)}
                    data-testid={`button-quick-filter-${key}`}
                    className={`gap-1.5 ${isSelected ? colorClasses : ''}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </Button>
                );
              })}
            </div>

            {/* Active Filters & Results */}
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                {templatesLoading ? (
                  "Loading templates..."
                ) : (
                  <>
                    <span className="font-medium text-foreground">{filteredTemplates.length}</span>
                    {` ${filteredTemplates.length === 1 ? 'template' : 'templates'} found`}
                    {selectedState !== "all" && (
                      <Badge variant="secondary" className="ml-2 gap-1">
                        {selectedState}
                        <X 
                          className="h-3 w-3 cursor-pointer" 
                          onClick={() => setSelectedState("all")}
                        />
                      </Badge>
                    )}
                  </>
                )}
              </div>
              {(selectedState !== "all" || selectedCategory !== "all" || searchQuery) && (
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
                  Clear All
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* Templates Grid */}
        {templatesLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <div className="h-12 animate-pulse bg-muted" />
                <div className="p-5 space-y-3">
                  <div className="h-5 animate-pulse bg-muted rounded w-3/4" />
                  <div className="h-4 animate-pulse bg-muted rounded w-full" />
                  <div className="h-4 animate-pulse bg-muted rounded w-2/3" />
                  <div className="h-9 animate-pulse bg-muted rounded mt-4" />
                </div>
              </Card>
            ))}
          </div>
        ) : filteredTemplates.length === 0 ? (
          <Card className="p-12">
            <div className="max-w-md mx-auto text-center">
              <div className="p-4 rounded-full bg-muted/50 w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                <Search className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-xl mb-2 text-foreground">No templates found</h3>
              <p className="text-muted-foreground mb-6">
                We couldn't find any templates matching your current filters. Try adjusting your search or browse all templates.
              </p>
              <div className="flex gap-3 justify-center">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedState("all");
                    setSelectedCategory("all");
                  }}
                  data-testid="button-reset-search"
                >
                  <Filter className="mr-2 h-4 w-4" />
                  Reset Filters
                </Button>
                <Button
                  variant="default"
                  onClick={() => setSelectedState(user?.preferredState || "UT")}
                  data-testid="button-view-state-templates"
                >
                  View {user?.preferredState || "UT"} Templates
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.map((template) => {
              const CategoryIcon = getCategoryIcon(template.category);
              const categoryColor = getCategoryColor(template.category);
              const categoryBgColor = getCategoryBgColor(template.category);
              const isHighlighted = highlightedTemplateId === template.id;
              const isRecentlyUpdated = recentlyUpdatedTemplateIds.has(template.id);
              
              return (
                <Card
                  key={template.id}
                  ref={(el: HTMLDivElement | null) => { templateRefs.current[template.id] = el; }}
                  className={`overflow-hidden hover-elevate transition-all flex flex-col ${
                    isHighlighted ? 'ring-2 ring-primary ring-offset-2 ring-offset-background animate-pulse' : ''
                  }`}
                  data-testid={`template-card-${template.id}`}
                >
                  {/* Card Header with Category */}
                  <div className={`px-5 py-3 ${categoryBgColor}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-md ${
                          template.category === 'leasing' ? 'bg-blue-200/50 dark:bg-blue-800/50' :
                          template.category === 'screening' ? 'bg-emerald-200/50 dark:bg-emerald-800/50' :
                          template.category === 'compliance' ? 'bg-purple-200/50 dark:bg-purple-800/50' :
                          template.category === 'tenant_issues' ? 'bg-red-200/50 dark:bg-red-800/50' :
                          template.category === 'notices' ? 'bg-amber-200/50 dark:bg-amber-800/50' :
                          template.category === 'move_in_out' ? 'bg-teal-200/50 dark:bg-teal-800/50' :
                          'bg-primary/30'
                        }`}>
                          <CategoryIcon className={`h-4 w-4 ${categoryColor}`} />
                        </div>
                        <span className={`text-sm font-medium ${categoryColor}`}>
                          {categoryLabels[template.category]}
                        </span>
                      </div>
                      <StateBadge stateId={template.stateId} />
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-5 flex flex-col flex-1">
                    <h3 className="font-semibold text-foreground mb-2 line-clamp-2">
                      {template.title}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4 flex-1 line-clamp-3">
                      {template.description}
                    </p>

                    {/* Format Badge */}
                    <div className="mb-4 flex flex-wrap gap-2">
                      {template.fillableFormData ? (
                        <Badge variant="outline" className="text-xs gap-1">
                          <FileText className="h-3 w-3" />
                          Fillable Form
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs gap-1">
                          <Download className="h-3 w-3" />
                          PDF Download
                        </Badge>
                      )}
                      {isRecentlyUpdated && (
                        <Badge 
                          variant="default" 
                          className="text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                          data-testid={`badge-recently-updated-${template.id}`}
                        >
                          <Bell className="h-3 w-3" />
                          Recently Updated
                        </Badge>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      {template.generationMode === 'static' ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="default"
                              size="sm"
                              className="flex-1"
                              data-testid={`button-download-blank-${template.id}`}
                            >
                              <Download className="mr-2 h-4 w-4" />
                              Download
                              <ChevronDown className="h-3 w-3 ml-1" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuItem
                              onClick={() => handleTemplateAction('download-blank', template.id, 'pdf')}
                              data-testid={`button-download-blank-pdf-${template.id}`}
                            >
                              <FileText className="h-4 w-4 mr-2" />
                              Download PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleTemplateAction('download-blank', template.id, 'docx')}
                              data-testid={`button-download-blank-docx-${template.id}`}
                            >
                              <FileText className="h-4 w-4 mr-2" />
                              Download Word
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <>
                          {template.fillableFormData ? (
                            <>
                              <Button
                                variant="default"
                                size="sm"
                                className="flex-1"
                                onClick={() => handleTemplateAction('fill', template.id)}
                                data-testid={`button-fill-${template.id}`}
                              >
                                Fill Online
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    data-testid={`button-download-${template.id}`}
                                  >
                                    <Download className="h-4 w-4" />
                                    <ChevronDown className="h-3 w-3 ml-1" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => handleTemplateAction('download', template.id, 'pdf')}
                                    data-testid={`button-download-pdf-${template.id}`}
                                  >
                                    <FileText className="h-4 w-4 mr-2" />
                                    Download PDF
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleTemplateAction('download', template.id, 'docx')}
                                    data-testid={`button-download-docx-${template.id}`}
                                  >
                                    <FileText className="h-4 w-4 mr-2" />
                                    Download Word
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </>
                          ) : (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="flex-1"
                                  data-testid={`button-download-${template.id}`}
                                >
                                  <Download className="mr-2 h-4 w-4" />
                                  Download
                                  <ChevronDown className="h-3 w-3 ml-1" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start">
                                <DropdownMenuItem
                                  onClick={() => handleTemplateAction('download', template.id, 'pdf')}
                                  data-testid={`button-download-pdf-${template.id}`}
                                >
                                  <FileText className="h-4 w-4 mr-2" />
                                  Download PDF
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleTemplateAction('download', template.id, 'docx')}
                                  data-testid={`button-download-docx-${template.id}`}
                                >
                                  <FileText className="h-4 w-4 mr-2" />
                                  Download Word
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
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
                  Upgrade now for just <strong>$10/month</strong> or <strong>$100/year</strong> (save $20) to access our complete library of 37+ state-specific templates.
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
