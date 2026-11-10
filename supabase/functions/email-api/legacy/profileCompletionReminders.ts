
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { BRAND_CONFIG } from "../../_shared/brandConfig.ts";
import { fanoutLifecycleChannels } from "../../_shared/lifecycleFanout.ts";
import { buildPromoEmailGallery, buildPromoTelegramList, buildDeveloperServicesEmail, buildDeveloperServicesTelegram } from "../../_shared/resumePromoGallery.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Day-of-week rotation (0=Sun, 1=Mon, ..., 6=Sat)
const DAY_SCHEDULE: Record<number, string> = {
  0: 'off',           // Sunday - no marketing
  1: 'new_jobs',      // Monday
  2: 'tips',          // Tuesday
  3: 'trending_jobs', // Wednesday
  4: 'off',           // Thursday - inactive-user re-engagement removed
  5: 'weekly_stats',  // Friday
  6: 'new_jobs',      // Saturday
};

const BATCH_SIZE = 50;
const MAX_EMAILS_PER_DAY = 250;
const BASE_URL = BRAND_CONFIG.canonicalUrl;

export async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID().substring(0, 8);
  console.log(`[${requestId}] 🚀 Smart Marketing Engine started`);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    let body: any = {};
    try { body = await req.json(); } catch { /* empty body for cron */ }

    // ===== TEST MODE =====
    if (body?.test_email) {
      return await handleTestMode(supabase, body, requestId);
    }

    // ===== FORCE MODE (specific type) =====
    const forceType = body?.force_type;

    // Determine today's notification type
    const now = new Date();
    // Convert to IST for day calculation
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffset);
    const dayOfWeek = istNow.getUTCDay();
    const notificationType = forceType || DAY_SCHEDULE[dayOfWeek];

    if (body?.dry_run === true) {
      return jsonResponse({
        success: true,
        dry_run: true,
        notification_type: notificationType,
        matching_jobs: {
          runs_daily: true,
          min_matching_jobs: MIN_MATCHING_JOBS,
          max_jobs_per_alert: JOBS_PER_ALERT,
          jobs_posted_on: 'today_ist',
          active_within_days: 30,
          maximum_per_user_per_india_day: 1,
        },
        builder_promo: { templates: ['resume_builder_promo', 'cover_letter_builder_promo'], active_within_days: 30, once_every_days: 7, alternates: true },
        developer_promo: { template: 'developer_platform_promo', audience: 'employer', active_within_days: 30, once_every_days: 7 },
      });
    }

    // Matching jobs are checked every day, independently of the rotating
    // marketing campaign. The sender requires 5+ today-posted matches and
    // deduplicates by the India calendar day.
    const jobAlertResult = await sendNewJobsAlert(supabase, requestId, istNow);
    // Resume / Cover Letter promo: max once per 7 days per job seeker (active in last 30 days).
    const builderPromoResult = await sendBuilderPromos(supabase, requestId).catch((e: any) => { console.error('builder promo error', e?.message); return { sent: 0 }; });
    // Developer platform promo: employers only, max once per 7 days, active in last 30 days.
    await sendDeveloperPromos(supabase, requestId).catch((e: any) => { console.error('developer promo error', e?.message); return { sent: 0 }; });

    if (notificationType === 'off') {
      console.log(`[${requestId}] 📅 Sunday — no marketing today`);
      return jsonResponse({
        success: true,
        message: 'Sunday - no rotating marketing',
        type: 'off',
        matching_jobs_sent: jobAlertResult.sent,
        builder_promo_sent: builderPromoResult.sent,
      });
    }

    console.log(`[${requestId}] 📅 Today's type: ${notificationType} (day: ${dayOfWeek})`);

    // Also run profile incomplete reminders (monthly, based on creation date)
    const profileReminderCount = await runProfileReminders(supabase, requestId, istNow);

    // Run the day's marketing campaign
    let campaignResult: any = { sent: 0 };
    switch (notificationType) {
      case 'new_jobs':
        campaignResult = jobAlertResult;
        break;
      case 'tips':
        campaignResult = await sendTipsContent(supabase, requestId);
        break;
      case 'trending_jobs':
        campaignResult = await sendTrendingJobs(supabase, requestId);
        break;
      case 'weekly_stats':
        campaignResult = await sendWeeklyStats(supabase, requestId);
        break;
      case 'profile_incomplete':
        // Already handled above
        break;
    }

    console.log(`[${requestId}] ✅ Done. Campaign: ${campaignResult.sent}, Profile reminders: ${profileReminderCount}`);

    return jsonResponse({
      success: true,
      notification_type: notificationType,
      campaign_sent: campaignResult.sent,
      matching_jobs_sent: jobAlertResult.sent,
      builder_promo_sent: builderPromoResult.sent,
      profile_reminders_sent: profileReminderCount,
    });

  } catch (error: any) {
    console.error(`[${requestId}] ❌ Error:`, error.message);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

// ==================== RESUME / COVER LETTER PROMO ====================
async function sendBuilderPromos(supabase: any, reqId: string) {
  const activeSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: seekers, error } = await supabase.from('profiles')
    .select('user_id, full_name, email, telegram_chat_id')
    .gte('last_login_at', activeSince).limit(1000);
  if (error) throw error;
  let sent = 0, emails = 0;
  for (const seeker of seekers || []) {
    if (!seeker.email && !seeker.telegram_chat_id) continue;
    const { data: last } = await supabase.from('marketing_notification_logs')
      .select('content_key, sent_at').eq('user_id', seeker.user_id).eq('notification_type', 'builder_promo')
      .order('sent_at', { ascending: false }).limit(1).maybeSingle();
    if (last && last.sent_at >= weekAgo) continue; // 7-day limit
    const kind: 'resume' | 'cover' = last?.content_key === 'resume_builder_promo' ? 'cover' : 'resume';
    const templateKey = kind === 'resume' ? 'resume_builder_promo' : 'cover_letter_builder_promo';
    const varKey = kind === 'resume' ? 'resume_templates' : 'cover_templates';
    const wantsEmail = Boolean(seeker.email && emails < MAX_EMAILS_PER_DAY);
    const channels: string[] = [];
    if (wantsEmail) channels.push('email');
    if (seeker.telegram_chat_id) channels.push('telegram');
    if (!channels.length) continue;
    await logNotification(supabase, seeker.user_id, 'builder_promo', channels, templateKey); // claim first
    const name = seeker.full_name || 'Job Seeker';
    const [e] = await Promise.all([
      wantsEmail ? fanoutLifecycleChannels(supabase, { userId: seeker.user_id, templateKey, audience: 'jobseeker', channels: ['email'],
        variables: { name, [varKey]: buildPromoEmailGallery(kind, BASE_URL, BASE_URL) }, trustedHtmlVariables: [varKey] }).catch(() => null) : null,
      seeker.telegram_chat_id ? fanoutLifecycleChannels(supabase, { userId: seeker.user_id, templateKey, audience: 'jobseeker', channels: ['telegram'],
        variables: { name, [varKey]: buildPromoTelegramList(kind, BASE_URL) }, trustedHtmlVariables: [varKey] }).catch(() => null) : null,
    ]);
    if (e?.email === 'sent') emails++;
    sent++;
  }
  console.log(`[${reqId}] 📄 Builder promos sent: ${sent}`);
  return { sent };
}

// ==================== DEVELOPER PLATFORM PROMO (employers only) ====================
async function sendDeveloperPromos(supabase: any, reqId: string) {
  const activeSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: companies, error } = await supabase.from('companies')
    .select('user_id, company_name, email, telegram_chat_id').not('user_id', 'is', null).limit(1000);
  if (error) throw error;
  const ids = [...new Set((companies || []).map((c: any) => c.user_id))];
  const active = new Set<string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await supabase.from('profiles').select('user_id').in('user_id', ids.slice(i, i + 200)).gte('last_login_at', activeSince);
    (data || []).forEach((r: any) => active.add(r.user_id));
  }
  const seen = new Set<string>();
  let sent = 0;
  for (const c of companies || []) {
    if (!active.has(c.user_id) || seen.has(c.user_id)) continue;
    seen.add(c.user_id);
    if (!c.email && !c.telegram_chat_id) continue;
    const { data: last } = await supabase.from('marketing_notification_logs')
      .select('sent_at').eq('user_id', c.user_id).eq('notification_type', 'developer_promo')
      .order('sent_at', { ascending: false }).limit(1).maybeSingle();
    if (last && last.sent_at >= weekAgo) continue; // 7-day limit
    const channels: string[] = [];
    if (c.email) channels.push('email');
    if (c.telegram_chat_id) channels.push('telegram');
    await logNotification(supabase, c.user_id, 'developer_promo', channels, 'developer_platform_promo'); // claim first
    const name = c.company_name || 'there';
    const templateKey = 'developer_platform_promo';
    await Promise.all([
      c.email ? fanoutLifecycleChannels(supabase, { userId: c.user_id, templateKey, audience: 'employer', channels: ['email'],
        variables: { name, developer_services: buildDeveloperServicesEmail(BASE_URL) }, trustedHtmlVariables: ['developer_services'] }).catch(() => null) : null,
      c.telegram_chat_id ? fanoutLifecycleChannels(supabase, { userId: c.user_id, templateKey, audience: 'employer', channels: ['telegram'],
        variables: { name, developer_services: buildDeveloperServicesTelegram(BASE_URL) }, trustedHtmlVariables: ['developer_services'] }).catch(() => null) : null,
    ]);
    sent++;
  }
  console.log(`[${reqId}] 🚀 Developer promos sent: ${sent}`);
  return { sent };
}

// ==================== JOB ALERT RENDERING (Naukri style) ====================

const JOBS_PER_ALERT = 10;
// Alert goes out with 5+ profile-matched jobs posted today; up to 10 cards shown.
const MIN_MATCHING_JOBS = 5;
const escJ = (value: unknown) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const jobUrl = (job: any) => `${BASE_URL}/jobs/${encodeURIComponent(job.public_slug || job.id)}`;
const jobLocation = (job: any) => job.location || [job.city, job.state].filter(Boolean).join(', ') || 'India';
const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trim()}…` : s);
const inr = (n: number) => Math.round(n).toLocaleString('en-IN');

function jobSalary(job: any): string {
  const min = Number(job.salary_min) || 0;
  const max = Number(job.salary_max) || 0;
  const per = job.salary_period ? ` /${String(job.salary_period).replace(/ly$/i, '').toLowerCase()}` : '';
  if (min && max) return `${inr(min)}-${inr(max)}${per}`;
  if (min || max) return `${inr(min || max)}${per}`;
  return job.salary_range || 'Not disclosed';
}

function jobBadge(job: any): string {
  if (job.is_boosted) return '⚡ Urgent hiring';
  if (Number(job.openings) > 1) return `🔥 ${job.openings} Vacancies`;
  if (job.work_mode) return `🏠 ${String(job.work_mode).replace(/_/g, ' ')}`;
  return '';
}

function logoCell(job: any): string {
  const company = job.companies?.company_name || 'Company';
  const logo = normalizeEmailImageUrl(job.companies?.logo_url);
  const box = 'float:left;width:44px;height:44px;margin:0 12px 0 0;border:1px solid #e3e8f2;border-radius:8px;background:#ffffff;text-align:center;line-height:44px;font-size:20px;font-weight:700;color:#3B5CE4;';
  return logo
    ? `<div style="${box}"><img src="${escJ(logo)}" alt="${escJ(company)}" width="44" height="44" style="display:block;width:44px;height:44px;border-radius:8px;object-fit:contain;"></div>`
    : `<div style="${box}">${escJ(company.charAt(0).toUpperCase())}</div>`;
}

function normalizeEmailImageUrl(value: unknown): string {
  const raw = String(value || '').trim();
  if (!raw || raw.startsWith('data:') || raw.startsWith('blob:')) return '';
  if (raw.startsWith('//')) return `https:${raw}`;
  if (/^https?:\/\//i.test(raw)) return raw.replace(/^http:\/\//i, 'https://');
  const supabaseUrl = String(Deno.env.get('SUPABASE_URL') || '').replace(/\/$/, '');
  if (!supabaseUrl) return '';
  if (raw.startsWith('/storage/v1/')) return `${supabaseUrl}${raw}`;
  if (raw.startsWith('storage/v1/')) return `${supabaseUrl}/${raw}`;
  return `${supabaseUrl}/storage/v1/object/public/${raw.replace(/^\/+/, '')}`;
}

function buildNaukriEmailJobs(jobs: any[], total = jobs.length): string {
  const cards = jobs.map((job) => {
    const company = job.companies?.company_name || 'Verified employer';
    const badge = jobBadge(job);
    return `<div style="margin:0 0 14px;padding:16px 14px;border:1px solid #dfe3eb;border-radius:10px;background:#ffffff;">${logoCell(job)}`
      + `<div style="font-size:17px;line-height:1.3;font-weight:700;color:#0f1b33;">${escJ(cut(job.title || 'Job opening', 42))}</div>`
      + `<div style="margin-top:4px;font-size:14px;color:#4b5563;">${escJ(cut(company, 34))}</div>`
      + `<div style="clear:both;"></div>`
      + `<div style="margin-top:12px;font-size:14px;font-weight:600;color:#1f2937;">📍 ${escJ(jobLocation(job))}</div>`
      + `<div style="margin-top:8px;font-size:14px;font-weight:600;color:#1f2937;">₹ ${escJ(jobSalary(job))}</div>`
      + (badge ? `<div style="margin-top:10px;"><span style="display:inline-block;padding:6px 12px;border-radius:999px;background:#f1f3f7;font-size:13px;color:#374151;">${escJ(badge)}</span></div>` : '')
      + `<a href="${escJ(jobUrl(job))}" style="display:block;margin-top:14px;padding:11px 0;border-radius:24px;background:#eef2ff;color:#3B5CE4;text-align:center;text-decoration:none;font-size:15px;font-weight:700;">Apply</a>`
      + `</div>`;
  }).join('');

  const viewAll = `<div style="text-align:center;margin:20px 0 26px;"><a href="${BASE_URL}/jobs" style="display:inline-block;padding:13px 28px;border-radius:24px;background:#3B5CE4;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;">${total > jobs.length ? `View All ${total} Matching Jobs` : 'View all recommendations'}</a></div>`;
  const profile = `<div style="margin:0 0 8px;padding:18px 16px;border-radius:10px;background:#f5f7fb;">`
    + `<div style="font-size:18px;line-height:1.35;font-weight:700;color:#0f1b33;">Not getting jobs relevant to you? It's time to <span style="color:#e8860c;">update your profile!</span></div>`
    + `<div style="margin-top:7px;font-size:14px;line-height:1.55;color:#4b5563;">Keep your skills, preferred role and location up to date for better matches.</div>`
    + `<a href="${BASE_URL}/profile" style="display:inline-block;margin-top:14px;padding:11px 22px;border-radius:24px;background:#3B5CE4;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">Update details</a>`
    + `</div>`;
  return cards + viewAll + profile;
}

function buildTelegramJobs(jobs: any[], total = jobs.length): string {
  const more = total > jobs.length ? `\n\n━━━━━━━━━━━━\n\n👉 <a href="${BASE_URL}/jobs">View All ${total} Matching Jobs</a>` : '';
  return jobs.map((job, index) => {
    const company = job.companies?.company_name || 'Verified employer';
    const badge = jobBadge(job);
    return `<b>${index + 1}. ${escJ(cut(job.title || 'Job opening', 48))}</b>\n🏢 ${escJ(company)}\n📍 ${escJ(jobLocation(job))}\n💰 ₹ ${escJ(jobSalary(job))}${badge ? `\n${escJ(badge)}` : ''}\n👉 <a href="${escJ(jobUrl(job))}">Apply now</a>`;
  }).join('\n\n━━━━━━━━━━━━\n\n') + more;
}

// ==================== CAMPAIGN HANDLERS ====================

const JOB_LOOKBACK_DAYS = 7;
const lc = (v: unknown) => String(v ?? '').toLowerCase().trim();
const nums = (v: unknown) => (String(v ?? '').match(/\d+(\.\d+)?/g) || []).map(Number);
const STOP = new Set(['and', 'the', 'for', 'with', 'job', 'jobs', 'work', 'in', 'of', 'to', 'an']);

function tokens(values: unknown[]): string[] {
  return [...new Set(values.flatMap((v) => (Array.isArray(v) ? v : [v]))
    .flatMap((v) => lc(v).split(/[^a-z0-9+#.]+/))
    .filter((t) => t.length > 1 && !STOP.has(t)))];
}

// Returns a score > 0 when the job is relevant for this seeker, otherwise 0 (excluded).
function matchJob(job: any, seeker: any, alert: any, terms: string[], wantedLocations: string[]): number {
  const title = lc(job.title);
  const category = lc(job.category);
  const searchable = `${title} ${category} ${(job.skills || []).map(lc).join(' ')}`;
  const titleHits = terms.filter((t) => title.includes(t)).length;
  const hits = terms.filter((t) => searchable.includes(t)).length;
  const categories = (alert?.job_categories || []).map(lc).filter(Boolean);
  const categoryHit = Boolean(category) && categories.some((c: string) => category.includes(c) || c.includes(category));
  if (!hits && !categoryHit) return 0;

  // Location: remote jobs are fine everywhere; otherwise must match a wanted place (if seeker set one).
  const mode = lc(`${job.work_mode || ''} ${job.job_type || ''}`).replace(/[_-]/g, ' ');
  const remote = /remote|work from home|wfh/.test(mode);
  const place = lc(`${job.location || ''} ${job.city || ''} ${job.state || ''}`);
  const city = lc(job.city);
  const locHit = wantedLocations.some((w) => place.includes(w) || (city && w.includes(city)));
  if (wantedLocations.length && place && !remote && !locHit && !/anywhere|pan india|multiple/.test(place)) return 0;

  // Work type (full-time / part-time / internship / contract / remote).
  const wantType = lc(seeker.job_type).replace(/[_-]/g, ' ');
  if (wantType && mode) {
    if (/remote/.test(wantType) && !remote) return 0;
    for (const t of ['full time', 'part time', 'intern', 'contract', 'freelance']) {
      if (wantType.includes(t) && /full time|part time|intern|contract|freelance/.test(mode) && !mode.includes(t)) return 0;
    }
  }

  // Experience: skip jobs clearly outside the seeker's experience.
  const rawYears = seeker.experience_years ?? seeker.experience_level;
  const years = rawYears === null || rawYears === undefined ? NaN : Number(rawYears);
  const [expMin, expMax] = nums(job.experience_level);
  if (Number.isFinite(years) && expMin !== undefined) {
    if (years + 1 < expMin) return 0;
    if (expMax !== undefined && years > expMax + 5) return 0;
  }

  // Salary: if seeker set an expected range, skip jobs that pay clearly less.
  const expectedList = (alert?.salary_ranges || []).flatMap((r: unknown) => nums(r)).filter((n: number) => n > 0);
  const jobMax = Number(job.salary_max_numeric || job.salary_max) || 0;
  if (expectedList.length && jobMax) {
    const expected = Math.min(...expectedList);
    const expectedAbs = expected < 1000 ? expected * 100000 : expected; // "5 LPA" style values
    const annual = jobMax * (lc(job.salary_period).startsWith('month') ? 12 : 1);
    if (annual < expectedAbs * 0.8) return 0;
  }

  return hits * 3 + titleHits * 2 + (categoryHit ? 3 : 0) + (locHit ? 2 : 0) + (job.is_boosted ? 0.25 : 0);
}

async function sendNewJobsAlert(supabase: any, reqId: string, istNow: Date) {
  console.log(`[${reqId}] 🎯 Sending personalized matching jobs`);
  const activeSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const istDate = istNow.toISOString().slice(0, 10); // istNow is shifted to IST (Asia/Kolkata)
  const lookback = new Date(Date.now() - JOB_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: seekers, error: seekerError }, { data: jobs, error: jobsError }] = await Promise.all([
    supabase.from('profiles')
      .select('user_id, full_name, email, telegram_chat_id, skills, preferred_job_title, preferred_location, location, job_type, experience_years, experience_level')
      .gte('last_login_at', activeSince)
      .order('last_login_at', { ascending: false })
      .limit(1000),
    supabase.from('jobs')
      .select('id, title, location, city, state, salary_range, salary_min, salary_max, salary_max_numeric, salary_period, openings, work_mode, job_type, experience_level, category, skills, public_slug, created_at, is_boosted, companies(company_name, logo_url)')
      .eq('status', 'active')
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .gte('created_at', lookback)
      .order('created_at', { ascending: false })
      .limit(1000),
  ]);
  if (seekerError) throw seekerError;
  if (jobsError) throw jobsError;
  if (!seekers?.length || !jobs?.length) return { sent: 0, held: 0 };

  let sent = 0, held = 0, emailsSent = 0;
  for (const seeker of seekers) {
    try {
      const { data: today } = await supabase.from('job_alert_daily_digests')
        .select('status').eq('user_id', seeker.user_id).eq('ist_date', istDate).maybeSingle();
      if (today) continue; // already sent (or being sent) today

      const { data: alert } = await supabase.from('job_alert_preferences')
        .select('job_categories, locations, salary_ranges, email_alerts, daily_digest, is_active')
        .eq('user_id', seeker.user_id).maybeSingle();
      if (alert && (alert.is_active === false || alert.daily_digest === false)) continue;

      const terms = tokens([seeker.skills || [], seeker.preferred_job_title, alert?.job_categories || []]);
      if (!terms.length) continue; // no profile data = no reliable match
      const wantedLocations = [...(alert?.locations || []), seeker.preferred_location, seeker.location]
        .map(lc).filter((w) => w.length > 1);

      const scored = jobs
        .map((job: any) => ({ job, score: matchJob(job, seeker, alert, terms, wantedLocations) }))
        .filter((x: any) => x.score > 0);
      if (scored.length < MIN_MATCHING_JOBS) { if (scored.length) held++; continue; }

      // New jobs only: never repeat a job already sent to this user.
      const { data: already } = await supabase.from('job_alert_sent_jobs')
        .select('job_id').eq('user_id', seeker.user_id).in('job_id', scored.map((x: any) => x.job.id));
      const seen = new Set((already || []).map((r: any) => r.job_id));
      const { data: last } = await supabase.from('job_alert_daily_digests')
        .select('created_at').eq('user_id', seeker.user_id).eq('status', 'sent')
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      // Before the first digest, only today's+recent jobs count; after it, anything posted since the
      // last successful digest (unsent ones are kept, so a missed cron never loses jobs).
      const since = last?.created_at
        ? Math.min(new Date(last.created_at).getTime() - 60 * 60 * 1000, Date.now()) : new Date(lookback).getTime();
      const fresh = scored.filter((x: any) => !seen.has(x.job.id)
        && (new Date(x.job.created_at).getTime() >= Math.max(since, new Date(lookback).getTime()) || !last));
      if (fresh.length < MIN_MATCHING_JOBS) { if (fresh.length) held++; continue; }
      fresh.sort((a: any, b: any) => b.score - a.score || String(b.job.created_at).localeCompare(String(a.job.created_at)));
      const total = fresh.length;
      const shown = fresh.slice(0, JOBS_PER_ALERT).map((x: any) => x.job);

      const wantsEmail = Boolean(seeker.email && alert?.email_alerts !== false && emailsSent < MAX_EMAILS_PER_DAY);
      const wantsTelegram = Boolean(seeker.telegram_chat_id);
      if (!wantsEmail && !wantsTelegram) continue;

      // Atomic daily claim: primary key (user_id, ist_date) blocks duplicate / parallel runs.
      const { error: claimError } = await supabase.from('job_alert_daily_digests')
        .insert({ user_id: seeker.user_id, ist_date: istDate, status: 'claimed', job_count: total });
      if (claimError) continue;

      const vars = { name: seeker.full_name || 'Job Seeker', job_count: String(total) };
      const [emailResult, telegramResult] = await Promise.all([
        wantsEmail ? fanoutLifecycleChannels(supabase, {
          userId: seeker.user_id, templateKey: 'weekly_digest', audience: 'jobseeker', channels: ['email'],
          variables: { ...vars, jobs_list: buildNaukriEmailJobs(shown, total) }, trustedHtmlVariables: ['jobs_list'],
        }).catch(() => null) : null,
        wantsTelegram ? fanoutLifecycleChannels(supabase, {
          userId: seeker.user_id, templateKey: 'weekly_digest', audience: 'jobseeker', channels: ['telegram'],
          variables: { ...vars, jobs_list: buildTelegramJobs(shown, total) }, trustedHtmlVariables: ['jobs_list'],
        }).catch(() => null) : null,
      ]);
      if (emailResult?.email === 'sent') emailsSent++;
      const delivered = [emailResult?.email === 'sent' ? 'email' : '', telegramResult?.telegram === 'sent' ? 'telegram' : ''].filter(Boolean);
      if (!delivered.length) {
        // Release the claim so a later run today can retry.
        await supabase.from('job_alert_daily_digests').delete().eq('user_id', seeker.user_id).eq('ist_date', istDate);
        continue;
      }
      await supabase.from('job_alert_daily_digests')
        .update({ status: 'sent', channels: delivered, updated_at: new Date().toISOString() })
        .eq('user_id', seeker.user_id).eq('ist_date', istDate);
      await supabase.from('job_alert_sent_jobs').upsert(
        fresh.map((x: any) => ({ user_id: seeker.user_id, job_id: x.job.id, ist_date: istDate })),
        { onConflict: 'user_id,job_id', ignoreDuplicates: true });
      await logNotification(supabase, seeker.user_id, 'matching_jobs_digest', delivered);
      sent++;
    } catch (e) {
      console.error(`[${reqId}] job alert failed for ${seeker.user_id}:`, (e as Error).message);
    }
  }
  console.log(`[${reqId}] 🎯 Matching jobs sent=${sent}, held=${held}, emails=${emailsSent}`);
  return { sent, held, emails_sent: emailsSent };
}

async function sendTipsContent(supabase: any, reqId: string) {
  console.log(`[${reqId}] 💡 Sending Tips & Content`);

  // Pick least-used tip
  const { data: tip } = await supabase
    .from('marketing_content_library')
    .select('*')
    .eq('content_type', 'tip')
    .eq('is_active', true)
    .order('use_count', { ascending: true })
    .order('last_used_at', { ascending: true, nullsFirst: true })
    .limit(1)
    .maybeSingle();

  if (!tip) {
    console.log(`[${reqId}] No active tips found`);
    return { sent: 0 };
  }

  // Update use count
  await supabase.from('marketing_content_library').update({
    use_count: (tip.use_count || 0) + 1,
    last_used_at: new Date().toISOString()
  }).eq('id', tip.id);

  const telegramMsg = tip.telegram_template || `💡 *Career Tip*\n\n${tip.body_template}\n\n👉 ${BASE_URL}/jobs\n\n— ${BRAND_CONFIG.name}`;
  const pushTitle = tip.push_title || '💡 Career Tip';
  const pushBody = tip.push_body || tip.body_template.substring(0, 100);
  const emailSubject = tip.email_subject || `💡 ${tip.title} — ${BRAND_CONFIG.name}`;
  const emailHtml = tip.email_html || buildEmailHtml(
    tip.title,
    `<p>${tip.body_template}</p>`,
    'Find Your Dream Job',
    `${BASE_URL}/jobs`
  );

  return await sendToAllUsers(supabase, reqId, 'tips', {
    telegramMsg, pushTitle, pushBody, emailSubject, emailHtml,
    emailText: tip.body_template, contentKey: tip.id
  });
}

async function sendTrendingJobs(supabase: any, reqId: string) {
  console.log(`[${reqId}] 📈 Sending Trending Jobs`);

  // Get top viewed/applied jobs
  const { data: trendingJobs } = await supabase
    .from('jobs')
    .select('id, title, company_name, salary_range, views_count, slug')
    .eq('status', 'active')
    .order('views_count', { ascending: false })
    .limit(5);

  if (!trendingJobs || trendingJobs.length === 0) {
    return { sent: 0 };
  }

  const jobListText = trendingJobs.map((j: any, i: number) =>
    `${i + 1}. ${j.title} - ${j.company_name} 🔥`
  ).join('\n');

  const telegramMsg = `📈 *Trending Jobs This Week!*\n\n${jobListText}\n\n👉 Apply now: ${BASE_URL}/jobs\n\n— ${BRAND_CONFIG.name}`;
  const pushTitle = '📈 Trending Jobs This Week!';
  const pushBody = `${trendingJobs[0].title} is trending — apply now!`;
  const emailSubject = `📈 Trending Workly India Jobs This Week — ${BRAND_CONFIG.name}`;
  const emailHtml = buildEmailHtml(
    'Trending Jobs This Week',
    `<p>These jobs are getting the most attention:</p>
    <ol>${trendingJobs.map((j: any) =>
      `<li><strong>${j.title}</strong> — ${j.company_name} 🔥</li>`
    ).join('')}</ol>`,
    'View Trending Jobs',
    `${BASE_URL}/jobs`
  );

  return await sendToAllUsers(supabase, reqId, 'trending_jobs', {
    telegramMsg, pushTitle, pushBody, emailSubject, emailHtml,
    emailText: `Trending jobs this week:\n\n${jobListText}\n\nApply: ${BASE_URL}/jobs`
  });
}

async function sendReengagement(supabase: any, reqId: string) {
  console.log(`[${reqId}] 👋 Sending Re-engagement`);

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Get inactive users (last login > 7 days ago)
  const { data: inactiveUsers } = await supabase
    .from('profiles')
    .select('user_id, full_name, email, telegram_chat_id, onesignal_player_id')
    .lt('last_login_at', sevenDaysAgo)
    .not('email', 'is', null)
    .limit(200);

  if (!inactiveUsers || inactiveUsers.length === 0) {
    console.log(`[${reqId}] No inactive users found`);
    return { sent: 0 };
  }

  // Count new jobs since 7 days ago
  const { count: newJobsCount } = await supabase
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', sevenDaysAgo)
    .eq('status', 'active');

  // Pick a reengagement template
  const { data: template } = await supabase
    .from('marketing_content_library')
    .select('*')
    .eq('content_type', 'reengagement')
    .eq('is_active', true)
    .order('use_count', { ascending: true })
    .limit(1)
    .maybeSingle();

  let emailsSent = 0;
  let sent = 0;
  const today = new Date().toISOString().split('T')[0];

  for (let i = 0; i < inactiveUsers.length; i += BATCH_SIZE) {
    const batch = inactiveUsers.slice(i, i + BATCH_SIZE);

    for (const user of batch) {
      // Check if already sent today
      const { data: existing } = await supabase
        .from('marketing_notification_logs')
        .select('id')
        .eq('user_id', user.user_id)
        .gte('sent_at', `${today}T00:00:00Z`)
        .limit(1)
        .maybeSingle();

      if (existing) continue;

      const name = user.full_name || 'there';
      const vars: Record<string, string> = { name, new_jobs_count: String(newJobsCount || 0), new_companies: '5+' };
      const channelsSent: string[] = [];

      // Telegram
      if (user.telegram_chat_id) {
        const msg = replaceVars(template?.telegram_template || `👋 *We miss you, {name}!*\n\nSince your last visit:\n• {new_jobs_count} new jobs posted\n\nDon't miss out → ${BASE_URL}\n\n— ${BRAND_CONFIG.name}`, vars);
        await safeSend(supabase, 'email-api/telegram', {
          action: 'send', audience: 'job_seeker', chat_id: user.telegram_chat_id, text: msg, parse_mode: 'Markdown'
        });
        channelsSent.push('telegram');
      }

      // Push
      if (true) {
        await safeSend(supabase, 'email-api', {
          action: 'send_push', user_id: user.user_id,
          title: replaceVars(template?.push_title || '👋 We miss you!', vars),
          message: replaceVars(template?.push_body || '{new_jobs_count} new jobs since your last visit!', vars),
          action_url: '/jobs'
        });
        channelsSent.push('push');
      }

      // Email (capped)
      if (user.email && emailsSent < MAX_EMAILS_PER_DAY && !user.telegram_chat_id) {
        await safeSend(supabase, 'email-api/send-email', {
          to: user.email, toName: name,
          subject: `👋 ${name}, ${newJobsCount || 'new'} jobs waiting for you — ${BRAND_CONFIG.name}`,
          htmlContent: buildEmailHtml(
            `We miss you, ${name}!`,
            `<p>Since your last visit:</p><ul><li><strong>${newJobsCount || 0}</strong> new jobs posted</li><li>Top companies are hiring</li></ul>`,
            'Check New Jobs',
            `${BASE_URL}/jobs`
          ),
          textContent: replaceVars(template?.body_template || 'We miss you! {new_jobs_count} new jobs posted.', vars),
          audience: 'jobseeker'
        });
        channelsSent.push('email');
        emailsSent++;
      }

      if (channelsSent.length > 0) {
        await logNotification(supabase, user.user_id, 'reengagement', channelsSent, template?.id);
        sent++;
      }
    }
  }

  console.log(`[${reqId}] 👋 Re-engagement sent: ${sent}`);
  return { sent };
}

async function sendWeeklyStats(supabase: any, reqId: string) {
  console.log(`[${reqId}] 📊 Sending Weekly Stats`);

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Gather stats
  const [jobsResult, companiesResult, appsResult] = await Promise.all([
    supabase.from('jobs').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo),
    supabase.from('companies').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo),
    supabase.from('job_applications').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo),
  ]);

  const stats = {
    new_jobs: String(jobsResult.count || 0),
    new_companies: String(companiesResult.count || 0),
    applications: String(appsResult.count || 0),
  };

  const telegramMsg = `📊 *Weekly Hiring Report*\n\n🔹 ${stats.new_jobs} new jobs posted\n🔹 ${stats.new_companies} companies joined\n🔹 ${stats.applications} applications submitted\n\nThe Workly India job market is growing! 🚀\n\n👉 ${BASE_URL}/jobs\n\n— ${BRAND_CONFIG.name}`;
  const pushTitle = '📊 Weekly Report';
  const pushBody = `${stats.new_jobs} new Workly India jobs posted this week!`;
  const emailSubject = `📊 Weekly Hiring Report — ${stats.new_jobs} New Jobs — ${BRAND_CONFIG.name}`;
  const emailHtml = buildEmailHtml(
    'Weekly Hiring Report',
    `<div style="background:#f8f9fa;border-radius:8px;padding:16px;margin:16px 0;">
      <p>🔹 <strong>${stats.new_jobs}</strong> new jobs posted</p>
      <p>🔹 <strong>${stats.new_companies}</strong> companies joined</p>
      <p>🔹 <strong>${stats.applications}</strong> applications submitted</p>
    </div>
    <p>The Workly India job market is growing! 🚀</p>`,
    'Browse New Jobs',
    `${BASE_URL}/jobs`
  );

  return await sendToAllUsers(supabase, reqId, 'weekly_stats', {
    telegramMsg, pushTitle, pushBody, emailSubject, emailHtml,
    emailText: `Weekly report: ${stats.new_jobs} new jobs, ${stats.new_companies} companies, ${stats.applications} applications.`
  });
}

// ==================== PROFILE REMINDERS (existing logic) ====================

async function runProfileReminders(supabase: any, reqId: string, istNow: Date): Promise<number> {
  const todayDay = istNow.getUTCDate();
  const currentMonth = `${istNow.getUTCFullYear()}-${String(istNow.getUTCMonth() + 1).padStart(2, '0')}`;
  let totalSent = 0;

  // Job seekers
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, full_name, email, created_at, is_profile_complete, telegram_chat_id, onesignal_player_id')
    .eq('is_profile_complete', false)
    .not('email', 'is', null)
    .limit(500);

  const jobSeekers = (profiles || []).filter((p: any) => new Date(p.created_at).getUTCDate() === todayDay);

  for (const profile of jobSeekers) {
    const { data: existing } = await supabase
      .from('profile_reminder_logs')
      .select('id').eq('user_id', profile.user_id).eq('reminder_month', currentMonth).limit(1).maybeSingle();
    if (existing) continue;

    const name = profile.full_name || 'User';
    const channelsSent: string[] = [];
    const profileLink = `${BASE_URL}/profile`;
    const subject = `Complete Your Profile on ${BRAND_CONFIG.name}`;
    const textMsg = `Hi ${name},\n\nYour profile is incomplete. Complete it for 3x more visibility.\n\n→ ${profileLink}\n\n— ${BRAND_CONFIG.name}`;
    const htmlContent = buildEmailHtml('Complete Your Profile', `<p>Hi <strong>${name}</strong>,</p><p>Your profile is <strong>incomplete</strong>. Complete it for <strong>3x more visibility</strong> to employers.</p>`, 'Complete Your Profile', profileLink);

    const promises: Promise<any>[] = [];
    // Saved templates (Email + Telegram) — hardcoded text is only a fallback.
    promises.push(
      fanoutLifecycleChannels(supabase, {
        userId: profile.user_id,
        templateKey: 'profile_incomplete_job_seeker',
        variables: { name, link: profileLink },
        channels: ['email', 'telegram'],
        audience: 'jobseeker',
        fallbackTitle: 'Complete Your Profile',
        fallbackMessage: textMsg,
      }).then((res: any) => {
        if (res?.email === 'sent') channelsSent.push('email');
        if (res?.telegram === 'sent') channelsSent.push('telegram');
      }).catch(() => {}),
    );
    promises.push(safeSend(supabase, 'email-api', { action: 'send_push', user_id: profile.user_id, event_type: 'profile_incomplete_job_seeker', variables: { name, link: profileLink }, title: '📋 Complete Your Profile', message: 'Complete your profile for better visibility!', action_url: '/profile' }).then(() => channelsSent.push('push')));
    await Promise.allSettled(promises);

    if (channelsSent.length > 0) {
      await supabase.from('profile_reminder_logs').insert({ user_id: profile.user_id, user_type: 'jobseeker', channels_sent: channelsSent, reminder_month: currentMonth });
      totalSent++;
    }
  }

  // Employers
  const { data: companies } = await supabase
    .from('companies')
    .select('user_id, company_name, email, created_at, is_profile_complete, telegram_chat_id, onesignal_player_id')
    .eq('is_profile_complete', false)
    .not('email', 'is', null)
    .limit(500);

  const employers = (companies || []).filter((c: any) => new Date(c.created_at).getUTCDate() === todayDay);

  for (const company of employers) {
    const { data: existing } = await supabase
      .from('profile_reminder_logs')
      .select('id').eq('user_id', company.user_id).eq('reminder_month', currentMonth).limit(1).maybeSingle();
    if (existing) continue;

    const name = company.company_name || 'Employer';
    const channelsSent: string[] = [];
    const profileLink = `${BASE_URL}/employer-portal`;
    const subject = `Complete Your Company Profile on ${BRAND_CONFIG.name}`;
    const textMsg = `Hi ${name},\n\nYour company profile is incomplete. Complete it to attract better candidates.\n\n→ ${profileLink}\n\n— ${BRAND_CONFIG.name}`;
    const htmlContent = buildEmailHtml('Complete Your Company Profile', `<p>Hi <strong>${name}</strong>,</p><p>Complete your profile to build trust and attract better candidates.</p>`, 'Complete Company Profile', profileLink);

    const promises: Promise<any>[] = [];
    promises.push(
      fanoutLifecycleChannels(supabase, {
        userId: company.user_id,
        templateKey: 'profile_incomplete_employer',
        variables: { name, company: name, link: profileLink },
        channels: ['email', 'telegram'],
        audience: 'employer',
        fallbackTitle: 'Complete Your Company Profile',
        fallbackMessage: textMsg,
      }).then((res: any) => {
        if (res?.email === 'sent') channelsSent.push('email');
        if (res?.telegram === 'sent') channelsSent.push('telegram');
      }).catch(() => {}),
    );
    promises.push(safeSend(supabase, 'email-api', { action: 'send_push', user_id: company.user_id, event_type: 'profile_incomplete_employer', variables: { name, company: name, link: profileLink }, title: '🏢 Complete Company Profile', message: 'Complete your profile to attract better candidates!', action_url: '/employer-portal' }).then(() => channelsSent.push('push')));
    await Promise.allSettled(promises);

    if (channelsSent.length > 0) {
      await supabase.from('profile_reminder_logs').insert({ user_id: company.user_id, user_type: 'employer', channels_sent: channelsSent, reminder_month: currentMonth });
      totalSent++;
    }
  }

  console.log(`[${reqId}] 📋 Profile reminders sent: ${totalSent}`);
  return totalSent;
}

// ==================== SEND TO ALL USERS (bulk) ====================

async function sendToAllUsers(supabase: any, reqId: string, type: string, content: any) {
  const today = new Date().toISOString().split('T')[0];
  let emailsSent = 0;
  let totalSent = 0;

  // Get all users with notification channels
  const { data: users } = await supabase
    .from('profiles')
    .select('user_id, full_name, email, telegram_chat_id, onesignal_player_id')
    .not('email', 'is', null)
    .limit(500);

  if (!users || users.length === 0) return { sent: 0 };

  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batch = users.slice(i, i + BATCH_SIZE);

    for (const user of batch) {
      // Deduplicate: check if already sent this type today
      const { data: existing } = await supabase
        .from('marketing_notification_logs')
        .select('id')
        .eq('user_id', user.user_id)
        .eq('notification_type', type)
        .gte('sent_at', `${today}T00:00:00Z`)
        .limit(1)
        .maybeSingle();

      if (existing) continue;

      const channelsSent: string[] = [];

      // Telegram (priority — free & unlimited)
      if (user.telegram_chat_id) {
        await safeSend(supabase, 'email-api/telegram', {
          action: 'send', audience: 'job_seeker', chat_id: user.telegram_chat_id, text: content.telegramMsg, parse_mode: 'Markdown'
        });
        channelsSent.push('telegram');
      }

      // Push (free & unlimited)
      if (true) {
        await safeSend(supabase, 'email-api', {
          action: 'send_push', user_id: user.user_id,
          title: content.pushTitle, message: content.pushBody, action_url: '/jobs'
        });
        channelsSent.push('push');
      }

      // Email (capped, only if no Telegram to save quota)
      if (user.email && emailsSent < MAX_EMAILS_PER_DAY && !user.telegram_chat_id) {
        await safeSend(supabase, 'email-api/send-email', {
          to: user.email, toName: user.full_name || 'User',
          subject: content.emailSubject, htmlContent: content.emailHtml,
          textContent: content.emailText || '', audience: 'jobseeker'
        });
        channelsSent.push('email');
        emailsSent++;
      }

      if (channelsSent.length > 0) {
        await logNotification(supabase, user.user_id, type, channelsSent, content.contentKey);
        totalSent++;
      }
    }
  }

  console.log(`[${reqId}] 📤 ${type}: sent=${totalSent}, emails=${emailsSent}`);
  return { sent: totalSent, emails_sent: emailsSent };
}

// ==================== TEST MODE HANDLER ====================

async function handleTestMode(supabase: any, body: any, reqId: string) {
  const { test_email, test_type } = body;
  console.log(`[${reqId}] 🧪 TEST MODE: ${test_email}, type: ${test_type || 'both'}`);

  const { data: profile } = await supabase.from('profiles').select('user_id, full_name, email, telegram_chat_id, onesignal_player_id').eq('email', test_email).maybeSingle();
  const { data: company } = await supabase.from('companies').select('user_id, company_name, email, telegram_chat_id, onesignal_player_id').eq('email', test_email).maybeSingle();
  const user = profile || company;

  if (!user) {
    return jsonResponse({ success: false, error: `User not found: ${test_email}` });
  }

  const name = profile?.full_name || company?.company_name || 'User';
  // Test send bhi usi side ke mailbox/bot se jaata hai jis side ka account mila.
  const testAudienceEmail: 'jobseeker' | 'employer' = profile ? 'jobseeker' : 'employer';
  const testAudienceTelegram: 'job_seeker' | 'employer' = profile ? 'job_seeker' : 'employer';
  const channelsSent: string[] = [];

  if (!test_type || test_type === 'reminder' || test_type === 'both') {
    const profileLink = `${BASE_URL}/profile`;
    const subject = `📋 Complete Your Profile on ${BRAND_CONFIG.name}`;
    const textMsg = `Hi ${name},\n\nYour profile is incomplete. Complete it for 3x more visibility.\n\n→ ${profileLink}\n\n— ${BRAND_CONFIG.name}`;
    const htmlContent = buildEmailHtml('Complete Your Profile', `<p>Hi <strong>${name}</strong>,</p><p>Your profile is <strong>incomplete</strong>. Complete profiles get <strong>3x more visibility</strong>.</p>`, 'Complete Your Profile', profileLink);

    const p: Promise<any>[] = [];
    p.push(safeSend(supabase, 'email-api/send-email', { to: test_email, toName: name, subject, htmlContent, textContent: textMsg, audience: testAudienceEmail }).then(() => channelsSent.push('reminder_email')));
    if (user.telegram_chat_id) p.push(safeSend(supabase, 'email-api/telegram', { action: 'send', audience: testAudienceTelegram, chat_id: user.telegram_chat_id, text: `📋 *Profile Incomplete*\n\n${textMsg}`, parse_mode: 'Markdown' }).then(() => channelsSent.push('reminder_telegram')));
    if (true) p.push(safeSend(supabase, 'email-api', { action: 'send_push', user_id: user.user_id, event_type: 'profile_incomplete_job_seeker', variables: { name, link: profileLink }, title: '📋 Complete Profile', message: 'Complete your profile for better visibility!', action_url: '/profile' }).then(() => channelsSent.push('reminder_push')));
    await Promise.allSettled(p);
  }

  if (test_type === 'block' || test_type === 'both') {
    const supportEmail = BRAND_CONFIG.supportEmail;
    const blockSubject = `⚠️ Account Restricted — ${BRAND_CONFIG.name}`;
    const blockText = `Dear ${name},\n\nYour account (${test_email}) has been restricted due to duplicate account detection.\n\nContact us: ${supportEmail}\n\n— ${BRAND_CONFIG.name} Security`;
    const blockHtml = buildEmailHtml('⚠️ Account Restricted', `<p>Dear <strong>${name}</strong>,</p><p>Your account has been restricted due to duplicate account detection.</p><p>Contact us: <a href="mailto:${supportEmail}">${supportEmail}</a></p>`, 'Contact Support', `mailto:${supportEmail}`);

    const p: Promise<any>[] = [];
    p.push(safeSend(supabase, 'email-api/send-email', { to: test_email, toName: name, subject: blockSubject, htmlContent: blockHtml, textContent: blockText }).then(() => channelsSent.push('block_email')));
    if (user.telegram_chat_id) p.push(safeSend(supabase, 'email-api/telegram', { action: 'send', audience: testAudienceTelegram, chat_id: user.telegram_chat_id, text: `⚠️ *Account Restricted*\n\n${blockText}`, parse_mode: 'Markdown' }).then(() => channelsSent.push('block_telegram')));
    await Promise.allSettled(p);
  }

  return jsonResponse({ success: true, test_mode: true, name, channels_sent: channelsSent });
}

// ==================== UTILITIES ====================

function buildEmailHtml(title: string, bodyContent: string, ctaText: string, ctaUrl: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
    <div style="text-align:center;margin-bottom:24px;">
      <h1 style="color:#1a1a2e;margin:0;font-size:24px;">${BRAND_CONFIG.name}</h1>
      <p style="color:#666;margin:4px 0;font-size:13px;">${BRAND_CONFIG.tagline}</p>
    </div>
    <h2 style="color:#333;">${title}</h2>
    ${bodyContent}
    <div style="text-align:center;margin:24px 0;">
      <a href="${ctaUrl}" style="display:inline-block;background:#4CAF50;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;">${ctaText}</a>
    </div>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
    <p style="color:#999;font-size:12px;text-align:center;">— ${BRAND_CONFIG.messageFooter}</p>
  </div>`;
}

function replaceVars(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return result;
}

async function safeSend(supabase: any, fn: string, body: any): Promise<void> {
  try {
    await supabase.functions.invoke(fn, { body });
  } catch (e: any) {
    console.error(`safeSend ${fn} error:`, e.message);
  }
}

async function logNotification(supabase: any, userId: string, type: string, channels: string[], contentKey?: string) {
  try {
    await supabase.from('marketing_notification_logs').insert({
      user_id: userId,
      notification_type: type,
      channels_sent: channels,
      content_key: contentKey || null,
    });
  } catch (e: any) {
    console.error('Log error:', e);
  }
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Content-Type': 'application/json' },
  });
}
