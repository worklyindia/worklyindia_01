import React, { Component, ReactNode } from 'react';
import * as Sentry from '@sentry/react';
import { NativeErrorPage } from './error/NativeErrorPage';
import { categorizeError } from '@/utils/errorCategorizer';
import { formatError } from '@/utils/errorFormatter';
import { saveErrorToHistory } from '@/utils/errorStorage';
import { forceLatestBuild, isStaleBundleError, recoverFromChunkError } from '@/lib/chunkErrorRecovery';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  context?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorId: string;
  retryCount: number;
  countdown: number;
  autoRetryTimer?: NodeJS.Timeout;
}

export class ErrorBoundary extends Component<Props, State> {
  private errorReportTimer?: NodeJS.Timeout;

  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false, 
      errorId: Math.random().toString(36).substr(2, 9),
      retryCount: 0,
      countdown: 5 // Changed from 1 to 5 seconds
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { 
      hasError: true, 
      error,
      errorId: Math.random().toString(36).substr(2, 9),
      countdown: 5 // Changed from 1 to 5 seconds
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // A stale deploy makes old asset files 404. Silently refresh to the current
    // build instead of showing the generic error screen.
    if (isStaleBundleError(error) && recoverFromChunkError()) {
      return;
    }

    const errorDetails = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      context: this.props.context || 'Unknown',
      errorId: this.state.errorId,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      retryCount: this.state.retryCount
    };

    console.error('🚨 ErrorBoundary caught error:', errorDetails);
    
    // Report to Sentry
    Sentry.withScope((scope) => {
      scope.setContext('errorBoundary', {
        errorId: this.state.errorId,
        context: this.props.context || 'Unknown',
        retryCount: this.state.retryCount,
        componentStack: errorInfo.componentStack,
      });
      scope.setTag('error_boundary', 'true');
      Sentry.captureException(error);
    });
    
    // Report to error monitoring
    import('../utils/errorMonitoring').then(({ ErrorMonitor }) => {
      const monitor = ErrorMonitor.getInstance();
      monitor.reportError({
        message: error.message,
        stack: error.stack,
        context: this.props.context || 'ErrorBoundary',
        url: window.location.href,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent
      });
    }).catch(err => console.warn('Could not report error to monitoring:', err));
    
    // Report to analytics if available
    if (window.gtag) {
      window.gtag('event', 'exception', {
        description: `${this.props.context || 'App'}: ${error.message}`,
        fatal: false,
        custom_map: {
          error_id: this.state.errorId,
          context: this.props.context || 'Unknown'
        }
      });
    }

    // Store error details for debugging
    try {
      const recentErrors = JSON.parse(localStorage.getItem('recent_errors') || '[]');
      recentErrors.unshift(errorDetails);
      // Keep only last 5 errors
      localStorage.setItem('recent_errors', JSON.stringify(recentErrors.slice(0, 5)));
    } catch (e) {
      console.warn('Could not store error details:', e);
    }

    // PREVENT AUTO-RETRY LOOP: Check if we've already auto-retried
    const hasAutoRetried = sessionStorage.getItem('eb_auto_retry_done');
    if (hasAutoRetried) {
      console.warn('🚨 Auto-retry already attempted, stopping infinite loop');
      this.setState({ countdown: 0 }); // Stop countdown
      return;
    }

    // Don't start auto-retry timer - user must manually retry
    console.log('🚨 Error caught, manual retry required');
  }

  startAutoRetryTimer = () => {
    // Removed auto-retry functionality to prevent infinite loops
    // User must manually click retry
  }

  handleRetry = () => {
    // Clear auto-retry timer
    if (this.state.autoRetryTimer) {
      clearInterval(this.state.autoRetryTimer);
    }
    // Mark that we've attempted auto-retry
    try {
      sessionStorage.setItem('eb_auto_retry_done', 'true');
    } catch (e) {
      console.warn('Could not set auto-retry flag:', e);
    }
    // Clear stale caches and request the latest asset manifest. A plain reload
    // can keep asking for a deleted hashed chunk on mobile browsers.
    forceLatestBuild();
  };

  handleGoBack = () => {
    // Clear auto-retry timer
    if (this.state.autoRetryTimer) {
      clearInterval(this.state.autoRetryTimer);
    }

    // Try to go back in history, fallback to home if no history
    if (window.history.length > 1) {
      window.history.back();
    } else {
      // Clear any stored routes that might be causing issues
      try {
        sessionStorage.removeItem('preservedRoute');
        sessionStorage.removeItem('preservedEmployerRoute');
        sessionStorage.removeItem('appInitRoute');
      } catch (e) {
        console.warn('Could not clear stored routes:', e);
      }
      window.location.replace('/');
    }
  };

  componentWillUnmount() {
    if (this.errorReportTimer) {
      clearTimeout(this.errorReportTimer);
    }
    if (this.state.autoRetryTimer) {
      clearInterval(this.state.autoRetryTimer);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      if (!this.state.error) {
        return null;
      }

      // Use a simple inline fallback that does NOT use any React hooks
      // This prevents a cascading crash when React's dispatcher is null
      // (e.g., duplicate React instances, HMR issues, or corrupted dep cache)
      try {
        const categorizedError = categorizeError(this.state.error, this.props.context);
        const formattedError = formatError(
          this.state.error,
          categorizedError,
          this.state.errorId
        );
        saveErrorToHistory(formattedError);
      } catch (e) {
        // Ignore formatting errors in error state
      }

      // Pure inline fallback - no hooks, no function components
      return (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#fff',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}>
          <div style={{ textAlign: 'center', padding: '2rem', maxWidth: 400 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>
              Something went wrong
            </h2>
            <p style={{ fontSize: 14, color: '#666', marginBottom: 24, lineHeight: 1.5 }}>
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                onClick={this.handleRetry}
                style={{
                  padding: '10px 24px',
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#fff',
                  background: '#2563eb',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                Retry
              </button>
              <button
                onClick={this.handleGoBack}
                style={{
                  padding: '10px 24px',
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#333',
                  background: '#f3f4f6',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;