import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { getOwnerSecret } from '../_shared/ownerSecrets.ts';
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ===== Google Calendar Festival Sync (merged from sync-google-calendar-festivals) =====
const INDIAN_HOLIDAYS_CALENDAR_ID = 'en.indian#holiday@group.v.calendar.google.com';
const FESTIVAL_ROW_NAME = 'Google Calendar API JSON';

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '').replace(/\s+/g, '');
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}
function b64url(input: string | Uint8Array): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let bin = '';
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function getGoogleAccessToken(sa: { client_email: string; private_key: string; token_uri: string }) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/calendar.readonly',
    aud: sa.token_uri, iat: now, exp: now + 3600,
  };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const key = await crypto.subtle.importKey('pkcs8', pemToArrayBuffer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned)));
  const jwt = `${unsigned}.${b64url(sig)}`;
  const res = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Token exchange failed: ${JSON.stringify(json)}`);
  return json.access_token as string;
}
async function syncIndianFestivals(supabaseClient: any): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    // Prefer the secret saved on the Owner Portal Secrets page; fall back to env.
    const saRaw = (await getOwnerSecret('GOOGLE_CALENDAR_API_JSON')) ?? Deno.env.get('GOOGLE_CALENDAR_API_JSON');
    if (!saRaw) return { success: false, error: 'GOOGLE_CALENDAR_API_JSON not configured' };
    const sa = JSON.parse(saRaw);
    const token = await getGoogleAccessToken(sa);
    const year = new Date().getUTCFullYear();
    const timeMin = `${year}-01-01T00:00:00Z`;
    const timeMax = `${year + 1}-12-31T23:59:59Z`;
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(INDIAN_HOLIDAYS_CALENDAR_ID)}/events?singleEvents=true&orderBy=startTime&maxResults=2500&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`;
    const calRes = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const calJson = await calRes.json();
    if (!calRes.ok) throw new Error(`Calendar API failed [${calRes.status}]: ${JSON.stringify(calJson)}`);
    const festivals = (calJson.items ?? [])
      .map((ev: any) => ({
        date: ev.start?.date ?? ev.start?.dateTime?.slice(0, 10) ?? '',
        name: ev.summary ?? '',
      }))
      .filter((f: any) => f.date && f.name)
      .sort((a: any, b: any) => a.date.localeCompare(b.date));
    const data = {
      source: 'Google Calendar API - Indian Holidays (en.indian#holiday@group.v.calendar.google.com)',
      country: 'India', year, synced_at: new Date().toISOString(), festivals,
    };
    const { error } = await supabaseClient.from('google_calendar_api')
      .upsert({ name: FESTIVAL_ROW_NAME, data, updated_at: new Date().toISOString() }, { onConflict: 'name' });
    if (error) throw new Error(`DB upsert failed: ${error.message}`);
    return { success: true, count: festivals.length };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('Festival sync error:', msg);
    return { success: false, error: msg };
  }
}
// ===== End festival sync =====

interface CleanupResult {
  table: string;
  deleted: number;
  error?: string;
}

interface CleanupConfig {
  table: string;
  dateColumn: string;
  retentionDays: number;
}

// Default cleanup configurations
// OPTIMIZED: Aggressive retention to protect Disk IO Budget
const CLEANUP_CONFIGS: CleanupConfig[] = [
  { table: 'live_sessions', dateColumn: 'last_seen', retentionDays: 1 },
  { table: 'service_health_checks', dateColumn: 'checked_at', retentionDays: 1 },
  { table: 'whatsapp_webhook_logs', dateColumn: 'created_at', retentionDays: 3 },
  { table: 'search_history', dateColumn: 'created_at', retentionDays: 3 },
  { table: 'interview_cleanup_logs', dateColumn: 'cleanup_date', retentionDays: 3 },
  { table: 'api_health_checks', dateColumn: 'checked_at', retentionDays: 1 },
  { table: 'function_logs', dateColumn: 'created_at', retentionDays: 2 },
  { table: 'api_request_logs', dateColumn: 'created_at', retentionDays: 30 },
  { table: 'daily_unique_visitors', dateColumn: 'visit_date', retentionDays: 7 },
  { table: 'ai_response_cache', dateColumn: 'last_accessed_at', retentionDays: 7 },
  { table: 'cached_audio', dateColumn: 'last_accessed_at', retentionDays: 7 },
  { table: 'job_interactions', dateColumn: 'created_at', retentionDays: 3 },
  { table: 'otp_codes', dateColumn: 'created_at', retentionDays: 1 },
  { table: 'telegram_messages', dateColumn: 'created_at', retentionDays: 3 },
  { table: 'whatsapp_messages', dateColumn: 'created_at', retentionDays: 3 },
  { table: 'whatsapp_trigger_logs', dateColumn: 'created_at', retentionDays: 2 },
  { table: 'push_notification_logs', dateColumn: 'created_at', retentionDays: 2 },
  { table: 'cleanup_logs', dateColumn: 'executed_at', retentionDays: 3 },
  { table: 'admin_audit_logs', dateColumn: 'created_at', retentionDays: 7 },
  { table: 'ai_data_access_logs', dateColumn: 'created_at', retentionDays: 3 },
  { table: 'company_interactions', dateColumn: 'created_at', retentionDays: 7 },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    console.log('🧹 Starting enhanced cleanup process...');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse request body for options
    let action = '';
    let publicReleaseId = '';
    let cleanupType = 'full';
    let specificTables: string[] = [];
    let triggeredBy = 'manual';
    let userId: string | null = null;

    try {
      const body = await req.json();
      action = typeof body.action === 'string' ? body.action : '';
      publicReleaseId = typeof body.public_release_id === 'string' ? body.public_release_id : '';
      cleanupType = body.cleanup_type || 'full';
      specificTables = body.tables || [];
      triggeredBy = body.triggered_by || 'manual';
      userId = body.user_id || null;
    } catch (e) {
      // No body or invalid JSON, use defaults
    }

    // Publishing a newer Android release must remove every older release record
    // and its exact versioned R2 APK. Never touch the active release or future drafts.
    if (action === 'cleanup_android_releases') {
      if (!publicReleaseId) throw new Error('public_release_id is required');
      const { data: active, error: activeError } = await supabaseClient
        .from('android_app_releases')
        .select('id,version_code,is_published,apk_path')
        .eq('id', publicReleaseId)
        .maybeSingle();
      if (activeError) throw new Error('Could not verify the newly published Android release: ' + activeError.message);
      if (!active || active.is_published !== true) throw new Error('Cleanup refused: target release is not verified as Public');

      const { data: oldRows, error: rowsError } = await supabaseClient
        .from('android_app_releases')
        .select('id,version_code,apk_path')
        .lt('version_code', active.version_code);
      if (rowsError) throw new Error('Could not list older Android releases: ' + rowsError.message);

      const accountId = await getOwnerSecret('R2_ACCOUNT_ID');
      const accessKeyId = await getOwnerSecret('R2_ACCESS_KEY_ID');
      const secretAccessKey = await getOwnerSecret('R2_SECRET_ACCESS_KEY');
      if (!accountId || !accessKeyId || !secretAccessKey) {
        throw new Error('R2_ACCOUNT_ID, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY must be configured in Owner Secrets');
      }
      const r2 = new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' });
      const bucket = 'workly-android-releases';
      const deletedObjects: string[] = [];
      for (const row of oldRows ?? []) {
        const url = new URL(row.apk_path);
        const expectedKey = 'android/releases/android-v' + row.version_code + '/Workly-India.apk';
        const expectedPath = '/' + bucket + '/' + expectedKey;
        if (url.hostname !== 'pub-e8cec40741a24d08bc49bd0c7070f8f3.r2.dev' || url.pathname !== '/' + expectedKey) {
          // GitHub archival URLs or legacy Supabase paths have no R2 object to delete.
          continue;
        }
        const objectUrl = 'https://' + accountId + '.r2.cloudflarestorage.com' + expectedPath;
        const response = await r2.fetch(new Request(objectUrl, { method: 'DELETE' }));
        if (!response.ok && response.status !== 404) {
          throw new Error('R2 deletion failed for version ' + row.version_code + ' [' + response.status + ']');
        }
        deletedObjects.push(expectedKey);
      }

      const ids = (oldRows ?? []).map((row: any) => row.id);
      let deletedRows: any[] = [];
      if (ids.length) {
        const { data, error } = await supabaseClient.from('android_app_releases')
          .delete().in('id', ids).select('id');
        if (error) throw new Error('Old Android release records could not be deleted: ' + error.message);
        deletedRows = data ?? [];
      }
      const { data: verifyActive, error: verifyError } = await supabaseClient
        .from('android_app_releases').select('id,is_published').eq('id', publicReleaseId).maybeSingle();
      if (verifyError || !verifyActive || verifyActive.is_published !== true) {
        throw new Error('Post-cleanup verification failed: active Public release is missing');
      }
      const { data: remaining, error: remainingError } = await supabaseClient
        .from('android_app_releases').select('id,version_code').lt('version_code', active.version_code);
      if (remainingError || (remaining?.length ?? 0) > 0) {
        throw new Error('Post-cleanup verification failed: older release records remain');
      }
      return new Response(JSON.stringify({
        success: true,
        action,
        active_release_id: publicReleaseId,
        deleted_database_rows: deletedRows.length,
        deleted_r2_apks: deletedObjects.length,
        deleted_r2_keys: deletedObjects,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    // Get custom retention periods if set
    const { data: settingsData } = await supabaseClient
      .from('cleanup_schedule_settings')
      .select('setting_value')
      .eq('setting_key', 'retention_periods')
      .single();

    const customRetentions = settingsData?.setting_value || {};

    // Determine which configs to use
    let configsToUse = CLEANUP_CONFIGS;
    
    if (cleanupType === 'light') {
      // Light cleanup: only high-frequency tables
      configsToUse = CLEANUP_CONFIGS.filter(c => 
        ['live_sessions', 'otp_codes', 'api_health_checks', 'service_health_checks'].includes(c.table)
      );
    } else if (cleanupType === 'specific' && specificTables.length > 0) {
      configsToUse = CLEANUP_CONFIGS.filter(c => specificTables.includes(c.table));
    }

    const results: CleanupResult[] = [];

    for (const config of configsToUse) {
      try {
        // Use custom retention if available
        const retentionDays = customRetentions[config.table] || config.retentionDays;
        const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
        
        let cutoffValue: string;
        if (config.dateColumn === 'visit_date' || config.dateColumn === 'cleanup_date') {
          cutoffValue = cutoffDate.toISOString().split('T')[0];
        } else {
          cutoffValue = cutoffDate.toISOString();
        }

        console.log(`🗑️ Cleaning ${config.table} (retention: ${retentionDays} days)...`);

        const { data: deleted, error } = await supabaseClient
          .from(config.table)
          .delete()
          .lt(config.dateColumn, cutoffValue)
          .select('id');

        results.push({
          table: config.table,
          deleted: deleted?.length || 0,
          error: error?.message
        });

        if (deleted && deleted.length > 0) {
          console.log(`✅ Deleted ${deleted.length} rows from ${config.table}`);
        }
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        console.error(`❌ Error cleaning ${config.table}:`, errorMessage);
        results.push({
          table: config.table,
          deleted: 0,
          error: errorMessage
        });
      }
    }

    // Calculate summary
    const totalDeleted = results.reduce((sum, r) => sum + r.deleted, 0);
    const successfulTables = results.filter(r => !r.error).length;
    const failedTables = results.filter(r => r.error).length;
    const executionTime = Date.now() - startTime;

    // Log the cleanup execution
    await supabaseClient
      .from('cleanup_execution_logs')
      .insert({
        executed_by: userId,
        total_deleted: totalDeleted,
        tables_cleaned: results,
        execution_time_ms: executionTime,
        triggered_by: triggeredBy,
        cleanup_type: cleanupType
      });

    console.log('✅ Enhanced cleanup completed!');
    console.log(`📊 Total records deleted: ${totalDeleted}`);
    console.log(`⏱️ Execution time: ${executionTime}ms`);

    // Sync Indian festivals daily (only on full cleanup runs)
    let festivalSync: any = { skipped: true };
    if (cleanupType === 'full') {
      console.log('🎉 Syncing Indian festivals from Google Calendar...');
      festivalSync = await syncIndianFestivals(supabaseClient);
      console.log('🎉 Festival sync result:', festivalSync);
    }

    return new Response(JSON.stringify({
      success: true,
      timestamp: new Date().toISOString(),
      cleanup_type: cleanupType,
      summary: {
        total_deleted: totalDeleted,
        successful_tables: successfulTables,
        failed_tables: failedTables,
        execution_time_ms: executionTime
      },
      details: results,
      festival_sync: festivalSync
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error('❌ Enhanced cleanup failed:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      execution_time_ms: executionTime,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
