import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { User } from "@shared/schema";
import { ApiError, apiRequest, setAccessToken } from "@/lib/queryClient";

export function useAuth() {
  const queryClient = useQueryClient();
  
  const { data: user, isLoading, error } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 401) {
        return false;
      }
      return failureCount < 2;
    },
    retryDelay: 1000,
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      setAccessToken(null);
      queryClient.setQueryData(["/api/auth/user"], null);
      queryClient.clear();
    },
    onError: () => {
      setAccessToken(null);
      queryClient.setQueryData(["/api/auth/user"], null);
      queryClient.clear();
    },
  });

  const logout = useCallback(() => {
    logoutMutation.mutate();
  }, [logoutMutation]);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    error: error instanceof ApiError ? error : null,
    logout,
    isLoggingOut: logoutMutation.isPending,
  };
}
