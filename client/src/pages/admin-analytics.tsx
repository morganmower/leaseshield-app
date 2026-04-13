import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Users, TrendingUp, Download, MousePointerClick, FileText, ChevronRight, Calendar } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format, subDays, subMonths, startOfYear } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AnalyticsSummary {
  subscriptions: {
    total: number;
    active: number;
    inactive: number;
    canceled: number;
    mrr: number;
  };
  conversion: {
    activationRate: number;
    totalUsers: number;
    activatedUsers: number;
  };
  usage: {
    totalDownloads: number;
    applicationsSubmitted: number;
    screeningRequests: number;
    creditHelperUses: number;
    criminalHelperUses: number;
    avgDownloadsPerUser: number;
  };
}

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  subscriptionEndsAt: string | null;
  createdAt: string;
  isAdmin: boolean | null;
}

interface EngagementEvent {
  id: string;
  eventType: string;
  eventData: any;
  createdAt: string | null;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
}

const eventTypeLabels: Record<string, string> = {
  template_download: 'Template Download',
  screening_request: 'Background Check Sent',
  credit_helper_use: 'Credit Helper Use',
  criminal_helper_use: 'Criminal Helper Use',
  compliance_card_view: 'Compliance Card View',
  legal_update_view: 'Legal Update View',
};

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface MonthlySummary {
  month: number;
  year: number;
  templateDownloads: number;
  screeningRequests: number;
  creditHelperUses: number;
  criminalHelperUses: number;
  totalEvents: number;
}

interface MrrHistoryEntry {
  label: string;
  year: number;
  month: number;
  mrr: number;
  subscribers: number;
}

interface FunnelStage {
  label: string;
  count: number;
}

interface FunnelResponse {
  stages: FunnelStage[];
  from: string | null;
  to: string | null;
}

type FunnelPreset = "all" | "30d" | "90d" | "12m" | "ytd" | "custom";

interface UserEngagementRow {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  subscriptionStatus: string | null;
  subscribedAt: string | null;
  createdAt: string;
  lastActiveAt: string | null;
  templateDownloads: number | string;
  applicationsSent: number | string;
  screeningRequests: number | string;
}

export default function AdminAnalyticsPage() {
  const [engagementDialogOpen, setEngagementDialogOpen] = useState(false);
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [viewMode, setViewMode] = useState<"monthly" | "yearly">("monthly");
  const [userEngagementSort, setUserEngagementSort] = useState<"lastActive" | "downloads" | "applications" | "screenings">("lastActive");

  // Funnel date filter
  const [funnelPreset, setFunnelPreset] = useState<FunnelPreset>("all");
  const [funnelCustomFrom, setFunnelCustomFrom] = useState<string>("");
  const [funnelCustomTo, setFunnelCustomTo] = useState<string>("");

  const funnelDateParams = useMemo(() => {
    const today = new Date();
    const toISO = (d: Date) => d.toISOString().slice(0, 10);
    switch (funnelPreset) {
      case "30d":  return { from: toISO(subDays(today, 30)), to: toISO(today) };
      case "90d":  return { from: toISO(subDays(today, 90)), to: toISO(today) };
      case "12m":  return { from: toISO(subMonths(today, 12)), to: toISO(today) };
      case "ytd":  return { from: toISO(startOfYear(today)), to: toISO(today) };
      case "custom": return {
        from: funnelCustomFrom || null,
        to: funnelCustomTo || null,
      };
      default: return { from: null, to: null };
    }
  }, [funnelPreset, funnelCustomFrom, funnelCustomTo]);

  const { data: analytics, isLoading } = useQuery<AnalyticsSummary>({
    queryKey: ["/api/admin/analytics"],
  });

  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  const { data: mrrHistory } = useQuery<MrrHistoryEntry[]>({
    queryKey: ["/api/admin/analytics/mrr-history"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/analytics/mrr-history");
      return res.json();
    },
  });

  const { data: funnelData } = useQuery<FunnelResponse>({
    queryKey: ["/api/admin/analytics/funnel", funnelDateParams],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (funnelDateParams.from) params.set("from", funnelDateParams.from);
      if (funnelDateParams.to) params.set("to", funnelDateParams.to);
      const qs = params.toString();
      const res = await apiRequest("GET", `/api/admin/analytics/funnel${qs ? `?${qs}` : ""}`);
      return res.json();
    },
  });

  const { data: userEngagement } = useQuery<UserEngagementRow[]>({
    queryKey: ["/api/admin/analytics/users"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/analytics/users");
      return res.json();
    },
  });

  // Fetch monthly summary for selected year
  const { data: monthlySummary, isLoading: monthlySummaryLoading } = useQuery<MonthlySummary[]>({
    queryKey: ["/api/admin/analytics/engagement/monthly", selectedYear],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/analytics/engagement/monthly?year=${selectedYear}`);
      return res.json();
    },
    enabled: engagementDialogOpen,
    staleTime: 0,
    refetchOnMount: "always",
  });

  // Fetch detailed events for selected month/year
  const { data: engagementEvents, isLoading: engagementLoading } = useQuery<EngagementEvent[]>({
    queryKey: ["/api/admin/analytics/engagement", eventTypeFilter, selectedMonth, selectedYear, viewMode],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (eventTypeFilter && eventTypeFilter !== "all") {
        params.set("eventType", eventTypeFilter);
      }
      params.set("limit", "200");
      if (viewMode === "monthly") {
        params.set("month", selectedMonth.toString());
        params.set("year", selectedYear.toString());
      } else {
        params.set("year", selectedYear.toString());
      }
      const res = await apiRequest("GET", `/api/admin/analytics/engagement?${params.toString()}`);
      return res.json();
    },
    enabled: engagementDialogOpen,
    staleTime: 0,
    refetchOnMount: "always",
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-muted-foreground">Loading analytics...</p>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Analytics Dashboard</h1>
        <p className="text-muted-foreground">
          Track subscription metrics, conversions, and user engagement
        </p>
      </div>

      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Recurring Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-mrr">
                {formatCurrency(analytics?.subscriptions.mrr || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {analytics?.subscriptions.active || 0} active subscriptions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Subscribers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-subs">
                {analytics?.subscriptions.total || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {analytics?.subscriptions.active || 0} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Activation Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-conversion-rate">
                {formatPercent(analytics?.conversion.activationRate || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {analytics?.conversion.activatedUsers || 0} of {analytics?.conversion.totalUsers || 0} users activated
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Template Downloads</CardTitle>
              <Download className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-downloads">
                {analytics?.usage.totalDownloads || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {analytics?.usage.avgDownloadsPerUser.toFixed(1) || "0.0"} avg per user
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Subscription Breakdown</CardTitle>
              <CardDescription>Current status of all subscriptions</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Active', value: analytics?.subscriptions.active || 0, color: '#22c55e' },
                      { name: 'Inactive', value: analytics?.subscriptions.inactive || 0, color: '#6b7280' },
                      { name: 'Canceled', value: analytics?.subscriptions.canceled || 0, color: '#ef4444' },
                    ]}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {[
                      { name: 'Active', value: analytics?.subscriptions.active || 0, color: '#22c55e' },
                      { name: 'Inactive', value: analytics?.subscriptions.inactive || 0, color: '#6b7280' },
                      { name: 'Canceled', value: analytics?.subscriptions.canceled || 0, color: '#ef4444' },
                    ].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    Active
                  </span>
                  <span className="font-bold" data-testid="text-active-count">
                    {analytics?.subscriptions.active || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-gray-500"></div>
                    Inactive
                  </span>
                  <span className="font-bold" data-testid="text-inactive-count">
                    {analytics?.subscriptions.inactive || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    Canceled
                  </span>
                  <span className="font-bold" data-testid="text-canceled-count">
                    {analytics?.subscriptions.canceled || 0}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover-elevate transition-all"
            onClick={() => setEngagementDialogOpen(true)}
            data-testid="card-user-engagement"
          >
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle>User Engagement - {monthNames[new Date().getMonth()]} {new Date().getFullYear()}</CardTitle>
                <CardDescription>Monthly usage metrics (resets each month) - Click to see details</CardDescription>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={[
                    { name: 'Applications', value: analytics?.usage.applicationsSubmitted || 0, color: '#3b82f6' },
                    { name: 'Background Checks', value: analytics?.usage.screeningRequests || 0, color: '#8b5cf6' },
                    { name: 'Credit Helper', value: analytics?.usage.creditHelperUses || 0, color: '#22c55e' },
                    { name: 'Criminal Helper', value: analytics?.usage.criminalHelperUses || 0, color: '#f97316' },
                  ]}
                  margin={{ top: 20, right: 20, left: 20, bottom: 60 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-30} textAnchor="end" height={70} interval={0} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Applications Submitted
                  </span>
                  <span className="font-bold" data-testid="text-applications-submitted">
                    {analytics?.usage.applicationsSubmitted || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <MousePointerClick className="h-4 w-4" />
                    Background Checks Sent
                  </span>
                  <span className="font-bold" data-testid="text-screening-requests">
                    {analytics?.usage.screeningRequests || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Credit Helper Uses
                  </span>
                  <span className="font-bold" data-testid="text-credit-helper-uses">
                    {analytics?.usage.creditHelperUses || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Criminal Helper Uses
                  </span>
                  <span className="font-bold" data-testid="text-criminal-helper-uses">
                    {analytics?.usage.criminalHelperUses || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Template Downloads
                  </span>
                  <span className="font-bold" data-testid="text-total-downloads">
                    {analytics?.usage.totalDownloads || 0}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* User Engagement Drill-Down Dialog */}
        <Dialog open={engagementDialogOpen} onOpenChange={setEngagementDialogOpen}>
          <DialogContent className="max-w-5xl max-h-[85vh]">
            <DialogHeader>
              <DialogTitle>User Engagement Details</DialogTitle>
              <DialogDescription>
                Track engagement by month or view yearly aggregates
              </DialogDescription>
            </DialogHeader>
            
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "monthly" | "yearly")}>
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <TabsList>
                  <TabsTrigger value="monthly" data-testid="tab-monthly">
                    <Calendar className="h-4 w-4 mr-2" />
                    Monthly View
                  </TabsTrigger>
                  <TabsTrigger value="yearly" data-testid="tab-yearly">
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Yearly Overview
                  </TabsTrigger>
                </TabsList>
                
                <div className="flex items-center gap-2">
                  <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                    <SelectTrigger className="w-[100px]" data-testid="select-year">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
                        <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {viewMode === "monthly" && (
                    <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                      <SelectTrigger className="w-[120px]" data-testid="select-month">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {monthNames.map((name, idx) => (
                          <SelectItem key={idx + 1} value={(idx + 1).toString()}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
              
              <TabsContent value="yearly" className="mt-0">
                {monthlySummaryLoading ? (
                  <p className="text-center py-8 text-muted-foreground">Loading yearly summary...</p>
                ) : monthlySummary && monthlySummary.length > 0 ? (
                  <div className="space-y-4">
                    <div className="h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlySummary.map(m => ({
                          ...m,
                          name: monthNames[m.month - 1],
                        }))}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="screeningRequests" name="Background Checks" fill="#8b5cf6" stackId="a" />
                          <Bar dataKey="creditHelperUses" name="Credit Helper" fill="#22c55e" stackId="a" />
                          <Bar dataKey="criminalHelperUses" name="Criminal Helper" fill="#f97316" stackId="a" />
                          <Bar dataKey="templateDownloads" name="Downloads" fill="#3b82f6" stackId="a" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-4 text-center">
                      <div className="p-3 rounded-md bg-purple-500/10">
                        <div className="text-2xl font-bold text-purple-600">
                          {monthlySummary.reduce((sum, m) => sum + m.screeningRequests, 0)}
                        </div>
                        <div className="text-xs text-muted-foreground">Background Checks</div>
                      </div>
                      <div className="p-3 rounded-md bg-blue-500/10">
                        <div className="text-2xl font-bold text-blue-600">
                          {monthlySummary.reduce((sum, m) => sum + m.templateDownloads, 0)}
                        </div>
                        <div className="text-xs text-muted-foreground">Downloads</div>
                      </div>
                      <div className="p-3 rounded-md bg-green-500/10">
                        <div className="text-2xl font-bold text-green-600">
                          {monthlySummary.reduce((sum, m) => sum + m.creditHelperUses, 0)}
                        </div>
                        <div className="text-xs text-muted-foreground">Credit Helper</div>
                      </div>
                      <div className="p-3 rounded-md bg-orange-500/10">
                        <div className="text-2xl font-bold text-orange-600">
                          {monthlySummary.reduce((sum, m) => sum + m.criminalHelperUses, 0)}
                        </div>
                        <div className="text-xs text-muted-foreground">Criminal Helper</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-center py-8 text-muted-foreground">No data for {selectedYear}</p>
                )}
              </TabsContent>
              
              <TabsContent value="monthly" className="mt-0">
                <div className="flex items-center gap-4 mb-4">
                  <span className="text-sm font-medium">Filter by type:</span>
                  <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
                    <SelectTrigger className="w-[200px]" data-testid="select-event-type">
                      <SelectValue placeholder="All events" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Events</SelectItem>
                      <SelectItem value="screening_request">Background Checks Sent</SelectItem>
                      <SelectItem value="template_download">Template Downloads</SelectItem>
                      <SelectItem value="credit_helper_use">Credit Helper Uses</SelectItem>
                      <SelectItem value="criminal_helper_use">Criminal Helper Uses</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-sm text-muted-foreground ml-auto">
                    Showing {monthNames[selectedMonth - 1]} {selectedYear}
                  </span>
                </div>

                <ScrollArea className="h-[350px]">
                  {engagementLoading ? (
                    <p className="text-center py-8 text-muted-foreground">Loading events...</p>
                  ) : engagementEvents && engagementEvents.length > 0 ? (
                    <table className="w-full text-sm" data-testid="table-engagement-events">
                      <thead className="sticky top-0 bg-background">
                        <tr className="border-b">
                          <th className="text-left py-3 px-2 font-medium">User</th>
                          <th className="text-left py-3 px-2 font-medium">Email</th>
                          <th className="text-left py-3 px-2 font-medium">Action</th>
                          <th className="text-left py-3 px-2 font-medium">Details</th>
                          <th className="text-left py-3 px-2 font-medium">Date/Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {engagementEvents.map((event) => (
                          <tr
                            key={event.id}
                            className="border-b hover-elevate"
                            data-testid={`row-event-${event.id}`}
                          >
                            <td className="py-3 px-2">
                              {event.userName || "Anonymous"}
                            </td>
                            <td className="py-3 px-2 text-muted-foreground">
                              {event.userEmail || "—"}
                            </td>
                            <td className="py-3 px-2">
                              <Badge variant="secondary">
                                {eventTypeLabels[event.eventType] || event.eventType}
                              </Badge>
                            </td>
                            <td className="py-3 px-2 text-muted-foreground max-w-[200px] truncate">
                              {event.eventData ? (
                                typeof event.eventData === 'object' ? (
                                  event.eventData.templateName || 
                                  event.eventData.templateTitle ||
                                  event.eventData.cardTitle ||
                                  JSON.stringify(event.eventData).slice(0, 50)
                                ) : String(event.eventData).slice(0, 50)
                              ) : "—"}
                            </td>
                            <td className="py-3 px-2 text-muted-foreground whitespace-nowrap">
                              {event.createdAt
                                ? format(new Date(event.createdAt), "MMM d, yyyy h:mm a")
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-center py-8 text-muted-foreground">
                      No engagement events for {monthNames[selectedMonth - 1]} {selectedYear}
                    </p>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>

        {/* MRR Trend Line Chart */}
        <Card>
          <CardHeader>
            <CardTitle>MRR Trend — Last 12 Months</CardTitle>
            <CardDescription>
              Monthly Recurring Revenue (monthly subscribers × $10 + annual × $8.33)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {mrrHistory && mrrHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={mrrHistory} margin={{ top: 8, right: 20, left: 10, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis
                    tickFormatter={(v) => `$${v}`}
                    tick={{ fontSize: 12 }}
                    width={56}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) =>
                      name === "mrr" ? [`$${value}`, "MRR"] : [value, "Subscribers"]
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="mrr"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                    name="mrr"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-sm py-8 text-center">No MRR data available yet</p>
            )}
          </CardContent>
        </Card>

        {/* Subscriber Funnel */}
        <Card>
          <CardHeader>
            <div className="flex flex-row items-start justify-between gap-3 flex-wrap">
              <div>
                <CardTitle>Subscriber Funnel</CardTitle>
                <CardDescription>
                  Drop-off at each activation stage
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-wrap" data-testid="funnel-date-filter">
                <Select
                  value={funnelPreset}
                  onValueChange={(v) => setFunnelPreset(v as FunnelPreset)}
                >
                  <SelectTrigger className="w-40" data-testid="select-funnel-preset">
                    <SelectValue placeholder="Date range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All time</SelectItem>
                    <SelectItem value="30d">Last 30 days</SelectItem>
                    <SelectItem value="90d">Last 90 days</SelectItem>
                    <SelectItem value="12m">Last 12 months</SelectItem>
                    <SelectItem value="ytd">Year to date</SelectItem>
                    <SelectItem value="custom">Custom range</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {funnelPreset === "custom" && (
              <div className="flex items-center gap-2 flex-wrap pt-2" data-testid="funnel-custom-dates">
                <Input
                  type="date"
                  value={funnelCustomFrom}
                  onChange={(e) => setFunnelCustomFrom(e.target.value)}
                  className="w-40"
                  data-testid="input-funnel-from"
                />
                <span className="text-muted-foreground text-sm">to</span>
                <Input
                  type="date"
                  value={funnelCustomTo}
                  onChange={(e) => setFunnelCustomTo(e.target.value)}
                  className="w-40"
                  data-testid="input-funnel-to"
                />
                {(funnelCustomFrom || funnelCustomTo) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setFunnelCustomFrom(""); setFunnelCustomTo(""); }}
                    data-testid="button-funnel-clear-custom"
                  >
                    Clear
                  </Button>
                )}
              </div>
            )}
            {/* Date context label */}
            <p className="text-xs text-muted-foreground pt-1" data-testid="funnel-date-label">
              {funnelDateParams.from && funnelDateParams.to
                ? `Subscribers who joined ${format(new Date(funnelDateParams.from), "MMM d, yyyy")} – ${format(new Date(funnelDateParams.to), "MMM d, yyyy")}`
                : funnelDateParams.from
                ? `Subscribers who joined on or after ${format(new Date(funnelDateParams.from), "MMM d, yyyy")}`
                : funnelDateParams.to
                ? `Subscribers who joined on or before ${format(new Date(funnelDateParams.to), "MMM d, yyyy")}`
                : `All active subscribers · as of ${format(new Date(), "MMM d, yyyy")}`
              }
            </p>
          </CardHeader>
          <CardContent>
            {funnelData?.stages && funnelData.stages.length > 0 ? (() => {
              // Activation funnel starts at Active Subscribers; skip any pre-funnel "All Users" stage
              const activationStages = funnelData.stages.filter(s => s.label !== "All Users");
              const subscriberCount = activationStages[0]?.count || 1;
              return (
                <div className="space-y-3" data-testid="funnel-stages">
                  {activationStages.map((stage, idx) => {
                    const pct = Math.round((stage.count / subscriberCount) * 100);
                    const dropPct = idx > 0
                      ? Math.round(((activationStages[idx - 1].count - stage.count) / (activationStages[idx - 1].count || 1)) * 100)
                      : 0;
                    return (
                      <div key={stage.label} data-testid={`funnel-stage-${idx}`}>
                        <div className="flex items-center justify-between text-sm mb-1 gap-2 flex-wrap">
                          <span className="font-medium">{stage.label}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-muted-foreground">{stage.count.toLocaleString()}</span>
                            {idx > 0 && dropPct > 0 && (
                              <Badge variant="outline" className="text-xs text-destructive">
                                -{dropPct}%
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })() : (
              <p className="text-muted-foreground text-sm py-8 text-center">No funnel data available yet</p>
            )}
          </CardContent>
        </Card>

        {/* Per-User Engagement Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-row items-center justify-between gap-4 flex-wrap">
              <div>
                <CardTitle>Per-User Engagement</CardTitle>
                <CardDescription>Activity summary for every non-admin user</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Sort by:</span>
                <Select
                  value={userEngagementSort}
                  onValueChange={(v) => {
                    const valid = ["lastActive", "downloads", "applications", "screenings"] as const;
                    if (valid.includes(v as typeof valid[number])) {
                      setUserEngagementSort(v as typeof valid[number]);
                    }
                  }}
                >
                  <SelectTrigger className="w-[160px]" data-testid="select-user-sort">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lastActive">Last Active</SelectItem>
                    <SelectItem value="downloads">Downloads</SelectItem>
                    <SelectItem value="applications">Applications</SelectItem>
                    <SelectItem value="screenings">Screenings</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {userEngagement && userEngagement.length > 0 ? (() => {
              const sorted = [...userEngagement].sort((a, b) => {
                if (userEngagementSort === "downloads") return Number(b.templateDownloads) - Number(a.templateDownloads);
                if (userEngagementSort === "applications") return Number(b.applicationsSent) - Number(a.applicationsSent);
                if (userEngagementSort === "screenings") return Number(b.screeningRequests) - Number(a.screeningRequests);
                // lastActive (default)
                if (!a.lastActiveAt && !b.lastActiveAt) return 0;
                if (!a.lastActiveAt) return 1;
                if (!b.lastActiveAt) return -1;
                return new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime();
              });
              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="table-user-engagement">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2 font-medium">User</th>
                        <th className="text-left py-3 px-2 font-medium">Status</th>
                        <th className="text-left py-3 px-2 font-medium">Last Active</th>
                        <th className="text-right py-3 px-2 font-medium">Downloads</th>
                        <th className="text-right py-3 px-2 font-medium">Applications</th>
                        <th className="text-right py-3 px-2 font-medium">Screenings</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((u) => (
                        <tr key={u.id} className="border-b hover-elevate" data-testid={`row-user-eng-${u.id}`}>
                          <td className="py-3 px-2">
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {[u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || "Anonymous"}
                              </span>
                              <span className="text-xs text-muted-foreground">{u.email || "—"}</span>
                            </div>
                          </td>
                          <td className="py-3 px-2">
                            {u.subscriptionStatus === "active"
                              ? <Badge variant="default">Active</Badge>
                              : <Badge variant="secondary">Inactive</Badge>}
                          </td>
                          <td className="py-3 px-2 text-muted-foreground whitespace-nowrap">
                            {u.lastActiveAt
                              ? format(new Date(u.lastActiveAt), "MMM d, yyyy")
                              : "Never"}
                          </td>
                          <td className="py-3 px-2 text-right font-mono">{Number(u.templateDownloads)}</td>
                          <td className="py-3 px-2 text-right font-mono">{Number(u.applicationsSent)}</td>
                          <td className="py-3 px-2 text-right font-mono">{Number(u.screeningRequests)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })() : (
              <p className="text-center py-8 text-muted-foreground">No user engagement data</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Inactive Users</CardTitle>
            <CardDescription>
              Users who have not yet activated their subscription
            </CardDescription>
          </CardHeader>
          <CardContent>
            {usersLoading ? (
              <p className="text-muted-foreground">Loading inactive users...</p>
            ) : users ? (
              (() => {
                const inactiveUsers = users.filter(u => 
                  u.subscriptionStatus !== "active"
                );
                return inactiveUsers.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" data-testid="table-inactive-users">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-2 font-medium">Name</th>
                          <th className="text-left py-3 px-2 font-medium">Email</th>
                          <th className="text-left py-3 px-2 font-medium">Status</th>
                          <th className="text-left py-3 px-2 font-medium">Joined</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inactiveUsers.map((user) => (
                          <tr
                            key={user.id}
                            className="border-b hover-elevate"
                            data-testid={`row-inactive-user-${user.id}`}
                          >
                            <td className="py-3 px-2" data-testid={`text-name-${user.id}`}>
                              {user.firstName && user.lastName
                                ? `${user.firstName} ${user.lastName}`
                                : user.firstName || user.lastName || user.email || "Anonymous"}
                            </td>
                            <td className="py-3 px-2" data-testid={`text-email-${user.id}`}>
                              {user.email || "—"}
                            </td>
                            <td className="py-3 px-2">
                              <Badge variant="secondary">Inactive</Badge>
                            </td>
                            <td className="py-3 px-2 text-muted-foreground" data-testid={`text-joined-${user.id}`}>
                              {format(new Date(user.createdAt), "MMM d, yyyy")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-center py-8 text-muted-foreground">
                    No inactive users at the moment
                  </p>
                );
              })()
            ) : (
              <p className="text-center py-8 text-destructive">
                Failed to load users
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>All Users</CardTitle>
            <CardDescription>
              Complete list of all users with subscription details
            </CardDescription>
          </CardHeader>
          <CardContent>
            {usersLoading ? (
              <p className="text-muted-foreground">Loading users...</p>
            ) : users ? (
              users.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="table-users">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2 font-medium">Name</th>
                        <th className="text-left py-3 px-2 font-medium">Email</th>
                        <th className="text-left py-3 px-2 font-medium">Status</th>
                        <th className="text-left py-3 px-2 font-medium">Next Renewal</th>
                        <th className="text-left py-3 px-2 font-medium">Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr
                          key={user.id}
                          className="border-b hover-elevate"
                          data-testid={`row-user-${user.id}`}
                        >
                          <td className="py-3 px-2" data-testid={`text-name-${user.id}`}>
                            <div className="flex items-center gap-2">
                              {user.firstName && user.lastName
                                ? `${user.firstName} ${user.lastName}`
                                : user.firstName || user.lastName || user.email || "Anonymous"}
                              {user.isAdmin && (
                                <Badge variant="secondary" className="text-xs">
                                  Admin
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-2" data-testid={`text-email-${user.id}`}>
                            {user.email || "—"}
                          </td>
                          <td className="py-3 px-2" data-testid={`text-status-${user.id}`}>
                            {(() => {
                              if (user.subscriptionStatus === 'active') {
                                return <Badge variant="default">Active</Badge>;
                              } else if (user.subscriptionStatus === 'canceled' || user.subscriptionStatus === 'cancel_at_period_end') {
                                return <Badge variant="outline">Canceled</Badge>;
                              } else if (user.subscriptionStatus === 'past_due') {
                                return <Badge variant="destructive">Past Due</Badge>;
                              } else {
                                return <Badge variant="secondary">Inactive</Badge>;
                              }
                            })()}
                          </td>
                          <td className="py-3 px-2 text-muted-foreground" data-testid={`text-next-renewal-${user.id}`}>
                            {user.currentPeriodEnd
                              ? format(new Date(user.currentPeriodEnd), "MMM d, yyyy")
                              : user.subscriptionEndsAt
                                ? format(new Date(user.subscriptionEndsAt), "MMM d, yyyy")
                                : "—"}
                          </td>
                          <td className="py-3 px-2 text-muted-foreground" data-testid={`text-joined-${user.id}`}>
                            {(user as any).subscribedAt 
                              ? format(new Date((user as any).subscribedAt), "MMM d, yyyy")
                              : user.createdAt
                                ? format(new Date(user.createdAt), "MMM d, yyyy")
                                : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center py-8 text-muted-foreground">
                  No users found
                </p>
              )
            ) : (
              <p className="text-center py-8 text-destructive">
                Failed to load users
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
