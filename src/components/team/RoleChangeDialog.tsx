import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { TeamMember, TeamRole } from "@/hooks/useTeamManagement";
import { Badge } from "@/components/ui/badge";

interface RoleChangeDialogProps {
  member: TeamMember | null;
  open: boolean;
  onClose: () => void;
  onSave: (userId: string, newRole: string, preservePermissions: boolean) => Promise<void>;
  roles: TeamRole[];
}

export function RoleChangeDialog({ member, open, onClose, onSave, roles }: RoleChangeDialogProps) {
  const [selectedRole, setSelectedRole] = useState<string>(member?.role || "");
  const [preservePermissions, setPreservePermissions] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && member) {
      setSelectedRole(member.role);
      setPreservePermissions(false);
    }
  }, [open, member]);

  const handleSave = async () => {
    if (!member || !selectedRole) return;
    
    try {
      setSaving(true);
      await onSave(member.user_id, selectedRole, preservePermissions);
      onClose();
    } catch (error) {
      // Error handled in hook
    } finally {
      setSaving(false);
    }
  };

  const selectedRoleData = roles.find(r => r.role_name === selectedRole);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Change Member Role</DialogTitle>
          <DialogDescription>
            Update the role for {member?.full_name || member?.email}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Current Role</Label>
            <Badge variant="outline" className="capitalize">
              {member?.role}
            </Badge>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role-select">New Role</Label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger id="role-select">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.role_name}>
                    <div className="flex flex-col">
                      <span className="font-medium capitalize">{role.role_name}</span>
                      <span className="text-xs text-muted-foreground">{role.role_description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedRoleData && (
            <div className="bg-muted p-3 rounded-lg text-sm">
              <p className="font-medium mb-1">Role Description</p>
              <p className="text-muted-foreground">{selectedRoleData.role_description}</p>
            </div>
          )}

          <div className="flex items-center space-x-2 border-t pt-4">
            <Checkbox
              id="preserve-permissions"
              checked={preservePermissions}
              onCheckedChange={(checked) => setPreservePermissions(checked as boolean)}
            />
            <Label htmlFor="preserve-permissions" className="text-sm cursor-pointer">
              Preserve custom permissions
              <p className="text-xs text-muted-foreground font-normal">
                Keep existing custom permissions after role change
              </p>
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !selectedRole || selectedRole === member?.role}>
            {saving ? "Changing..." : "Change Role"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
