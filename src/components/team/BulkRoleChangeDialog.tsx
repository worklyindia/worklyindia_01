import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TeamRole, TeamMember } from "@/hooks/useTeamManagement";
import { AlertTriangle, Info } from "lucide-react";

interface BulkRoleChangeDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (newRole: string, preservePermissions: boolean) => Promise<void>;
  roles: TeamRole[];
  selectedMembers: TeamMember[];
}

export function BulkRoleChangeDialog({ 
  open, 
  onClose, 
  onSave, 
  roles, 
  selectedMembers 
}: BulkRoleChangeDialogProps) {
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [preservePermissions, setPreservePermissions] = useState(false);
  const [saving, setSaving] = useState(false);

  // Analyze current roles across selected members
  const currentRolesInfo = useMemo(() => {
    const roleMap = new Map<string, number>();
    selectedMembers.forEach(member => {
      roleMap.set(member.role, (roleMap.get(member.role) || 0) + 1);
    });
    
    const uniqueRoles = Array.from(roleMap.entries());
    const allSameRole = uniqueRoles.length === 1;
    
    return {
      uniqueRoles,
      allSameRole,
      commonRole: allSameRole ? uniqueRoles[0][0] : null
    };
  }, [selectedMembers]);

  // Pre-select role if all members have the same role
  useEffect(() => {
    if (open && currentRolesInfo.allSameRole && currentRolesInfo.commonRole) {
      setSelectedRole(currentRolesInfo.commonRole);
    } else if (open && !currentRolesInfo.allSameRole) {
      setSelectedRole("");
    }
  }, [open, currentRolesInfo]);

  const handleSave = async () => {
    if (!selectedRole) return;
    
    try {
      setSaving(true);
      await onSave(selectedRole, preservePermissions);
      setSelectedRole("");
      setPreservePermissions(false);
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
          <DialogTitle>Bulk Change Roles</DialogTitle>
          <DialogDescription>
            Change the role for {selectedMembers.length} selected member{selectedMembers.length > 1 ? 's' : ''}
          </DialogDescription>
        </DialogHeader>

        {currentRolesInfo.allSameRole ? (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              All selected members currently have the role: <Badge variant="outline" className="ml-1 capitalize">{currentRolesInfo.commonRole}</Badge>
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Selected members have different roles:
              <div className="mt-2 flex flex-wrap gap-2">
                {currentRolesInfo.uniqueRoles.map(([role, count]) => (
                  <Badge key={role} variant="secondary" className="capitalize">
                    {role} ({count})
                  </Badge>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="role-select">New Role</Label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger id="role-select">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.role_name} className="capitalize">
                    {role.role_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedRoleData && (
            <div className="bg-muted p-3 rounded-lg text-sm space-y-2">
              <div className="flex items-center gap-2">
                <p className="font-medium">Selected Role:</p>
                <Badge className="capitalize">{selectedRoleData.role_name}</Badge>
              </div>
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
          <Button onClick={handleSave} disabled={saving || !selectedRole || (currentRolesInfo.allSameRole && selectedRole === currentRolesInfo.commonRole)}>
            {saving ? "Changing..." : `Change ${selectedMembers.length} Role${selectedMembers.length > 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
