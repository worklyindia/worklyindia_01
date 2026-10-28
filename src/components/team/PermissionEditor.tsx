import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { TeamMember } from "@/hooks/useTeamManagement";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/LoadingSpinner";

interface PermissionEditorProps {
  member: TeamMember | null;
  open: boolean;
  onClose: () => void;
  onSave: (userId: string, permissions: any) => Promise<void>;
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

export function PermissionEditor({ member, open, onClose, onSave }: PermissionEditorProps) {
  const [permissions, setPermissions] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [loadingPermissions, setLoadingPermissions] = useState(false);

  useEffect(() => {
    const loadPermissions = async () => {
      // Always reset when dialog closes
      if (!open) {
        setPermissions({});
        return;
      }

      // If no member, reset and exit
      if (!member) {
        setPermissions({});
        return;
      }

      console.log('🔍 Loading permissions for member:', member.user_id);
      console.log('📋 Member object:', member);
      console.log('🔐 Member permissions from prop:', member.permissions);

      // Check if permissions from prop are valid (not just an empty object)
      const hasValidPermissions = member.permissions && 
        Object.values(member.permissions).some(category => 
          typeof category === 'object' && Object.keys(category).length > 0
        );

      if (hasValidPermissions) {
        console.log('✅ Using permissions from member object:', member.permissions);
        setPermissions(member.permissions);
        return;
      }

      // Fetch from database as fallback
      try {
        setLoadingPermissions(true);
        console.log('🔄 Fetching permissions from database...');
        
        const { data, error } = await supabase
          .from('admin_permissions')
          .select('permissions')
          .eq('user_id', member.user_id)
          .single();

        if (error) {
          console.error('❌ Error fetching permissions:', error);
          setPermissions({});
          return;
        }

        console.log('✅ Fetched permissions from DB:', data?.permissions);
        setPermissions(data?.permissions || {});
      } catch (err) {
        console.error('❌ Exception loading permissions:', err);
        setPermissions({});
      } finally {
        setLoadingPermissions(false);
      }
    };

    loadPermissions();
  }, [open, member]);

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

  const handleSave = async () => {
    if (!member) return;
    
    try {
      setSaving(true);
      await onSave(member.user_id, permissions);
      onClose();
    } catch (error) {
      // Error handled in hook
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="text-base md:text-lg">Edit Permissions</DialogTitle>
          <DialogDescription className="text-sm">
            Configure permissions for {member?.full_name || member?.email}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[50vh] sm:h-[400px] pr-2 sm:pr-4">
          {loadingPermissions ? (
            <div className="flex items-center justify-center h-full">
              <LoadingSpinner size="lg" />
            </div>
          ) : (
            <div className="space-y-4 md:space-y-6">
              {permissionCategories.map((category) => (
              <div key={category.key} className="space-y-2 md:space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <h4 className="font-medium text-sm">{category.label}</h4>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => handleSelectAll(category.key, category.actions)}
                    >
                      Select All
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => handleDeselectAll(category.key, category.actions)}
                    >
                      Deselect All
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3">
                  {category.actions.map((action) => (
                    <div key={action} className="flex items-center space-x-2 min-h-[44px] sm:min-h-0">
                      <Checkbox
                        id={`${category.key}-${action}`}
                        checked={permissions[category.key]?.[action] || false}
                        onCheckedChange={(checked) =>
                          handlePermissionChange(category.key, action, checked as boolean)
                        }
                      />
                      <Label
                        htmlFor={`${category.key}-${action}`}
                        className="text-sm font-normal cursor-pointer capitalize"
                      >
                        {action.replace(/_/g, ' ')}
                      </Label>
                    </div>
                  ))}
                </div>
                <Separator />
              </div>
            ))}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={saving || loadingPermissions} className="w-full sm:w-auto min-h-[48px]">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || loadingPermissions} className="w-full sm:w-auto min-h-[48px]">
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
