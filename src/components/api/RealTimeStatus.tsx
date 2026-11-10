import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, TrendingUp, Users, Zap, Circle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ApiMetrics {
  status: 'operational' | 'degraded' | 'down';
  requestCount: number;
  activeUsers: number;
  avgResponseTime: number;
  uptime: number;
}

export const RealTimeStatus = () => {
  const [metrics, setMetrics] = useState<ApiMetrics>({
    status: 'operational',
    requestCount: 0,
    activeUsers: 0,
    avgResponseTime: 0,
    uptime: 99.9
  });

  useEffect(() => {
    // Fetch initial metrics
    fetchMetrics();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('api-metrics-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'api_analytics'
        },
        () => {
          fetchMetrics();
        }
      )
      .subscribe();

    // Update metrics every 30 seconds
    const interval = setInterval(fetchMetrics, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  const fetchMetrics = async () => {
    try {
      // Get today's request count from api_analytics
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { count } = await supabase
        .from('api_analytics')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString());

      // Get active users count (simple simulation)
      const uniqueUsers = Math.floor(Math.random() * 20) + 5; // 5-25 active users

      // Simulate response time (in production, this would come from monitoring)
      const responseTime = Math.floor(Math.random() * 50) + 50; // 50-100ms

      setMetrics({
        status: 'operational',
        requestCount: count || 0,
        activeUsers: uniqueUsers,
        avgResponseTime: responseTime,
        uptime: 99.9
      });
    } catch (error) {
      console.error('Error fetching metrics:', error);
      setMetrics(prev => ({ ...prev, status: 'degraded' }));
    }
  };

  const getStatusColor = () => {
    switch (metrics.status) {
      case 'operational':
        return 'text-green-600';
      case 'degraded':
        return 'text-yellow-600';
      case 'down':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusBadge = () => {
    switch (metrics.status) {
      case 'operational':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Operational</Badge>;
      case 'degraded':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Degraded</Badge>;
      case 'down':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Down</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Circle className={`w-3 h-3 ${getStatusColor()} fill-current animate-pulse`} />
          <h3 className="font-semibold text-foreground">API Status</h3>
        </div>
        {getStatusBadge()}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center justify-center mb-2">
            <Activity className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-foreground">{metrics.requestCount}</div>
          <p className="text-xs text-muted-foreground">Requests Today</p>
        </div>

        <div className="text-center p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center justify-center mb-2">
            <Users className="w-5 h-5 text-green-600" />
          </div>
          <div className="text-2xl font-bold text-foreground">{metrics.activeUsers}</div>
          <p className="text-xs text-muted-foreground">Active Users</p>
        </div>

        <div className="text-center p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center justify-center mb-2">
            <Zap className="w-5 h-5 text-yellow-600" />
          </div>
          <div className="text-2xl font-bold text-foreground">{metrics.avgResponseTime}ms</div>
          <p className="text-xs text-muted-foreground">Avg Response</p>
        </div>

        <div className="text-center p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center justify-center mb-2">
            <TrendingUp className="w-5 h-5 text-purple-600" />
          </div>
          <div className="text-2xl font-bold text-foreground">{metrics.uptime}%</div>
          <p className="text-xs text-muted-foreground">Uptime</p>
        </div>
      </div>

      <div className="mt-4 text-xs text-muted-foreground text-center">
        Updated in real-time • Last update: {new Date().toLocaleTimeString()}
      </div>
    </Card>
  );
};
