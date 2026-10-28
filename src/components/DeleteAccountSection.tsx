import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccountDeletion } from "@/hooks/useAccountDeletion";
import { DeleteAccountCountdown } from "@/components/DeleteAccountCountdown";
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

interface DeleteAccountSectionProps {
  userId: string | undefined;
  userType?: 'employee' | 'employer';
}

export const DeleteAccountSection = ({ userId, userType = 'employee' }: DeleteAccountSectionProps) => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { hasPendingDeletion, requestDeletion, loading } = useAccountDeletion(userId);

  const handleDeleteAccount = async () => {
    const reason = userType === 'employer' 
      ? 'Employer requested account deletion'
      : 'User requested account deletion';
    
    const success = await requestDeletion(reason);
    if (success) {
      setShowDeleteDialog(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-between p-4 border border-red-200 rounded-xl animate-pulse">
        <div className="flex items-center space-x-3">
          <div className="w-5 h-5 bg-red-200 rounded" />
          <div className="space-y-2">
            <div className="h-4 w-24 bg-red-200 rounded" />
            <div className="h-3 w-40 bg-red-100 rounded" />
          </div>
        </div>
        <div className="h-8 w-16 bg-red-200 rounded" />
      </div>
    );
  }

  // Show countdown if deletion is pending
  if (hasPendingDeletion) {
    return <DeleteAccountCountdown userId={userId} variant="card" />;
  }

  // Show delete button
  return (
    <>
      <div className="flex items-center justify-between p-4 border border-red-200 rounded-xl">
        <div className="flex items-center space-x-3">
          <Trash2 className="w-5 h-5 text-red-600" />
          <div>
            <h4 className="font-medium text-foreground">Delete Account</h4>
            <p className="text-sm text-muted-foreground">Permanently delete your account and data</p>
          </div>
        </div>
        <Button 
          variant="destructive" 
          size="sm" 
          className="h-8 px-3 text-xs rounded-xl"
          onClick={() => setShowDeleteDialog(true)}
        >
          Delete
        </Button>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600">Delete Account</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Are you sure you want to delete your account?</p>
              <p className="font-medium">
                You will have 24 hours to cancel this request before your account is permanently deleted.
              </p>
              <p>All your profile data, applications, saved jobs, and account information will be removed.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteAccount}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
