import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AuditLog } from "@/hooks/useTeamManagement";
import { formatDistanceToNow } from "date-fns";
import { Activity, TrendingUp, AlertCircle, Loader2 } from "lucide-react";

interface ActivityDashboardProps {
  recentLogs: AuditLog[];
  loading?: boolean;
  error?: string | null;
}

export function ActivityDashboard({ recentLogs, loading, error }: ActivityDashboardProps) {
  if (error) {
    return (
      <Card className="p-4 col-span-2 md:col-span-1">
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <div className="bg-red-100 dark:bg-red-900/20 p-2.5 rounded-lg shrink-0">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm sm:text-base">Error Loading Activity</h3>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 break-words">
                Unable to load recent activity. Please try refreshing the page.
              </p>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  if (loading && recentLogs.length === 0) {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-center h-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Card>
    );
  }
  const last24Hours = recentLogs.filter(log => {
    const logDate = new Date(log.logged_at);
    const hoursSince = (Date.now() - logDate.getTime()) / (1000 * 60 * 60);
    return hoursSince <= 24;
  });

  const actionCounts = last24Hours.reduce((acc, log) => {
    acc[log.action_type] = (acc[log.action_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topActions = Object.entries(actionCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  return (
    <Card className="p-3 sm:p-4 col-span-2 md:col-span-1">
      <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
        <div className="bg-green-100 dark:bg-green-900/20 p-2 sm:p-2.5 rounded-lg shrink-0">
          <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-sm sm:text-base truncate">Recent Activity</h3>
          <p className="text-xs sm:text-sm text-muted-foreground">Last 24 hours</p>
        </div>
      </div>

      <div className="space-y-2.5 sm:space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs sm:text-sm text-muted-foreground">Total Actions</span>
          <Badge variant="secondary" className="text-xs sm:text-sm px-2 py-0.5">{last24Hours.length}</Badge>
        </div>

        {topActions.length > 0 && (
          <>
            <div className="border-t pt-2.5 sm:pt-3">
              <p className="text-[10px] sm:text-xs font-medium text-muted-foreground mb-1.5 sm:mb-2">Top Actions</p>
              {topActions.map(([action, count]) => (
                <div key={action} className="flex items-center justify-between py-1 sm:py-1.5">
                  <span className="text-xs sm:text-sm capitalize truncate pr-2">{action.replace(/_/g, ' ')}</span>
                  <Badge variant="outline" className="text-[10px] sm:text-xs shrink-0 px-1.5 py-0.5">
                    {count}
                  </Badge>
                </div>
              ))}
            </div>
          </>
        )}

        {recentLogs.length > 0 && (
          <div className="border-t pt-2.5 sm:pt-3">
            <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
              <TrendingUp className="h-3 w-3 text-green-600 shrink-0" />
              <span className="text-muted-foreground truncate">
                Last action {formatDistanceToNow(new Date(recentLogs[0].logged_at), { addSuffix: true })}
              </span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
