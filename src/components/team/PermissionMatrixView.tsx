import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { TeamRole } from "@/hooks/useTeamManagement";
import { Check, X } from "lucide-react";

interface PermissionMatrixViewProps {
  roles: TeamRole[];
}

const permissionCategories = [
  { key: "users_management", label: "Users", actions: ["view", "edit", "delete", "ban"] },
  { key: "employers_management", label: "Employers", actions: ["view", "edit", "verify", "delete"] },
  { key: "analytics", label: "Analytics", actions: ["view", "export"] },
  { key: "financial", label: "Financial", actions: ["view", "edit", "approve_withdrawals"] },
  { key: "content", label: "Content", actions: ["view", "edit", "publish"] },
  { key: "settings", label: "Settings", actions: ["view", "edit"] },
  { key: "team_management", label: "Team", actions: ["view", "invite", "edit_roles", "remove_members"] },
  { key: "packages", label: "Packages", actions: ["view", "edit", "create"] },
  { key: "support", label: "Support", actions: ["view", "respond", "close_tickets"] }
];

export function PermissionMatrixView({ roles }: PermissionMatrixViewProps) {
  const hasPermission = (role: TeamRole, category: string, action: string): boolean => {
    return role.base_permissions?.[category]?.[action] === true;
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Permission Matrix</h3>
          <p className="text-sm text-muted-foreground">Compare permissions across all roles</p>
        </div>

        <ScrollArea className="w-full h-[600px]">
          <div className="min-w-[800px] pb-4 pr-4">
            {/* Header */}
            <div className="grid gap-2 mb-4 pr-4" style={{ gridTemplateColumns: `200px repeat(${roles.length}, 120px)` }}>
              <div className="font-semibold text-sm">
                Permission
              </div>
              {roles.map((role) => (
                <div key={role.id} className="text-center">
                  <Badge variant={role.is_custom ? "default" : "secondary"} className="text-xs capitalize">
                    {role.role_name}
                  </Badge>
                </div>
              ))}
            </div>

            {/* Permission Rows */}
            <div className="space-y-6">
              {permissionCategories.map((category) => (
                <div key={category.key} className="space-y-2">
                  <div className="font-medium text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded">
                    {category.label}
                  </div>
                  {category.actions.map((action) => (
                    <div
                      key={`${category.key}-${action}`}
                      className="grid gap-2 border-b py-2 hover:bg-muted/30 transition-colors"
                      style={{ gridTemplateColumns: `200px repeat(${roles.length}, 120px)` }}
                    >
                      <div className="text-sm capitalize pl-6">
                        {action.replace(/_/g, ' ')}
                      </div>
                      {roles.map((role) => (
                        <div key={role.id} className="flex justify-center">
                          {hasPermission(role, category.key, action) ? (
                            <div className="bg-green-100 dark:bg-green-900/30 rounded-full p-1">
                              <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                            </div>
                          ) : (
                            <div className="bg-muted rounded-full p-1">
                              <X className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    </Card>
  );
}
