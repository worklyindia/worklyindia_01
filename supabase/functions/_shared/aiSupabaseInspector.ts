/**
 * AI Supabase Inspector
 * =====================
 * Yeh helper AI ko Supabase ka FULL A-Z context deta hai taaki AI samjh sake
 * user ke saath kya issue ho raha hai aur sahi solution suggest kar sake.
 *
 * Capabilities:
 *  1. User ka complete state (profile, company, wallet, subscriptions, recent activity)
 *  2. Recent edge function logs (errors, warnings) — via analytics
 *  3. Recent failed API requests / DB errors related to this user
 *  4. Email send log (last 7 days for this user)
 *  5. Telegram/WhatsApp linkage status
 *  6. AI chat usage + plan info
 *  7. Last app errors (from api_request_logs / cleanup_logs)
 *
 * Output: A compact JSON-style "diagnostic snapshot" string injectable into
 * the AI prompt as system context. Truncated to stay within token limits.
 */

const MAX_CONTEXT_CHARS = 6000;

export interface DiagnosticSnapshot {
  summary: string;       // Human-readable Hinglish summary for AI
  raw: Record<string, any>; // Full data (for logging/debug)
  hasIssues: boolean;
  issueHints: string[];  // Quick problem hints AI can mention
}

/**
 * Build a complete diagnostic snapshot for a given user.
 * Safe for unlinked users (returns minimal snapshot).
 */
export async function buildUserDiagnosticSnapshot(
  supabase: any,
  userId: string | null | undefined,
  opts: { channel?: 'telegram' | 'whatsapp' | 'email'; identifier?: string } = {}
): Promise<DiagnosticSnapshot> {
  const raw: Record<string, any> = {};
  const issueHints: string[] = [];

  if (!userId) {
    return {
      summary: `User unlinked (channel: ${opts.channel ?? 'unknown'}, id: ${opts.identifier ?? 'n/a'}). Account link karne ke liye web pe login + ${opts.channel ?? 'channel'} connect karna padega.`,
      raw: { unlinked: true },
      hasIssues: true,
      issueHints: ['account_not_linked'],
    };
  }

  // Run all lookups in parallel
  const [
    profileRes, companyRes, walletRes, subRes, usageRes, planRes,
    recentJobsRes, recentAppsRes, recentEmailsRes, recentApiErrorsRes,
    engagementRes, outboundEventsRes,
  ] = await Promise.all([
    supabase.from('profiles').select('id,full_name,email,phone,created_at,profile_completion_percentage,is_verified,account_status').eq('id', userId).maybeSingle(),
    supabase.from('companies').select('id,company_name,is_verified,account_status,job_posting_visibility,verified_plan_end,telegram_chat_id,whatsapp_verified').eq('user_id', userId).maybeSingle(),
    supabase.from('user_wallets').select('balance,total_earned,total_withdrawn').eq('user_id', userId).maybeSingle().then((r: any) => r).catch(() => ({ data: null })),
    supabase.from('ai_chat_subscriptions').select('plan_id,status,starts_at,ends_at').eq('user_id', userId).eq('status', 'active').order('ends_at', { ascending: false }).limit(1).maybeSingle().then((r: any) => r).catch(() => ({ data: null })),
    supabase.from('ai_chat_usage').select('messages_count,image_analysis_count,voice_input_count,date').eq('user_id', userId).order('date', { ascending: false }).limit(7),
    supabase.from('ai_chat_plans').select('name,messages_per_month').limit(20),
    supabase.from('jobs').select('id,title,status,created_at').eq('posted_by', userId).order('created_at', { ascending: false }).limit(3).then((r: any) => r).catch(() => ({ data: null })),
    supabase.from('job_applications').select('id,status,applied_at,job_id').eq('applicant_id', userId).order('applied_at', { ascending: false }).limit(3).then((r: any) => r).catch(() => ({ data: null })),
    supabase.from('email_send_log').select('template_name,status,error_message,created_at').eq('recipient_email', '').limit(0).then(() => ({ data: null })).catch(() => ({ data: null })), // placeholder, filled below
    supabase.from('api_request_logs').select('endpoint,status_code,error_message,created_at').gte('status_code', 400).order('created_at', { ascending: false }).limit(5).then((r: any) => r).catch(() => ({ data: null })),
    supabase.from('user_engagement_state').select('preferred_channel,is_unsubscribed,bounce_count,last_opened_at,last_clicked_at').eq('user_id', userId).maybeSingle().then((r: any) => r).catch(() => ({ data: null })),
    supabase.from('email_outbound_events').select('event_type,created_at').eq('matched_user_id', userId).order('created_at', { ascending: false }).limit(5).then((r: any) => r).catch(() => ({ data: null })),
  ]);

  raw.profile = profileRes?.data ?? null;
  raw.company = companyRes?.data ?? null;
  raw.wallet = walletRes?.data ?? null;
  raw.active_subscription = subRes?.data ?? null;
  raw.recent_ai_usage = usageRes?.data ?? [];
  raw.recent_jobs = recentJobsRes?.data ?? [];
  raw.recent_applications = recentAppsRes?.data ?? [];
  raw.recent_api_errors = recentApiErrorsRes?.data ?? [];
  raw.engagement = engagementRes?.data ?? null;
  raw.recent_email_events = outboundEventsRes?.data ?? [];

  // Fetch real email log by recipient (need email first)
  const email = profileRes?.data?.email || companyRes?.data?.email;
  if (email) {
    try {
      const { data: emailLogs } = await supabase
        .from('email_send_log')
        .select('template_name,status,error_message,created_at')
        .eq('recipient_email', email)
        .order('created_at', { ascending: false })
        .limit(5);
      raw.recent_emails = emailLogs ?? [];
    } catch { raw.recent_emails = []; }
  }

  // Issue detection
  if (raw.profile?.account_status && raw.profile.account_status !== 'active') {
    issueHints.push(`profile_${raw.profile.account_status}`);
  }
  if (raw.company?.account_status && raw.company.account_status !== 'active') {
    issueHints.push(`company_${raw.company.account_status}`);
  }
  if (raw.engagement?.is_unsubscribed) issueHints.push('email_unsubscribed');
  if ((raw.engagement?.bounce_count ?? 0) > 0) issueHints.push('email_bounced');
  if ((raw.recent_api_errors?.length ?? 0) > 0) issueHints.push('recent_api_errors');
  if (!raw.profile && !raw.company) issueHints.push('no_profile_or_company');
  if (raw.profile && (raw.profile.profile_completion_percentage ?? 0) < 50) {
    issueHints.push('profile_incomplete');
  }

  // Build compact Hinglish summary for AI
  const lines: string[] = [];
  lines.push(`=== USER DIAGNOSTIC SNAPSHOT ===`);
  lines.push(`User ID: ${userId}`);
  if (raw.profile) {
    lines.push(`Profile: ${raw.profile.full_name || 'N/A'} | ${raw.profile.email || 'no-email'} | status=${raw.profile.account_status} | completion=${raw.profile.profile_completion_percentage ?? 0}%`);
  }
  if (raw.company) {
    lines.push(`Company: ${raw.company.company_name} | verified=${raw.company.is_verified} | status=${raw.company.account_status} | jobs_visible=${raw.company.job_posting_visibility}`);
    if (raw.company.verified_plan_end) lines.push(`  Verified plan ends: ${raw.company.verified_plan_end}`);
  }
  if (raw.wallet) lines.push(`Wallet: ₹${raw.wallet.balance} (earned ₹${raw.wallet.total_earned})`);
  if (raw.active_subscription) {
    lines.push(`AI Plan: active till ${raw.active_subscription.ends_at}`);
  } else {
    lines.push(`AI Plan: Free`);
  }
  if (raw.recent_ai_usage?.length) {
    const todayUsage = raw.recent_ai_usage[0];
    lines.push(`Today AI usage: ${todayUsage.messages_count ?? 0} msgs, ${todayUsage.voice_input_count ?? 0} voice, ${todayUsage.image_analysis_count ?? 0} img`);
  }
  if (raw.recent_jobs?.length) {
    lines.push(`Recent jobs posted: ${raw.recent_jobs.map((j: any) => `"${j.title}"(${j.status})`).join(', ')}`);
  }
  if (raw.recent_applications?.length) {
    lines.push(`Recent applications: ${raw.recent_applications.length} (latest status: ${raw.recent_applications[0].status})`);
  }
  if (raw.recent_emails?.length) {
    const failed = raw.recent_emails.filter((e: any) => ['dlq', 'failed', 'bounced'].includes(e.status));
    lines.push(`Email log (last 5): ${raw.recent_emails.length} sends, ${failed.length} failed`);
    if (failed.length > 0) lines.push(`  Last error: ${failed[0].error_message?.slice(0, 100) ?? 'n/a'}`);
  }
  if (raw.engagement) {
    lines.push(`Engagement: pref=${raw.engagement.preferred_channel ?? 'auto'}, unsub=${raw.engagement.is_unsubscribed}, bounces=${raw.engagement.bounce_count ?? 0}`);
  }
  if (raw.recent_api_errors?.length) {
    lines.push(`⚠️ Recent API errors (${raw.recent_api_errors.length}):`);
    for (const e of raw.recent_api_errors.slice(0, 3)) {
      lines.push(`  - ${e.endpoint} → ${e.status_code} ${e.error_message?.slice(0, 80) ?? ''}`);
    }
  }
  if (issueHints.length) {
    lines.push(`🚨 Detected issues: ${issueHints.join(', ')}`);
  } else {
    lines.push(`✅ No critical issues detected`);
  }
  lines.push(`=== END SNAPSHOT ===`);

  let summary = lines.join('\n');
  if (summary.length > MAX_CONTEXT_CHARS) {
    summary = summary.slice(0, MAX_CONTEXT_CHARS) + '\n...[truncated]';
  }

  return {
    summary,
    raw,
    hasIssues: issueHints.length > 0,
    issueHints,
  };
}

/**
 * Fetch recent edge function errors (last 1 hour) across the platform.
 * Useful when user reports "kuch kaam nahi kar raha" — AI can check if
 * there's a platform-wide outage.
 */
export async function fetchRecentPlatformErrors(supabase: any): Promise<string> {
  try {
    const { data: apiErrors } = await supabase
      .from('api_request_logs')
      .select('endpoint,status_code,error_message,created_at')
      .gte('status_code', 500)
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(10);

    const { data: healthChecks } = await supabase
      .from('api_health_checks')
      .select('endpoint,is_healthy,error_message,checked_at')
      .eq('is_healthy', false)
      .gte('checked_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .order('checked_at', { ascending: false })
      .limit(5);

    const lines: string[] = ['=== PLATFORM HEALTH (last 1h) ==='];
    if (!apiErrors?.length && !healthChecks?.length) {
      lines.push('✅ No platform errors detected.');
    } else {
      if (apiErrors?.length) {
        lines.push(`API 5xx errors: ${apiErrors.length}`);
        for (const e of apiErrors.slice(0, 3)) {
          lines.push(`  - ${e.endpoint} → ${e.status_code}`);
        }
      }
      if (healthChecks?.length) {
        lines.push(`Unhealthy endpoints: ${healthChecks.map((h: any) => h.endpoint).join(', ')}`);
      }
    }
    return lines.join('\n');
  } catch (e: any) {
    return `Platform health check failed: ${e?.message}`;
  }
}
