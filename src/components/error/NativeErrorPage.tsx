import { useState, useEffect, useRef, useCallback } from 'react';
import { X, ChevronDown, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorCategoryBadge } from './ErrorCategoryBadge';
import { ErrorDetailsPanel } from './ErrorDetailsPanel';
import { QuickActionsBar } from './QuickActionsBar';
import { ErrorHistoryDrawer } from './ErrorHistoryDrawer';
import { FormattedError } from '@/utils/errorFormatter';
import { useNativeHaptics } from '@/hooks/useNativeHaptics';
import { usePlatformStyle } from '@/hooks/usePlatformStyle';
import { useOfflineRecovery } from '@/hooks/useOfflineRecovery';
import { Separator } from '@/components/ui/separator';

interface NativeErrorPageProps {
  error: FormattedError;
  onRetry: () => void;
  onGoBack: () => void;
  onClose?: () => void;
}

export const NativeErrorPage = ({ 
  error, 
  onRetry, 
  onGoBack,
  onClose 
}: NativeErrorPageProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const { errorHaptic, successHaptic } = useNativeHaptics();
  const platformStyle = usePlatformStyle();
  
  // Use refs to avoid recreating callbacks
  const onRetryRef = useRef(onRetry);
  const errorCategoryRef = useRef(error.category.category);
  
  useEffect(() => {
    onRetryRef.current = onRetry;
    errorCategoryRef.current = error.category.category;
  }, [onRetry, error.category.category]);
  
  // Stable callback for offline recovery
  const handleReconnect = useCallback(() => {
    if (errorCategoryRef.current === 'network') {
      setTimeout(() => onRetryRef.current(), 1000);
    }
  }, []);
  
  const { isOffline, connectionType, canRetry, recheckConnection } = useOfflineRecovery(handleReconnect);
  
  // Run haptic only once on mount
  const hasRunHaptic = useRef(false);
  useEffect(() => {
    if (!hasRunHaptic.current) {
      hasRunHaptic.current = true;
      errorHaptic();
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    }
  }, [errorHaptic]);

  const handleGoHome = () => {
    window.location.href = '/';
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const handleRetry = () => {
    if (isOffline && error.category.category === 'network') {
      recheckConnection();
      return;
    }
    successHaptic();
    onRetry();
  };

  const handleSwipeDown = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const startY = touch.clientY;
    
    const handleMove = (moveEvent: TouchEvent) => {
      const currentY = moveEvent.touches[0].clientY;
      const diff = currentY - startY;
      
      if (diff > 100 && !isExpanded) {
        document.removeEventListener('touchmove', handleMove);
        document.removeEventListener('touchend', handleEnd);
        setIsVisible(false);
        setTimeout(() => {
          onClose?.();
        }, 300);
      }
    };
    
    const handleEnd = () => {
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
    };
    
    document.addEventListener('touchmove', handleMove);
    document.addEventListener('touchend', handleEnd);
  };

  // Check if error is network-related and offline
  const isNetworkError = error.category.category === 'network';
  const showOfflineWarning = isOffline && isNetworkError;

  return (
    <div 
      className={`fixed inset-0 z-[200] flex items-end justify-center transition-all duration-300 ${
        isVisible ? 'bg-black/60 backdrop-blur-sm' : 'bg-black/0'
      }`}
      style={{
        animation: isVisible ? 'fade-in 0.3s ease-out' : 'fade-out 0.3s ease-out',
      }}
    >
      <div 
        className={`w-full h-full flex flex-col ${platformStyle.containerClass} transition-all duration-500 ease-out ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
        }`}
        style={{
          animation: isVisible 
            ? 'slide-up-bounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)' 
            : 'slide-out-down 0.3s ease-in',
          paddingTop: platformStyle.isIOS ? 'env(safe-area-inset-top)' : '0',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
        onTouchStart={handleSwipeDown}
      >
        {/* Handle Bar for swipe gesture */}
        <div className="flex justify-center pt-3 pb-2">
          <button 
            onClick={toggleExpanded}
            className="w-12 h-1.5 bg-muted-foreground/20 rounded-full hover:bg-muted-foreground/30 transition-colors active:scale-95"
          />
        </div>

        {/* Header */}
        <div className="px-3 pt-1 pb-2">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div 
              className="animate-shake-bounce"
              style={{
                animation: 'shake-pulse 0.8s ease-out',
              }}
            >
              <ErrorCategoryBadge category={error.category} />
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleExpanded}
                className={`rounded-full ${platformStyle.buttonClass}`}
              >
                <ChevronDown 
                  className={`w-5 h-5 transition-transform duration-300 ${
                    isExpanded ? 'rotate-180' : ''
                  }`} 
                />
              </Button>
              {onClose && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className={`rounded-full ${platformStyle.buttonClass}`}
                >
                  <X className="w-5 h-5" />
                </Button>
              )}
            </div>
          </div>

          {/* Offline Warning Banner */}
          {showOfflineWarning && (
            <div 
              className={`mb-2 p-2.5 ${platformStyle.cardClass} border-l-4 animate-pulse`}
              style={{ borderColor: 'hsl(var(--destructive))' }}
            >
              <div className="flex items-center gap-2">
                <WifiOff className="w-5 h-5 text-destructive" />
                <div className="flex-1">
                  <div className="font-semibold text-sm">No Internet Connection</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Please check your {connectionType === 'cellular' ? 'mobile data' : 'WiFi'} connection
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick Summary */}
          {!isExpanded && (
            <div 
              className={`${platformStyle.cardClass} p-2.5 animate-fade-in`}
              style={{
                background: `linear-gradient(135deg, ${error.category.color}15, ${error.category.color}05)`,
              }}
            >
              <p className={`text-xs line-clamp-2 ${platformStyle.textClass}`}>
                {error.message}
              </p>
            </div>
          )}
        </div>

        {/* Animated Separator */}
        <Separator className="animate-scale-in" />

        {/* Content - Expanded Details */}
        {isExpanded && (
          <div 
            className="flex-1 overflow-hidden animate-fade-in"
            style={{
              animation: 'fade-in 0.3s ease-out',
            }}
          >
            <ErrorDetailsPanel error={error} />
          </div>
        )}

        {/* Spacer for non-expanded state */}
        {!isExpanded && <div className="flex-1" />}

        {/* Footer */}
        <div className="mt-auto">
          {isExpanded && <Separator />}
          <QuickActionsBar
            error={error}
            onRetry={handleRetry}
            onGoBack={onGoBack}
            onGoHome={handleGoHome}
            isOffline={showOfflineWarning}
            canRetry={canRetry}
          />
        </div>

        {/* Animated Background Gradient */}
        <div 
          className="absolute inset-0 -z-10 opacity-5 pointer-events-none"
          style={{
            background: `radial-gradient(circle at 50% 0%, ${error.category.color}, transparent 70%)`,
            animation: 'pulse-glow 3s ease-in-out infinite',
          }}
        />
      </div>

      <style>{`
        @keyframes slide-up-bounce {
          0% {
            transform: translateY(100%);
            opacity: 0;
          }
          60% {
            transform: translateY(-10px);
            opacity: 1;
          }
          100% {
            transform: translateY(0);
            opacity: 1;
          }
        }

        @keyframes slide-out-down {
          from {
            transform: translateY(0);
            opacity: 1;
          }
          to {
            transform: translateY(100%);
            opacity: 0;
          }
        }

        @keyframes shake-pulse {
          0%, 100% {
            transform: translateX(0) scale(1);
          }
          10%, 30%, 50% {
            transform: translateX(-5px) scale(1.05);
          }
          20%, 40% {
            transform: translateX(5px) scale(1.05);
          }
          60% {
            transform: scale(1.1);
          }
        }

        @keyframes pulse-glow {
          0%, 100% {
            opacity: 0.05;
          }
          50% {
            opacity: 0.15;
          }
        }

        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fade-out {
          from {
            opacity: 1;
          }
          to {
            opacity: 0;
          }
        }

        @keyframes scale-in {
          from {
            transform: scaleX(0);
          }
          to {
            transform: scaleX(1);
          }
        }

        /* Reduce motion for accessibility */
        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </div>
  );
};
