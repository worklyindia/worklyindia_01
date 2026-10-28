import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDateWithSeconds } from "@/utils/dateFormatUtils";
import { 
  Activity, 
  CheckCircle, 
  XCircle, 
  Clock, 
  RefreshCw,
  TrendingUp,
  Server,
  AlertTriangle
} from "lucide-react";
import { usePageVisibility } from "@/hooks/usePageVisibility";
import { shouldEnableRealtime } from "@/hooks/useEgressProtection";

interface HealthCheck {
  id: string;
  endpoint: string;
  is_healthy: boolean | null;
  status_code: number | null;
  response_time_ms: number | null;
  error_message: string | null;
  checked_at: string;
}

export const APIHealthMonitor = () => {
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [uptime, setUptime] = useState<number | null>(null);
  const { isVisible } = usePageVisibility();

  useEffect(() => {
    fetchHealthData();
    
    if (!isVisible || !shouldEnableRealtime()) return;

    // Subscribe to real-time updates only when enabled
    const channel = supabase
      .channel('api_health_checks_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'api_health_checks'
        },
        (payload) => {
          console.log('Health check update:', payload);
          fetchHealthData(); // Refresh data
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isVisible]);

  const fetchHealthData = async () => {
    try {
      // Fetch recent health checks
      const { data: checks, error: checksError } = await supabase
        .from('api_health_checks')
        .select('*')
        .order('checked_at', { ascending: false })
        .limit(20);

      if (checksError) throw checksError;

      // Get unique endpoints with latest status
      const latestChecks = checks?.reduce((acc: HealthCheck[], check) => {
        const exists = acc.find(c => c.endpoint === check.endpoint);
        if (!exists) {
          acc.push(check as HealthCheck);
        }
        return acc;
      }, []);

      setHealthChecks(latestChecks || []);

      // Calculate uptime
      const { data: uptimeData, error: uptimeError } = await supabase
        .rpc('calculate_uptime', { hours: 24 });

      if (!uptimeError && uptimeData !== null) {
        setUptime(uptimeData);
      }

    } catch (error: any) {
      console.error('Error fetching health data:', error);
      toast.error('Failed to fetch health data');
    } finally {
      setLoading(false);
    }
  };

  const runHealthCheckNow = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('check-api-health', {
        body: { trigger: 'manual' }
      });

      if (error) throw error;
      
      // Wait a moment for the database to update, then refresh
      setTimeout(() => {
        fetchHealthData();
      }, 1000);
      
    } catch (error: any) {
      console.error('Error running health check:', error);
      toast.error('Failed to run health check');
      setLoading(false);
    }
  };

  const getStatusBadge = (isHealthy: boolean | null) => {
    if (isHealthy === null) return <Badge variant="secondary">Unknown</Badge>;
    return isHealthy ? (
      <Badge className="bg-green-500 hover:bg-green-600">
        <CheckCircle className="w-3 h-3 mr-1" />
        Healthy
      </Badge>
    ) : (
      <Badge variant="destructive">
        <XCircle className="w-3 h-3 mr-1" />
        Down
      </Badge>
    );
  };

  const getResponseTimeColor = (ms: number | null) => {
    if (!ms) return "text-muted-foreground";
    if (ms < 100) return "text-green-600";
    if (ms < 300) return "text-yellow-600";
    return "text-red-600";
  };

  const healthyCount = healthChecks.filter(c => c.is_healthy).length;
  const totalCount = healthChecks.length;
  const avgResponseTime = healthChecks.reduce((acc, c) => acc + (c.response_time_ms || 0), 0) / (healthChecks.filter(c => c.response_time_ms).length || 1);

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Activity className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">24h Uptime</p>
                <p className="text-2xl font-bold">
                  {uptime !== null ? `${uptime.toFixed(2)}%` : '...'} 
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Server className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Endpoints</p>
                <p className="text-2xl font-bold">
                  {healthyCount}/{totalCount}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Clock className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Response</p>
                <p className="text-2xl font-bold">
                  {avgResponseTime.toFixed(0)}ms
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${
                totalCount === 0 
                  ? 'bg-gray-500/10' 
                  : healthyCount === totalCount 
                    ? 'bg-green-500/10' 
                    : 'bg-orange-500/10'
              }`}>
                <TrendingUp className={`w-5 h-5 ${
                  totalCount === 0 
                    ? 'text-gray-600' 
                    : healthyCount === totalCount 
                      ? 'text-green-600' 
                      : 'text-orange-600'
                }`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <p className="text-2xl font-bold">
                  {totalCount === 0 
                    ? 'No Data' 
                    : healthyCount === totalCount 
                      ? 'All OK' 
                      : 'Issues'
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Endpoint Status</h3>
        <Button 
          variant="default" 
          size="sm" 
          onClick={runHealthCheckNow}
          disabled={loading}
        >
          <Activity className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Run Check Now
        </Button>
      </div>

      {/* Health Checks List */}
      <div className="space-y-3">
        {loading && healthChecks.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-muted-foreground" />
              <p className="text-muted-foreground">Loading health data...</p>
            </CardContent>
          </Card>
        ) : healthChecks.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-muted-foreground">No health check data available</p>
            </CardContent>
          </Card>
        ) : (
          healthChecks.map((check) => (
            <Card key={check.id}>
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <code className="text-sm font-mono bg-muted px-2 py-1 rounded break-all">
                        {check.endpoint}
                      </code>
                      {getStatusBadge(check.is_healthy)}
                    </div>
                    
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      {check.status_code && (
                        <div className="flex items-center gap-1">
                          <span className="font-medium">Status:</span>
                          <Badge variant="outline" className="text-xs">
                            {check.status_code}
                          </Badge>
                        </div>
                      )}
                      
                      {check.response_time_ms && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span className={getResponseTimeColor(check.response_time_ms)}>
                            {check.response_time_ms}ms
                          </span>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-1">
                        <span className="font-medium">Last check:</span>
                        <span>
                          {formatDateWithSeconds(check.checked_at)}
                        </span>
                      </div>
                    </div>

                    {check.error_message && (
                      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                        <strong>Error:</strong> {check.error_message}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Info Note */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <p className="text-sm text-blue-900">
            <strong>ℹ️ Note:</strong> Health checks run automatically every 5 minutes. 
            Uptime is calculated based on successful checks in the last 24 hours.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
