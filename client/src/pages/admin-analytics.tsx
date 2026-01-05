import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Users, TrendingUp, Download, MousePointerClick, FileText, ChevronRight, Calendar } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AnalyticsSummary {
  subscriptions: {
    total: number;
    active: number;
    trialing: number;
    expiredTrials: number;
    canceled: number;
    mrr: number;
  };
  conversion: {
    trialConversionRate: number;
    totalTrials: number;
    convertedTrials: number;
  };
  usage: {
    totalDownloads: number;
    westernVerifyClicks: number;
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
  western_verify_click: 'Western Verify Click',
  credit_helper_use: 'Credit Helper Use',
  criminal_helper_use: 'Criminal Helper Use',
  compliance_card_view: 'Compliance Card View',
  legal_update_view: 'Legal Update View',
  screening_request: 'Screening Request',
};

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface MonthlySummary {
  month: number;
  year: number;
  templateDownloads: number;
  westernVerifyClicks: number;
  creditHelperUses: number;
  criminalHelperUses: number;
  totalEvents: number;
}

export default function AdminAnalyticsPage() {
  const [engagementDialogOpen, setEngagementDialogOpen] = useState(false);
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [viewMode, setViewMode] = useState<"monthly" | "yearly">("monthly");

  const { data: analytics, isLoading } = useQuery<AnalyticsSummary>({
    queryKey: ["/api/admin/analytics"],
  });

  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
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
                {analytics?.subscriptions.trialing || 0} in trial
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Trial Conversion Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-conversion-rate">
                {formatPercent(analytics?.conversion.trialConversionRate || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {analytics?.conversion.convertedTrials || 0} of {analytics?.conversion.totalTrials || 0} trials converted
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
                      { name: 'Trialing', value: analytics?.subscriptions.trialing || 0, color: '#3b82f6' },
                      { name: 'Expired Trials', value: analytics?.subscriptions.expiredTrials || 0, color: '#f97316' },
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
                      { name: 'Trialing', value: analytics?.subscriptions.trialing || 0, color: '#3b82f6' },
                      { name: 'Expired Trials', value: analytics?.subscriptions.expiredTrials || 0, color: '#f97316' },
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
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    Trialing
                  </span>
                  <span className="font-bold" data-testid="text-trialing-count">
                    {analytics?.subscriptions.trialing || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                    Expired Trials
                  </span>
                  <span className="font-bold" data-testid="text-expired-trials-count">
                    {analytics?.subscriptions.expiredTrials || 0}
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
                    { name: 'Downloads', value: analytics?.usage.totalDownloads || 0, color: '#3b82f6' },
                    { name: 'Western Verify', value: analytics?.usage.westernVerifyClicks || 0, color: '#8b5cf6' },
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
                    <Download className="h-4 w-4" />
                    Total Template Downloads
                  </span>
                  <span className="font-bold" data-testid="text-total-downloads">
                    {analytics?.usage.totalDownloads || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <MousePointerClick className="h-4 w-4" />
                    Western Verify Clicks
                  </span>
                  <span className="font-bold" data-testid="text-western-verify-clicks">
                    {analytics?.usage.westernVerifyClicks || 0}
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
                  <span>Avg Downloads per User</span>
                  <span className="font-bold" data-testid="text-avg-downloads">
                    {analytics?.usage?.avgDownloadsPerUser?.toFixed(1) ?? "0.0"}
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
                          <Bar dataKey="templateDownloads" name="Downloads" fill="#3b82f6" stackId="a" />
                          <Bar dataKey="westernVerifyClicks" name="WV Clicks" fill="#8b5cf6" stackId="a" />
                          <Bar dataKey="creditHelperUses" name="Credit Helper" fill="#22c55e" stackId="a" />
                          <Bar dataKey="criminalHelperUses" name="Criminal Helper" fill="#f97316" stackId="a" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-4 text-center">
                      <div className="p-3 rounded-md bg-blue-500/10">
                        <div className="text-2xl font-bold text-blue-600">
                          {monthlySummary.reduce((sum, m) => sum + m.templateDownloads, 0)}
                        </div>
                        <div className="text-xs text-muted-foreground">Downloads</div>
                      </div>
                      <div className="p-3 rounded-md bg-purple-500/10">
                        <div className="text-2xl font-bold text-purple-600">
                          {monthlySummary.reduce((sum, m) => sum + m.westernVerifyClicks, 0)}
                        </div>
                        <div className="text-xs text-muted-foreground">WV Clicks</div>
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
                      <SelectItem value="template_download">Template Downloads</SelectItem>
                      <SelectItem value="western_verify_click">Western Verify Clicks</SelectItem>
                      <SelectItem value="credit_helper_use">Credit Helper Uses</SelectItem>
                      <SelectItem value="criminal_helper_use">Criminal Helper Uses</SelectItem>
                      <SelectItem value="screening_request">Screening Requests</SelectItem>
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

        <Card>
          <CardHeader>
            <CardTitle>Users on Free Trial</CardTitle>
            <CardDescription>
              Users currently testing the platform (trialing status)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {usersLoading ? (
              <p className="text-muted-foreground">Loading trial users...</p>
            ) : users ? (
              (() => {
                const trialingUsers = users.filter(u => 
                  u.subscriptionStatus === "trialing" && 
                  (!u.trialEndsAt || new Date(u.trialEndsAt) >= new Date())
                );
                return trialingUsers.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" data-testid="table-trialing-users">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-2 font-medium">Name</th>
                          <th className="text-left py-3 px-2 font-medium">Email</th>
                          <th className="text-left py-3 px-2 font-medium">Trial Ends</th>
                          <th className="text-left py-3 px-2 font-medium">Joined</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trialingUsers.map((user) => (
                          <tr
                            key={user.id}
                            className="border-b hover-elevate"
                            data-testid={`row-trialing-user-${user.id}`}
                          >
                            <td className="py-3 px-2" data-testid={`text-name-${user.id}`}>
                              {user.firstName && user.lastName
                                ? `${user.firstName} ${user.lastName}`
                                : user.firstName || user.lastName || user.email || "Anonymous"}
                            </td>
                            <td className="py-3 px-2" data-testid={`text-email-${user.id}`}>
                              {user.email || "—"}
                            </td>
                            <td className="py-3 px-2 text-muted-foreground" data-testid={`text-trial-ends-${user.id}`}>
                              {user.trialEndsAt
                                ? format(new Date(user.trialEndsAt), "MMM d, yyyy")
                                : "—"}
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
                    No users on trial at the moment
                  </p>
                );
              })()
            ) : (
              <p className="text-center py-8 text-destructive">
                Failed to load trial users
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
                        <th className="text-left py-3 px-2 font-medium">Trial Ends</th>
                        <th className="text-left py-3 px-2 font-medium">Subscription Ends</th>
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
                              const isTrialExpired = user.subscriptionStatus === 'trialing' && 
                                user.trialEndsAt && new Date(user.trialEndsAt) < new Date();
                              
                              if (isTrialExpired) {
                                return <Badge variant="destructive">Trial Expired</Badge>;
                              } else if (user.subscriptionStatus === 'active') {
                                return <Badge variant="default">Active</Badge>;
                              } else if (user.subscriptionStatus === 'trialing') {
                                return <Badge variant="secondary">Trialing</Badge>;
                              } else if (user.subscriptionStatus === 'canceled' || user.subscriptionStatus === 'cancel_at_period_end') {
                                return <Badge variant="outline">Canceled</Badge>;
                              } else if (user.subscriptionStatus === 'past_due') {
                                return <Badge variant="destructive">Past Due</Badge>;
                              } else if (user.subscriptionStatus) {
                                return <Badge variant="outline">{user.subscriptionStatus}</Badge>;
                              } else {
                                return <Badge variant="outline">No subscription</Badge>;
                              }
                            })()}
                          </td>
                          <td className="py-3 px-2 text-muted-foreground" data-testid={`text-trial-ends-${user.id}`}>
                            {user.trialEndsAt
                              ? format(new Date(user.trialEndsAt), "MMM d, yyyy")
                              : "—"}
                          </td>
                          <td className="py-3 px-2 text-muted-foreground" data-testid={`text-sub-ends-${user.id}`}>
                            {user.subscriptionEndsAt
                              ? format(new Date(user.subscriptionEndsAt), "MMM d, yyyy")
                              : "—"}
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
