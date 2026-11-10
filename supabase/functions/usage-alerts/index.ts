import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Free plan limits
const FREE_PLAN_LIMITS = {
  database_mb: 500,
  storage_mb: 1024,
  edge_function_invocations: 500000,
  realtime_connections: 200,
  monthly_active_users: 50000,
  egress_gb: 5, // 5GB for free plan
};

interface Alert {
  metric: string;
  current_value: number;
  limit_value: number;
  usage_percent: number;
  severity: 'info' | 'warning' | 'critical';
  message: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔔 Checking usage alerts...');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch alert thresholds
    const { data: alertConfigs } = await supabaseClient
      .from('supabase_usage_alerts')
      .select('*')
      .eq('is_enabled', true);

    const thresholds: Record<string, number> = {};
    alertConfigs?.forEach(config => {
      thresholds[config.metric_name] = config.threshold_percent;
    });

    // Get current usage stats
    const tablesToCheck = [
      'live_sessions', 'service_health_checks', 'whatsapp_webhook_logs',
      'search_history', 'function_logs', 'api_request_logs',
      'job_interactions', 'whatsapp_messages', 'telegram_messages',
      'admin_audit_logs', 'jobs', 'profiles', 'companies'
    ];

    let totalDbSize = 0;
    const tableStats: { name: string; rows: number; size: number }[] = [];

    for (const tableName of tablesToCheck) {
      try {
        const { count } = await supabaseClient
          .from(tableName)
          .select('*', { count: 'exact', head: true });

        if (count !== null) {
          const estimatedSize = count * 1024; // 1KB per row estimate
          totalDbSize += estimatedSize;
          tableStats.push({ name: tableName, rows: count, size: estimatedSize });
        }
      } catch (e) {
        // Table might not exist or no access
      }
    }

    // Get function logs for month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const { count: functionLogsMonth } = await supabaseClient
      .from('function_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startOfMonth.toISOString());

    // Get active sessions
    const { count: activeSessions } = await supabaseClient
      .from('live_sessions')
      .select('*', { count: 'exact', head: true })
      .gte('last_seen', new Date(Date.now() - 15 * 60 * 1000).toISOString());

    // Get MAU
    const { count: mauCount } = await supabaseClient
      .from('daily_unique_visitors')
      .select('*', { count: 'exact', head: true })
      .gte('visit_date', startOfMonth.toISOString().split('T')[0]);

    // Calculate usage percentages
    const dbSizeMb = totalDbSize / (1024 * 1024);
    const dbPercent = (dbSizeMb / FREE_PLAN_LIMITS.database_mb) * 100;
    const edgePercent = ((functionLogsMonth || 0) / FREE_PLAN_LIMITS.edge_function_invocations) * 100;
    const realtimePercent = ((activeSessions || 0) / FREE_PLAN_LIMITS.realtime_connections) * 100;
    const mauPercent = ((mauCount || 0) / FREE_PLAN_LIMITS.monthly_active_users) * 100;

    // Generate alerts
    const alerts: Alert[] = [];

    const getSeverity = (percent: number): 'info' | 'warning' | 'critical' => {
      if (percent >= 90) return 'critical';
      if (percent >= 70) return 'warning';
      return 'info';
    };

    // Database alert
    if (dbPercent >= (thresholds['database'] || 80)) {
      alerts.push({
        metric: 'database',
        current_value: Math.round(dbSizeMb * 100) / 100,
        limit_value: FREE_PLAN_LIMITS.database_mb,
        usage_percent: Math.round(dbPercent),
        severity: getSeverity(dbPercent),
        message: `Database ${Math.round(dbPercent)}% used (${Math.round(dbSizeMb)}MB / ${FREE_PLAN_LIMITS.database_mb}MB)`
      });
    }

    // Edge functions alert
    if (edgePercent >= (thresholds['edge_functions'] || 80)) {
      alerts.push({
        metric: 'edge_functions',
        current_value: functionLogsMonth || 0,
        limit_value: FREE_PLAN_LIMITS.edge_function_invocations,
        usage_percent: Math.round(edgePercent),
        severity: getSeverity(edgePercent),
        message: `Edge Functions ${Math.round(edgePercent)}% used (${functionLogsMonth || 0} / ${FREE_PLAN_LIMITS.edge_function_invocations})`
      });
    }

    // Realtime connections alert
    if (realtimePercent >= (thresholds['realtime'] || 80)) {
      alerts.push({
        metric: 'realtime',
        current_value: activeSessions || 0,
        limit_value: FREE_PLAN_LIMITS.realtime_connections,
        usage_percent: Math.round(realtimePercent),
        severity: getSeverity(realtimePercent),
        message: `Realtime Connections ${Math.round(realtimePercent)}% used (${activeSessions || 0} / ${FREE_PLAN_LIMITS.realtime_connections})`
      });
    }

    // MAU alert
    if (mauPercent >= (thresholds['mau'] || 80)) {
      alerts.push({
        metric: 'mau',
        current_value: mauCount || 0,
        limit_value: FREE_PLAN_LIMITS.monthly_active_users,
        usage_percent: Math.round(mauPercent),
        severity: getSeverity(mauPercent),
        message: `MAU ${Math.round(mauPercent)}% used (${mauCount || 0} / ${FREE_PLAN_LIMITS.monthly_active_users})`
      });
    }

    // Find tables that need cleanup
    const cleanupSuggestions = tableStats
      .filter(t => t.rows > 100)
      .sort((a, b) => b.size - a.size)
      .slice(0, 5)
      .map(t => ({
        table: t.name,
        rows: t.rows,
        size_mb: Math.round(t.size / (1024 * 1024) * 100) / 100,
        suggestion: `${t.name} में ${t.rows} rows हैं - cleanup recommended`
      }));

    // Store today's usage
    const today = new Date().toISOString().split('T')[0];
    await supabaseClient
      .from('supabase_usage_stats')
      .upsert({
        date: today,
        database_size_bytes: totalDbSize,
        edge_function_invocations: functionLogsMonth || 0,
        active_sessions: activeSessions || 0,
        monthly_active_users: mauCount || 0
      }, { onConflict: 'date' });

    console.log(`✅ Found ${alerts.length} alerts, ${cleanupSuggestions.length} cleanup suggestions`);

    return new Response(JSON.stringify({
      success: true,
      timestamp: new Date().toISOString(),
      alerts,
      cleanup_suggestions: cleanupSuggestions,
      current_usage: {
        database_mb: Math.round(dbSizeMb * 100) / 100,
        database_percent: Math.round(dbPercent),
        edge_functions_month: functionLogsMonth || 0,
        edge_functions_percent: Math.round(edgePercent),
        active_sessions: activeSessions || 0,
        realtime_percent: Math.round(realtimePercent),
        mau: mauCount || 0,
        mau_percent: Math.round(mauPercent)
      },
      free_plan_limits: FREE_PLAN_LIMITS
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('❌ Error checking alerts:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
