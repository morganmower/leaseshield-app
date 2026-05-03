import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  ArrowRight,
  Bell,
  ClipboardList,
  FileText,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Inbox,
  Activity,
  Home,
  Receipt,
  Scale,
  Send,
} from "lucide-react";
import { Link } from "wouter";
import { ThemeToggle } from "@/components/theme-toggle";

type AttentionItem = {
  id: string;
  type: string;
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
  timestamp?: string;
};

type ActivityItem = {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  href?: string;
};

type DashboardData = {
  stats: {
    propertiesCount: number;
    activeApplicationsCount: number;
    reportsToReviewCount: number;
    updatesThisMonthCount: number;
  };
  attention: AttentionItem[];
  activity: ActivityItem[];
};

function relativeTime(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso).getTime();
  if (!Number.isFinite(d)) return "";
  const diff = Date.now() - d;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

function priorityIcon(type: string) {
  switch (type) {
    case "report_ready":
      return <Search className="h-4 w-4 text-emerald-600 dark:text-emerald-500" />;
    case "needs_screening":
      return <Send className="h-4 w-4 text-primary" />;
    case "screening_in_progress":
      return <ClipboardList className="h-4 w-4 text-cyan-600 dark:text-cyan-500" />;
    case "overdue_rent":
      return <Receipt className="h-4 w-4 text-amber-600 dark:text-amber-500" />;
    case "legal_update":
      return <Scale className="h-4 w-4 text-blue-600 dark:text-blue-500" />;
    default:
      return <Bell className="h-4 w-4 text-muted-foreground" />;
  }
}

export default function Dashboard() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();

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
    }
  }, [isAuthenticated, isLoading, toast]);

  useEffect(() => {
    if (user && !isLoading) {
      localStorage.setItem("leaseshield_tour_seen", "true");
    }
  }, [user, isLoading]);

  const { data, isLoading: dataLoading, isError, refetch } = useQuery<DashboardData>({
    queryKey: ["/api/dashboard/attention"],
    enabled: isAuthenticated,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div
          className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"
          aria-label="Loading"
        />
      </div>
    );
  }

  if (!user) return null;

  const isTrialing = user.subscriptionStatus === "trialing";
  const isIncomplete = user.subscriptionStatus === "incomplete";
  const trialExpired =
    isTrialing && user.trialEndsAt && new Date(user.trialEndsAt).getTime() < Date.now();
  const needsSubscription =
    isTrialing || isIncomplete || !user.stripeCustomerId || !user.subscriptionStatus;

  // Trial expired blocking screen kept (conversion gate)
  if (trialExpired) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <Bell className="h-16 w-16 text-primary mx-auto mb-4" />
          <h1 className="text-3xl font-display font-semibold text-foreground mb-2">
            Activate Your Account
          </h1>
          <p className="text-muted-foreground mb-8">
            Subscribe now to access all templates, compliance guidance, and AI tools.
          </p>
          <div className="flex flex-col gap-3">
            <Link to="/subscribe?period=monthly">
              <Button size="lg" className="w-full" data-testid="button-subscribe-monthly">
                Subscribe - $10/month
              </Button>
            </Link>
            <Link to="/subscribe?period=yearly">
              <Button
                size="lg"
                variant="outline"
                className="w-full"
                data-testid="button-subscribe-yearly"
              >
                Subscribe - $100/year
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const stats = data?.stats;
  const attention = data?.attention || [];
  const activity = data?.activity || [];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Header */}
      <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-b">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-primary/10 rounded-md">
                <Home className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1
                  className="text-3xl sm:text-4xl font-display font-semibold text-foreground mb-1"
                  data-testid="text-welcome"
                >
                  Welcome back{user.firstName ? `, ${user.firstName}` : ""}
                </h1>
                <p className="text-sm sm:text-base text-muted-foreground">
                  Here's what needs your attention today.
                </p>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </div>

      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* Single contextual banner - only one, never stacked */}
        {needsSubscription && user.subscriptionStatus !== "active" && (
          <Card
            className="mb-6 p-4 bg-primary/10 border-primary/20"
            data-testid="banner-subscription"
          >
            <div className="flex items-start gap-3 flex-wrap">
              <Bell className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-[200px]">
                <p className="font-medium text-foreground">
                  Subscribe to unlock everything
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  $10/month gets you all templates, compliance, and AI tools.
                </p>
              </div>
              <Link to="/subscribe">
                <Button size="sm" data-testid="button-subscribe-now">
                  Subscribe Now
                </Button>
              </Link>
            </div>
          </Card>
        )}

        {/* Stats strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Properties"
            value={stats?.propertiesCount}
            loading={dataLoading}
            icon={<Building2 className="h-10 w-10 text-primary/30" />}
            href="/properties"
            zeroHint="Add your first property"
            testId="stat-properties"
          />
          <StatCard
            label="Active applications"
            value={stats?.activeApplicationsCount}
            loading={dataLoading}
            icon={<ClipboardList className="h-10 w-10 text-primary/30" />}
            href="/rental-applications"
            zeroHint="Start new screening"
            testId="stat-applications"
          />
          <StatCard
            label="Reports to review"
            value={stats?.reportsToReviewCount}
            loading={dataLoading}
            highlight={(stats?.reportsToReviewCount ?? 0) > 0}
            icon={<Search className="h-10 w-10 text-primary/30" />}
            href="/rental-applications"
            zeroHint="Run your first decode"
            testId="stat-reports"
          />
          <StatCard
            label="Updates this month"
            value={stats?.updatesThisMonthCount}
            loading={dataLoading}
            icon={<Scale className="h-10 w-10 text-primary/30" />}
            href="/legal-updates"
            zeroHint="No new laws - you're current"
            testId="stat-updates"
          />
        </div>

        {/* Needs your attention */}
        <Card className="mb-6 p-5" data-testid="section-attention">
          <div className="flex items-center justify-between mb-4 gap-3">
            <div className="flex items-center gap-2">
              <Inbox className="h-5 w-5 text-foreground" />
              <h2 className="text-lg font-display font-semibold text-foreground">
                Needs your attention
              </h2>
              {attention.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {attention.length}
                </Badge>
              )}
            </div>
          </div>

          {dataLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : isError ? (
            <div className="text-center py-8" data-testid="error-attention">
              <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
              <p className="font-medium text-foreground">We couldn't load your inbox</p>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                Check your connection and try again.
              </p>
              <Button size="sm" variant="outline" onClick={() => refetch()} data-testid="button-retry-attention">
                Try again
              </Button>
            </div>
          ) : attention.length === 0 ? (
            <div className="text-center py-8" data-testid="empty-attention">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
              <p className="font-medium text-foreground">You're all caught up</p>
              <p className="text-sm text-muted-foreground mt-1">
                When applications come in or reports are ready, they'll show up here.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {attention.map((item) => (
                <Link
                  key={item.id}
                  to={item.actionHref}
                  data-testid={`attention-${item.id}`}
                >
                  <div className="flex items-start gap-3 p-3 rounded-md border bg-background hover-elevate active-elevate-2 cursor-pointer">
                    <div className="mt-0.5 flex-shrink-0">{priorityIcon(item.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-foreground text-sm">
                          {item.title}
                        </p>
                        {item.priority === "high" && (
                          <Badge
                            variant="secondary"
                            className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-xs"
                          >
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Action needed
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {item.description}
                      </p>
                      {item.timestamp && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {relativeTime(item.timestamp)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-primary font-medium flex-shrink-0">
                      <span className="hidden sm:inline">{item.actionLabel}</span>
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Quick actions - applications + decoder lead */}
        <Card className="mb-6 p-6" data-testid="section-quick-actions">
          <h2 className="text-xl font-display font-semibold text-foreground mb-1">
            Quick actions
          </h2>
          <p className="text-sm text-muted-foreground mb-5">
            Jump into the most common tasks.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <QuickAction
              href="/screening"
              icon={<Search className="h-7 w-7" />}
              label="Decode a report"
              primary
              testId="quick-decode"
            />
            <QuickAction
              href="/rental-applications"
              icon={<ClipboardList className="h-7 w-7" />}
              label="New application"
              primary
              testId="quick-application"
            />
            <QuickAction
              href="/templates"
              icon={<FileText className="h-7 w-7" />}
              label="Browse templates"
              testId="quick-templates"
            />
            <QuickAction
              href="/templates?type=notices"
              icon={<Send className="h-7 w-7" />}
              label="Send a notice"
              testId="quick-notice"
            />
            <QuickAction
              href="/rent-ledger"
              icon={<Receipt className="h-7 w-7" />}
              label="Log rent"
              testId="quick-rent"
            />
          </div>
        </Card>

        {/* Compliance snapshot - uses real updates count, links to /compliance */}
        <Card className="mb-6 p-6" data-testid="section-compliance-snapshot">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-4 min-w-0">
              <div className="p-3 rounded-md bg-primary/10 flex-shrink-0">
                <Scale className="h-6 w-6 text-primary" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-display font-semibold text-foreground">
                  Compliance snapshot
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {(stats?.updatesThisMonthCount ?? 0) === 0 ? (
                    <>
                      No new {user.preferredState ? `${user.preferredState} ` : ""}laws this month - you're current with state requirements.
                    </>
                  ) : (
                    <>
                      <span className="font-medium text-foreground">
                        {stats?.updatesThisMonthCount} update{(stats?.updatesThisMonthCount ?? 0) === 1 ? "" : "s"}
                      </span>{" "}
                      this month{user.preferredState ? ` for ${user.preferredState}` : ""}. Review them to stay compliant.
                    </>
                  )}
                </p>
              </div>
            </div>
            <Link to="/compliance">
              <Button variant="outline" size="sm" data-testid="button-view-compliance">
                View compliance
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </Card>

        {/* Recent activity */}
        <Card className="mb-6 p-6" data-testid="section-activity">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="h-5 w-5 text-foreground" />
            <h2 className="text-xl font-display font-semibold text-foreground">
              Recent activity
            </h2>
          </div>
          <p className="text-sm text-muted-foreground mb-5">
            Updates from the last week.
          </p>
          {dataLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : activity.length === 0 ? (
            <div className="text-center py-8" data-testid="empty-activity">
              <Activity className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                No activity yet. Try decoding your first tenant report or logging rent to see updates here.
              </p>
              <div className="flex gap-2 justify-center flex-wrap">
                <Link to="/screening">
                  <Button variant="outline" size="sm" data-testid="button-empty-activity-decode">
                    <Search className="mr-2 h-4 w-4" />
                    Decode a report
                  </Button>
                </Link>
                <Link to="/rent-ledger">
                  <Button variant="outline" size="sm" data-testid="button-empty-activity-rent">
                    <Receipt className="mr-2 h-4 w-4" />
                    Log rent
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <ul className="divide-y">
              {activity.map((a) => (
                <li key={a.id} className="py-2.5 flex items-center gap-3">
                  <Activity className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="flex-1 text-sm text-foreground">{a.description}</span>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {relativeTime(a.timestamp)}
                  </span>
                  {a.href && (
                    <Link to={a.href} className="flex-shrink-0">
                      <Button variant="ghost" size="sm" data-testid={`activity-link-${a.id}`}>
                        Open
                      </Button>
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <p className="text-xs text-muted-foreground text-center pt-4 border-t">
          Built for compliance-minded landlords. Always confirm local requirements with counsel.
        </p>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  loading,
  icon,
  href,
  highlight,
  zeroHint,
  testId,
}: {
  label: string;
  value?: number;
  loading?: boolean;
  icon: React.ReactNode;
  href: string;
  highlight?: boolean;
  zeroHint?: string;
  testId: string;
}) {
  const isZero = !loading && (value ?? 0) === 0;
  return (
    <Link to={href} data-testid={testId}>
      <Card
        className={`p-6 hover-elevate active-elevate-2 cursor-pointer transition-all h-full ${
          highlight ? "border-amber-500/40" : ""
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted-foreground">{label}</p>
            {loading ? (
              <Skeleton className="h-10 w-16 mt-2" />
            ) : (
              <p
                className={`text-4xl font-semibold tabular-nums mt-2 ${
                  highlight ? "text-amber-600 dark:text-amber-500" : "text-foreground"
                }`}
              >
                {value ?? 0}
              </p>
            )}
            {isZero && zeroHint && (
              <p
                className="text-xs text-primary mt-2 flex items-center gap-1"
                data-testid={`${testId}-zero-hint`}
              >
                {zeroHint}
                <ArrowRight className="h-3 w-3" />
              </p>
            )}
          </div>
          <div className="flex-shrink-0">{icon}</div>
        </div>
      </Card>
    </Link>
  );
}

function QuickAction({
  href,
  icon,
  label,
  primary,
  testId,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  primary?: boolean;
  testId: string;
}) {
  return (
    <Link to={href} data-testid={testId}>
      <Card
        className={`group p-6 hover-elevate active-elevate-2 cursor-pointer transition-all flex flex-col items-center justify-center text-center gap-3 min-h-[120px] h-full shadow-sm hover:shadow-md ${
          primary ? "border-primary/40 bg-primary/5" : ""
        }`}
      >
        <div
          className={`p-2.5 rounded-md transition-colors ${
            primary ? "bg-primary/15 text-primary" : "bg-primary/5 text-primary/80 group-hover:bg-primary/10"
          }`}
        >
          {icon}
        </div>
        <span className="text-sm font-medium text-foreground">{label}</span>
      </Card>
    </Link>
  );
}
