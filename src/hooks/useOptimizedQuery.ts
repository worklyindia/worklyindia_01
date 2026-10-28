import { useQuery, UseQueryOptions } from "@tanstack/react-query";
import { ErrorMonitor } from "@/utils/errorMonitoring";

/**
 * Optimized query hook with automatic error reporting and retry logic
 */
export function useOptimizedQuery<TData = unknown, TError = Error>(
  options: UseQueryOptions<TData, TError> & { context?: string }
) {
  const errorMonitor = ErrorMonitor.getInstance();
  const { context, ...queryOptions } = options;

  return useQuery<TData, TError>({
    ...queryOptions,
    retry: queryOptions.retry ?? 1,
    staleTime: queryOptions.staleTime ?? 300000, // 5 minutes (was 30s)
    gcTime: queryOptions.gcTime ?? 10 * 60 * 1000, // 10 minutes (was 5)
    refetchOnWindowFocus: queryOptions.refetchOnWindowFocus ?? false,
    refetchOnMount: queryOptions.refetchOnMount ?? false,
    meta: {
      ...queryOptions.meta,
      errorReporting: true,
      onError: (error: unknown) => {
        // Report to error monitoring
        errorMonitor.reportError({
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          context: context || 'React Query',
          url: window.location.href,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent
        });
      }
    }
  });
}
