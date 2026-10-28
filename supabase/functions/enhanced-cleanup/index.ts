import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { getOwnerSecret } from '../_shared/ownerSecrets.ts';

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
    let cleanupType = 'full';
    let specificTables: string[] = [];
    let triggeredBy = 'manual';
    let userId: string | null = null;

    try {
      const body = await req.json();
      cleanupType = body.cleanup_type || 'full';
      specificTables = body.tables || [];
      triggeredBy = body.triggered_by || 'manual';
      userId = body.user_id || null;
    } catch (e) {
      // No body or invalid JSON, use defaults
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
