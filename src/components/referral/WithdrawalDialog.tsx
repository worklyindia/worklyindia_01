import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, ChevronDown } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface WithdrawalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentBalance: number;
  paymentSettings: any;
  onWithdraw: (amount: number) => void;
  isProcessing: boolean;
}

export const WithdrawalDialog = ({
  open,
  onOpenChange,
  currentBalance,
  paymentSettings,
  onWithdraw,
  isProcessing,
}: WithdrawalDialogProps) => {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const minimumAmount = 100; // Minimum withdrawal amount

  const handleWithdraw = async () => {
    const withdrawalAmount = parseFloat(amount);
    if (withdrawalAmount >= minimumAmount && withdrawalAmount <= currentBalance) {
      setError(null); // Clear any previous errors
      console.log("💰 Initiating withdrawal:", withdrawalAmount);
      
      try {
        await onWithdraw(withdrawalAmount);
        // Only reset and close on success
        setAmount("");
        onOpenChange(false);
        console.log("✅ Withdrawal dialog closed successfully");
      } catch (err) {
        // Error will be handled by the mutation's onError
        console.error("❌ Withdrawal failed in dialog:", err);
        setError(err instanceof Error ? err.message : "Failed to process withdrawal");
      }
    }
  };

  const isValidAmount = () => {
    const withdrawalAmount = parseFloat(amount);
    return withdrawalAmount >= minimumAmount && withdrawalAmount <= currentBalance;
  };

  if (!paymentSettings) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-3xl p-6 max-h-[90vh] [&>button]:hidden">
          <SheetHeader>
            <div className="flex items-start justify-between mb-4">
              <SheetTitle className="text-left text-lg font-medium">Payment Settings Required</SheetTitle>
              <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="h-8 w-8 -mr-2">
                <ChevronDown className="h-5 w-5" />
              </Button>
            </div>
          </SheetHeader>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please set up your payment settings before making a withdrawal request.
            </AlertDescription>
          </Alert>
          <Button onClick={() => onOpenChange(false)} className="mt-4">Close</Button>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl p-6 max-h-[90vh] overflow-y-auto [&>button]:hidden">
        <SheetHeader>
          <div className="flex items-start justify-between mb-4">
            <SheetTitle className="text-left text-lg font-medium">Withdraw Balance</SheetTitle>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="h-8 w-8 -mr-2">
              <ChevronDown className="h-5 w-5" />
            </Button>
          </div>
        </SheetHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg bg-muted p-4">
            <p className="text-sm text-muted-foreground">Available Balance</p>
            <p className="text-2xl font-bold">₹{currentBalance.toFixed(2)}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Withdrawal Amount</Label>
            <Input
              id="amount"
              type="number"
              placeholder={`Minimum ₹${minimumAmount}`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min={minimumAmount}
              max={currentBalance}
            />
            <p className="text-xs text-muted-foreground">
              Minimum withdrawal: ₹{minimumAmount}
            </p>
          </div>

          <div className="rounded-lg border p-4 space-y-2">
            <p className="text-sm font-medium">Payment Details</p>
            <div className="text-sm space-y-1">
              {paymentSettings.name && (
                <p>Name: {paymentSettings.name}</p>
              )}
              {paymentSettings.bank_name && (
                <p>Bank Name: {paymentSettings.bank_name}</p>
              )}
              {paymentSettings.ifsc_code && (
                <p>IFSC Code: {paymentSettings.ifsc_code}</p>
              )}
              {paymentSettings.account_number && (
                <p>A/C: {paymentSettings.account_number}</p>
              )}
              {paymentSettings.upi_id && (
                <p>UPI: {paymentSettings.upi_id}</p>
              )}
            </div>
          </div>

          {amount && !isValidAmount() && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {parseFloat(amount) < minimumAmount
                  ? `Amount must be at least ₹${minimumAmount}`
                  : "Amount exceeds available balance"}
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleWithdraw}
            disabled={isProcessing || !isValidAmount()}
            className="flex-1"
          >
            {isProcessing ? "Processing..." : "Confirm Withdrawal"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
