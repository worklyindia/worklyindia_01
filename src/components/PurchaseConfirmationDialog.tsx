import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";

interface PointsPackage {
  id: string;
  name: string;
  points_amount: number;
  price_inr: number;
  discount_percentage: number;
}

interface PurchaseConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedPackage: PointsPackage | null;
  onConfirm: () => void;
  loading: boolean;
}

const PurchaseConfirmationDialog: React.FC<PurchaseConfirmationDialogProps> = ({
  open,
  onOpenChange,
  selectedPackage,
  onConfirm,
  loading
}) => {
  if (!selectedPackage) return null;

  const originalPrice = selectedPackage.discount_percentage > 0 
    ? Math.round(selectedPackage.price_inr / (1 - selectedPackage.discount_percentage / 100))
    : selectedPackage.price_inr;

  const savings = originalPrice - selectedPackage.price_inr;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Confirm Purchase
          </DialogTitle>
          <DialogDescription>
            Please confirm your points package purchase.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Package Details */}
          <div className="bg-muted/30 rounded-lg p-4">
            <h4 className="font-semibold text-lg mb-2">{selectedPackage.name}</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Points:</span>
                <span className="font-medium">{selectedPackage.points_amount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Price:</span>
                <span className="font-medium text-lg">₹{selectedPackage.price_inr}</span>
              </div>
              {selectedPackage.discount_percentage > 0 && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Original Price:</span>
                    <span className="line-through text-muted-foreground">₹{originalPrice}</span>
                  </div>
                  <div className="flex justify-between text-green-600">
                    <span>You Save:</span>
                    <span className="font-medium">₹{savings} ({selectedPackage.discount_percentage}% OFF)</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Benefits */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
            <h4 className="font-medium text-sm text-primary mb-2">✨ What you get:</h4>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• {selectedPackage.points_amount.toLocaleString()} points added instantly</li>
              <li>• Premium hiring features access</li>
              <li>• Priority candidate matching</li>
              <li>• Valid for 12 months</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={onConfirm}
              disabled={loading}
              className="flex-1"
            >
              {loading ? "Processing..." : `Pay ₹${selectedPackage.price_inr}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PurchaseConfirmationDialog;