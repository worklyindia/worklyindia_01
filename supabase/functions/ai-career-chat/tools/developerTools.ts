// Developer-level tools for AI autonomous platform management

/**
 * Inspect any table in the database - read any data the AI needs
 */
export async function inspectTable(supabase: any, tableName: string, filters?: any, limit?: number) {
  try {
    const safeLimit = Math.min(limit || 20, 50); // Cap at 50 rows
    
    // Whitelist of allowed tables for safety
    const allowedTables = [
      'profiles', 'companies', 'jobs', 'job_applications', 'wallets', 'referral_wallets',
      'app_settings', 'blog_posts', 'career_paths', 'certifications', 'chat_messages',
      'conversations', 'company_reviews', 'education_entries', 'professional_experiences',
      'faqs', 'boost_packages', 'ai_chat_plans', 'ai_chat_subscriptions', 'ai_chat_usage',
      'ai_generated_tricks', 'ai_response_cache', 'api_health_checks', 'app_reviews',
      'app_download_tracking', 'contact_information', 'notification_preferences',
      'job_alerts', 'saved_jobs', 'skill_assessments', 'support_tickets',
      'referral_codes', 'referral_earnings', 'wallet_transactions',
      'bing_indexing_queue', 'cleanup_logs', 'cleanup_execution_logs',
      'admin_audit_logs', 'api_request_logs', 'behavioral_tracking',
      'blocked_accounts', 'account_deletion_requests', 'ai_data_access_logs',
      'ai_image_usage', 'ai_system_users', 'auto_cleanup_settings',
      'auto_scale_settings', 'assessment_questions'
    ];
    
    if (!allowedTables.includes(tableName)) {
      return { 
        error: `Table '${tableName}' is not accessible. Available tables: ${allowedTables.join(', ')}`,
        allowed_tables: allowedTables
      };
    }
    
    let query = supabase.from(tableName).select('*');
    
    // Apply filters
    if (filters) {
      if (filters.eq) {
        for (const [col, val] of Object.entries(filters.eq)) {
          query = query.eq(col, val);
        }
      }
      if (filters.ilike) {
        for (const [col, val] of Object.entries(filters.ilike)) {
          query = query.ilike(col, `%${val}%`);
        }
      }
      if (filters.gte) {
        for (const [col, val] of Object.entries(filters.gte)) {
          query = query.gte(col, val);
        }
      }
      if (filters.lte) {
        for (const [col, val] of Object.entries(filters.lte)) {
          query = query.lte(col, val);
        }
      }
      if (filters.order_by) {
        query = query.order(filters.order_by, { ascending: filters.ascending ?? false });
      }
    }
    
    // Get count
    const { count } = await supabase.from(tableName).select('*', { count: 'exact', head: true });
    
    const { data, error } = await query.limit(safeLimit);
    
    if (error) {
      return { error: `Failed to query ${tableName}: ${error.message}` };
    }
    
    return {
      table: tableName,
      total_rows: count || 0,
      returned_rows: data?.length || 0,
      limit: safeLimit,
      data: data || [],
      columns: data && data.length > 0 ? Object.keys(data[0]) : [],
      note: `Showing ${data?.length || 0} of ${count || 0} total rows`
    };
  } catch (err: any) {
    return { error: `Table inspection failed: ${err.message}` };
  }
}

/**
 * Get full platform health status - errors, performance, system state
 */
export async function getPlatformHealth(supabase: any) {
  try {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    // Run all health checks in parallel
    const [
      // API health
      { data: apiHealth },
      // Recent errors from support tickets
      { count: recentTickets },
      { count: urgentTickets },
      // User growth
      { count: newUsersToday },
      { count: newUsersWeek },
      // Job metrics
      { count: activeJobs },
      { count: newJobsToday },
      { count: applicationsToday },
      // System tables health
      { count: totalProfiles },
      { count: totalCompanies },
      { count: blockedAccounts },
      // Cleanup status
      { data: lastCleanup },
      // Cache performance
      { data: cacheStats },
      // AI usage today
      { data: aiUsageToday }
    ] = await Promise.all([
      supabase.from('api_health_checks').select('*').order('checked_at', { ascending: false }).limit(10),
      supabase.from('support_tickets').select('id', { count: 'exact', head: true }).gte('created_at', oneDayAgo),
      supabase.from('support_tickets').select('id', { count: 'exact', head: true }).eq('priority', 'urgent').eq('status', 'open'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', oneDayAgo),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
      supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('jobs').select('id', { count: 'exact', head: true }).gte('created_at', oneDayAgo),
      supabase.from('job_applications').select('id', { count: 'exact', head: true }).gte('applied_at', oneDayAgo),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('companies').select('id', { count: 'exact', head: true }),
      supabase.from('blocked_accounts').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('cleanup_execution_logs').select('*').order('executed_at', { ascending: false }).limit(1),
      supabase.from('ai_response_cache').select('hit_count').order('hit_count', { ascending: false }).limit(10),
      supabase.from('ai_chat_usage').select('messages_count, image_analysis_count').eq('date', now.toISOString().split('T')[0])
    ]);
    
    // Calculate cache hit rate
    const totalCacheHits = cacheStats?.reduce((sum: number, c: any) => sum + (c.hit_count || 0), 0) || 0;
    
    // Calculate AI usage today
    const totalAIMessages = aiUsageToday?.reduce((sum: number, u: any) => sum + (u.messages_count || 0), 0) || 0;
    const totalImageAnalysis = aiUsageToday?.reduce((sum: number, u: any) => sum + (u.image_analysis_count || 0), 0) || 0;
    
    // Determine overall health status
    const issues: string[] = [];
    if ((urgentTickets || 0) > 0) issues.push(`${urgentTickets} urgent tickets open`);
    if ((blockedAccounts || 0) > 10) issues.push(`${blockedAccounts} blocked accounts`);
    
    const healthStatus = issues.length === 0 ? '🟢 HEALTHY' : 
                         issues.length <= 2 ? '🟡 ATTENTION NEEDED' : '🔴 CRITICAL';
    
    return {
      overall_status: healthStatus,
      timestamp: now.toISOString(),
      issues: issues,
      
      user_metrics: {
        total_users: totalProfiles || 0,
        new_today: newUsersToday || 0,
        new_this_week: newUsersWeek || 0,
        blocked: blockedAccounts || 0
      },
      
      job_metrics: {
        active_jobs: activeJobs || 0,
        new_today: newJobsToday || 0,
        applications_today: applicationsToday || 0,
        total_companies: totalCompanies || 0
      },
      
      support_metrics: {
        tickets_today: recentTickets || 0,
        urgent_open: urgentTickets || 0
      },
      
      ai_metrics: {
        messages_today: totalAIMessages,
        images_analyzed_today: totalImageAnalysis,
        cache_top_hits: totalCacheHits
      },
      
      system_health: {
        api_checks: apiHealth?.map((h: any) => ({
          endpoint: h.endpoint,
          healthy: h.is_healthy,
          response_time: h.response_time_ms,
          checked_at: h.checked_at
        })) || [],
        last_cleanup: lastCleanup?.[0] || null
      }
    };
  } catch (err: any) {
    return { error: `Health check failed: ${err.message}` };
  }
}

/**
 * Analyze data quality issues across the platform
 */
export async function analyzeDataQuality(supabase: any) {
  try {
    const issues: any[] = [];
    
    // Check for profiles without essential data
    const { count: incompleteProfiles } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .or('full_name.is.null,email.is.null');
    
    if ((incompleteProfiles || 0) > 0) {
      issues.push({
        severity: 'medium',
        area: 'profiles',
        issue: `${incompleteProfiles} profiles missing name or email`,
        suggestion: 'Send profile completion reminders to these users'
      });
    }
    
    // Check for jobs without company
    const { count: orphanJobs } = await supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .is('company_id', null)
      .eq('status', 'active');
    
    if ((orphanJobs || 0) > 0) {
      issues.push({
        severity: 'high',
        area: 'jobs',
        issue: `${orphanJobs} active jobs without company association`,
        suggestion: 'These jobs may confuse users - link them to companies or deactivate'
      });
    }
    
    // Check for expired jobs still marked active
    const { count: expiredActive } = await supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .lt('expires_at', new Date().toISOString());
    
    if ((expiredActive || 0) > 0) {
      issues.push({
        severity: 'high',
        area: 'jobs',
        issue: `${expiredActive} expired jobs still showing as active`,
        suggestion: 'Run cleanup to mark expired jobs - users may be applying to dead listings'
      });
    }
    
    // Check for stale cache entries
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { count: staleCache } = await supabase
      .from('ai_response_cache')
      .select('id', { count: 'exact', head: true })
      .lt('last_accessed_at', thirtyDaysAgo);
    
    if ((staleCache || 0) > 50) {
      issues.push({
        severity: 'low',
        area: 'cache',
        issue: `${staleCache} stale AI cache entries (30+ days old)`,
        suggestion: 'Clean up old cache to save storage and ensure fresh responses'
      });
    }
    
    // Check for unverified companies with active jobs
    const { count: unverifiedWithJobs } = await supabase
      .from('companies')
      .select('id', { count: 'exact', head: true })
      .eq('is_verified', false)
      .gt('profile_views_count', 0);
    
    if ((unverifiedWithJobs || 0) > 0) {
      issues.push({
        severity: 'medium',
        area: 'companies',
        issue: `${unverifiedWithJobs} unverified companies with activity`,
        suggestion: 'Review these companies for verification to build user trust'
      });
    }
    
    // Summary
    const highSeverity = issues.filter(i => i.severity === 'high').length;
    const mediumSeverity = issues.filter(i => i.severity === 'medium').length;
    
    return {
      data_quality_score: issues.length === 0 ? '🟢 EXCELLENT' :
                          highSeverity > 0 ? '🔴 NEEDS ATTENTION' : '🟡 GOOD',
      total_issues: issues.length,
      high_severity: highSeverity,
      medium_severity: mediumSeverity,
      low_severity: issues.filter(i => i.severity === 'low').length,
      issues: issues,
      recommendation: highSeverity > 0 
        ? 'High severity issues found - fix these first to maintain platform quality'
        : issues.length > 0 
          ? 'Minor issues found - schedule cleanup during low traffic hours'
          : 'Database is clean and well-maintained!'
    };
  } catch (err: any) {
    return { error: `Data quality analysis failed: ${err.message}` };
  }
}

/**
 * Get detailed analytics and trends for the platform
 */
export async function getPlatformAnalytics(supabase: any, period: string = '7days') {
  try {
    const days = period === '30days' ? 30 : period === '24hours' ? 1 : 7;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    
    // User signups trend
    const { data: userSignups } = await supabase
      .from('profiles')
      .select('created_at, user_type')
      .gte('created_at', startDate)
      .order('created_at', { ascending: false });
    
    // Job postings trend
    const { data: jobPostings } = await supabase
      .from('jobs')
      .select('created_at, status, category, job_type')
      .gte('created_at', startDate)
      .order('created_at', { ascending: false });
    
    // Applications trend
    const { data: applications } = await supabase
      .from('job_applications')
      .select('applied_at, status')
      .gte('applied_at', startDate)
      .order('applied_at', { ascending: false });
    
    // Top job categories
    const categoryMap: Record<string, number> = {};
    jobPostings?.forEach((j: any) => {
      if (j.category) categoryMap[j.category] = (categoryMap[j.category] || 0) + 1;
    });
    
    // User type breakdown
    const jobSeekers = userSignups?.filter((u: any) => u.user_type === 'job_seeker').length || 0;
    const employers = userSignups?.filter((u: any) => u.user_type === 'employer').length || 0;
    
    // Application status breakdown
    const appStatusMap: Record<string, number> = {};
    applications?.forEach((a: any) => {
      appStatusMap[a.status] = (appStatusMap[a.status] || 0) + 1;
    });
    
    return {
      period: `Last ${days} days`,
      start_date: startDate,
      
      user_growth: {
        total_new: userSignups?.length || 0,
        job_seekers: jobSeekers,
        employers: employers,
        daily_average: Math.round((userSignups?.length || 0) / days)
      },
      
      job_activity: {
        total_posted: jobPostings?.length || 0,
        active: jobPostings?.filter((j: any) => j.status === 'active').length || 0,
        top_categories: Object.entries(categoryMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([cat, count]) => ({ category: cat, count })),
        daily_average: Math.round((jobPostings?.length || 0) / days)
      },
      
      application_activity: {
        total: applications?.length || 0,
        status_breakdown: appStatusMap,
        daily_average: Math.round((applications?.length || 0) / days)
      },
      
      insights: generateInsights(userSignups?.length || 0, jobPostings?.length || 0, applications?.length || 0, days)
    };
  } catch (err: any) {
    return { error: `Analytics failed: ${err.message}` };
  }
}

function generateInsights(users: number, jobs: number, apps: number, days: number): string[] {
  const insights: string[] = [];
  
  const dailyUsers = users / days;
  const dailyJobs = jobs / days;
  const dailyApps = apps / days;
  
  if (dailyUsers > 50) insights.push('🚀 Strong user growth - platform is gaining traction!');
  else if (dailyUsers < 5) insights.push('⚠️ Low user signups - consider marketing campaigns');
  
  if (dailyJobs > 20) insights.push('📈 Healthy job posting rate from employers');
  else if (dailyJobs < 3) insights.push('⚠️ Low job postings - reach out to employers');
  
  if (apps > 0 && jobs > 0) {
    const appsPerJob = apps / jobs;
    if (appsPerJob > 5) insights.push('🎯 High application rate - jobs are attracting candidates well');
    else if (appsPerJob < 1) insights.push('⚠️ Low applications per job - improve job visibility or quality');
  }
  
  if (users > 0 && apps > 0) {
    const conversionRate = (apps / users * 100).toFixed(1);
    insights.push(`📊 User-to-application conversion: ${conversionRate}%`);
  }
  
  return insights;
}

/**
 * Get error logs and system issues for debugging
 */
export async function getSystemLogs(supabase: any, logType: string = 'all') {
  try {
    const result: any = { log_type: logType };
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    if (logType === 'errors' || logType === 'all') {
      // Get recent support tickets as error indicators
      const { data: tickets } = await supabase
        .from('support_tickets')
        .select('id, title, description, priority, status, created_at, issue_type')
        .gte('created_at', oneDayAgo)
        .order('created_at', { ascending: false })
        .limit(20);
      result.recent_tickets = tickets || [];
    }
    
    if (logType === 'api' || logType === 'all') {
      const { data: apiLogs } = await supabase
        .from('api_request_logs')
        .select('endpoint, method, status_code, response_time_ms, error_message, created_at')
        .gte('created_at', oneDayAgo)
        .order('created_at', { ascending: false })
        .limit(30);
      result.api_logs = apiLogs || [];
      
      // Error rate calculation
      const totalRequests = apiLogs?.length || 0;
      const errorRequests = apiLogs?.filter((l: any) => l.status_code >= 400).length || 0;
      result.api_error_rate = totalRequests > 0 ? `${((errorRequests / totalRequests) * 100).toFixed(1)}%` : '0%';
    }
    
    if (logType === 'admin' || logType === 'all') {
      const { data: adminLogs } = await supabase
        .from('admin_audit_logs')
        .select('action, admin_name, target_type, details, performed_at')
        .order('performed_at', { ascending: false })
        .limit(15);
      result.admin_activity = adminLogs || [];
    }
    
    if (logType === 'cleanup' || logType === 'all') {
      const { data: cleanupLogs } = await supabase
        .from('cleanup_execution_logs')
        .select('*')
        .order('executed_at', { ascending: false })
        .limit(5);
      result.cleanup_history = cleanupLogs || [];
    }
    
    if (logType === 'ai_access' || logType === 'all') {
      const { data: aiLogs } = await supabase
        .from('ai_data_access_logs')
        .select('ai_type, access_type, matched_user_name, response_time_ms, created_at')
        .gte('created_at', oneDayAgo)
        .order('created_at', { ascending: false })
        .limit(20);
      result.ai_access_logs = aiLogs || [];
    }
    
    return result;
  } catch (err: any) {
    return { error: `Log fetch failed: ${err.message}` };
  }
}
