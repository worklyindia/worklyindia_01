import { createClient } from 'npm:@supabase/supabase-js@^2.81.0';

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });

function validUris(input: unknown): input is string[] {
  return Array.isArray(input) && input.length > 0 && input.length <= 10 && input.every((uri) => {
    if (typeof uri !== 'string' || uri.length > 2048) return false;
    try {
      const url = new URL(uri);
      return !url.username && !url.password && !url.hash && (url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)));
    } catch { return false; }
  });
}

/** Direct Auth Admin REST calls: the bundled SDK in the edge runtime lacks auth.admin.oauth. */
async function oauthAdmin(method: string, path: string, body?: unknown): Promise<{ data: any; error: { message: string } | null }> {
  const url = Deno.env.get('SUPABASE_URL')!; const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const res = await fetch(`${url}/auth/v1/admin/oauth/clients${path}`, { method, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text(); let data: any = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) { console.error(`OAuth admin ${method} ${path} [${res.status}]: ${text}`); return { data: null, error: { message: data?.msg || data?.message || data?.error_description || data?.error || `Auth error ${res.status}` } }; }
  return { data, error: null };
}

/** Ownership is checked on every operation. Secrets are never persisted or returned on list. */
export async function handleDeveloperOAuthApps(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return json({ error: 'Service unavailable' }, 503);
  const admin = createClient(url, key);
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Unauthorized' }, 401);
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return json({ error: 'Unauthorized' }, 401);
  const body = await req.json().catch(() => ({}));
  const action = body?.action;
  if (!['list', 'create', 'update', 'regenerate', 'delete'].includes(action)) return json({ error: 'Invalid action' }, 400);
  if (action === 'list') {
    const { data, error } = await admin.from('developer_oauth_apps').select('id,client_id,client_name,redirect_uris,client_type,created_at').eq('user_id', user.id).order('created_at', { ascending: false });
    return error ? json({ error: error.message }, 500) : json({ apps: data });
  }
  const clientName = typeof body.client_name === 'string' ? body.client_name.trim() : '';
  if (action === 'create' || action === 'update') {
    if (clientName.length < 2 || clientName.length > 80 || !validUris(body.redirect_uris)) return json({ error: 'Enter an app name and valid HTTPS redirect URL (localhost HTTP is allowed).' }, 400);
  }
  if (action === 'create') {
    const type = body.client_type === 'public' ? 'public' : 'confidential';
    const { data: client, error } = await oauthAdmin('POST', '', {
      client_name: clientName, redirect_uris: body.redirect_uris,
      token_endpoint_auth_method: type === 'public' ? 'none' : 'client_secret_basic',
      grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'],
    });
    if (error || !client) return json({ error: error?.message || 'Could not create app' }, 400);
    const { data: saved, error: saveError } = await admin.from('developer_oauth_apps').insert({
      user_id: user.id, client_id: client.client_id, client_name: clientName, redirect_uris: body.redirect_uris, client_type: type,
    }).select('id').single();
    if (saveError) {
      await oauthAdmin('DELETE', `/${client.client_id}`);
      return json({ error: 'Could not save app' }, 500);
    }
    return json({ id: saved.id, client_id: client.client_id, client_secret: client.client_secret });
  }
  if (typeof body.id !== 'string') return json({ error: 'Invalid app' }, 400);
  const { data: app } = await admin.from('developer_oauth_apps').select('id,client_id').eq('id', body.id).eq('user_id', user.id).maybeSingle();
  if (!app) return json({ error: 'App not found' }, 404);
  if (action === 'update') {
    const { error } = await oauthAdmin('PUT', `/${app.client_id}`, { client_name: clientName, redirect_uris: body.redirect_uris });
    if (error) return json({ error: error.message }, 400);
    const { error: saveError } = await admin.from('developer_oauth_apps').update({ client_name: clientName, redirect_uris: body.redirect_uris }).eq('id', app.id).eq('user_id', user.id);
    return saveError ? json({ error: 'App updated, but list could not sync. Reload and try again.' }, 500) : json({ success: true });
  }
  if (action === 'regenerate') {
    const { data, error } = await oauthAdmin('POST', `/${app.client_id}/regenerate_secret`);
    return error || !data?.client_secret ? json({ error: error?.message || 'Could not regenerate secret' }, 400) : json({ client_secret: data.client_secret });
  }
  const { error } = await oauthAdmin('DELETE', `/${app.client_id}`);
  if (error) return json({ error: error.message }, 400);
  const { error: deleteError } = await admin.from('developer_oauth_apps').delete().eq('id', app.id).eq('user_id', user.id);
  return deleteError ? json({ error: 'App deleted, but list could not sync. Reload and try again.' }, 500) : json({ success: true });
}
