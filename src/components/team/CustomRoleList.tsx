import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TeamRole } from "@/hooks/useTeamManagement";
import { Trash2, Shield, Users } from "lucide-react";
import { formatDateWithSeconds } from "@/utils/dateFormatUtils";
import { useState } from "react";
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

interface CustomRoleListProps {
  roles: TeamRole[];
  memberCounts: Record<string, number>;
  onDelete: (roleId: string) => Promise<void>;
}

export function CustomRoleList({ roles, memberCounts, onDelete }: CustomRoleListProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<TeamRole | null>(null);
  const [deleting, setDeleting] = useState(false);

  const customRoles = roles.filter(r => r.is_custom);

  const handleDeleteClick = (role: TeamRole) => {
    setSelectedRole(role);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedRole) return;
    
    try {
      setDeleting(true);
      await onDelete(selectedRole.id);
      setDeleteDialogOpen(false);
      setSelectedRole(null);
    } catch (error) {
      // Error handled in parent
    } finally {
      setDeleting(false);
    }
  };

  if (customRoles.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">No custom roles created yet</p>
        <p className="text-sm text-muted-foreground mt-2">
          Create a custom role with specific permissions for your team
        </p>
      </Card>
    );
  }

  const memberCount = selectedRole ? (memberCounts[selectedRole.role_name] || 0) : 0;
  const canDelete = memberCount === 0;

  return (
    <>
      <ScrollArea className="h-[400px]">
        <div className="space-y-3">
          {customRoles.map((role) => {
            const count = memberCounts[role.role_name] || 0;
            
            return (
              <Card key={role.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold capitalize text-base">{role.role_name}</h4>
                      <Badge variant="outline" className="text-xs">Custom</Badge>
                      {count > 0 && (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <Users className="h-3 w-3" />
                          {count}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {role.role_description}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Created <span className="whitespace-nowrap">{formatDateWithSeconds(role.created_at)}</span>
                    </p>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteClick(role)}
                    className="shrink-0 hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </ScrollArea>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Custom Role</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Are you sure you want to delete the role <strong className="capitalize">{selectedRole?.role_name}</strong>?
                </p>
                
                {!canDelete && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <p className="text-sm font-medium text-destructive">
                      Cannot delete this role
                    </p>
                    <p className="text-sm text-destructive/90 mt-1">
                      {memberCount} team member{memberCount !== 1 ? 's' : ''} currently {memberCount !== 1 ? 'have' : 'has'} this role. 
                      Please reassign them to a different role first.
                    </p>
                  </div>
                )}
                
                {canDelete && (
                  <p className="text-sm text-muted-foreground">
                    This action cannot be undone. The role will be permanently removed from your team.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={!canDelete || deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete Role'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
