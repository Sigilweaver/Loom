import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "@api/http";

/**
 * Retry transient failures once, but never retry a request the Hub understood
 * and rejected (401, 403, 404, 409, 422 ...): repeating it cannot succeed.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 1;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 30,
        retry: shouldRetry,
        refetchOnWindowFocus: false,
      },
    },
  });
}
