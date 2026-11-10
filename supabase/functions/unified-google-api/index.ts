import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { WEBSITE_DOMAIN } from "../_shared/domain.ts";
import { getOwnerSecret, getOwnerSecretJson } from "../_shared/ownerSecrets.ts";
import { handleGoogleUserConnect, handleGoogleUserCallback } from "../_shared/googleUserFlow.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SITE_URL = WEBSITE_DOMAIN;
const INDEXNOW_KEY = 'ed2e1bf9c3074d8b992f21a2f6e2c80e';

// ==================== SHARED AUTH UTILITIES ====================
interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
  project_id?: string;
}

const GOOGLE_SCOPES = {
  SHEETS: 'https://www.googleapis.com/auth/spreadsheets',
  DRIVE: 'https://www.googleapis.com/auth/drive',
  DRIVE_FILE: 'https://www.googleapis.com/auth/drive.file',
  ANALYTICS: 'https://www.googleapis.com/auth/analytics.readonly',
  INDEXING: 'https://www.googleapis.com/auth/indexing',
  CSE: 'https://www.googleapis.com/auth/cse'
};

function parseServiceAccountKey(keyName?: string): ServiceAccountCredentials {
  const envKey = keyName || 'GOOGLE_SERVICE_ACCOUNT_KEY';
  const serviceAccountKey = Deno.env.get(envKey);
  if (!serviceAccountKey) throw new Error(`${envKey} not configured`);
  const sa = JSON.parse(serviceAccountKey);
  if (!sa.client_email || !sa.private_key) throw new Error('Invalid service account');
  return sa;
}

async function getGoogleAccessToken(sa: ServiceAccountCredentials, scopes: string | string[]): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const scopeString = Array.isArray(scopes) ? scopes.join(' ') : scopes;
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = { iss: sa.client_email, scope: scopeString, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 };
  const jwt = await createSignedJWT(header, payload, sa.private_key);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt })
  });
  if (!res.ok) throw new Error(`Token error: ${await res.text()}`);
  return (await res.json()).access_token;
}

async function createSignedJWT(header: any, payload: any, privateKey: string): Promise<string> {
  const b64url = (s: string) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const encH = b64url(JSON.stringify(header)), encP = b64url(JSON.stringify(payload));
  const input = `${encH}.${encP}`;
  const pem = privateKey.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g, '');
  const key = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pem), c => c.charCodeAt(0)), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(input));
  return `${input}.${b64url(String.fromCharCode(...new Uint8Array(sig)))}`;
}

// ==================== OAuth popup bounce-backs ====================

/** 302 the browser back to a page on the site that started the connect. */
function bounceTo(siteOrigin: string, sitePath: string, requestUrl: URL, extraState?: string): Response {
  let base: URL;
  try {
    base = new URL(sitePath, /^https?:\/\//.test(siteOrigin) ? siteOrigin : requestUrl.origin);
  } catch {
    base = new URL(sitePath, requestUrl.origin);
  }
  for (const key of ['code', 'error', 'error_description', 'scope']) {
    const value = requestUrl.searchParams.get(key);
    if (value) base.searchParams.set(key, value);
  }
  if (extraState) base.searchParams.set('state', extraState);
  return new Response(null, { status: 302, headers: { Location: base.toString() } });
}

// ==================== MAIN HANDLER ====================
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const requestUrl = new URL(req.url);
    // Google OAuth redirect for per-user connections (AdSense, Search Console, Analytics, Drive).
    if (req.method === 'GET' && requestUrl.searchParams.has('state')) {
      const state = requestUrl.searchParams.get('state') || '';
      // Gmail popup flow: state = "wfh_gmail|<scope>|<site origin>".
      // Developer customer Gmail connect: state = "wfh_subgmail||<site origin>".
      if (state.startsWith('wfh_subgmail|')) {
        return bounceTo(state.split('|')[2] || '', '/connect/gmail', requestUrl);
      }
      if (state.startsWith('wfh_gmail|')) {
        const [, scope = '', origin = ''] = state.split('|');
        return bounceTo(origin, '/oauth/gmail/return', requestUrl, scope || undefined);
      }
      // YouTube full-page flow: state = "wfh_yt|<userId>:<uuid>|<site origin>".
      if (state.startsWith('wfh_yt|')) {
        const origin = state.split('|')[2] || '';
        return bounceTo(origin, '/ai-assistant', requestUrl);
      }
      return await handleGoogleUserCallback(req);
    }
    const body = req.method === 'GET'
      ? Object.fromEntries(requestUrl.searchParams.entries())
      : await req.json();
    const { service, ...params } = body;

    console.log(`[unified-google-api] Service: ${service}`);

    switch (service) {
      case 'user_connect': return await handleGoogleUserConnect(req, params);
      case 'analytics': return await handleAnalytics(params);
      case 'search': return await handleCustomSearch(req, params);
      case 'drive': return await handleDriveInvoices(params);
      case 'indexing': return await handleIndexing(params);
      case 'sheets': return await handleSheetsSync(params);
      default:
        return new Response(JSON.stringify({ error: 'Invalid service. Use: analytics, search, drive, indexing, sheets' }), 
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  } catch (error: any) {
    console.error('[unified-google-api] Error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

// ==================== ANALYTICS ====================
async function handleAnalytics(params: any) {
  const { type = 'daily', propertyId, dateRange } = params;
  const sa = parseServiceAccountKey();
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  
  let ga4PropertyId = propertyId;
  if (!ga4PropertyId) {
    const { data } = await supabase.from('app_settings').select('setting_value').eq('setting_key', 'ga4_property_id').single();
    ga4PropertyId = data?.setting_value;
  }
  if (!ga4PropertyId) return new Response(JSON.stringify({ success: false, error: 'GA4 Property ID not configured' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  if (!ga4PropertyId.startsWith('properties/')) ga4PropertyId = `properties/${ga4PropertyId}`;

  const token = await getGoogleAccessToken(sa, GOOGLE_SCOPES.ANALYTICS);
  const results: any = {};

  if (type === 'daily' || type === 'all') {
    const today = new Date().toISOString().split('T')[0];
    const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/${ga4PropertyId}:runReport`, {
      method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ dateRanges: [{ startDate: today, endDate: today }], metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }] })
    });
    results.daily = res.ok ? await res.json() : { error: await res.text() };
  }

  if (type === 'realtime' || type === 'all') {
    const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/${ga4PropertyId}:runRealtimeReport`, {
      method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ metrics: [{ name: 'activeUsers' }] })
    });
    results.realtime = res.ok ? await res.json() : { error: await res.text() };
  }

  return new Response(JSON.stringify({ success: true, data: results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// ==================== CUSTOM SEARCH ====================
// The Secrets page boxes may hold either a plain value or a pasted JSON blob.
// Only a real API key is usable there — a service-account JSON is not one.
async function ownerCustomSearchKey(): Promise<string | null> {
  const raw = await getOwnerSecret('GOOGLE_CUSTOM_SEARCH_API_KEY');
  if (!raw) return null;
  if (!raw.startsWith('{')) return raw;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const candidate = parsed.api_key ?? parsed.apiKey;
    return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null;
  } catch {
    return null;
  }
}

async function handleCustomSearch(req: Request, params: any) {
  const { action = 'search', query, imageUrl, start = 1, searchType = 'image', imgSize, num = 10, dateRestrict, sort, gl, hl } = params;
  const saKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY_Custom_Search') || Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');
  // Prefer the Custom Search JSON saved on the Owner Portal Secrets page, then
  // the individual boxes on that page, then Supabase env secrets.
  const cseJson = await getOwnerSecretJson('GOOGLE_CUSTOM_SEARCH_JSON');
  const searchEngineId =
    (cseJson?.cx as string) || (cseJson?.search_engine_id as string) ||
    (await getOwnerSecret('GOOGLE_CUSTOM_SEARCH_ENGINE_ID')) ||
    Deno.env.get('GOOGLE_CUSTOM_SEARCH_ENGINE_ID');
  const apiKey =
    (cseJson?.api_key as string) || (await ownerCustomSearchKey()) ||
    Deno.env.get('GOOGLE_CUSTOM_SEARCH_API_KEY');

  if (action === 'test') {
    return new Response(JSON.stringify({ success: true, config: { saConfigured: !!saKey, cseConfigured: !!searchEngineId, apiKeyConfigured: !!apiKey } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  if (action === 'proxy' && imageUrl) {
    let parsedImageUrl: URL;
    try {
      parsedImageUrl = new URL(String(imageUrl));
    } catch {
      return new Response(JSON.stringify({ success: false, error: 'Invalid image URL' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!['http:', 'https:'].includes(parsedImageUrl.protocol)) {
      return new Response(JSON.stringify({ success: false, error: 'Unsupported image URL' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const imgRes = await fetch(parsedImageUrl.toString(), {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
    });
    if (!imgRes.ok) throw new Error(`Proxy failed: ${imgRes.status}`);
    const contentType = imgRes.headers.get('content-type') || '';
    if (!contentType.toLowerCase().startsWith('image/')) {
      return new Response(JSON.stringify({ success: false, error: 'The source did not return an image' }), { status: 415, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    return new Response(await imgRes.arrayBuffer(), {
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, s-maxage=604800',
      },
    });
  }

  if (action === 'download' && imageUrl) {
    const imgRes = await fetch(imageUrl, { headers: { 'User-Agent': 'Mozilla/5.0 Chrome/120.0' } });
    if (!imgRes.ok) throw new Error(`Download failed: ${imgRes.status}`);
    const ab = await imgRes.arrayBuffer();
    const u8 = new Uint8Array(ab);
    let bin = ''; const cs = 8192;
    for (let i = 0; i < u8.length; i += cs) bin += String.fromCharCode.apply(null, Array.from(u8.subarray(i, Math.min(i + cs, u8.length))));
    return new Response(JSON.stringify({ success: true, data: btoa(bin), contentType: imgRes.headers.get('content-type'), size: ab.byteLength }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  if (!searchEngineId) throw new Error('GOOGLE_CUSTOM_SEARCH_ENGINE_ID not configured');
  if (!query) throw new Error('Search query required');

  const wantsImages = String(searchType) !== 'web';

  const url = new URL('https://www.googleapis.com/customsearch/v1');
  url.searchParams.set('cx', searchEngineId);
  url.searchParams.set('q', query);
  url.searchParams.set('num', String(Math.max(1, Math.min(10, Number(num) || 10))));
  url.searchParams.set('start', start.toString());
  if (wantsImages) {
    url.searchParams.set('searchType', 'image');
    // HD / large images only, like Google Images "Large" filter
    url.searchParams.set('imgSize', String(imgSize || 'xlarge'));
    url.searchParams.set('safe', 'active');
  }
  // News / freshness + locale controls (used by the AI chat search)
  if (dateRestrict) url.searchParams.set('dateRestrict', String(dateRestrict));
  if (sort) url.searchParams.set('sort', String(sort));
  url.searchParams.set('gl', String(gl || 'in'));
  url.searchParams.set('hl', String(hl || 'en'));


  let res: Response;
  if (saKey) {
    const sa = JSON.parse(saKey);
    const token = await getGoogleAccessToken(sa, GOOGLE_SCOPES.CSE);
    res = await fetch(url.toString(), { headers: { 'Authorization': `Bearer ${token}` } });
  } else if (apiKey) {
    url.searchParams.set('key', apiKey);
    res = await fetch(url.toString());
  } else throw new Error('No auth configured');

  if (!res.ok) throw new Error(`Search error: ${res.status}`);
  const data = await res.json();
  const results = (data.items || []).map((i: any, idx: number) => {
    if (wantsImages) {
      return {
        position: Number(start) + idx,
        title: i.title,
        link: i.image?.contextLink || i.link,
        imageUrl: i.link,
        originalImage: i.link,
        thumbnail: i.image?.thumbnailLink || i.link,
        snippet: i.snippet || i.title,
        displayLink: i.displayLink,
        width: i.image?.width,
        height: i.image?.height,
      };
    }
    const pm = i.pagemap || {};
    const meta = pm.metatags?.[0] || {};
    return {
      position: Number(start) + idx,
      title: i.title,
      link: i.link,
      formattedUrl: i.formattedUrl || i.link,
      snippet: i.snippet || '',
      displayLink: i.displayLink,
      siteName: meta['og:site_name'] || i.displayLink,
      publishedDate: meta['article:published_time'] || meta['og:updated_time'] ||
        pm.newsarticle?.[0]?.datepublished || pm.article?.[0]?.datepublished || null,
      thumbnail: pm.cse_thumbnail?.[0]?.src || meta['og:image'] || null,
      favicon: i.displayLink
        ? `https://www.google.com/s2/favicons?sz=64&domain=${i.displayLink}`
        : null,
      rating: pm.aggregaterating?.[0]?.ratingvalue || null,
      address: pm.postaladdress?.[0]?.streetaddress || meta['business:contact_data:street_address'] || null,
      phone: pm.organization?.[0]?.telephone || meta['business:contact_data:phone_number'] || null,
    };
  });
  return new Response(JSON.stringify({ success: true, query, searchType: wantsImages ? 'image' : 'web', totalResults: data.searchInformation?.totalResults, searchTime: data.searchInformation?.searchTime, results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

}

// ==================== DRIVE INVOICES ====================
async function handleDriveInvoices(params: any) {
  const { transactionId, folderId, testUpload, testFileName, testContent } = params;
  // Prefer the secret saved on the Owner Portal Secrets page; fall back to env.
  let sa = (await getOwnerSecretJson('GOOGLE_DRIVE_API_JSON')) as unknown as ServiceAccountCredentials | null;
  if (!sa?.client_email || !sa?.private_key) {
    try { sa = parseServiceAccountKey(); } catch { sa = null; }
  }
  if (!sa) return new Response(JSON.stringify({ success: false, error: 'Google Drive service account JSON not configured — save it on the Owner Portal Secrets page' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  let targetFolderId = folderId;
  if (!targetFolderId) {
    const { data } = await supabase.from('app_settings').select('setting_value').eq('setting_key', 'google_drive_invoices_folder').single();
    targetFolderId = data?.setting_value;
  }
  if (!targetFolderId) return new Response(JSON.stringify({ success: false, error: 'Drive folder ID not configured' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const token = await getGoogleAccessToken(sa, [GOOGLE_SCOPES.DRIVE, GOOGLE_SCOPES.DRIVE_FILE]);

  if (testUpload) {
    const fn = testFileName || `test-${Date.now()}.txt`;
    const content = testContent || `Test upload at ${new Date().toISOString()}`;
    const meta = { name: fn, mimeType: 'text/plain', parents: [targetFolderId] };
    const boundary = 'foo_bar';
    const body = `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: text/plain\r\n\r\n${content}\r\n--${boundary}--`;
    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` }, body
    });
    if (!res.ok) throw new Error(`Upload failed: ${await res.text()}`);
    const fileData = await res.json();
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileData.id}/permissions`, {
      method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'reader', type: 'anyone' })
    });
    return new Response(JSON.stringify({ success: true, fileId: fileData.id, driveUrl: `https://drive.google.com/file/d/${fileData.id}/view` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ success: true, message: 'Drive API ready', folderId: targetFolderId }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// ==================== INDEXING API ====================
async function handleIndexing(params: any) {
  const { urls, type, action = 'URL_UPDATED' } = params;
  // Prefer the Web Search Indexing API JSON saved on the Owner Secrets page (site/web page indexing),
  // then the job Indexing API Bot JSON, then fall back to env keys.
  let sa = (await getOwnerSecretJson('GOOGLE_WEB_SEARCH_INDEXING_API_JSON')) as unknown as ServiceAccountCredentials | null;
  if (!sa || !sa.client_email || !sa.private_key) {
    sa = (await getOwnerSecretJson('GOOGLE_INDEXING_API_JSON')) as unknown as ServiceAccountCredentials | null;
  }
  if (!sa || !sa.client_email || !sa.private_key) {
    try { sa = parseServiceAccountKey('GOOGLE_SERVICE_ACCOUNT_KEY_INDEX'); } catch {
      try { sa = parseServiceAccountKey(); } catch { sa = null; }
    }
  }
  if (!sa) return new Response(JSON.stringify({ success: false, error: 'Google Indexing service account not configured. Save Web Search Indexing API JSON on the Owner Secrets page.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const token = await getGoogleAccessToken(sa, GOOGLE_SCOPES.INDEXING);

  let urlsToSubmit: string[] = urls || [];
  if (!urls && type) urlsToSubmit = await getUrlsByType(supabase, type);
  if (urlsToSubmit.length === 0) return new Response(JSON.stringify({ success: true, message: 'No URLs', submitted: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  let success = 0, failed = 0;
  for (const url of urlsToSubmit.slice(0, 200)) {
    try {
      const res = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, type: action })
      });
      if (res.ok) { success++; await submitToIndexNow(url); } else failed++;
    } catch { failed++; }
  }

  return new Response(JSON.stringify({ success: true, submitted: success, failed }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function getUrlsByType(supabase: any, type: string): Promise<string[]> {
  if (type === 'static-pages') return [`${SITE_URL}/`, `${SITE_URL}/jobs`, `${SITE_URL}/blog`, `${SITE_URL}/hiring-companies`];
  if (type === 'new-jobs') {
    const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
    const { data } = await supabase.from('jobs').select('public_slug').eq('status', 'active').gte('created_at', oneDayAgo).limit(100);
    return (data || []).map((j: any) => `${SITE_URL}/job/${j.public_slug}`);
  }
  return [];
}

async function submitToIndexNow(url: string): Promise<boolean> {
  try { const res = await fetch(`https://www.bing.com/indexnow?url=${encodeURIComponent(url)}&key=${INDEXNOW_KEY}`); return res.ok; } catch { return false; }
}

// ==================== SHEETS SYNC ====================
async function handleSheetsSync(params: any) {
  const { type = 'jobs', spreadsheetId, sheetName = 'Data' } = params;
  let sa = (await getOwnerSecretJson('GOOGLE_SHEETS_API_JSON')) as unknown as ServiceAccountCredentials | null;
  if (!sa || !sa.client_email || !sa.private_key) {
    try { sa = parseServiceAccountKey(); } catch { sa = null; }
  }
  if (!sa) return new Response(JSON.stringify({ success: false, error: 'Google Sheets service account not configured. Save Sheets API JSON on the Owner Secrets page.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  let sheetId = spreadsheetId;
  if (!sheetId) {
    const { data } = await supabase.from('app_settings').select('setting_value').eq('setting_key', `google_sheets_${type}_id`).single();
    sheetId = data?.setting_value;
  }
  if (!sheetId) return new Response(JSON.stringify({ success: false, error: 'Spreadsheet ID not configured' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const token = await getGoogleAccessToken(sa, GOOGLE_SCOPES.SHEETS);
  
  let data: string[][] = [['No data']];
  if (type === 'jobs') {
    const { data: jobs } = await supabase.from('jobs').select('id, title, status, created_at').eq('status', 'active').limit(500);
    data = [['ID', 'Title', 'Status', 'Created'], ...(jobs || []).map((j: any) => [j.id, j.title, j.status, j.created_at])];
  }

  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(sheetName)}:clear`, {
    method: 'POST', headers: { 'Authorization': `Bearer ${token}` }
  });

  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(sheetName)}!A1?valueInputOption=USER_ENTERED`, {
    method: 'PUT', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ range: `${sheetName}!A1`, majorDimension: 'ROWS', values: data })
  });

  if (!res.ok) throw new Error(`Sheets error: ${await res.text()}`);
  return new Response(JSON.stringify({ success: true, rowsWritten: data.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
