import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, Zap, CreditCard, RefreshCcw, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";

export type AIErrorType = 
  | 'no_subscription' 
  | 'limit_exceeded' 
  | 'api_error' 
  | 'missing_title'
  | 'missing_fields'
  | 'unknown';

interface AIErrorDetails {
  type: AIErrorType;
  message: string;
  details?: string;
  remainingUsage?: number;
  totalLimit?: number;
}

interface AIUsageLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  error: AIErrorDetails | null;
}

const errorConfig: Record<AIErrorType, {
  icon: React.ReactNode;
  title: string;
  actionLabel: string;
  actionRoute?: string;
  showRetry?: boolean;
}> = {
  no_subscription: {
    icon: <CreditCard className="h-12 w-12 text-amber-500" />,
    title: "AI Subscription Required",
    actionLabel: "Subscribe to AI Plan",
    actionRoute: "/settings?tab=ai-subscription"
  },
  limit_exceeded: {
    icon: <Zap className="h-12 w-12 text-red-500" />,
    title: "AI Usage Limit Reached",
    actionLabel: "Upgrade Your Plan",
    actionRoute: "/settings?tab=ai-subscription"
  },
  api_error: {
    icon: <RefreshCcw className="h-12 w-12 text-orange-500" />,
    title: "AI Service Error",
    actionLabel: "Try Again Later",
    showRetry: true
  },
  missing_title: {
    icon: <FileText className="h-12 w-12 text-blue-500" />,
    title: "Job Title Required",
    actionLabel: "Enter Job Title"
  },
  missing_fields: {
    icon: <FileText className="h-12 w-12 text-amber-500" />,
    title: "Required Fields Missing",
    actionLabel: "Fill Required Fields"
  },
  unknown: {
    icon: <AlertCircle className="h-12 w-12 text-red-500" />,
    title: "Something Went Wrong",
    actionLabel: "Try Again",
    showRetry: true
  }
};

const AIUsageLimitModal = ({ isOpen, onClose, error }: AIUsageLimitModalProps) => {
  const navigate = useNavigate();

  if (!error) return null;

  const config = errorConfig[error.type] || errorConfig.unknown;

  const handleAction = () => {
    if (config.actionRoute) {
      navigate(config.actionRoute);
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6 rounded-2xl">
        <DialogHeader className="text-center space-y-3">
          <div className="mx-auto flex items-center justify-center">
            {config.icon}
          </div>
          <DialogTitle className="text-lg sm:text-xl font-semibold text-center break-words">
            {config.title}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="text-center space-y-2">
              <p className="text-sm sm:text-base text-foreground/80 break-words">{error.message}</p>
              {error.details && (
                <div className="max-h-40 overflow-y-auto rounded-md bg-muted/40 p-2 text-left">
                  <p className="text-[11px] sm:text-xs text-muted-foreground break-all whitespace-pre-wrap font-mono leading-relaxed">
                    {error.details}
                  </p>
                </div>
              )}
            {error.type === 'limit_exceeded' && error.totalLimit && (
              <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium">
                  Monthly Limit: <span className="text-primary">{error.totalLimit} messages</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Your limit resets at the start of each billing cycle
                </p>
              </div>
            )}
            </div>
          </DialogDescription>
        </DialogHeader>
        
        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 mt-4">
          <Button variant="outline" onClick={onClose} className="w-full sm:flex-1 h-11">
            Close
          </Button>
          {config.actionRoute && (
            <Button onClick={handleAction} className="w-full sm:flex-1 h-11 gap-2">
              {error.type === 'limit_exceeded' ? <Zap className="h-4 w-4" /> : null}
              {config.actionLabel}
            </Button>
          )}
          {config.showRetry && !config.actionRoute && (
            <Button onClick={onClose} className="w-full sm:flex-1 h-11">
              {config.actionLabel}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AIUsageLimitModal;
