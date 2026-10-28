// Public WhatsApp API for customers: authenticate with a Developer Portal API key (x-api-key).
// Each key uses the WhatsApp number its owner connected in their employer account.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';
import { getMetaAppCreds } from './metaSocial.ts';
import { consumeApiCall, API_LIMIT_MESSAGE } from './apiQuota.ts';
import { consumeWhatsappSend, whatsappLimitError, whatsappSendUsage, tierLimitFromMeta, whatsappLimitsOverview } from './whatsappRateLimit.ts';
import { SUB_ACTIONS, handleSubAccountAction, findSubAccount, subAccountNumbers, subAccountToken } from './whatsappSubAccounts.ts';
import { peekCachedTier, rememberLiveTier, fetchLiveTier, readTier } from './whatsappTierSync.ts';

const GRAPH = 'https://graph.facebook.com/v21.0';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const SEND_ACTIONS = new Set(['send_text', 'send_template', 'send_media', 'send_reaction']);
const replyTo = z.string().min(1).max(200).optional();

const phone = z.string().regex(/^\+?\d{6,16}$/);
const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('status') }),
  z.object({ action: z.literal('usage') }),
  z.object({ action: z.literal('list_numbers') }),
  z.object({ action: z.literal('get_profile') }),
  z.object({
    action: z.literal('update_profile'),
    about: z.string().trim().min(1).max(139),
    description: z.string().max(512).optional(),
    address: z.string().max(256).optional(),
    email: z.union([z.string().email().max(128), z.literal('')]).optional(),
    websites: z.array(z.string().url().max(256)).max(2).optional(),
    vertical: z.string().max(50).optional(),
    profile_picture: z.string().max(8_000_000).optional(),
  }),
  z.object({ action: z.literal('send_text'), to: phone, text: z.string().min(1).max(4096), preview_url: z.boolean().optional(), reply_to: replyTo }),
  z.object({ action: z.literal('send_reaction'), to: phone, message_id: z.string().min(1).max(200), emoji: z.string().max(16) }),
  z.object({ action: z.literal('mark_read'), message_id: z.string().min(1).max(200), typing: z.boolean().optional() }),
  z.object({
    action: z.literal('send_template'), to: phone,
    template_name: z.string().regex(/^[a-z0-9_]{1,512}$/), language: z.string().min(2).max(20),
    body_params: z.array(z.string().max(1024)).max(20).optional(),
    components: z.array(z.record(z.unknown())).min(1).max(10).optional(),
    header_media_url: z.string().url().optional(), header_media_type: z.enum(['image', 'video', 'document']).optional(), reply_to: replyTo,
  }),
  z.object({
    action: z.literal('send_media'), to: phone,
    media_type: z.enum(['image', 'video', 'audio', 'document']), media_url: z.string().url().max(2000),
    caption: z.string().max(1024).optional(), filename: z.string().max(240).optional(), reply_to: replyTo,
  }),
  z.object({ action: z.literal('list_templates'), status: z.enum(['APPROVED', 'PENDING', 'REJECTED']).optional() }),
  z.object({
    action: z.literal('create_template'),
    name: z.string().regex(/^[a-z0-9_]{1,512}$/), language: z.string().min(2).max(20),
    category: z.enum(['UTILITY', 'MARKETING', 'AUTHENTICATION']),
    components: z.array(z.record(z.unknown())).min(1).max(10),
  }),
  z.object({ action: z.literal('edit_template'), template_id: z.string().regex(/^\d+$/), components: z.array(z.record(z.unknown())).min(1).max(10), category: z.enum(['UTILITY', 'MARKETING', 'AUTHENTICATION']).optional() }),
  z.object({ action: z.literal('delete_template'), name: z.string().regex(/^[a-z0-9_]{1,512}$/) }),
]);

async function graph(path: string, token: string, init: { method?: string; body?: unknown; query?: Record<string, string> } = {}) {
  const url = new URL(`${GRAPH}${path}`);
  for (const [k, v] of Object.entries(init.query || {})) url.searchParams.set(k, v);
  const res = await fetch(url, {
    method: init.method || 'GET',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

const metaError = (r: { status: number; data: any }) =>
  json({ success: false, error: r.data?.error?.error_user_msg || r.data?.error?.message || `Meta error ${r.status}`, meta_code: r.data?.error?.code ?? null }, r.status >= 500 ? 502 : 400);

export async function handlePublicWhatsAppApi(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  const started = Date.now();
  const apiKey = req.headers.get('x-api-key') || (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!apiKey.startsWith('wfh_')) return json({ success: false, error: 'Missing or invalid x-api-key header' }, 401);

  const { data: key } = await admin.from('api_keys').select('id,user_id,rate_limit_tier,is_active,expires_at').eq('api_key', apiKey).eq('is_active', true).maybeSingle();
  if (!key) return json({ success: false, error: 'Invalid or inactive API key' }, 401);
  if (key.expires_at && new Date(key.expires_at) < new Date()) return json({ success: false, error: 'API key expired' }, 401);
  const { data: activeSub } = await admin.from('api_subscriptions').select('id').eq('user_id', key.user_id).eq('status', 'active').or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`).limit(1).maybeSingle();
  if (!activeSub) return json({ success: false, error: 'API subscription inactive. Subscribe in the Workly India Developer Portal.' }, 402);
  const quota = await consumeApiCall(admin, key.user_id, req);
  if (!quota.allowed) return json({ success: false, error: API_LIMIT_MESSAGE, used: quota.used, limit: quota.limit }, 429);

  let raw: any = {};
  if (req.method === 'GET') raw = Object.fromEntries(new URL(req.url).searchParams);
  else raw = await req.json().catch(() => ({}));
  const rawAction = typeof raw?.action === 'string' ? raw.action : 'unknown';
  let subAccountId: string | null = null;
  const log = (status: number, error?: string) => admin.from('api_request_logs').insert({
    sub_account_id: subAccountId,
    api_key_id: key.id, endpoint: SEND_ACTIONS.has(rawAction) ? 'whatsapp-public-api:send' : `whatsapp-public-api:${rawAction}`,
    method: req.method, status_code: status, response_time_ms: Date.now() - started, error_message: error ?? null,
  }).then(() => {}, () => {});
  if (SUB_ACTIONS.has(rawAction)) {
    const [status, body] = await handleSubAccountAction(admin, key.user_id, raw);
    if (typeof (body as any)?.sub_account?.sub_account_id === 'string') subAccountId = (body as any).sub_account.sub_account_id;
    await log(status, body.success ? undefined : String(body.error));
    return json(body, status);
  }
  if (rawAction === 'limits_overview') {
    // Self-serve overview: the developer sees their API-key, account-number and
    // per-sub-account 24h usage in one call, without contacting support.
    await log(200);
    return json(await whatsappLimitsOverview(admin, key.user_id, key.id));
  }
  const wantsSub = typeof raw?.sub_account_id === 'string' || typeof raw?.external_id === 'string';
  const fromRaw = typeof raw?.from === 'string' ? raw.from.replace(/[^\d]/g, '') : '';
  const parsed = Body.safeParse(raw);
  if (!parsed.success) { await log(400, 'Invalid request'); return json({ success: false, error: 'Invalid request', details: parsed.error.flatten().fieldErrors }, 400); }
  const b = parsed.data;

  let companyId: string | null = null;
  let list: any[] = [];
  if (wantsSub) {
    // Send as one of the developer's own users (sub-account); scoped to this key owner only.
    const sub = await findSubAccount(admin, key.user_id, raw);
    if (!sub) { await log(404, 'Sub-account not found'); return json({ success: false, error: 'Sub-account not found' }, 404); }
    subAccountId = sub.id;
    list = await subAccountNumbers(admin, sub.id);
  } else {
    const { data: company } = await admin.from('companies').select('id').eq('user_id', key.user_id).limit(1).maybeSingle();
    if (!company?.id) { await log(403, 'No company profile linked to this API key'); return json({ success: false, error: 'No company profile linked to this API key' }, 403); }
    companyId = company.id;
    // A company can connect several numbers; `from` picks one by phone_number_id or display number, required when several are connected.
    const { data: numbers } = await admin.from('employer_whatsapp_accounts')
      .select('waba_id,phone_number_id,status,display_phone,verified_name,quality_rating,messaging_tier')
      .eq('company_id', company.id).eq('status', 'connected').not('phone_number_id', 'is', null)
      .order('connected_at', { ascending: true });
    list = (numbers || []) as any[];
  }
  if (b.action === 'list_numbers') {
    await log(200);
    return json({ success: true, ...(subAccountId ? { sub_account_id: subAccountId } : {}), numbers: list.map((n) => ({ phone_number_id: n.phone_number_id, phone: n.display_phone, verified_name: n.verified_name, quality_rating: n.quality_rating })) });
  }
  const acc = fromRaw
    ? list.find((n) => n.phone_number_id === fromRaw || String(n.display_phone || '').replace(/\D/g, '') === fromRaw)
    : (list.length === 1 ? list[0] : undefined);
  if (!fromRaw && list.length > 1 && !['status', 'usage'].includes(b.action)) { await log(400, 'Several numbers are connected; from is required'); return json({ success: false, error: 'Several numbers are connected. Pass "from" (phone_number_id or number). Call action=list_numbers.' }, 400); }
  if (fromRaw && !acc) { await log(404, 'Requested number is not connected'); return json({ success: false, error: `Number "${raw.from}" is not connected to ${subAccountId ? 'this sub-account' : 'your account'}. Call action=list_numbers.` }, 404); }
  let token: string | undefined;
  if (acc && subAccountId) token = await subAccountToken(admin, acc.phone_number_id);
  else if (acc) {
    const { data: tok } = await admin.from('employer_whatsapp_tokens').select('access_token').eq('company_id', companyId).eq('phone_number_id', acc.phone_number_id).maybeSingle();
    token = (tok as any)?.access_token as string | undefined;
  }
  const connected = acc?.status === 'connected' && !!acc.phone_number_id && !!acc.waba_id && !!token;

  // Monthly usage
  const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  const { count: used } = await admin.from('api_request_logs').select('id', { count: 'exact', head: true })
    .eq('api_key_id', key.id).eq('endpoint', 'whatsapp-public-api:send').eq('status_code', 200).gte('created_at', monthStart.toISOString());

  if (b.action === 'usage') { await log(200); return json({ success: true, plan: 'unlimited', used: used || 0 }); }
  if (b.action === 'status') {
    // Self-serve 24h WhatsApp tier usage, so developers can see their limit status without contacting support.
    const liveTier = peekCachedTier(acc?.phone_number_id);
    const tierLimit = tierLimitFromMeta(liveTier?.messaging_tier ?? (acc as any)?.messaging_tier);
    const phoneUsage = acc?.phone_number_id ? await whatsappSendUsage(admin, 'phone_number', acc.phone_number_id) : null;
    await log(200);
    return json({ success: true, ...(subAccountId ? { sub_account_id: subAccountId } : {}), connected: connected || list.length > 1, numbers: list.length, phone: acc?.display_phone ?? null, phone_number_id: acc?.phone_number_id ?? null, verified_name: acc?.verified_name ?? null, quality_rating: liveTier?.quality_rating ?? acc?.quality_rating ?? null,
      whatsapp_limits: { tier: liveTier?.messaging_tier ?? (acc as any)?.messaging_tier ?? 'TIER_250', limit_24h: tierLimit, used_24h: phoneUsage?.used ?? 0, remaining_24h: Math.max(tierLimit - (phoneUsage?.used ?? 0), 0), resets_at: phoneUsage?.resets_at ?? null } });
  }
  if (!connected || !acc || !token) { await log(409, 'WhatsApp is not connected'); return json({ success: false, error: subAccountId ? 'This sub-account has not connected WhatsApp yet. Send the user a connect link (action=create_connect_link).' : 'WhatsApp is not connected. Connect your number in the Workly India employer WhatsApp page.' }, 409); }

  // Meta-style tiered rate limit: checked per API key, per sub-account, and per phone
  // number before any message goes out. First scope to hit its cap blocks the send.
  const checkSendLimit = async () => {
    // Meta's most recent tier/quality wins over the stored copy, so a missed webhook can
    // never let a send through that Meta itself would reject.
    const live = peekCachedTier(acc.phone_number_id);
    const r = await consumeWhatsappSend(admin, { apiKeyId: key.id, subAccountId, phoneNumberId: acc.phone_number_id }, {
      tierLimit: tierLimitFromMeta(live?.messaging_tier ?? (acc as any)?.messaging_tier),
      quality: live?.quality_rating ?? (acc as any)?.quality_rating ?? null,
    });
    if (r.allowed) return null;
    await log(429, r.reason === 'burst_limit' ? 'WhatsApp burst limit' : 'WhatsApp 24h tier limit');
    return json(whatsappLimitError(r), 429);
  };

  const reply = (b as { reply_to?: string }).reply_to;

  if (b.action === 'get_profile') {
    const live = await graph(`/${acc.phone_number_id}`, token, {
      query: { fields: 'display_phone_number,verified_name,quality_rating,code_verification_status,messaging_limit_tier,name_status,platform_type,throughput' },
    });
    if (!live.ok) { await log(400, live.data?.error?.message); return metaError(live); }
    // The portfolio-level limit (what WhatsApp Manager shows) comes from the new field only.
    const liveTier = await fetchLiveTier(String(acc.phone_number_id), token);
    const currentTier = liveTier?.messaging_tier ?? readTier(live.data);
    // Meta answered with this number's current tier and quality: store them so the limits
    // page and the send path use Meta's truth instead of the value from connect time.
    await rememberLiveTier(admin, acc.phone_number_id, {
      quality_rating: typeof live.data?.quality_rating === 'string' ? live.data.quality_rating : null,
      messaging_tier: currentTier,
    });
    const profile = await graph(`/${acc.phone_number_id}/whatsapp_business_profile`, token, {
      query: { fields: 'about,address,description,email,websites,vertical,profile_picture_url,messaging_product' },
    });
    if (!profile.ok) { await log(400, profile.data?.error?.message); return metaError(profile); }
    await log(200);
    return json({
      success: true,
      profile: {
        phone_number: live.data?.display_phone_number ?? acc.display_phone ?? null,
        verified_name: live.data?.verified_name ?? acc.verified_name ?? null,
        quality_rating: live.data?.quality_rating ?? acc.quality_rating ?? null,
        messaging_limit: currentTier,
        display_name_status: live.data?.name_status ?? null,
        code_verification_status: live.data?.code_verification_status ?? null,
        platform_type: live.data?.platform_type ?? null,
        throughput: live.data?.throughput?.level ?? null,
        phone_number_id: acc.phone_number_id,
        waba_id: acc.waba_id,
        ...(profile.data?.data?.[0] || {}),
      },
    });
  }

  if (b.action === 'update_profile') {
    const payload: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      about: b.about,
      description: b.description ?? '',
      address: b.address ?? '',
      email: b.email ?? '',
      websites: b.websites ?? [],
    };
    if (b.vertical) payload.vertical = b.vertical;
    if (b.profile_picture) {
      const match = b.profile_picture.match(/^data:(image\/(?:jpeg|png));base64,(.+)$/);
      if (!match) { await log(400, 'profile_picture must be a JPG or PNG data URL'); return json({ success: false, error: 'profile_picture must be a JPG or PNG data URL' }, 400); }
      const bytes = Uint8Array.from(atob(match[2]), (character) => character.charCodeAt(0));
      if (bytes.byteLength > 5 * 1024 * 1024) { await log(400, 'Profile picture must be under 5 MB'); return json({ success: false, error: 'Profile picture must be under 5 MB' }, 400); }
      const { appId } = await getMetaAppCreds(admin);
      const session = await graph(`/${appId}/uploads`, token, {
        method: 'POST',
        query: { file_length: String(bytes.byteLength), file_type: match[1], file_name: 'profile-picture' },
      });
      if (!session.ok || !session.data?.id) { await log(400, session.data?.error?.message); return metaError(session); }
      const upload = await fetch(`${GRAPH}/${session.data.id}`, {
        method: 'POST',
        headers: { Authorization: `OAuth ${token}`, file_offset: '0', 'Content-Type': match[1] },
        body: bytes,
      });
      const uploaded = await upload.json().catch(() => ({}));
      if (!upload.ok || !uploaded?.h) {
        await log(400, uploaded?.error?.message || 'Meta could not upload the profile picture');
        return json({ success: false, error: uploaded?.error?.message || 'Meta could not upload the profile picture' }, 400);
      }
      payload.profile_picture_handle = uploaded.h;
    }
    const updated = await graph(`/${acc.phone_number_id}/whatsapp_business_profile`, token, { method: 'POST', body: payload });
    if (!updated.ok) { await log(400, updated.data?.error?.message); return metaError(updated); }
    const fresh = await graph(`/${acc.phone_number_id}/whatsapp_business_profile`, token, {
      query: { fields: 'about,address,description,email,websites,vertical,profile_picture_url,messaging_product' },
    });
    await log(200);
    return json({ success: true, profile: fresh.ok ? fresh.data?.data?.[0] || {} : {} });
  }

  const send = async (payload: Record<string, unknown>, preview: string, type: string, to: string) => {
    const limited = await checkSendLimit();
    if (limited) return limited;
    const r = await graph(`/${acc!.phone_number_id}/messages`, token!, { method: 'POST', body: { messaging_product: 'whatsapp', recipient_type: 'individual', to, ...payload, ...(reply ? { context: { message_id: reply } } : {}) } });
    if (!r.ok) { await log(400, r.data?.error?.message); return metaError(r); }
    const messageId = r.data?.messages?.[0]?.id ?? null;
    await admin.from('whatsapp_messages').insert({
      direction: 'outbound', recipient_phone: to, message_content: preview, message_type: type, status: 'sent',
      msg91_message_id: messageId, company_id: companyId, whatsapp_phone_number_id: acc!.phone_number_id,
      sent_at: new Date().toISOString(), metadata: { provider: 'cloud_api', source: 'public_api', api_key_id: key.id, sub_account_id: subAccountId } as any,
    }).then(() => {}, () => {});
    await log(200);
    return json({ success: true, message_id: messageId, to, from: acc!.phone_number_id, ...(subAccountId ? { sub_account_id: subAccountId } : {}) });
  };

  if (b.action === 'send_reaction') {
    const to = b.to.replace(/\D/g, '');
    const limited = await checkSendLimit();
    if (limited) return limited;
    const r = await graph(`/${acc!.phone_number_id}/messages`, token!, { method: 'POST', body: { messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'reaction', reaction: { message_id: b.message_id, emoji: b.emoji } } });
    if (!r.ok) { await log(400, r.data?.error?.message); return metaError(r); }
    await log(200);
    return json({ success: true, message_id: r.data?.messages?.[0]?.id ?? null, reacted_to: b.message_id, emoji: b.emoji, from: acc!.phone_number_id });
  }
  if (b.action === 'mark_read') {
    const body: Record<string, unknown> = { messaging_product: 'whatsapp', status: 'read', message_id: b.message_id };
    if (b.typing) body.typing_indicator = { type: 'text' };
    const r = await graph(`/${acc!.phone_number_id}/messages`, token!, { method: 'POST', body });
    if (!r.ok) { await log(400, r.data?.error?.message); return metaError(r); }
    await log(200);
    return json({ success: true, message_id: b.message_id, from: acc!.phone_number_id });
  }
  if (b.action === 'send_text') {
    const to = b.to.replace(/\D/g, '');
    return send({ type: 'text', text: { body: b.text, preview_url: !!b.preview_url } }, b.text, 'text', to);
  }
  if (b.action === 'send_media') {
    const to = b.to.replace(/\D/g, '');
    const media: Record<string, unknown> = { link: b.media_url };
    if (b.caption && b.media_type !== 'audio') media.caption = b.caption;
    if (b.filename && b.media_type === 'document') media.filename = b.filename;
    return send({ type: b.media_type, [b.media_type]: media }, b.caption || `[${b.media_type}]`, b.media_type, to);
  }
  if (b.action === 'send_template') {
    const to = b.to.replace(/\D/g, '');
    const components: any[] = [];
    if (b.header_media_url) {
      const t = b.header_media_type || 'image';
      components.push({ type: 'header', parameters: [{ type: t, [t]: { link: b.header_media_url } }] });
    }
    if (b.body_params?.length) components.push({ type: 'body', parameters: b.body_params.map((text) => ({ type: 'text', text })) });
    const template: Record<string, unknown> = { name: b.template_name, language: { code: b.language } };
    // Raw Meta components (e.g. OTP copy-code/URL buttons) take precedence over the shorthand fields.
    if (b.components?.length) template.components = b.components;
    else if (components.length) template.components = components;
    return send({ type: 'template', template }, `[template] ${b.template_name}`, 'template', to);
  }
  if (b.action === 'list_templates') {
    const query: Record<string, string> = { fields: 'id,name,status,language,category,components,rejected_reason', limit: '200' };
    if (b.status) query.status = b.status;
    const r = await graph(`/${acc!.waba_id}/message_templates`, token!, { query });
    await log(r.ok ? 200 : 400);
    return r.ok ? json({ success: true, templates: r.data?.data || [] }) : metaError(r);
  }
  if (b.action === 'create_template') {
    const r = await graph(`/${acc!.waba_id}/message_templates`, token!, { method: 'POST', body: { name: b.name, language: b.language, category: b.category, components: b.components } });
    await log(r.ok ? 200 : 400);
    return r.ok ? json({ success: true, template_id: r.data?.id, status: r.data?.status, category: r.data?.category }) : metaError(r);
  }
  if (b.action === 'edit_template') {
    const body: Record<string, unknown> = { components: b.components };
    if (b.category) body.category = b.category;
    const r = await graph(`/${b.template_id}`, token!, { method: 'POST', body });
    await log(r.ok ? 200 : 400);
    return r.ok ? json({ success: true }) : metaError(r);
  }
  if (b.action === 'delete_template') {
    const r = await graph(`/${acc!.waba_id}/message_templates`, token!, { method: 'DELETE', query: { name: b.name } });
    await log(r.ok ? 200 : 400);
    return r.ok ? json({ success: true }) : metaError(r);
  }
  await log(400, 'Unknown action');
  return json({ success: false, error: 'Unknown action' }, 400);
}
