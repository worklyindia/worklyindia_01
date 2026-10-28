import { useEffect, useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBrandAssets } from '@/hooks/useBrandAssets';

interface SafeLoadingSpinnerProps {
  message?: string;
  timeout?: number;
  onTimeout?: () => void;
  showRetry?: boolean;
  onRetry?: () => void;
}

/**
 * SafeLoadingSpinner - A loading component that shows a timeout message
 * and retry option if loading takes too long
 */
const SafeLoadingSpinner = ({ 
  message = "Loading...", 
  timeout = 10000, // 10 seconds
  onTimeout,
  showRetry = true,
  onRetry
}: SafeLoadingSpinnerProps) => {
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const brandAssets = useBrandAssets();
  const logoUrl = brandAssets.logo_url;

  useEffect(() => {
    const timer = setTimeout(() => {
      setHasTimedOut(true);
      onTimeout?.();
    }, timeout);

    return () => clearTimeout(timer);
  }, [timeout, onTimeout]);

  const handleRetry = () => {
    setIsRetrying(true);
    setHasTimedOut(false);
    onRetry?.();
    
    // Reset retry state after a moment
    setTimeout(() => {
      setIsRetrying(false);
    }, 1000);
  };

  if (hasTimedOut && !isRetrying) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6 glass rounded-2xl p-8 border border-border/50">
          <div className="w-16 h-16 mx-auto rounded-full bg-warning/10 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-warning" />
          </div>
          
          <div className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">
              Taking longer than expected
            </h2>
            <p className="text-muted-foreground">
              The app is taking a while to load. This might be due to a slow network connection.
            </p>
          </div>

          {showRetry && (
            <div className="flex flex-col gap-3">
              <Button 
                onClick={handleRetry}
                className="inline-flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </Button>
              
              <Button 
                variant="ghost"
                onClick={() => window.location.reload()}
                className="text-sm"
              >
                Refresh Page
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-primary/95 to-secondary/95 backdrop-blur-sm flex flex-col items-center justify-center z-50">
      {/* Minimal Logo */}
      <div className="mb-6 animate-fade-in">
        {brandAssets.isLoading || !logoUrl ? (
          <div className="w-14 h-14 rounded-xl bg-white/20 animate-pulse" />
        ) : (
          <img 
            src={`${logoUrl}?w=64&q=80&f=webp`}
            alt="Loading" 
            className="w-14 h-14 rounded-xl"
            loading="eager"
          />
        )}
      </div>
      
      {/* Simplified Spinner */}
      <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
      
      {hasTimedOut && isRetrying && (
        <p className="mt-4 text-white/80 text-sm">Retrying...</p>
      )}
    </div>
  );
};

export default SafeLoadingSpinner;