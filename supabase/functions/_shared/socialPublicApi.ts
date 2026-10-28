// Public Instagram / Facebook inbox API for developers: authenticate with a wfh_ API key (x-api-key)
// and send body.platform = "instagram" | "facebook". Uses the key owner's accounts connected in AI Connect.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';
import { consumeApiCall, API_LIMIT_MESSAGE } from './apiQuota.ts';
import { findSubAccount } from './whatsappSubAccounts.ts';

const FB = 'https://graph.facebook.com/v21.0';
const IG = 'https://graph.instagram.com/v21.0';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const id = z.string().min(1).max(200);
const base = { platform: z.enum(['instagram', 'facebook']), account: z.string().max(200).optional() };
const Body = z.discriminatedUnion('action', [
  z.object({ ...base, action: z.literal('status') }),
  z.object({ ...base, action: z.literal('usage') }),
  z.object({ ...base, action: z.literal('list_accounts') }),
  z.object({ ...base, action: z.literal('list_conversations'), limit: z.number().int().min(1).max(100).optional(), after: z.string().max(500).optional() }),
  z.object({ ...base, action: z.literal('get_messages'), conversation_id: id, limit: z.number().int().min(1).max(100).optional(), after: z.string().max(500).optional() }),
  z.object({ ...base, action: z.literal('send_text'), to: id, text: z.string().min(1).max(1000), reply_to: id.optional() }),
  z.object({ ...base, action: z.literal('send_media'), to: id, media_type: z.enum(['image', 'video', 'audio', 'file']), media_url: z.string().url().max(2000) }),
  z.object({ ...base, action: z.literal('mark_read'), to: id, typing: z.boolean().optional() }),
  z.object({ ...base, action: z.literal('list_posts'), limit: z.number().int().min(1).max(100).optional(), after: z.string().max(500).optional() }),
  z.object({ ...base, action: z.literal('list_comments'), post_id: id, limit: z.number().int().min(1).max(100).optional(), after: z.string().max(500).optional() }),
  z.object({ ...base, action: z.literal('reply_comment'), comment_id: id, text: z.string().min(1).max(2000) }),
  z.object({ ...base, action: z.literal('private_reply'), comment_id: id, text: z.string().min(1).max(1000) }),
]);

const SEND = new Set(['send_text', 'send_media', 'reply_comment', 'private_reply']);

export async function handlePublicSocialApi(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  const started = Date.now();
  const apiKey = req.headers.get('x-api-key') || '';
  if (!apiKey.startsWith('wfh_')) return json({ success: false, error: 'Missing or invalid x-api-key header' }, 401);
  const { data: key } = await admin.from('api_keys').select('id,user_id,is_active,expires_at').eq('api_key', apiKey).eq('is_active', true).maybeSingle();
  if (!key) return json({ success: false, error: 'Invalid or inactive API key' }, 401);
  if (key.expires_at && new Date(key.expires_at) < new Date()) return json({ success: false, error: 'API key expired' }, 401);
  const { data: sub } = await admin.from('api_subscriptions').select('id').eq('user_id', key.user_id).eq('status', 'active')
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`).limit(1).maybeSingle();
  if (!sub) return json({ success: false, error: 'API subscription is not active' }, 402);
  const quota = await consumeApiCall(admin, key.user_id, req);
  if (!quota.allowed) return json({ success: false, error: API_LIMIT_MESSAGE, used: quota.used, limit: quota.limit }, 429);

  const raw = await req.json().catch(() => null);
  const rawPlatform = raw?.platform === 'instagram' || raw?.platform === 'facebook' ? raw.platform : 'social';
  const rawAction = typeof raw?.action === 'string' ? raw.action : 'unknown';
  const log = (status: number, error?: string) => admin.from('api_request_logs').insert({
    api_key_id: key.id, endpoint: SEND.has(rawAction) ? `${rawPlatform}-public-api:send` : `${rawPlatform}-public-api:${rawAction}`,
    method: 'POST', status_code: status, response_time_ms: Date.now() - started, error_message: error ?? null,
  }).then(() => {}, () => {});
  const parsed = Body.safeParse(raw);
  if (!parsed.success) { await log(400, 'Invalid request'); return json({ success: false, error: 'Invalid request', details: parsed.error.flatten().fieldErrors }, 400); }
  const b = parsed.data;
  const p = b.platform;
  // Developer customer (sub-account): use that customer's connected account instead of the developer's own.
  let ownerUid: string = key.user_id;
  if (raw?.sub_account_id || raw?.external_id) {
    const subAcc = await findSubAccount(admin, key.user_id, raw);
    if (!subAcc) { await log(404, 'Sub-account not found'); return json({ success: false, error: 'Sub-account not found' }, 404); }
    ownerUid = subAcc.id;
  }

  const { data: rows } = await admin.from('social_meta_accounts')
    .select('id,platform,page_id,ig_user_id,name,username,picture_url,status')
    .eq('user_id', ownerUid).eq('platform', p).eq('status', 'connected')
    .order('created_at', { ascending: true });
  const list = (rows || []) as any[];
  const view = (a: any, i: number) => ({ account_id: a.id, page_id: a.page_id, ig_user_id: a.ig_user_id, name: a.name, username: a.username, picture_url: a.picture_url });
  if (b.action === 'list_accounts') { await log(200); return json({ success: true, platform: p, accounts: list.map(view) }); }

  const want = b.account?.replace(/^@/, '').toLowerCase();
  const acc = want ? list.find((a) => [a.id, a.page_id, a.ig_user_id, a.username].some((v) => v && String(v).toLowerCase() === want)) : (list.length === 1 ? list[0] : undefined);
  if (!want && list.length > 1 && !['status', 'usage'].includes(b.action)) { await log(400, 'Several accounts are connected; account is required'); return json({ success: false, error: 'Several accounts are connected. Pass "account" (account_id, page_id, ig_user_id or username). Call action=list_accounts.' }, 400); }
  if (want && !acc) { await log(404, 'Requested account is not connected'); return json({ success: false, error: `Account "${b.account}" is not connected. Call action=list_accounts.` }, 404); }

  const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  if (b.action === 'usage') {
    const { count } = await admin.from('api_request_logs').select('id', { count: 'exact', head: true })
      .eq('api_key_id', key.id).eq('endpoint', `${p}-public-api:send`).eq('status_code', 200).gte('created_at', monthStart.toISOString());
    await log(200);
    return json({ success: true, plan: 'unlimited', used: count || 0 });
  }
  if (b.action === 'status') { await log(200); return json({ success: true, platform: p, connected: !!acc, account: acc ? view(acc, list.indexOf(acc)) : null }); }
  if (!acc) { await log(409, `${p} is not connected`); return json({ success: false, error: `${p === 'instagram' ? 'Instagram' : 'Facebook'} is not connected. Connect it on the AI Connect page.` }, 409); }

  const { data: tok } = await admin.from('social_meta_tokens').select('page_access_token').eq('account_id', acc.id).maybeSingle();
  const token = (tok as any)?.page_access_token as string | undefined;
  if (!token) { await log(409, 'Account token missing'); return json({ success: false, error: 'Account token missing. Reconnect it on the AI Connect page.' }, 409); }

  // Instagram Login tokens (IG...) use graph.instagram.com; Facebook-linked tokens use graph.facebook.com.
  const igLogin = p === 'instagram' && token.startsWith('IG');
  const host = igLogin ? IG : FB;
  const sender = igLogin ? acc.ig_user_id : acc.page_id;
  const ownerId = p === 'instagram' ? acc.ig_user_id : acc.page_id;

  const call = async (path: string, query: Record<string, string | undefined> = {}, body?: unknown) => {
    const url = new URL(`${host}${path}`);
    for (const [k, v] of Object.entries(query)) if (v !== undefined) url.searchParams.set(k, v);
    url.searchParams.set('access_token', token);
    const res = await fetch(url, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.error) {
      const msg = data?.error?.error_user_msg || data?.error?.message || `Meta error ${res.status}`;
      await log(res.status >= 500 ? 502 : 400, msg);
      throw json({ success: false, error: msg, meta_code: data?.error?.code ?? null }, res.status >= 500 ? 502 : 400);
    }
    return data;
  };
  const page = (d: any) => ({ data: d?.data || [], next: d?.paging?.cursors?.after && d?.paging?.next ? d.paging.cursors.after : null });
  const lim = (n?: number) => String(n || 25);
  const sendMsg = (payload: Record<string, unknown>) => call(`/${sender}/messages`, {}, { ...payload, ...(igLogin ? {} : { messaging_type: 'RESPONSE' }) });

  try {
    let out: Record<string, unknown>;
    switch (b.action) {
      case 'list_conversations': {
        const d = await call(igLogin ? '/me/conversations' : `/${acc.page_id}/conversations`, {
          platform: p === 'instagram' ? 'instagram' : 'messenger', limit: lim(b.limit), after: b.after,
          fields: 'id,updated_time,unread_count,participants,messages.limit(1){id,message,from,created_time}',
        });
        const { data, next } = page(d);
        out = { conversations: data.map((c: any) => {
          const other = (c.participants?.data || []).find((x: any) => String(x.id) !== String(ownerId)) || null;
          const last = c.messages?.data?.[0];
          return { conversation_id: c.id, updated_time: c.updated_time, unread_count: c.unread_count ?? null,
            customer: other ? { id: other.id, name: other.name ?? other.username ?? null, username: other.username ?? null } : null,
            last_message: last ? { message_id: last.id, text: last.message ?? '', from_id: last.from?.id ?? null, created_time: last.created_time } : null };
        }), next };
        break;
      }
      case 'get_messages': {
        const d = await call(`/${b.conversation_id}/messages`, { limit: lim(b.limit), after: b.after, fields: 'id,created_time,from,to,message,attachments,reactions,story,shares' });
        const { data, next } = page(d);
        out = { messages: data.map((m: any) => ({
          message_id: m.id, created_time: m.created_time, text: m.message ?? '',
          from: m.from ? { id: m.from.id, name: m.from.name ?? m.from.username ?? null } : null,
          direction: String(m.from?.id) === String(ownerId) ? 'outgoing' : 'incoming',
          attachments: (m.attachments?.data || []).map((a: any) => ({ type: a.mime_type || a.type || null, url: a.image_data?.url || a.video_data?.url || a.file_url || a.payload?.url || null, name: a.name ?? null })),
        })), next };
        break;
      }
      case 'send_text': {
        const d = await sendMsg({ recipient: { id: b.to }, message: { text: b.text }, ...(b.reply_to ? { reply_to: { mid: b.reply_to } } : {}) });
        out = { message_id: d.message_id, to: d.recipient_id ?? b.to };
        break;
      }
      case 'send_media': {
        const type = p === 'instagram' && b.media_type === 'file' ? 'image' : b.media_type;
        const d = await sendMsg({ recipient: { id: b.to }, message: { attachment: { type, payload: { url: b.media_url, ...(p === 'facebook' ? { is_reusable: true } : {}) } } } });
        out = { message_id: d.message_id, to: d.recipient_id ?? b.to };
        break;
      }
      case 'mark_read': {
        await sendMsg({ recipient: { id: b.to }, sender_action: 'mark_seen' });
        if (b.typing) await sendMsg({ recipient: { id: b.to }, sender_action: 'typing_on' });
        out = { ok: true };
        break;
      }
      case 'list_posts': {
        const d = p === 'instagram'
          ? await call(`/${acc.ig_user_id}/media`, { limit: lim(b.limit), after: b.after, fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,comments_count,like_count' })
          : await call(`/${acc.page_id}/posts`, { limit: lim(b.limit), after: b.after, fields: 'id,message,created_time,permalink_url,full_picture' });
        const { data, next } = page(d);
        out = { posts: data.map((x: any) => ({ post_id: x.id, text: x.caption ?? x.message ?? '', media_type: x.media_type ?? null, media_url: x.media_url ?? x.full_picture ?? null, permalink: x.permalink ?? x.permalink_url ?? null, created_time: x.timestamp ?? x.created_time, comments_count: x.comments_count ?? null, like_count: x.like_count ?? null })), next };
        break;
      }
      case 'list_comments': {
        const d = await call(`/${b.post_id}/comments`, { limit: lim(b.limit), after: b.after, fields: p === 'instagram' ? 'id,text,username,from,timestamp,like_count,replies{id,text,username,timestamp}' : 'id,message,from,created_time,like_count,comments{id,message,from,created_time}' });
        const { data, next } = page(d);
        const map = (c: any) => ({ comment_id: c.id, text: c.text ?? c.message ?? '', from: { id: c.from?.id ?? null, name: c.username ? '@' + c.username : c.from?.name ?? null }, created_time: c.timestamp ?? c.created_time, like_count: c.like_count ?? null });
        out = { comments: data.map((c: any) => ({ ...map(c), replies: ((c.replies || c.comments)?.data || []).map(map) })), next };
        break;
      }
      case 'reply_comment': {
        const d = await call(p === 'instagram' ? `/${b.comment_id}/replies` : `/${b.comment_id}/comments`, {}, { message: b.text });
        out = { comment_id: d.id };
        break;
      }
      case 'private_reply': {
        const d = await sendMsg({ recipient: { comment_id: b.comment_id }, message: { text: b.text } });
        out = { message_id: d.message_id, to: d.recipient_id ?? null };
        break;
      }
    }
    await log(200);
    return json({ success: true, platform: p, account_id: acc.id, ...out! });
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : String(e);
    await log(500, msg);
    return json({ success: false, error: msg }, 500);
  }
}
