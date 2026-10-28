import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Check, X } from "lucide-react";
import { TeamMember } from "@/hooks/useTeamManagement";

interface PermissionViewerProps {
  member: TeamMember | null;
  open: boolean;
  onClose: () => void;
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

export function PermissionViewer({ member, open, onClose }: PermissionViewerProps) {
  if (!member) return null;

  const permissions = member.permissions || {};
  
  // Calculate total granted permissions
  const totalGranted = permissionCategories.reduce((total, category) => {
    return total + category.actions.filter(action => permissions[category.key]?.[action]).length;
  }, 0);
  
  const totalPossible = permissionCategories.reduce((total, cat) => total + cat.actions.length, 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="text-base md:text-lg">View Permissions</DialogTitle>
          <DialogDescription className="text-sm">
            {member.full_name || member.email}
          </DialogDescription>
        </DialogHeader>

        <div className="mb-4">
          <Badge variant="secondary" className="text-xs">
            {totalGranted} of {totalPossible} permissions granted
          </Badge>
        </div>

        <ScrollArea className="h-[50vh] sm:h-[400px] pr-2 sm:pr-4">
          <div className="space-y-4 md:space-y-6">
            {permissionCategories.map((category) => {
              const categoryPerms = permissions[category.key] || {};
              const grantedCount = category.actions.filter(action => categoryPerms[action]).length;
              
              return (
                <div key={category.key} className="space-y-2 md:space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm">{category.label}</h4>
                    <Badge variant="outline" className="text-xs">
                      {grantedCount}/{category.actions.length}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3">
                    {category.actions.map((action) => {
                      const isGranted = categoryPerms[action] || false;
                      
                      return (
                        <div 
                          key={action} 
                          className={`flex items-center space-x-2 p-2 rounded-md border ${
                            isGranted 
                              ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800' 
                              : 'bg-muted/30 border-muted'
                          }`}
                        >
                          {isGranted ? (
                            <Check className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                          ) : (
                            <X className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                          <span className={`text-sm capitalize ${
                            isGranted 
                              ? 'text-green-900 dark:text-green-100 font-medium' 
                              : 'text-muted-foreground'
                          }`}>
                            {action.replace(/_/g, ' ')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <Separator />
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
