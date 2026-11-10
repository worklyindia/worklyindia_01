import { toast } from "sonner";

interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  onRetry?: (attempt: number, error: any) => void;
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    onRetry
  } = options;

  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry on final attempt
      if (attempt === maxRetries) {
        break;
      }

      // Don't retry on client errors (400-499)
      if (error && typeof error === 'object' && 'status' in error) {
        const status = (error as any).status;
        if (status >= 400 && status < 500) {
          throw error;
        }
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        initialDelay * Math.pow(backoffMultiplier, attempt),
        maxDelay
      );

      console.log(`🔄 Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms...`);

      // Call onRetry callback if provided
      if (onRetry) {
        onRetry(attempt + 1, error);
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Retry fetch requests with better error handling
 */
export async function retryFetch(
  url: string,
  options?: RequestInit,
  retryOptions?: RetryOptions
): Promise<Response> {
  return retryWithBackoff(
    async () => {
      const response = await fetch(url, options);
      
      // Throw error for non-OK responses to trigger retry
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
        (error as any).status = response.status;
        (error as any).response = response;
        throw error;
      }
      
      return response;
    },
    {
      ...retryOptions,
      onRetry: (attempt, error) => {
        // Show toast for retries
        if (attempt === 1) {
          toast.loading('Connection issue, retrying...', {
            id: 'network-retry'
          });
        }
        
        if (retryOptions?.onRetry) {
          retryOptions.onRetry(attempt, error);
        }
      }
    }
  ).finally(() => {
    // Dismiss retry toast
    toast.dismiss('network-retry');
  });
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: any): boolean {
  if (!error) return false;

  // Network errors are retryable
  if (error.message?.includes('fetch') || error.message?.includes('network')) {
    return true;
  }

  // 5xx server errors are retryable
  if (error.status >= 500 && error.status < 600) {
    return true;
  }

  // Timeout errors are retryable
  if (error.message?.includes('timeout')) {
    return true;
  }

  return false;
}

/**
 * Execute function with network check
 */
export async function withNetworkCheck<T>(
  fn: () => Promise<T>,
  options?: { showToast?: boolean }
): Promise<T> {
  const { showToast = true } = options || {};

  if (!navigator.onLine) {
    if (showToast) {
      toast.error('No internet connection. Please check your network.');
    }
    throw new Error('Network offline');
  }

  try {
    return await fn();
  } catch (error) {
    if (!navigator.onLine && showToast) {
      toast.error('Connection lost during operation. Please try again.');
    }
    throw error;
  }
}
