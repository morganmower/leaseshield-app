import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CreditCard, CheckCircle2, AlertTriangle, Building2 } from "lucide-react";

interface PublicRentPayment {
  id: string;
  tenantName: string;
  amount: number;
  amountPaid: number;
  dueDate: string;
  description: string | null;
  requestType?: string;
  status: string;
  lateFeeAmount: number;
  gracePeriodDays: number;
  serviceFeeAmount: number;
  serviceFeePayer: "tenant" | "landlord" | "none";
  tenantTotal: number;
  landlordName: string;
  propertyName: string | null;
  propertyAddress: string | null;
}

export default function PayRent() {
  const [, params] = useRoute("/pay-rent/:token");
  const token = params?.token || "";
  const { toast } = useToast();
  const [banner, setBanner] = useState<"paid" | "canceled" | null>(null);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("paid") === "1") setBanner("paid");
    if (sp.get("canceled") === "1") setBanner("canceled");
  }, []);

  const { data, isLoading, error } = useQuery<PublicRentPayment>({
    queryKey: ["/api/rent-payments/public", token],
    queryFn: async () => {
      const res = await fetch(`/api/rent-payments/public/${token}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || "Failed to load");
      }
      return res.json();
    },
    enabled: !!token,
    retry: false,
  });

  const checkoutMutation = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/rent-payments/public/${token}/checkout`, {}),
    onSuccess: async (response: Response) => {
      const body = (await response.json()) as { url?: string };
      if (body?.url) {
        window.location.href = body.url;
      }
    },
    onError: (e: Error & { body?: { message?: string } }) => {
      toast({
        description: e?.body?.message || e?.message || "Failed to start checkout",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="p-6 max-w-md w-full">
          <p className="text-muted-foreground">Loading payment details…</p>
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="p-6 max-w-md w-full text-center">
          <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-3" />
          <h1 className="text-xl font-bold mb-2">Payment link not found</h1>
          <p className="text-muted-foreground text-sm">
            This payment link may have expired or been canceled. Please contact your landlord.
          </p>
        </Card>
      </div>
    );
  }

  const amountDollars = (data.amount / 100).toFixed(2);
  const totalDollars = (data.tenantTotal / 100).toFixed(2);
  const serviceFeeDollars = (data.serviceFeeAmount / 100).toFixed(2);
  const tenantPaysServiceFee = data.serviceFeePayer === "tenant" && data.serviceFeeAmount > 0;
  const dueDateStr = new Date(data.dueDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const isPaid = data.status === "paid";
  const isProcessing = data.status === "processing";
  const isApplicationFee = data.requestType === "application_fee";
  const pageTitle = isApplicationFee ? "Application Fee" : "Rent Payment";
  const lineItemLabel = isApplicationFee ? "Application fee" : "Rent";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg space-y-4">
        <Card className="p-6 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-pay-title">{pageTitle}</h1>
              <p className="text-sm text-muted-foreground">Pay {data.landlordName}</p>
            </div>
            <Badge
              variant={isPaid ? "default" : isProcessing ? "outline" : "secondary"}
              data-testid={`badge-status-${data.status}`}
            >
              {data.status.charAt(0).toUpperCase() + data.status.slice(1)}
            </Badge>
          </div>

          {banner === "paid" && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-green-50 dark:bg-green-950 text-green-900 dark:text-green-200">
              <CheckCircle2 className="h-5 w-5 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold">Payment submitted!</p>
                <p>ACH bank transfers take 3-5 business days to fully clear. We'll mark your payment as paid in full once funds settle.</p>
              </div>
            </div>
          )}

          {banner === "canceled" && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-950 text-amber-900 dark:text-amber-200">
              <AlertTriangle className="h-5 w-5 mt-0.5" />
              <p className="text-sm">Checkout was canceled. You can try again below.</p>
            </div>
          )}

          <div className="border rounded-md p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{lineItemLabel}</span>
              <span className="text-base font-medium" data-testid="text-amount-due">${amountDollars}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Service fee</span>
              <span className="text-base font-medium" data-testid="text-service-fee">
                {tenantPaysServiceFee
                  ? `$${serviceFeeDollars}`
                  : data.serviceFeePayer === "landlord" && data.serviceFeeAmount > 0
                    ? "Paid by landlord"
                    : "$0.00"}
              </span>
            </div>
            <div className="flex items-center justify-between border-t pt-2 mt-1">
              <span className="text-sm font-semibold">Total due</span>
              <span className="text-2xl font-bold" data-testid="text-tenant-total">${totalDollars}</span>
            </div>
            {!isApplicationFee && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Due Date</span>
                <span data-testid="text-due-date">{dueDateStr}</span>
              </div>
            )}
            {data.propertyName && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" /> Property
                </span>
                <span data-testid="text-property">{data.propertyName}</span>
              </div>
            )}
            {data.propertyAddress && (
              <div className="text-sm text-muted-foreground text-right">{data.propertyAddress}</div>
            )}
            {data.description && (
              <div className="text-sm text-muted-foreground border-t pt-2 mt-2" data-testid="text-description">
                {data.description}
              </div>
            )}
          </div>

          {data.lateFeeAmount > 0 && !isPaid && (
            <div className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5" />
              <span>
                Late fee of ${(data.lateFeeAmount / 100).toFixed(2)} applies if rent is not paid within {data.gracePeriodDays} days of the due date.
              </span>
            </div>
          )}

          {isPaid ? (
            <div className="text-center py-4">
              <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400 mx-auto mb-2" />
              <p className="font-semibold text-lg">Paid in full</p>
              <p className="text-sm text-muted-foreground">Thank you for your payment.</p>
            </div>
          ) : isProcessing || banner === "paid" ? (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">
                Your ACH bank transfer is in progress. This typically takes 3-5 business days to clear.
                {banner === "paid" && " You'll see the status update here once it clears - no further action needed."}
              </p>
            </div>
          ) : (
            <>
              <Button
                size="lg"
                className="w-full"
                onClick={() => checkoutMutation.mutate()}
                disabled={checkoutMutation.isPending}
                data-testid="button-pay-now"
              >
                <CreditCard className="h-4 w-4 mr-2" />
                {checkoutMutation.isPending ? "Redirecting…" : `Pay $${totalDollars} via Bank Transfer (ACH)`}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Secure payment powered by Stripe. ACH transfers have no card processing fees.
                You'll be asked to securely connect your bank account on the next screen.
              </p>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
