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

interface ClearChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactName?: string;
  onConfirm: () => void;
  isClearing?: boolean;
}

export function ClearChatDialog({
  open,
  onOpenChange,
  contactName = "this chat",
  onConfirm,
  isClearing = false
}: ClearChatDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-whatsapp-panel border-whatsapp-border">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-white">
            Clear all messages?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-whatsapp-secondary">
            All messages in {contactName} will be permanently deleted. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel 
            className="bg-transparent border-whatsapp-border text-white hover:bg-whatsapp-hover"
            disabled={isClearing}
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700 text-white"
            disabled={isClearing}
          >
            {isClearing ? 'Clearing...' : 'Clear All'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
