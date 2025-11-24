import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useStripe, Elements, PaymentElement, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, CheckCircle2 } from "lucide-react";

if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error('Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY');
}
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

function SubscribeForm() {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/dashboard`,
      },
      redirect: 'if_required',
    });

    if (error) {
      toast({
        title: "Payment Failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      // Payment succeeded - redirect manually
      toast({
        title: "Payment Successful!",
        description: "You are now subscribed to LeaseShield App!",
      });
      
      // Use setTimeout to allow toast to show, then redirect
      setTimeout(() => {
        // Try multiple redirect methods for iframe compatibility
        try {
          if (window.top && window.top !== window) {
            window.top.location.href = '/dashboard';
          } else {
            window.location.href = '/dashboard';
          }
        } catch (e) {
          // Fallback if iframe access is blocked
          window.location.href = '/dashboard';
        }
      }, 1000);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      <Button
        type="submit"
        disabled={!stripe}
        className="w-full"
        size="lg"
        data-testid="button-submit-payment"
      >
        Subscribe Now - $12/month
      </Button>
    </form>
  );
}

export default function Subscribe() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [clientSecret, setClientSecret] = useState("");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Immediately redirect to login - don't wait
      window.location.href = "/api/login";
      return;
    }
  }, [isAuthenticated, isLoading]);

  useEffect(() => {
    if (isAuthenticated) {
      console.log("🔄 Starting subscription request...");
      apiRequest("POST", "/api/create-subscription")
        .then(async (res) => {
          console.log("📡 API response received:", res.status, res.statusText);
          const data = await res.json();
          console.log("📦 Response data:", data);
          if (!res.ok) {
            throw new Error(data.message || "Failed to create subscription");
          }
          return data;
        })
        .then((data) => {
          console.log("✅ Client secret received");
          setClientSecret(data.clientSecret);
        })
        .catch((error) => {
          console.error("❌ Subscription error details:", {
            message: error.message,
            stack: error.stack,
            error: error
          });
          const errorMessage = error.message || "Failed to initialize payment. Please try again.";
          toast({
            title: "Subscription Error",
            description: errorMessage,
            variant: "destructive",
          });
        });
    }
  }, [isAuthenticated, toast]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading" />
      </div>
    );
  }

  if (!user) return null;

  if (!clientSecret) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="container max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Shield className="h-8 w-8 text-primary" />
            <span className="font-display text-2xl font-semibold">LeaseShield App</span>
          </div>
          <h1 className="text-3xl font-display font-semibold text-foreground mb-2">
            Subscribe to LeaseShield App
          </h1>
          <p className="text-muted-foreground">
            Continue your protection with full access to all templates and compliance updates
          </p>
        </div>

        <div className="grid md:grid-cols-5 gap-8">
          {/* Plan Details */}
          <Card className="p-8 md:col-span-2">
            <div className="mb-6">
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-4xl font-display font-bold text-foreground">$12</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <p className="text-sm text-muted-foreground">Cancel anytime</p>
            </div>

            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                <span className="text-sm">All state-specific templates</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                <span className="text-sm">Curated compliance updates</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                <span className="text-sm">Screening toolkit & guides</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                <span className="text-sm">Tenant issue workflows</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                <span className="text-sm">Western Verify integration</span>
              </li>
            </ul>
          </Card>

          {/* Payment Form */}
          <Card className="p-8 md:col-span-3">
            <h2 className="text-xl font-semibold mb-6">Payment Details</h2>
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <SubscribeForm />
            </Elements>

            <p className="text-xs text-muted-foreground text-center mt-6">
              By subscribing, you agree to our Terms of Service and Privacy Policy.
              Your subscription will automatically renew monthly until canceled.
            </p>
          </Card>
        </div>

        {/* Trust Indicators */}
        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground">
            🔒 Secure payment processing by Stripe • Cancel anytime from your account
          </p>
        </div>
      </div>
    </div>
  );
}
