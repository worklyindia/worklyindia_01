import React from "react";
import { AlertTriangle, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAccountDeletion } from "@/hooks/useAccountDeletion";

interface DeleteAccountCountdownProps {
  userId: string | undefined;
  variant?: 'card' | 'banner';
}

export const DeleteAccountCountdown = ({ userId, variant = 'card' }: DeleteAccountCountdownProps) => {
  const { hasPendingDeletion, formattedTime, cancelDeletion, loading } = useAccountDeletion(userId);
  const [isCancelling, setIsCancelling] = React.useState(false);

  const handleCancel = async () => {
    setIsCancelling(true);
    await cancelDeletion();
    setIsCancelling(false);
  };

  if (loading || !hasPendingDeletion) return null;

  if (variant === 'banner') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-800">
                Your account will be deleted in{' '}
                <span className="font-mono font-bold text-red-600 text-base">{formattedTime}</span>
              </p>
              <p className="text-xs text-red-600">All your data will be permanently removed</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancel}
            disabled={isCancelling}
            className="border-red-300 text-red-700 hover:bg-red-100 hover:text-red-800"
          >
            {isCancelling ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <X className="w-4 h-4 mr-1" />
            )}
            Cancel Deletion
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Card className="border-red-300 bg-red-50 p-6">
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-red-600" />
        </div>
        
        <div>
          <h3 className="text-lg font-semibold text-red-800">Account Deletion Scheduled</h3>
          <p className="text-sm text-red-600 mt-1">Your account will be permanently deleted in:</p>
        </div>

        <div className="bg-white rounded-xl px-6 py-4 border border-red-200 shadow-sm">
          <span className="font-mono text-4xl font-bold text-red-600 tracking-wider">
            {formattedTime}
          </span>
        </div>

        <p className="text-xs text-red-500 max-w-xs">
          All your profile data, applications, saved jobs, and account information will be permanently removed.
        </p>

        <Button
          variant="outline"
          onClick={handleCancel}
          disabled={isCancelling}
          className="w-full border-red-300 text-red-700 hover:bg-red-100 hover:text-red-800"
        >
          {isCancelling ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <X className="w-4 h-4 mr-2" />
          )}
          Cancel Account Deletion
        </Button>
      </div>
    </Card>
  );
};
