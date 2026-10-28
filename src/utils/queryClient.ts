import { QueryClient } from "@tanstack/react-query";
import { getNetworkOptimizedConfig, getNetworkSpeed } from "./networkOptimizer";
import { isNetworkError, handleSupabaseError } from "./supabaseErrorHandler";

// Network-aware Query Client configuration
export const createQueryClient = () => {
  const networkConfig = getNetworkOptimizedConfig();
  const speed = getNetworkSpeed();
  
  // On slow networks: much longer stale times, fewer retries
  const isSlowNetwork = speed === 'slow';
  const FREE_PLAN_STALE_TIME = 30 * 60 * 1000;
  const FREE_PLAN_GC_TIME = 2 * 60 * 60 * 1000;
  
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: FREE_PLAN_STALE_TIME,
        gcTime: FREE_PLAN_GC_TIME,
        retry: (failureCount, error: any) => {
          const errorMessage = error?.message?.toLowerCase() || '';
          
          // Don't retry for certain error types
          if (errorMessage.includes('404') || 
              errorMessage.includes('401') || 
              errorMessage.includes('403')) {
            return false;
          }
          
          // On slow networks, retry less aggressively
          if (isSlowNetwork) {
            return failureCount < 1;
          }
          
          // Normal network: retry network errors
          if (isNetworkError(error)) {
            return failureCount < 2;
          }
          
          return failureCount < networkConfig.maxRetries;
        },
        retryDelay: attemptIndex => {
          const baseDelay = isSlowNetwork ? 3000 : networkConfig.retryDelay;
          return Math.min(baseDelay * 2 ** attemptIndex, networkConfig.maxRetryDelay);
        },
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
        networkMode: 'offlineFirst',
        structuralSharing: true,
      },
      mutations: {
        retry: (failureCount, error: any) => {
          if (isNetworkError(error)) {
            return failureCount < 1;
          }
          return false;
        },
        networkMode: 'offlineFirst',
        onError: (error: any) => {
          handleSupabaseError(error, 'mutation');
        }
      },
    },
  });
};