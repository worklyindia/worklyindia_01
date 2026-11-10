import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let apiKeyId: string | null = null;
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {

    const apiKey = req.headers.get('x-api-key');
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';
    
    if (!apiKey) {
      await supabase.from('api_request_logs').insert({
        endpoint: '/api/jobs/multiple',
        method: 'POST',
        status_code: 401,
        response_time_ms: Date.now() - startTime,
        ip_address: ipAddress,
        user_agent: userAgent,
        error_message: 'API key is required'
      });
      
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized',
        message: 'API key is required'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: keyData, error: keyError } = await supabase
      .from('api_keys')
      .select('*')
      .eq('api_key', apiKey)
      .eq('is_active', true)
      .single();

    if (keyError || !keyData) {
      await supabase.from('api_request_logs').insert({
        endpoint: '/api/jobs/multiple',
        method: 'POST',
        status_code: 401,
        response_time_ms: Date.now() - startTime,
        ip_address: ipAddress,
        user_agent: userAgent,
        error_message: 'Invalid or inactive API key'
      });
      
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid or inactive API key'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    apiKeyId = keyData.id;

    await supabase
      .from('api_keys')
      .update({ 
        usage_count: (keyData.usage_count || 0) + 1,
        last_used_at: new Date().toISOString()
      })
      .eq('id', keyData.id);

    const body = await req.json();
    const { job_ids } = body;

    if (!job_ids || !Array.isArray(job_ids) || job_ids.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Bad Request',
        message: 'job_ids array is required and must not be empty'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (job_ids.length > 50) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Bad Request',
        message: 'Maximum 50 job IDs allowed per request'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('🔍 [jobs-multiple] Querying job IDs:', job_ids.length);
    
    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select(`
        *,
        companies!inner(company_name, logo_url, location, website, description, phone, email, whatsapp_number, hr_contact_name, industry, organisation_size, instagram_link, facebook_link, linkedin_link, youtube_link)
      `)
      .in('id', job_ids)
      .eq('status', 'active');

    if (jobsError) {
      console.error('❌ [jobs-multiple] Query error:', jobsError);
      throw new Error('Failed to fetch jobs');
    }

    const foundIds = jobs?.map(j => j.id) || [];
    const notFoundIds = job_ids.filter(id => !foundIds.includes(id));

    console.log('✅ [jobs-multiple] Found:', foundIds.length, 'Not found:', notFoundIds.length);

    await supabase.from('api_request_logs').insert({
      api_key_id: apiKeyId,
      endpoint: '/api/jobs/multiple',
      method: 'POST',
      status_code: 200,
      response_time_ms: Date.now() - startTime,
      ip_address: ipAddress,
      user_agent: userAgent,
      request_body: JSON.stringify({ job_ids_count: job_ids.length })
    });

    return new Response(JSON.stringify({
      success: true,
      data: {
        jobs: jobs || [],
        found: foundIds.length,
        not_found: notFoundIds,
        requested: job_ids.length
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('❌ [jobs-multiple] Error:', error);
    
    await supabase.from('api_request_logs').insert({
      api_key_id: apiKeyId,
      endpoint: '/api/jobs/multiple',
      method: 'POST',
      status_code: 500,
      response_time_ms: Date.now() - startTime,
      error_message: error.message
    });

    return new Response(JSON.stringify({
      success: false,
      error: 'Internal Server Error',
      message: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
