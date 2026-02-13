import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { LogOut, AlertTriangle } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";

type ImpersonationStatus = {
  isImpersonating: boolean;
  impersonating?: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
  startedAt?: string;
};

export function ImpersonationBanner() {
  const { user } = useAuth();
  
  const { data: status } = useQuery<ImpersonationStatus>({
    queryKey: ['/api/admin/impersonation-status'],
    refetchInterval: 10000,
    enabled: !!user?.isAdmin,
  });

  const stopMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/admin/stop-impersonating');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/impersonation-status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    },
  });

  if (!status?.isImpersonating) {
    return null;
  }

  const displayName = status.impersonating?.firstName 
    ? `${status.impersonating.firstName} ${status.impersonating.lastName || ''}`.trim()
    : status.impersonating?.email;

  return (
    <div className="bg-amber-500 text-amber-950 px-4 py-2">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm font-medium" data-testid="text-impersonation-user">
            Viewing as: <strong>{displayName}</strong> ({status.impersonating?.email})
          </span>
        </div>
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => stopMutation.mutate()}
          disabled={stopMutation.isPending}
          data-testid="button-end-impersonation-banner"
        >
          <LogOut className="h-3 w-3 mr-1" />
          End Impersonation
        </Button>
      </div>
    </div>
  );
}
