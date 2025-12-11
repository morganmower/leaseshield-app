import { Switch, Route, Link, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Settings as SettingsIcon, CreditCard, LogOut } from "lucide-react";
import { NotificationCenter } from "@/components/notification-center";
import { HeaderContext } from "@/components/header-context";
import { ErrorBoundary } from "@/components/error-boundary";
import { ChatWidget } from "@/components/chat-widget";
import { PaymentFailedBanner } from "@/components/payment-failed-banner";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import Privacy from "@/pages/privacy";
import Terms from "@/pages/terms";
import RefundPolicy from "@/pages/refund-policy";
import Disclaimers from "@/pages/disclaimers";
import Contact from "@/pages/contact";
import HelpCenter from "@/pages/help-center";
import Blog from "@/pages/blog";
import BlogPost from "@/pages/blog-post";
import Dashboard from "@/pages/dashboard";
import Templates from "@/pages/templates";
import DocumentWizard from "@/pages/document-wizard";
import MyDocuments from "@/pages/my-documents";
import Properties from "@/pages/properties";
import Compliance from "@/pages/compliance";
import Screening from "@/pages/screening";
import TenantIssues from "@/pages/tenant-issues";
import Communications from "@/pages/communications";
import RentLedger from "@/pages/rent-ledger";
import Subscribe from "@/pages/subscribe";
import Settings from "@/pages/settings";
import Billing from "@/pages/billing";
import Admin from "@/pages/admin";
import AdminTemplates from "@/pages/admin-templates";
import AdminCompliance from "@/pages/admin-compliance";
import AdminLegalUpdates from "@/pages/admin-legal-updates";
import AdminAnalytics from "@/pages/admin-analytics";
import AdminDashboard from "@/pages/admin-dashboard";
import AdminLegislativeMonitoring from "@/pages/admin-legislative-monitoring";
import AdminBroadcasts from "@/pages/admin-broadcasts";
import LegalUpdatesPage from "@/pages/legal-updates";
import Messages from "@/pages/messages";
import LogoPicker from "@/pages/logo-picker";
import LogoColors from "@/pages/logo-colors";

// Admin route wrapper - redirects non-admin users to dashboard
function AdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return null;
  }
  
  if (!user?.isAdmin) {
    return <Redirect to="/dashboard" />;
  }
  
  return <Component />;
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/login" component={Login} />
        <Route path="/signup" component={Signup} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/privacy" component={Privacy} />
        <Route path="/terms" component={Terms} />
        <Route path="/refund-policy" component={RefundPolicy} />
        <Route path="/disclaimers" component={Disclaimers} />
        <Route path="/contact" component={Contact} />
        <Route path="/help" component={HelpCenter} />
        <Route path="/blog" component={Blog} />
        <Route path="/blog/:slug" component={BlogPost} />
        <Route path="/subscribe" component={Subscribe} />
        <Route path="/logos" component={LogoPicker} />
        <Route path="/logo-colors" component={LogoColors} />
        {/* Redirect protected routes to login */}
        <Route path="/dashboard">{() => <Redirect to="/login" />}</Route>
        <Route path="/templates">{() => <Redirect to="/login" />}</Route>
        <Route path="/billing">{() => <Redirect to="/login" />}</Route>
        <Route path="/subscription">{() => <Redirect to="/login" />}</Route>
        <Route path="/properties">{() => <Redirect to="/login" />}</Route>
        <Route path="/compliance">{() => <Redirect to="/login" />}</Route>
        <Route path="/screening">{() => <Redirect to="/login" />}</Route>
        <Route path="/my-documents">{() => <Redirect to="/login" />}</Route>
        <Route path="/settings">{() => <Redirect to="/login" />}</Route>
        <Route path="/notifications">{() => <Redirect to="/login" />}</Route>
        <Route path="/messages">{() => <Redirect to="/login" />}</Route>
        <Route component={NotFound} />
      </Switch>
    );
  }

  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/dashboard" component={Dashboard} />
      {/* Redirect auth pages to dashboard when logged in */}
      <Route path="/login">{() => <Redirect to="/dashboard" />}</Route>
      <Route path="/signup">{() => <Redirect to="/dashboard" />}</Route>
      <Route path="/forgot-password">{() => <Redirect to="/dashboard" />}</Route>
      <Route path="/reset-password">{() => <Redirect to="/dashboard" />}</Route>
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/refund-policy" component={RefundPolicy} />
      <Route path="/disclaimers" component={Disclaimers} />
      <Route path="/contact" component={Contact} />
      <Route path="/help" component={HelpCenter} />
      <Route path="/blog" component={Blog} />
      <Route path="/blog/:slug" component={BlogPost} />
      <Route path="/templates" component={Templates} />
      <Route path="/templates/:id/fill/:documentId" component={DocumentWizard} />
      <Route path="/templates/:id/fill" component={DocumentWizard} />
      <Route path="/my-documents" component={MyDocuments} />
      <Route path="/properties" component={Properties} />
      <Route path="/compliance" component={Compliance} />
      <Route path="/screening" component={Screening} />
      <Route path="/tenant-issues" component={TenantIssues} />
      <Route path="/communications" component={Communications} />
      <Route path="/rent-ledger" component={RentLedger} />
      <Route path="/legal-updates" component={LegalUpdatesPage} />
      <Route path="/subscribe" component={Subscribe} />
      <Route path="/settings" component={Settings} />
      <Route path="/billing" component={Billing} />
      <Route path="/subscription" component={Billing} />
      <Route path="/messages" component={Messages} />
      <Route path="/admin">{() => <AdminRoute component={Admin} />}</Route>
      <Route path="/admin/dashboard">{() => <AdminRoute component={AdminDashboard} />}</Route>
      <Route path="/admin/templates">{() => <AdminRoute component={AdminTemplates} />}</Route>
      <Route path="/admin/compliance">{() => <AdminRoute component={AdminCompliance} />}</Route>
      <Route path="/admin/legal-updates">{() => <AdminRoute component={AdminLegalUpdates} />}</Route>
      <Route path="/admin/legislative-monitoring">{() => <AdminRoute component={AdminLegislativeMonitoring} />}</Route>
      <Route path="/admin/analytics">{() => <AdminRoute component={AdminAnalytics} />}</Route>
      <Route path="/admin/broadcasts">{() => <AdminRoute component={AdminBroadcasts} />}</Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, logout, isLoggingOut } = useAuth();
  const [, setLocation] = useLocation();

  if (!isAuthenticated) {
    return <>{children}</>;
  }

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  const handleLogout = () => {
    logout();
    setLocation("/");
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between p-4 border-b bg-background">
            <div className="flex items-center gap-4">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <HeaderContext />
            </div>
            <div className="flex items-center gap-2">
              <NotificationCenter />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation("/settings")}
                data-testid="button-header-settings"
              >
                <SettingsIcon className="h-4 w-4 mr-2" />
                Settings
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation("/billing")}
                data-testid="button-header-billing"
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Billing
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                disabled={isLoggingOut}
                data-testid="button-header-logout"
              >
                <LogOut className="h-4 w-4 mr-2" />
                {isLoggingOut ? "Logging out..." : "Log Out"}
              </Button>
              <ThemeToggle />
            </div>
          </header>
          <PaymentFailedBanner />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
        <ChatWidget />
      </div>
    </SidebarProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="light" storageKey="leaseshield-theme">
          <TooltipProvider>
            <AuthenticatedLayout>
              <Router />
            </AuthenticatedLayout>
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
