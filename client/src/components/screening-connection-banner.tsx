import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";

interface ScreeningCredentialsStatus {
  configured: boolean;
  status?: string;
  integrationReady?: boolean;
  pendingAdminSetup?: boolean;
  lastErrorMessage?: string | null;
}

interface ScreeningConnectionBannerProps {
  className?: string;
  /** When the integration is fully ready, show a compact confirmation instead of nothing. */
  showWhenReady?: boolean;
}

/**
 * Status-aware banner that guides a landlord through connecting their
 * Western Verify (tenant screening) account. Shown on the Screening Decoder
 * and Application Inbox pages so the setup is no longer hidden inside Settings.
 */
export function ScreeningConnectionBanner({
  className = "",
  showWhenReady = false,
}: ScreeningConnectionBannerProps) {
  const { data: status, isLoading } = useQuery<ScreeningCredentialsStatus>({
    queryKey: ["/api/screening-credentials"],
  });

  if (isLoading || !status) return null;

  // Fully connected and ready to use.
  if (status.integrationReady) {
    if (!showWhenReady) return null;
    return (
      <div
        className={`flex items-center gap-2 text-sm text-green-700 dark:text-green-400 ${className}`}
        data-testid="banner-screening-ready"
      >
        <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
        <span>Western Verify is connected and ready for background &amp; credit checks.</span>
      </div>
    );
  }

  // Credentials saved, waiting on our team to finish setup.
  if (status.pendingAdminSetup) {
    return (
      <Card
        className={`border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 ${className}`}
        data-testid="banner-screening-pending"
      >
        <CardContent className="flex items-start gap-3 py-4">
          <Clock className="h-6 w-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-800 dark:text-yellow-200">
              Almost there — we're finishing your screening setup
            </p>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              Your Western Verify login is saved. Our team activates your account within
              one business day and emails you the moment it's ready. No further action needed.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Saved but verification failed — needs the landlord to re-enter / fix.
  if (status.configured && status.status === "failed") {
    return (
      <Card
        className={`border-destructive/40 bg-destructive/5 ${className}`}
        data-testid="banner-screening-failed"
      >
        <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-6 w-6 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">
                We couldn't verify your Western Verify login
              </p>
              <p className="text-sm text-muted-foreground">
                {status.lastErrorMessage
                  ? status.lastErrorMessage
                  : "Double-check your username and password, then save again."}
              </p>
            </div>
          </div>
          <Button asChild className="flex-shrink-0" data-testid="button-fix-screening">
            <Link href="/settings#tenant-screening">
              Fix Connection
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Not configured at all — the main call to action.
  return (
    <Card
      className={`border-primary/30 bg-primary/5 ${className}`}
      data-testid="banner-screening-setup"
    >
      <CardContent className="py-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary/10 rounded-md flex-shrink-0">
              <ShieldCheck className="h-7 w-7 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground text-base">
                Connect Western Verify to run background &amp; credit checks
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                It takes about 2 minutes. Once connected, you can request a full tenant
                screening report on any applicant without leaving LeaseShield.
              </p>
              <ol className="mt-3 space-y-1.5 text-sm text-foreground">
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/15 text-primary text-xs font-semibold flex items-center justify-center mt-0.5">1</span>
                  <span>
                    Have a Western Verify account?{" "}
                    <a
                      href="https://www.westernverify.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-0.5"
                      data-testid="link-westernverify-signup"
                    >
                      Create a free one
                      <ExternalLink className="h-3 w-3" />
                    </a>{" "}
                    if you don't.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/15 text-primary text-xs font-semibold flex items-center justify-center mt-0.5">2</span>
                  <span>Enter your Western Verify username and password in Settings.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/15 text-primary text-xs font-semibold flex items-center justify-center mt-0.5">3</span>
                  <span>We finish the connection and email you when screening is live — usually within one business day.</span>
                </li>
              </ol>
            </div>
          </div>
          <Button asChild size="lg" className="flex-shrink-0 self-start lg:self-center" data-testid="button-setup-screening">
            <Link href="/settings#tenant-screening">
              Set Up Western Verify
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
