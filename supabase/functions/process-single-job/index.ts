import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

import { WEBSITE_DOMAIN } from "../_shared/domain.ts";
import { getOwnerSecretJson } from "../_shared/ownerSecrets.ts";
const INDEXNOW_KEY = Deno.env.get('INDEXNOW_KEY') || '4b6258d87a9945a7b7c142a90c49d4dc';
const SITE_URL = WEBSITE_DOMAIN;
const DAILY_QUOTA_LIMIT = 200;
const EFFECTIVE_LIMIT = 200;

/**
 * PROCESS SINGLE JOB - ONE-BY-ONE INDEXING
 * 
 * Key Features:
 * 1. Processes exactly 1 job per call (no batching)
 * 2. Strict FIFO order (queue_position ASC)
 * 3. 3-second delay built-in after each submission
 * 4. Stops immediately when daily quota (200) reached
 * 5. Preserves original posting time for scheduled jobs
 * 
 * Called every 5 minutes by cron during active hours (1:30 PM - 11:30 PM IST)
 */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Step 1: Check daily quota
    const quotaInfo = await getQuotaInfo(supabase);
    const remainingQuota = DAILY_QUOTA_LIMIT - quotaInfo.quota_used;

    console.log(`[Single Job] Quota: ${quotaInfo.quota_used}/${DAILY_QUOTA_LIMIT}, Remaining: ${remainingQuota}`);

    if (remainingQuota <= 0) {
      console.log('[Single Job] Daily quota exhausted. Waiting for next reset at 1:30 PM IST');
      return new Response(JSON.stringify({
        processed: false,
        reason: 'quota_exhausted',
        quota_used: quotaInfo.quota_used,
        quota_limit: DAILY_QUOTA_LIMIT,
        next_reset: getNextQuotaResetTime()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Step 2: Get SINGLE next pending job (strict FIFO using DB function)
    const { data: nextJob, error: fetchError } = await supabase
      .rpc('get_next_pending_job_for_indexing');

    if (fetchError) {
      console.error('[Single Job] Error fetching next job:', fetchError);
      throw fetchError;
    }

    if (!nextJob || nextJob.length === 0) {
      console.log('[Single Job] No pending jobs in queue');
      return new Response(JSON.stringify({
        processed: false,
        reason: 'queue_empty',
        quota_used: quotaInfo.quota_used,
        quota_remaining: remainingQuota
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const job = nextJob[0];
    console.log(`[Single Job] Processing: Position #${job.queue_position}, URL: ${job.url}`);

    // Step 3: Mark as processing
    await supabase
      .from('google_indexing_queue')
      .update({
        status: 'processing',
        processing_started_at: new Date().toISOString()
      })
      .eq('id', job.id);

    // Step 4: Submit to Google Indexing API
    const googleResult = await submitToGoogleIndexing(job.url, job.action || 'URL_UPDATED');

    const now = new Date().toISOString();

    if (googleResult.success) {
      // SUCCESS: Update queue status
      await supabase
        .from('google_indexing_queue')
        .update({
          status: 'completed',
          processed_at: now,
          google_status: 'submitted',
          google_submitted_at: now,
          last_processed_at: now,
          error_message: null
        })
        .eq('id', job.id);

      // Increment quota usage
      await supabase.rpc('increment_quota_usage', { increment_by: 1 });

      // Update job_indexing_status - NO verification scheduling
      // Once submitted, no more processing until job is edited
      if (job.job_id) {
        await supabase
          .from('job_indexing_status')
          .upsert({
            job_id: job.job_id,
            url: job.url,
            google_status: 'submitted',
            google_submitted_at: now,
            // DISABLED: No verification scheduling
            // next_verification_at: null means no future checks
            next_verification_at: null,
            verification_attempt_count: 0,
            updated_at: now
          }, { onConflict: 'job_id' });
      }

      console.log(`[Single Job] ✅ SUCCESS: Submitted ${job.url}`);

      // Step 5: Wait 3 seconds before completing (rate limit protection)
      await new Promise(resolve => setTimeout(resolve, 3000));

      return new Response(JSON.stringify({
        processed: true,
        success: true,
        job_id: job.job_id,
        url: job.url,
        queue_position: job.queue_position,
        google_submitted_at: now,
        quota_used: quotaInfo.quota_used + 1,
        quota_remaining: remainingQuota - 1,
        duration_ms: Date.now() - startTime
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // FAILED: Handle error
    const isQuotaError = googleResult.error?.includes('429');
    
    if (isQuotaError) {
      // Quota exceeded - reschedule
      await supabase
        .from('google_indexing_queue')
        .update({
          status: 'pending',
          scheduled_for: getNextQuotaResetTime(),
          error_message: 'Quota exceeded - rescheduled',
          last_processed_at: now
        })
        .eq('id', job.id);

      console.log(`[Single Job] ⚠️ Quota exceeded. Rescheduled.`);

      return new Response(JSON.stringify({
        processed: true,
        success: false,
        reason: 'quota_exceeded',
        job_id: job.job_id,
        url: job.url,
        rescheduled_for: getNextQuotaResetTime()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Other error - increment retry count
    const newRetryCount = (job.retry_count || 0) + 1;
    const isPermanent = googleResult.error?.includes('403') || googleResult.error?.includes('INVALID');

    await supabase
      .from('google_indexing_queue')
      .update({
        status: isPermanent || newRetryCount >= 5 ? 'failed' : 'pending',
        error_message: googleResult.error,
        retry_count: newRetryCount,
        last_processed_at: now,
        scheduled_for: isPermanent ? null : getNextQuotaResetTime()
      })
      .eq('id', job.id);

    console.log(`[Single Job] ❌ FAILED: ${googleResult.error}`);

    return new Response(JSON.stringify({
      processed: true,
      success: false,
      reason: 'api_error',
      error: googleResult.error,
      job_id: job.job_id,
      url: job.url,
      retry_count: newRetryCount,
      will_retry: !isPermanent && newRetryCount < 5
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('[Single Job] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function getQuotaInfo(supabase: any) {
  const today = new Date().toISOString().split('T')[0];
  
  const { data, error } = await supabase
    .from('indexing_daily_quota')
    .select('*')
    .eq('date', today)
    .single();

  if (error || !data) {
    const { data: newRecord } = await supabase
      .from('indexing_daily_quota')
      .insert({ date: today, quota_used: 0, quota_limit: DAILY_QUOTA_LIMIT })
      .select()
      .single();
    
    return newRecord || { date: today, quota_used: 0, quota_limit: DAILY_QUOTA_LIMIT };
  }

  return data;
}

function getNextQuotaResetTime(): string {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset);
  
  const reset = new Date(istNow);
  reset.setHours(13, 30, 0, 0);
  
  if (istNow >= reset) {
    reset.setDate(reset.getDate() + 1);
  }
  
  return new Date(reset.getTime() - istOffset).toISOString();
}

async function submitToGoogleIndexing(
  url: string,
  type: 'URL_UPDATED' | 'URL_DELETED'
): Promise<{ success: boolean; error?: string }> {
  // Prefer the Indexing API Bot JSON saved on the Owner Secrets page, then fall back to the env key.
  let serviceAccountKey: string | null = null;
  try {
    const ownerJson = await getOwnerSecretJson('GOOGLE_INDEXING_API_JSON');
    if (ownerJson?.client_email && ownerJson?.private_key) serviceAccountKey = JSON.stringify(ownerJson);
  } catch { /* fall through to env */ }
  if (!serviceAccountKey) serviceAccountKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY_INDEX');

  if (!serviceAccountKey) {
    return { success: false, error: 'No service account configured. Save Indexing API Bot JSON on the Owner Secrets page.' };
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountKey);
    const accessToken = await getGoogleAccessToken(serviceAccount);
    
    const response = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ url, type })
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${error}` };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function getGoogleAccessToken(serviceAccount: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/indexing',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const base64UrlEncode = (obj: object) => {
    const json = JSON.stringify(obj);
    const base64 = btoa(json);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };

  const headerEncoded = base64UrlEncode(header);
  const payloadEncoded = base64UrlEncode(payload);
  const unsignedToken = `${headerEncoded}.${payloadEncoded}`;

  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  const pemContents = serviceAccount.private_key
    .replace(pemHeader, "")
    .replace(pemFooter, "")
    .replace(/\n/g, "");
  
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    encoder.encode(unsignedToken)
  );

  const signatureArray = new Uint8Array(signature);
  const signatureBase64 = btoa(String.fromCharCode(...signatureArray));
  const signatureBase64Url = signatureBase64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const jwt = `${unsignedToken}.${signatureBase64Url}`;

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const tokenData = await tokenResponse.json();
  
  if (!tokenData.access_token) {
    throw new Error('Failed to get access token');
  }
  
  return tokenData.access_token;
}
