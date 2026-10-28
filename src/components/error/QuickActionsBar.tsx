import { RefreshCw, ArrowLeft, Home, Copy, Mail, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormattedError } from '@/utils/errorFormatter';
import { useErrorActions } from '@/hooks/useErrorActions';
import { useNativeHaptics } from '@/hooks/useNativeHaptics';

interface QuickActionsBarProps {
  error: FormattedError;
  onRetry: () => void;
  onGoBack: () => void;
  onGoHome: () => void;
  isOffline?: boolean;
  canRetry?: boolean;
}

export const QuickActionsBar = ({ 
  error, 
  onRetry, 
  onGoBack, 
  onGoHome,
  isOffline = false,
  canRetry = true,
}: QuickActionsBarProps) => {
  const { copyError, sendReport, shareOnWhatsApp, isLoading } = useErrorActions();
  const { lightImpact } = useNativeHaptics();

  const handleCopy = async () => {
    lightImpact();
    await copyError(error);
  };

  const handleReport = async () => {
    lightImpact();
    await sendReport(error);
  };

  const handleRetry = () => {
    lightImpact();
    onRetry();
  };

  const handleGoBack = () => {
    lightImpact();
    onGoBack();
  };

  const handleGoHome = () => {
    lightImpact();
    onGoHome();
  };

  return (
    <div className="space-y-3 p-4 bg-background/95 backdrop-blur-lg border-t">
      {/* Primary Actions */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          onClick={handleRetry}
          className="w-full gap-2 active:scale-95 transition-transform"
          size="lg"
          disabled={isOffline && !canRetry}
        >
          <RefreshCw className={`w-4 h-4 ${isOffline ? 'animate-pulse' : ''}`} />
          {isOffline ? 'Reconnecting...' : 'Try Again'}
        </Button>
        
        <Button
          onClick={handleGoHome}
          variant="outline"
          className="w-full gap-2 active:scale-95 transition-transform"
          size="lg"
        >
          <Home className="w-4 h-4" />
          Go Home
        </Button>
      </div>

      {/* Secondary Actions */}
      <div className="grid grid-cols-4 gap-2">
        <Button
          onClick={handleGoBack}
          variant="ghost"
          size="sm"
          className="flex-col h-auto py-3 gap-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-xs">Back</span>
        </Button>

        <Button
          onClick={handleCopy}
          variant="ghost"
          size="sm"
          className="flex-col h-auto py-3 gap-1"
          disabled={isLoading}
        >
          <Copy className="w-4 h-4" />
          <span className="text-xs">Copy</span>
        </Button>

        <Button
          onClick={handleReport}
          variant="ghost"
          size="sm"
          className="flex-col h-auto py-3 gap-1"
          disabled={isLoading}
        >
          <Mail className="w-4 h-4" />
          <span className="text-xs">Email</span>
        </Button>

        <Button
          onClick={() => {
            lightImpact();
            shareOnWhatsApp(error);
          }}
          variant="ghost"
          size="sm"
          className="flex-col h-auto py-3 gap-1"
        >
          <MessageCircle className="w-4 h-4" />
          <span className="text-xs">WhatsApp</span>
        </Button>
      </div>
    </div>
  );
};
