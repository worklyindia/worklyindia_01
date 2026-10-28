import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { WEBSITE_DOMAIN, getIndexNowHost } from "../_shared/domain.ts";

/**
 * UNIFIED SEO API - Consolidated Edge Function
 * 
 * Replaces: seo-auto-submit, seo-daily-report, seo-telegram-alert, sitemap-ping,
 *           scheduled-indexing, process-indexing-queue, check-indexing-status, 
 *           verify-indexing-status, job-indexing-webhook
 * 
 * Actions: auto-submit, daily-report, telegram-alert, sitemap-ping, scheduled,
 *          process-queue, check-status, verify-status, job-webhook
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SITE_URL = WEBSITE_DOMAIN;
const INDEXNOW_HOST = getIndexNowHost();
const INDEXNOW_KEY = Deno.env.get('INDEXNOW_KEY') || 'wfhindia2025indexnowkey';
const DAILY_QUOTA_LIMIT = 200;
const QUOTA_BUFFER = 20;
const EFFECTIVE_LIMIT = DAILY_QUOTA_LIMIT - QUOTA_BUFFER;

// Static pages configuration
const STATIC_PAGES = [
  { path: '/', priority: 10 },
  { path: '/jobs', priority: 10 },
  { path: '/jobs?tab=latest', priority: 9 },
  { path: '/jobs?tab=trending', priority: 9 },
  { path: '/hot-leads', priority: 8 },
  { path: '/blog', priority: 8 },
  { path: '/hiring-companies', priority: 7 },
  { path: '/company-directory', priority: 7 },
  { path: '/employer-auth', priority: 6 },
  { path: '/disclaimer', priority: 5 },
  { path: '/privacy-policy', priority: 5 },
  { path: '/terms-of-service', priority: 5 },
  { path: '/about', priority: 5 },
  { path: '/contact', priority: 5 }
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // ============ SHARE-PREVIEW (live OG meta for social crawlers) ============
  // GET requests with ?share=1 or ?action=share-preview return an HTML shell with
  // live brand-asset OG tags pulled from get_brand_assets. Humans get a 302
  // redirect to the real page. Use this URL on social posts to get fresh previews
  // without needing to redeploy index.html on every brand upload.
  {
    const url = new URL(req.url);
    const shareMode = url.searchParams.get('share') === '1' ||
                      url.searchParams.get('action') === 'share-preview';
    if (req.method === 'GET' && shareMode) {
      return await handleSharePreview(req, url);
    }
  }

  const startTime = Date.now();
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'auto-submit';

    console.log(`[Unified SEO API] Action: ${action}`);

    let result: any = { action };

    switch (action) {
      case 'auto-submit':
        result = await handleAutoSubmit(supabase, body);
        break;
      case 'daily-report':
        result = await handleDailyReport(supabase, body);
        break;
      case 'telegram-alert':
        result = await handleTelegramAlert(supabase, body);
        break;
      case 'sitemap-ping':
        result = await handleSitemapPing(supabase, body);
        break;
      case 'scheduled':
        result = await handleScheduledIndexing(supabase, body);
        break;
      case 'process-queue':
        result = await handleProcessQueue(supabase, body);
        break;
      case 'check-status':
        result = await handleCheckStatus(supabase, body);
        break;
      case 'verify-status':
        result = await handleVerifyStatus(supabase, body);
        break;
      case 'job-webhook':
        result = await handleJobWebhook(supabase, body);
        break;
      default:
        result = { error: `Unknown action: ${action}` };
    }

    const duration = Date.now() - startTime;
    console.log(`[Unified SEO API] ${action} completed in ${duration}ms`);

    return new Response(JSON.stringify({ ...result, duration_ms: duration }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('[Unified SEO API] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// ============ AUTO SUBMIT (from seo-auto-submit) ============
async function handleAutoSubmit(supabase: any, body: any) {
  const { urls, trigger, jobId, blogSlug, useGoogleApi = false } = body;
  
  let urlsToSubmit: string[] = [];

  if (urls && Array.isArray(urls)) {
    urlsToSubmit = urls;
  } else if (trigger === 'static-pages') {
    urlsToSubmit = STATIC_PAGES.map(page => `${SITE_URL}${page.path}`);
  } else if (jobId) {
    const { data: job } = await supabase
      .from('jobs')
      .select('id, slug, public_slug')
      .eq('id', jobId)
      .single();

    if (job) {
      urlsToSubmit.push(`${SITE_URL}/job/${job.public_slug || job.slug || job.id}`);
    }
  } else if (blogSlug) {
    urlsToSubmit.push(`${SITE_URL}/blog/${blogSlug}`);
  } else if (trigger === 'scheduled') {
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

    const { data: recentJobs } = await supabase
      .from('jobs')
      .select('id, slug, public_slug')
      .eq('status', 'active')
      .gte('created_at', sixHoursAgo)
      .limit(50);

    if (recentJobs) {
      urlsToSubmit.push(...recentJobs.map((job: any) => 
        `${SITE_URL}/job/${job.public_slug || job.slug || job.id}`
      ));
    }

    urlsToSubmit.push(`${SITE_URL}/`, `${SITE_URL}/jobs`);
  }

  urlsToSubmit = [...new Set(urlsToSubmit)];

  if (urlsToSubmit.length === 0) {
    return { success: true, message: 'No URLs to submit', submitted: 0 };
  }

  const results = { indexnow: { success: false, bing_status: 0, yandex_status: 0 } };

  try {
    const bingResponse = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: INDEXNOW_HOST,
        key: INDEXNOW_KEY,
        keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
        urlList: urlsToSubmit.slice(0, 100)
      }),
    });

    const yandexResponse = await fetch('https://yandex.com/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: INDEXNOW_HOST,
        key: INDEXNOW_KEY,
        keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
        urlList: urlsToSubmit.slice(0, 100)
      }),
    });

    results.indexnow = {
      success: bingResponse.ok || yandexResponse.ok,
      bing_status: bingResponse.status,
      yandex_status: yandexResponse.status
    };
  } catch (e) {
    console.error('[Auto Submit] IndexNow error:', e);
  }

  return {
    success: true,
    submitted: urlsToSubmit.length,
    urls: urlsToSubmit.slice(0, 10),
    results
  };
}

// ============ DAILY REPORT (from seo-daily-report) ============
async function handleDailyReport(supabase: any, body: any) {
  const { type = 'daily' } = body;
  
  // Use telegram-alert action for reports
  const result = await handleTelegramAlert(supabase, { 
    type: type === 'weekly' ? 'weekly_report' : 'daily_report' 
  });
  
  return { ...result, type };
}

// ============ TELEGRAM ALERT (from seo-telegram-alert) ============
async function handleTelegramAlert(supabase: any, body: any) {
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!botToken) {
    return { success: false, error: 'Bot not configured' };
  }

  const { type, message, data } = body;

  const { data: ownerProfile } = await supabase
    .from('profiles')
    .select('telegram_id')
    .eq('email', 'gohilvishal7600@gmail.com')
    .maybeSingle();

  let telegramId = ownerProfile?.telegram_id;

  if (!telegramId) {
    const { data: company } = await supabase
      .from('companies')
      .select('telegram_id')
      .not('telegram_id', 'is', null)
      .limit(1)
      .maybeSingle();
    telegramId = company?.telegram_id;
  }

  if (!telegramId) {
    return { success: false, error: 'Owner Telegram not connected', skipped: true };
  }

  let alertMessage = '';
  const today = new Date().toISOString().split('T')[0];

  switch (type) {
    case 'daily_report':
      alertMessage = await generateDailyReport(supabase, today);
      break;
    case 'weekly_report':
      alertMessage = await generateWeeklyReport(supabase);
      break;
    case 'error':
      alertMessage = `🚨 *SEO Error Alert*\n\n${escapeMarkdown(message || 'Unknown error')}\n\n_${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}_`;
      break;
    case 'quota_warning':
      alertMessage = `⚠️ *Quota Warning*\n\nGoogle Indexing API quota is ${data?.percentage || 80}% used!\n\nUsed: ${data?.used || 0} / ${data?.limit || 200}`;
      break;
    case 'test':
      alertMessage = `✅ *SEO Alert Test*\n\n${escapeMarkdown(message || 'Test successful!')}`;
      break;
    default:
      alertMessage = `📊 *SEO Alert*\n\n${escapeMarkdown(message || 'No message')}`;
  }

  const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: telegramId,
      text: alertMessage,
      parse_mode: 'Markdown',
      disable_web_page_preview: true
    })
  });

  const telegramResult = await telegramResponse.json();

  if (!telegramResult.ok) {
    return { success: false, error: telegramResult.description };
  }

  return { success: true, message_id: telegramResult.result?.message_id };
}

// ============ SITEMAP PING (from sitemap-ping) ============
async function handleSitemapPing(supabase: any, body: any) {
  const { mode = 'sitemap', jobId, jobSlug } = body;
  
  if (mode === 'job' && (jobId || jobSlug)) {
    const jobUrl = jobSlug ? `${SITE_URL}/job/${jobSlug}` : `${SITE_URL}/job/${jobId}`;
    return await pingSingleUrl(jobUrl);
  }

  const sitemaps = [
    `${SITE_URL}/sitemap-index.xml`,
    `${SITE_URL}/sitemap.xml`,
    `${SITE_URL}/jobs-sitemap.xml`
  ];

  const results = { google: { success: 0 }, bing: { success: 0 } };

  for (const sitemap of sitemaps) {
    try {
      const googleRes = await fetch(`https://www.google.com/ping?sitemap=${encodeURIComponent(sitemap)}`);
      if (googleRes.ok) results.google.success++;
      
      const bingRes = await fetch(`https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemap)}`);
      if (bingRes.ok) results.bing.success++;
    } catch (e) {
      console.error('Sitemap ping error:', e);
    }
  }

  return { success: true, results };
}

// ============ SCHEDULED INDEXING (from scheduled-indexing) ============
async function handleScheduledIndexing(supabase: any, body: any) {
  const { type = 'batch', hours = 2 } = body;
  
  switch (type) {
    case 'quota-reset':
      return await processQuotaResetQueue(supabase);
    case 'status':
      return await getQueueStatus(supabase);
    case 'batch':
      return await processBatchIndexing(supabase, hours);
    case 'static-pages':
      return await indexStaticPages(supabase);
    default:
      return await processBatchIndexing(supabase, hours);
  }
}

// ============ PROCESS QUEUE (from process-indexing-queue) ============
async function handleProcessQueue(supabase: any, body: any) {
  const triggeredBy = body?.triggered_by || 'manual';
  
  const quotaInfo = await getQuotaInfo(supabase);
  let remainingQuota = EFFECTIVE_LIMIT - quotaInfo.quota_used;

  const { count: totalPending } = await supabase
    .from('google_indexing_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')
    .lt('retry_count', 5);

  // Process IndexNow for all unsubmitted items
  const indexNowResult = await processIndexNowPending(supabase);

  if (remainingQuota <= 0) {
    return {
      processed: 0,
      successCount: 0,
      failedCount: 0,
      indexnow_processed: indexNowResult.count,
      total_pending: totalPending || 0,
      message: 'No quota remaining'
    };
  }

  // Get pending items in FIFO order
  const { data: pendingItems } = await supabase
    .from('google_indexing_queue')
    .select('*')
    .eq('status', 'pending')
    .lt('retry_count', 5)
    .order('queue_position', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(Math.min(remainingQuota, 180));

  if (!pendingItems || pendingItems.length === 0) {
    return { 
      processed: 0, 
      successCount: 0,
      indexNowCount: indexNowResult.count,
      message: 'No pending items'
    };
  }

  let successCount = 0;
  let failedCount = 0;

  // Submit to IndexNow
  const urls = pendingItems.map((item: any) => item.url);
  await submitToIndexNowBatch(urls);

  // Mark as completed
  for (const item of pendingItems) {
    await supabase
      .from('google_indexing_queue')
      .update({
        status: 'completed',
        processed_at: new Date().toISOString(),
        indexnow_submitted: true
      })
      .eq('id', item.id);
    successCount++;
  }

  return {
    processed: successCount + failedCount,
    successCount,
    failedCount,
    indexNowCount: indexNowResult.count + successCount,
    triggered_by: triggeredBy
  };
}

// ============ CHECK STATUS (from check-indexing-status) ============
async function handleCheckStatus(supabase: any, body: any) {
  const { mode = 'bulk', job_id, url, limit = 50 } = body;
  
  if (mode === 'single' && (job_id || url)) {
    let query = supabase.from('job_indexing_status').select('*');
    if (job_id) query = query.eq('job_id', job_id);
    else if (url) query = query.eq('url', url);
    
    const { data: record } = await query.order('updated_at', { ascending: false }).limit(1).maybeSingle();
    return record || { error: 'Not found' };
  }

  const { data: urlsToCheck } = await supabase
    .from('job_indexing_status')
    .select('*')
    .or('is_google_public.eq.false,is_bing_public.eq.false')
    .in('google_status', ['submitted', 'scheduled', 'queued'])
    .order('google_submitted_at', { ascending: true })
    .limit(limit);

  return {
    checked: urlsToCheck?.length || 0,
    items: urlsToCheck || []
  };
}

// ============ VERIFY STATUS (from verify-indexing-status) ============
async function handleVerifyStatus(supabase: any, body: any) {
  const { limit = 20, force = false } = body;
  
  const now = new Date().toISOString();

  let query = supabase
    .from('job_indexing_status')
    .select('*')
    .eq('google_status', 'submitted')
    .eq('is_google_public', false)
    .lt('verification_attempt_count', 5)
    .order('next_verification_at', { ascending: true })
    .limit(limit);

  if (!force) {
    query = query.lte('next_verification_at', now);
  }

  const { data: jobsToVerify } = await query;

  if (!jobsToVerify || jobsToVerify.length === 0) {
    return { checked: 0, message: 'No jobs due for verification' };
  }

  // Update verification count for each job
  for (const job of jobsToVerify) {
    const next24Hours = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    
    await supabase
      .from('job_indexing_status')
      .update({
        google_last_checked_at: now,
        verification_attempt_count: (job.verification_attempt_count || 0) + 1,
        next_verification_at: next24Hours,
        updated_at: now
      })
      .eq('id', job.id);
  }

  return { checked: jobsToVerify.length, success: true };
}

// ============ JOB WEBHOOK (from job-indexing-webhook) ============
async function handleJobWebhook(supabase: any, body: any) {
  const payload = body;
  const jobId = payload.record?.id;

  if (!jobId) {
    return { success: true, skipped: true };
  }

  const { data: jobDetails } = await supabase
    .from('jobs')
    .select('id, status, public_slug, title')
    .eq('id', jobId)
    .single();

  const jobSlug = jobDetails?.public_slug || jobId;
  const jobUrl = `${SITE_URL}/job/${jobSlug}`;
  const jobStatus = jobDetails?.status || payload.record?.status;

  if (jobStatus !== 'active') {
    return { success: true, skipped: true, reason: 'non-active' };
  }

  // Add to Google indexing queue only (Bing/IndexNow removed — Google only, free)
  await supabase
    .from('google_indexing_queue')
    .upsert({
      url: jobUrl,
      action: 'URL_UPDATED',
      status: 'pending',
      source: 'webhook',
      job_id: jobId,
      priority: 5,
      indexnow_submitted: false,
      metadata: {
        event_type: payload.type,
        job_title: jobDetails?.title
      }
    }, { onConflict: 'url' });

  return {
    success: true,
    url: jobUrl,
    google_queued: true
  };
}

// ============ HELPER FUNCTIONS ============

async function generateDailyReport(supabase: any, today: string): Promise<string> {
  const { data: quota } = await supabase
    .from('indexing_daily_quota')
    .select('*')
    .eq('date', today)
    .maybeSingle();

  const { count: pendingCount } = await supabase
    .from('google_indexing_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  const quotaPercentage = quota ? Math.round((quota.quota_used / quota.quota_limit) * 100) : 0;

  return `📊 *Daily SEO Report*\n\n` +
    `📅 Date: ${today}\n\n` +
    `🔵 *Quota Usage*\n` +
    `├ Used: ${quota?.quota_used || 0} / ${quota?.quota_limit || 200} (${quotaPercentage}%)\n` +
    `└ Pending Queue: ${pendingCount || 0}`;
}

async function generateWeeklyReport(supabase: any): Promise<string> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  
  const { count: jobsIndexed } = await supabase
    .from('google_indexing_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'completed')
    .gte('processed_at', weekAgo);

  return `📈 *Weekly SEO Report*\n\n` +
    `📅 Period: Last 7 Days\n\n` +
    `✅ Jobs Processed: ${jobsIndexed || 0}`;
}

function escapeMarkdown(text: string): string {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

async function pingSingleUrl(url: string) {
  try {
    await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: INDEXNOW_HOST,
        key: INDEXNOW_KEY,
        keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
        urlList: [url]
      })
    });
    return { success: true, url };
  } catch (e) {
    return { success: false, url, error: String(e) };
  }
}

async function getQuotaInfo(supabase: any) {
  const today = new Date().toISOString().split('T')[0];
  
  const { data } = await supabase
    .from('indexing_daily_quota')
    .select('*')
    .eq('date', today)
    .single();

  if (!data) {
    const { data: newRecord } = await supabase
      .from('indexing_daily_quota')
      .insert({ date: today, quota_used: 0, quota_limit: DAILY_QUOTA_LIMIT })
      .select()
      .single();
    
    return newRecord || { date: today, quota_used: 0, quota_limit: DAILY_QUOTA_LIMIT };
  }

  return data;
}

async function getQueueStatus(supabase: any) {
  const today = new Date().toISOString().split('T')[0];
  
  const { data: quotaData } = await supabase
    .from('indexing_daily_quota')
    .select('*')
    .eq('date', today)
    .single();
  
  const { count: pendingCount } = await supabase
    .from('google_indexing_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')
    .lt('retry_count', 5);
  
  return {
    date: today,
    quota: {
      used: quotaData?.quota_used || 0,
      limit: DAILY_QUOTA_LIMIT,
      remaining: EFFECTIVE_LIMIT - (quotaData?.quota_used || 0)
    },
    queue: { pending: pendingCount || 0 }
  };
}

async function processQuotaResetQueue(supabase: any) {
  await supabase.rpc('reset_daily_indexing_quota');
  
  const { count: totalPending } = await supabase
    .from('google_indexing_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')
    .lt('retry_count', 5);

  if (!totalPending || totalPending === 0) {
    return { urlsProcessed: 0, message: 'No pending jobs' };
  }

  return await handleProcessQueue(supabase, { triggered_by: 'quota_reset' });
}

async function processBatchIndexing(supabase: any, hours: number) {
  const hoursAgo = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  
  const { data: newJobs } = await supabase
    .from('jobs')
    .select('id, public_slug, title')
    .eq('status', 'active')
    .gte('created_at', hoursAgo)
    .order('created_at', { ascending: false })
    .limit(100);

  if (!newJobs || newJobs.length === 0) {
    return { urlsProcessed: 0, message: 'No new jobs' };
  }

  const urls = newJobs.map((job: any) => `${SITE_URL}/job/${job.public_slug || job.id}`);
  await submitToIndexNowBatch(urls);

  return { urlsProcessed: urls.length, successCount: urls.length };
}

async function indexStaticPages(supabase: any) {
  const urls = STATIC_PAGES.map(p => `${SITE_URL}${p.path}`);
  await submitToIndexNowBatch(urls);
  return { urlsProcessed: urls.length, success: true };
}

async function processIndexNowPending(supabase: any): Promise<{ count: number }> {
  const { data: unsubmittedItems } = await supabase
    .from('google_indexing_queue')
    .select('id, url')
    .eq('status', 'pending')
    .eq('indexnow_submitted', false)
    .limit(1000);

  if (!unsubmittedItems || unsubmittedItems.length === 0) {
    return { count: 0 };
  }

  const urls = unsubmittedItems.map((item: any) => item.url);
  const ids = unsubmittedItems.map((item: any) => item.id);
  
  await submitToIndexNowBatch(urls);
  
  await supabase
    .from('google_indexing_queue')
    .update({ indexnow_submitted: true })
    .in('id', ids);
  
  return { count: urls.length };
}

async function submitToIndexNowBatch(urls: string[]): Promise<{ bing: number; yandex: number }> {
  const results = { bing: 0, yandex: 0 };
  
  try {
    const bingResponse = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: INDEXNOW_HOST,
        key: INDEXNOW_KEY,
        keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
        urlList: urls.slice(0, 10000)
      })
    });
    
    if (bingResponse.ok || bingResponse.status === 202) {
      results.bing = urls.length;
    }
    
    const yandexResponse = await fetch('https://yandex.com/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: INDEXNOW_HOST,
        key: INDEXNOW_KEY,
        keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
        urlList: urls.slice(0, 10000)
      })
    });
    
    if (yandexResponse.ok || yandexResponse.status === 202) {
      results.yandex = urls.length;
    }
  } catch (e) {
    console.error('IndexNow batch error:', e);
  }

  return results;
}

// ============ SHARE PREVIEW ============
// Returns an HTML shell with live OG/Twitter/favicon meta from get_brand_assets
// so social-media crawlers always see the latest brand uploads. Humans get a
// 302 redirect to the real page.
const SHARE_CRAWLER_UA = /facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Slackbot|TelegramBot|WhatsApp|Discordbot|Pinterest|SkypeUriPreview|redditbot|vkShare|W3C_Validator|Embedly|Iframely|Googlebot|bingbot|YandexBot/i;

const escapeHtml = (s: string) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

async function handleSharePreview(req: Request, url: URL): Promise<Response> {
  const rawPath = url.searchParams.get('path') || url.searchParams.get('to') || '/';
  const safePath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  const targetUrl = `${SITE_URL}${safePath}`;

  const ua = req.headers.get('user-agent') || '';
  const isCrawler = SHARE_CRAWLER_UA.test(ua) || url.searchParams.get('debug') === '1';

  if (!isCrawler) {
    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, Location: targetUrl, 'Cache-Control': 'no-store' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: assetsData } = await supabase.rpc('get_brand_assets');
    const a = (assetsData && typeof assetsData === 'object') ? assetsData as Record<string, string> : {};

    const brandName = a.brand_name || 'Workly India';
    const tagline = a.brand_tagline || 'Find Workly India Jobs in India';
    const ogTitle = a.og_title || brandName;
    const ogDescription = a.og_description || tagline;
    const ogImage = a.og_image_url || a.logo_url || `${SITE_URL}/workly-india-logo.png`;
    const favicon = a.favicon_url || `${SITE_URL}/favicon.png`;
    const logo = a.logo_url || `${SITE_URL}/workly-india-logo.png`;

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(ogTitle)}</title>
<meta name="description" content="${escapeHtml(ogDescription)}" />
<link rel="canonical" href="${escapeHtml(targetUrl)}" />
<link rel="icon" type="image/png" href="${escapeHtml(favicon)}" />
<link rel="apple-touch-icon" href="${escapeHtml(logo)}" />

<meta property="og:type" content="website" />
<meta property="og:site_name" content="${escapeHtml(brandName)}" />
<meta property="og:url" content="${escapeHtml(targetUrl)}" />
<meta property="og:title" content="${escapeHtml(ogTitle)}" />
<meta property="og:description" content="${escapeHtml(ogDescription)}" />
<meta property="og:image" content="${escapeHtml(ogImage)}" />
<meta property="og:image:secure_url" content="${escapeHtml(ogImage)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="${escapeHtml(ogTitle)}" />
<meta property="og:locale" content="en_IN" />

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:url" content="${escapeHtml(targetUrl)}" />
<meta name="twitter:title" content="${escapeHtml(ogTitle)}" />
<meta name="twitter:description" content="${escapeHtml(ogDescription)}" />
<meta name="twitter:image" content="${escapeHtml(ogImage)}" />

<meta http-equiv="refresh" content="0; url=${escapeHtml(targetUrl)}" />
</head>
<body>
<p>Redirecting to <a href="${escapeHtml(targetUrl)}">${escapeHtml(targetUrl)}</a>&hellip;</p>
<script>window.location.replace(${JSON.stringify(targetUrl)});</script>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=60, s-maxage=60, must-revalidate',
        'X-Robots-Tag': 'noindex',
        'X-Brand-Source': 'share-preview',
      },
    });
  } catch (err) {
    console.error('[share-preview] error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}
