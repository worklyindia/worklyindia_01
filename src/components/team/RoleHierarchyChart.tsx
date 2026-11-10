import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TeamRole } from "@/hooks/useTeamManagement";
import { Crown, Shield, Flag, Headset, Users } from "lucide-react";

interface RoleHierarchyChartProps {
  roles: TeamRole[];
  memberCounts?: Record<string, number>;
}

const roleIcons: Record<string, any> = {
  owner: Crown,
  admin: Shield,
  moderator: Flag,
  support: Headset,
  default: Users,
};

const roleHierarchy = ["owner", "admin", "moderator", "support", "viewer"];

export function RoleHierarchyChart({ roles, memberCounts = {} }: RoleHierarchyChartProps) {
  const sortedRoles = [...roles].sort((a, b) => {
    const aIndex = roleHierarchy.indexOf(a.role_name);
    const bIndex = roleHierarchy.indexOf(b.role_name);
    
    if (aIndex === -1 && bIndex === -1) return 0;
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

  const getIcon = (roleName: string) => {
    const Icon = roleIcons[roleName] || roleIcons.default;
    return Icon;
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Role Hierarchy</h3>
          <p className="text-sm text-muted-foreground">Organization of roles and their authority levels</p>
        </div>

        <div className="space-y-3">
          {sortedRoles.map((role, index) => {
            const Icon = getIcon(role.role_name);
            const count = memberCounts[role.role_name] || 0;
            
            return (
              <div key={role.id} className="relative">
                {index > 0 && (
                  <div className="absolute left-6 -top-3 w-0.5 h-3 bg-border" />
                )}
                <div className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="relative">
                    <div className={`p-3 rounded-lg ${
                      role.role_name === 'owner' ? 'bg-yellow-100 dark:bg-yellow-900/30' :
                      role.role_name === 'admin' ? 'bg-purple-100 dark:bg-purple-900/30' :
                      role.role_name === 'moderator' ? 'bg-blue-100 dark:bg-blue-900/30' :
                      'bg-muted'
                    }`}>
                      <Icon className={`h-5 w-5 ${
                        role.role_name === 'owner' ? 'text-yellow-600 dark:text-yellow-400' :
                        role.role_name === 'admin' ? 'text-purple-600 dark:text-purple-400' :
                        role.role_name === 'moderator' ? 'text-blue-600 dark:text-blue-400' :
                        'text-muted-foreground'
                      }`} />
                    </div>
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold capitalize">{role.role_name}</h4>
                      {role.is_custom && (
                        <Badge variant="outline" className="text-xs">Custom</Badge>
                      )}
                      {count > 0 && (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <Users className="h-3 w-3" />
                          {count}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{role.role_description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t pt-4">
          <p className="text-xs text-muted-foreground">
            Higher roles inherit permissions from lower roles in the hierarchy
          </p>
        </div>
      </div>
    </Card>
  );
}
