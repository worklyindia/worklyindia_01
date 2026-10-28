import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ConfirmationDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  requireTyping?: boolean;
  typingConfirmText?: string;
}

export function ConfirmationDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  requireTyping = false,
  typingConfirmText = "CONFIRM"
}: ConfirmationDialogProps) {
  const [typedText, setTypedText] = useState("");
  const canConfirm = !requireTyping || typedText === typingConfirmText;

  const handleConfirm = () => {
    if (canConfirm) {
      onConfirm();
      setTypedText("");
      onClose();
    }
  };

  const handleClose = () => {
    setTypedText("");
    onClose();
  };

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className="max-w-[95vw] sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-base md:text-lg">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-sm">{description}</AlertDialogDescription>
        </AlertDialogHeader>

        {requireTyping && (
          <div className="space-y-2">
            <Label htmlFor="confirm-text" className="text-sm">
              Type <strong>{typingConfirmText}</strong> to confirm
            </Label>
            <Input
              id="confirm-text"
              value={typedText}
              onChange={(e) => setTypedText(e.target.value)}
              placeholder={typingConfirmText}
              className="min-h-[44px]"
            />
          </div>
        )}

        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel onClick={handleClose} className="w-full sm:w-auto min-h-[44px]">Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full sm:w-auto min-h-[44px]"
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
