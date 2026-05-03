import { Suspense, lazy } from "react";
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
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { SubscriptionGate } from "@/components/subscription-gate";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
const ForgotPassword = lazy(() => import("@/pages/forgot-password"));
const ResetPassword = lazy(() => import("@/pages/reset-password"));
const Privacy = lazy(() => import("@/pages/privacy"));
const Terms = lazy(() => import("@/pages/terms"));
const RefundPolicy = lazy(() => import("@/pages/refund-policy"));
const Disclaimers = lazy(() => import("@/pages/disclaimers"));
const Contact = lazy(() => import("@/pages/contact"));
const HelpCenter = lazy(() => import("@/pages/help-center"));
import Blog from "@/pages/blog";
const BlogPost = lazy(() => import("@/pages/blog-post"));
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
const Admin = lazy(() => import("@/pages/admin"));
const AdminTemplates = lazy(() => import("@/pages/admin-templates"));
const AdminCompliance = lazy(() => import("@/pages/admin-compliance"));
const AdminLegalUpdates = lazy(() => import("@/pages/admin-legal-updates"));
const AdminAnalytics = lazy(() => import("@/pages/admin-analytics"));
const AdminDashboard = lazy(() => import("@/pages/admin-dashboard"));
const AdminLegislativeMonitoring = lazy(() => import("@/pages/admin-legislative-monitoring"));
const AdminBroadcasts = lazy(() => import("@/pages/admin-broadcasts"));
const AdminDirectMessages = lazy(() => import("@/pages/admin-direct-messages"));
const AdminScreeningCredentials = lazy(() => import("@/pages/admin-screening-credentials"));
const AdminTips = lazy(() => import("@/pages/admin-tips"));
const AdminApplicationsActivity = lazy(() => import("@/pages/admin-applications-activity"));
const AdminStateNotes = lazy(() => import("@/pages/admin-state-notes"));
const AdminNoticeForms = lazy(() => import("@/pages/admin-notice-forms"));
const AdminPlatformFees = lazy(() => import("@/pages/admin-platform-fees"));
const LegalUpdatesPage = lazy(() => import("@/pages/legal-updates"));
import Messages from "@/pages/messages";
const AuditHistory = lazy(() => import("@/pages/audit-history"));
const LogoPicker = lazy(() => import("@/pages/logo-picker"));
const LogoColors = lazy(() => import("@/pages/logo-colors"));
import RentalApplications from "@/pages/rental-applications";
import RentalSubmissions from "@/pages/rental-submissions";
import Apply from "@/pages/apply";
import PropertyDetail from "@/pages/property-detail";
const TxTenantSelectionCriteria = lazy(() => import("@/pages/tx-tenant-selection-criteria"));
import ScreeningExplain from "@/pages/screening-explain";
const ScreeningReportDecoder = lazy(() => import("@/pages/marketing/screening-report-decoder"));
const DashboardPreview = lazy(() => import("@/pages/dashboard-preview"));
const Activate = lazy(() => import("@/pages/activate"));
const DenialDecisionAssistant = lazy(() => import("@/pages/denial-decision-assistant"));
const Reupload = lazy(() => import("@/pages/reupload"));
const PayRent = lazy(() => import("@/pages/pay-rent"));
const AutoPay = lazy(() => import("@/pages/auto-pay"));

// Admin route wrapper - redirects non-admin users to dashboard
function AdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return null;
  }
  
  if (!user?.isAdmin) {
    return <Redirect to="/dashboard" />;
  }
  
  return (
    <Suspense fallback={null}>
      <Component />
    </Suspense>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return (
      <Suspense fallback={null}>
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
        <Route path="/tx/tenant-selection-criteria" component={TxTenantSelectionCriteria} />
        <Route path="/blog" component={Blog} />
        <Route path="/blog/:slug" component={BlogPost} />
        <Route path="/subscribe" component={Subscribe} />
        <Route path="/activate" component={Activate} />
        <Route path="/logos" component={LogoPicker} />
        <Route path="/logo-colors" component={LogoColors} />
        {/* Public dashboard preview */}
        <Route path="/dashboard-preview" component={DashboardPreview} />
        {/* Unified decoder entry - accessible without login */}
        <Route path="/screening/explain" component={ScreeningExplain} />
        {/* Marketing landing page for screening decoder (SEO) */}
        <Route path="/screening-report-decoder" component={ScreeningReportDecoder} />
        {/* Public application form */}
        <Route path="/apply/:token" component={Apply} />
        <Route path="/apply/join/:token" component={Apply} />
        <Route path="/apply/person/:token" component={Apply} />
        {/* Document re-upload */}
        <Route path="/reupload/:token" component={Reupload} />
        {/* Public tenant rent payment */}
        <Route path="/pay-rent/:token" component={PayRent} />
        {/* Public tenant auto-pay authorization (recurring ACH) */}
        <Route path="/auto-pay/:token" component={AutoPay} />
        {/* Redirect protected routes to login */}
        <Route path="/dashboard">{() => <Redirect to="/login" />}</Route>
        <Route path="/templates">{() => <Redirect to="/login" />}</Route>
        <Route path="/billing">{() => <Redirect to="/login" />}</Route>
        <Route path="/subscription">{() => <Redirect to="/login" />}</Route>
        <Route path="/properties">{() => <Redirect to="/login" />}</Route>
        <Route path="/properties/:id">{() => <Redirect to="/login" />}</Route>
        <Route path="/rental-applications">{() => <Redirect to="/login" />}</Route>
        <Route path="/rental-submissions">{() => <Redirect to="/login" />}</Route>
        <Route path="/compliance">{() => <Redirect to="/login" />}</Route>
        <Route path="/screening">{() => <Redirect to="/login" />}</Route>
        <Route path="/denial-decision">{() => <Redirect to="/login" />}</Route>
        <Route path="/audit-history">{() => <Redirect to="/login" />}</Route>
        <Route path="/my-documents">{() => <Redirect to="/login" />}</Route>
        <Route path="/settings">{() => <Redirect to="/login" />}</Route>
        <Route path="/notifications">{() => <Redirect to="/login" />}</Route>
        <Route path="/messages">{() => <Redirect to="/login" />}</Route>
        <Route path="/rent-ledger">{() => <Redirect to="/login" />}</Route>
        <Route path="/tenant-issues">{() => <Redirect to="/login" />}</Route>
        <Route path="/communications">{() => <Redirect to="/login" />}</Route>
        <Route path="/legal-updates">{() => <Redirect to="/login" />}</Route>
        <Route component={NotFound} />
      </Switch>
      </Suspense>
    );
  }

  return (
    <Suspense fallback={null}>
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
      <Route path="/tx/tenant-selection-criteria" component={TxTenantSelectionCriteria} />
      <Route path="/blog" component={Blog} />
      <Route path="/blog/:slug" component={BlogPost} />
      <Route path="/templates" component={Templates} />
      <Route path="/templates/:id/fill/:documentId" component={DocumentWizard} />
      <Route path="/templates/:id/fill" component={DocumentWizard} />
      <Route path="/my-documents" component={MyDocuments} />
      <Route path="/properties" component={Properties} />
      <Route path="/properties/:id" component={PropertyDetail} />
      <Route path="/rental-applications" component={RentalApplications} />
      <Route path="/rental-submissions" component={RentalSubmissions} />
      {/* Public application form (also accessible when logged in) */}
      <Route path="/apply/:token" component={Apply} />
      <Route path="/apply/join/:token" component={Apply} />
      <Route path="/apply/person/:token" component={Apply} />
      {/* Document re-upload (also accessible when logged in) */}
      <Route path="/reupload/:token" component={Reupload} />
      {/* Public tenant rent payment (also accessible when logged in) */}
      <Route path="/pay-rent/:token" component={PayRent} />
      {/* Public tenant auto-pay authorization */}
      <Route path="/auto-pay/:token" component={AutoPay} />
      <Route path="/compliance" component={Compliance} />
      <Route path="/screening/explain" component={ScreeningExplain} />
      <Route path="/screening-report-decoder" component={ScreeningReportDecoder} />
      <Route path="/screening" component={Screening} />
      <Route path="/denial-decision" component={DenialDecisionAssistant} />
      <Route path="/audit-history" component={AuditHistory} />
      <Route path="/tenant-issues" component={TenantIssues} />
      <Route path="/communications" component={Communications} />
      <Route path="/rent-ledger" component={RentLedger} />
      <Route path="/legal-updates" component={LegalUpdatesPage} />
      <Route path="/subscribe" component={Subscribe} />
      <Route path="/activate" component={Activate} />
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
      <Route path="/admin/direct-messages">{() => <AdminRoute component={AdminDirectMessages} />}</Route>
      <Route path="/admin/screening-credentials">{() => <AdminRoute component={AdminScreeningCredentials} />}</Route>
      <Route path="/admin/tips">{() => <AdminRoute component={AdminTips} />}</Route>
      <Route path="/admin/state-notes">{() => <AdminRoute component={AdminStateNotes} />}</Route>
      <Route path="/admin/applications-activity">{() => <AdminRoute component={AdminApplicationsActivity} />}</Route>
      <Route path="/admin/notice-forms">{() => <AdminRoute component={AdminNoticeForms} />}</Route>
      <Route path="/admin/platform-fees">{() => <AdminRoute component={AdminPlatformFees} />}</Route>
      <Route component={NotFound} />
    </Switch>
    </Suspense>
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
          <ImpersonationBanner />
          <PaymentFailedBanner />
          <SubscriptionGate>
            <main className="flex-1 overflow-y-auto">{children}</main>
          </SubscriptionGate>
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
