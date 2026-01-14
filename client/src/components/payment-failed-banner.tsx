import { AlertTriangle, CreditCard, X } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";

export function PaymentFailedBanner() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  if (!user || user.subscriptionStatus !== 'past_due' || dismissed) {
    return null;
  }

  return (
    <div 
      className="bg-red-600 text-white px-4 py-3 flex items-center justify-between gap-4"
      data-testid="banner-payment-failed"
    >
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 flex-shrink-0" />
        <span className="text-sm font-medium">
          Your payment failed. Please update your payment method to continue using LeaseShield.
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Link href="/subscription">
          <Button 
            variant="secondary" 
            size="sm"
            className="bg-white text-red-600 hover:bg-red-50"
            data-testid="button-update-payment"
          >
            <CreditCard className="h-4 w-4 mr-2" />
            Update Payment
          </Button>
        </Link>
        <button
          onClick={() => setDismissed(true)}
          className="text-white/80 hover:text-white p-1"
          aria-label="Dismiss"
          data-testid="button-dismiss-payment-banner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
