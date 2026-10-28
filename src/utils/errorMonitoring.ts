// Error monitoring and reporting utilities
interface ErrorDetails {
  message: string;
  stack?: string;
  context: string;
  url: string;
  timestamp: string;
  userAgent: string;
  userId?: string;
}

interface PerformanceIssue {
  type: 'slow_component' | 'memory_leak' | 'large_bundle' | 'failed_request';
  details: any;
  timestamp: string;
}

export class ErrorMonitor {
  private static instance: ErrorMonitor;
  private errorQueue: ErrorDetails[] = [];
  private performanceIssues: PerformanceIssue[] = [];
  private isOnline = navigator.onLine;

  static getInstance(): ErrorMonitor {
    if (!ErrorMonitor.instance) {
      ErrorMonitor.instance = new ErrorMonitor();
    }
    return ErrorMonitor.instance;
  }

  constructor() {
    this.setupGlobalErrorHandlers();
    this.setupPerformanceMonitoring();
    this.setupOnlineStatusTracking();
  }

  private setupGlobalErrorHandlers() {
    // Catch unhandled JavaScript errors
    window.addEventListener('error', (event) => {
      this.reportError({
        message: event.message,
        stack: event.error?.stack,
        context: 'Global Error Handler',
        url: window.location.href,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent
      });
    });

    // Catch unhandled Promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.reportError({
        message: `Unhandled Promise Rejection: ${event.reason}`,
        stack: event.reason?.stack,
        context: 'Promise Rejection Handler',
        url: window.location.href,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent
      });
    });
  }

  private setupPerformanceMonitoring() {
    // Monitor for slow components
    if ('performance' in window && 'measure' in performance) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 1000) { // Slow operations > 1s
            this.reportPerformanceIssue({
              type: 'slow_component',
              details: {
                name: entry.name,
                duration: entry.duration,
                entryType: entry.entryType
              },
              timestamp: new Date().toISOString()
            });
          }
        }
      });
      
      try {
        observer.observe({ entryTypes: ['measure', 'navigation', 'resource'] });
      } catch (e) {
        console.warn('Performance observer not supported:', e);
      }
    }

    // Monitor memory usage
    if ('memory' in performance) {
      setInterval(() => {
        const memory = (performance as any).memory;
        const usedMB = Math.round(memory.usedJSHeapSize / 1048576);
        const limitMB = Math.round(memory.jsHeapSizeLimit / 1048576);
        
        // Report if using > 80% of available memory
        if (usedMB / limitMB > 0.8) {
          this.reportPerformanceIssue({
            type: 'memory_leak',
            details: {
              used: usedMB,
              limit: limitMB,
              percentage: Math.round((usedMB / limitMB) * 100)
            },
            timestamp: new Date().toISOString()
          });
        }
      }, 30000); // Check every 30 seconds
    }
  }

  private setupOnlineStatusTracking() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.flushErrorQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  reportError(error: ErrorDetails) {
    console.error('🚨 Error reported to monitoring:', error);
    
    // Store error locally with rotation
    try {
      const recentErrors = JSON.parse(localStorage.getItem('app_errors') || '[]');
      recentErrors.unshift({
        ...error,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      });
      localStorage.setItem('app_errors', JSON.stringify(recentErrors.slice(0, 50)));
    } catch (e) {
      console.warn('Could not store error locally:', e);
    }

    // Report to Sentry if available
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      (window as any).Sentry.captureException(new Error(error.message), {
        contexts: {
          error_context: {
            context: error.context,
            url: error.url,
            timestamp: error.timestamp,
            userAgent: error.userAgent
          }
        },
        tags: {
          error_type: error.context
        }
      });
    }

    // Report to analytics if available
    if (window.gtag) {
      window.gtag('event', 'exception', {
        description: `${error.context}: ${error.message}`,
        fatal: false,
        error_context: error.context
      });
    }

    // Queue for sending when online
    this.errorQueue.push(error);
    if (this.isOnline) {
      this.flushErrorQueue();
    }
  }

  reportPerformanceIssue(issue: PerformanceIssue) {
    console.warn('⚠️ Performance issue detected:', issue);
    this.performanceIssues.push(issue);
    
    // Report to analytics
    if (window.gtag) {
      window.gtag('event', 'performance_issue', {
        event_category: 'Performance',
        event_label: issue.type,
        value: issue.details.duration || issue.details.percentage || 1
      });
    }
  }

  private flushErrorQueue() {
    // In a real app, you'd send these to your error reporting service
    // For now, we'll just log them and clear the queue
    if (this.errorQueue.length > 0) {
      console.log('📊 Flushing error queue:', this.errorQueue);
      this.errorQueue = [];
    }
  }

  getRecentErrors(): ErrorDetails[] {
    try {
      return JSON.parse(localStorage.getItem('app_errors') || '[]');
    } catch (e) {
      return [];
    }
  }

  getPerformanceIssues(): PerformanceIssue[] {
    return [...this.performanceIssues];
  }

  clearErrorHistory() {
    try {
      localStorage.removeItem('app_errors');
      localStorage.removeItem('recent_errors');
      this.errorQueue = [];
      this.performanceIssues = [];
    } catch (e) {
      console.warn('Could not clear error history:', e);
    }
  }
}

// React Query error handler
export const handleReactQueryError = (error: any, context: string = 'React Query') => {
  const monitor = ErrorMonitor.getInstance();
  monitor.reportError({
    message: error.message || 'Unknown React Query error',
    stack: error.stack,
    context,
    url: window.location.href,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent
  });
};

// Navigation error handler
export const handleNavigationError = (error: any, context: string = 'Navigation') => {
  const monitor = ErrorMonitor.getInstance();
  monitor.reportError({
    message: error.message || 'Navigation error',
    stack: error.stack,
    context,
    url: window.location.href,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent
  });
};

// Initialize error monitoring
export const initializeErrorMonitoring = () => {
  return ErrorMonitor.getInstance();
};