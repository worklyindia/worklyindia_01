import { useState, useEffect } from 'react';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorCategoryBadge } from './ErrorCategoryBadge';
import { ErrorDetailsPanel } from './ErrorDetailsPanel';
import { QuickActionsBar } from './QuickActionsBar';
import { ErrorHistoryDrawer } from './ErrorHistoryDrawer';
import { FormattedError } from '@/utils/errorFormatter';
import { useNativeHaptics } from '@/hooks/useNativeHaptics';
import { Separator } from '@/components/ui/separator';

interface ErrorBottomSheetProps {
  error: FormattedError;
  onRetry: () => void;
  onGoBack: () => void;
  onClose?: () => void;
}

export const ErrorBottomSheet = ({ 
  error, 
  onRetry, 
  onGoBack,
  onClose 
}: ErrorBottomSheetProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { errorHaptic } = useNativeHaptics();

  useEffect(() => {
    // Trigger haptic feedback on mount
    errorHaptic();
  }, []);

  const handleGoHome = () => {
    window.location.href = '/';
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
      <div 
        className={`w-full max-w-2xl bg-card border-t-4 shadow-2xl rounded-t-3xl transition-all duration-300 ${
          isExpanded ? 'h-[90vh]' : 'h-auto max-h-[70vh]'
        }`}
        style={{ borderTopColor: error.category.color }}
      >
        {/* Handle Bar */}
        <div className="flex justify-center pt-3 pb-2">
          <button 
            onClick={toggleExpanded}
            className="w-12 h-1.5 bg-muted-foreground/20 rounded-full hover:bg-muted-foreground/30 transition-colors"
          />
        </div>

        {/* Header */}
        <div className="px-4 pt-2 pb-4">
          <div className="flex items-start justify-between gap-4 mb-4">
            <ErrorCategoryBadge category={error.category} />
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleExpanded}
                className="rounded-full"
              >
                {isExpanded ? (
                  <ChevronDown className="w-5 h-5" />
                ) : (
                  <ChevronUp className="w-5 h-5" />
                )}
              </Button>
              {onClose && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="rounded-full"
                >
                  <X className="w-5 h-5" />
                </Button>
              )}
            </div>
          </div>

          {/* Quick Summary */}
          {!isExpanded && (
            <div className="bg-muted/50 p-3 rounded-lg mb-4">
              <p className="text-sm line-clamp-2">{error.message}</p>
            </div>
          )}
        </div>

        <Separator />

        {/* Content */}
        {isExpanded && (
          <div className="flex-1 overflow-hidden">
            <ErrorDetailsPanel error={error} />
          </div>
        )}

        {/* Footer */}
        <div className="mt-auto">
          {isExpanded && (
            <>
              <Separator />
              <div className="p-4">
                <ErrorHistoryDrawer />
              </div>
            </>
          )}
          <QuickActionsBar
            error={error}
            onRetry={onRetry}
            onGoBack={onGoBack}
            onGoHome={handleGoHome}
          />
        </div>
      </div>
    </div>
  );
};
