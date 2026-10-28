import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, User, Building2, Phone, RefreshCw } from "lucide-react";
import { useContactInfoProfiles } from "@/hooks/useContactInfoProfiles";
import WebsiteUserCard from "@/components/owner-portal/WebsiteUserCard";
import EnhancedEmployerCard from "@/components/owner-portal/EnhancedEmployerCard";
import { WebsiteUserEditDialog } from "@/components/owner-portal/WebsiteUserEditDialog";
import { WebsiteUserProfileDialog } from "@/components/owner-portal/WebsiteUserProfileDialog";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useAdminStatus } from "@/hooks/useAdminStatus";
import { toast } from "sonner";
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

export default function ContactInfoPage() {
  const { phoneNumber } = useParams<{ phoneNumber: string }>();
  const navigate = useNavigate();
  const decodedPhone = phoneNumber ? decodeURIComponent(phoneNumber) : "";
  
  const { isAdmin } = useAdminStatus();
  
  const {
    websiteUsers,
    employers,
    loading,
    error,
    refreshData,
    updateWebsiteUserStatus,
    updateWebsiteUserProfile,
    updateEmployerJobVisibility,
    updateEmployerAccountStatus,
    deleteWebsiteUser
  } = useContactInfoProfiles(decodedPhone);

  // Website User dialogs
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const totalProfiles = websiteUsers.length + employers.length;

  const handleEditUser = async (updatedUser: any) => {
    try {
      await updateWebsiteUserProfile(updatedUser.user_id, updatedUser);
      toast.success("Profile updated successfully");
      setEditDialogOpen(false);
    } catch (error) {
      toast.error("Failed to update profile");
    }
  };

  const handleViewUser = (user: any) => {
    setSelectedUser(user);
    setViewDialogOpen(true);
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  const openDeleteDialog = (userId: string, userName: string) => {
    setUserToDelete({ id: userId, name: userName });
    setDeleteDialogOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    
    try {
      setDeleting(true);
      await deleteWebsiteUser(userToDelete.id);
      toast.success("User deleted successfully");
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error("Failed to delete user");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-whatsapp-green text-white">
        <div className="flex items-center gap-2 px-3 py-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleGoBack}
            className="text-white hover:bg-whatsapp-green-dark h-8 w-8"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="font-semibold text-base whitespace-nowrap">Contact Info</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={refreshData}
            className="text-white hover:bg-whatsapp-green-dark h-6 w-6"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={refreshData} variant="outline">
              Try Again
            </Button>
          </div>
        ) : totalProfiles === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">No Profiles Found</h3>
            <p className="text-sm">
              No website users or employers found with this phone number.
            </p>
            <Button onClick={handleGoBack} className="mt-4" variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Chat
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Website Users Section */}
            {websiteUsers.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <User className="h-5 w-5 text-green-600" />
                  Website Users ({websiteUsers.length})
                </h2>
                <div className="grid gap-4 grid-cols-1">
                    {websiteUsers.map((user) => (
                      <WebsiteUserCard
                        key={user.user_id}
                        user={user}
                        onEdit={() => {
                          setSelectedUser(user);
                          setEditDialogOpen(true);
                        }}
                        onView={() => handleViewUser(user)}
                        onStatusUpdate={refreshData}
                        onDelete={() => openDeleteDialog(user.user_id, user.full_name || "Unknown User")}
                        updateUserStatus={updateWebsiteUserStatus}
                      />
                    ))}
                </div>
              </div>
            )}

            {/* Employers Section */}
            {employers.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-blue-600" />
                  Employers ({employers.length})
                </h2>
                <div className="grid gap-4 grid-cols-1">
                  {employers.map((employer) => (
                    <EnhancedEmployerCard
                      key={employer.user_id}
                      employer={employer}
                      onEdit={() => {}}
                      onView={() => {}}
                      onJobPostingToggle={updateEmployerJobVisibility}
                      onAccountStatusChange={updateEmployerAccountStatus}
                      onVerificationUpdate={refreshData}
                      isAdminUser={isAdmin}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Website User Edit Dialog */}
      <WebsiteUserEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        user={selectedUser}
        onSave={handleEditUser}
      />

      {/* Website User Profile View Dialog */}
      <WebsiteUserProfileDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        user={selectedUser}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{userToDelete?.name}</strong>'s account? 
              This will permanently remove all their data including profile, applications, 
              and related information. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete User"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
