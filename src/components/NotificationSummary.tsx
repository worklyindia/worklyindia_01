import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, Briefcase, Users, AlertCircle, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";

interface NotificationStats {
  total: number;
  unread: number;
  jobApplications: number;
  statusUpdates: number;
  interviews: number;
}

export const NotificationSummary = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<NotificationStats>({
    total: 0,
    unread: 0,
    jobApplications: 0,
    statusUpdates: 0,
    interviews: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotificationStats();
  }, []);

  const fetchNotificationStats = async () => {
    try {
      setLoading(true);
      
      // Get total notification stats
      const { data: totalData, error: totalError } = await supabase
        .from('notifications')
        .select('id, is_read, type, metadata');

      if (totalError) throw totalError;

      const notifications = totalData || [];
      
      const stats: NotificationStats = {
        total: notifications.length,
        unread: notifications.filter(n => !n.is_read).length,
        jobApplications: notifications.filter(n => 
          n.type === 'application' && 
          n.metadata && typeof n.metadata === 'object' &&
          'application_id' in n.metadata
        ).length,
        statusUpdates: notifications.filter(n => 
          n.type === 'application' && 
          n.metadata && typeof n.metadata === 'object' &&
          'new_status' in n.metadata
        ).length,
        interviews: notifications.filter(n => 
          n.type === 'application' && 
          n.metadata && typeof n.metadata === 'object' &&
          'new_status' in n.metadata &&
          typeof n.metadata.new_status === 'string' &&
          n.metadata.new_status.includes('interview')
        ).length
      };

      setStats(stats);
    } catch (error) {
      console.error('Error fetching notification stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-primary/20">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/3"></div>
            <div className="grid grid-cols-3 gap-4">
              <div className="h-8 bg-muted rounded"></div>
              <div className="h-8 bg-muted rounded"></div>
              <div className="h-8 bg-muted rounded"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-secondary/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center space-x-2 text-lg">
          <Bell className="w-5 h-5 text-primary" />
          <span>Notification System Status</span>
          {stats.total > 0 && (
            <Badge variant="default" className="bg-green-500">
              Active ({stats.total} alerts)
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <Bell className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-sm text-muted-foreground">Total Alerts</p>
            <p className="text-xl font-bold text-foreground">{stats.total}</p>
          </div>
          
          <div className="text-center">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <AlertCircle className="w-5 h-5 text-orange-600" />
            </div>
            <p className="text-sm text-muted-foreground">Unread</p>
            <p className="text-xl font-bold text-orange-600">{stats.unread}</p>
          </div>
          
          <div className="text-center">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-sm text-muted-foreground">Job Applications</p>
            <p className="text-xl font-bold text-green-600">{stats.jobApplications}</p>
          </div>
          
          <div className="text-center">
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-sm text-muted-foreground">Status Updates</p>
            <p className="text-xl font-bold text-purple-600">{stats.statusUpdates}</p>
          </div>
        </div>
        
        {stats.total > 0 ? (
          <div className="bg-primary/10 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-foreground">Ready to receive alerts!</h4>
                <p className="text-sm text-muted-foreground">
                  You have {stats.unread} unread notifications including job applications and status updates.
                </p>
              </div>
              <Button 
                onClick={() => navigate('/notifications')}
                className="shrink-0"
              >
                View All
              </Button>
            </div>
          </div>
        ) : (
          <div className="bg-muted/50 p-4 rounded-lg text-center">
            <Bell className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No notifications yet. You'll receive alerts for job applications, interviews, and status updates.
            </p>
          </div>
        )}
        
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="text-xs">
            Job Applications
          </Badge>
          <Badge variant="outline" className="text-xs">
            Interview Schedules
          </Badge>
          <Badge variant="outline" className="text-xs">
            Status Updates
          </Badge>
          <Badge variant="outline" className="text-xs">
            Real-time Alerts
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
};