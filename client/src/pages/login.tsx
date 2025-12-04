import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Login() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      {/* Main Content */}
      <div className="w-full max-w-md flex flex-col items-center gap-8">
        {/* Logo */}
        <div className="mt-8">
          <Logo variant="horizontal" size="lg" />
        </div>

        {/* Welcome Text */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Welcome to LeaseShield</h1>
          <p className="text-muted-foreground">
            Your protective mentor for confident, risk-free property management.
          </p>
        </div>

        {/* Login Button */}
        <Button
          size="lg"
          className="w-full"
          onClick={() => window.location.href = "/api/login"}
          data-testid="button-login-replit"
        >
          Log in with Replit
        </Button>

        {/* Footer Text */}
        <p className="text-xs text-muted-foreground text-center">
          Log in secured by <span className="font-semibold">Replit Auth</span>
        </p>
      </div>
    </div>
  );
}
