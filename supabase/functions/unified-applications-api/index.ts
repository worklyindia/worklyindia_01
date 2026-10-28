import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
};

// Helper to validate API key
async function validateApiKey(supabase: any, apiKey: string | null, endpoint: string, method: string, startTime: number, ipAddress: string, userAgent: string) {
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

  await supabase.from('api_keys').update({ 
    usage_count: (keyData.usage_count || 0) + 1,
    last_used_at: new Date().toISOString()
  }).eq('id', keyData.id);

  return { keyData };
}

function errorResponse(message: string, status: number = 500) {
  return new Response(JSON.stringify({
    success: false,
    error: status === 401 ? 'Unauthorized' : status === 400 ? 'Bad Request' : 'Internal Server Error',
    message
  }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function successResponse(data: any, keyData: any) {
  const rateLimit = keyData.rate_limit_tier === 'pro' ? 10000 : 1000;
  const remaining = Math.max(0, rateLimit - (keyData.usage_count || 0));
  
  return new Response(JSON.stringify(data), { 
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

serve(async (req) => {
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
  const applicationId = url.searchParams.get('application_id') || (pathParts.length > 1 ? pathParts[pathParts.length - 1] : null);

  const apiKey = req.headers.get('x-api-key');
  const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';

  try {
    const endpoint = `/api/applications/${action}`;
    const auth = await validateApiKey(supabase, apiKey, endpoint, req.method, startTime, ipAddress, userAgent);
    if (auth.error) return errorResponse(auth.error, auth.status);
    const { keyData } = auth;
    const userId = keyData.user_id;

    // Route based on method
    if (req.method === 'GET') {
      return await handleApplicationsList(supabase, url, keyData, userId, startTime, ipAddress, userAgent);
    }

    if (req.method === 'POST') {
      const body = await req.json();
      return await handleApplicationCreate(supabase, body, keyData, userId, startTime, ipAddress, userAgent);
    }

    if (req.method === 'PUT') {
      const body = await req.json();
      const updateId = body.application_id || applicationId;
      return await handleApplicationUpdate(supabase, updateId!, body, keyData, userId, startTime, ipAddress, userAgent);
    }

    return errorResponse('Invalid method', 400);

  } catch (error: any) {
    console.error('Error in unified-applications-api:', error);
    return errorResponse(error.message || 'An unexpected error occurred');
  }
});

// ==================== HANDLERS ====================

async function handleApplicationsList(supabase: any, url: URL, keyData: any, userId: string, startTime: number, ipAddress: string, userAgent: string) {
  const job_id = url.searchParams.get('job_id');
  const status = url.searchParams.get('status');
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
  const offset = (page - 1) * limit;

  let query = supabase.from('job_applications')
    .select('*, jobs!inner(id, title, employer_id), profiles!inner(full_name, email, phone, avatar_url)', { count: 'exact' });

  if (job_id) {
    const { data: job } = await supabase.from('jobs').select('employer_id').eq('id', job_id).single();
    if (!job || job.employer_id !== userId) throw new Error('You do not have permission to view these applications');
    query = query.eq('job_id', job_id);
  } else {
    const { data: userJobs } = await supabase.from('jobs').select('id').eq('employer_id', userId);
    if (!userJobs || userJobs.length === 0) {
      return successResponse({
        success: true,
        data: { applications: [], pagination: { page, limit, total: 0, total_pages: 0 } },
        message: 'No applications found'
      }, keyData);
    }
    query = query.in('job_id', userJobs.map((j: any) => j.id));
  }

  if (status) query = query.eq('status', status);
  query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

  const { data: applications, error, count } = await query;
  if (error) throw error;

  await supabase.from('api_request_logs').insert({
    api_key_id: keyData.id, endpoint: '/api/applications', method: 'GET',
    status_code: 200, response_time_ms: Date.now() - startTime,
    request_params: { job_id, status, page, limit }, ip_address: ipAddress, user_agent: userAgent
  });

  return successResponse({
    success: true,
    data: { applications: applications || [], pagination: { page, limit, total: count || 0, total_pages: Math.ceil((count || 0) / limit) } },
    message: 'Applications retrieved successfully'
  }, keyData);
}

async function handleApplicationCreate(supabase: any, body: any, keyData: any, userId: string, startTime: number, ipAddress: string, userAgent: string) {
  const { job_id, applicant_id, cover_letter, resume_url, expected_salary, available_from, additional_info } = body;

  if (!job_id) throw new Error('job_id is required');
  if (!applicant_id) throw new Error('applicant_id is required');

  // Check job
  const { data: job, error: jobError } = await supabase.from('jobs')
    .select('id, title, status, company_id, company:companies!inner(user_id)')
    .eq('id', job_id)
    .single();

  if (jobError || !job) throw new Error('Job not found');
  if (job.status !== 'active') throw new Error('Job is not accepting applications');

  const companyData = Array.isArray(job.company) ? job.company[0] : job.company;
  const employerId = companyData?.user_id;
  if (!employerId) throw new Error('Unable to process application - company information not found');

  // Check duplicate
  const { data: existingApplication } = await supabase.from('job_applications')
    .select('id')
    .eq('job_id', job_id)
    .eq('applicant_id', applicant_id)
    .single();

  if (existingApplication) throw new Error('You have already applied to this job');

  // Create application
  const { data: application, error: applicationError } = await supabase.from('job_applications')
    .insert({
      job_id, applicant_id, employer_id: employerId,
      cover_letter, resume_url, expected_salary, available_from, additional_info,
      status: 'submitted'
    })
    .select()
    .single();

  if (applicationError) throw applicationError;

  // Increment count
  const { data: currentJob } = await supabase.from('jobs').select('application_count').eq('id', job_id).single();
  await supabase.from('jobs').update({ application_count: (currentJob?.application_count || 0) + 1, updated_at: new Date().toISOString() }).eq('id', job_id);

  await supabase.from('api_request_logs').insert({
    api_key_id: keyData.id, endpoint: '/api/applications', method: 'POST',
    status_code: 200, response_time_ms: Date.now() - startTime,
    request_params: { job_id, applicant_id }, ip_address: ipAddress, user_agent: userAgent
  });

  return successResponse({ success: true, data: application, message: 'Application submitted successfully' }, keyData);
}

async function handleApplicationUpdate(supabase: any, applicationId: string, body: any, keyData: any, userId: string, startTime: number, ipAddress: string, userAgent: string) {
  if (!applicationId) throw new Error('Application ID is required');

  const { status, notes } = body;
  if (!status) throw new Error('status is required');

  const validStatuses = ['submitted', 'shortlisted', 'rejected', 'interview_scheduled', 'hired'];
  if (!validStatuses.includes(status)) throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);

  // Check ownership
  const { data: application } = await supabase.from('job_applications')
    .select('id, job_id, applicant_id, status, jobs!inner(employer_id, title)')
    .eq('id', applicationId)
    .single();

  if (!application) throw new Error('Application not found');

  const jobData = application.jobs as any;
  if (jobData.employer_id !== userId) throw new Error('You do not have permission to update this application');

  const updateData: any = { status, updated_at: new Date().toISOString() };
  if (notes) updateData.employer_notes = notes;

  const { data: updatedApplication, error } = await supabase.from('job_applications')
    .update(updateData)
    .eq('id', applicationId)
    .select()
    .single();

  if (error) throw error;

  // Push + in-app notification to the candidate
  try {
    await supabase.functions.invoke('email-api', {
      body: { action: 'application_status_notification', application_id: applicationId, new_status: status }
    });
  } catch (e) { console.error('Status notification error:', e); }

  // Telegram + Email are delivered by the status fan-out above
  // (email-api → email/telegram lifecycle templates).
  // A second send from here produced duplicate messages.

  await supabase.from('api_request_logs').insert({
    api_key_id: keyData.id, endpoint: `/api/applications/${applicationId}`, method: 'PUT',
    status_code: 200, response_time_ms: Date.now() - startTime,
    request_params: { application_id: applicationId, status }, ip_address: ipAddress, user_agent: userAgent
  });

  return successResponse({ success: true, data: updatedApplication, message: 'Application status updated successfully' }, keyData);
}
