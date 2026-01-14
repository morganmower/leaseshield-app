import { useQuery } from "@tanstack/react-query";

export interface State {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt?: string;
}

export function useStates(options?: { includeInactive?: boolean }) {
  const queryKey = options?.includeInactive 
    ? ["/api/states", { active: "false" }] 
    : ["/api/states"];

  const { data: states = [], isLoading, error } = useQuery<State[]>({
    queryKey,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  return {
    states,
    isLoading,
    error,
  };
}

export function useActiveStates() {
  return useStates({ includeInactive: false });
}
