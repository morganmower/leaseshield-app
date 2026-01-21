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

  // Check if user has an active subscription (active or trialing)
  const isSubscriptionActive = user?.subscriptionStatus === 'active' || user?.subscriptionStatus === 'trialing';
  
  // Check if trial has expired
  const isTrialExpired = user?.subscriptionStatus === 'trialing' && 
    user?.trialEndsAt && new Date(user.trialEndsAt) < new Date();
  
  // User needs to activate (subscribe) if they have no active subscription
  const needsActivation = !!user && !isSubscriptionActive;

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isSubscriptionActive: isSubscriptionActive && !isTrialExpired,
    needsActivation: needsActivation || isTrialExpired,
    error: error instanceof ApiError ? error : null,
    logout,
    isLoggingOut: logoutMutation.isPending,
  };
}
