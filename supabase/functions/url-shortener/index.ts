import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { WEBSITE_DOMAIN } from "../_shared/domain.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DOMAIN = WEBSITE_DOMAIN;

interface ShortUrlRecord {
  short_id: string;
  job_id: string;
  created_at: string;
  click_count: number;
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


    // GET /url-shortener?k=KEY - email attachment download (fresh signed URL every click)
    const fileKey = (url.searchParams.get('k') || '').trim();
    if (req.method === 'GET' && fileKey) {
      if (!/^[A-Za-z0-9_-]{6,64}$/.test(fileKey)) {
        return new Response('Invalid link', { status: 400, headers: corsHeaders });
      }

      const { data: row, error: rowErr } = await supabase
        .from('mail_attachment_links')
        .select('storage_path, filename')
        .eq('key', fileKey)
        .maybeSingle();

      if (rowErr || !row) {
        return new Response('File link not found or expired', { status: 404, headers: corsHeaders });
      }

      const { data: signed, error: signErr } = await supabase.storage
        .from('temp-downloads')
        .createSignedUrl(row.storage_path, 300, { download: row.filename || 'attachment' });

      if (signErr || !signed?.signedUrl) {
        console.error('[mail-file] sign failed', signErr?.message);
        return new Response('File temporarily unavailable', { status: 500, headers: corsHeaders });
      }

      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, Location: signed.signedUrl, 'Cache-Control': 'no-store' },
      });
    }

    // GET /url-shortener/:shortId - Redirect to job
    if (req.method === 'GET' && pathParts.length === 2) {
      const shortId = pathParts[1];
      
      console.log('🔗 Redirecting short URL:', shortId);

      // Look up the job_id from short_id
      const { data: job, error } = await supabase
        .from('jobs')
        .select('id, title, public_slug, short_id, status')
        .eq('short_id', shortId)
        .maybeSingle();

      if (error || !job) {
        console.error('❌ Short URL not found:', shortId, error);
        // Redirect to jobs page instead of 404
        return new Response(null, {
          status: 302,
          headers: { ...corsHeaders, 'Location': `${DOMAIN}/jobs` },
        });
      }

      // Check if job is active
      if (job.status !== 'open' && job.status !== 'active') {
        console.log('⚠️ Job not active:', job.id, 'Status:', job.status);
        return new Response(null, {
          status: 302,
          headers: { ...corsHeaders, 'Location': `${DOMAIN}/jobs` },
        });
      }

      // Track the click (fire and forget)
      void supabase
        .from('url_clicks')
        .insert({
          short_id: shortId,
          job_id: job.id,
          clicked_at: new Date().toISOString(),
          referrer: req.headers.get('referer'),
          user_agent: req.headers.get('user-agent'),
        })
        .then(() => console.log('✅ Click tracked'));

      // Build SEO-friendly URL with public_slug
      const jobSlug = job.public_slug || `job-${job.short_id}`;
      const redirectUrl = `${DOMAIN}/job/${jobSlug}`;
      
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          'Location': redirectUrl,
        },
      });
    }

    // POST /url-shortener - Create short URL
    if (req.method === 'POST') {
      const { job_id } = await req.json();

      if (!job_id) {
        return new Response(
          JSON.stringify({ error: 'job_id is required' }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      // Check if job exists and get its short_id
      const { data: job, error } = await supabase
        .from('jobs')
        .select('id, short_id, title')
        .eq('id', job_id)
        .maybeSingle();

      if (error || !job) {
        return new Response(
          JSON.stringify({ error: 'Job not found' }),
          { 
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      const shortUrl = `${DOMAIN}/j/${job.short_id}`;

      return new Response(
        JSON.stringify({
          short_url: shortUrl,
          short_id: job.short_id,
          job_id: job.id,
          job_title: job.title,
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ URL shortener error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
