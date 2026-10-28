// Developer sub-accounts: a developer (wfh_ key owner) onboards their own users, each of whom
// connects their own WhatsApp number via a Workly-hosted Embedded Signup link.
import { z } from 'npm:zod@3';
import { getMetaAppCreds } from './metaSocial.ts';
import { readTier } from './whatsappTierSync.ts';
import { forwardToCustomerWebhooks } from './customerWebhooks.ts';
import { isChannel, channelPath, subChannels, disconnectSubChannel, deleteAllSubChannels, handleChannelConnect, type Channel } from './subAccountChannels.ts';

const GRAPH = 'https://graph.facebook.com/v21.0';
export const CONNECT_LINK_TTL_MS = 60 * 60 * 1000;
const SITE = (Deno.env.get('SITE_URL') || 'https://worklyindia.devs.surf').replace(/\/+$/, '');

export const SUB_ACTIONS = new Set([
  'create_sub_account', 'list_sub_accounts', 'get_sub_account',
  'create_connect_link', 'disconnect_sub_account', 'delete_sub_account',
]);

const externalId = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9._:@-]+$/);
const subId = z.string().uuid();
const ref = z.object({ sub_account_id: subId.optional(), external_id: externalId.optional() })
  .refine((v) => !!v.sub_account_id || !!v.external_id, { message: 'sub_account_id or external_id is required' });

/** Only https return URLs are allowed (http only for localhost testing). */
export function isAllowedReturnUrl(value: string): boolean {
  try {
    const u = new URL(value);
    if (u.protocol === 'https:') return true;
    return u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1');
  } catch { return false; }
}

/** A connect session is usable once, before it expires. */
export function isSessionUsable(s: { expires_at: string; used_at: string | null } | null, now = Date.now()): boolean {
  return !!s && !s.used_at && new Date(s.expires_at).getTime() > now;
}

export async function sha256Hex(text: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  return Array.from(d).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const pub = (s: any, numbers: any[] = [], channels: any[] = []) => ({
  channels,
  sub_account_id: s.id, external_id: s.external_id, name: s.name, status: s.status, created_at: s.created_at,
  numbers: numbers.map((n) => ({ phone_number_id: n.phone_number_id, phone: n.display_phone, verified_name: n.verified_name, quality_rating: n.quality_rating, connected_at: n.connected_at })),
});

/** Find a sub-account that belongs to this developer (never another developer's). */
export async function findSubAccount(admin: any, devUserId: string, raw: any) {
  const id = typeof raw?.sub_account_id === 'string' ? raw.sub_account_id : '';
  const ext = typeof raw?.external_id === 'string' ? raw.external_id.trim() : '';
  if (!id && !ext) return null;
  let q = admin.from('developer_sub_accounts').select('id,developer_user_id,external_id,name,status,created_at').eq('developer_user_id', devUserId);
  if (id) { if (!subId.safeParse(id).success) return null; q = q.eq('id', id); } else q = q.eq('external_id', ext);
  const { data } = await q.maybeSingle();
  return data ?? null;
}

/** Sender numbers + token resolver for a sub-account, used by the public API send path. */
export async function subAccountNumbers(admin: any, subAccountId: string) {
  const { data } = await admin.from('developer_sub_account_numbers')
    .select('waba_id,phone_number_id,status,display_phone,verified_name,quality_rating,messaging_tier,connected_at')
    .eq('sub_account_id', subAccountId).eq('status', 'connected').order('connected_at', { ascending: true });
  return (data || []) as any[];
}
export async function subAccountToken(admin: any, phoneNumberId: string) {
  const { data } = await admin.from('developer_sub_account_tokens').select('access_token').eq('phone_number_id', phoneNumberId).maybeSingle();
  return (data as any)?.access_token as string | undefined;
}

/** Once nothing is connected anymore, the sub-account is removed entirely — only connected sub-accounts are listed anywhere. */
async function removeSubAccountRow(admin: any, subId: string) {
  await admin.from('developer_connect_sessions').delete().eq('sub_account_id', subId);
  await admin.from('developer_sub_accounts').delete().eq('id', subId);
}

/** Management actions. Returns [status, body]. */
export async function handleSubAccountAction(admin: any, devUserId: string, raw: any): Promise<[number, Record<string, unknown>]> {
  const action = raw?.action;
  if (action === 'create_sub_account') {
    const p = z.object({ external_id: externalId, name: z.string().trim().max(120).optional() }).safeParse(raw);
    if (!p.success) return [400, { success: false, error: 'Invalid request', details: p.error.flatten().fieldErrors }];
    const existing = await findSubAccount(admin, devUserId, { external_id: p.data.external_id });
    if (existing) return [200, { success: true, created: false, sub_account: pub(existing, await subAccountNumbers(admin, existing.id)) }];
    const { data, error } = await admin.from('developer_sub_accounts')
      .insert({ developer_user_id: devUserId, external_id: p.data.external_id, name: p.data.name ?? null })
      .select('id,external_id,name,status,created_at').single();
    if (error) return [400, { success: false, error: error.message }];
    return [201, { success: true, created: true, sub_account: pub(data) }];
  }
  if (action === 'list_sub_accounts') {
    const p = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1), per_page: z.coerce.number().int().min(1).max(100).default(50), status: z.enum(['pending', 'connected', 'disconnected']).optional(), search: z.string().trim().max(128).optional() }).safeParse(raw);
    if (!p.success) return [400, { success: false, error: 'Invalid request', details: p.error.flatten().fieldErrors }];
    const { page, per_page, status, search } = p.data;
    let q = admin.from('developer_sub_accounts').select('id,external_id,name,status,created_at', { count: 'exact' })
      .eq('developer_user_id', devUserId).order('created_at', { ascending: false }).range((page - 1) * per_page, page * per_page - 1);
    if (status) q = q.eq('status', status);
    if (search) q = q.or(`external_id.ilike.%${search.replace(/[%,()]/g, '')}%,name.ilike.%${search.replace(/[%,()]/g, '')}%`);
    const { data, count } = await q;
    const ids = (data || []).map((s: any) => s.id);
    const { data: nums } = ids.length ? await admin.from('developer_sub_account_numbers')
      .select('sub_account_id,phone_number_id,display_phone,verified_name,quality_rating,connected_at,status').in('sub_account_id', ids).eq('status', 'connected') : { data: [] };
    return [200, { success: true, page, per_page, total: count ?? 0, sub_accounts: (data || []).map((s: any) => pub(s, (nums || []).filter((n: any) => n.sub_account_id === s.id))) }];
  }

  const r = ref.safeParse(raw);
  if (!r.success) return [400, { success: false, error: 'sub_account_id or external_id is required' }];
  const sub = await findSubAccount(admin, devUserId, raw);
  if (!sub) return [404, { success: false, error: 'Sub-account not found' }];

  if (action === 'get_sub_account') return [200, { success: true, sub_account: pub(sub, await subAccountNumbers(admin, sub.id), await subChannels(admin, sub.id)) }];

  if (action === 'create_connect_link') {
    const returnUrl = typeof raw?.return_url === 'string' ? raw.return_url.trim() : '';
    if (!returnUrl || returnUrl.length > 2000 || !isAllowedReturnUrl(returnUrl)) return [400, { success: false, error: 'return_url must be an https URL' }];
    const channel: Channel = raw?.channel === undefined ? 'whatsapp' : raw.channel;
    if (!isChannel(channel)) return [400, { success: false, error: 'channel must be whatsapp, instagram, facebook, gmail, outlook or domain_email' }];
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const token = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
    const expires = new Date(Date.now() + CONNECT_LINK_TTL_MS).toISOString();
    const { error } = await admin.from('developer_connect_sessions').insert({ token_hash: await sha256Hex(token), sub_account_id: sub.id, return_url: returnUrl, expires_at: expires, channel });
    if (error) return [400, { success: false, error: error.message }];
    return [200, { success: true, channel, connect_url: `${SITE}/connect/${channelPath(channel)}?token=${token}`, expires_at: expires, sub_account_id: sub.id }];
  }

  if (action === 'disconnect_sub_account' && raw?.channel && raw.channel !== 'whatsapp') {
    if (!isChannel(raw.channel)) return [400, { success: false, error: 'Unknown channel' }];
    await disconnectSubChannel(admin, sub.id, raw.channel, typeof raw?.account_id === 'string' ? raw.account_id : undefined);
    const left = (await subAccountNumbers(admin, sub.id)).length + (await subChannels(admin, sub.id)).length;
    const removed = !left;
    if (removed) await removeSubAccountRow(admin, sub.id);
    else await admin.from('developer_sub_accounts').update({ status: 'connected', updated_at: new Date().toISOString() }).eq('id', sub.id);
    await forwardToCustomerWebhooks(admin, devUserId, `${raw.channel}.sub_account.disconnected`, { sub_account_id: sub.id, external_id: sub.external_id, removed });
    return [200, { success: true, disconnected: raw.channel, removed }];
  }
  if (action === 'disconnect_sub_account' || action === 'delete_sub_account') {
    const pid = typeof raw?.phone_number_id === 'string' ? raw.phone_number_id.replace(/\D/g, '') : '';
    const nums = await subAccountNumbers(admin, sub.id);
    const targets = action === 'delete_sub_account' || !pid ? nums : nums.filter((n) => n.phone_number_id === pid);
    if (pid && !targets.length && action === 'disconnect_sub_account') return [404, { success: false, error: 'Number not connected to this sub-account' }];
    for (const n of targets) {
      await admin.from('developer_sub_account_tokens').delete().eq('phone_number_id', n.phone_number_id);
      await admin.from('developer_sub_account_numbers').delete().eq('phone_number_id', n.phone_number_id).eq('sub_account_id', sub.id);
    }
    if (action === 'delete_sub_account') {
      await deleteAllSubChannels(admin, sub.id);
      await admin.from('developer_sub_accounts').delete().eq('id', sub.id).eq('developer_user_id', devUserId);
      return [200, { success: true, deleted: true }];
    }
    const left = (await subAccountNumbers(admin, sub.id)).length + (await subChannels(admin, sub.id)).length;
    const removed = !left;
    if (removed) await removeSubAccountRow(admin, sub.id);
    else await admin.from('developer_sub_accounts').update({ status: 'connected', updated_at: new Date().toISOString() }).eq('id', sub.id);
    return [200, { success: true, disconnected: targets.map((n) => n.phone_number_id), removed }];
  }
  return [400, { success: false, error: 'Unknown action' }];
}

async function g(path: string, token: string, init: { method?: string; query?: Record<string, string> } = {}) {
  const url = new URL(`${GRAPH}${path}`);
  for (const [k, v] of Object.entries(init.query || {})) url.searchParams.set(k, v);
  const res = await fetch(url, { method: init.method || 'GET', headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.error_user_msg || data?.error?.message || `Meta error ${res.status}`);
  return data;
}

/** Public hosted connect page backend (no login; authorized by the one-time token). */
export async function handleSubConnect(admin: any, raw: any): Promise<[number, Record<string, unknown>]> {
  const token = typeof raw?.token === 'string' && /^[0-9a-f]{64}$/.test(raw.token) ? raw.token : '';
  if (!token) return [400, { success: false, error: 'Invalid link' }];
  const { data: s } = await admin.from('developer_connect_sessions').select('id,sub_account_id,return_url,expires_at,used_at,channel').eq('token_hash', await sha256Hex(token)).maybeSingle();
  if (!isSessionUsable(s)) return [410, { success: false, error: 'This link has expired or was already used. Ask the website for a new link.' }];
  const { data: sub } = await admin.from('developer_sub_accounts').select('id,developer_user_id,external_id,name').eq('id', s.sub_account_id).maybeSingle();
  if (!sub) return [410, { success: false, error: 'This link is no longer valid.' }];
  // Developer must hold an active API subscription for their users to connect.
  const { data: devSub } = await admin.from('api_subscriptions').select('id').eq('user_id', sub.developer_user_id).eq('status', 'active').or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`).limit(1).maybeSingle();
  if (!devSub) return [402, { success: false, error: 'This website\'s Workly India subscription is inactive. Please contact the website owner.' }];
  const back = (status: string, extra: Record<string, string> = {}) => {
    const u = new URL(s.return_url); u.searchParams.set('status', status); u.searchParams.set('sub_account_id', sub.id); u.searchParams.set('external_id', sub.external_id); u.searchParams.set('channel', s.channel || 'whatsapp');
    for (const [k, v] of Object.entries(extra)) u.searchParams.set(k, v);
    return u.toString();
  };

  if (raw.action === 'session_info') {
    const { data: dev } = await admin.from('developer_profiles').select('*').eq('user_id', sub.developer_user_id).maybeSingle();
    const devName = (dev as any)?.company_name || (dev as any)?.display_name || (dev as any)?.full_name || null;
    return [200, { success: true, channel: s.channel || 'whatsapp', developer_name: devName, user_name: sub.name, expires_at: s.expires_at, cancel_url: back('cancelled') }];
  }
  if ((s.channel || 'whatsapp') !== 'whatsapp') {
    const claim = async () => !!(await admin.from('developer_connect_sessions').update({ used_at: new Date().toISOString() }).eq('id', s.id).is('used_at', null).select('id').maybeSingle()).data;
    return await handleChannelConnect({ admin, sub, channel: s.channel, claim, back }, raw);
  }
  if (raw.action !== 'connect') return [400, { success: false, error: 'Unknown action' }];
  const p = z.object({ code: z.string().min(10).max(2000), waba_id: z.string().regex(/^\d+$/), phone_number_id: z.string().regex(/^\d+$/) }).safeParse(raw);
  if (!p.success) return [400, { success: false, error: 'Missing Meta signup details' }];
  // Claim the link first so it can't be used twice in parallel.
  const { data: claimed } = await admin.from('developer_connect_sessions').update({ used_at: new Date().toISOString() }).eq('id', s.id).is('used_at', null).select('id').maybeSingle();
  if (!claimed) return [410, { success: false, error: 'This link was already used.' }];

  const fail = async (msg: string) => {
    await forwardToCustomerWebhooks(admin, sub.developer_user_id, 'whatsapp.sub_account.failed', { sub_account_id: sub.id, external_id: sub.external_id, error: msg });
    return [400, { success: false, error: msg, redirect_url: back('failed', { error: msg.slice(0, 200) }) }] as [number, Record<string, unknown>];
  };
  try {
    const { appId, secret } = await getMetaAppCreds(admin);
    if (!secret) return await fail('Meta app is not configured');
    const tu = new URL(`${GRAPH}/oauth/access_token`);
    tu.searchParams.set('client_id', appId); tu.searchParams.set('client_secret', secret); tu.searchParams.set('code', p.data.code);
    const tRes = await fetch(tu); const tData = await tRes.json().catch(() => ({}));
    if (!tRes.ok || !tData.access_token) return await fail(tData?.error?.message || 'Code exchange failed');
    const accessToken = tData.access_token as string;
    const debug = await g('/debug_token', `${appId}|${secret}`, { query: { input_token: accessToken } });
    if (!debug?.data?.is_valid || String(debug.data.app_id) !== String(appId)) return await fail('Meta returned an invalid token');
    const waba = await g(`/${p.data.waba_id}`, accessToken, { query: { fields: 'id,name' } });
    const phones = await g(`/${p.data.waba_id}/phone_numbers`, accessToken, { query: { fields: 'id,display_phone_number,verified_name,quality_rating,messaging_limit_tier', limit: '100' } });
    const phone = (phones?.data || []).find((r: any) => String(r.id) === p.data.phone_number_id);
    if (!phone) return await fail('Phone number does not belong to the selected WhatsApp account');
    try { await g(`/${p.data.waba_id}/subscribed_apps`, accessToken, { method: 'POST' }); } catch { /* non-fatal */ }

    const { data: taken } = await admin.from('employer_whatsapp_accounts').select('id').eq('phone_number_id', p.data.phone_number_id).eq('status', 'connected').maybeSingle();
    const { data: takenSub } = await admin.from('developer_sub_account_numbers').select('sub_account_id').eq('phone_number_id', p.data.phone_number_id).maybeSingle();
    if (taken || (takenSub && takenSub.sub_account_id !== sub.id)) return await fail('This WhatsApp number is already connected elsewhere.');

    const now = new Date().toISOString();
    const row = { sub_account_id: sub.id, developer_user_id: sub.developer_user_id, waba_id: p.data.waba_id, phone_number_id: p.data.phone_number_id, display_phone: phone.display_phone_number ?? null, verified_name: phone.verified_name ?? null, business_name: waba?.name ?? null, quality_rating: phone.quality_rating ?? null, messaging_tier: readTier(phone), status: 'connected', connected_at: now, updated_at: now };
    const { error: nErr } = await admin.from('developer_sub_account_numbers').upsert(row, { onConflict: 'phone_number_id' });
    if (nErr) return await fail(nErr.message);
    const expiresAt = Number(debug.data.expires_at) > 0 ? new Date(Number(debug.data.expires_at) * 1000).toISOString() : null;
    await admin.from('developer_sub_account_tokens').upsert({ phone_number_id: p.data.phone_number_id, access_token: accessToken, token_type: debug.data.type ?? 'BUSINESS', expires_at: expiresAt, updated_at: now }, { onConflict: 'phone_number_id' });
    await admin.from('developer_sub_accounts').update({ status: 'connected', updated_at: now }).eq('id', sub.id);
    await forwardToCustomerWebhooks(admin, sub.developer_user_id, 'whatsapp.sub_account.connected', { sub_account_id: sub.id, external_id: sub.external_id, phone_number_id: p.data.phone_number_id, phone: phone.display_phone_number ?? null, verified_name: phone.verified_name ?? null });
    return [200, { success: true, display_phone: phone.display_phone_number ?? null, redirect_url: back('connected', { phone_number_id: p.data.phone_number_id }) }];
  } catch (e) {
    return await fail((e as Error).message || 'Connection failed');
  }
}

/** Webhook helper: which developer + sub-account owns a phone number id. */
export async function subAccountForPhoneId(admin: any, phoneNumberId?: string) {
  if (!phoneNumberId) return null;
  const { data } = await admin.from('developer_sub_account_numbers').select('sub_account_id,developer_user_id,developer_sub_accounts(external_id)').eq('phone_number_id', phoneNumberId).eq('status', 'connected').maybeSingle();
  if (!data) return null;
  const s = (data as any).developer_sub_accounts;
  return { sub_account_id: data.sub_account_id as string, developer_user_id: data.developer_user_id as string, external_id: (Array.isArray(s) ? s[0]?.external_id : s?.external_id) ?? null };
}
