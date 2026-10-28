import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { WEBSITE_DOMAIN } from "../_shared/domain.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DOMAIN = WEBSITE_DOMAIN;

interface UrlResult {
  redirect?: boolean;
  url?: string;
  error?: string;
  suggestion?: string;
  status?: number;
  data?: Record<string, unknown>;
}

interface JobRecord {
  id: string;
  title: string;
  public_slug: string | null;
  short_id: string;
  status: string;
}

interface CompanyRecord {
  id: string;
  company_name: string;
  account_status: string;
}

interface BlogRecord {
  id: string;
  slug: string;
  is_published: boolean;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    // Get the path parameter from query string or path
    const targetPath = url.searchParams.get('path') || pathParts.slice(1).join('/');
    
    console.log('🔗 URL Handler - Path:', targetPath);

    if (!targetPath) {
      // Redirect to homepage if no path
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, 'Location': DOMAIN },
      });
    }

    // Handle different URL patterns
    const result = await handleUrlPattern(supabase, targetPath);
    
    if (result.redirect && result.url) {
      console.log('✅ Redirecting to:', result.url);
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, 'Location': result.url },
      });
    }

    if (result.error) {
      console.log('❌ Error:', result.error);
      return new Response(
        JSON.stringify({ 
          error: result.error,
          suggestion: result.suggestion || 'Visit our homepage for available jobs'
        }),
        { 
          status: result.status || 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(
      JSON.stringify(result),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ URL Handler error:', error);
    
    // On any error, redirect to homepage instead of showing error
    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, 'Location': DOMAIN },
    });
  }
});

async function handleUrlPattern(supabase: SupabaseClient, path: string): Promise<UrlResult> {
  // Remove leading/trailing slashes
  const cleanPath = path.replace(/^\/+|\/+$/g, '');
  const parts = cleanPath.split('/');

  console.log('📍 Processing path:', cleanPath, 'Parts:', parts);

  // Pattern 1: Short URL - /j/{short_id}
  if (parts[0] === 'j' && parts[1]) {
    return await handleShortUrl(supabase, parts[1]);
  }

  // Pattern 2: Job page - /job/{slug} or /job/{uuid}
  if (parts[0] === 'job' && parts[1]) {
    return await handleJobUrl(supabase, parts[1]);
  }

  // Pattern 3: Jobs listing - /jobs
  if (parts[0] === 'jobs') {
    return { redirect: true, url: `${DOMAIN}/jobs` };
  }

  // Pattern 4: Company page - /company/{id} or /employer/{id}
  if ((parts[0] === 'company' || parts[0] === 'employer') && parts[1]) {
    return await handleCompanyUrl(supabase, parts[1]);
  }

  // Pattern 5: Category pages - /category/{slug}
  if (parts[0] === 'category' && parts[1]) {
    return { redirect: true, url: `${DOMAIN}/category/${parts[1]}` };
  }

  // Pattern 6: Blog pages - /blog/{slug}
  if (parts[0] === 'blog') {
    if (parts[1]) {
      return await handleBlogUrl(supabase, parts[1]);
    }
    return { redirect: true, url: `${DOMAIN}/blog` };
  }

  // Pattern 7: Career paths - /career-paths/{slug}
  if (parts[0] === 'career-paths') {
    if (parts[1]) {
      return { redirect: true, url: `${DOMAIN}/career-paths/${parts[1]}` };
    }
    return { redirect: true, url: `${DOMAIN}/career-paths` };
  }

  // Pattern 8: Static pages
  const staticPages = [
    'about', 'contact', 'privacy-policy', 'terms', 'faq', 
    'help', 'support', 'login', 'register', 'signup',
    'employer', 'post-job', 'pricing', 'reviews'
  ];
  
  if (staticPages.includes(parts[0])) {
    return { redirect: true, url: `${DOMAIN}/${parts[0]}` };
  }

  // Pattern 9: Direct short_id (just the code without /j/ prefix)
  if (parts.length === 1 && /^[a-zA-Z0-9]{6,10}$/.test(parts[0])) {
    return await handleShortUrl(supabase, parts[0]);
  }

  // Pattern 10: UUID directly
  if (parts.length === 1 && isValidUUID(parts[0])) {
    return await handleJobUrl(supabase, parts[0]);
  }

  // Default: Redirect to homepage
  return { redirect: true, url: DOMAIN };
}

async function handleShortUrl(supabase: SupabaseClient, shortId: string): Promise<UrlResult> {
  console.log('🔗 Looking up short URL:', shortId);

  const { data, error } = await supabase
    .from('jobs')
    .select('id, title, public_slug, short_id, status')
    .eq('short_id', shortId)
    .maybeSingle();

  const job = data as JobRecord | null;

  if (error) {
    console.error('❌ Short URL lookup error:', error);
    return { redirect: true, url: `${DOMAIN}/jobs` };
  }

  if (!job) {
    console.log('❌ Short URL not found:', shortId);
    return { redirect: true, url: `${DOMAIN}/jobs` };
  }

  // Check if job is active
  if (job.status !== 'open' && job.status !== 'active') {
    console.log('⚠️ Job not active:', job.id, 'Status:', job.status);
    return { redirect: true, url: `${DOMAIN}/jobs` };
  }

  // Track click (fire and forget)
  void supabase
    .from('url_clicks')
    .insert({
      short_id: shortId,
      job_id: job.id,
      clicked_at: new Date().toISOString(),
    })
    .then(() => console.log('✅ Click tracked for:', shortId));

  // Build the full job URL
  const jobSlug = job.public_slug || `job-${job.short_id}`;
  const redirectUrl = `${DOMAIN}/job/${jobSlug}`;

  return { redirect: true, url: redirectUrl };
}

async function handleJobUrl(supabase: SupabaseClient, identifier: string): Promise<UrlResult> {
  console.log('🔗 Looking up job:', identifier);

  let job: JobRecord | null = null;

  // Check if it's a UUID
  if (isValidUUID(identifier)) {
    const { data, error } = await supabase
      .from('jobs')
      .select('id, title, public_slug, short_id, status')
      .eq('id', identifier)
      .maybeSingle();

    if (!error && data) {
      job = data as JobRecord;
    }
  }

  // If not found by UUID, try by slug
  if (!job) {
    // Extract short_id from slug (e.g., "hello-world--abc123" -> "abc123")
    const slugParts = identifier.split('--');
    const shortId = slugParts[slugParts.length - 1];

    if (shortId && shortId.length >= 6) {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, title, public_slug, short_id, status')
        .eq('short_id', shortId)
        .maybeSingle();

      if (!error && data) {
        job = data as JobRecord;
      }
    }
  }

  // If still not found, try exact slug match
  if (!job) {
    const { data, error } = await supabase
      .from('jobs')
      .select('id, title, public_slug, short_id, status')
      .eq('public_slug', identifier)
      .maybeSingle();

    if (!error && data) {
      job = data as JobRecord;
    }
  }

  if (!job) {
    console.log('❌ Job not found:', identifier);
    return { redirect: true, url: `${DOMAIN}/jobs` };
  }

  // Check if job is active
  if (job.status !== 'open' && job.status !== 'active') {
    console.log('⚠️ Job not active:', job.id);
    return { redirect: true, url: `${DOMAIN}/jobs` };
  }

  // Build the canonical URL
  const jobSlug = job.public_slug || `job-${job.short_id}`;
  const redirectUrl = `${DOMAIN}/job/${jobSlug}`;

  return { redirect: true, url: redirectUrl };
}

async function handleCompanyUrl(supabase: SupabaseClient, identifier: string): Promise<UrlResult> {
  console.log('🔗 Looking up company:', identifier);

  let company: CompanyRecord | null = null;

  // Check if it's a UUID
  if (isValidUUID(identifier)) {
    const { data, error } = await supabase
      .from('companies')
      .select('id, company_name, account_status')
      .eq('id', identifier)
      .maybeSingle();

    if (!error && data) {
      company = data as CompanyRecord;
    }
  }

  // Try by user_id
  if (!company && isValidUUID(identifier)) {
    const { data, error } = await supabase
      .from('companies')
      .select('id, company_name, account_status')
      .eq('user_id', identifier)
      .maybeSingle();

    if (!error && data) {
      company = data as CompanyRecord;
    }
  }

  if (!company) {
    console.log('❌ Company not found:', identifier);
    return { redirect: true, url: `${DOMAIN}/employers` };
  }

  // Check if company is active
  if (company.account_status !== 'active') {
    console.log('⚠️ Company not active:', company.id);
    return { redirect: true, url: `${DOMAIN}/employers` };
  }

  return { redirect: true, url: `${DOMAIN}/company/${company.id}` };
}

async function handleBlogUrl(supabase: SupabaseClient, slug: string): Promise<UrlResult> {
  console.log('🔗 Looking up blog:', slug);

  const { data, error } = await supabase
    .from('blog_posts')
    .select('id, slug, is_published')
    .eq('slug', slug)
    .maybeSingle();

  const post = data as BlogRecord | null;

  if (error || !post) {
    console.log('❌ Blog post not found:', slug);
    return { redirect: true, url: `${DOMAIN}/blog` };
  }

  if (!post.is_published) {
    console.log('⚠️ Blog post not published:', slug);
    return { redirect: true, url: `${DOMAIN}/blog` };
  }

  return { redirect: true, url: `${DOMAIN}/blog/${post.slug}` };
}

function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}
