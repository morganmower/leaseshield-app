import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogIn } from "lucide-react";

export function SessionExpired() {
  const handleLogin = () => {
    localStorage.removeItem("accessToken");
    window.location.href = "/login";
  };

  return (
    <div className="flex-1 overflow-auto flex items-center justify-center">
      <Card className="p-12 max-w-md">
        <div className="text-center">
          <LogIn className="h-16 w-16 text-primary mx-auto mb-6" />
          <h2 className="text-2xl font-display font-semibold text-foreground mb-3">
            Session Expired
          </h2>
          <p className="text-muted-foreground mb-8">
            Your session has expired. Please log back in to continue.
          </p>
          <Button onClick={handleLogin} data-testid="button-login-session-expired">
            Log Back In
          </Button>
        </div>
      </Card>
    </div>
  );
}

export function isSessionExpiredError(error: unknown): boolean {
  if (!error) return false;
  const err = error as Error & { status?: number };
  return err.status === 401;
}

export function hasExpiredSession(): boolean {
  const token = localStorage.getItem("accessToken");
  return token !== null && token.length > 0;
}
