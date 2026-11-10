import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';

interface Props {
  children: ReactNode;
  context: string;
  fallback?: ReactNode;
  maxRetries?: number;
  retryDelay?: number;
}

interface State {
  hasError: boolean;
  error?: Error;
  retryCount: number;
  isAutoRetrying: boolean;
  autoRetryAttempts: number;
  lastErrorTime: number;
}

interface ErrorContext {
  route: string;
  formData: any;
  scrollPosition: number;
  userAction: string;
  timestamp: string;
}

export class AutoRecoveryErrorBoundary extends Component<Props, State> {
  private retryTimeout?: NodeJS.Timeout;
  private autoRetryTimeout?: NodeJS.Timeout;
  private errorContext: ErrorContext | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      retryCount: 0,
      isAutoRetrying: false,
      autoRetryAttempts: 0,
      lastErrorTime: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      lastErrorTime: Date.now()
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('🚨 AutoRecovery Error Boundary:', { error, errorInfo, context: this.props.context });
    
    // Capture current context for recovery
    this.captureErrorContext();
    
    // Start intelligent auto-recovery
    this.startAutoRecovery(error);
    
    // Report to monitoring
    this.reportError(error, errorInfo);
  }

  private captureErrorContext() {
    try {
      this.errorContext = {
        route: window.location.pathname + window.location.search,
        formData: this.captureFormData(),
        scrollPosition: window.scrollY,
        userAction: this.props.context,
        timestamp: new Date().toISOString()
      };
      
      // Store in session for recovery
      sessionStorage.setItem('errorContext', JSON.stringify(this.errorContext));
    } catch (e) {
      console.warn('Could not capture error context:', e);
    }
  }

  private captureFormData() {
    try {
      const forms = document.querySelectorAll('form');
      const formData: any = {};
      
      forms.forEach((form, index) => {
        const data = new FormData(form);
        const entries: any = {};
        for (const [key, value] of data.entries()) {
          entries[key] = value;
        }
        if (Object.keys(entries).length > 0) {
          formData[`form_${index}`] = entries;
        }
      });
      
      return formData;
    } catch (e) {
      return {};
    }
  }

  private startAutoRecovery(error: Error) {
    const { maxRetries = 3 } = this.props;
    
    // Categorize error for recovery strategy
    const isRecoverable = this.isRecoverableError(error);
    
    if (!isRecoverable) {
      console.log('❌ Error not recoverable, showing UI');
      return;
    }

    // Start silent auto-recovery
    this.setState({ isAutoRetrying: true });
    
    const retryDelay = this.calculateRetryDelay();
    console.log(`🔄 Starting auto-recovery in ${retryDelay}ms (attempt ${this.state.autoRetryAttempts + 1})`);
    
    this.autoRetryTimeout = setTimeout(() => {
      this.attemptSilentRecovery();
    }, retryDelay);
  }

  private isRecoverableError(error: Error): boolean {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';
    
    // Recoverable errors
    const recoverablePatterns = [
      'loading chunk',
      'failed to fetch',
      'network error',
      'timeout',
      'chunk load error',
      'dynamicimports',
      'lazy loading',
      'hydration',
      'unexpected token'
    ];
    
    // Non-recoverable errors
    const nonRecoverablePatterns = [
      'cannot read properties',
      'is not a function',
      'syntax error',
      'reference error',
      'type error'
    ];
    
    const isNonRecoverable = nonRecoverablePatterns.some(pattern => 
      message.includes(pattern) || stack.includes(pattern)
    );
    
    if (isNonRecoverable) return false;
    
    return recoverablePatterns.some(pattern => 
      message.includes(pattern) || stack.includes(pattern)
    );
  }

  private calculateRetryDelay(): number {
    const baseDelay = this.props.retryDelay || 1000;
    const attempts = this.state.autoRetryAttempts;
    // Exponential backoff: 1s, 2s, 4s
    return Math.min(baseDelay * Math.pow(2, attempts), 8000);
  }

  private async attemptSilentRecovery() {
    try {
      console.log('🔄 Attempting silent recovery...');
      
      // Clear any cached modules that might be corrupted
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(name => caches.delete(name))
        );
      }
      
      // Force re-render by clearing state
      this.setState({ 
        hasError: false, 
        error: undefined,
        autoRetryAttempts: this.state.autoRetryAttempts + 1,
        isAutoRetrying: false
      });
      
      // Restore user context after recovery
      setTimeout(() => {
        this.restoreUserContext();
      }, 100);
      
      console.log('✅ Silent recovery successful');
      
    } catch (recoveryError) {
      console.error('❌ Silent recovery failed:', recoveryError);
      
      const maxRetries = this.props.maxRetries || 3;
      if (this.state.autoRetryAttempts < maxRetries) {
        // Try again with longer delay
        setTimeout(() => {
          this.startAutoRecovery(this.state.error!);
        }, 2000);
      } else {
        // Fall back to showing error UI
        this.setState({ isAutoRetrying: false });
      }
    }
  }

  private restoreUserContext() {
    try {
      const contextStr = sessionStorage.getItem('errorContext');
      if (!contextStr) return;
      
      const context: ErrorContext = JSON.parse(contextStr);
      
      // Restore scroll position
      if (context.scrollPosition > 0) {
        window.scrollTo({ top: context.scrollPosition, behavior: 'smooth' });
      }
      
      // Restore form data
      this.restoreFormData(context.formData);
      
      console.log('✅ User context restored');
      
    } catch (e) {
      console.warn('Could not restore user context:', e);
    }
  }

  private restoreFormData(formData: any) {
    try {
      Object.keys(formData).forEach((formKey, index) => {
        const form = document.querySelectorAll('form')[index];
        if (form) {
          Object.entries(formData[formKey]).forEach(([key, value]) => {
            const input = form.querySelector(`[name="${key}"]`) as HTMLInputElement;
            if (input && typeof value === 'string') {
              input.value = value;
            }
          });
        }
      });
    } catch (e) {
      console.warn('Could not restore form data:', e);
    }
  }

  private reportError(error: Error, errorInfo: any) {
    if (window.gtag) {
      window.gtag('event', 'auto_recovery_error', {
        description: `${this.props.context}: ${error.message}`,
        fatal: false,
        recovery_attempts: this.state.autoRetryAttempts
      });
    }
  }

  private handleManualRetry = () => {
    console.log('🔄 Manual retry triggered');
    this.setState({ 
      hasError: false, 
      error: undefined, 
      retryCount: this.state.retryCount + 1 
    });
    
    setTimeout(() => {
      this.restoreUserContext();
    }, 100);
  };

  componentWillUnmount() {
    if (this.retryTimeout) clearTimeout(this.retryTimeout);
    if (this.autoRetryTimeout) clearTimeout(this.autoRetryTimeout);
  }

  render() {
    if (this.state.hasError) {
      // Show loading during auto-retry
      if (this.state.isAutoRetrying) {
        return (
          <div className="flex items-center justify-center p-8">
            <div className="flex items-center space-x-3 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Fixing the issue...</span>
            </div>
          </div>
        );
      }

      // Show fallback or error UI only after auto-recovery fails
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Something went wrong</h3>
            <p className="text-muted-foreground">
              We tried to fix this automatically but need your help.
            </p>
          </div>
          
          <button
            onClick={this.handleManualRetry}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
          
          {this.state.autoRetryAttempts > 0 && (
            <p className="text-xs text-muted-foreground">
              Auto-recovery attempts: {this.state.autoRetryAttempts}
            </p>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default AutoRecoveryErrorBoundary;