import { PaymentPageHeader } from "@/components/PaymentPageHeader";
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Zap, Loader2 } from "lucide-react";
import { useUnifiedPayment, PaymentPackage } from "@/hooks/useUnifiedPayment";
import { useAuth } from "@/contexts/AuthContext";

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface BoostPackage extends PaymentPackage {
  boost_days: number;
  boost_level: number;
}

interface BoostPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedPackage: BoostPackage | null;
  jobId: string;
  jobTitle: string;
  onSuccess?: () => void;
}

const BoostPaymentDialog: React.FC<BoostPaymentDialogProps> = ({
  open,
  onOpenChange,
  selectedPackage,
  jobId,
  jobTitle,
  onSuccess
}) => {
  const { processPayment, loading } = useUnifiedPayment();
  const { user } = useAuth();

  const handlePayment = async () => {
    if (!selectedPackage || !jobId || !user) {
      toast.error("Missing required information");
      return;
    }

    const success = await processPayment('boost', selectedPackage, jobId, jobTitle);
    if (success) {
      onSuccess?.();
      onOpenChange(false);
    }
  };

  if (!selectedPackage) return null;

  const isProcessing = loading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent fullPage hideClose>
        <PaymentPageHeader onBack={() => onOpenChange(false)} subtitle="Confirm job boost" />

        <div className="space-y-4">
          {/* Job details */}
          <div className="bg-muted/30 rounded-lg p-3">
            <h4 className="font-medium text-sm text-foreground mb-1">Job:</h4>
            <p className="text-sm text-muted-foreground">{jobTitle}</p>
          </div>

          {/* Package details */}
          <div className="bg-muted/30 rounded-lg p-3">
            <h4 className="font-medium text-sm text-foreground mb-2">Boost Package:</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Package:</span>
                <span className="font-medium">{selectedPackage.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duration:</span>
                <span>{selectedPackage.boost_days} days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Boost Level:</span>
                <span>Level {selectedPackage.boost_level}</span>
              </div>
              <div className="flex justify-between font-semibold text-primary border-t pt-1 mt-2">
                <span>Total Cost:</span>
                <span>₹{selectedPackage.price_inr}</span>
              </div>
            </div>
          </div>

          {/* Benefits reminder */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
            <h4 className="font-medium text-sm text-primary mb-1">🚀 What you get:</h4>
            <ul className="text-xs text-muted-foreground space-y-0.5">
              <li>• Your job appears at the top of trending jobs</li>
              <li>• ⭐ Boosted badge on your job posting</li>
              <li>• Higher visibility to job seekers</li>
              <li>• More applications and engagement</li>
            </ul>
          </div>

          {/* Action buttons */}
          <div className="flex space-x-3 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={handlePayment}
              disabled={isProcessing}
              className="flex-1"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                `Pay ₹${selectedPackage.price_inr}`
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BoostPaymentDialog;
