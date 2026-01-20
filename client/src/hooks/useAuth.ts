import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { User } from "@shared/schema";
import { ApiError, apiRequest, setAccessToken, getQueryFn } from "@/lib/queryClient";

export function useAuth() {
  const queryClient = useQueryClient();
  
  const { data: user, isLoading, error } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes - prevents repeated fetches
    gcTime: 10 * 60 * 1000, // 10 minutes cache
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
