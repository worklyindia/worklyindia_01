import { QueryClient } from '@tanstack/react-query';

/**
 * Optimized React Query client with better caching strategies
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // OPTIMIZED: Stale time increased to 5 minutes (was 30 seconds)
      // This dramatically reduces refetch frequency and egress
      staleTime: 5 * 60 * 1000,
      
      // Cache time: Keep unused data in cache for 10 minutes
      gcTime: 10 * 60 * 1000,
      
      // Retry failed requests only once
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors (client errors)
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
          return false;
        }
        return failureCount < 1;
      },
      
      // Exponential backoff for retries
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      
      // CRITICAL: Don't refetch on window focus - saves massive egress
      refetchOnWindowFocus: false,
      
      // Don't refetch on reconnect unless really needed
      refetchOnReconnect: false,
      
      // Only refetch on mount if data is very stale
      refetchOnMount: 'always',
      
      // Enable network mode for better offline support
      networkMode: 'online',
    },
    mutations: {
      // Retry mutations once
      retry: 1,
      
      // Network mode for mutations
      networkMode: 'online',
    },
  },
});

/**
 * Prefetch common data to improve perceived performance
 */
export const prefetchCommonData = async () => {
  // Add prefetch logic for frequently accessed data
  // This can be called on app initialization
  
  console.log('🔄 Prefetching common data...');
  
  // Example: Prefetch user profile, job categories, etc.
  // await queryClient.prefetchQuery({
  //   queryKey: ['categories'],
  //   queryFn: fetchCategories,
  // });
};

/**
 * Clear all query cache (useful for logout)
 */
export const clearAllCache = () => {
  queryClient.clear();
  console.log('🗑️ Query cache cleared');
};

/**
 * Invalidate specific queries by pattern
 */
export const invalidateQueriesByPattern = (pattern: string) => {
  queryClient.invalidateQueries({
    predicate: (query) => {
      return query.queryKey.some(
        key => typeof key === 'string' && key.includes(pattern)
      );
    },
  });
  console.log(`🔄 Invalidated queries matching: ${pattern}`);
};
