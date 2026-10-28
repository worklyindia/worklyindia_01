import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Shield, Trash2 } from "lucide-react";

interface BulkActionsBarProps {
  selectedCount: number;
  onClear: () => void;
  onBulkPermissions: () => void;
  onBulkRemove: () => void;
  onBulkRoleChange: () => void;
}

export function BulkActionsBar({ selectedCount, onClear, onBulkPermissions, onBulkRemove, onBulkRoleChange }: BulkActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5 w-[95vw] max-w-3xl">
      <div className="bg-primary text-primary-foreground rounded-lg shadow-lg border border-primary/20 p-3 md:p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center justify-between w-full sm:w-auto gap-2">
            <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/30 text-xs">
              {selectedCount} selected
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="h-8 text-white hover:bg-white/20 min-h-[44px] sm:min-h-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="hidden sm:block h-6 w-px bg-white/20" />

          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <Button
              variant="secondary"
              size="sm"
              onClick={onBulkRoleChange}
              className="bg-white/20 text-white hover:bg-white/30 flex-1 sm:flex-initial text-xs min-h-[44px] sm:min-h-0"
            >
              <Shield className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Change Roles</span>
              <span className="sm:hidden">Roles</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onBulkPermissions}
              className="bg-white/20 text-white hover:bg-white/30 flex-1 sm:flex-initial text-xs min-h-[44px] sm:min-h-0"
            >
              <Shield className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Update Permissions</span>
              <span className="sm:hidden">Perms</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onBulkRemove}
              className="bg-red-500/20 text-white hover:bg-red-500/30 flex-1 sm:flex-initial text-xs min-h-[44px] sm:min-h-0"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Remove Members</span>
              <span className="sm:hidden">Remove</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
