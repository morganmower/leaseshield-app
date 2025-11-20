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
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
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
import Compliance from "@/pages/compliance";
import Screening from "@/pages/screening";
import TenantIssues from "@/pages/tenant-issues";
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
import LogoPicker from "@/pages/logo-picker";
import LogoColors from "@/pages/logo-colors";
import { useEffect } from "react";

function RedirectToHome() {
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    setLocation("/");
  }, [setLocation]);
  
  return null;
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {isLoading || !isAuthenticated ? (
        <>
          <Route path="/" component={Landing} />
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
          <Route component={RedirectToHome} />
        </>
      ) : (
        <>
          <Route path="/" component={Dashboard} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/privacy" component={Privacy} />
          <Route path="/terms" component={Terms} />
          <Route path="/refund-policy" component={RefundPolicy} />
          <Route path="/disclaimers" component={Disclaimers} />
          <Route path="/contact" component={Contact} />
          <Route path="/help" component={HelpCenter} />
          <Route path="/blog" component={Blog} />
          <Route path="/blog/:slug" component={BlogPost} />
          <Route path="/templates" component={Templates} />
          <Route path="/templates/:id/fill" component={DocumentWizard} />
          <Route path="/compliance" component={Compliance} />
          <Route path="/screening" component={Screening} />
          <Route path="/tenant-issues" component={TenantIssues} />
          <Route path="/subscribe" component={Subscribe} />
          <Route path="/settings" component={Settings} />
          <Route path="/billing" component={Billing} />
          <Route path="/admin" component={Admin} />
          <Route path="/admin/dashboard" component={AdminDashboard} />
          <Route path="/admin/templates" component={AdminTemplates} />
          <Route path="/admin/compliance" component={AdminCompliance} />
          <Route path="/admin/legal-updates" component={AdminLegalUpdates} />
          <Route path="/admin/legislative-monitoring" component={AdminLegislativeMonitoring} />
          <Route path="/admin/analytics" component={AdminAnalytics} />
          <Route component={NotFound} />
        </>
      )}
    </Switch>
  );
}

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  if (!isAuthenticated) {
    return <>{children}</>;
  }

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between p-4 border-b bg-background">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-2">
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
                onClick={() => window.location.href = "/api/logout"}
                data-testid="button-header-logout"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Log Out
              </Button>
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-hidden">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}

export default function App() {
  return (
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
  );
}
