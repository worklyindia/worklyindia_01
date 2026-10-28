import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payment: { amount: number; description: string; upiId?: string }) => void;
}

export function PaymentDialog({ open, onOpenChange, onSubmit }: PaymentDialogProps) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [upiId, setUpiId] = useState("");

  const handleSubmit = () => {
    const amountNum = parseFloat(amount);
    if (amountNum > 0) {
      onSubmit({
        amount: amountNum,
        description: description.trim(),
        upiId: upiId.trim() || undefined,
      });
      setAmount("");
      setDescription("");
      setUpiId("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request Payment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground">Amount (₹)</label>
            <Input
              type="number"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Description (Optional)</label>
            <Textarea
              placeholder="What's this payment for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">UPI ID (Optional)</label>
            <Input
              placeholder="yourname@upi"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
            />
          </div>
          <Button onClick={handleSubmit} className="w-full">
            Send Payment Request
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
