import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, CheckCircle2, ShieldCheck, Building2, Banknote, CalendarDays, X } from "lucide-react";
import { SEO } from "@/components/seo";

interface AutoPayPublicView {
  id: string;
  tenantName: string;
  tenantEmail: string;
  amount: number; // cents
  dayOfMonth: number;
  startDate: string;
  endDate: string | null;
  nextScheduledDate: string | null;
  lateFeeAmount: number;
  gracePeriodDays: number;
  status: string;
  bankAccountLast4: string | null;
  bankAccountBankName: string | null;
  mandateAcceptedAt: string | null;
  landlordName: string;
  propertyName: string | null;
  propertyAddress: string | null;
  proposedMandateText: string;
}

const ord = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

export default function AutoPay() {
  const { token } = useParams<{ token: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [acceptedMandate, setAcceptedMandate] = useState(false);

  const { data, isLoading, error } = useQuery<AutoPayPublicView>({
    queryKey: ["/api/rent-subscriptions/public", token],
  });

  // Surface success/cancel from the Stripe Checkout return URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("authorized") === "1") {
      toast({
        title: "Bank account saved",
        description: "Auto-pay will activate as soon as Stripe verifies your bank (usually within a minute).",
      });
      // Refetch a couple of times to catch the activation state when the webhook lands
      const refetchSoon = () => queryClient.invalidateQueries({ queryKey: ["/api/rent-subscriptions/public", token] });
      refetchSoon();
      const t1 = setTimeout(refetchSoon, 4000);
      const t2 = setTimeout(refetchSoon, 12000);
      window.history.replaceState({}, "", window.location.pathname);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    if (params.get("canceled") === "1") {
      toast({
        title: "Authorization canceled",
        description: "You exited the bank setup. You can try again any time.",
        variant: "destructive",
      });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [token, toast]);

  const setupMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", `/api/rent-subscriptions/public/${token}/setup`);
      return r.json();
    },
    onSuccess: (resp: { url?: string }) => {
      if (resp.url) {
        window.location.href = resp.url;
      } else {
        toast({ title: "Could not open Stripe", description: "Please try again.", variant: "destructive" });
      }
    },
    onError: (err: any) => {
      toast({ title: "Could not start authorization", description: err.message, variant: "destructive" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", `/api/rent-subscriptions/public/${token}/cancel`);
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Auto-pay canceled", description: "Your bank will not be debited again under this authorization." });
      queryClient.invalidateQueries({ queryKey: ["/api/rent-subscriptions/public", token] });
    },
    onError: (err: any) => {
      toast({ title: "Could not cancel", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="container max-w-2xl mx-auto py-16 px-4 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container max-w-2xl mx-auto py-16 px-4">
        <Card>
          <CardHeader>
            <CardTitle>Authorization link not found</CardTitle>
            <CardDescription>This auto-pay link is invalid or has been removed. Please contact your landlord.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const amountStr = (data.amount / 100).toFixed(2);
  const lateFeeStr = (data.lateFeeAmount / 100).toFixed(2);

  const propertyDescriptor = data.propertyName
    ? (data.propertyAddress ? `${data.propertyName} (${data.propertyAddress})` : data.propertyName)
    : "your rental";

  const isActive = data.status === "active";
  const isPaused = data.status === "paused";
  const isPending = data.status === "pending_authorization";
  const isTerminal = ["revoked_by_tenant", "canceled", "completed", "failed"].includes(data.status);

  return (
    <div className="container max-w-2xl mx-auto py-10 px-4">
      <SEO
        title="Authorize Auto-Pay | LeaseShield"
        description="Set up automatic monthly rent payments to your landlord. Bank-to-bank ACH, cancel anytime."
      />

      <Card data-testid="card-auto-pay">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Automatic Rent Payments
              </CardTitle>
              <CardDescription className="mt-1">
                Set up by <span className="font-medium" data-testid="text-landlord-name">{data.landlordName}</span>
              </CardDescription>
            </div>
            {isActive && <Badge variant="default" data-testid="badge-status">Active</Badge>}
            {isPaused && <Badge variant="secondary" data-testid="badge-status">Paused</Badge>}
            {isPending && <Badge variant="outline" data-testid="badge-status">Pending Authorization</Badge>}
            {isTerminal && <Badge variant="destructive" data-testid="badge-status">{data.status.replace(/_/g, " ")}</Badge>}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Schedule details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <Banknote className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <div className="text-sm text-muted-foreground">Amount</div>
                <div className="font-semibold" data-testid="text-amount">${amountStr} / month</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CalendarDays className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <div className="text-sm text-muted-foreground">Schedule</div>
                <div className="font-semibold" data-testid="text-schedule">{ord(data.dayOfMonth)} of each month</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <div className="text-sm text-muted-foreground">For</div>
                <div className="font-semibold" data-testid="text-property">{propertyDescriptor}</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CalendarDays className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <div className="text-sm text-muted-foreground">First debit</div>
                <div className="font-semibold" data-testid="text-start-date">{data.startDate}</div>
                {data.endDate && <div className="text-xs text-muted-foreground">Through {data.endDate}</div>}
              </div>
            </div>
          </div>

          {data.lateFeeAmount > 0 && (
            <p className="text-xs text-muted-foreground" data-testid="text-late-fee">
              Late fee of ${lateFeeStr} applies if a debit fails and is not corrected within {data.gracePeriodDays} days.
            </p>
          )}

          <Separator />

          {/* State-specific UI */}
          {isPending && (
            <div className="space-y-4">
              <Alert>
                <AlertTitle>Authorization Required</AlertTitle>
                <AlertDescription>
                  Read the terms below, check the box, and click "Authorize Auto-Pay". You'll be sent to Stripe's secure page to enter your bank routing and account number.
                </AlertDescription>
              </Alert>

              <div className="rounded-md border bg-muted/30 p-4 text-sm whitespace-pre-line max-h-72 overflow-y-auto" data-testid="text-mandate">
                {data.proposedMandateText}
              </div>

              <label className="flex items-start gap-2 text-sm cursor-pointer" data-testid="label-accept-mandate">
                <input
                  type="checkbox"
                  checked={acceptedMandate}
                  onChange={(e) => setAcceptedMandate(e.target.checked)}
                  className="mt-1"
                  data-testid="checkbox-accept-mandate"
                />
                <span>
                  I have read and agree to the auto-pay authorization above. I understand I can cancel any time on this page.
                </span>
              </label>

              <Button
                size="lg"
                className="w-full"
                disabled={!acceptedMandate || setupMutation.isPending}
                onClick={() => setupMutation.mutate()}
                data-testid="button-authorize"
              >
                {setupMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Authorize Auto-Pay & Add Bank
              </Button>
            </div>
          )}

          {(isActive || isPaused) && (
            <div className="space-y-4">
              <Alert>
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <AlertTitle>Auto-pay {isPaused ? "paused" : "active"}</AlertTitle>
                <AlertDescription>
                  {data.bankAccountBankName && data.bankAccountLast4 ? (
                    <>Bank: <strong data-testid="text-bank">{data.bankAccountBankName} ••{data.bankAccountLast4}</strong></>
                  ) : (
                    <>Your bank account is connected.</>
                  )}
                  {data.nextScheduledDate && isActive && (
                    <div className="mt-1">Next debit: <strong data-testid="text-next-debit">{data.nextScheduledDate}</strong></div>
                  )}
                  {data.mandateAcceptedAt && (
                    <div className="mt-1 text-xs">Authorized on {new Date(data.mandateAcceptedAt).toLocaleString()}</div>
                  )}
                </AlertDescription>
              </Alert>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="w-full" data-testid="button-cancel-trigger">
                    <X className="h-4 w-4 mr-2" />
                    Stop Auto-Pay
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel automatic rent payments?</AlertDialogTitle>
                    <AlertDialogDescription>
                      No more debits will be attempted under this authorization. You'll need to pay rent manually going forward.
                      Your landlord will be notified.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel data-testid="button-cancel-keep">Keep Auto-Pay On</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => cancelMutation.mutate()}
                      disabled={cancelMutation.isPending}
                      data-testid="button-cancel-confirm"
                    >
                      {cancelMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Yes, Stop Auto-Pay
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}

          {isTerminal && (
            <Alert variant="destructive">
              <AlertTitle>Auto-pay is no longer active</AlertTitle>
              <AlertDescription>
                This authorization has ended. If you need to set up auto-pay again, contact your landlord for a new link.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center mt-6">
        Powered by LeaseShield · Bank transfers (ACH) processed by Stripe · NACHA-compliant
      </p>
    </div>
  );
}
