import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import { ApiError } from "@/lib/queryClient";

export function useAuth() {
  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: (failureCount, error) => {
      // Don't retry on 401 (unauthorized) - user is not logged in
      if (error instanceof ApiError && error.status === 401) {
        return false;
      }
      // Retry other errors up to 2 times
      return failureCount < 2;
    },
    retryDelay: 1000,
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    error: error instanceof ApiError ? error : null,
  };
}
