import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { WEBSITE_DOMAIN } from './domain.ts';
import { getOwnerSecret } from './ownerSecrets.ts';

// OAuth app credentials: the Owner Portal Secrets page (public.owner_secrets)
// wins, so stale env values copied from a remixed project never override what
// the owner pasted in the app; edge-function env is only a fallback.
async function vercelClientId() {
  return (await getOwnerSecret('VERCEL_CLIENT_ID')) || Deno.env.get('VERCEL_CLIENT_ID') || '';
}

async function vercelClientSecret() {
  return (await getOwnerSecret('VERCEL_CLIENT_SECRET')) || Deno.env.get('VERCEL_CLIENT_SECRET') || '';
}

async function vercelIntegrationSlug() {
  const raw = (await getOwnerSecret('VERCEL_INTEGRATION_SLUG')) || Deno.env.get('VERCEL_INTEGRATION_SLUG') || '';
  // Accept a pasted marketplace URL like https://vercel.com/integrations/my-app
  const m = raw.match(/integrations\/([^/?#]+)/);
  return (m ? m[1] : raw).trim();
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export const INTEGRATION_ACTIONS = [
  "integrations_list",
  "integrations_link",
  "integrations_unlink",
  "integrations_test",
  "integrations_vercel_auth_url",
  "integrations_supabase_auth_url",
  "integrations_vercel_api",
] as const;
export type IntegrationAction = typeof INTEGRATION_ACTIONS[number];

const VERCEL_AUTHORIZE_URL = 'https://vercel.com/oauth/authorize';
const VERCEL_TOKEN_URL = 'https://api.vercel.com/v2/oauth/access_token';
const VERCEL_API = 'https://api.vercel.com';

type Provider = 'supabase' | 'vercel';

function admin() {
  return createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
  );
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function getUser(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) throw new Error('AUTH_REQUIRED: Please sign in.');
  const db = admin();
  const { data: { user }, error } = await db.auth.getUser(authHeader.replace('Bearer ', '').trim());
  if (error || !user) throw new Error('AUTH_REQUIRED: Invalid session.');
  return { user, db };
}

/** Public shape only — tokens never leave the server. */
function publicRow(row: any) {
  return {
    id: row.id,
    provider: row.provider,
    label: row.label,
    status: row.status,
    metadata: row.metadata || {},
    last_tested_at: row.last_tested_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function redirectUri() {
  const explicit = Deno.env.get('VERCEL_REDIRECT_URI');
  if (explicit) return explicit;
  const url = Deno.env.get('SUPABASE_URL') || '';
  return `${url}/functions/v1/unified-social-api/vercel/callback`;
}

/** Return users to the site they started from; remixed APP_ORIGIN env can be stale. */
function appOrigin(startedFrom?: string | null) {
  const valid = (v?: string | null) => (v && /^https?:\/\/[^/\s]+$/i.test(v.replace(/\/$/, '')) ? v.replace(/\/$/, '') : null);
  return valid(startedFrom) || WEBSITE_DOMAIN || valid(Deno.env.get('APP_ORIGIN')) || '';
}

/* ------------------------- Vercel API helpers ------------------------- */

async function vercelFetch(token: string, path: string, teamId?: string | null) {
  const sep = path.includes('?') ? '&' : '?';
  const url = `${VERCEL_API}${path}${teamId ? `${sep}teamId=${teamId}` : ''}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const text = await res.text();
  if (!res.ok) throw new Error(`VERCEL_API [${res.status}]: ${text}`);
  try { return JSON.parse(text); } catch { return {}; }
}

async function loadVercelAccount(token: string, teamId?: string | null) {
  const meta: Record<string, unknown> = {};
  try {
    const me = await vercelFetch(token, '/v2/user');
    meta.username = me?.user?.username || me?.username || null;
    meta.email = me?.user?.email || me?.email || null;
    meta.name = me?.user?.name || me?.name || null;
  } catch (_e) { /* token may be team-scoped */ }
  if (teamId) {
    try {
      const team = await vercelFetch(token, `/v2/teams/${teamId}`);
      meta.team = { id: teamId, name: team?.name || null, slug: team?.slug || null };
    } catch (_e) { meta.team = { id: teamId }; }
  }
  try {
    const projects = await vercelFetch(token, '/v9/projects?limit=20', teamId);
    meta.projects = (projects?.projects || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      framework: p.framework || null,
      updatedAt: p.updatedAt || null,
    }));
    meta.project_count = (projects?.projects || []).length;
  } catch (_e) { meta.projects = []; }
  return meta;
}

/* ------------------------------ Actions ------------------------------ */

async function handleList(userId: string, db: any) {
  const { data, error } = await db
    .from('user_integrations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`DB error: ${error.message}`);
  return { success: true, integrations: (data || []).map(publicRow) };
}

/** Manual credential link — Supabase only. Vercel always uses OAuth. */
async function handleLink(userId: string, provider: Provider, config: any, db: any) {
  if (provider !== 'supabase') {
    throw new Error('Vercel must be connected with the official OAuth flow.');
  }
  const url = String(config?.url || '').trim();
  const anonKey = String(config?.anon_key || '').trim();
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url)) {
    throw new Error('Please enter a valid Supabase project URL.');
  }
  if (anonKey.length < 40) throw new Error('Please enter a valid anon key.');

  const probe = await fetch(`${url.replace(/\/$/, '')}/rest/v1/`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  });
  if (probe.status === 401 || probe.status === 403) {
    throw new Error('Supabase rejected those credentials.');
  }

  const { error } = await db.from('user_integrations').upsert({
    user_id: userId,
    provider: 'supabase',
    label: url.replace(/^https:\/\//, '').replace(/\.supabase\.co\/?$/, ''),
    status: 'connected',
    config: { url: url.replace(/\/$/, ''), anon_key: anonKey },
    metadata: { connected_at: new Date().toISOString() },
    last_tested_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id, provider' });
  if (error) throw new Error(`DB error: ${error.message}`);
  return { success: true, message: 'Supabase connected' };
}

async function handleUnlink(userId: string, provider: Provider, db: any) {
  const { error } = await db
    .from('user_integrations')
    .delete()
    .eq('user_id', userId)
    .eq('provider', provider);
  if (error) throw new Error(`DB error: ${error.message}`);
  return { success: true };
}


/** Step 1: create CSRF state and return the Vercel authorization URL. */
async function handleVercelAuthUrl(userId: string, db: any, origin: string | null) {
  const clientId = await vercelClientId();
  if (!clientId) throw new Error('Vercel OAuth is not configured yet (missing VERCEL_CLIENT_ID).');

  const state = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');

  const { data: existing } = await db
    .from('user_integrations')
    .select('metadata, status')
    .eq('user_id', userId)
    .eq('provider', 'vercel')
    .maybeSingle();

  const metadata = { ...(existing?.metadata || {}), oauth_state: state, oauth_started_at: new Date().toISOString(), return_origin: origin };

  const { error } = await db.from('user_integrations').upsert({
    user_id: userId,
    provider: 'vercel',
    status: existing?.status === 'connected' ? 'connected' : 'pending',
    metadata,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id, provider' });
  if (error) throw new Error(`DB error: ${error.message}`);

  // Integration Console apps (client IDs start with "oac_") must be installed
  // through vercel.com/integrations/<slug>/new — vercel.com/oauth/authorize is
  // only for "Sign in with Vercel" apps and rejects oac_ IDs as "app ID is invalid".
  if (clientId.startsWith('oac_')) {
    const slug = await vercelIntegrationSlug();
    if (!slug) {
      throw new Error('Vercel Integration URL Slug is missing. Add it on Owner Portal → Secrets (Integration Console → your app → URL Slug).');
    }
    const p = new URLSearchParams({ state });
    return { success: true, url: `https://vercel.com/integrations/${encodeURIComponent(slug)}/new?${p.toString()}` };
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(),
    state,
  });
  return { success: true, url: `${VERCEL_AUTHORIZE_URL}?${params.toString()}` };
}

/** Step 2 (browser redirect from Vercel): exchange code server-side. */
async function handleVercelCallback(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const err = url.searchParams.get('error_description') || url.searchParams.get('error');

  const db = admin();
  let target = appOrigin();

  const fail = (reason: string) =>
    Response.redirect(`${target}/oauth/vercel/return?status=error&reason=${encodeURIComponent(reason)}`, 302);

  if (err) return fail(err);
  if (!code || !state) return fail('Missing authorization code.');

  const { data: row } = await db
    .from('user_integrations')
    .select('id, user_id, metadata')
    .eq('provider', 'vercel')
    .eq('metadata->>oauth_state', state)
    .maybeSingle();

  if (!row) return fail('Invalid or expired authorization state.');
  target = appOrigin(row.metadata?.return_origin);

  const clientId = await vercelClientId();
  const clientSecret = await vercelClientSecret();
  if (!clientId || !clientSecret) return fail('Vercel OAuth is not configured.');

  const tokenRes = await fetch(VERCEL_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri(),
    }),
  });
  const tokenText = await tokenRes.text();
  if (!tokenRes.ok) {
    console.error('[user-integrations] vercel token exchange failed', tokenRes.status, tokenText);
    return fail('Vercel rejected the authorization.');
  }
  let token: any = {};
  try { token = JSON.parse(tokenText); } catch { return fail('Unexpected Vercel response.'); }

  const accessToken = token.access_token;
  if (!accessToken) return fail('Vercel did not return an access token.');
  const teamId = token.team_id || null;

  const meta = await loadVercelAccount(accessToken, teamId);

  const { error: upErr } = await db.from('user_integrations').update({
    status: 'connected',
    label: (meta as any)?.team?.name || (meta as any).username || 'Vercel account',
    config: {
      access_token: accessToken,
      token_type: token.token_type || 'Bearer',
      installation_id: token.installation_id || null,
      user_id: token.user_id || null,
      team_id: teamId,
    },
    metadata: { ...meta, connected_at: new Date().toISOString() },
    last_tested_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', row.id);
  if (upErr) {
    console.error('[user-integrations] store failed', upErr.message);
    return fail('Could not save the connection.');
  }

  return Response.redirect(`${target}/oauth/vercel/return?status=success`, 302);
}

/** Re-check the stored token and refresh account info. */
async function handleVercelTest(userId: string, db: any) {
  const { data, error } = await db
    .from('user_integrations')
    .select('id, config, metadata')
    .eq('user_id', userId)
    .eq('provider', 'vercel')
    .maybeSingle();
  if (error || !data?.config?.access_token) throw new Error('Vercel is not connected.');

  try {
    const meta = await loadVercelAccount(data.config.access_token, data.config.team_id);
    await db.from('user_integrations').update({
      status: 'connected',
      metadata: { ...(data.metadata || {}), ...meta },
      last_tested_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', data.id);
    return { success: true, status: 'connected', message: 'Vercel connection is healthy', metadata: meta };
  } catch (e: any) {
    await db.from('user_integrations').update({
      status: 'needs_reconnect',
      last_tested_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', data.id);
    return { success: false, status: 'needs_reconnect', message: 'Vercel authorization is no longer valid. Please reconnect.' };
  }
}

/** Read-only proxy so the AI can use the user's Vercel data without seeing the token. */
async function handleVercelApi(userId: string, db: any, path: string) {
  if (!/^\/v\d+\/[A-Za-z0-9\-_/?=&.,%]*$/.test(path)) throw new Error('Invalid Vercel API path.');
  const { data } = await db
    .from('user_integrations')
    .select('config')
    .eq('user_id', userId)
    .eq('provider', 'vercel')
    .maybeSingle();
  if (!data?.config?.access_token) throw new Error('Vercel is not connected.');
  const result = await vercelFetch(data.config.access_token, path, data.config.team_id);
  return { success: true, data: result };
}


/* --------------------------- Supabase OAuth --------------------------- */

const SB_AUTHORIZE_URL = 'https://api.supabase.com/v1/oauth/authorize';
const SB_TOKEN_URL = 'https://api.supabase.com/v1/oauth/token';
const SB_MGMT_API = 'https://api.supabase.com';

// The SUPABASE_ prefix is reserved on the platform, so SB_OAUTH_* is the
// canonical name; the legacy SUPABASE_OAUTH_* names stay as a fallback.
async function sbClientId() {
  return (await getOwnerSecret('SB_OAUTH_CLIENT_ID'))
    || Deno.env.get('SB_OAUTH_CLIENT_ID') || Deno.env.get('SUPABASE_OAUTH_CLIENT_ID') || '';
}

async function sbClientSecret() {
  return (await getOwnerSecret('SB_OAUTH_CLIENT_SECRET'))
    || Deno.env.get('SB_OAUTH_CLIENT_SECRET') || Deno.env.get('SUPABASE_OAUTH_CLIENT_SECRET') || '';
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Catch common paste mistakes before sending the user to Supabase. */
async function assertSbCredentials() {
  const id = await sbClientId();
  const secret = await sbClientSecret();
  if (!id) throw new Error('Supabase OAuth is not configured yet (missing SB_OAUTH_CLIENT_ID).');
  if (!UUID_RE.test(id)) throw new Error('Supabase OAuth Client ID must be a UUID (xxxxxxxx-xxxx-…). Re-copy it from Supabase → OAuth Apps.');
  if (secret && secret === id) throw new Error('Supabase OAuth Client Secret is the same as the Client ID. Paste the real Client Secret (starts with sba_) on Owner Portal → Secrets.');
  // Apps created under Project → Authentication → OAuth Server live in
  // auth.oauth_clients and are unknown to api.supabase.com ("Unrecognized client_id").
  // Only Organization → OAuth Apps (Integrations) can call the Management API.
  try {
    const { data } = await admin().schema('auth' as any).from('oauth_clients').select('id').eq('id', id).maybeSingle();
    if (data) throw new Error('WRONG_APP_TYPE');
  } catch (e) {
    if ((e as Error).message === 'WRONG_APP_TYPE') {
      throw new Error('This Supabase Client ID belongs to Project → Authentication → OAuth Server (login provider), not an Organization OAuth App. Create one at supabase.com/dashboard/org/_/apps → OAuth Apps → Add application and save its Client ID + Secret (starts with sba_).');
    }
  }
  if (secret && !secret.startsWith('sba_')) throw new Error('Supabase OAuth Client Secret must start with sba_. Copy it from Organization Settings → OAuth Apps (not Authentication → OAuth Server).');
}

function supabaseRedirectUri() {
  const explicit = Deno.env.get('SB_OAUTH_REDIRECT_URI') || Deno.env.get('SUPABASE_OAUTH_REDIRECT_URI');
  if (explicit) return explicit;
  const url = Deno.env.get('SUPABASE_URL') || '';
  return `${url}/functions/v1/unified-social-api/supabase/callback`;
}

async function sbMgmtFetch(token: string, path: string) {
  const res = await fetch(`${SB_MGMT_API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const text = await res.text();
  if (!res.ok) throw new Error(`SUPABASE_API [${res.status}]: ${text}`);
  try { return JSON.parse(text); } catch { return {}; }
}

async function loadSupabaseAccount(token: string) {
  const meta: Record<string, unknown> = {};
  try {
    const projects = await sbMgmtFetch(token, '/v1/projects');
    const list = Array.isArray(projects) ? projects : [];
    meta.projects = list.slice(0, 20).map((p: any) => ({
      id: p.id,
      name: p.name,
      region: p.region ?? null,
      status: p.status ?? null,
    }));
    meta.project_count = list.length;
  } catch (_e) { meta.projects = []; }
  try {
    const orgs = await sbMgmtFetch(token, '/v1/organizations');
    const list = Array.isArray(orgs) ? orgs : [];
    meta.organizations = list.map((o: any) => ({ id: o.id, name: o.name }));
    meta.organization = list[0]?.name || null;
  } catch (_e) { /* optional scope */ }
  return meta;
}

/** Step 1: Supabase OAuth authorization URL (official login + consent). */
async function handleSupabaseAuthUrl(userId: string, db: any, origin: string | null) {
  await assertSbCredentials();
  const clientId = await sbClientId();

  const state = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');

  const { data: existing } = await db
    .from('user_integrations')
    .select('metadata, status')
    .eq('user_id', userId)
    .eq('provider', 'supabase')
    .maybeSingle();

  const { error } = await db.from('user_integrations').upsert({
    user_id: userId,
    provider: 'supabase',
    status: existing?.status === 'connected' ? 'connected' : 'pending',
    metadata: {
      ...(existing?.metadata || {}),
      oauth_state: state,
      oauth_started_at: new Date().toISOString(),
      return_origin: origin,
    },
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id, provider' });
  if (error) throw new Error(`DB error: ${error.message}`);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: supabaseRedirectUri(),
    response_type: 'code',
    state,
  });
  return { success: true, url: `${SB_AUTHORIZE_URL}?${params.toString()}` };
}

/** Step 2: exchange the Supabase authorization code server-side. */
async function handleSupabaseCallback(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const err = url.searchParams.get('error_description') || url.searchParams.get('error');

  const db = admin();
  let target = appOrigin();
  const fail = (reason: string) =>
    Response.redirect(`${target}/oauth/supabase/return?status=error&reason=${encodeURIComponent(reason)}`, 302);

  if (err) return fail(err);
  if (!code || !state) return fail('Missing authorization code.');

  const { data: row } = await db
    .from('user_integrations')
    .select('id, user_id, metadata')
    .eq('provider', 'supabase')
    .eq('metadata->>oauth_state', state)
    .maybeSingle();
  if (!row) return fail('Invalid or expired authorization state.');
  target = appOrigin(row.metadata?.return_origin);

  const clientId = await sbClientId();
  const clientSecret = await sbClientSecret();
  if (!clientId || !clientSecret) return fail('Supabase OAuth is not configured.');

  const tokenRes = await fetch(SB_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: supabaseRedirectUri(),
    }),
  });
  const tokenText = await tokenRes.text();
  if (!tokenRes.ok) {
    console.error('[user-integrations] supabase token exchange failed', tokenRes.status, tokenText);
    return fail('Supabase rejected the authorization.');
  }
  let token: any = {};
  try { token = JSON.parse(tokenText); } catch { return fail('Unexpected Supabase response.'); }
  if (!token.access_token) return fail('Supabase did not return an access token.');

  const meta = await loadSupabaseAccount(token.access_token);

  const { error: upErr } = await db.from('user_integrations').update({
    status: 'connected',
    label: (meta as any).organization || 'Supabase account',
    config: {
      auth: 'oauth',
      access_token: token.access_token,
      refresh_token: token.refresh_token || null,
      token_type: token.token_type || 'Bearer',
      expires_at: token.expires_in
        ? new Date(Date.now() + Number(token.expires_in) * 1000).toISOString()
        : null,
    },
    metadata: { ...meta, connected_at: new Date().toISOString() },
    last_tested_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', row.id);
  if (upErr) return fail('Could not save the connection.');

  return Response.redirect(`${target}/oauth/supabase/return?status=success`, 302);
}

/** Refresh the Supabase OAuth access token when it has expired. */
async function supabaseAccessToken(rowId: string, config: any, db: any) {
  const expired = config?.expires_at && new Date(config.expires_at).getTime() < Date.now() + 60_000;
  if (!expired || !config?.refresh_token) return config?.access_token;

  const clientId = await sbClientId();
  const clientSecret = await sbClientSecret();
  const res = await fetch(SB_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: config.refresh_token }),
  });
  if (!res.ok) throw new Error('RECONNECT_REQUIRED: Supabase authorization expired.');
  const token = await res.json();
  await db.from('user_integrations').update({
    config: {
      ...config,
      access_token: token.access_token,
      refresh_token: token.refresh_token || config.refresh_token,
      expires_at: token.expires_in
        ? new Date(Date.now() + Number(token.expires_in) * 1000).toISOString()
        : null,
    },
    updated_at: new Date().toISOString(),
  }).eq('id', rowId);
  return token.access_token;
}

async function handleSupabaseTest(userId: string, db: any) {
  const { data } = await db
    .from('user_integrations')
    .select('id, config, metadata')
    .eq('user_id', userId)
    .eq('provider', 'supabase')
    .maybeSingle();
  if (!data?.config) throw new Error('Supabase is not connected.');

  // Manual (URL + anon key) connections are probed against the REST endpoint.
  if (data.config.auth !== 'oauth') {
    const probe = await fetch(`${String(data.config.url).replace(/\/$/, '')}/rest/v1/`, {
      headers: { apikey: data.config.anon_key, Authorization: `Bearer ${data.config.anon_key}` },
    });
    const ok = probe.status !== 401 && probe.status !== 403;
    await db.from('user_integrations').update({
      status: ok ? 'connected' : 'needs_reconnect',
      last_tested_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', data.id);
    return ok
      ? { success: true, status: 'connected', message: 'Supabase connection is healthy' }
      : { success: false, status: 'needs_reconnect', message: 'Supabase credentials are no longer valid.' };
  }

  try {
    const token = await supabaseAccessToken(data.id, data.config, db);
    const meta = await loadSupabaseAccount(token);
    await db.from('user_integrations').update({
      status: 'connected',
      metadata: { ...(data.metadata || {}), ...meta },
      last_tested_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', data.id);
    return { success: true, status: 'connected', message: 'Supabase connection is healthy', metadata: meta };
  } catch (_e) {
    await db.from('user_integrations').update({
      status: 'needs_reconnect',
      last_tested_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', data.id);
    return { success: false, status: 'needs_reconnect', message: 'Supabase authorization is no longer valid. Please reconnect.' };
  }
}

/* ------------------------------- Router ------------------------------- */



/* --------------------------- Public entrypoints --------------------------- */

export function isIntegrationCallback(pathname: string) {
  return pathname.endsWith('/vercel/callback') || pathname.endsWith('/supabase/callback');
}

export async function handleIntegrationCallback(req: Request): Promise<Response> {
  const isSupabase = new URL(req.url).pathname.endsWith('/supabase/callback');
  try {
    return isSupabase ? await handleSupabaseCallback(req) : await handleVercelCallback(req);
  } catch (e) {
    console.error('[user-integrations] callback error', e);
    const page = isSupabase ? 'supabase' : 'vercel';
    return Response.redirect(`${appOrigin()}/oauth/${page}/return?status=error&reason=unexpected`, 302);
  }
}

export async function handleIntegrationAction(action: string, body: any, req: Request) {
  const { user, db } = await getUser(req);
  const provider = String(body?.provider || '') as Provider;

  switch (action) {
    case 'integrations_list':
      return await handleList(user.id, db);
    case 'integrations_link':
      return await handleLink(user.id, provider, body?.config, db);
    case 'integrations_unlink':
      if (!['supabase', 'vercel'].includes(provider)) throw new Error('Invalid provider');
      return await handleUnlink(user.id, provider, db);
    case 'integrations_supabase_auth_url':
      return await handleSupabaseAuthUrl(user.id, db, req.headers.get('origin'));
    case 'integrations_vercel_auth_url':
      return await handleVercelAuthUrl(user.id, db, req.headers.get('origin'));
    case 'integrations_test':
      if (provider === 'supabase') return await handleSupabaseTest(user.id, db);
      if (provider !== 'vercel') throw new Error('Invalid provider');
      return await handleVercelTest(user.id, db);
    case 'integrations_vercel_api':
      return await handleVercelApi(user.id, db, String(body?.path || ''));
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}
