import { QueryClient, QueryFunction } from "@tanstack/react-query";

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Throw an error if the response is not OK
 * Provides better error messages and structured error data
 */
async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let errorMessage = res.statusText;
    let errorData: any = null;

    try {
      const contentType = res.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        errorData = await res.json();
        errorMessage = errorData.message || errorMessage;
      } else {
        const text = await res.text();
        errorMessage = text || errorMessage;
      }
    } catch (e) {
      // If parsing fails, use status text
      console.error('Error parsing error response:', e);
    }

    throw new ApiError(res.status, errorMessage, errorData);
  }
}

/**
 * Get the stored access token
 */
export function getAccessToken(): string | null {
  return localStorage.getItem("accessToken");
}

/**
 * Set the access token in storage
 */
export function setAccessToken(token: string | null): void {
  if (token) {
    localStorage.setItem("accessToken", token);
  } else {
    localStorage.removeItem("accessToken");
  }
}

/**
 * Attempt to refresh the access token using the refresh token cookie
 */
async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
    });
    
    if (res.ok) {
      const data = await res.json();
      if (data.accessToken) {
        setAccessToken(data.accessToken);
        return data.accessToken;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Make an API request with proper error handling and JWT token
 */
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const makeRequest = async (token: string | null) => {
    const headers: Record<string, string> = {};
    if (data) {
      headers["Content-Type"] = "application/json";
    }
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    
    return fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });
  };

  try {
    let token = getAccessToken();
    let res = await makeRequest(token);

    // If unauthorized and we have a refresh token, try to refresh
    if (res.status === 401 && !url.includes("/api/auth/")) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        res = await makeRequest(newToken);
      }
    }

    await throwIfResNotOk(res);
    return res;
  } catch (error) {
    // Re-throw ApiError as-is
    if (error instanceof ApiError) {
      throw error;
    }

    // Wrap network errors
    if (error instanceof TypeError) {
      throw new ApiError(0, 'Network error. Please check your connection.');
    }

    // Wrap other errors
    throw new ApiError(500, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const makeRequest = async (token: string | null) => {
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      return fetch(queryKey.join("/") as string, {
        credentials: "include",
        headers,
      });
    };

    let token = getAccessToken();
    let res = await makeRequest(token);

    // If unauthorized and not an auth endpoint, try to refresh token
    if (res.status === 401 && !queryKey[0]?.toString().includes("/api/auth/")) {
      try {
        const refreshRes = await fetch("/api/auth/refresh", {
          method: "POST",
          credentials: "include",
        });
        
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          if (data.accessToken) {
            setAccessToken(data.accessToken);
            res = await makeRequest(data.accessToken);
          }
        }
      } catch {
        // Refresh failed, continue with original response
      }
    }

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors (client errors)
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
          return false;
        }
        // Retry up to 2 times for other errors
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: false, // Don't retry mutations by default
    },
  },
});
