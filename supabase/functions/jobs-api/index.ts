import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { notifyEvent } from "../_shared/eventNotify.ts";
import { WEBSITE_DOMAIN } from "../_shared/domain.ts";
import { consumeApiCall, API_LIMIT_MESSAGE, trackApiResponse } from '../_shared/apiQuota.ts';

// Every job returned to API partners carries apply_url/job_url on our site, so
// partner websites show full details but applications always happen here.
function withApplyUrl(job: any) {
  if (!job || typeof job !== "object" || !job.id) return job;
  const path = job.public_slug ? `/job/${job.public_slug}` : job.short_id ? `/j/${job.short_id}` : `/jobs/${job.id}`;
  const url = `${WEBSITE_DOMAIN}${path}?utm_source=api_partner&utm_medium=jobs_api`;
  return { ...job, job_url: url, apply_url: url };
}
function addApplyUrls(data: any) {
  const d = data?.data;
  if (Array.isArray(d?.jobs)) d.jobs = d.jobs.map(withApplyUrl);
  else if (d && d.id) data.data = withApplyUrl(d);
  return data;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

// Helper to parse location
function parseLocation(location: string): { city?: string; state?: string; country?: string } {
  const parts = location.split(',').map(p => p.trim());
  if (parts.length === 3) return { city: parts[0], state: parts[1], country: parts[2] };
  if (parts.length === 2) return { city: parts[0], country: parts[1] };
  return { country: parts[0] };
}

// Helper to validate and get API key
async function validateApiKey(supabase: any, apiKey: string | null, endpoint: string, method: string, startTime: number, ipAddress: string, userAgent: string, req?: Request) {
  if (!apiKey) {
    await supabase.from('api_request_logs').insert({
      endpoint, method, status_code: 401,
      response_time_ms: Date.now() - startTime,
      ip_address: ipAddress, user_agent: userAgent,
      error_message: 'API key is required'
    });
    return { error: 'API key is required', status: 401 };
  }

  const { data: keyData, error: keyError } = await supabase
    .from('api_keys')
    .select('*')
    .eq('api_key', apiKey)
    .eq('is_active', true)
    .single();

  if (keyError || !keyData) {
    await supabase.from('api_request_logs').insert({
      endpoint, method, status_code: 401,
      response_time_ms: Date.now() - startTime,
      ip_address: ipAddress, user_agent: userAgent,
      error_message: 'Invalid or inactive API key'
    });
    return { error: 'Invalid or inactive API key', status: 401 };
  }

  if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) return { error: 'API key expired', status: 401 };
  const { data: activeSub } = await supabase.from('api_subscriptions').select('id').eq('user_id', keyData.user_id).eq('status', 'active').or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`).limit(1).maybeSingle();
  if (!activeSub) {
    await supabase.from('api_request_logs').insert({ endpoint, method, status_code: 402, response_time_ms: Date.now() - startTime, ip_address: ipAddress, user_agent: userAgent, error_message: 'API subscription inactive' });
    return { error: 'API subscription inactive. Subscribe in the Workly India Developer Portal.', status: 402 };
  }
  const quota = await consumeApiCall(supabase, keyData.user_id, req);
  if (!quota.allowed) {
    await supabase.from('api_request_logs').insert({ endpoint, method, status_code: 429, response_time_ms: Date.now() - startTime, ip_address: ipAddress, user_agent: userAgent, error_message: 'API call limit reached' });
    return { error: API_LIMIT_MESSAGE, status: 429 };
  }

  // Key usage (usage_count + last_used_at) is updated centrally inside consume_api_call
  // so every service stays in sync with the API logs automatically.

  return { keyData };
}

// Helper for error response

/** Job types are stored as labels like "Full Time"; accept "full-time", "full_time" or "Full Time". */
function jobTypePattern(v: string): string {
  return v.trim().replace(/[-_\s]+/g, '%');
}

function errorResponse(message: string, status: number = 500) {
  return new Response(JSON.stringify({
    success: false,
    error: status === 401 ? 'Unauthorized' : status === 400 ? 'Bad Request' : status === 402 ? 'Payment Required' : status === 404 ? 'Not Found' : 'Internal Server Error',
    message
  }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// Helper for success response with rate limit headers
function successResponse(data: any, keyData: any, responseTime: number) {
  const rateLimit = keyData.rate_limit_tier === 'pro' ? 10000 : 1000;
  const remaining = Math.max(0, rateLimit - (keyData.usage_count || 0));
  
  return new Response(JSON.stringify(addApplyUrls(data)), { 
    status: 200, 
    headers: { 
      ...corsHeaders, 
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': rateLimit.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': new Date(Date.now() + 3600000).toISOString()
    } 
  });
}

serve((req) => trackApiResponse(req, async () => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const action = pathParts[pathParts.length - 1] || url.searchParams.get('action') || '';
  const jobId = url.searchParams.get('job_id') || (pathParts.length > 1 ? pathParts[pathParts.length - 1] : null);

  const apiKey = req.headers.get('x-api-key');
  const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';
  let authenticatedKeyId: string | null = null;

  try {
    const endpoint = `/api/jobs/${action}`;
    const auth = await validateApiKey(supabase, apiKey, endpoint, req.method, startTime, ipAddress, userAgent, req);
    if (auth.error) return errorResponse(auth.error, auth.status);
    const { keyData } = auth;
    authenticatedKeyId = keyData.id;
    const userId = keyData.user_id;

    // Route based on action and method
    if (req.method === 'GET') {
      // LIST / SEARCH / DETAIL / TRENDING / LATEST
      if (action === 'list' || action === 'search' || !action || action === 'jobs-api') {
        return await handleJobsList(supabase, url, keyData, userId, startTime, ipAddress, userAgent);
      }
      if (action === 'trending') {
        return await handleJobsTrending(supabase, url, keyData, startTime, ipAddress, userAgent);
      }
      if (action === 'latest') {
        return await handleJobsLatest(supabase, url, keyData, startTime, ipAddress, userAgent);
      }
      if (action === 'detail' || (jobId && jobId !== 'list' && jobId !== 'search')) {
        const detailId = url.searchParams.get('job_id') || jobId;
        return await handleJobDetail(supabase, detailId!, keyData, startTime, ipAddress, userAgent);
      }
    }

    if (req.method === 'POST') {
      const body = await req.json();
      
      if (action === 'create' || action === 'jobs-api') {
        return await handleJobCreate(supabase, body, keyData, userId, startTime, ipAddress, userAgent);
      }
      if (action === 'boost') {
        return await handleJobBoost(supabase, body, keyData, userId, startTime, ipAddress, userAgent);
      }
      if (action === 'extend') {
        return await handleJobExtend(supabase, body, keyData, userId, startTime, ipAddress, userAgent);
      }
    }

    if (req.method === 'PUT' && (action === 'update' || jobId)) {
      const body = await req.json();
      const updateId = body.job_id || url.searchParams.get('job_id') || jobId;
      return await handleJobUpdate(supabase, updateId, body, keyData, userId, startTime, ipAddress, userAgent);
    }

    if (req.method === 'DELETE' && (action === 'delete' || jobId)) {
      const deleteId = url.searchParams.get('job_id') || jobId;
      return await handleJobDelete(supabase, deleteId!, keyData, userId, startTime, ipAddress, userAgent);
    }

    await supabase.from('api_request_logs').insert({ api_key_id: keyData.id, endpoint: `/api/jobs/${action}`, method: req.method, status_code: 400, response_time_ms: Date.now() - startTime, ip_address: ipAddress, user_agent: userAgent, error_message: 'Invalid action or method' });
    return errorResponse('Invalid action or method', 400);

  } catch (error: any) {
    console.error('Error in jobs-api:', error);
    const message = error.message || 'An unexpected error occurred';
    if (authenticatedKeyId) {
      await supabase.from('api_request_logs').insert({ api_key_id: authenticatedKeyId, endpoint: `/api/jobs/${action}`, method: req.method, status_code: 400, response_time_ms: Date.now() - startTime, ip_address: ipAddress, user_agent: userAgent, error_message: message });
    }
    return errorResponse(message, 400);
  }
}));

// ==================== HANDLERS ====================

async function handleJobsList(supabase: any, url: URL, keyData: any, userId: string, startTime: number, ipAddress: string, userAgent: string, req?: Request) {
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
  const status = url.searchParams.get('status') || 'active';
  const location = url.searchParams.get('location') || '';
  const job_type = url.searchParams.get('job_type') || '';
  const search = url.searchParams.get('search') || url.searchParams.get('search_query') || '';
  const my_jobs_only = url.searchParams.get('my_jobs') === 'true';
  const offset = (page - 1) * limit;

  let query = supabase
    .from('jobs')
    .select('*, companies!inner(company_name, logo_url)', { count: 'exact' });

  if (my_jobs_only) query = query.eq('employer_id', userId);
  if (!my_jobs_only) query = query.eq('status', 'active');
  else if (status && status !== 'all') query = query.eq('status', status);
  if (location) query = query.ilike('location', `%${location}%`);
  if (job_type) query = query.ilike('job_type', jobTypePattern(job_type));
  if (search) query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);

  query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

  const { data: jobs, error: jobsError, count } = await query;
  if (jobsError) throw jobsError;

  await supabase.from('api_request_logs').insert({
    api_key_id: keyData.id, endpoint: '/api/jobs/list', method: 'GET',
    status_code: 200, response_time_ms: Date.now() - startTime,
    request_params: { page, limit, status, location, job_type },
    ip_address: ipAddress, user_agent: userAgent
  });

  return successResponse({
    success: true,
    data: { jobs: jobs || [], pagination: { page, limit, total: count || 0, total_pages: Math.ceil((count || 0) / limit) } },
    message: 'Jobs retrieved successfully'
  }, keyData, Date.now() - startTime);
}

async function handleJobsTrending(supabase: any, url: URL, keyData: any, startTime: number, ipAddress: string, userAgent: string, req?: Request) {
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
  const location = url.searchParams.get('location') || null;
  const jobType = url.searchParams.get('job_type') || null;
  const experienceLevel = url.searchParams.get('experience_level') || null;
  const offset = (page - 1) * limit;

  let tq = supabase.from('jobs')
    .select('*, companies!inner(company_name, logo_url)', { count: 'exact' })
    .eq('status', 'active');
  if (location) tq = tq.ilike('location', `%${location}%`);
  if (jobType) tq = tq.ilike('job_type', jobTypePattern(jobType));
  if (experienceLevel) tq = tq.eq('experience_level', experienceLevel);
  const { data: jobs, error, count } = await tq
    .order('trending_score', { ascending: false, nullsFirst: false })
    .order('views_count', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw new Error('Failed to fetch trending jobs');

  await supabase.from('api_request_logs').insert({
    api_key_id: keyData.id, endpoint: '/api/jobs/trending', method: 'GET',
    status_code: 200, response_time_ms: Date.now() - startTime, ip_address: ipAddress, user_agent: userAgent
  });

  return successResponse({
    success: true,
    data: { jobs: jobs || [], pagination: { page, limit, total: count || 0, total_pages: Math.ceil((count || 0) / limit), has_more: page < Math.ceil((count || 0) / limit) } }
  }, keyData, Date.now() - startTime);
}

async function handleJobsLatest(supabase: any, url: URL, keyData: any, startTime: number, ipAddress: string, userAgent: string, req?: Request) {
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
  const location = url.searchParams.get('location') || '';
  const jobType = url.searchParams.get('job_type') || '';
  const offset = (page - 1) * limit;

  let query = supabase.from('jobs')
    .select('*, companies!inner(company_name, logo_url, location, website, description, phone, email, whatsapp_number, hr_contact_name, industry, organisation_size, instagram_link, facebook_link, linkedin_link, youtube_link)', { count: 'exact' })
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (location) query = query.ilike('location', `%${location}%`);
  if (jobType) query = query.ilike('job_type', jobTypePattern(jobType));

  const { data: jobs, error, count } = await query.range(offset, offset + limit - 1);
  if (error) throw error;

  await supabase.from('api_request_logs').insert({
    api_key_id: keyData.id, endpoint: '/api/jobs/latest', method: 'GET',
    status_code: 200, response_time_ms: Date.now() - startTime, ip_address: ipAddress, user_agent: userAgent
  });

  return successResponse({
    success: true,
    data: { jobs: jobs || [], pagination: { page, limit, total: count || 0, total_pages: Math.ceil((count || 0) / limit), has_more: page < Math.ceil((count || 0) / limit) } }
  }, keyData, Date.now() - startTime);
}

async function handleJobDetail(supabase: any, jobId: string, keyData: any, startTime: number, ipAddress: string, userAgent: string, req?: Request) {
  const { data: job, error } = await supabase.from('jobs')
    .select('*, companies!inner(company_name, logo_url, location, website, description, phone, email, whatsapp_number, hr_contact_name, industry, organisation_size, instagram_link, facebook_link, linkedin_link, youtube_link)')
    .eq('id', jobId)
    .single();

  if (error || !job) return errorResponse('Job not found', 404);

  await supabase.from('jobs').update({ views_count: (job.views_count || 0) + 1 }).eq('id', jobId);

  await supabase.from('api_request_logs').insert({
    api_key_id: keyData.id, endpoint: `/api/jobs/${jobId}`, method: 'GET',
    status_code: 200, response_time_ms: Date.now() - startTime, ip_address: ipAddress, user_agent: userAgent
  });

  return successResponse({ success: true, data: job, message: 'Job details retrieved successfully' }, keyData, Date.now() - startTime);
}

async function handleJobCreate(supabase: any, body: any, keyData: any, userId: string, startTime: number, ipAddress: string, userAgent: string, req?: Request) {
  const { title, description, location, job_type, duration, duration_months, experience_level = 'intermediate', salary_min, salary_max, salary_period = 'yearly', salary_currency = 'INR', skills, languages, benefits, requirements, responsibilities, video_url, latitude, longitude, remote_allowed = false, visa_sponsorship = false, publish_immediately = true, video_title_1, video_url_1, video_title_2, video_url_2, email, hr_contact_name, phone, whatsapp_number, company_name, industry, organisation_size, company_details, instagram_link, facebook_link, linkedin_link, youtube_link } = body;

  // Validations
  if (!title || title.length < 5 || title.length > 30) throw new Error('Title must be between 5-30 characters');
  if (!description || description.length < 20 || description.length > 10000) throw new Error('Description must be between 20-10000 characters');
  if (!location) throw new Error('Location is required');
  if (!['full-time', 'part-time', 'contract', 'internship', 'temporary'].includes(job_type)) throw new Error('Invalid job_type');

  // Get company
  const { data: companyProfile } = await supabase.from('companies').select('id, company_name').eq('user_id', userId).maybeSingle();
  if (!companyProfile) throw new Error('API user must have a company profile to post jobs');

  // Calculate pricing
  let pointsCost: number, durationDays: number, durationMonthsValue: number | undefined;
  
  if (duration_months) {
    const { data: jobSettings } = await supabase.from('job_posting_settings').select('duration_packages, is_active').eq('is_active', true).order('updated_at', { ascending: false }).limit(1).maybeSingle();
    if (!jobSettings?.is_active) throw new Error('Job posting is currently disabled');
    const pkg = (jobSettings.duration_packages as any[])?.find((p: any) => p.months === duration_months && p.is_active !== false);
    if (!pkg) throw new Error(`No active pricing package found for ${duration_months} months`);
    pointsCost = pkg.points;
    durationMonthsValue = duration_months;
    durationDays = duration_months * 30;
  } else {
    const d = duration || 30;
    if (![30, 90, 180].includes(d)) throw new Error('Duration must be 30, 90, or 180 days');
    pointsCost = d === 30 ? 50 : d === 90 ? 150 : 250;
    durationDays = d;
  }


  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + durationDays);
  const { city, state, country } = parseLocation(location);

  const { data: job, error: jobError } = await supabase.from('jobs').insert({
    company_id: companyProfile.id, title, description, location, city, state, country, latitude, longitude, job_type, experience_level, salary_min, salary_max, salary_period, salary_currency,
    salary_range: salary_min && salary_max ? `${salary_currency} ${salary_min.toLocaleString()} - ${salary_max.toLocaleString()} / ${salary_period}` : null,
    skills, languages, benefits, requirements, responsibilities, video_url, video_title_1, video_url_1, video_title_2, video_url_2, remote_allowed, visa_sponsorship, expires_at: expiresAt.toISOString(),
    // Jobs created via API stay as drafts until paid via Razorpay in the employer portal
    status: 'draft',
    duration_months: durationMonthsValue ?? Math.max(1, Math.round(durationDays / 30)),
    api_email: email, api_hr_contact_name: hr_contact_name, api_phone: phone, api_whatsapp_number: whatsapp_number,
    api_company_name: company_name, api_industry: industry, api_organisation_size: organisation_size, api_company_description: company_details,
    api_instagram_link: instagram_link, api_facebook_link: facebook_link, api_linkedin_link: linkedin_link, api_youtube_link: youtube_link
  }).select().single();

  if (jobError) throw jobError;

  // Push + Email + Telegram (owner templates)
  try {
    await notifyEvent(supabase, {
      eventType: 'job_draft_saved',
      userId,
      audience: 'employer',
      name: company_name || companyProfile.company_name,
      variables: { job_title: title, company: company_name || companyProfile.company_name, location, job_type },
      fallbackTitle: '📝 Job saved as draft',
      fallbackMessage: `${title} is saved. Pay via Razorpay in the employer portal to publish it.`,
    });
  } catch (e) { console.error('Job posted notification error:', e); }

  await supabase.from('api_request_logs').insert({
    api_key_id: keyData.id, endpoint: '/api/jobs/create', method: 'POST',
    status_code: 200, response_time_ms: Date.now() - startTime,
    request_params: { title, job_type, duration: durationDays }, ip_address: ipAddress, user_agent: userAgent
  });

  return successResponse({
    success: true,
    data: { job: { id: job.id, title: job.title, status: job.status, expires_at: job.expires_at }, amount_due_inr: pointsCost, payment: 'Pay via Razorpay in the employer portal to publish', duration_info: { days: durationDays, months: durationMonthsValue, expires_at: expiresAt.toISOString() } },
    message: 'Job saved as draft. Complete the Razorpay payment in the employer portal to publish it.'
  }, keyData, Date.now() - startTime);
}

async function handleJobUpdate(supabase: any, jobId: string, body: any, keyData: any, userId: string, startTime: number, ipAddress: string, userAgent: string, req?: Request) {
  if (!jobId) throw new Error('Job ID is required');

  const { data: existingJob } = await supabase.from('jobs').select('id, employer_id').eq('id', jobId).single();
  if (!existingJob) throw new Error('Job not found');
  if (existingJob.employer_id !== userId) throw new Error('You do not have permission to edit this job');

  const updateData: any = { updated_at: new Date().toISOString() };
  const fields = ['title', 'description', 'location', 'job_type', 'experience_level', 'salary_min', 'salary_max', 'salary_period', 'salary_currency', 'skills', 'languages', 'benefits', 'requirements', 'responsibilities', 'video_url', 'video_title_1', 'video_url_1', 'video_title_2', 'video_url_2', 'latitude', 'longitude', 'remote_allowed', 'visa_sponsorship', 'status'];
  fields.forEach(f => { if (body[f] !== undefined) updateData[f] = body[f]; });

  const apiFields = { email: 'api_email', hr_contact_name: 'api_hr_contact_name', phone: 'api_phone', whatsapp_number: 'api_whatsapp_number', company_name: 'api_company_name', industry: 'api_industry', organisation_size: 'api_organisation_size', company_details: 'api_company_description' };
  Object.entries(apiFields).forEach(([k, v]) => { if (body[k] !== undefined) updateData[v] = body[k]; });

  const { data: updatedJob, error } = await supabase.from('jobs').update(updateData).eq('id', jobId).select().single();
  if (error) throw error;

  // If status changed to private/deleted, remove from Telegram channel
  if (body.status && ['private', 'deleted', 'inactive'].includes(body.status)) {
    const { data: jobWithMsg } = await supabase.from('jobs').select('telegram_channel_message_id').eq('id', jobId).single();
    if (jobWithMsg?.telegram_channel_message_id) {
      try {
        await supabase.functions.invoke('email-api/telegram', { body: { action: 'channel-delete', job_id: jobId } });
      } catch (e) { console.error('Telegram channel delete error:', e); }
    }
  }

  await supabase.from('api_request_logs').insert({
    api_key_id: keyData.id, endpoint: `/api/jobs/${jobId}`, method: 'PUT',
    status_code: 200, response_time_ms: Date.now() - startTime, request_params: { job_id: jobId }, ip_address: ipAddress, user_agent: userAgent
  });

  return successResponse({ success: true, data: updatedJob, message: 'Job updated successfully' }, keyData, Date.now() - startTime);
}

async function handleJobDelete(supabase: any, jobId: string, keyData: any, userId: string, startTime: number, ipAddress: string, userAgent: string, req?: Request) {
  if (!jobId) throw new Error('Job ID is required');

  const { data: existingJob } = await supabase.from('jobs').select('id, employer_id, title, telegram_channel_message_id').eq('id', jobId).single();
  if (!existingJob) throw new Error('Job not found');
  if (existingJob.employer_id !== userId) throw new Error('You do not have permission to delete this job');

  await supabase.from('jobs').update({ status: 'deleted', deleted_at: new Date().toISOString() }).eq('id', jobId);

  // Delete from Telegram channel if message was posted
  if (existingJob.telegram_channel_message_id) {
    try {
      await supabase.functions.invoke('email-api/telegram', { body: { action: 'channel-delete', job_id: jobId }
      });
    } catch (e) { console.error('Telegram channel delete error:', e); }
  }

  await supabase.from('api_request_logs').insert({
    api_key_id: keyData.id, endpoint: `/api/jobs/${jobId}`, method: 'DELETE',
    status_code: 200, response_time_ms: Date.now() - startTime, request_params: { job_id: jobId }, ip_address: ipAddress, user_agent: userAgent
  });

  return successResponse({ success: true, data: { job_id: jobId, job_title: existingJob.title, deleted_at: new Date().toISOString() }, message: 'Job deleted successfully' }, keyData, Date.now() - startTime);
}

async function handleJobBoost(supabase: any, body: any, keyData: any, userId: string, startTime: number, ipAddress: string, userAgent: string, req?: Request) {
  void supabase; void body; void keyData; void userId; void startTime; void ipAddress; void userAgent;
  return errorResponse('Wallet payments have been removed. Please complete this payment via Razorpay in the employer portal.', 402);
}

async function handleJobExtend(supabase: any, body: any, keyData: any, userId: string, startTime: number, ipAddress: string, userAgent: string, req?: Request) {
  void supabase; void body; void keyData; void userId; void startTime; void ipAddress; void userAgent;
  return errorResponse('Wallet payments have been removed. Please complete this payment via Razorpay in the employer portal.', 402);
}
