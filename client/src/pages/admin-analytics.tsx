import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Users, TrendingUp, Download, MousePointerClick, FileText } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

interface AnalyticsSummary {
  subscriptions: {
    total: number;
    active: number;
    trialing: number;
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
    avgDownloadsPerUser: number;
  };
}

export default function AdminAnalyticsPage() {
  const { data: analytics, isLoading } = useQuery<AnalyticsSummary>({
    queryKey: ["/api/admin/analytics"],
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

          <Card>
            <CardHeader>
              <CardTitle>User Engagement</CardTitle>
              <CardDescription>Platform usage metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart
                  data={[
                    { name: 'Template Downloads', value: analytics?.usage.totalDownloads || 0, color: '#3b82f6' },
                    { name: 'Western Verify Clicks', value: analytics?.usage.westernVerifyClicks || 0, color: '#8b5cf6' },
                  ]}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-15} textAnchor="end" height={80} />
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
                  <span>Avg Downloads per User</span>
                  <span className="font-bold" data-testid="text-avg-downloads">
                    {analytics?.usage?.avgDownloadsPerUser?.toFixed(1) ?? "0.0"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
