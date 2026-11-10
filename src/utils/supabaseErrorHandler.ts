import { toast } from "sonner";

// Track error state to prevent duplicate toasts
let lastErrorTime = 0;
let errorCount = 0;
const ERROR_COOLDOWN = 5000; // 5 seconds between error toasts

// Network error messages that are recoverable
const NETWORK_ERRORS = [
  'failed to fetch',
  'network error',
  'net::err',
  'load failed',
  'networkerror',
  'channel_error',
  'connection closed',
  'websocket',
  'timeout',
  'aborted',
];

/**
 * Check if error is a network-related error
 */
export const isNetworkError = (error: any): boolean => {
  if (!error) return false;
  
  const errorMessage = (error.message || error.toString() || '').toLowerCase();
  return NETWORK_ERRORS.some(networkError => errorMessage.includes(networkError));
};

/**
 * Check if error is a Supabase realtime error
 */
export const isRealtimeError = (error: any): boolean => {
  if (!error) return false;
  
  const errorMessage = (error.message || error.toString() || '').toLowerCase();
  return errorMessage.includes('channel') || 
         errorMessage.includes('realtime') || 
         errorMessage.includes('subscription');
};

/**
 * Handle Supabase errors gracefully
 */
export const handleSupabaseError = (error: any, context?: string): void => {
  const now = Date.now();
  
  // Prevent duplicate error toasts
  if (now - lastErrorTime < ERROR_COOLDOWN) {
    errorCount++;
    console.warn(`🔇 Suppressing duplicate error (${errorCount} total):`, error);
    return;
  }
  
  lastErrorTime = now;
  errorCount = 1;
  
  if (isNetworkError(error)) {
    console.warn('🌐 Network error detected:', error);
    
    // Only show toast if user might not know about the issue
    if (!navigator.onLine) {
      toast.error('You are offline. Please check your internet connection.', {
        id: 'network-offline',
        duration: 5000,
      });
    } else {
      toast.error('Connection issue. Retrying...', {
        id: 'network-issue',
        duration: 3000,
      });
    }
    return;
  }
  
  if (isRealtimeError(error)) {
    console.warn('📡 Realtime error (ignored):', error);
    // Don't show toast for realtime errors - they auto-recover
    return;
  }
  
  // Log other errors but don't always show toast
  console.error(`❌ Supabase error ${context ? `(${context})` : ''}:`, error);
};

/**
 * Wrap async function with error handling
 */
export const withErrorHandling = <T>(
  fn: () => Promise<T>,
  context?: string
): Promise<T | null> => {
  return fn().catch((error) => {
    handleSupabaseError(error, context);
    return null;
  });
};

/**
 * Setup global error handler for uncaught promise rejections
 */
export const setupGlobalErrorHandler = (): void => {
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason;
    
    // Handle network errors silently
    if (isNetworkError(error) || isRealtimeError(error)) {
      event.preventDefault();
      handleSupabaseError(error, 'unhandled');
    }
  });
  
  console.log('✅ Global error handler setup complete');
};
