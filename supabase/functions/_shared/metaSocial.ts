// Facebook Page + Instagram Business: connect (OAuth) and AI auto replies to comments and inbox messages.
// Connect actions run inside workly-india (scope: 'meta_social'); webhook events inside meta-whatsapp-webhook.
import { getBusinessContext, resolveSupportOwner } from './businessProfile.ts';
import { supportOwnerId } from './supportReplyScope.ts';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createOpenAI } from 'npm:@ai-sdk/openai@2';
import { streamText } from 'npm:ai@5';
import { reserveAiChatMessage } from './aiChatLimit.ts';
import { forwardToCustomerWebhooks } from './customerWebhooks.ts';
import { readMetaProfile } from './metaProfileReader.ts';
import { exchangeInstagramLogin, INSTAGRAM_GRAPH_VERSION } from './instagramLogin.ts';
import { metaSubscriptionTarget } from './metaWebhookSecurity.ts';
import { putMedia, deleteMedia } from './r2Media.ts';
import { buildMediaKey, parseMediaKey } from './mediaR2.ts';

const GRAPH = 'https://graph.facebook.com/v21.0';
const MODEL = 'openai/gpt-6-astra';
const SCOPES = [
  'pages_show_list', 'pages_manage_metadata', 'pages_read_engagement', 'pages_manage_engagement',
  'pages_messaging', 'business_management', 'instagram_basic', 'instagram_manage_comments', 'instagram_manage_messages',
];

type Platform = 'facebook' | 'instagram';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// Meta App ID/Secret: Secrets page (owner_secrets) first, then Supabase env, then default app id.
let metaCredsCache: { appId: string; secret: string; at: number } | null = null;
export async function getMetaAppCreds(admin: SupabaseClient) {
  if (metaCredsCache && Date.now() - metaCredsCache.at < 60_000) return metaCredsCache;
  let saved: Array<{ name: string; value: string | null }> = [];
  try {
    const { data } = await admin.from('owner_secrets').select('name, value').in('name', ['META_APP_ID', 'META_APP_SECRET']);
    saved = data || [];
  } catch { /* owner_secrets may not exist */ }
  const pick = (n: string, envFallback: string) =>
    saved.find((r) => r.name === n)?.value?.trim() || envFallback;
  const creds = {
    appId: pick('META_APP_ID', Deno.env.get('META_APP_ID') || '1092186133267704'),
    secret: pick('META_APP_SECRET', Deno.env.get('META_APP_SECRET') || ''),
    at: Date.now(),
  };
  metaCredsCache = creds;
  return creds;
}

// Message field sets Meta rejected for a platform/login type (per warm instance), to avoid repeat calls.
const rejectedFieldSets = new Map<string, Set<string>>();
const resubscribed = new Set<string>();

// Map Graph message reactions ({data:[{reaction, users:[{id}]}]}) to emoji + who reacted.
const REACTION_EMOJI: Record<string, string> = { love: '❤️', like: '👍', haha: '😂', wow: '😮', sad: '😢', angry: '😡', smile: '😊' };
function normalizeReactions(r: any, ownId: string): { emoji: string; from_me: boolean }[] {
  const out: { emoji: string; from_me: boolean }[] = [];
  for (const item of (r?.data || [])) {
    const raw = String(item?.reaction || item?.emoji || '');
    if (!raw) continue;
    const emoji = REACTION_EMOJI[raw.toLowerCase()] || raw;
    const users: any[] = item?.users?.data || item?.users || [];
    if (!users.length) out.push({ emoji, from_me: false });
    for (const u of users) out.push({ emoji, from_me: String(u?.id) === ownId });
  }
  return out;
}

// Instagram API with Instagram Login (instagram.com login screen, not Facebook).
const IG_GRAPH = 'https://graph.instagram.com';
const IG_SCOPES = ['instagram_business_basic', 'instagram_business_manage_messages', 'instagram_business_manage_comments'];

// Secrets page (owner_secrets) first, then env.
async function igCreds(admin: SupabaseClient) {
  const { data } = await admin.from('owner_secrets').select('name, value').in('name', ['INSTAGRAM_APP_ID', 'INSTAGRAM_APP_SECRET']);
  const get = (n: string) => (data || []).find((r: any) => r.name === n)?.value?.trim() || Deno.env.get(n) || '';
  return { appId: get('INSTAGRAM_APP_ID'), secret: get('INSTAGRAM_APP_SECRET') };
}

async function igGraph(path: string, init?: RequestInit, versioned = true) {
  const res = await fetch(`${IG_GRAPH}${versioned ? `/${INSTAGRAM_GRAPH_VERSION}` : ''}${path}`, init);
  const text = await res.text();
  let data: any = {};
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok || data?.error) throw new Error(`[${res.status}] ${data?.error?.message || text.slice(0, 300)}`);
  return data;
}

async function graph(path: string, init?: RequestInit) {
  const res = await fetch(`${GRAPH}${path}`, init);
  const text = await res.text();
  let data: any = {};
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok || data?.error) {
    throw new Error(`[${res.status}] ${data?.error?.message || text.slice(0, 300)}`);
  }
  return data;
}

async function subscribeMetaAccount(account: { platform: Platform; page_id: string; ig_user_id?: string | null }, token: string) {
  const target = metaSubscriptionTarget(account.platform, token.startsWith('IG'), account.page_id, account.ig_user_id);
  const call = target.instagram ? igGraph : graph;
  await call(`${target.path}?subscribed_fields=${target.fields}&access_token=${encodeURIComponent(token)}`, { method: 'POST' });
}

function isRedirectUri(v: unknown): v is string {
  if (typeof v !== 'string' || v.length > 500) return false;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' || u.hostname === 'localhost';
  } catch { return false; }
}

// ---------------------------------------------------------------------------
// Connect / settings (called with the user's JWT)
// ---------------------------------------------------------------------------
/** Stable UUID for the owner's Customer Service Instagram/Facebook accounts. */

export async function handleMetaSocial(req: Request, raw: any, admin: SupabaseClient): Promise<Response> {
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: u } = jwt ? await admin.auth.getUser(jwt) : { data: { user: null } };
  let userId = u?.user?.id;
  if (!userId) return json({ success: false, error: 'Please sign in first' }, 401);
  // Customer Service accounts live under a separate owner key so they never mix with AI Connect.
  if (raw?.audience === 'support') {
    const { data: adm } = await admin.from('admin_users').select('role').eq('user_id', userId).maybeSingle();
    if (adm?.role !== 'owner') return json({ success: false, error: 'Only the owner can manage customer service accounts' }, 403);
    userId = await supportOwnerId(userId);
  }

  const action = String(raw?.action || '');
  const platform: Platform | null = raw?.platform === 'instagram' ? 'instagram' : raw?.platform === 'facebook' ? 'facebook' : null;

  if (action === 'status') {
    const { data } = await admin.from('social_meta_accounts')
      .select('id, platform, page_id, ig_user_id, name, username, picture_url, status, is_default, ai_reply_comments, ai_reply_messages, ai_tone, ai_language, ai_reply_length, ai_business_info, ai_custom_instructions, ai_signature')
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true });
    return json({ success: true, accounts: data || [] });
  }

  if (!platform) return json({ success: false, error: 'platform must be facebook or instagram' }, 400);

  const accountIdParam = typeof raw?.account_id === 'string' ? raw.account_id : null;
  /** The requested account of this user/platform, else the default one. */
  const pickAccount = async () => {
    let q = admin.from('social_meta_accounts').select('id, is_default').eq('user_id', userId).eq('platform', platform);
    if (accountIdParam) q = q.eq('id', accountIdParam);
    const { data } = await q.order('is_default', { ascending: false }).order('created_at', { ascending: true }).limit(1);
    return data?.[0] ?? null;
  };
  /** Saves one Page / IG account without touching the user's other accounts. */
  const saveAccount = async (row: Record<string, unknown>, token: string) => {
    const { count } = await admin.from('social_meta_accounts').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).eq('platform', platform).neq('page_id', String(row.page_id));
    const { data: acc, error } = await admin.from('social_meta_accounts').upsert({
      ...row, user_id: userId, platform, status: 'connected', ...(count ? {} : { is_default: true }),
    }, { onConflict: 'user_id,platform,page_id' }).select('id').single();
    if (error || !acc) throw new Error(error?.message || 'Save failed');
    await admin.from('social_meta_tokens').upsert({ account_id: acc.id, page_access_token: token, updated_at: new Date().toISOString() });
    return acc.id as string;
  };

  if (action === 'connect_url') {
    if (!isRedirectUri(raw?.redirect_uri)) return json({ success: false, error: 'Invalid redirect_uri' }, 400);
    const state = typeof raw?.state === 'string' ? raw.state.slice(0, 200) : '';
    // Instagram connects through Facebook Login so the app-reviewed instagram_basic /
    // instagram_manage_* permissions apply to every account (no Tester invites).
    // Instagram Login stays available only when explicitly requested.
    if (platform === 'instagram' && raw?.instagram_login === true) {
      const ig = await igCreds(admin);
      if (!ig.appId) return json({ success: false, error: 'INSTAGRAM_APP_ID is not configured' }, 500);
      const url = new URL('https://www.instagram.com/oauth/authorize');
      url.searchParams.set('client_id', ig.appId);
      url.searchParams.set('redirect_uri', raw.redirect_uri);
      url.searchParams.set('state', state);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('enable_fb_login', '0');
      url.searchParams.set('force_authentication', '1');
      url.searchParams.set('scope', IG_SCOPES.join(','));
      return json({ success: true, url: url.toString() });
    }
    const { appId } = await getMetaAppCreds(admin);
    const url = new URL('https://www.facebook.com/v21.0/dialog/oauth');
    url.searchParams.set('client_id', appId);
    url.searchParams.set('redirect_uri', raw.redirect_uri);
    url.searchParams.set('state', state);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', SCOPES.join(','));
    // Let the user pick more Pages when adding another account.
    url.searchParams.set('auth_type', 'rerequest');
    return json({ success: true, url: url.toString() });
  }

  if (action === 'callback' && platform === 'instagram' && raw?.instagram_login === true) {
    const code = (typeof raw?.code === 'string' ? raw.code : '').replace(/#_$/, '');
    if (code.length < 10 || code.length > 2000) return json({ success: false, error: 'Invalid code' }, 400);
    if (!isRedirectUri(raw?.redirect_uri)) return json({ success: false, error: 'Invalid redirect_uri' }, 400);
    const ig = await igCreds(admin);
    if (!ig.appId || !ig.secret) return json({ success: false, error: 'INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET is not configured' }, 500);
    try {
      const { token, profile: me, userId: igId } = await exchangeInstagramLogin(ig.appId, ig.secret, code, raw.redirect_uri);
      await subscribeMetaAccount({ platform, page_id: igId, ig_user_id: igId }, token);
      // Same IG account previously connected through Facebook Login: replace it (keep its switches)
      // so one Instagram account never has two rows answering the same comment.
      const { data: older } = await admin.from('social_meta_accounts').select('id, ai_reply_comments, ai_reply_messages, is_default')
        .eq('user_id', userId).eq('platform', platform).eq('ig_user_id', igId).neq('page_id', igId);
      const carry = older?.[0] ? { ai_reply_comments: older.some((o: any) => o.ai_reply_comments), ai_reply_messages: older.some((o: any) => o.ai_reply_messages), ...(older.some((o: any) => o.is_default) ? { is_default: true } : {}) } : {};
      if (older?.length) await admin.from('social_meta_accounts').delete().in('id', older.map((o: any) => o.id));
      const id = await saveAccount({
        page_id: igId, ig_user_id: igId,
        name: me.name || null,
        username: me.username ?? null, picture_url: me.profile_picture_url ?? null,
        ...carry,
      }, token);
      return json({ success: true, name: me.username || me.name, account_id: id });
    } catch (e) {
      console.error('[meta-social] ig callback failed', e);
      return json({ success: false, error: e instanceof Error ? e.message : String(e) }, 400);
    }
  }

  if (action === 'callback') {
    const code = typeof raw?.code === 'string' ? raw.code : '';
    if (code.length < 10 || code.length > 2000) return json({ success: false, error: 'Invalid code' }, 400);
    if (!isRedirectUri(raw?.redirect_uri)) return json({ success: false, error: 'Invalid redirect_uri' }, 400);
    const { appId, secret } = await getMetaAppCreds(admin);
    if (!secret) return json({ success: false, error: 'META_APP_SECRET is not configured' }, 500);
    try {
      const short = await graph(`/oauth/access_token?client_id=${appId}&client_secret=${encodeURIComponent(secret)}&redirect_uri=${encodeURIComponent(raw.redirect_uri)}&code=${encodeURIComponent(code)}`);
      const long = await graph(`/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${encodeURIComponent(secret)}&fb_exchange_token=${encodeURIComponent(short.access_token)}`);
      const pages = await graph(`/me/accounts?fields=id,name,access_token,picture{url},instagram_business_account{id,name,username,profile_picture_url}&limit=50&access_token=${encodeURIComponent(long.access_token)}`);
      const list: any[] = pages?.data || [];
      const wanted = typeof raw?.page_id === 'string' ? raw.page_id : null;
      const eligible = list.filter((p) => platform === 'facebook' || p.instagram_business_account?.id);
      const chosen = wanted ? eligible.filter((p) => p.id === wanted) : eligible;
      if (!chosen.length) {
        return json({
          success: false,
          error: platform === 'instagram'
            ? 'No Instagram Business/Creator account is linked to your Facebook Pages. Link it in Instagram settings first.'
            : 'No Facebook Page found. Create a Page or allow access to it during login.',
        }, 400);
      }
      // Every Page / IG account granted in this login is added; existing ones stay connected.
      let firstId = '';
      for (const page of chosen) {
        const ig = page.instagram_business_account;
        await subscribeMetaAccount({ platform, page_id: page.id, ig_user_id: ig?.id }, page.access_token);
        const id = await saveAccount({
          page_id: page.id,
          ig_user_id: ig?.id ?? null,
          name: platform === 'instagram' ? ig?.name || null : page.name,
          username: ig?.username ?? null,
          picture_url: platform === 'instagram' ? ig?.profile_picture_url ?? null : page.picture?.data?.url ?? null,
        }, page.access_token);
        firstId ||= id;
      }
      const page = chosen[0];
      return json({ success: true, name: page.name, account_id: firstId, added: chosen.length, pages: eligible.map((p) => ({ id: p.id, name: p.name })) });
    } catch (e) {
      console.error('[meta-social] callback failed', e);
      return json({ success: false, error: e instanceof Error ? e.message : String(e) }, 400);
    }
  }

  if (action === 'disconnect') {
    const acc = await pickAccount();
    if (acc) {
      await admin.from('social_meta_accounts').delete().eq('id', acc.id);
      if (acc.is_default) {
        const { data: next } = await admin.from('social_meta_accounts').select('id').eq('user_id', userId).eq('platform', platform)
          .order('created_at', { ascending: true }).limit(1);
        if (next?.[0]) await admin.from('social_meta_accounts').update({ is_default: true }).eq('id', next[0].id);
      }
    }
    return json({ success: true });
  }

  if (action === 'set_default') {
    if (!accountIdParam) return json({ success: false, error: 'account_id is required' }, 400);
    const acc = await pickAccount();
    if (!acc) return json({ success: false, error: 'Account not found' }, 404);
    await admin.from('social_meta_accounts').update({ is_default: false }).eq('user_id', userId).eq('platform', platform);
    await admin.from('social_meta_accounts').update({ is_default: true }).eq('id', acc.id);
    return json({ success: true });
  }

  if (action === 'settings') {
    const s = raw?.settings || {};
    const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : undefined);
    const patch: Record<string, unknown> = {};
    if (typeof s.ai_reply_comments === 'boolean') patch.ai_reply_comments = s.ai_reply_comments;
    if (typeof s.ai_reply_messages === 'boolean') patch.ai_reply_messages = s.ai_reply_messages;
    for (const [k, max] of [['ai_tone', 30], ['ai_language', 30], ['ai_reply_length', 20], ['ai_business_info', 3000], ['ai_custom_instructions', 1500], ['ai_signature', 200]] as const) {
      const v = str(s[k], max);
      if (v !== undefined) patch[k] = v;
    }
    const acc = await pickAccount();
    if (!acc) return json({ success: false, error: 'Account not found' }, 404);
    // A saved ON state must not hide a failed per-account webhook subscription.
    if (patch.ai_reply_comments === true || patch.ai_reply_messages === true) {
      const { data: connection } = await admin.from('social_meta_accounts').select('platform,page_id,ig_user_id').eq('id', acc.id).eq('user_id', userId).single();
      const { data: stored } = await admin.from('social_meta_tokens').select('page_access_token').eq('account_id', acc.id).maybeSingle();
      if (!connection || !stored?.page_access_token) return json({ success: false, error: 'Reconnect this account before enabling replies' }, 400);
      try { await subscribeMetaAccount(connection, stored.page_access_token); }
      catch (e) { return json({ success: false, error: e instanceof Error ? e.message : 'Meta webhook subscription failed' }, 400); }
    }
    const { error } = await admin.from('social_meta_accounts').update(patch).eq('id', acc.id).eq('user_id', userId);
    if (error) return json({ success: false, error: error.message }, 400);
    return json({ success: true });
  }

  if (action === 'get_profile') {
    const picked = await pickAccount();
    if (!picked) return json({ success: false, error: 'Account not found' }, 404);
    const { data: acc } = await admin.from('social_meta_accounts').select('id, page_id, ig_user_id').eq('id', picked.id).eq('user_id', userId).eq('platform', platform).single();
    const { data: tok } = await admin.from('social_meta_tokens').select('page_access_token').eq('account_id', picked.id).maybeSingle();
    const token = tok?.page_access_token;
    if (!acc || !token) return json({ success: false, error: 'Reconnect this account in AI Connect to refresh its profile.' }, 400);
    const igLogin = platform === 'instagram' && token.startsWith('IG');
    const g = igLogin ? igGraph : graph;
    const target = igLogin ? '/me' : `/${encodeURIComponent(platform === 'instagram' ? acc.ig_user_id || acc.page_id : acc.page_id)}`;
    const read = (fields: string) => g(`${target}?fields=${fields}&access_token=${encodeURIComponent(token)}`);
    try {
      const { profile, partial } = await readMetaProfile(platform, read);
      const patch: Record<string, unknown> = {};
      if (typeof profile.name === 'string') patch.name = profile.name;
      if (typeof profile.username === 'string') patch.username = profile.username;
      if (typeof profile.picture_url === 'string') patch.picture_url = profile.picture_url;
      if (Object.keys(patch).length) await admin.from('social_meta_accounts').update(patch).eq('id', picked.id).eq('user_id', userId).eq('platform', platform);
      return json({ success: true, profile, partial });
    } catch (error) {
      // Do not log Graph responses or URLs: they can contain access tokens.
      const message = error instanceof Error ? error.message : '';
      const reconnect = /expired|access token|session|OAuthException|permission/i.test(message);
      console.warn('[meta-profile] refresh failed', { platform, accountId: picked.id, reconnect });
      return json({ success: false, error: reconnect ? 'Reconnect this account in AI Connect to restore Meta profile access.' : 'Meta could not refresh this account. Please try again.' }, 400);
    }
  }

  // ---- Inbox chat (conversations / messages / send) for the employer Chat page ----
  if (action === 'chat_conversations' || action === 'chat_messages' || action === 'chat_send' || action === 'chat_react' || action === 'chat_contact' || action === 'chat_delete') {
    const picked = await pickAccount();
    if (!picked) return json({ success: false, error: 'not_connected' }, 404);
    const { data: acc } = await admin.from('social_meta_accounts').select('id, page_id, ig_user_id').eq('id', picked.id).eq('user_id', userId).single();
    const { data: tok } = await admin.from('social_meta_tokens').select('page_access_token').eq('account_id', picked.id).maybeSingle();
    const token = tok?.page_access_token as string | undefined;
    if (!acc || !token) return json({ success: false, error: 'Account token missing — reconnect it in AI Connect' }, 400);
    const t = encodeURIComponent(token);
    const igLogin = platform === 'instagram' && token.startsWith('IG');
    const g = igLogin ? igGraph : graph;
    const ownId = String(platform === 'instagram' ? (acc.ig_user_id || acc.page_id) : acc.page_id);
    const base = igLogin ? '/me' : `/${acc.page_id}`;
    try {
      if (action === 'chat_delete') {
        const mids: string[] = Array.isArray(raw.message_ids) ? raw.message_ids.filter((id: unknown) => typeof id === 'string' && id.length <= 500).slice(0, 50) : [];
        if (typeof raw.conversation_id === 'string' && raw.conversation_id.length <= 300) {
          let after = '';
          do {
            const page = await g(`/${encodeURIComponent(raw.conversation_id)}/messages?fields=id&limit=100${after ? `&after=${encodeURIComponent(after)}` : ''}&access_token=${t}`);
            mids.push(...(page.data || []).map((m: any) => String(m.id)));
            after = page.paging?.next ? page.paging?.cursors?.after || '' : '';
          } while (after);
        }
        if (!mids.length) return json({ success: false, error: 'Select messages to delete' }, 400);
        for (let offset = 0; offset < mids.length; offset += 50) {
        const batch = mids.slice(offset, offset + 50);
        const { data: events, error } = await admin.from('social_meta_message_events').select('id, attachments').eq('platform', platform).eq('owner_id', ownId).eq('kind', 'message').in('mid', batch);
        if (error) throw error;
        for (const event of events || []) {
          for (const attachment of Array.isArray(event.attachments) ? event.attachments : []) {
            const key = typeof attachment?.url === 'string' ? attachment.url.split('/media/')[1] : '';
            const fullKey = key ? `media/${key}` : '';
            const parsed = parseMediaKey(fullKey);
            if (parsed?.scope === `chat-${platform}` && !await deleteMedia(parsed.scope, fullKey)) throw new Error('Cloudflare attachment could not be deleted');
          }
          await admin.from('social_meta_message_events').update({ attachments: [], emoji: 'deleted' }).eq('id', event.id);
        }
        // Tombstones stop Graph history from showing deleted messages again.
        const { error: deletedError } = await admin.from('social_meta_message_events').upsert(batch.map((mid: string) => ({ platform, owner_id: ownId, mid, kind: 'message', actor_id: '', attachments: [], emoji: 'deleted' })), { onConflict: 'platform,mid,kind,actor_id' });
        if (deletedError) throw deletedError;
        }
        if (raw.conversation_id) {
          const { error } = await admin.from('social_meta_message_events').upsert({ platform, owner_id: ownId, mid: raw.conversation_id, kind: 'chat_deleted', actor_id: '', emoji: mids[0] }, { onConflict: 'platform,mid,kind,actor_id' });
          if (error) throw error;
        }
        return json({ success: true });
      }
      if (action === 'chat_conversations') {
        // Accounts connected earlier lack reaction/echo webhooks — subscribe once per warm instance.
        if (!resubscribed.has(acc.id)) {
          await subscribeMetaAccount({ ...acc, platform }, token);
          resubscribed.add(acc.id);
        }
        const after = typeof raw?.after === 'string' ? `&after=${encodeURIComponent(raw.after.slice(0, 500))}` : '';
        const plat = platform === 'instagram' ? '&platform=instagram' : '';
        const r = await g(`${base}/conversations?fields=id,updated_time,unread_count,participants,messages.limit(1){id,message,from,created_time}&limit=25${plat}${after}&access_token=${t}`);
        const { data: deletedChats } = await admin.from('social_meta_message_events').select('mid, emoji').eq('platform', platform).eq('owner_id', ownId).eq('kind', 'chat_deleted');
        const conversations = (r.data || []).filter((c: any) => !deletedChats?.some((d: any) => d.mid === c.id && d.emoji === String(c.messages?.data?.[0]?.id))).map((c: any) => {
          const parts: any[] = c.participants?.data || [];
          const other = parts.find((p) => String(p.id) !== ownId) || parts[0] || {};
          const last = c.messages?.data?.[0];
          return {
            id: c.id,
            updated_time: c.updated_time || last?.created_time || null,
            unread_count: c.unread_count || 0,
            contact_id: other.id ? String(other.id) : null,
            contact_name: other.name || (other.username ? `@${other.username}` : 'Unknown'),
            contact_username: typeof other.username === 'string' && other.username ? other.username : null,
            last_message: last?.message || (last ? 'Attachment' : ''),
            last_from_me: last ? String(last.from?.id) === ownId : false,
          };
        });
        return json({ success: true, conversations, next: r.paging?.cursors?.after && r.paging?.next ? r.paging.cursors.after : null });
      }
      if (action === 'chat_contact') {
        // Header details for the open chat: real name, username and profile photo, whichever Meta exposes.
        const contactId = typeof raw?.contact_id === 'string' ? raw.contact_id.slice(0, 100) : '';
        if (!contactId || contactId === ownId) return json({ success: false, error: 'contact_id is required' }, 400);
        const contact: { name: string | null; username: string | null; picture_url: string | null } = { name: null, username: null, picture_url: null };
        const take = (d: any) => {
          if (typeof d?.name === 'string' && d.name) contact.name = d.name;
          if (typeof d?.username === 'string' && d.username) contact.username = d.username;
          const pic = d?.profile_pic || d?.profile_picture_url;
          if (typeof pic === 'string' && pic.startsWith('http')) contact.picture_url = pic;
        };
        // Messenger users (PSIDs) have no username field — asking for it makes Meta reject the whole request.
        const fields = platform === 'instagram' ? 'name,username,profile_pic' : 'name,first_name,last_name,profile_pic';
        const id = encodeURIComponent(contactId);
        // Ask for everything once; on rejection retry with name only so one unsupported field cannot hide the rest.
        try { take(await g(`/${id}?fields=${fields}&access_token=${t}`)); }
        catch {
          try { take(await g(`/${id}?fields=name&access_token=${t}`)); } catch { /* keep whatever Meta returned */ }
        }
        return json({ success: true, contact });
      }
      const convId = typeof raw?.conversation_id === 'string' ? raw.conversation_id.slice(0, 300) : '';
      if (action === 'chat_messages') {
        if (!convId) return json({ success: false, error: 'conversation_id is required' }, 400);
        const basic = 'id,message,from,created_time,attachments';
        // reactions / reply_to are not exposed on every API version or login type. Try the richest
        // field set first; remember rejected sets per platform so polling doesn't burn Meta's rate limit.
        const cacheKey = `${platform}:${igLogin ? 'ig' : 'fb'}`;
        const sets = [',reactions,reply_to', ',reply_to', ',reactions', ''].filter((s) => !(rejectedFieldSets.get(cacheKey)?.has(s)));
        let r: any = null;
        for (const extra of sets) {
          try { r = await g(`/${encodeURIComponent(convId)}/messages?fields=${basic}${extra}&limit=50&access_token=${t}`); break; }
          catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            // Rate limits are not a field problem — stop instead of retrying with fewer fields.
            if (!extra || /limit reached|\[4\]|\[613\]|\[17\]|\[32\]/i.test(msg)) throw e;
            if (!rejectedFieldSets.has(cacheKey)) rejectedFieldSets.set(cacheKey, new Set());
            rejectedFieldSets.get(cacheKey)!.add(extra);
            console.warn(`[meta-social] messages fields "${extra}" rejected`, msg);
          }
        }
        const data: any[] = r?.data || [];
        // Meta may return reply_to as {mid}, {id}, a nested message, or a plain string.
        const replyId = (rt: any): string | null => (typeof rt === 'string' ? rt : rt?.mid || rt?.id || rt?.message?.mid || rt?.message?.id || null);
        // Webhook-recorded reply_to / reactions / attachments (Meta's reliable source for these).
        const mids = data.map((m) => String(m.id)).filter(Boolean);
        const { data: evs } = mids.length
          ? await admin.from('social_meta_message_events').select('mid, kind, actor_id, reply_to_mid, emoji, attachments')
            .eq('platform', platform).eq('owner_id', ownId).in('mid', mids)
          : { data: [] as any[] };
        const evBy = new Map<string, any[]>();
        for (const e of evs || []) { const l = evBy.get(e.mid) || []; l.push(e); evBy.set(e.mid, l); }
        const typeOf = (a: any): string => {
          const mt = String(a?.mime_type || a?.type || '');
          if (a?.image_data || mt.startsWith('image')) return 'image';
          if (a?.video_data || mt.startsWith('video')) return 'video';
          if (mt.startsWith('audio')) return 'audio';
          return mt === 'image' || mt === 'video' || mt === 'audio' ? mt : 'file';
        };
        const messages = data.filter((m: any) => !evBy.get(String(m.id))?.some((e: any) => e.kind === 'message' && e.emoji === 'deleted')).map((m: any) => {
          const ev = evBy.get(String(m.id)) || [];
          const msgEv = ev.find((e) => e.kind === 'message');
          let attachments: { type: string; url: string; name?: string }[] = (m.attachments?.data || []).map((a: any) => ({
            type: typeOf(a),
            url: a.image_data?.url || a.video_data?.url || a.file_url || a.payload?.url || '',
            name: a.name || undefined,
          })).filter((a: any) => a.url);
          if (Array.isArray(msgEv?.attachments) && msgEv.attachments.length) {
            attachments = msgEv.attachments.map((a: any) => ({ type: a.type === 'file' ? 'file' : a.type, url: a.url }));
          }
          const reactions = normalizeReactions(m.reactions, ownId);
          for (const e of ev.filter((x) => x.kind === 'reaction')) {
            const fromMe = e.actor_id === ownId;
            if (!reactions.some((r) => r.emoji === e.emoji && r.from_me === fromMe)) reactions.push({ emoji: e.emoji, from_me: fromMe });
          }
          return {
            id: m.id,
            text: m.message || '',
            from_me: String(m.from?.id) === ownId,
            created_time: m.created_time,
            attachment: attachments[0]?.url || null,
            attachments,
            reply_to: replyId(m.reply_to) || msgEv?.reply_to_mid || null,
            reactions,
          };
        }).reverse();
        return json({ success: true, messages });
      }
      const to = typeof raw?.recipient_id === 'string' ? raw.recipient_id.slice(0, 100) : '';
      if (action === 'chat_react') {
        const mid = typeof raw?.message_id === 'string' ? raw.message_id.slice(0, 500) : '';
        if (!to || !mid) return json({ success: false, error: 'recipient_id and message_id are required' }, 400);
        const remove = raw?.remove === true;
        // Instagram only accepts "love"; Messenger accepts any emoji (sender actions docs).
        const wanted = typeof raw?.emoji === 'string' ? raw.emoji.trim().slice(0, 16) : '';
        const reaction = platform === 'instagram' ? 'love' : (wanted || '❤️');
        await g(`${base}/messages?access_token=${t}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: { id: to },
            sender_action: remove ? 'unreact' : 'react',
            payload: remove ? { message_id: mid } : { message_id: mid, reaction },
          }),
        });
        return json({ success: true });
      }
      const text = typeof raw?.text === 'string' ? raw.text.trim().slice(0, 2000) : '';
      // Native media (image / video / audio / file) like WhatsApp, not a link.
      const mediaUrl = typeof raw?.media_url === 'string' && /^https:\/\//.test(raw.media_url) ? raw.media_url.slice(0, 2000) : '';
      if (mediaUrl) {
        if (!to) return json({ success: false, error: 'recipient_id is required' }, 400);
        const mt = String(raw?.media_type || '');
        const type = mt === 'image' || mt === 'video' || mt === 'audio' ? mt : 'file';
        const sent = await g(`${base}/messages?access_token=${t}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: { id: to },
            message: { attachment: { type, payload: { url: mediaUrl, ...(platform === 'facebook' ? { is_reusable: true } : {}) } } },
            ...(platform === 'facebook' ? { messaging_type: 'RESPONSE' } : {}),
          }),
        });
        if (sent.message_id) {
          const { error } = await admin.from('social_meta_message_events').upsert({ platform, owner_id: ownId, mid: sent.message_id, kind: 'message', actor_id: '', attachments: [{ type, url: mediaUrl }] }, { onConflict: 'platform,mid,kind,actor_id' });
          if (error) throw error;
        }
        if (text) {
          await g(`${base}/messages?access_token=${t}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipient: { id: to }, message: { text }, ...(platform === 'facebook' ? { messaging_type: 'RESPONSE' } : {}) }),
          });
        }
        return json({ success: true, message_id: sent.message_id || null });
      }
      if (!to || !text) return json({ success: false, error: 'recipient_id and text are required' }, 400);
      const replyMid = typeof raw?.reply_to_mid === 'string' ? raw.reply_to_mid.slice(0, 500) : '';
      const fallbackText = typeof raw?.fallback_text === 'string' ? raw.fallback_text.trim().slice(0, 2000) : '';
      const post = (msgText: string, withReply: boolean) => g(`${base}/messages?access_token=${t}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: to },
          message: { text: msgText },
          ...(withReply ? { reply_to: { mid: replyMid } } : {}),
          ...(platform === 'facebook' ? { messaging_type: 'RESPONSE' } : {}),
        }),
      });
      if (replyMid) {
        // Native threaded reply so the customer sees it as a real reply; quote the text if Meta rejects it.
        try {
          const sent = await post(text, true);
          return json({ success: true, message_id: sent.message_id || null, native_reply: true });
        } catch (e) {
          console.warn('[meta-social] native reply rejected, sending quoted text', e instanceof Error ? e.message : e);
          const sent = await post(fallbackText || text, false);
          return json({ success: true, message_id: sent.message_id || null, native_reply: false });
        }
      }
      const sent = await post(text, false);
      return json({ success: true, message_id: sent.message_id || null });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[meta-social] ${action} failed`, msg);
      return json({ success: false, error: msg }, 400);
    }
  }

  return json({ success: false, error: 'Unknown action' }, 400);
}

// ---------------------------------------------------------------------------
// Webhook (object: page | instagram)
// ---------------------------------------------------------------------------
async function generateSocialReply(opts: { account: any; platform: Platform; kind: 'comment' | 'message'; text: string; context?: string; history?: { role: 'user' | 'assistant'; content: string }[] }) {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) { console.warn('[meta-social] LOVABLE_API_KEY missing'); return null; }
  const provider = createOpenAI({
    baseURL: 'https://ai.gateway.lovable.dev/v1',
    apiKey,
    headers: { 'Lovable-API-Key': apiKey, 'X-Lovable-AIG-SDK': 'vercel-ai-sdk' },
  });
  const a = opts.account;
  const tone: Record<string, string> = {
    professional: 'Use a polite, professional tone.', friendly: 'Use a warm, friendly tone.',
    concise: 'Be very concise.', supportive: 'Be supportive and encouraging.',
  };
  const length: Record<string, string> = {
    short: 'Keep replies under 50 words.', medium: 'Keep replies under 100 words.', long: 'Replies may be up to 180 words.',
  };
  const lang = a.ai_language === 'Hindi' ? 'Always reply in Hindi (Devanagari).'
    : a.ai_language === 'Hinglish' ? 'Always reply in Hinglish (Hindi in Roman script).'
    : a.ai_language === 'English' ? 'Always reply in English.'
    : 'Reply in the same language the person uses.';
  const where = opts.platform === 'instagram'
    ? (opts.kind === 'comment' ? 'a public comment on an Instagram post' : 'an Instagram direct message')
    : (opts.kind === 'comment' ? 'a public comment on a Facebook Page post' : 'a Facebook Messenger message to the Page');
  const parts = [
    `You reply on behalf of "${a.name || 'this business'}" to ${where}.`,
    tone[a.ai_tone || ''] || tone.friendly,
    lang,
    length[a.ai_reply_length || ''] || length.short,
    'STRICT BUSINESS SCOPE: You are the official customer-service voice for the connected account only. Discuss ONLY this account/business, its own products/services, current post/reel, and verified business context provided below. Do not mention, recommend, compare, promote, or provide information about unrelated platforms, competitors, other businesses, or unrelated topics. If asked about another platform/business or unrelated topic, politely say you can help only with this connected business and redirect to its services. Never invent facts; if details are missing, ask one brief clarification or say the team can confirm. Plain text only, no markdown.',
    'Follow-growth policy: Never claim you checked whether this person follows the account; the official API may not expose that status. Never perform or promise an automatic follow. If and only if this is a friendly, positive, non-support conversation and a follow invitation genuinely fits, you may add one brief, optional invitation to follow our official profile for future updates. Do not ask in simple compliments (e.g. nice photo, great, thanks), transactional/job questions, complaints, sensitive matters, or when it would feel repetitive. Never repeat a follow invitation within the same conversation; if conversation history shows one, omit it. Never condition help, benefits, or access on following. For public comments, do not add a follow CTA unless the user explicitly asks about our page/profile or future updates. Plain text only.',
    opts.kind === 'comment' ? 'For this incoming COMMENT, write a distinct, context-specific PUBLIC comment reply that directly addresses the exact words and intent. Do not use a generic template or repeat the same greeting across comments. Match the comment language (Hindi/Hinglish/English), sentiment, and specificity; vary natural phrasing and emoji sparingly. Answer concrete questions using only verified business/post context; if unclear, ask one brief clarifying question. Keep public reply concise (usually 1 sentence, max 35 words), helpful, respectful, and safe for everyone to see. Never invite them to DM us: the system separately sends a personalized PRIVATE DM. The private DM must expand help based on the comment, not copy the public reply, and must not say "we sent you a private message". Never invent prices, guarantees, facts, or promotions; never ask for OTPs/passwords/payment credentials.' : '',
  ];
  if (a.ai_business_info?.trim()) parts.push(`Business info:\n${a.ai_business_info.trim().slice(0, 3000)}`);
  if (a.ai_custom_instructions?.trim()) parts.push(`Extra instructions:\n${a.ai_custom_instructions.trim().slice(0, 1500)}`);
  if (a.ai_signature?.trim()) parts.push(`End every reply with: ${a.ai_signature.trim().slice(0, 200)}`);

  if (opts.context) parts.push(opts.context);
  if (opts.kind === 'comment') parts.push('Make the reply specific to the post content above and to what the person said.');
  const businessContext = await getBusinessContext(a.user_id, opts.platform, a.id);
  const result = streamText({
    model: provider.responses(MODEL),
    system: [parts.filter(Boolean).join('\n'), businessContext].filter(Boolean).join('\n\n'),
    messages: [...(opts.history || []), { role: 'user' as const, content: opts.text.slice(0, 2000) }],
    providerOptions: {
      openai: { forceReasoning: true, reasoningEffort: 'low', reasoningSummary: 'auto', store: false, include: ['reasoning.encrypted_content'] },
    },
  });
  let out = '';
  try { for await (const c of result.textStream) out += c; } catch (e) {
    console.error('[meta-social] AI failed', e instanceof Error ? e.message : e);
    return null;
  }
  return out.trim() || null;
}

/** Page/IG profile, the post being commented on, and recent DM history for better replies. */
async function buildMetaContext(supabase: SupabaseClient, account: any, ev: { platform: Platform; kind: 'comment' | 'message'; senderId: string; eventId: string; postId?: string; senderName?: string }, token: string) {
  const t = encodeURIComponent(token);
  const isIgToken = token.startsWith('IG');
  const safe = async (fn: () => Promise<any>) => { try { return await fn(); } catch { return null; } };
  const g = (path: string) => (ev.platform === 'instagram' && isIgToken ? igGraph : graph)(path);
  const lines: string[] = [];
  const profile = ev.platform === 'instagram'
    ? await safe(() => g(`/${account.ig_user_id}?fields=username,name,biography,website,followers_count&access_token=${t}`))
    : await safe(() => graph(`/${account.page_id}?fields=name,about,category,description,website,phone,emails,single_line_address,hours&access_token=${t}`));
  if (profile) {
    const p = profile;
    lines.push(`Connected ${ev.platform === 'instagram' ? 'Instagram' : 'Facebook Page'} profile (this is YOU):`);
    for (const [label, v] of [['Name', p.name], ['Username', p.username ? '@' + p.username : ''], ['Category', p.category], ['About', p.about || p.biography], ['Description', p.description], ['Website', p.website], ['Phone', p.phone], ['Email', Array.isArray(p.emails) ? p.emails.join(', ') : ''], ['Address', p.single_line_address], ['Followers', p.followers_count]] as const) {
      if (v) lines.push(`- ${label}: ${String(v).slice(0, 600)}`);
    }
    if (p.hours && typeof p.hours === 'object') lines.push(`- Hours: ${Object.entries(p.hours).map(([k, v]) => `${k} ${v}`).join(', ').slice(0, 400)}`);
  }
  if (ev.kind === 'comment' && ev.postId) {
    const post = ev.platform === 'instagram'
      ? await safe(() => g(`/${ev.postId}?fields=caption,media_type,permalink,timestamp&access_token=${t}`))
      : await safe(() => graph(`/${ev.postId}?fields=message,story,permalink_url,created_time&access_token=${t}`));
    const text = post?.caption || post?.message || post?.story;
    if (text) lines.push(`The post being commented on${post?.media_type ? ` (${String(post.media_type).toLowerCase()})` : ''}:\n"${String(text).slice(0, 1500)}"`);
  }
  if (ev.senderName) lines.push(`Person: ${ev.senderName}`);
  const history: { role: 'user' | 'assistant'; content: string }[] = [];
  if (ev.kind === 'message') {
    const { data } = await supabase.from('social_meta_replies').select('incoming_text, reply_text')
      .eq('account_id', account.id).eq('kind', 'message').eq('sender_id', ev.senderId).neq('event_id', ev.eventId)
      .order('created_at', { ascending: false }).limit(6);
    for (const r of (data || []).reverse()) {
      if (r.incoming_text) history.push({ role: 'user', content: String(r.incoming_text).slice(0, 1000) });
      if (r.reply_text) history.push({ role: 'assistant', content: String(r.reply_text).slice(0, 1000) });
    }
  }
  return { context: lines.join('\n'), history };
}

/** WhatsApp-style push for Instagram/Facebook events through the same notification hub.
 *  Icon comes from Email settings uploads (email_social_icon_instagram / email_social_icon_facebook),
 *  so updating the logo there updates the notification icon. Never throws. */
/** Best-effort: fetch the real person's name for a DM sender (webhooks don't include it). */
async function resolveSenderName(platform: Platform, senderId: string, token: string): Promise<string | undefined> {
  const t = encodeURIComponent(token);
  const id = encodeURIComponent(senderId);
  const isIg = platform === 'instagram';
  const call = isIg && token.startsWith('IG') ? igGraph : graph;
  const attempts = isIg ? ['name,username', 'name', 'username'] : ['first_name,last_name', 'name'];
  for (const fields of attempts) {
    try {
      const p: any = await call(`/${id}?fields=${fields}&access_token=${t}`);
      if (isIg) {
        if (p?.name) return p.name;
        if (p?.username) return '@' + p.username;
      } else {
        const fb = [p?.first_name, p?.last_name].filter(Boolean).join(' ').trim();
        if (fb || p?.name) return fb || p.name;
      }
    } catch (e) {
      console.warn('[social-push] name lookup failed', platform, fields, String(e).slice(0, 200));
    }
  }
  return undefined;
}

/** Best-effort sender avatar lookup. Never use the connected business/page avatar as the sender. */
async function resolveSenderAvatar(platform: Platform, senderId: string, token: string): Promise<string | undefined> {
  const id = encodeURIComponent(senderId);
  const t = encodeURIComponent(token);
  const call = platform === 'instagram' && token.startsWith('IG') ? igGraph : graph;
  for (const fields of ['profile_pic', 'picture']) {
    try {
      const p: any = await call(`/${id}?fields=${fields}&access_token=${t}`);
      const candidate = typeof p?.profile_pic === 'string' ? p.profile_pic
        : typeof p?.picture?.data?.url === 'string' ? p.picture.data.url
        : typeof p?.picture === 'string' ? p.picture : undefined;
      if (candidate?.startsWith('https://')) return candidate;
    } catch (e) {
      console.warn('[social-push] sender avatar lookup unavailable', platform, fields, String(e).slice(0, 160));
    }
  }
  return undefined;
}

async function notifySocialPush(supabase: SupabaseClient, ev: {
  platform: Platform; kind: 'comment' | 'message'; senderId: string; text: string; senderName?: string; senderAvatarUrl?: string; eventId: string; imageUrl?: string; accountId?: string; audience?: string; aiReply?: string;
}, account: any, recipientUserId: string) {
  try {
    const isIg = ev.platform === 'instagram';
    const platformLabel = isIg ? 'Instagram' : 'Facebook';
    const { data: iconRow } = await supabase.from('app_settings').select('setting_value')
      .eq('setting_key', isIg ? 'email_social_icon_instagram' : 'email_social_icon_facebook').maybeSingle();
    const icon = (iconRow as any)?.setting_value || '/whatsapp-notification-icon.png?v=2';
    let senderName = ev.senderName;
    if (!senderName || !ev.senderAvatarUrl) {
      const { data: tok } = await supabase.from('social_meta_tokens').select('page_access_token').eq('account_id', account.id).maybeSingle();
      if (tok?.page_access_token) {
        if (!senderName) senderName = await resolveSenderName(ev.platform, ev.senderId, tok.page_access_token);
        if (!ev.senderAvatarUrl) ev.senderAvatarUrl = await resolveSenderAvatar(ev.platform, ev.senderId, tok.page_access_token);
      }
    }
    const name = senderName || `${platformLabel} user`;
    const title = name;
    const body = (ev.text || (ev.kind === 'comment' ? 'New comment' : 'New message')).slice(0, 900);
    const url = `/ai-assistant/connect/${ev.platform}/replies`;
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/email-api`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'send_push_raw',
        // Customer Service accounts use a synthetic, isolated account ID.
        // FCM tokens belong to the real signed-in owner, not that synthetic ID.
        userIds: [recipientUserId],
        title, body, url, icon: ev.senderAvatarUrl || icon, image: ev.imageUrl,
        actions: [
          { action: 'reply', title: 'Reply', url },
          { action: 'mark-read', title: 'Mark as read', url },
        ],
        tag: `${ev.platform}-${ev.eventId}`,
        data: {
          type: `${ev.platform}_${ev.kind}`, source: ev.platform, platform: ev.platform,
          sender_id: ev.senderId, sender_name: name, conversation_id: ev.senderId, event_id: ev.eventId,
          account_id: ev.accountId || '', audience: ev.audience || '',
          sender_avatar_url: ev.senderAvatarUrl || '',
          ...(ev.aiReply ? { ai_reply: ev.aiReply } : {}),
        },
      }),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok || result?.sent === false || result?.status === 'error') {
      console.error('[social-push] hub delivery failed', res.status, result);
    }
  } catch (e) {
    console.error('[social-push] error', e);
  }
}

async function processEvent(supabase: SupabaseClient, ev: {
  platform: Platform; kind: 'comment' | 'message'; ownerId: string; eventId: string; senderId: string; text: string; commentId?: string; postId?: string; senderName?: string; senderAvatarUrl?: string; imageUrl?: string;
}) {
  if (!ev.text?.trim() || !ev.eventId) return;
  const col = ev.platform === 'instagram' ? 'ig_user_id' : 'page_id';
  const { data: accounts } = await supabase.from('social_meta_accounts').select('*')
    .eq('platform', ev.platform).eq(col, ev.ownerId).eq('status', 'connected');
  if (!accounts?.length) return;
  if (accounts.some((a: any) => ev.senderId === a.page_id || ev.senderId === a.ig_user_id)) return; // own echo
  // Developer customers (sub-accounts): forward to the developer's webhook, no AI reply.
  const subIds = accounts.map((a: any) => a.user_id);
  const { data: subs } = await supabase.from('developer_sub_accounts').select('id,developer_user_id,external_id').in('id', subIds);
  for (const s of subs || []) {
    const a = accounts.find((x: any) => x.user_id === s.id);
    await forwardToCustomerWebhooks(supabase, s.developer_user_id, `${ev.platform}.${ev.kind}.received`, {
      sub_account_id: s.id, external_id: s.external_id, account_id: a.id, page_id: a.page_id, ig_user_id: a.ig_user_id,
      from: ev.senderId, name: ev.senderName ?? null, text: ev.text,
      ...(ev.kind === 'message' ? { message_id: ev.eventId.replace(/^(igm|fbm)_/, '') } : { comment_id: ev.commentId, post_id: ev.postId }),
    });
  }
  const subSet = new Set((subs || []).map((s: any) => s.id));
  const eligible = accounts.filter((a: any) => !subSet.has(a.user_id));
  let account = eligible[0];
  let supportUserId: string | null = null;
  for (const candidate of eligible) {
    const owner = await resolveSupportOwner(supabase, candidate.user_id);
    if (owner) { account = candidate; supportUserId = owner; break; }
  }
  if (!account) return;
  // Resolve the real signed-in owner before pushing. Customer Service Meta
  // accounts are stored under a synthetic supportOwnerId, while FCM tokens
  // are registered against the owner's actual auth user ID.
  const pushRecipientId = supportUserId || account.user_id;
  // Notify the owner for every new inbox message, independent of AI reply settings.
  if (ev.kind === 'message') await notifySocialPush(supabase, { ...ev, accountId: account.id, audience: supportUserId ? 'support' : '' }, account, pushRecipientId);
  // Developer webhooks: instagram.message.received, facebook.comment.received, etc.
  await forwardToCustomerWebhooks(supabase, account.user_id, `${ev.platform}.${ev.kind}.received`, {
    account_id: account.id, page_id: account.page_id, ig_user_id: account.ig_user_id,
    from: ev.senderId, name: ev.senderName ?? null, text: ev.text,
    ...(ev.kind === 'message' ? { message_id: ev.eventId.replace(/^(igm|fbm)_/, '') } : { comment_id: ev.commentId, post_id: ev.postId }),
  });
  if (ev.kind === 'comment' && !account.ai_reply_comments) return;
  if (ev.kind === 'message' && !account.ai_reply_messages) return;

  // Dedupe: first insert wins.
  const { error: dup } = await supabase.from('social_meta_replies').insert({
    account_id: account.id, user_id: account.user_id, platform: ev.platform, kind: ev.kind,
    event_id: ev.eventId, sender_id: ev.senderId, incoming_text: ev.text.slice(0, 4000), status: 'pending',
  });
  if (dup) return;

  const { data: tok } = await supabase.from('social_meta_tokens').select('page_access_token').eq('account_id', account.id).maybeSingle();
  const token = tok?.page_access_token;
  const finish = (patch: Record<string, unknown>) => supabase.from('social_meta_replies').update(patch).eq('event_id', ev.eventId).eq('account_id', account.id);
  if (!token) { await finish({ status: 'failed', error: 'Missing page token' }); return; }

  const quota = await reserveAiChatMessage(supabase, supportUserId || account.user_id, 'telegram');
  if (!quota.allowed) {
    await finish({ status: 'skipped_limit', error: quota.reason || 'plan_limit_reached' });
    return;
  }

  const { context, history } = await buildMetaContext(supabase, account, ev, token);
  const replyAccount = supportUserId ? { ...account, ai_tone: 'friendly', ai_language: 'auto', ai_business_info: '', ai_custom_instructions: '', ai_signature: '' } : account;
  const reply = await generateSocialReply({ account: replyAccount, platform: ev.platform, kind: ev.kind, text: ev.text, context, history });
  if (!reply) { await finish({ status: 'failed', error: 'AI reply not generated' }); return; }

  try {
    const { data: current, error: stateError } = await supabase.from('social_meta_accounts').select('status,ai_reply_comments,ai_reply_messages').eq('id', account.id).eq('user_id', account.user_id).maybeSingle();
    if (stateError || current?.status !== 'connected' || (ev.kind === 'comment' ? current.ai_reply_comments !== true : current.ai_reply_messages !== true)) {
      await finish({ status: 'skipped_disabled', error: 'Auto reply turned off before send' });
      return;
    }
    const t = encodeURIComponent(token);
    // Instagram Login tokens start with "IG" and use graph.instagram.com.
    const send = ev.platform === 'instagram' && token.startsWith('IG') ? igGraph : graph;
    if (ev.kind === 'comment') {
      // AI reply is public and contextual; only genuine inquiries get a private DM.
      const publicReply = reply.split(/\n+/)[0].slice(0, 500);
      const path = ev.platform === 'instagram' ? `/${ev.commentId}/replies` : `/${ev.commentId}/comments`;
      await send(`${path}?access_token=${t}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: publicReply }),
      });
      // DM only when there is clear intent; praise/simple reactions remain public.
      const hasQuestion = /[?？]/.test(ev.text) || /\b(how|what|when|where|who|why|price|pricing|cost|details|link|apply|application|job|vacancy|hire|hiring|contact|number|available|availability|problem|issue|inquiry|inquire|કેમ|શું|ક્યાં|ક્યારે|કેટલું|નોકરી|જોબ|મદદ|ભાવ|કેવી રીતે)\b/i.test(ev.text);
      const explicitRequest = /(?:please|pls|plz|kindly|can you|could you|mujhe|bataye|batao|jankari|जानकारी|કૃપા|માહિતી|dm me|message me|send me)/i.test(ev.text);
      const praiseOnly = /(?:bahut achi|bahut acchi|achi hai|acchi hai|great|awesome|excellent|love it|nice|thank|shukriya|धन्यवाद|ખૂબ સારું)/i.test(ev.text) && !hasQuestion && !explicitRequest;
      const shouldDM = !praiseOnly && (hasQuestion || explicitRequest);
      if (shouldDM && ev.commentId) {
        const privateReplyOwner = ev.platform === 'instagram' ? account.ig_user_id : account.page_id;
        const privateReply = await generateSocialReply({
          account: replyAccount, platform: ev.platform, kind: 'comment', text: ev.text,
          context: `${context}\n\nPUBLIC COMMENT REPLY ALREADY POSTED (do not repeat it): ${publicReply}`,
          history, ...( { replyChannel: 'private_dm' } as any ),
        });
        if (privateReply) {
          await send(`/${privateReplyOwner}/messages?access_token=${t}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipient: { comment_id: ev.commentId }, message: { text: privateReply.slice(0, 900) } }),
          });
        }
      }
    } else {
      const sender = send === igGraph ? account.ig_user_id : account.page_id;
      await send(`/${sender}/messages?access_token=${t}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: { id: ev.senderId }, message: { text: reply.slice(0, 900) }, ...(send === igGraph ? {} : { messaging_type: 'RESPONSE' }) }),
      });
    }
    await finish({ status: 'sent', reply_text: reply });
    // Update the existing conversation notification with the exact AI text that was sent.
    if (ev.kind === 'message') {
      await notifySocialPush(supabase, { ...ev, accountId: account.id, audience: supportUserId ? 'support' : '', aiReply: reply }, account, pushRecipientId);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[meta-social] send failed', msg);
    await finish({ status: 'failed', reply_text: reply, error: msg.slice(0, 500) });
  }
}

/** Store reply_to / reactions / attachments from Messenger & Instagram webhooks; the
 *  Conversations API does not return them reliably, so chat_messages merges these rows. */
async function recordMessageEvent(supabase: SupabaseClient, platform: Platform, ownerId: string, m: any) {
  const actor = String(m.sender?.id || '');
  if (m.reaction?.mid) {
    const r = m.reaction;
    if (r.action === 'unreact') {
      await supabase.from('social_meta_message_events').delete()
        .eq('platform', platform).eq('mid', r.mid).eq('kind', 'reaction').eq('actor_id', actor);
      return;
    }
    const raw = String(r.emoji || r.reaction || '');
    const emoji = REACTION_EMOJI[raw.toLowerCase()] || raw || '❤️';
    await supabase.from('social_meta_message_events').upsert(
      { platform, owner_id: ownerId, mid: r.mid, kind: 'reaction', actor_id: actor, emoji, created_at: new Date().toISOString() },
      { onConflict: 'platform,mid,kind,actor_id' });
    return;
  }
  const msg = m.message;
  if (!msg?.mid) return;
  const replyTo = msg.reply_to?.mid || null;
  const { data: existing } = await supabase.from('social_meta_message_events').select('attachments, emoji').eq('platform', platform).eq('owner_id', ownerId).eq('mid', msg.mid).eq('kind', 'message').maybeSingle();
  if (existing?.emoji === 'deleted' || Array.isArray(existing?.attachments) && existing.attachments.some((a: any) => a.url?.includes('/media/'))) return;
  const atts = Array.isArray(msg.attachments)
    ? msg.attachments.map((a: any) => ({ type: String(a.type || 'file'), url: a.payload?.url || null })).filter((a: any) => a.url)
    : [];
  if (!replyTo && !atts.length) return;
  if (atts.length) {
    const col = platform === 'instagram' ? 'ig_user_id' : 'page_id';
    const { data: accounts } = await supabase.from('social_meta_accounts').select('user_id').eq('platform', platform).eq(col, ownerId).eq('status', 'connected').limit(1);
    const owner = accounts?.[0]?.user_id;
    if (!owner) throw new Error('Incoming media account is not connected');
    for (const attachment of atts) {
      const url = new URL(attachment.url);
      if (url.protocol !== 'https:' || !/(^|\.)(fbcdn\.net|fbsbx\.com|cdninstagram\.com|facebook\.com)$/.test(url.hostname)) throw new Error('Invalid Meta attachment host');
      const response = await fetch(url, { redirect: 'error' });
      if (!response.ok) throw new Error(`Meta attachment download failed (${response.status})`);
      const blob = await response.blob();
      const mime = blob.type || 'application/octet-stream';
      const extension = mime === 'image/jpeg' ? 'jpg' : mime === 'application/pdf' ? 'pdf' : mime.split('/')[1]?.replace(/[^a-z0-9]/g, '').slice(0, 5) || 'bin';
      const scope = `chat-${platform}`;
      const saved = await putMedia(scope, buildMediaKey(scope, owner, extension), blob, mime);
      attachment.url = saved.url;
    }
  }
  await supabase.from('social_meta_message_events').upsert(
    { platform, owner_id: ownerId, mid: msg.mid, kind: 'message', actor_id: '', reply_to_mid: replyTo, attachments: atts.length ? atts : null },
    { onConflict: 'platform,mid,kind,actor_id' });
}

/** Returns true when the body was a Page/Instagram webhook and was handled. */
export async function handleMetaSocialWebhook(supabase: SupabaseClient, body: any): Promise<boolean> {
  const object = body?.object;
  if (object !== 'page' && object !== 'instagram') return false;
  const platform: Platform = object === 'instagram' ? 'instagram' : 'facebook';
  for (const entry of body.entry || []) {
    const ownerId = String(entry.id || '');
    for (const change of entry.changes || []) {
      const v = change.value || {};
      // Delivery trace (ids only, no comment text) so missing Meta comment webhooks are visible.
      await supabase.from('whatsapp_webhook_logs').insert({
        event_type: `social_${platform}_${change.field || 'unknown'}`,
        payload: { owner_id: ownerId, item: v.item ?? null, verb: v.verb ?? null, comment_id: v.comment_id ?? v.id ?? null },
        status_code: 200, processed_at: new Date().toISOString(),
      }).then(() => {}, () => {});
      try {
        if (platform === 'facebook' && change.field === 'feed' && v.item === 'comment' && v.verb === 'add') {
          await processEvent(supabase, { platform, kind: 'comment', ownerId, eventId: `fbc_${v.comment_id}`, senderId: String(v.from?.id || ''), text: v.message || '', commentId: v.comment_id, postId: v.post_id, senderName: v.from?.name });
        } else if (platform === 'instagram' && (change.field === 'comments' || change.field === 'live_comments')) {
          await processEvent(supabase, { platform, kind: 'comment', ownerId, eventId: `igc_${v.id}`, senderId: String(v.from?.id || ''), text: v.text || '', commentId: v.id, postId: v.media?.id, senderName: v.from?.username ? '@' + v.from.username : undefined });
        }
      } catch (e) { console.error('[meta-social] change failed', e); }
    }
    for (const m of entry.messaging || []) {
      try { await recordMessageEvent(supabase, platform, ownerId, m); } catch (e) { console.error('[meta-social] record event failed', e); }
      try {
        if (!m.message || m.message.is_echo) continue;
        // Media (image/video/audio/file) arrives without text — still notify like WhatsApp does.
        let text = m.message.text || '';
        let imageUrl: string | undefined;
        if (Array.isArray(m.message.attachments) && m.message.attachments.length) {
          const att = m.message.attachments[0];
          const t = String(att?.type || 'file').toLowerCase();
          if (t === 'image' && att?.payload?.url) imageUrl = String(att.payload.url);
          if (!text) text = t === 'image' ? '📷 Photo' : t === 'video' ? '🎥 Video' : t === 'audio' ? '🎵 Audio' : '📎 File';
        }
        if (!text) continue;
        await processEvent(supabase, {
          platform, kind: 'message', ownerId,
          eventId: `${platform === 'instagram' ? 'igm' : 'fbm'}_${m.message.mid}`,
          senderId: String(m.sender?.id || ''), text, imageUrl,
        });
      } catch (e) { console.error('[meta-social] messaging failed', e); }
    }
  }
  return true;
}
