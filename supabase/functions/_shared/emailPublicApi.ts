// Public Email API for developers: authenticate with a Developer Portal API key (x-api-key: wfh_...).
// Every call uses the API key owner's own mailbox connected on the AI Connect page (Gmail / Outlook / domain).
// If none is connected, calls fail with mailbox_not_connected — there is no fallback to the platform mailbox.
// Calls still go through the platform API so usage is metered. New incoming emails in each user's own mailbox
// are pushed to that user's webhook endpoints (event "email.received") by pollEmailWebhooks().
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';
import { listPersonalAccounts, runPersonalMailAction } from './supportMailChat.ts';
import { forwardToCustomerWebhooks } from './customerWebhooks.ts';
import { consumeApiCall, API_LIMIT_MESSAGE } from './apiQuota.ts';
import { findSubAccount } from './whatsappSubAccounts.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const admin = () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const provider = z.enum(['gmail', 'outlook', 'domain']);
const msgId = z.string().min(1).max(512);
const account = z.string().trim().email().max(320).optional();
const file = z.object({ name: z.string().min(1).max(240), mimeType: z.string().min(1).max(120), data: z.string().max(14_000_000) });
const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('status') }),
  z.object({ action: z.literal('usage') }),
  z.object({ action: z.literal('list_accounts') }),
  z.object({ action: z.literal('list_inbox'), offset: z.coerce.number().int().min(0).max(10000).optional(), limit: z.coerce.number().int().min(1).max(50).optional(), unread_only: z.coerce.boolean().optional(), provider: provider.optional(), account }),
  z.object({ action: z.literal('get_thread'), provider, account, id: msgId }),
  z.object({ action: z.literal('send_email'), provider: provider.optional(), account, to: z.string().min(3).max(2000), subject: z.string().min(1).max(500), text: z.string().min(1).max(100_000) }),
  z.object({ action: z.literal('reply'), provider, account, id: msgId, text: z.string().min(1).max(100_000), files: z.array(file).max(5).optional() }),
  z.object({ action: z.literal('get_attachment'), provider, account, id: msgId, message_id: msgId, attachment_id: z.string().min(1).max(2000) }),
  z.object({ action: z.literal('delete'), provider, account, ids: z.array(msgId).min(1).max(50) }),
]);
const SEND = new Set(['send_email', 'reply']);

type Mailbox = { provider: 'gmail' | 'outlook' | 'domain'; connected: boolean; mailbox: string; error?: string };


export async function handlePublicEmailApi(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  const started = Date.now();
  const db = admin();
  const apiKey = req.headers.get('x-api-key') || (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!apiKey.startsWith('wfh_')) return json({ success: false, error: 'Missing or invalid x-api-key header' }, 401);

  const { data: key } = await db.from('api_keys').select('id,user_id,is_active,expires_at').eq('api_key', apiKey).eq('is_active', true).maybeSingle();
  if (!key) return json({ success: false, error: 'Invalid or inactive API key' }, 401);
  if (key.expires_at && new Date(key.expires_at) < new Date()) return json({ success: false, error: 'API key expired' }, 401);
  const { data: activeSub } = await db.from('api_subscriptions').select('id').eq('user_id', key.user_id).eq('status', 'active')
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`).limit(1).maybeSingle();
  if (!activeSub) return json({ success: false, error: 'API subscription inactive. Subscribe in the Workly India Developer Portal.' }, 402);
  const quota = await consumeApiCall(db, key.user_id, req);
  if (!quota.allowed) return json({ success: false, error: API_LIMIT_MESSAGE, used: quota.used, limit: quota.limit }, 429);

  let raw: any = {};
  if (req.method === 'GET') raw = Object.fromEntries(new URL(req.url).searchParams);
  else raw = await req.json().catch(() => ({}));
  const rawAction = typeof raw?.action === 'string' ? raw.action : 'unknown';
  const log = (status: number, error?: string) => db.from('api_request_logs').insert({
    api_key_id: key.id, endpoint: SEND.has(rawAction) ? 'email-public-api:send' : `email-public-api:${rawAction}`,
    method: req.method, status_code: status, response_time_ms: Date.now() - started, error_message: error ?? null,
  }).then(() => {}, () => {});
  const parsed = Body.safeParse(raw);
  if (!parsed.success) { await log(400, 'Invalid request'); return json({ success: false, error: 'Invalid request', details: parsed.error.flatten().fieldErrors }, 400); }
  const b = parsed.data;

  // Always the API key owner's own AI Connect mailbox (Gmail / Outlook / domain) — never the platform mailbox.
  // With sub_account_id / external_id the developer's customer mailbox is used instead.
  let ownerId: string = key.user_id;
  let subRef: { sub_account_id: string; external_id: string } | null = null;
  if (raw?.sub_account_id || raw?.external_id) {
    const subAcc = await findSubAccount(db, key.user_id, raw);
    if (!subAcc) { await log(404, 'Sub-account not found'); return json({ success: false, error: 'Sub-account not found' }, 404); }
    ownerId = subAcc.id;
    subRef = { sub_account_id: subAcc.id, external_id: subAcc.external_id };
  }
  void subRef;

  const mailboxes = async (): Promise<Mailbox[]> => {
    const r = await runPersonalMailAction(ownerId, 'support_mail_list', { limit: 1 });
    return (r.mailboxes || []) as Mailbox[];
  };

  try {
    if (b.action === 'usage') {
      const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
      const { count } = await db.from('api_request_logs').select('id', { count: 'exact', head: true })
        .eq('api_key_id', key.id).eq('endpoint', 'email-public-api:send').eq('status_code', 200).gte('created_at', monthStart.toISOString());
      await log(200);
      return json({ success: true, plan: 'unlimited', sent_this_month: count || 0 });
    }
    if (b.action === 'status') {
      const list = await mailboxes();
      const connected = list.filter((m) => m.connected);
      await log(200);
      return json({
        success: true,
        connected: connected.length > 0,
        accounts: connected.map((m) => ({ provider: m.provider, email: m.mailbox })),
      });
    }
    if (b.action === 'list_accounts') {
      const accounts = await listPersonalAccounts(ownerId);
      await log(200);
      return json({ success: true, accounts: accounts.map(({ is_default: _d, ...a }: any) => a) });
    }
    if (b.action === 'list_inbox') {
      const offset = b.offset ?? 0, limit = b.limit ?? 20;
      const r = await runPersonalMailAction(ownerId, 'support_mail_list', { offset, limit, account: b.account });
      if (!(r.mailboxes || []).some((m: Mailbox) => m.connected)) { await log(409, 'No email connected'); return notConnected(); }
      const acct = b.account?.toLowerCase();
      const items = (r.items || [])
        .filter((i: any) => !b.unread_only || i.unread)
        .filter((i: any) => !b.provider || i.provider === b.provider)
        .filter((i: any) => !acct || String(i.mailbox || '').toLowerCase() === acct)
        .map(publicItem);
      await log(200);
      return json({ success: true, items, has_more: !!r.hasMore });
    }
    if (b.action === 'get_thread') {
      const r = await runPersonalMailAction(ownerId, 'support_mail_thread', { provider: b.provider, id: b.id, account: b.account });
      await log(200);
      return json({ success: true, items: (r.items || []).map((i: any) => ({ ...publicItem(i), html: i.html || null })) });
    }
    if (b.action === 'send_email') {
      let p = b.provider;
      if (!p && b.account) {
        const acct = b.account.toLowerCase();
        p = (await listPersonalAccounts(ownerId)).find((a) => (a.email || '').toLowerCase() === acct)?.provider;
        if (!p) { await log(404, 'Requested email account is not connected'); return json({ success: false, error: `Account ${b.account} is not connected in AI Connect` }, 404); }
      }
      if (!p) {
        const conn = (await mailboxes()).filter((m) => m.connected);
        if (!conn.length) { await log(409, 'No email connected'); return notConnected(); }
        if (conn.length > 1) { await log(400, 'Several mailboxes are connected; account is required'); return json({ success: false, error: 'Several mailboxes are connected. Pass "account" (email). Call action=list_accounts.' }, 400); }
        p = conn[0].provider;
      }
      await runPersonalMailAction(ownerId, 'support_mail_send', { provider: p, to: b.to, subject: b.subject, body: b.text, account: b.account });
      await log(200);
      return json({ success: true, sent: true, provider: p, from: b.account ?? null, to: b.to });
    }
    if (b.action === 'reply') {
      await runPersonalMailAction(ownerId, 'support_mail_reply', { provider: b.provider, id: b.id, body: b.text, files: b.files || [], account: b.account });
      await log(200);
      return json({ success: true, sent: true, provider: b.provider, reply_to: b.id });
    }
    if (b.action === 'get_attachment') {
      const r = await runPersonalMailAction(ownerId, 'support_mail_attachment', { provider: b.provider, id: b.id, messageId: b.message_id, attachmentId: b.attachment_id, account: b.account });
      await log(200);
      return json({ success: true, filename: r.filename, mime_type: r.mimeType, data_base64: r.data });
    }
    if (b.action === 'delete') {
      const r = await runPersonalMailAction(ownerId, 'support_mail_delete', { provider: b.provider, ids: b.ids, account: b.account });
      await log(200);
      return json({ success: true, deleted: r.deleted });
    }
    await log(400, 'Unknown action');
    return json({ success: false, error: 'Unknown action' }, 400);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Email request failed';
    await log(400, message);
    if (/^Account .* is not connected/i.test(message)) return json({ success: false, error: message }, 404);
    if (/not connected/i.test(message)) return notConnected();
    return json({ success: false, error: message }, 400);
  }
}

const notConnected = () =>
  json({ success: false, code: 'mailbox_not_connected', error: 'No email connected. Connect Gmail, Outlook or Domain email on the Workly India AI Connect page, then try again.' }, 409);

function publicItem(i: any) {
  return {
    id: i.id, provider: i.provider, mailbox: i.mailbox, thread_id: i.threadId ?? null,
    from: i.from, to: i.to, subject: i.subject, date: i.date, text: i.body,
    unread: !!i.unread, has_attachments: !!i.hasAttachments,
    attachments: (i.attachments || []).map((a: any) => ({ id: a.id, filename: a.filename, mime_type: a.mimeType, size: a.size })),
  };
}

/** Cron: push new emails arriving in each developer's OWN connected mailbox to that developer's webhook as "email.received". */
export async function pollEmailWebhooks(): Promise<{ users: number; forwarded: number }> {
  const db = admin();
  const { data: hooks } = await db.from('webhook_endpoints').select('user_id,events').eq('is_active', true);
  const users = [...new Set((hooks || [])
    .filter((h: any) => Array.isArray(h.events) && h.events.some((e: string) => e === 'email.received' || e === 'email.*' || /^(gmail|outlook|domain)\.\*/.test(e)))
    .map((h: any) => h.user_id as string))].slice(0, 200);
  if (users.length === 0) return { users: 0, forwarded: 0 };

  // Only paying developers are checked; states are loaded in one query to keep database use low.
  const nowIso = new Date().toISOString();
  const [{ data: subs }, { data: states }] = await Promise.all([
    db.from('api_subscriptions').select('user_id').in('user_id', users).eq('status', 'active').or(`expires_at.is.null,expires_at.gt.${nowIso}`),
    db.from('email_api_inbox_state').select('user_id,last_seen_at').in('user_id', users),
  ]);
  const paid = new Set((subs || []).map((s: any) => s.user_id));
  const stateMap = new Map((states || []).map((s: any) => [s.user_id, s.last_seen_at]));

  let forwarded = 0;
  for (const userId of users.filter((u) => paid.has(u))) {
    try {
      // 50 newest emails per check so nothing is missed between the hourly runs.
      const r = await runPersonalMailAction(userId, 'support_mail_list', { offset: 0, limit: 50 });
      if (!(r.mailboxes || []).some((m: Mailbox) => m.connected)) continue;
      let items = (r.items || []) as any[];
      const newest = items.reduce((m, i) => Math.max(m, Date.parse(i.date) || 0), 0);
      const state = stateMap.has(userId) ? { last_seen_at: stateMap.get(userId) as string } : null;
      if (!state) {
        // First run: remember the current inbox position without flooding old emails.
        await db.from('email_api_inbox_state').upsert({ user_id: userId, last_seen_at: new Date(newest || Date.now()).toISOString() });
        continue;
      }
      const since = Date.parse(state.last_seen_at) || 0;
      // No cap: keep paging back until we reach emails already delivered, so every new email is forwarded.
      let page = items;
      for (let offset = 50; page.length === 50 && page.every((i) => (Date.parse(i.date) || 0) > since) && offset < 5000; offset += 50) {
        const more = await runPersonalMailAction(userId, 'support_mail_list', { offset, limit: 50 });
        page = (more.items || []) as any[];
        items = items.concat(page);
      }
      const seen = new Set<string>();
      const fresh = items.filter((i) => (Date.parse(i.date) || 0) > since)
        .filter((i) => { const k = `${i.provider}:${i.id}`; if (seen.has(k)) return false; seen.add(k); return true; })
        .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
      for (const item of fresh) {
        await forwardToCustomerWebhooks(db, userId, 'email.received', publicItem(item));
        forwarded++;
      }
      if (newest > since) await db.from('email_api_inbox_state').update({ last_seen_at: new Date(newest).toISOString(), updated_at: new Date().toISOString() }).eq('user_id', userId);
    } catch (e) {
      console.error('[email-api-poll] user skipped', userId, e instanceof Error ? e.message : e);
    }
  }
  forwarded += await pollSubAccountMail(db, users.filter((u) => paid.has(u)));
  return { users: users.length, forwarded };
}

/** Same polling for developers' customer (sub-account) mailboxes; events go to the developer's webhook. */
async function pollSubAccountMail(db: any, devs: string[]): Promise<number> {
  if (!devs.length) return 0;
  const { data: subs } = await db.from('developer_sub_accounts').select('id,developer_user_id,external_id').in('developer_user_id', devs).limit(1000);
  const ids = (subs || []).map((s: any) => s.id);
  if (!ids.length) return 0;
  const { data: conns } = await db.from('app_user_connections').select('user_id').in('user_id', ids).in('connector_id', ['google_mail', 'microsoft_outlook', 'custom_email']);
  const withMail = new Set((conns || []).map((c: any) => c.user_id));
  let forwarded = 0;
  for (const s of (subs || []).filter((x: any) => withMail.has(x.id))) {
    try {
      const r = await runPersonalMailAction(s.id, 'support_mail_list', { offset: 0, limit: 50 });
      const items = (r.items || []) as any[];
      const newest = items.reduce((m, i) => Math.max(m, Date.parse(i.date) || 0), 0);
      const { data: st } = await db.from('email_api_inbox_state').select('last_seen_at').eq('user_id', s.id).maybeSingle();
      if (!st) { await db.from('email_api_inbox_state').upsert({ user_id: s.id, last_seen_at: new Date(newest || Date.now()).toISOString() }); continue; }
      const since = Date.parse(st.last_seen_at) || 0;
      const fresh = items.filter((i) => (Date.parse(i.date) || 0) > since).sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
      for (const item of fresh) {
        await forwardToCustomerWebhooks(db, s.developer_user_id, 'email.received', { ...publicItem(item), sub_account_id: s.id, external_id: s.external_id });
        forwarded++;
      }
      if (newest > since) await db.from('email_api_inbox_state').update({ last_seen_at: new Date(newest).toISOString(), updated_at: new Date().toISOString() }).eq('user_id', s.id);
    } catch (e) {
      console.error('[email-api-poll] sub-account skipped', s.id, e instanceof Error ? e.message : e);
    }
  }
  return forwarded;
}
