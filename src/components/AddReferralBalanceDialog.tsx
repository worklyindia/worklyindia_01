import React, { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNativeFeel } from "@/hooks/useNativeFeel";

interface AddReferralBalanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onSuccess?: () => void;
}

const AddReferralBalanceDialog = ({ open, onOpenChange, userId, onSuccess }: AddReferralBalanceDialogProps) => {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { tapFeedback, successFeedback, errorFeedback } = useNativeFeel();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    tapFeedback();
    
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      errorFeedback();
      toast.error("Please enter a valid amount");
      return;
    }

    if (!reason.trim()) {
      errorFeedback();
      toast.error("Please provide a reason");
      return;
    }

    setIsLoading(true);
    
    try {
      const { data: adminData } = await supabase.auth.getUser();
      const { error: adjustmentError } = await supabase
        .from("referral_wallet_adjustments")
        .insert({
          user_id: userId,
          admin_id: adminData.user?.id,
          amount: amountNum,
          adjustment_type: "add",
          reason: reason
        });

      if (adjustmentError) throw adjustmentError;

      successFeedback();
      toast.success(`₹${amountNum} added to referral wallet`);
      onSuccess?.();
      onOpenChange(false);
      setAmount("");
      setReason("");
      
    } catch (error: any) {
      errorFeedback();
      console.error("Error adding referral balance:", error);
      toast.error(error.message || "Failed to add balance");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    tapFeedback();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent 
        side="bottom" 
        className="rounded-t-3xl p-6 max-h-[85vh] overflow-y-auto [&>button]:hidden"
        style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
      >
        {/* Handle bar */}
        <div className="flex justify-center pb-4">
          <div className="w-12 h-1.5 bg-muted rounded-full" />
        </div>

        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <Plus className="h-5 w-5 text-green-600" />
            Add Referral Balance
          </SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount" className="text-sm font-medium">
              Amount (₹)
            </Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount to add"
              className="text-base h-12"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason" className="text-sm font-medium">
              Reason
            </Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for adding balance..."
              className="text-base min-h-[80px] resize-none"
              required
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="flex-1 text-base h-12 active:scale-95 transition-transform"
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-green-600 hover:bg-green-700 text-base h-12 active:scale-95 transition-transform"
            >
              {isLoading ? "Adding..." : "Add Balance"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
};

export default AddReferralBalanceDialog;
