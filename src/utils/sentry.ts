import * as Sentry from "@sentry/react";

export const initializeSentry = () => {
  const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
  
  // Only initialize if DSN is configured and in production
  if (sentryDsn && import.meta.env.PROD) {
    Sentry.init({
      dsn: sentryDsn,
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          maskAllText: false,
          blockAllMedia: false,
        }),
      ],
      // Performance Monitoring - increased sample rate
      tracesSampleRate: 0.2, // Capture 20% of transactions
      // Session Replay
      replaysSessionSampleRate: 0.1, // Sample 10% of sessions
      replaysOnErrorSampleRate: 1.0, // Sample 100% of sessions with errors
      
      // Environment
      environment: import.meta.env.MODE,
      
      // Release tracking
      release: `remote-work-india@${import.meta.env.VITE_APP_VERSION || '1.0.0'}`,
      
      // Enhanced performance tracking
      profilesSampleRate: 0.1,
      
      // Filter out known errors
      beforeSend(event, hint) {
        const error = hint.originalException;
        
        // Filter out common user errors
        if (error && typeof error === 'object' && 'message' in error) {
          const message = String(error.message).toLowerCase();
          
          // Ignore network errors (temporary)
          if (message.includes('failed to fetch') && !message.includes('critical')) {
            return null;
          }
          
          // Ignore ResizeObserver errors (browser quirk)
          if (message.includes('resizeobserver')) {
            return null;
          }

          // Ignore known safe errors
          if (message.includes('load failed') || message.includes('chunk')) {
            return null;
          }
        }

        // Add additional context
        if (event.request) {
          event.request.headers = {
            ...event.request.headers,
            'User-Agent': navigator.userAgent
          };
        }
        
        return event;
      },
    });
    
    console.log('✅ Sentry error monitoring initialized with enhanced tracking');
  } else if (!sentryDsn) {
    console.log('ℹ️ Sentry DSN not configured. Add SENTRY_DSN to enable error monitoring.');
  }
};

// Custom error reporting
export const reportError = (error: Error, context?: Record<string, any>) => {
  if (import.meta.env.PROD) {
    Sentry.captureException(error, {
      extra: context,
    });
  } else {
    console.error('Development Error:', error, context);
  }
};

// Custom message reporting
export const reportMessage = (message: string, level: Sentry.SeverityLevel = 'info') => {
  if (import.meta.env.PROD) {
    Sentry.captureMessage(message, level);
  }
};
