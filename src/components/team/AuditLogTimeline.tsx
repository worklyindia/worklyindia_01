import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AuditLog } from "@/hooks/useTeamManagement";
import { formatDateWithSeconds } from "@/utils/dateFormatUtils";
import { FileText, UserPlus, Edit, Trash2, Shield, Copy } from "lucide-react";
import { toast } from "sonner";

interface AuditLogTimelineProps {
  logs: AuditLog[];
}

const actionIcons: Record<string, any> = {
  create_custom_role: Shield,
  assign_role: UserPlus,
  update_permissions: Edit,
  remove_team_member: Trash2,
  default: FileText
};

const actionColors: Record<string, string> = {
  create_custom_role: "bg-blue-500",
  assign_role: "bg-green-500",
  update_permissions: "bg-yellow-500",
  remove_team_member: "bg-red-500",
  default: "bg-gray-500"
};

export function AuditLogTimeline({ logs }: AuditLogTimelineProps) {
  if (logs.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">No audit logs found</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {logs.map((log, index) => {
        const Icon = actionIcons[log.action_type] || actionIcons.default;
        const colorClass = actionColors[log.action_type] || actionColors.default;

        return (
          <Card key={log.id} className="p-3 sm:p-4">
            <div className="flex items-start gap-2 sm:gap-3 md:gap-4">
              <div className={`${colorClass} rounded-full p-1.5 sm:p-2 text-white shrink-0`}>
                <Icon className="h-3 w-3 sm:h-4 sm:w-4" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap">
                  <p className="font-medium text-xs sm:text-sm truncate">{log.admin_name || 'Unknown Admin'}</p>
                  <Badge variant="outline" className="text-[10px] sm:text-xs px-1.5 py-0.5">
                    {log.action_type?.replace(/_/g, ' ') || 'Unknown Action'}
                  </Badge>
                </div>

                <p className="text-[10px] sm:text-xs text-muted-foreground mb-2 break-words">
                  {log.admin_email || 'No email'}
                  {log.target_email && ` → ${log.target_email}`}
                </p>

                {log.changes && Object.keys(log.changes).length > 0 && (
                  <div className="relative bg-muted p-2 rounded text-[9px] sm:text-[10px] md:text-xs mb-2 overflow-x-auto max-w-full">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-1 right-1 h-6 w-6 shrink-0"
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(log.changes, null, 2));
                        toast.success("Changes copied to clipboard");
                      }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono pr-8">
                      {JSON.stringify(log.changes, null, 2)}
                    </pre>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2 text-[10px] sm:text-xs text-muted-foreground">
                  <span className="break-words">{formatDateWithSeconds(log.logged_at)}</span>
                  {log.ip_address && (
                    <>
                      <span className="hidden sm:inline">•</span>
                      <span className="break-all truncate">IP: {log.ip_address}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
