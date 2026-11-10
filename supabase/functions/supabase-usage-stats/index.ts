import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TableStats {
  table_name: string;
  row_count: number;
  size_bytes: number;
}

interface UsageStats {
  database: {
    total_size_bytes: number;
    total_size_mb: number;
    limit_mb: number;
    usage_percent: number;
    tables: TableStats[];
  };
  storage: {
    total_size_bytes: number;
    total_size_mb: number;
    limit_mb: number;
    usage_percent: number;
  };
  edge_functions: {
    invocations_today: number;
    invocations_month: number;
    limit_month: number;
    usage_percent: number;
  };
  realtime: {
    messages_today: number;
    concurrent_connections: number;
    limit_connections: number;
    usage_percent: number;
  };
  users: {
    monthly_active_users: number;
    limit_mau: number;
    usage_percent: number;
  };
  sessions: {
    active_count: number;
  };
}

// Free plan limits
const FREE_PLAN_LIMITS = {
  database_mb: 500,
  storage_mb: 1024, // 1GB
  edge_function_invocations: 500000,
  realtime_messages: 2000000,
  realtime_connections: 200,
  monthly_active_users: 50000,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('📊 Fetching Supabase usage statistics...');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get table sizes and row counts
    const { data: tableStats, error: tableError } = await supabaseClient
      .rpc('get_table_sizes');

    let tables: TableStats[] = [];
    let totalDbSize = 0;

    if (!tableError && tableStats) {
      tables = tableStats;
      totalDbSize = tables.reduce((sum, t) => sum + (t.size_bytes || 0), 0);
    } else {
      // Fallback: estimate from row counts
      console.log('📊 Using fallback method for table sizes...');
      
      const tablesToCheck = [
        'live_sessions', 'service_health_checks', 'whatsapp_webhook_logs',
        'search_history', 'interview_cleanup_logs', 'api_health_checks',
        'function_logs', 'api_request_logs', 'daily_unique_visitors',
        'ai_response_cache', 'cached_audio', 'job_interactions',
        'whatsapp_messages', 'telegram_messages', 'otp_codes',
        'admin_audit_logs', 'cleanup_logs', 'jobs', 'profiles',
        'companies', 'job_applications', 'notifications'
      ];

      for (const tableName of tablesToCheck) {
        try {
          const { count, error } = await supabaseClient
            .from(tableName)
            .select('*', { count: 'exact', head: true });

          if (!error && count !== null) {
            // Estimate 1KB per row as rough approximation
            const estimatedSize = count * 1024;
            tables.push({
              table_name: tableName,
              row_count: count,
              size_bytes: estimatedSize
            });
            totalDbSize += estimatedSize;
          }
        } catch (e) {
          console.log(`Could not get count for ${tableName}`);
        }
      }
    }

    // Sort tables by size descending
    tables.sort((a, b) => b.size_bytes - a.size_bytes);

    // Get storage size from storage.objects
    let storageSize = 0;
    try {
      const { data: storageData, error: storageError } = await supabaseClient
        .from('storage.objects')
        .select('metadata');
      
      if (!storageError && storageData) {
        storageSize = storageData.reduce((sum, obj) => {
          const size = obj.metadata?.size || 0;
          return sum + size;
        }, 0);
      }
    } catch (e) {
      console.log('Could not fetch storage size');
    }

    // Get function logs count for today
    const today = new Date().toISOString().split('T')[0];
    const { count: functionLogsToday } = await supabaseClient
      .from('function_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${today}T00:00:00`);

    // Get function logs count for month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const { count: functionLogsMonth } = await supabaseClient
      .from('function_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startOfMonth.toISOString());

    // Get active sessions count
    const { count: activeSessions } = await supabaseClient
      .from('live_sessions')
      .select('*', { count: 'exact', head: true })
      .gte('last_seen', new Date(Date.now() - 15 * 60 * 1000).toISOString());

    // Get monthly active users (unique users who logged in this month)
    const { count: mauCount } = await supabaseClient
      .from('daily_unique_visitors')
      .select('*', { count: 'exact', head: true })
      .gte('visit_date', startOfMonth.toISOString().split('T')[0]);

    // Calculate usage percentages
    const dbSizeMb = totalDbSize / (1024 * 1024);
    const storageSizeMb = storageSize / (1024 * 1024);
    const functionInvocationsMonth = functionLogsMonth || 0;
    const activeSessionsCount = activeSessions || 0;
    const mau = mauCount || 0;

    const usageStats: UsageStats = {
      database: {
        total_size_bytes: totalDbSize,
        total_size_mb: Math.round(dbSizeMb * 100) / 100,
        limit_mb: FREE_PLAN_LIMITS.database_mb,
        usage_percent: Math.round((dbSizeMb / FREE_PLAN_LIMITS.database_mb) * 100),
        tables: tables.slice(0, 20) // Top 20 tables
      },
      storage: {
        total_size_bytes: storageSize,
        total_size_mb: Math.round(storageSizeMb * 100) / 100,
        limit_mb: FREE_PLAN_LIMITS.storage_mb,
        usage_percent: Math.round((storageSizeMb / FREE_PLAN_LIMITS.storage_mb) * 100)
      },
      edge_functions: {
        invocations_today: functionLogsToday || 0,
        invocations_month: functionInvocationsMonth,
        limit_month: FREE_PLAN_LIMITS.edge_function_invocations,
        usage_percent: Math.round((functionInvocationsMonth / FREE_PLAN_LIMITS.edge_function_invocations) * 100)
      },
      realtime: {
        messages_today: 0, // Would need realtime logs
        concurrent_connections: activeSessionsCount,
        limit_connections: FREE_PLAN_LIMITS.realtime_connections,
        usage_percent: Math.round((activeSessionsCount / FREE_PLAN_LIMITS.realtime_connections) * 100)
      },
      users: {
        monthly_active_users: mau,
        limit_mau: FREE_PLAN_LIMITS.monthly_active_users,
        usage_percent: Math.round((mau / FREE_PLAN_LIMITS.monthly_active_users) * 100)
      },
      sessions: {
        active_count: activeSessionsCount
      }
    };

    // Store today's stats
    const { error: insertError } = await supabaseClient
      .from('supabase_usage_stats')
      .upsert({
        date: today,
        database_size_bytes: totalDbSize,
        storage_size_bytes: storageSize,
        edge_function_invocations: functionInvocationsMonth,
        active_sessions: activeSessionsCount,
        monthly_active_users: mau
      }, { onConflict: 'date' });

    if (insertError) {
      console.error('Error storing usage stats:', insertError);
    }

    console.log('✅ Usage stats fetched successfully');

    return new Response(JSON.stringify({
      success: true,
      timestamp: new Date().toISOString(),
      stats: usageStats,
      free_plan_limits: FREE_PLAN_LIMITS
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('❌ Error fetching usage stats:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
