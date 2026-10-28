import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AccountChangeFrame } from "@/components/auth/AccountChangeFrame";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { StandardSheetHeader } from "@/components/StandardSheetHeader";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ChangePasswordDialogProps {
  children?: React.ReactNode;
  standalone?: boolean;
}

export const ChangePasswordDialog = ({ children, standalone }: ChangePasswordDialogProps) => {
  const navigate = useNavigate();
  const isEmployer = useLocation().pathname.startsWith('/employer');
  const fallback = isEmployer ? '/employer-settings' : '/settings';
  const close = () => standalone ? navigate(fallback) : setOpen(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords don't match",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters long",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
        current_password: currentPassword
      });

      if (error) throw error;

      // Update password_changed_at in both user_settings and employer_settings
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const now = new Date().toISOString();
        
        // Try updating user_settings
        await supabase
          .from('user_settings')
          .upsert({
            user_id: user.id,
            password_changed_at: now
          }, { onConflict: 'user_id' });
        
        // Try updating employer_settings
        await supabase
          .from('employer_settings')
          .upsert({
            user_id: user.id,
            password_changed_at: now
          }, { onConflict: 'user_id' });
      }

      toast({
        title: "Success",
        description: "Password updated successfully. Please log in again.",
      });

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setOpen(false);
      
      // Sign out from all devices to invalidate old sessions
      // This ensures old password can't be used from other devices
      await supabase.auth.signOut({ scope: 'global' });
      
      // Redirect to login
      navigate(isEmployer ? '/employer-auth' : '/auth', { replace: true });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update password",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AccountChangeFrame standalone={standalone} title="Change Password" fallback={fallback} open={open} onOpenChange={setOpen} trigger={children}>
        {!standalone && <StandardSheetHeader 
          title="Change Password"
          onClose={close}
        />}
        <form onSubmit={handlePasswordChange} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Current Password</Label>
            <PasswordInput
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <PasswordInput
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <PasswordInput
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Updating..." : "Update Password"}
            </Button>
          </div>
        </form>
    </AccountChangeFrame>
  );
};