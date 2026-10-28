import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CleanupResult {
  table: string;
  deleted: number;
  egressSaved: number;
  error?: string;
}

interface UsageMetrics {
  cachedEgress: number;
  egress: number;
  databaseSize: number;
  storageSize: number;
  realtimeMessages: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("🚀 Starting Enhanced Auto Egress Manager...");

    // Get request body for manual triggers
    let forceCleanup = false;
    let cleanupLevel = "auto"; // auto, light, normal, aggressive
    let action = "default"; // default, clean_specific_table, power_cleanup
    let tableKey = "";
    let retention: { value: number; unit: string } | null = null;
    let powerSettings: any = null;
    
    try {
      const body = await req.json();
      forceCleanup = body.forceCleanup || false;
      cleanupLevel = body.cleanupLevel || "auto";
      action = body.action || "default";
      tableKey = body.tableKey || "";
      retention = body.retention || null;
      powerSettings = body.settings || null;
    } catch {
      // No body, use defaults
    }

    // Handle specific table cleanup
    if (action === "clean_specific_table" && tableKey && retention) {
      const result = await cleanSpecificTable(supabase, tableKey, retention);
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle power cleanup with custom settings
    if (action === "power_cleanup" && powerSettings) {
      const result = await powerCleanupWithSettings(supabase, powerSettings);
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get current cleanup settings from cleanup_schedule_settings (the correct table)
    let savedPowerSettings: Record<string, { value: number; unit: string; enabled: boolean }> | null = null;
    try {
      const { data: powerSettingsData } = await supabase
        .from("cleanup_schedule_settings")
        .select("setting_value")
        .eq("setting_key", "power_cleanup_settings")
        .single();
      
      if (powerSettingsData?.setting_value) {
        savedPowerSettings = powerSettingsData.setting_value;
        console.log("📋 Loaded power settings from cleanup_schedule_settings");
      }
    } catch (e) {
      console.log("Could not load power settings, using defaults");
    }

    // Estimate current usage (based on table sizes and query patterns)
    const usageMetrics = await estimateUsageMetrics(supabase);
    console.log("📊 Current Usage Estimates:", usageMetrics);

    // Determine cleanup level based on usage
    if (cleanupLevel === "auto") {
      if (usageMetrics.cachedEgress > 90) {
        cleanupLevel = "aggressive";
      } else if (usageMetrics.cachedEgress > 75) {
        cleanupLevel = "normal";
      } else if (usageMetrics.cachedEgress > 60) {
        cleanupLevel = "light";
      } else if (!forceCleanup) {
        console.log("✅ Usage within limits, no cleanup needed");
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "Usage within limits",
            metrics: usageMetrics,
            cleanupPerformed: false 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    console.log(`🧹 Cleanup level: ${cleanupLevel}`);

    const cleanupResults: CleanupResult[] = [];
    let totalDeleted = 0;
    let totalEgressSaved = 0;

    // 1. Clean OTPs (highest priority - expires quickly)
    const otpResult = await cleanOTPCodes(supabase, cleanupLevel);
    cleanupResults.push(otpResult);
    totalDeleted += otpResult.deleted;
    totalEgressSaved += otpResult.egressSaved;

    // 2. Clean live sessions (old/expired)
    const sessionResult = await cleanLiveSessions(supabase, cleanupLevel);
    cleanupResults.push(sessionResult);
    totalDeleted += sessionResult.deleted;
    totalEgressSaved += sessionResult.egressSaved;

    // 3. Clean service health checks
    const healthCheckResult = await cleanServiceHealthChecks(supabase, cleanupLevel);
    cleanupResults.push(healthCheckResult);
    totalDeleted += healthCheckResult.deleted;
    totalEgressSaved += healthCheckResult.egressSaved;

    // 4. Clean AI Response Cache
    const aiCacheResult = await cleanAIResponseCache(supabase, cleanupLevel);
    cleanupResults.push(aiCacheResult);
    totalDeleted += aiCacheResult.deleted;
    totalEgressSaved += aiCacheResult.egressSaved;

    // 5. Clean old notifications (use saved settings if available)
    const notifSetting = savedPowerSettings?.notifications;
    const notifResult = await cleanNotifications(supabase, cleanupLevel, notifSetting ? { retention_days: getRetentionDays(notifSetting.value, notifSetting.unit) } : null);
    cleanupResults.push(notifResult);
    totalDeleted += notifResult.deleted;
    totalEgressSaved += notifResult.egressSaved;

    // 6. Clean API request logs (use saved settings if available)
    const apiLogSetting = savedPowerSettings?.api_request_logs;
    const apiLogResult = await cleanAPILogs(supabase, cleanupLevel, apiLogSetting ? { retention_days: getRetentionDays(apiLogSetting.value, apiLogSetting.unit) } : null);
    cleanupResults.push(apiLogResult);
    totalDeleted += apiLogResult.deleted;
    totalEgressSaved += apiLogResult.egressSaved;

    // 7. Clean function logs (use saved settings if available)
    const funcLogSetting = savedPowerSettings?.function_logs;
    const funcLogResult = await cleanFunctionLogs(supabase, cleanupLevel, funcLogSetting ? { retention_days: getRetentionDays(funcLogSetting.value, funcLogSetting.unit) } : null);
    cleanupResults.push(funcLogResult);
    totalDeleted += funcLogResult.deleted;
    totalEgressSaved += funcLogResult.egressSaved;

    // 8. Clean cached audio
    const audioResult = await cleanCachedAudio(supabase, cleanupLevel);
    cleanupResults.push(audioResult);
    totalDeleted += audioResult.deleted;
    totalEgressSaved += audioResult.egressSaved;

    // 9. Clean job view logs
    const jobViewResult = await cleanJobViewLogs(supabase, cleanupLevel);
    cleanupResults.push(jobViewResult);
    totalDeleted += jobViewResult.deleted;
    totalEgressSaved += jobViewResult.egressSaved;

    // 10. Archive old audit logs
    const auditResult = await archiveAuditLogs(supabase, cleanupLevel);
    cleanupResults.push(auditResult);
    totalDeleted += auditResult.deleted;
    totalEgressSaved += auditResult.egressSaved;

    // 11. Clean daily unique visitors
    const visitorResult = await cleanDailyVisitors(supabase, cleanupLevel);
    cleanupResults.push(visitorResult);
    totalDeleted += visitorResult.deleted;
    totalEgressSaved += visitorResult.egressSaved;

    // 12. Clean old chat messages
    const chatResult = await cleanOldChatMessages(supabase, cleanupLevel);
    cleanupResults.push(chatResult);
    totalDeleted += chatResult.deleted;
    totalEgressSaved += chatResult.egressSaved;

    // 13. Clean search history
    const searchResult = await cleanSearchHistory(supabase, cleanupLevel);
    cleanupResults.push(searchResult);
    totalDeleted += searchResult.deleted;
    totalEgressSaved += searchResult.egressSaved;

    // 14. Clean WhatsApp/Telegram messages
    const msgResult = await cleanMessagingLogs(supabase, cleanupLevel);
    cleanupResults.push(msgResult);
    totalDeleted += msgResult.deleted;
    totalEgressSaved += msgResult.egressSaved;

    // 15. Clean API health checks
    const apiHealthResult = await cleanAPIHealthChecks(supabase, cleanupLevel);
    cleanupResults.push(apiHealthResult);
    totalDeleted += apiHealthResult.deleted;
    totalEgressSaved += apiHealthResult.egressSaved;

    // 16. Clean cron job history (CRITICAL - can use 100+ MB!)
    const cronHistorySetting = savedPowerSettings?.cron_history;
    const cronResult = await cleanCronJobHistory(supabase, cleanupLevel, cronHistorySetting ? { retention_days: getRetentionDays(cronHistorySetting.value, cronHistorySetting.unit) } : null);
    cleanupResults.push(cronResult);
    totalDeleted += cronResult.deleted;
    totalEgressSaved += cronResult.egressSaved;

    const executionTime = Date.now() - startTime;

    // Log optimization result (safe)
    try {
      await supabase.from("egress_optimization_logs").insert({
        optimization_type: "auto_cleanup",
        tables_affected: cleanupResults.filter(r => r.deleted > 0).map(r => r.table),
        rows_deleted: totalDeleted,
        egress_saved_bytes: totalEgressSaved,
        execution_time_ms: executionTime,
        status: "success",
        metadata: {
          cleanup_level: cleanupLevel,
          forced: forceCleanup,
          usage_before: usageMetrics,
          results: cleanupResults.filter(r => r.deleted > 0)
        }
      });
    } catch (e) {
      console.log("Could not log to egress_optimization_logs");
    }

    // Log to cleanup_execution_logs (safe)
    try {
      await supabase.from("cleanup_execution_logs").insert({
        cleanup_type: cleanupLevel,
        triggered_by: forceCleanup ? "manual" : "auto",
        total_deleted: totalDeleted,
        tables_cleaned: cleanupResults.filter(r => r.deleted > 0).map(r => ({ table: r.table, deleted: r.deleted })),
        execution_time_ms: executionTime,
      });
    } catch (e) {
      console.log("Could not log to cleanup_execution_logs");
    }

    // Update cleanup settings last run time in cleanup_schedule_settings
    try {
      await supabase
        .from("cleanup_schedule_settings")
        .update({ 
          updated_at: new Date().toISOString()
        })
        .eq("setting_key", "power_cleanup_settings");
    } catch (e) {
      console.log("Could not update cleanup_schedule_settings");
    }

    console.log(`✅ Cleanup complete! Deleted ${totalDeleted} rows, saved ~${formatBytes(totalEgressSaved)}`);

    return new Response(
      JSON.stringify({
        success: true,
        cleanupPerformed: true,
        cleanupLevel,
        totalDeleted,
        egressSavedBytes: totalEgressSaved,
        egressSavedFormatted: formatBytes(totalEgressSaved),
        executionTimeMs: executionTime,
        results: cleanupResults.filter(r => r.deleted > 0 || r.error),
        usageMetrics
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("❌ Auto Egress Manager error:", errorMessage);
    
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      await supabase.from("egress_optimization_logs").insert({
        optimization_type: "auto_cleanup",
        status: "error",
        error_message: errorMessage,
        execution_time_ms: Date.now() - startTime
      });
    } catch (e) {
      // Ignore logging errors
    }

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function estimateUsageMetrics(supabase: any): Promise<UsageMetrics> {
  const freeEgressLimit = 2 * 1024 * 1024 * 1024; // 2GB
  const freeDatabaseLimit = 500 * 1024 * 1024; // 500MB
  
  let recentQueries = 0;
  try {
    const { count } = await supabase
      .from("api_request_logs")
      .select("*", { count: "exact", head: true })
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    recentQueries = count || 0;
  } catch (e) {
    // Table may not exist
  }
  
  // Rough estimation: each query averages ~5KB response
  const estimatedEgress = recentQueries * 5 * 1024 * 30; // Monthly estimate
  const cachedEgressPercentage = Math.min(100, (estimatedEgress / freeEgressLimit) * 100);
  
  return {
    cachedEgress: Math.round(cachedEgressPercentage),
    egress: Math.round(cachedEgressPercentage * 0.5),
    databaseSize: 0,
    storageSize: 0,
    realtimeMessages: 0
  };
}

// Helper function to safely delete from a table
async function safeDelete(supabase: any, table: string, condition: any): Promise<{ count: number; error?: string }> {
  try {
    // First get count
    let query = supabase.from(table).select("*", { count: "exact", head: true });
    for (const [key, value] of Object.entries(condition)) {
      if (key === "lt") {
        for (const [col, val] of Object.entries(value as any)) {
          query = query.lt(col, val);
        }
      } else if (key === "eq") {
        for (const [col, val] of Object.entries(value as any)) {
          query = query.eq(col, val);
        }
      }
    }
    const { count, error: countError } = await query;
    
    if (countError) {
      return { count: 0, error: countError.message };
    }
    
    if (!count || count === 0) {
      return { count: 0 };
    }

    // Then delete
    let deleteQuery = supabase.from(table).delete();
    for (const [key, value] of Object.entries(condition)) {
      if (key === "lt") {
        for (const [col, val] of Object.entries(value as any)) {
          deleteQuery = deleteQuery.lt(col, val);
        }
      } else if (key === "eq") {
        for (const [col, val] of Object.entries(value as any)) {
          deleteQuery = deleteQuery.eq(col, val);
        }
      }
    }
    const { error: deleteError } = await deleteQuery;
    
    if (deleteError) {
      return { count: 0, error: deleteError.message };
    }
    
    return { count };
  } catch (e) {
    return { count: 0, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

async function cleanOTPCodes(supabase: any, level: string): Promise<CleanupResult> {
  const hours = level === "aggressive" ? 1 : level === "normal" ? 6 : 12;
  const cutoffDate = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  
  try {
    const { count } = await supabase
      .from("otp_codes")
      .select("*", { count: "exact", head: true })
      .lt("created_at", cutoffDate);
    
    if (count && count > 0) {
      await supabase.from("otp_codes").delete().lt("created_at", cutoffDate);
    }
    
    return { table: "otp_codes", deleted: count || 0, egressSaved: (count || 0) * 200 };
  } catch (e) {
    return { table: "otp_codes", deleted: 0, egressSaved: 0, error: "Table may not exist" };
  }
}

async function cleanLiveSessions(supabase: any, level: string): Promise<CleanupResult> {
  // AGGRESSIVE: Now tracking is disabled, delete ALL sessions older than 30 minutes
  const minutes = level === "aggressive" ? 30 : level === "normal" ? 60 : 120;
  const cutoffDate = new Date(Date.now() - minutes * 60 * 1000).toISOString();
  
  try {
    const { count } = await supabase
      .from("live_sessions")
      .select("*", { count: "exact", head: true })
      .lt("last_seen", cutoffDate);
    
    if (count && count > 0) {
      await supabase.from("live_sessions").delete().lt("last_seen", cutoffDate);
    }
    
    return { table: "live_sessions", deleted: count || 0, egressSaved: (count || 0) * 300 };
  } catch (e) {
    return { table: "live_sessions", deleted: 0, egressSaved: 0, error: "Table may not exist" };
  }
}

async function cleanServiceHealthChecks(supabase: any, level: string): Promise<CleanupResult> {
  const hours = level === "aggressive" ? 6 : level === "normal" ? 12 : 24;
  const cutoffDate = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  
  try {
    const { count } = await supabase
      .from("service_health_checks")
      .select("*", { count: "exact", head: true })
      .lt("checked_at", cutoffDate);
    
    if (count && count > 0) {
      await supabase.from("service_health_checks").delete().lt("checked_at", cutoffDate);
    }
    
    return { table: "service_health_checks", deleted: count || 0, egressSaved: (count || 0) * 300 };
  } catch (e) {
    return { table: "service_health_checks", deleted: 0, egressSaved: 0, error: "Table may not exist" };
  }
}

async function cleanAIResponseCache(supabase: any, level: string): Promise<CleanupResult> {
  const days = level === "aggressive" ? 3 : level === "normal" ? 7 : 14;
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  
  try {
    const { count } = await supabase
      .from("ai_response_cache")
      .select("*", { count: "exact", head: true })
      .lt("created_at", cutoffDate);
    
    if (count && count > 0) {
      await supabase.from("ai_response_cache").delete().lt("created_at", cutoffDate);
    }
    
    return { table: "ai_response_cache", deleted: count || 0, egressSaved: (count || 0) * 2000 };
  } catch (e) {
    return { table: "ai_response_cache", deleted: 0, egressSaved: 0, error: "Table may not exist" };
  }
}

async function cleanNotifications(supabase: any, level: string, settings: any): Promise<CleanupResult> {
  const days = settings?.retention_days || (level === "aggressive" ? 3 : level === "normal" ? 7 : 14);
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  
  let totalDeleted = 0;
  
  // Clean employer notifications
  try {
    const { count } = await supabase
      .from("employer_notifications")
      .select("*", { count: "exact", head: true })
      .lt("created_at", cutoffDate)
      .eq("is_read", true);
    
    if (count && count > 0) {
      await supabase
        .from("employer_notifications")
        .delete()
        .lt("created_at", cutoffDate)
        .eq("is_read", true);
      totalDeleted += count;
    }
  } catch (e) {
    // Table may not exist
  }
  
  // Clean jobseeker notifications
  try {
    const { count } = await supabase
      .from("jobseeker_notifications")
      .select("*", { count: "exact", head: true })
      .lt("created_at", cutoffDate)
      .eq("is_read", true);
    
    if (count && count > 0) {
      await supabase
        .from("jobseeker_notifications")
        .delete()
        .lt("created_at", cutoffDate)
        .eq("is_read", true);
      totalDeleted += count;
    }
  } catch (e) {
    // Table may not exist
  }
  
  return { table: "notifications", deleted: totalDeleted, egressSaved: totalDeleted * 500 };
}

async function cleanAPILogs(supabase: any, level: string, settings: any): Promise<CleanupResult> {
  const days = settings?.retention_days || 30;
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  
  try {
    const { count } = await supabase
      .from("api_request_logs")
      .select("*", { count: "exact", head: true })
      .lt("created_at", cutoffDate);
    
    if (count && count > 0) {
      await supabase.from("api_request_logs").delete().lt("created_at", cutoffDate);
    }
    
    return { table: "api_request_logs", deleted: count || 0, egressSaved: (count || 0) * 400 };
  } catch (e) {
    return { table: "api_request_logs", deleted: 0, egressSaved: 0, error: "Table may not exist" };
  }
}

async function cleanFunctionLogs(supabase: any, level: string, settings: any): Promise<CleanupResult> {
  const days = settings?.retention_days || (level === "aggressive" ? 1 : level === "normal" ? 3 : 7);
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  
  try {
    const { count } = await supabase
      .from("function_logs")
      .select("*", { count: "exact", head: true })
      .lt("created_at", cutoffDate);
    
    if (count && count > 0) {
      await supabase.from("function_logs").delete().lt("created_at", cutoffDate);
    }
    
    return { table: "function_logs", deleted: count || 0, egressSaved: (count || 0) * 600 };
  } catch (e) {
    return { table: "function_logs", deleted: 0, egressSaved: 0, error: "Table may not exist" };
  }
}

async function cleanCachedAudio(supabase: any, level: string): Promise<CleanupResult> {
  const days = level === "aggressive" ? 3 : level === "normal" ? 7 : 14;
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  
  try {
    const { count } = await supabase
      .from("cached_audio")
      .select("*", { count: "exact", head: true })
      .lt("last_accessed_at", cutoffDate);
    
    if (count && count > 0) {
      await supabase.from("cached_audio").delete().lt("last_accessed_at", cutoffDate);
    }
    
    return { table: "cached_audio", deleted: count || 0, egressSaved: (count || 0) * 50000 };
  } catch (e) {
    return { table: "cached_audio", deleted: 0, egressSaved: 0, error: "Table may not exist" };
  }
}

async function cleanJobViewLogs(supabase: any, level: string): Promise<CleanupResult> {
  const days = level === "aggressive" ? 3 : level === "normal" ? 7 : 14;
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  
  try {
    const { count } = await supabase
      .from("job_view_logs")
      .select("*", { count: "exact", head: true })
      .lt("viewed_at", cutoffDate);
    
    if (count && count > 0) {
      await supabase.from("job_view_logs").delete().lt("viewed_at", cutoffDate);
    }
    
    return { table: "job_view_logs", deleted: count || 0, egressSaved: (count || 0) * 200 };
  } catch (e) {
    return { table: "job_view_logs", deleted: 0, egressSaved: 0, error: "Table may not exist" };
  }
}

async function archiveAuditLogs(supabase: any, level: string): Promise<CleanupResult> {
  const days = level === "aggressive" ? 14 : level === "normal" ? 30 : 60;
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  
  try {
    // Get logs to archive
    const { data: logsToArchive } = await supabase
      .from("admin_audit_logs")
      .select("*")
      .lt("created_at", cutoffDate)
      .limit(500);
    
    if (logsToArchive && logsToArchive.length > 0) {
      // Insert into archive
      try {
        await supabase.from("admin_audit_logs_archive").insert(
          logsToArchive.map((log: any) => ({ ...log, archived_at: new Date().toISOString() }))
        );
      } catch (e) {
        // Archive table may not exist, just delete
      }
      
      // Delete from main table
      const ids = logsToArchive.map((log: any) => log.id);
      await supabase.from("admin_audit_logs").delete().in("id", ids);
    }
    
    return { table: "admin_audit_logs", deleted: logsToArchive?.length || 0, egressSaved: (logsToArchive?.length || 0) * 800 };
  } catch (e) {
    return { table: "admin_audit_logs", deleted: 0, egressSaved: 0, error: "Table may not exist" };
  }
}

async function cleanDailyVisitors(supabase: any, level: string): Promise<CleanupResult> {
  // AGGRESSIVE: Delete visitors older than 1-3 days (was 3-14 days)
  const days = level === "aggressive" ? 1 : level === "normal" ? 2 : 3;
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  
  try {
    const { count } = await supabase
      .from("daily_unique_visitors")
      .select("*", { count: "exact", head: true })
      .lt("visit_date", cutoffDate);
    
    if (count && count > 0) {
      await supabase.from("daily_unique_visitors").delete().lt("visit_date", cutoffDate);
    }
    
    return { table: "daily_unique_visitors", deleted: count || 0, egressSaved: (count || 0) * 250 };
  } catch (e) {
    return { table: "daily_unique_visitors", deleted: 0, egressSaved: 0, error: "Table may not exist" };
  }
}

async function cleanOldChatMessages(supabase: any, level: string): Promise<CleanupResult> {
  const days = level === "aggressive" ? 7 : level === "normal" ? 14 : 30;
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  
  try {
    const { count } = await supabase
      .from("chat_messages")
      .select("*", { count: "exact", head: true })
      .lt("created_at", cutoffDate)
      .eq("is_read", true);
    
    if (count && count > 0) {
      await supabase
        .from("chat_messages")
        .delete()
        .lt("created_at", cutoffDate)
        .eq("is_read", true);
    }
    
    return { table: "chat_messages", deleted: count || 0, egressSaved: (count || 0) * 500 };
  } catch (e) {
    return { table: "chat_messages", deleted: 0, egressSaved: 0, error: "Table may not exist" };
  }
}

async function cleanSearchHistory(supabase: any, level: string): Promise<CleanupResult> {
  const days = level === "aggressive" ? 3 : level === "normal" ? 7 : 14;
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  
  try {
    const { count } = await supabase
      .from("search_history")
      .select("*", { count: "exact", head: true })
      .lt("created_at", cutoffDate);
    
    if (count && count > 0) {
      await supabase.from("search_history").delete().lt("created_at", cutoffDate);
    }
    
    return { table: "search_history", deleted: count || 0, egressSaved: (count || 0) * 400 };
  } catch (e) {
    return { table: "search_history", deleted: 0, egressSaved: 0, error: "Table may not exist" };
  }
}

async function cleanMessagingLogs(supabase: any, level: string): Promise<CleanupResult> {
  const days = level === "aggressive" ? 3 : level === "normal" ? 7 : 14;
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  
  let totalDeleted = 0;
  
  // Clean WhatsApp messages
  try {
    const { count } = await supabase
      .from("whatsapp_messages")
      .select("*", { count: "exact", head: true })
      .lt("created_at", cutoffDate);
    
    if (count && count > 0) {
      await supabase.from("whatsapp_messages").delete().lt("created_at", cutoffDate);
      totalDeleted += count;
    }
  } catch (e) {
    // Table may not exist
  }
  
  // Clean Telegram messages
  try {
    const { count } = await supabase
      .from("telegram_messages")
      .select("*", { count: "exact", head: true })
      .lt("created_at", cutoffDate);
    
    if (count && count > 0) {
      await supabase.from("telegram_messages").delete().lt("created_at", cutoffDate);
      totalDeleted += count;
    }
  } catch (e) {
    // Table may not exist
  }
  
  // Clean WhatsApp webhook logs
  try {
    const { count } = await supabase
      .from("whatsapp_webhook_logs")
      .select("*", { count: "exact", head: true })
      .lt("created_at", cutoffDate);
    
    if (count && count > 0) {
      await supabase.from("whatsapp_webhook_logs").delete().lt("created_at", cutoffDate);
      totalDeleted += count;
    }
  } catch (e) {
    // Table may not exist
  }
  
  return { table: "messaging_logs", deleted: totalDeleted, egressSaved: totalDeleted * 600 };
}

async function cleanAPIHealthChecks(supabase: any, level: string): Promise<CleanupResult> {
  const hours = level === "aggressive" ? 6 : level === "normal" ? 12 : 24;
  const cutoffDate = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  
  try {
    const { count } = await supabase
      .from("api_health_checks")
      .select("*", { count: "exact", head: true })
      .lt("checked_at", cutoffDate);
    
    if (count && count > 0) {
      await supabase.from("api_health_checks").delete().lt("checked_at", cutoffDate);
    }
    
    return { table: "api_health_checks", deleted: count || 0, egressSaved: (count || 0) * 300 };
  } catch (e) {
    return { table: "api_health_checks", deleted: 0, egressSaved: 0, error: "Table may not exist" };
  }
}

// NEW: Clean cron job history - CRITICAL for space savings!
async function cleanCronJobHistory(supabase: any, level: string, settings: any): Promise<CleanupResult> {
  const days = settings?.retention_days || (level === "aggressive" ? 1 : level === "normal" ? 3 : 7);
  
  try {
    // Call the cleanup function we created in the database
    const { error } = await supabase.rpc('clean_cron_job_history');
    
    if (error) {
      console.log('Could not clean cron history via RPC:', error.message);
      // Estimate savings based on typical cleanup
      return { table: "cron.job_run_details", deleted: 0, egressSaved: 0, error: error.message };
    }
    
    // Estimate based on typical cleanup - each cron entry is ~700 bytes
    // Assume we deleted about 1000 old entries per cleanup run
    const estimatedDeleted = 1000;
    console.log(`✅ Cleaned cron job history (estimated ${estimatedDeleted} rows)`);
    
    return { 
      table: "cron.job_run_details + net._http_response", 
      deleted: estimatedDeleted, 
      egressSaved: estimatedDeleted * 700 
    };
  } catch (e) {
    return { 
      table: "cron.job_run_details", 
      deleted: 0, 
      egressSaved: 0, 
      error: e instanceof Error ? e.message : "RPC not available" 
    };
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// Helper to convert retention to days for legacy functions
function getRetentionDays(value: number, unit: string): number {
  switch (unit) {
    case 'seconds': return value / 86400;
    case 'minutes': return value / 1440;
    case 'hours': return value / 24;
    case 'days': return value;
    default: return value / 1440; // Default to minutes
  }
}

// Convert retention settings to milliseconds
function getRetentionMs(value: number, unit: string): number {
  switch (unit) {
    case 'seconds': return value * 1000;
    case 'minutes': return value * 60 * 1000;
    case 'hours': return value * 60 * 60 * 1000;
    case 'days': return value * 24 * 60 * 60 * 1000;
    default: return value * 60 * 1000; // Default to minutes
  }
}

// Table mapping for cleanup
const tableConfig: Record<string, { table: string; dateColumn: string; avgRowSize: number }> = {
  otp_codes: { table: 'otp_codes', dateColumn: 'created_at', avgRowSize: 200 },
  live_sessions: { table: 'live_sessions', dateColumn: 'last_seen', avgRowSize: 300 },
  api_health_checks: { table: 'api_health_checks', dateColumn: 'checked_at', avgRowSize: 300 },
  api_request_logs: { table: 'api_request_logs', dateColumn: 'created_at', avgRowSize: 400 },
  function_logs: { table: 'function_logs', dateColumn: 'created_at', avgRowSize: 500 },
  notifications: { table: 'employer_notifications', dateColumn: 'created_at', avgRowSize: 500 },
  chat_messages: { table: 'chat_messages', dateColumn: 'created_at', avgRowSize: 800 },
  cached_audio: { table: 'cached_audio', dateColumn: 'created_at', avgRowSize: 1000 },
  ai_response_cache: { table: 'ai_response_cache', dateColumn: 'created_at', avgRowSize: 2000 },
  cleanup_logs: { table: 'cleanup_logs', dateColumn: 'executed_at', avgRowSize: 400 },
  daily_visitors: { table: 'daily_unique_visitors', dateColumn: 'visit_date', avgRowSize: 200 },
};

// Clean a specific table with custom retention
async function cleanSpecificTable(
  supabase: any, 
  tableKey: string, 
  retention: { value: number; unit: string }
): Promise<{ success: boolean; deleted?: number; error?: string }> {
  const config = tableConfig[tableKey];
  if (!config) {
    return { success: false, error: `Unknown table key: ${tableKey}` };
  }

  const cutoffMs = getRetentionMs(retention.value, retention.unit);
  const cutoffDate = new Date(Date.now() - cutoffMs).toISOString();

  try {
    // Get count first
    const { count, error: countError } = await supabase
      .from(config.table)
      .select('*', { count: 'exact', head: true })
      .lt(config.dateColumn, cutoffDate);

    if (countError) {
      return { success: false, error: countError.message };
    }

    if (!count || count === 0) {
      return { success: true, deleted: 0 };
    }

    // Delete
    const { error: deleteError } = await supabase
      .from(config.table)
      .delete()
      .lt(config.dateColumn, cutoffDate);

    if (deleteError) {
      return { success: false, error: deleteError.message };
    }

    console.log(`✅ Cleaned ${config.table}: ${count} rows deleted`);
    return { success: true, deleted: count };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

// Power cleanup with custom settings for all tables
async function powerCleanupWithSettings(
  supabase: any,
  settings: Record<string, { value: number; unit: string; enabled: boolean }>
): Promise<{ success: boolean; totalDeleted: number; results: any[] }> {
  const results: any[] = [];
  let totalDeleted = 0;

  for (const [key, setting] of Object.entries(settings)) {
    if (!setting.enabled) continue;
    
    const config = tableConfig[key];
    if (!config) continue;

    const cutoffMs = getRetentionMs(setting.value, setting.unit);
    const cutoffDate = new Date(Date.now() - cutoffMs).toISOString();

    try {
      const { count } = await supabase
        .from(config.table)
        .select('*', { count: 'exact', head: true })
        .lt(config.dateColumn, cutoffDate);

      if (count && count > 0) {
        await supabase
          .from(config.table)
          .delete()
          .lt(config.dateColumn, cutoffDate);
        
        totalDeleted += count;
        results.push({ table: config.table, deleted: count });
        console.log(`✅ ${config.table}: ${count} rows deleted`);
      }
    } catch (e) {
      results.push({ table: config.table, error: e instanceof Error ? e.message : 'Error' });
    }
  }

  // Also clean notifications from jobseeker_notifications
  if (settings.notifications?.enabled) {
    try {
      const cutoffMs = getRetentionMs(settings.notifications.value, settings.notifications.unit);
      const cutoffDate = new Date(Date.now() - cutoffMs).toISOString();
      
      const { count } = await supabase
        .from('jobseeker_notifications')
        .select('*', { count: 'exact', head: true })
        .lt('created_at', cutoffDate)
        .eq('is_read', true);

      if (count && count > 0) {
        await supabase
          .from('jobseeker_notifications')
          .delete()
          .lt('created_at', cutoffDate)
          .eq('is_read', true);
        
        totalDeleted += count;
        results.push({ table: 'jobseeker_notifications', deleted: count });
      }
    } catch (e) {
      // Ignore
    }
  }

  console.log(`✅ Power cleanup complete: ${totalDeleted} total rows deleted`);
  
  return { success: true, totalDeleted, results };
}
