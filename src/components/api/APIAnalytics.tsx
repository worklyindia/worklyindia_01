import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { 
  Activity, 
  TrendingUp, 
  Clock, 
  CheckCircle, 
  XCircle,
  BarChart3,
  Zap
} from "lucide-react";
import { format } from "date-fns";
import { shouldEnableRealtime } from "@/hooks/useEgressProtection";

interface RequestLog {
  id: string;
  endpoint: string;
  method: string;
  status_code: number;
  response_time_ms: number;
  created_at: string;
  error_message?: string;
}

interface Stats {
  total_requests: number;
  success_rate: number;
  avg_response_time: number;
  error_count: number;
}

export const APIAnalytics = () => {
  const [recentLogs, setRecentLogs] = useState<RequestLog[]>([]);
  const [stats, setStats] = useState<Stats>({
    total_requests: 0,
    success_rate: 0,
    avg_response_time: 0,
    error_count: 0
  });
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's API keys
      const { data: apiKeys } = await supabase
        .from('api_keys')
        .select('id')
        .eq('user_id', user.id);

      if (!apiKeys || apiKeys.length === 0) {
        setLoading(false);
        return;
      }

      const apiKeyIds = apiKeys.map(k => k.id);

      // Fetch recent logs
      const { data: logs } = await supabase
        .from('api_request_logs')
        .select('*')
        .in('api_key_id', apiKeyIds)
        .order('created_at', { ascending: false })
        .limit(50);

      setRecentLogs(logs || []);

      // Calculate stats
      if (logs && logs.length > 0) {
        const successCount = logs.filter(l => l.status_code >= 200 && l.status_code < 300).length;
        const errorCount = logs.filter(l => l.status_code >= 400).length;
        const avgTime = logs.reduce((acc, l) => acc + l.response_time_ms, 0) / logs.length;

        setStats({
          total_requests: logs.length,
          success_rate: (successCount / logs.length) * 100,
          avg_response_time: Math.round(avgTime),
          error_count: errorCount
        });
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();

    // Subscribe to real-time updates
    const setupSubscription = async () => {
      if (!shouldEnableRealtime()) return;

      const { data: userData } = await supabase.auth.getUser();
      
      if (!userData?.user) return;

      const channel = supabase
        .channel('api_request_logs_changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'api_request_logs'
          },
          (payload) => {
            console.log('New API request logged:', payload);
            fetchAnalytics(); // Refresh data
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };
    
    setupSubscription();
  }, []);

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'text-green-600';
    if (status >= 400 && status < 500) return 'text-orange-600';
    if (status >= 500) return 'text-red-600';
    return 'text-muted-foreground';
  };

  const getStatusBadge = (status: number) => {
    if (status >= 200 && status < 300) return <Badge variant="default" className="bg-green-500">Success</Badge>;
    if (status >= 400 && status < 500) return <Badge variant="destructive">Client Error</Badge>;
    if (status >= 500) return <Badge variant="destructive">Server Error</Badge>;
    return <Badge variant="outline">Unknown</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Requests</p>
                <p className="text-2xl font-bold">{stats.total_requests}</p>
              </div>
              <Activity className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold">{stats.success_rate.toFixed(1)}%</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Response</p>
                <p className="text-2xl font-bold">{stats.avg_response_time}ms</p>
              </div>
              <Clock className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Errors</p>
                <p className="text-2xl font-bold">{stats.error_count}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Requests */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Recent API Requests
            <Badge variant="outline" className="ml-auto">
              <Zap className="w-3 h-3 mr-1" />
              Live
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No API requests yet</p>
              <p className="text-sm">Make your first API call to see analytics</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {recentLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">
                        {log.method}
                      </Badge>
                      <code className="text-sm font-mono truncate">
                        {log.endpoint}
                      </code>
                    </div>
                    {log.error_message && (
                      <p className="text-xs text-destructive truncate">
                        {log.error_message}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-3 ml-4">
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${getStatusColor(log.status_code)}`}>
                        {log.status_code}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {log.response_time_ms}ms
                      </p>
                    </div>
                    
                    <div className="text-right min-w-[120px]">
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(log.created_at), 'hh:mm:ss a')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(log.created_at), 'dd MMMM yyyy')}
                      </p>
                    </div>
                    
                    {log.status_code >= 200 && log.status_code < 300 ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
