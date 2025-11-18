import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  FileText,
  DollarSign,
  Home,
  UserX,
  ArrowRight,
  TrendingUp,
} from "lucide-react";

const workflows = [
  {
    id: "late-rent",
    title: "Late Rent Payment",
    description: "Step-by-step process for handling late rent, from first notice to legal action",
    icon: DollarSign,
    category: "Payment Issues",
    templates: ["Late rent notice", "Payment plan agreement", "Pay or quit notice"],
  },
  {
    id: "lease-violation",
    title: "Lease Violations",
    description: "Document and address lease violations while maintaining Fair Housing compliance",
    icon: AlertCircle,
    category: "Violations",
    templates: ["Violation notice", "Cure or quit notice", "Incident documentation"],
  },
  {
    id: "property-damage",
    title: "Property Damage",
    description: "Document damage, communicate with tenants, and handle security deposit deductions",
    icon: Home,
    category: "Property Issues",
    templates: ["Damage documentation form", "Repair cost estimate", "Deposit deduction letter"],
  },
  {
    id: "esa-pets",
    title: "ESA vs. Pets",
    description: "Verify emotional support animal requests and handle documentation requirements",
    icon: Home,
    category: "Animals",
    templates: ["ESA verification request", "ESA acceptance letter", "Pet policy addendum"],
  },
  {
    id: "rent-increase",
    title: "Rent Increases",
    description: "Legally notify tenants of rent increases with proper timing and documentation",
    icon: TrendingUp,
    category: "Lease Changes",
    templates: ["Rent increase notice", "Lease renewal with increase", "Month-to-month notice"],
  },
  {
    id: "non-renewal",
    title: "Non-Renewal & Move-Out",
    description: "End tenancies properly with correct notices and move-out procedures",
    icon: UserX,
    category: "Lease Termination",
    templates: ["Non-renewal notice", "Move-out checklist", "Security deposit return"],
  },
];

export default function TenantIssues() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();

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
            Tenant Issue Toolkit
          </h1>
          <p className="text-muted-foreground">
            Step-by-step workflows for handling common landlord challenges
          </p>
        </div>

        {/* Workflows Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workflows.map((workflow) => {
            const Icon = workflow.icon;
            return (
              <Card
                key={workflow.id}
                className="p-6 hover-elevate active-elevate-2 cursor-pointer transition-all"
                data-testid={`workflow-card-${workflow.id}`}
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="rounded-lg bg-primary/10 w-12 h-12 flex items-center justify-center flex-shrink-0">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <Badge variant="secondary" className="mb-2 text-xs">
                      {workflow.category}
                    </Badge>
                    <h3 className="font-semibold text-foreground mb-2">
                      {workflow.title}
                    </h3>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground mb-4">
                  {workflow.description}
                </p>

                <div className="mb-4">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Included Templates:
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
                  data-testid={`button-view-workflow-${workflow.id}`}
                >
                  View Workflow
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Card>
            );
          })}
        </div>

        {/* Help Section */}
        <Card className="mt-12 p-8 bg-muted/30">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl font-display font-semibold text-foreground mb-4">
              Need Help with a Specific Situation?
            </h2>
            <p className="text-muted-foreground mb-6">
              Every landlord situation is unique. These workflows provide general guidance, but
              for complex legal matters, consider consulting with an attorney in your state.
            </p>
            <Button variant="outline" data-testid="button-contact-support">
              Contact Support
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
