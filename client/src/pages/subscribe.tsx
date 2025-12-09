import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useStripe, Elements, PaymentElement, useElements } from '@stripe/react-stripe-js';
import { loadStripe, Appearance } from '@stripe/stripe-js';
import { apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Shield, Lock, CreditCard, User } from "lucide-react";
import { Logo } from "@/components/logo";

if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error('Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY');
}
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

function ProgressStepper({ currentStep }: { currentStep: number }) {
  const steps = [
    { id: 1, label: 'Account', icon: User },
    { id: 2, label: 'Payment', icon: CreditCard },
    { id: 3, label: 'Protected', icon: Shield },
  ];

  return (
    <div className="mb-8 sm:mb-10" data-testid="progress-stepper">
      <p className="text-center text-sm text-muted-foreground mb-4">3 Steps to Protect Your Rentals</p>
      <div className="flex items-center justify-center gap-2 sm:gap-4">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isCompleted = step.id < currentStep;
          const isCurrent = step.id === currentStep;
          
          return (
            <div key={step.id} className="flex items-center gap-2 sm:gap-4">
              <div className="flex flex-col items-center gap-1">
                <div 
                  className={`
                    w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all
                    ${isCompleted ? 'bg-success text-success-foreground' : ''}
                    ${isCurrent ? 'bg-primary text-primary-foreground ring-4 ring-primary/20' : ''}
                    ${!isCompleted && !isCurrent ? 'bg-muted text-muted-foreground' : ''}
                  `}
                  data-testid={`step-${step.id}`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6" />
                  ) : (
                    <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                  )}
                </div>
                <span className={`text-xs font-medium ${isCurrent ? 'text-primary' : 'text-muted-foreground'}`}>
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div className={`w-8 sm:w-16 h-1 rounded-full ${isCompleted ? 'bg-success' : 'bg-muted'}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SubscribeForm() {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Detect if we're in an iframe (Replit preview)
  const isInIframe = window.self !== window.top;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/dashboard`,
        },
        redirect: 'if_required',
      });

      if (error) {
        setIsProcessing(false);
        
        // Check if this is a redirect permission error (iframe issue)
        if (error.message?.includes('permission') || error.message?.includes('navigate')) {
          toast({
            title: "Open in New Tab Required",
            description: "Your card requires extra verification. Please click the 'Open in New Tab' button below to complete payment.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Payment Failed",
            description: error.message,
            variant: "destructive",
          });
        }
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        toast({
          title: "Payment Successful!",
          description: "You are now subscribed to LeaseShield App!",
        });
        
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 1000);
      } else if (paymentIntent && paymentIntent.status === 'requires_action') {
        toast({
          title: "Additional verification required",
          description: "Please complete the verification step.",
        });
        setIsProcessing(false);
      } else {
        toast({
          title: "Processing payment...",
          description: "Please wait while we confirm your payment.",
        });
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 2000);
      }
    } catch (err: any) {
      setIsProcessing(false);
      
      // Check if this is a redirect permission error
      if (err.message?.includes('permission') || err.message?.includes('navigate') || err.message?.includes('href')) {
        toast({
          title: "Open in New Tab Required",
          description: "Your card requires extra verification. Please click the 'Open in New Tab' button below.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Payment Error",
          description: err.message || "An unexpected error occurred. Please try again.",
          variant: "destructive",
        });
      }
    }
  };
  
  const openInNewTab = () => {
    window.open(window.location.href, '_blank');
  };

  const billingPeriod = localStorage.getItem('billingPeriod') === 'yearly' ? 'yearly' : 'monthly';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {isInIframe && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg text-sm">
          <p className="text-amber-800 dark:text-amber-200">
            For the best payment experience, we recommend opening in a new tab:
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={openInNewTab}
            data-testid="button-open-new-tab"
          >
            Open in New Tab
          </Button>
        </div>
      )}
      <PaymentElement 
        options={{
          layout: 'tabs',
          business: { name: 'LeaseShield App' },
        }}
      />
      <Button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full"
        size="lg"
        data-testid="button-submit-payment"
      >
        {isProcessing ? (
          <span className="flex items-center gap-2">
            <div className="animate-spin w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full" />
            Processing...
          </span>
        ) : (
          <>
            <Lock className="h-4 w-4 mr-2" />
            Complete Subscription - {billingPeriod === 'yearly' ? '$100/year' : '$10/month'}
          </>
        )}
      </Button>
    </form>
  );
}

export default function Subscribe() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [clientSecret, setClientSecret] = useState("");
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');

  useEffect(() => {
    const saved = localStorage.getItem('billingPeriod') as 'monthly' | 'yearly' | null;
    setBillingPeriod(saved || 'monthly');
  }, []);

  const handleBillingPeriodChange = (period: 'monthly' | 'yearly') => {
    setBillingPeriod(period);
    localStorage.setItem('billingPeriod', period);
    // Trigger new subscription creation with the new period
    setClientSecret('');
  };

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = "/login";
      return;
    }
  }, [isAuthenticated, isLoading]);

  useEffect(() => {
    if (isAuthenticated && billingPeriod) {
      console.log('Creating subscription with period:', billingPeriod);
      apiRequest("POST", "/api/create-subscription", { billingPeriod })
        .then(async (res) => {
          const text = await res.text();
          let data;
          try {
            data = JSON.parse(text);
          } catch (e) {
            throw new Error(`Invalid response from server: ${text}`);
          }
          if (!res.ok) {
            throw new Error(data.message || `HTTP ${res.status}: Failed to create subscription`);
          }
          return data;
        })
        .then((data) => {
          setClientSecret(data.clientSecret);
        })
        .catch((error) => {
          const errorMessage = error.message || "Failed to initialize payment. Please try again.";
          toast({
            title: "Subscription Error",
            description: errorMessage,
            variant: "destructive",
          });
        });
    }
  }, [isAuthenticated, billingPeriod, toast]);

  const stripeAppearance: Appearance = {
    theme: 'stripe',
    variables: {
      colorPrimary: '#2563eb',
      colorBackground: '#ffffff',
      colorText: '#1e293b',
      colorDanger: '#dc2626',
      fontFamily: 'Inter, system-ui, sans-serif',
      spacingUnit: '4px',
      borderRadius: '8px',
      fontSizeBase: '15px',
    },
    rules: {
      '.Input': {
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        padding: '12px',
      },
      '.Input:focus': {
        border: '2px solid #2563eb',
        boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.1)',
      },
      '.Label': {
        fontWeight: '500',
        marginBottom: '6px',
      },
      '.Tab': {
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
      },
      '.Tab--selected': {
        borderColor: '#2563eb',
        backgroundColor: '#eff6ff',
      },
    },
  };

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
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading" />
        <p className="text-muted-foreground">Setting up secure payment...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-6 sm:py-12">
      <div className="container max-w-3xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="flex items-center justify-center mb-3 sm:mb-4">
            <Logo variant="horizontal" size="lg" />
          </div>
        </div>

        {/* Billing Period Selector */}
        <div className="flex justify-center gap-3 mb-8">
          <Button
            type="button"
            variant={billingPeriod === 'monthly' ? 'default' : 'outline'}
            onClick={() => handleBillingPeriodChange('monthly')}
            className="px-6"
            data-testid="button-billing-monthly"
          >
            Monthly - $10/month
          </Button>
          <Button
            type="button"
            variant={billingPeriod === 'yearly' ? 'default' : 'outline'}
            onClick={() => handleBillingPeriodChange('yearly')}
            className="px-6"
            data-testid="button-billing-yearly"
          >
            Annual - $100/year
            <Badge variant="default" className="ml-2 text-xs bg-success">Save $20</Badge>
          </Button>
        </div>

        {/* Progress Stepper */}
        <ProgressStepper currentStep={2} />

        <div className="grid md:grid-cols-5 gap-6 sm:gap-8">
          {/* Plan Details */}
          <Card className="p-6 sm:p-8 md:col-span-2 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-primary/10 to-transparent rounded-full -mr-12 -mt-12" />
            
            <div className="relative">
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="default" className="bg-primary">
                  {billingPeriod === 'yearly' ? 'BEST VALUE' : 'POPULAR'}
                </Badge>
              </div>
              
              <div className="mb-6">
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-4xl font-display font-bold text-foreground">
                    {billingPeriod === 'yearly' ? '$100' : '$10'}
                  </span>
                  <span className="text-muted-foreground">
                    {billingPeriod === 'yearly' ? '/year' : '/month'}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {billingPeriod === 'yearly' ? 'Just $8.33/month billed annually' : 'Cancel anytime'}
                </p>
                {billingPeriod === 'yearly' && (
                  <Badge variant="outline" className="mt-2 text-success border-success">
                    Save $20/year
                  </Badge>
                )}
              </div>

              <ul className="space-y-3">
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
                  <span className="text-sm">AI-powered assistant</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Western Verify integration</span>
                </li>
              </ul>
            </div>
          </Card>

          {/* Payment Form */}
          <Card className="p-6 sm:p-8 md:col-span-3">
            <div className="flex items-center gap-2 mb-6">
              <Lock className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Secure Payment</h2>
            </div>
            
            <Elements 
              stripe={stripePromise} 
              options={{ 
                clientSecret,
                appearance: stripeAppearance,
              }}
            >
              <SubscribeForm />
            </Elements>

            <div className="mt-6 pt-6 border-t border-border">
              <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  <span>256-bit SSL</span>
                </div>
                <div className="flex items-center gap-1">
                  <Shield className="h-3 w-3" />
                  <span>Stripe Secured</span>
                </div>
                <div className="flex items-center gap-1">
                  <CreditCard className="h-3 w-3" />
                  <span>PCI Compliant</span>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center mt-4">
              By subscribing, you agree to our Terms of Service and Privacy Policy.
              Your subscription will automatically renew until canceled.
            </p>
          </Card>
        </div>

        {/* Trust Indicators */}
        <div className="mt-10 sm:mt-12">
          <Card className="p-4 sm:p-6 bg-muted/50">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span>30-day money-back guarantee</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span>Cancel anytime, no questions asked</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span>Instant access after payment</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
