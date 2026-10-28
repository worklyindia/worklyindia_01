import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  const startTime = Date.now();
  let apiKeyId: string | null = null;
  let userId: string | null = null;
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const apiKey = req.headers.get('x-api-key');
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';
    if (!apiKey) {
      await supabase.from('api_request_logs').insert({
        endpoint: '/api/applications',
        method: 'POST',
        status_code: 401,
        response_time_ms: Date.now() - startTime,
        ip_address: ipAddress,
        user_agent: userAgent,
        error_message: 'Missing API key in x-api-key header'
      });
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized',
        message: 'Missing API key in x-api-key header',
        debug: {
          expected_header: 'x-api-key',
          received_headers: Object.keys(Object.fromEntries(req.headers)),
          help: 'Make sure to include the x-api-key header with your API key value'
        }
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const {
      data: keyData,
      error: keyError
    } = await supabase.from('api_keys').select('*').eq('api_key', apiKey).eq('is_active', true).single();
    if (keyError || !keyData) {
      console.error('Invalid API key');
      await supabase.from('api_request_logs').insert({
        endpoint: '/api/applications',
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
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    apiKeyId = keyData.id;
    userId = keyData.user_id;
    await supabase.from('api_keys').update({
      usage_count: (keyData.usage_count || 0) + 1,
      last_used_at: new Date().toISOString()
    }).eq('id', keyData.id);
    let body;
    try {
      const text = await req.text();
      if (!text || text.trim() === '') {
        throw new Error('Request body is required');
      }
      body = JSON.parse(text);
    } catch (error: any) {
      throw new Error(error.message === 'Request body is required' ? error.message : 'Invalid JSON in request body');
    }
    const {
      job_id,
      cover_letter,
      resume_url,
      // Required profile data
      email,
      // Optional profile data
      full_name,
      phone,
      location,
      skills,
      current_position,
      bio,
      experience_years,
      languages,
      whatsapp_number,
      profile_image_url,
      // Optional API-specific structured data
      social_links,
      certifications,
      professional_experiences,
      education_entries
    } = body;
    if (!job_id) {
      throw new Error('job_id is required');
    }
    if (!email || typeof email !== 'string') {
      throw new Error('email is required');
    }
    const normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      throw new Error('Invalid email format');
    }

    // Reject dummy/example job IDs
    if (job_id === '00000000-0000-0000-0000-000000000000') {
      console.warn('Attempt to use example/dummy job_id');
      throw new Error('You are using an example job_id. Please create a real job using the jobs-create endpoint first, then use the returned job_id to submit an application.');
    }
    if (cover_letter && cover_letter.length > 5000) {
      throw new Error('Cover letter must be less than 5000 characters');
    }

    // Check if auth user exists for this email, create if not

    const {
      data: {
        users
      },
      error: listError
    } = await supabase.auth.admin.listUsers();
    if (listError) {
      console.error('Error listing users:', listError);
      throw new Error(`Failed to check user existence: ${listError.message}`);
    }
    const existingUser = users?.find(u => u.email?.toLowerCase() === normalizedEmail);
    let applicantUserId: string;
    if (!existingUser) {
      // Generate secure random password
      const randomPassword = crypto.randomUUID() + crypto.randomUUID();

      // Create auth user with metadata
      const {
        data: newUserData,
        error: createUserError
      } = await supabase.auth.admin.createUser({
        email: normalizedEmail,
        password: randomPassword,
        email_confirm: true,
        user_metadata: {
          full_name: full_name || '',
          phone: phone || '',
          created_via: 'api'
        }
      });
      if (createUserError || !newUserData.user) {
        console.error('Failed to create user:', createUserError);
        throw new Error(`Failed to create user account: ${createUserError?.message}`);
      }
      applicantUserId = newUserData.user.id;
    } else {
      applicantUserId = existingUser.id;
    }

    // Check if profile exists for this user
    const {
      data: existingProfile
    } = await supabase.from('profiles').select('is_banned, resume_url, full_name, phone, skills').eq('user_id', applicantUserId).maybeSingle();

    // Employer accounts (identified by a companies row) cannot apply to jobs.
    const {
      data: applicantCompany
    } = await supabase.from('companies').select('id').eq('user_id', applicantUserId).maybeSingle();
    if (applicantCompany) {
      throw new Error('Only job seekers can submit applications');
    }
    if (existingProfile?.is_banned) {
      throw new Error('Your account has been banned and cannot submit applications');
    }
    const {
      data: job,
      error: jobError
    } = await supabase.from('jobs').select(`
        id, 
        title, 
        status, 
        companies!inner(company_name, user_id)
      `).eq('id', job_id).maybeSingle();
    if (jobError) {
      console.error('Error fetching job:', jobError);
      throw new Error(`Failed to fetch job: ${jobError.message}`);
    }
    if (!job) {
      console.error('Job not found for ID:', job_id);
      throw new Error('Job not found. Please verify the job_id is correct.');
    }
    if (job.status !== 'active') {
      throw new Error('This job is not accepting applications');
    }
    const companyData = Array.isArray(job.companies) ? job.companies[0] : job.companies;
    const companyUserId = companyData?.user_id;
    if (!companyUserId) {
      console.error('❌ Job has no associated company user_id:', job_id);
      throw new Error('This job posting is not properly configured. The job has no associated employer.');
    }
    const finalResumeUrl = resume_url || existingProfile?.resume_url;
    if (!finalResumeUrl) {
      throw new Error('Resume is required. Please provide resume_url or update your profile with a resume');
    }

    // Get or create the applicant's profile
    let {
      data: applicantProfile,
      error: applicantError
    } = await supabase.from('profiles').select('id, user_id').eq('user_id', applicantUserId).maybeSingle();
    if (applicantError) {
      console.error('Error fetching applicant profile:', applicantError);
      throw new Error(`Failed to fetch applicant profile: ${applicantError.message}`);
    }

    // For API submissions, create minimal profile with only essential fields
    // All submitted data is stored in job_applications.api_* columns, NOT in profile
    if (!applicantProfile) {
      const {
        data: newApplicantProfile,
        error: createApplicantError
      } = await supabase.from('profiles').insert({
        user_id: applicantUserId,
        email: normalizedEmail,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).select('id, user_id').single();
      if (createApplicantError || !newApplicantProfile) {
        console.error('Failed to create applicant profile:', createApplicantError);
        throw new Error('Could not create applicant profile. Please contact support.');
      }
      applicantProfile = newApplicantProfile;
    } else {}

    // Check for duplicate application
    const {
      data: existingApp
    } = await supabase.from('job_applications').select('id').eq('job_id', job_id).eq('applicant_id', applicantProfile.id).maybeSingle();
    if (existingApp) {
      throw new Error('You have already applied to this job');
    }

    // Get the employer's profile ID (not user_id) as employer_id references profiles.id

    let {
      data: employerProfile,
      error: employerError
    } = await supabase.from('profiles').select('id, user_id').eq('user_id', companyUserId).maybeSingle();
    if (employerError) {
      console.error('❌ Error fetching employer profile:', employerError);
      throw new Error(`Failed to fetch employer profile: ${employerError.message}`);
    }

    // Auto-create employer profile if it doesn't exist
    if (!employerProfile) {
      const {
        data: newEmployerProfile,
        error: createEmployerError
      } = await supabase.from('profiles').insert({
        user_id: companyUserId,
        created_at: new Date().toISOString()
      }).select('id, user_id').single();
      if (createEmployerError || !newEmployerProfile) {
        console.error('❌ Failed to create employer profile:', createEmployerError);
        throw new Error(`Could not create employer profile: ${createEmployerError?.message || 'Unknown error'}`);
      }
      employerProfile = newEmployerProfile;
    } else {}
    const insertData = {
      job_id,
      applicant_id: applicantProfile.id,
      employer_id: employerProfile.id,
      cover_letter,
      resume_url: finalResumeUrl,
      status: 'submitted',
      application_source: 'api',
      // API-specific structured data
      api_social_links: social_links || null,
      api_certifications: certifications || null,
      api_professional_experiences: professional_experiences || null,
      api_education_entries: education_entries || null,
      // API-specific basic data (stored ONLY in application, NOT in profile)
      api_full_name: full_name || null,
      api_email: normalizedEmail,
      api_phone: phone || null,
      api_whatsapp_number: whatsapp_number || null,
      api_location: location || null,
      api_skills: skills || null,
      api_bio: bio || null,
      api_current_position: current_position || null,
      api_company: body.company || null,
      api_experience_years: experience_years || null,
      api_languages: languages || null
    };
    const {
      data: application,
      error: appError
    } = await supabase.from('job_applications').insert(insertData).select().single();
    if (appError) {
      console.error('❌ Application insert failed:', {
        error: appError,
        code: appError.code,
        message: appError.message,
        details: appError.details,
        hint: appError.hint,
        insertData
      });
      throw appError;
    }
    await supabase.rpc('increment_job_application_count', {
      p_job_id: job_id
    });

    // Notifications (applicant + employer) are dispatched automatically by the
    // notify_job_application_trigger on job_applications -> email-api.

    // Trigger webhook for job.application.created event with complete data
    try {
      // Fetch complete company data
      const {
        data: fullCompanyData
      } = await supabase.from('companies').select('company_name, industry, phone, organisation_size, email, whatsapp_number, support_email, hr_contact_name').eq('user_id', companyUserId).maybeSingle();

      // Prepare complete webhook payload with all application details
      const webhookPayload = {
        job_id: job_id,
        application_id: application.id,
        timestamp: new Date().toISOString(),
        // Applicant Information (from API submission or profile)
        applicant: {
          id: applicantUserId,
          name: full_name || existingProfile?.full_name || null,
          email: normalizedEmail,
          phone: phone || existingProfile?.phone || null,
          whatsapp_number: whatsapp_number || null,
          location: location || null,
          skills: skills || existingProfile?.skills || null,
          current_position: current_position || null,
          company: body.company || null,
          experience_years: experience_years || null,
          languages: languages || null,
          bio: bio || null,
          profile_image_url: profile_image_url || null
        },
        // Application Details
        application: {
          cover_letter: cover_letter || null,
          resume_url: finalResumeUrl,
          status: 'submitted',
          applied_at: new Date().toISOString(),
          application_source: 'api',
          // Structured API data
          social_links: social_links || null,
          certifications: certifications || null,
          professional_experiences: professional_experiences || null,
          education_entries: education_entries || null
        },
        // Job Information
        job: {
          id: job.id,
          title: job.title,
          status: job.status
        },
        // Company Information
        company: {
          name: fullCompanyData?.company_name || companyData?.company_name || null,
          industry: fullCompanyData?.industry || null,
          organisation_size: fullCompanyData?.organisation_size || null,
          hr_contact_name: body.hr_contact_name || null,
          phone: fullCompanyData?.phone || null
        },
        // Employer/Job Creator Information (for external platform routing)
        employer: {
          user_id: companyUserId,
          email: fullCompanyData?.email || null,
          whatsapp_number: fullCompanyData?.whatsapp_number || null,
          phone: fullCompanyData?.phone || null,
          support_email: fullCompanyData?.support_email || null,
          hr_contact_name: fullCompanyData?.hr_contact_name || null
        }
      };
      await supabase.functions.invoke('trigger-webhook', {
        body: {
          event: 'job.application.created',
          user_id: companyUserId,
          payload: webhookPayload
        }
      });

      // Push + Email + Telegram for both sides are sent by the database trigger
      // on job_applications (email-api ->
      // job_application_notification), which resolves the real applicant
      // details. Sending them again here caused duplicate notifications with
      // the company name in place of the applicant name.
    } catch (webhookError) {
      console.error('Error triggering webhook:', webhookError);
      // Don't fail the main transaction if webhook fails
    }
    const responseTime = Date.now() - startTime;
    const responseData = {
      success: true,
      data: {
        application,
        job: {
          id: job.id,
          title: job.title,
          company_name: companyData?.company_name || 'Unknown Company'
        }
      },
      message: 'Application submitted successfully'
    };
    const responseJson = JSON.stringify(responseData);
    await supabase.from('api_request_logs').insert({
      api_key_id: apiKeyId,
      endpoint: '/api/applications',
      method: 'POST',
      status_code: 200,
      response_time_ms: responseTime,
      request_params: {
        job_id
      },
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
    console.error('Error in applications-submit:', error);
    const responseTime = Date.now() - startTime;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    await supabase.from('api_request_logs').insert({
      api_key_id: apiKeyId,
      endpoint: '/api/applications',
      method: 'POST',
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
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});