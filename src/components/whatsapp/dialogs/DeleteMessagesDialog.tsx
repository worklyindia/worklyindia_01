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

interface DeleteMessagesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messageCount: number;
  onConfirm: () => void;
  isDeleting?: boolean;
}

export function DeleteMessagesDialog({
  open,
  onOpenChange,
  messageCount,
  onConfirm,
  isDeleting = false
}: DeleteMessagesDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-whatsapp-panel border-whatsapp-border">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-white">
            Delete {messageCount === 1 ? 'message' : `${messageCount} messages`}?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-whatsapp-secondary">
            {messageCount === 1 
              ? 'This message will be deleted for you. This action cannot be undone.'
              : `These ${messageCount} messages will be deleted for you. This action cannot be undone.`
            }
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel 
            className="bg-transparent border-whatsapp-border text-white hover:bg-whatsapp-hover"
            disabled={isDeleting}
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700 text-white"
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
