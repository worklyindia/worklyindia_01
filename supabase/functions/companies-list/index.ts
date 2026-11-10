import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let apiKeyId: string | null = null;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const apiKey = req.headers.get('x-api-key');
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';
    
    if (!apiKey) {
      await supabase.from('api_request_logs').insert({
        endpoint: '/api/companies',
        method: 'GET',
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
      console.error('Invalid API key');
      
      await supabase.from('api_request_logs').insert({
        endpoint: '/api/companies',
        method: 'GET',
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

    const url = new URL(req.url);
    const verified = url.searchParams.get('verified');
    const industry = url.searchParams.get('industry');
    const size = url.searchParams.get('size');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);
    const offset = (page - 1) * limit;

    let query = supabase
      .from('companies')
      .select('*', { count: 'exact' })
      .eq('account_status', 'active');

    if (verified === 'true') {
      query = query.eq('is_verified', true);
    } else if (verified === 'false') {
      query = query.eq('is_verified', false);
    }

    if (industry) {
      query = query.ilike('industry', `%${industry}%`);
    }

    if (size) {
      query = query.eq('company_size', size);
    }

    const { data: companies, error: companiesError, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (companiesError) throw companiesError;

    const enrichedCompanies = await Promise.all(
      (companies || []).map(async (company) => {
        const { count: activeJobsCount } = await supabase
          .from('jobs')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', company.id)
          .eq('status', 'active');

        const { data: recentJobs } = await supabase
          .from('jobs')
          .select('id, title, location, job_type, salary_min, salary_max, salary_currency, created_at')
          .eq('company_id', company.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(5);

        return {
          id: company.id,
          company_name: company.company_name,
          description: company.description,
          logo: company.logo_url,
          website: company.website,
          email: company.email,
          phone: company.phone,
          location: company.location,
          industry: company.industry,
          company_size: company.company_size,
          founded_year: company.incorporation_date ? new Date(company.incorporation_date).getFullYear() : null,
          is_verified: company.is_verified,
          social_links: {
            linkedin: company.linkedin_link,
            twitter: null,
            facebook: company.facebook_link
          },
          active_jobs_count: activeJobsCount || 0,
          recent_jobs: recentJobs || []
        };
      })
    );

    const responseTime = Date.now() - startTime;
    const responseData = {
      success: true,
      data: {
        companies: enrichedCompanies,
        pagination: {
          page,
          limit,
          total: count || 0,
          total_pages: Math.ceil((count || 0) / limit)
        }
      },
      message: 'Companies fetched successfully'
    };
    
    const responseJson = JSON.stringify(responseData);

    await supabase.from('api_request_logs').insert({
      api_key_id: apiKeyId,
      endpoint: '/api/companies',
      method: 'GET',
      status_code: 200,
      response_time_ms: responseTime,
      request_params: { verified, industry, size, page, limit },
      response_size_bytes: new Blob([responseJson]).size,
      ip_address: ipAddress,
      user_agent: userAgent
    });

    const rateLimit = keyData.rate_limit_tier === 'pro' ? 10000 : 1000;
    const remaining = Math.max(0, rateLimit - (keyData.usage_count || 0));

    return new Response(responseJson, { 
      status: 200, 
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': rateLimit.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': new Date(Date.now() + 3600000).toISOString()
      } 
    });

  } catch (error: any) {
    console.error('Error in companies-list:', error);
    const responseTime = Date.now() - startTime;
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    await supabase.from('api_request_logs').insert({
      api_key_id: apiKeyId,
      endpoint: '/api/companies',
      method: 'GET',
      status_code: 500,
      response_time_ms: responseTime,
      error_message: error.message
    });
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal Server Error',
      message: error.message || 'An unexpected error occurred'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
