import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TeamRole } from "@/hooks/useTeamManagement";
import { Shield, Copy } from "lucide-react";

interface CustomRoleDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (roleName: string, roleDescription: string, permissions: any) => Promise<void>;
  existingRoles: TeamRole[];
}

const permissionCategories = [
  {
    key: "users_management",
    label: "Users Management",
    actions: ["view", "edit", "delete", "ban"]
  },
  {
    key: "employers_management",
    label: "Employers Management",
    actions: ["view", "edit", "verify", "delete"]
  },
  {
    key: "analytics",
    label: "Analytics",
    actions: ["view", "export"]
  },
  {
    key: "financial",
    label: "Financial",
    actions: ["view", "edit", "approve_withdrawals"]
  },
  {
    key: "content",
    label: "Content",
    actions: ["view", "edit", "publish"]
  },
  {
    key: "settings",
    label: "Settings",
    actions: ["view", "edit"]
  },
  {
    key: "team_management",
    label: "Team Management",
    actions: ["view", "invite", "edit_roles", "remove_members"]
  },
  {
    key: "packages",
    label: "Packages",
    actions: ["view", "edit", "create"]
  },
  {
    key: "support",
    label: "Support",
    actions: ["view", "respond", "close_tickets"]
  }
];

export function CustomRoleDialog({ open, onClose, onSave, existingRoles }: CustomRoleDialogProps) {
  const [roleName, setRoleName] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [permissions, setPermissions] = useState<any>({});
  const [templateRole, setTemplateRole] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setRoleName("");
      setRoleDescription("");
      setPermissions({});
      setTemplateRole("");
    }
  }, [open]);

  const handlePermissionChange = (category: string, action: string, checked: boolean) => {
    setPermissions((prev: any) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [action]: checked
      }
    }));
  };

  const handleSelectAll = (category: string, actions: string[]) => {
    setPermissions((prev: any) => ({
      ...prev,
      [category]: actions.reduce((acc, action) => ({ ...acc, [action]: true }), {})
    }));
  };

  const handleDeselectAll = (category: string, actions: string[]) => {
    setPermissions((prev: any) => ({
      ...prev,
      [category]: actions.reduce((acc, action) => ({ ...acc, [action]: false }), {})
    }));
  };

  const handleCopyFromTemplate = (roleId: string) => {
    if (!roleId) return;
    
    const role = existingRoles.find(r => r.id === roleId);
    if (role) {
      setPermissions(role.base_permissions || {});
      setRoleDescription(role.role_description);
    }
  };

  const handleSave = async () => {
    if (!roleName.trim()) return;
    
    try {
      setSaving(true);
      await onSave(roleName.toLowerCase().replace(/\s+/g, '_'), roleDescription, permissions);
      onClose();
    } catch (error) {
      // Error handled in hook
    } finally {
      setSaving(false);
    }
  };

  const isValid = roleName.trim().length > 0 && roleDescription.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-full sm:max-w-3xl h-screen sm:h-auto sm:max-h-[90vh] flex flex-col rounded-none sm:rounded-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base md:text-lg">
            <Shield className="h-5 w-5 text-primary" />
            Create Custom Role
          </DialogTitle>
          <DialogDescription className="text-sm">
            Create a custom role with specific permissions for your team members
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4 -mx-2 px-2 max-h-[calc(100vh-240px)] sm:max-h-[70vh]">
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="role-name" className="text-base">Role Name *</Label>
                <Input
                  id="role-name"
                  placeholder="e.g., Content Manager"
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  className="min-h-[56px] text-base"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role-description" className="text-base">Description *</Label>
                <Textarea
                  id="role-description"
                  placeholder="Describe the responsibilities of this role..."
                  value={roleDescription}
                  onChange={(e) => setRoleDescription(e.target.value)}
                  rows={3}
                  className="text-base min-h-[80px]"
                />
              </div>

              {/* Template Selector */}
              <div className="space-y-2">
                <Label htmlFor="template" className="text-base">Copy from Template (Optional)</Label>
                <div className="flex gap-2">
                  <Select value={templateRole} onValueChange={setTemplateRole}>
                    <SelectTrigger id="template" className="min-h-[56px] text-base">
                      <SelectValue placeholder="Select a role template" />
                    </SelectTrigger>
                    <SelectContent>
                      {existingRoles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          <div className="flex items-center gap-2">
                            <span className="capitalize">{role.role_name}</span>
                            {!role.is_custom && <Badge variant="outline" className="text-xs">System</Badge>}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleCopyFromTemplate(templateRole)}
                    disabled={!templateRole}
                    className="min-h-[56px] min-w-[56px] px-4"
                  >
                    <Copy className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>

            <Separator />

            {/* Permissions */}
            <div className="space-y-4">
              <h4 className="font-semibold text-base">Permissions</h4>
              
              {permissionCategories.map((category) => (
                <div key={category.key} className="space-y-3 border rounded-lg p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <h5 className="font-medium text-base">{category.label}</h5>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        className="min-h-[48px] text-sm px-4"
                        onClick={() => handleSelectAll(category.key, category.actions)}
                      >
                        Select All
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="min-h-[48px] text-sm px-4"
                        onClick={() => handleDeselectAll(category.key, category.actions)}
                      >
                        Deselect All
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {category.actions.map((action) => (
                      <div key={action} className="flex items-center space-x-3 min-h-[48px]">
                        <Checkbox
                          id={`${category.key}-${action}`}
                          checked={permissions[category.key]?.[action] || false}
                          onCheckedChange={(checked) =>
                            handlePermissionChange(category.key, action, checked as boolean)
                          }
                          className="h-5 w-5"
                        />
                        <Label
                          htmlFor={`${category.key}-${action}`}
                          className="text-base font-normal cursor-pointer capitalize flex-1"
                        >
                          {action.replace(/_/g, ' ')}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={saving} className="w-full sm:w-auto min-h-[56px] text-base">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!isValid || saving} className="w-full sm:w-auto min-h-[56px] text-base font-medium">
            {saving ? "Creating..." : "Create Role"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
