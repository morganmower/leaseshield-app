import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, FileText, Shield, Bell, BarChart, AlertCircle, Scale, Send, Users, MessageSquare, Lightbulb } from "lucide-react";
import { Link } from "wouter";

export default function AdminPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Manage templates, compliance cards, legal updates, and view analytics
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="templates" data-testid="tab-templates">Templates</TabsTrigger>
          <TabsTrigger value="compliance" data-testid="tab-compliance">Compliance</TabsTrigger>
          <TabsTrigger value="updates" data-testid="tab-updates">Legal Updates</TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Templates</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <Link href="/admin/templates" asChild>
                  <Button 
                    size="sm" 
                    className="w-full" 
                    data-testid="button-create-template"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Manage Templates
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Compliance Cards</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <Link href="/admin/compliance" asChild>
                  <Button 
                    size="sm" 
                    className="w-full" 
                    data-testid="button-create-compliance"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Manage Cards
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Legal Updates</CardTitle>
                <Bell className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <Link href="/admin/legal-updates" asChild>
                  <Button 
                    size="sm" 
                    className="w-full" 
                    data-testid="button-create-update"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Manage Updates
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Legislative Monitor</CardTitle>
                <Scale className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <Link href="/admin/legislative-monitoring" asChild>
                  <Button 
                    size="sm" 
                    variant="secondary" 
                    className="w-full" 
                    data-testid="button-legislative-monitoring"
                  >
                    Review Queue
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Analytics</CardTitle>
                <BarChart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <Link href="/admin/analytics" asChild>
                  <Button 
                    size="sm" 
                    variant="secondary" 
                    className="w-full" 
                    data-testid="button-view-analytics"
                  >
                    View Reports
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Broadcasts</CardTitle>
                <Send className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <Link href="/admin/broadcasts" asChild>
                  <Button 
                    size="sm" 
                    className="w-full" 
                    data-testid="button-broadcasts"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Send Messages
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Direct Messages</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <Link href="/admin/direct-messages" asChild>
                  <Button 
                    size="sm" 
                    className="w-full" 
                    data-testid="button-direct-messages"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    User Conversations
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Screening Setup</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <Link href="/admin/screening-credentials" asChild>
                  <Button 
                    size="sm" 
                    className="w-full" 
                    data-testid="button-screening-credentials"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Manage Landlords
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tips & Best Practices</CardTitle>
                <Lightbulb className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <Link href="/admin/tips" asChild>
                  <Button 
                    size="sm" 
                    className="w-full" 
                    data-testid="button-admin-tips"
                  >
                    <Lightbulb className="h-4 w-4 mr-2" />
                    Manage Tips
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common administrative tasks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/admin/dashboard" asChild>
                <Button 
                  variant="outline" 
                  className="w-full justify-start" 
                  data-testid="link-review-queue"
                >
                  <AlertCircle className="h-4 w-4 mr-2 text-primary" />
                  Template Review Queue
                </Button>
              </Link>
              <Link href="/admin/templates" asChild>
                <Button 
                  variant="outline" 
                  className="w-full justify-start" 
                  data-testid="link-manage-templates"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Manage All Templates
                </Button>
              </Link>
              <Link href="/admin/compliance" asChild>
                <Button 
                  variant="outline" 
                  className="w-full justify-start" 
                  data-testid="link-manage-compliance"
                >
                  <Shield className="h-4 w-4 mr-2" />
                  Manage Compliance Cards
                </Button>
              </Link>
              <Link href="/admin/legal-updates" asChild>
                <Button 
                  variant="outline" 
                  className="w-full justify-start" 
                  data-testid="link-manage-updates"
                >
                  <Bell className="h-4 w-4 mr-2" />
                  Manage Legal Updates
                </Button>
              </Link>
              <Link href="/admin/legislative-monitoring" asChild>
                <Button 
                  variant="outline" 
                  className="w-full justify-start" 
                  data-testid="link-legislative-monitoring"
                >
                  <Scale className="h-4 w-4 mr-2" />
                  Legislative Monitoring
                </Button>
              </Link>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <CardTitle>Template Management</CardTitle>
              <CardDescription>Create and manage state-specific legal templates</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Visit the dedicated template management page to view, edit, and create templates.
              </p>
              <Link href="/admin/templates" asChild>
                <Button data-testid="button-goto-templates">
                  Go to Template Management
                </Button>
              </Link>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance">
          <Card>
            <CardHeader>
              <CardTitle>Compliance Card Management</CardTitle>
              <CardDescription>Manage state-specific compliance requirements</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Visit the dedicated compliance management page to create and edit compliance cards.
              </p>
              <Link href="/admin/compliance" asChild>
                <Button data-testid="button-goto-compliance">
                  Go to Compliance Management
                </Button>
              </Link>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="updates">
          <Card>
            <CardHeader>
              <CardTitle>Legal Update Management</CardTitle>
              <CardDescription>Publish and manage legal updates for landlords</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Visit the dedicated legal updates page to create new updates and manage existing ones.
              </p>
              <Link href="/admin/legal-updates" asChild>
                <Button data-testid="button-goto-updates">
                  Go to Legal Updates
                </Button>
              </Link>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle>Analytics Dashboard</CardTitle>
              <CardDescription>View subscription metrics, usage analytics, and conversion data</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                View detailed analytics including MRR, trial conversions, and user engagement.
              </p>
              <Link href="/admin/analytics" asChild>
                <Button data-testid="button-goto-analytics">
                  View Full Analytics
                </Button>
              </Link>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
