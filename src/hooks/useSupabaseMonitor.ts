import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface UsageMetric {
  type: string;
  current: number;
  limit: number;
  percentage: number;
  status: "safe" | "warning" | "critical" | "emergency";
  formatted: string;
}

export interface TableStats {
  tableName: string;
  rowCount: number;
  sizeBytes: number;
  sizeFormatted: string;
}

export interface MonitorData {
  success: boolean;
  timestamp: string;
  healthScore: number;
  metrics: UsageMetric[];
  summary: {
    totalDatabaseSize: string;
    totalDatabaseSizeBytes: number;
    databasePercentage: number;
    cachedEgressPercentage: number;
    edgeInvocationsUsed: number;
    mauUsed: number;
    criticalMetrics: number;
    warningMetrics: number;
  };
  topTables: TableStats[];
  history: any[];
  recentOptimizations: any[];
  cleanupSettings: any[];
  alertConfigs: any[];
  limits: Record<string, number>;
}

export interface UsageAlert {
  metric: string;
  current_value: number;
  limit_value: number;
  usage_percent: number;
  severity: 'info' | 'warning' | 'critical';
  message: string;
}

export interface UsageAlertsData {
  success: boolean;
  timestamp: string;
  alerts: UsageAlert[];
  cleanup_suggestions: Array<{
    table: string;
    rows: number;
    size_mb: number;
    suggestion: string;
  }>;
  current_usage: {
    database_mb: number;
    database_percent: number;
    edge_functions_month: number;
    edge_functions_percent: number;
    active_sessions: number;
    realtime_percent: number;
    mau: number;
    mau_percent: number;
  };
  free_plan_limits: Record<string, number>;
}

const getDefaultMonitorData = (): MonitorData => ({
  success: false,
  timestamp: new Date().toISOString(),
  healthScore: 0,
  metrics: [],
  summary: {
    totalDatabaseSize: "0 MB",
    totalDatabaseSizeBytes: 0,
    databasePercentage: 0,
    cachedEgressPercentage: 0,
    edgeInvocationsUsed: 0,
    mauUsed: 0,
    criticalMetrics: 0,
    warningMetrics: 0,
  },
  topTables: [],
  history: [],
  recentOptimizations: [],
  cleanupSettings: [],
  alertConfigs: [],
  limits: {},
});

// Main monitor hook - OPTIMIZED: reduced frequency
export const useSupabaseMonitor = () => {
  const query = useQuery({
    queryKey: ["supabase-monitor"],
    queryFn: async (): Promise<MonitorData> => {
      try {
        const { data, error } = await supabase.functions.invoke("supabase-monitor");
        if (error) throw new Error(error.message || "Edge function error");
        if (!data || !data.success) return getDefaultMonitorData();
        return data;
      } catch (e: any) {
        console.error("[useSupabaseMonitor] Failed:", e);
        throw e;
      }
    },
    refetchInterval: 600000, // 10 minutes (was 2 min)
    retry: 1, // was 3
    staleTime: 300000, // 5 min (was 1 min)
    refetchOnWindowFocus: false,
  });

  return {
    ...query,
    data: query.data || getDefaultMonitorData(),
    isEdgeFunctionError: query.isError,
    errorMessage: query.error?.message || null,
  };
};

// Usage Alerts Hook - OPTIMIZED
export const useUsageAlerts = () => {
  return useQuery({
    queryKey: ["usage-alerts"],
    queryFn: async (): Promise<UsageAlertsData> => {
      const { data, error } = await supabase.functions.invoke("usage-alerts");
      if (error) throw error;
      return data;
    },
    refetchInterval: 900000, // 15 min (was 5 min)
    staleTime: 600000, // 10 min (was 2 min)
    refetchOnWindowFocus: false,
  });
};

// Direct Table Stats - OPTIMIZED: fewer tables, longer cache
export const useTableStats = () => {
  return useQuery({
    queryKey: ["table-stats-direct"],
    queryFn: async () => {
      // Only check critical tables, not all 10
      const tables = ['profiles', 'jobs', 'companies', 'job_applications'];
      
      const stats: Array<{ name: string; count: number; estimatedSizeMB: number }> = [];
      
      for (const table of tables) {
        try {
          const { count } = await supabase
            .from(table as any)
            .select('*', { count: 'exact', head: true });
          
          if (count !== null) {
            stats.push({
              name: table,
              count,
              estimatedSizeMB: Math.round((count * 1024) / (1024 * 1024) * 100) / 100
            });
          }
        } catch (e) {
          // Table might not exist
        }
      }
      
      return stats.sort((a, b) => b.count - a.count);
    },
    staleTime: 600000, // 10 min (was 1 min)
    refetchOnWindowFocus: false,
  });
};

/**
 * DISABLED: Real-time Activity Monitor
 * Was polling every 30 seconds with 3 heavy queries - major IO drain
 * Use useTableStats instead for basic monitoring
 */
export const useRealtimeActivity = () => {
  return useQuery({
    queryKey: ["realtime-activity"],
    queryFn: async () => {
      return {
        recentLogins: 0,
        recentApplications: 0,
        activeSessions: 0,
        timestamp: new Date().toISOString()
      };
    },
    staleTime: Infinity, // Never refetch automatically
    enabled: false, // Disabled to save IO
  });
};

// Database Health Check - OPTIMIZED
export const useDatabaseHealth = () => {
  return useQuery({
    queryKey: ["database-health"],
    queryFn: async () => {
      const checks: Array<{ name: string; status: 'ok' | 'warning' | 'error'; message: string }> = [];
      
      // Only check cleanup status - skip API health and function logs checks
      try {
        const { data } = await supabase.from('cleanup_execution_logs')
          .select('executed_at')
          .order('executed_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        const lastCleanup = data ? new Date(data.executed_at) : null;
        const hoursAgo = lastCleanup ? (Date.now() - lastCleanup.getTime()) / (1000 * 60 * 60) : 999;
        
        checks.push({
          name: 'Auto Cleanup',
          status: hoursAgo < 24 ? 'ok' : hoursAgo < 72 ? 'warning' : 'error',
          message: lastCleanup ? `Last: ${Math.round(hoursAgo)}h ago` : 'Never run'
        });
      } catch (e) {
        checks.push({ name: 'Auto Cleanup', status: 'warning', message: 'No cleanup history' });
      }
      
      const okCount = checks.filter(c => c.status === 'ok').length;
      const healthScore = Math.round((okCount / checks.length) * 100);
      
      return { checks, healthScore, timestamp: new Date().toISOString() };
    },
    staleTime: 600000, // 10 min (was 2 min)
    refetchOnWindowFocus: false,
  });
};

// Auto Cleanup Hook
export const useAutoCleanup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { forceCleanup?: boolean; cleanupLevel?: string }) => {
      const { data, error } = await supabase.functions.invoke("auto-egress-manager", {
        body: params,
      });
      if (error) throw new Error(error.message || "Cleanup failed");
      return data;
    },
    onSuccess: (data) => {
      const deleted = data?.totalDeleted || 0;
      const saved = data?.egressSavedFormatted || "0 bytes";
      toast.success(`Cleanup complete! Deleted ${deleted} rows, saved ${saved}`);
      queryClient.invalidateQueries({ queryKey: ["supabase-monitor"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Cleanup failed");
    },
  });
};

export const useCleanupSettings = () => {
  return useQuery({
    queryKey: ["cleanup-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auto_cleanup_settings")
        .select("*")
        .order("setting_key");
      if (error) throw error;
      return data;
    },
    staleTime: 600000,
    refetchOnWindowFocus: false,
  });
};

export const useOptimizationLogs = () => {
  return useQuery({
    queryKey: ["optimization-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("egress_optimization_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10); // was 20
      if (error) throw error;
      return data;
    },
    staleTime: 600000,
    refetchOnWindowFocus: false,
  });
};

// Usage Stats History
export const useUsageHistory = (days: number = 7) => {
  return useQuery({
    queryKey: ["usage-history", days],
    queryFn: async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const { data, error } = await supabase
        .from("supabase_usage_stats")
        .select("*")
        .gte("date", startDate.toISOString().split('T')[0])
        .order("date", { ascending: true });
      
      if (error) throw error;
      return data;
    },
    staleTime: 900000, // 15 min (was 5 min)
    refetchOnWindowFocus: false,
  });
};

// Alert Configurations
export const useAlertConfigs = () => {
  return useQuery({
    queryKey: ["alert-configs"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("usage-alerts");
      if (error) throw error;
      return data?.alerts || [];
    },
    staleTime: 900000,
    refetchOnWindowFocus: false,
  });
};
