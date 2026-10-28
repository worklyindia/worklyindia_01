import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTeamManagement } from "@/hooks/useTeamManagement";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, Copy, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

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

export default function CreateRole() {
  const navigate = useNavigate();
  const { createCustomRole, teamRoles, loading } = useTeamManagement();
  
  const [roleName, setRoleName] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [permissions, setPermissions] = useState<any>({});
  const [templateRole, setTemplateRole] = useState<string>("");
  const [saving, setSaving] = useState(false);

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
    
    const role = teamRoles.find(r => r.id === roleId);
    if (role) {
      setPermissions(role.base_permissions || {});
      setRoleDescription(role.role_description);
    }
  };

  const handleSave = async () => {
    if (!roleName.trim()) {
      toast.error('Please enter a role name');
      return;
    }
    
    if (!roleDescription.trim()) {
      toast.error('Please enter a role description');
      return;
    }
    
    try {
      setSaving(true);
      await createCustomRole(roleName.toLowerCase().replace(/\s+/g, '_'), roleDescription, permissions);
      toast.success('Custom role created successfully');
      navigate('/owner-portal/team-management');
    } catch (error) {
      // Error handled in hook
    } finally {
      setSaving(false);
    }
  };

  const isValid = roleName.trim().length > 0 && roleDescription.trim().length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="flex items-center gap-4 p-4 max-w-4xl mx-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/owner-portal/team-management')}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-xl font-bold truncate">Create Custom Role</h1>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">
                Create a custom role with specific permissions
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <ScrollArea className="h-[calc(100vh-140px)]">
        <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4 bg-background rounded-lg border p-4 sm:p-6">
            <h3 className="font-semibold text-base">Basic Information</h3>
            
            <div className="space-y-2">
              <Label htmlFor="role-name" className="text-sm font-medium">Role Name *</Label>
              <Input
                id="role-name"
                placeholder="e.g., Content Manager"
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                className="h-12 text-base"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role-description" className="text-sm font-medium">Description *</Label>
              <Textarea
                id="role-description"
                placeholder="Describe the responsibilities of this role..."
                value={roleDescription}
                onChange={(e) => setRoleDescription(e.target.value)}
                rows={3}
                className="text-base resize-none"
              />
            </div>

            {/* Template Selector */}
            <div className="space-y-2">
              <Label htmlFor="template" className="text-sm font-medium">Copy from Template (Optional)</Label>
              <div className="flex gap-2">
                <Select value={templateRole} onValueChange={setTemplateRole}>
                  <SelectTrigger id="template" className="h-12 text-base flex-1">
                    <SelectValue placeholder="Select a role template" />
                  </SelectTrigger>
                  <SelectContent>
                    {teamRoles.map((role) => (
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
                  className="h-12 w-12 p-0 shrink-0"
                >
                  <Copy className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>

          <Separator />

          {/* Permissions */}
          <div className="space-y-4">
            <h3 className="font-semibold text-base">Permissions</h3>
            
            {permissionCategories.map((category) => (
              <div key={category.key} className="bg-background border rounded-lg p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <h4 className="font-medium text-base">{category.label}</h4>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-10 text-sm"
                      onClick={() => handleSelectAll(category.key, category.actions)}
                    >
                      Select All
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-10 text-sm"
                      onClick={() => handleDeselectAll(category.key, category.actions)}
                    >
                      Deselect All
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {category.actions.map((action) => (
                    <div key={action} className="flex items-center space-x-3 h-10">
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
                        className="text-sm font-normal cursor-pointer capitalize flex-1"
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

      {/* Sticky Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4">
        <div className="max-w-4xl mx-auto flex flex-col-reverse sm:flex-row gap-3">
          <Button 
            variant="outline" 
            onClick={() => navigate('/owner-portal/team-management')} 
            disabled={saving} 
            className="w-full sm:w-auto h-12 text-base"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!isValid || saving} 
            className="w-full sm:w-auto h-12 text-base font-medium"
          >
            {saving ? "Creating..." : "Create Role"}
          </Button>
        </div>
      </div>
    </div>
  );
}
