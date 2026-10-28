import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Free tier limits
const FREE_TIER_LIMITS = {
  cached_egress: 2 * 1024 * 1024 * 1024, // 2GB
  egress: 2 * 1024 * 1024 * 1024, // 2GB
  database_size: 500 * 1024 * 1024, // 500MB
  storage_size: 1 * 1024 * 1024 * 1024, // 1GB
  edge_invocations: 500000, // 500K
  realtime_messages: 2000000, // 2M
  realtime_connections: 200, // 200 concurrent
  mau: 50000, // 50K MAU
  mau_third_party: 50, // 50 Third-party MAU
  mau_sso: 50, // 50 SSO MAU
  storage_transformations: 100, // 100 image transformations
};

// More accurate average row sizes based on typical data patterns
const TABLE_ROW_SIZES: Record<string, number> = {
  // Large tables with significant data
  "live_sessions": 400,
  "jobs": 3000,
  "profiles": 2000,
  "companies": 4000,
  "job_applications": 1500,
  "chat_messages": 600,
  "conversations": 500,
  "ai_response_cache": 3000,
  "cached_audio": 60000,
  "ai_generated_tricks": 6000,
  
  // Medium tables
  "admin_audit_logs": 1000,
  "admin_audit_logs_archive": 1000,
  "api_request_logs": 500,
  "function_logs": 700,
  "employer_notifications": 600,
  "jobseeker_notifications": 600,
  "daily_unique_visitors": 300,
  "job_view_logs": 250,
  "whatsapp_messages": 700,
  "telegram_messages": 700,
  "whatsapp_webhook_logs": 1200,
  
  // Small tables
  "otp_codes": 200,
  "service_health_checks": 350,
  "api_health_checks": 350,
  "search_history": 450,
  "cleanup_execution_logs": 600,
  "egress_optimization_logs": 600,
  "interview_cleanup_logs": 350,
  "notifications": 500,
  "ai_chat_usage": 250,
};

// Tables with indexes - multiply by factor for total relation size
const INDEX_OVERHEAD_FACTOR = 1.4; // ~40% overhead for indexes

interface TableStats {
  tableName: string;
  rowCount: number;
  sizeBytes: number;
  sizeFormatted: string;
}

interface UsageMetric {
  type: string;
  current: number;
  limit: number;
  percentage: number;
  status: "safe" | "warning" | "critical" | "emergency";
  formatted: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("📊 Starting Enhanced Supabase Monitor...");

    // Get table statistics with improved size calculation
    const tableStats = await getTableStatistics(supabase);
    
    // Calculate total database size (includes index overhead)
    const totalDatabaseSize = tableStats.reduce((sum, t) => sum + t.sizeBytes, 0);
    
    // Estimate egress based on recent activity
    const egressEstimates = await estimateEgress(supabase);
    
    // Get edge function invocations
    const edgeInvocations = await getEdgeFunctionInvocations(supabase);
    
    // Get MAU estimates
    const mauStats = await getMAUEstimates(supabase);
    
    // Build usage metrics
    const metrics: UsageMetric[] = [
      buildMetric("cached_egress", egressEstimates.cached, FREE_TIER_LIMITS.cached_egress),
      buildMetric("egress", egressEstimates.regular, FREE_TIER_LIMITS.egress),
      buildMetric("database_size", totalDatabaseSize, FREE_TIER_LIMITS.database_size),
      buildMetric("edge_invocations", edgeInvocations, FREE_TIER_LIMITS.edge_invocations),
      buildMetric("mau", mauStats.total, FREE_TIER_LIMITS.mau),
      buildMetric("storage_size", 0, FREE_TIER_LIMITS.storage_size),
      buildMetric("realtime_messages", 0, FREE_TIER_LIMITS.realtime_messages),
      buildMetric("realtime_connections", 0, FREE_TIER_LIMITS.realtime_connections),
    ];
    
    // Calculate overall health score
    const avgPercentage = metrics.reduce((sum, m) => sum + m.percentage, 0) / metrics.length;
    const criticalCount = metrics.filter(m => m.status === "critical" || m.status === "emergency").length;
    const healthScore = Math.max(0, 100 - avgPercentage - (criticalCount * 10));
    
    // Store metrics for historical tracking (safe)
    await storeMetrics(supabase, metrics);
    
    // Get historical data (safe)
    const history = await getHistoricalMetrics(supabase, 30);
    
    // Get recent optimization logs (safe)
    let recentOptimizations: any[] = [];
    try {
      const { data } = await supabase
        .from("egress_optimization_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      recentOptimizations = data || [];
    } catch (e) {
      console.log("egress_optimization_logs table may not exist");
    }
    
    // Get cleanup settings (safe)
    let cleanupSettings: any[] = [];
    try {
      const { data } = await supabase
        .from("auto_cleanup_settings")
        .select("*");
      cleanupSettings = data || [];
    } catch (e) {
      console.log("auto_cleanup_settings table may not exist");
    }
    
    // Get alert configurations (safe)
    let alertConfigs: any[] = [];
    try {
      const { data } = await supabase
        .from("usage_alert_config")
        .select("*");
      alertConfigs = data || [];
    } catch (e) {
      console.log("usage_alert_config table may not exist");
    }

    // Top tables by size - show all
    const topTables = tableStats
      .sort((a, b) => b.sizeBytes - a.sizeBytes);

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      healthScore: Math.round(healthScore),
      metrics,
      summary: {
        totalDatabaseSize: formatBytes(totalDatabaseSize),
        totalDatabaseSizeBytes: totalDatabaseSize,
        databasePercentage: Math.round((totalDatabaseSize / FREE_TIER_LIMITS.database_size) * 100),
        cachedEgressPercentage: Math.round(egressEstimates.cachedPercentage),
        edgeInvocationsUsed: edgeInvocations,
        mauUsed: mauStats.total,
        criticalMetrics: criticalCount,
        warningMetrics: metrics.filter(m => m.status === "warning").length,
      },
      topTables,
      history,
      recentOptimizations,
      cleanupSettings,
      alertConfigs,
      limits: FREE_TIER_LIMITS,
    };

    console.log(`✅ Monitor complete. Health Score: ${response.healthScore}, DB Size: ${response.summary.totalDatabaseSize}`);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("❌ Supabase Monitor error:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function getTableStatistics(supabase: any): Promise<TableStats[]> {
  // Comprehensive list of tables to monitor
  const tables = [
    "ai_response_cache",
    "api_request_logs",
    "function_logs",
    "admin_audit_logs",
    "admin_audit_logs_archive",
    "employer_notifications",
    "jobseeker_notifications",
    "chat_messages",
    "live_sessions",
    "daily_unique_visitors",
    "job_view_logs",
    "cached_audio",
    "job_applications",
    "jobs",
    "profiles",
    "companies",
    "ai_generated_tricks",
    "ai_chat_usage",
    "conversations",
    "otp_codes",
    "whatsapp_messages",
    "telegram_messages",
    "service_health_checks",
    "api_health_checks",
    "search_history",
    "cleanup_execution_logs",
    "egress_optimization_logs",
    "interview_cleanup_logs",
    "notifications",
    "whatsapp_webhook_logs",
    "interviews",
    "interview_participants",
    "referral_cycles",
    "referral_leaderboard",
    "referral_stats",
    "user_wallets",
    "wallet_transactions",
    "point_packages",
    "boost_packages",
    "hero_banners",
    "blog_posts",
    "faqs",
    "career_paths",
    "certifications",
    "education_entries",
    "work_experiences",
    "skills",
    "saved_jobs",
    "company_favorites",
    "company_reviews",
    "app_reviews",
    "admin_users",
    "admin_permissions",
  ];

  const stats: TableStats[] = [];

  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });
      
      if (error) {
        continue; // Skip tables that don't exist or have access issues
      }

      const rowCount = count || 0;
      // Get row size from our mapping, or use a reasonable default
      const avgSize = TABLE_ROW_SIZES[table] || 500;
      // Apply index overhead factor for more accurate total size
      const sizeBytes = Math.round(rowCount * avgSize * INDEX_OVERHEAD_FACTOR);

      if (rowCount > 0 || sizeBytes > 0) {
        stats.push({
          tableName: table,
          rowCount,
          sizeBytes,
          sizeFormatted: formatBytes(sizeBytes),
        });
      }
    } catch (e) {
      // Table might not exist, skip silently
    }
  }

  return stats;
}

async function estimateEgress(supabase: any): Promise<{ cached: number; regular: number; cachedPercentage: number }> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  let apiRequests = 0;
  let functionCalls = 0;

  try {
    const { count } = await supabase
      .from("api_request_logs")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startOfMonth.toISOString());
    apiRequests = count || 0;
  } catch (e) {
    console.log("api_request_logs may not exist");
  }

  try {
    const { count } = await supabase
      .from("function_logs")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startOfMonth.toISOString());
    functionCalls = count || 0;
  } catch (e) {
    console.log("function_logs may not exist");
  }

  // Estimate egress: API requests avg 5KB, function calls avg 10KB
  const apiEgress = apiRequests * 5 * 1024;
  const functionEgress = functionCalls * 10 * 1024;
  const totalEgress = apiEgress + functionEgress;

  // Assume 60% is cached egress (repeated queries)
  const cachedEgress = totalEgress * 0.6;
  const regularEgress = totalEgress * 0.4;

  return {
    cached: cachedEgress,
    regular: regularEgress,
    cachedPercentage: (cachedEgress / FREE_TIER_LIMITS.cached_egress) * 100,
  };
}

async function getEdgeFunctionInvocations(supabase: any): Promise<number> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  try {
    const { count } = await supabase
      .from("function_logs")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startOfMonth.toISOString());
    return count || 0;
  } catch (e) {
    return 0;
  }
}

async function getMAUEstimates(supabase: any): Promise<{ total: number; thirdParty: number; sso: number }> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  let activeUsers = 0;
  
  // Try live_sessions first
  try {
    const { count } = await supabase
      .from("live_sessions")
      .select("user_id", { count: "exact", head: true })
      .gte("created_at", startOfMonth.toISOString());
    activeUsers = count || 0;
  } catch (e) {
    // Try daily_unique_visitors as fallback
    try {
      const { count } = await supabase
        .from("daily_unique_visitors")
        .select("*", { count: "exact", head: true })
        .gte("visit_date", startOfMonth.toISOString().split("T")[0]);
      activeUsers = count || 0;
    } catch (e2) {
      console.log("No session tracking tables found");
    }
  }

  return {
    total: activeUsers,
    thirdParty: 0,
    sso: 0,
  };
}

function buildMetric(type: string, current: number, limit: number): UsageMetric {
  const percentage = limit > 0 ? (current / limit) * 100 : 0;
  let status: "safe" | "warning" | "critical" | "emergency" = "safe";
  
  if (percentage >= 95) status = "emergency";
  else if (percentage >= 85) status = "critical";
  else if (percentage >= 70) status = "warning";

  return {
    type,
    current,
    limit,
    percentage: Math.round(percentage * 100) / 100,
    status,
    formatted: `${formatBytes(current)} / ${formatBytes(limit)}`,
  };
}

async function storeMetrics(supabase: any, metrics: UsageMetric[]): Promise<void> {
  const today = new Date().toISOString().split("T")[0];

  for (const metric of metrics) {
    try {
      await supabase
        .from("supabase_usage_metrics")
        .upsert({
          metric_date: today,
          metric_type: metric.type,
          metric_value: Math.round(metric.current),
          metric_limit: metric.limit,
          usage_percentage: metric.percentage,
          metadata: { status: metric.status },
          updated_at: new Date().toISOString(),
        }, { onConflict: "metric_date,metric_type" });
    } catch (e) {
      // Table may not exist, skip
    }
  }
}

async function getHistoricalMetrics(supabase: any, days: number): Promise<any[]> {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  try {
    const { data } = await supabase
      .from("supabase_usage_metrics")
      .select("*")
      .gte("metric_date", startDate)
      .order("metric_date", { ascending: true });
    return data || [];
  } catch (e) {
    return [];
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
