// Developer sub-account channels beyond WhatsApp: Instagram, Facebook Page, Gmail, Outlook, Domain email.
// A customer's accounts are stored in the normal per-owner tables (social_meta_accounts, app_user_connections)
// with the sub-account id as the owner id. Sub-account ids are never auth user ids, so these rows never
// appear in any signed-in user's screens, and every API lookup is scoped through findSubAccount().
import { saveConnectionKeyForUser } from './appUserConnections.ts';
import { getMetaAppCreds } from './metaSocial.ts';
import { forwardToCustomerWebhooks } from './customerWebhooks.ts';
import { subGmailAuthUrl, subGmailExchange } from './userGmail.ts';
import { subOutlookAuthUrl, subOutlookExchange } from './userOutlook.ts';
import { verifySubCustomEmail } from './userCustomEmail.ts';
import { exchangeInstagramLogin, INSTAGRAM_GRAPH_URL } from './instagramLogin.ts';

export const CHANNELS = ['whatsapp', 'instagram', 'facebook', 'gmail', 'outlook', 'domain_email'] as const;
export type Channel = typeof CHANNELS[number];
export const isChannel = (v: unknown): v is Channel => CHANNELS.includes(v as Channel);
/** Hosted connect page path per channel. */
export const channelPath = (c: Channel) => (c === 'domain_email' ? 'email' : c);

export const MAIL_CONNECTORS: Record<'gmail' | 'outlook' | 'domain_email', string> = {
  gmail: 'google_mail', outlook: 'microsoft_outlook', domain_email: 'custom_email',
};
const GRAPH = 'https://graph.facebook.com/v21.0';
const IG_SCOPES = ['instagram_business_basic', 'instagram_business_manage_messages', 'instagram_business_manage_comments'];
const FB_SCOPES = ['pages_show_list', 'pages_manage_metadata', 'pages_read_engagement', 'pages_manage_engagement', 'pages_messaging', 'business_management'];

const okOrigin = (o: unknown): o is string => typeof o === 'string' && /^https:\/\/[^\s/]+$|^http:\/\/localhost(:\d+)?$/.test(o);
const metaRedirect = (origin: string) => `${origin}/oauth/meta/return`;

async function j(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) throw new Error(data?.error?.message || data?.error_message || `Request failed (${res.status})`);
  return data;
}

async function igCreds(admin: any) {
  const { data } = await admin.from('owner_secrets').select('name, value').in('name', ['INSTAGRAM_APP_ID', 'INSTAGRAM_APP_SECRET']);
  const get = (n: string) => (data || []).find((r: any) => r.name === n)?.value?.trim() || Deno.env.get(n) || '';
  return { appId: get('INSTAGRAM_APP_ID'), secret: get('INSTAGRAM_APP_SECRET') };
}

/** All connected non-WhatsApp channels of a sub-account (public view). */
export async function subChannels(admin: any, subId: string) {
  const [{ data: soc }, { data: mail }] = await Promise.all([
    admin.from('social_meta_accounts').select('id,platform,page_id,ig_user_id,name,username,created_at').eq('user_id', subId).eq('status', 'connected'),
    admin.from('app_user_connections').select('connector_id,account_email,updated_at').eq('user_id', subId).in('connector_id', Object.values(MAIL_CONNECTORS)),
  ]);
  const mailCh = Object.fromEntries(Object.entries(MAIL_CONNECTORS).map(([k, v]) => [v, k]));
  return [
    ...(soc || []).map((a: any) => ({ channel: a.platform, account_id: a.id, page_id: a.page_id, ig_user_id: a.ig_user_id, name: a.name, username: a.username, connected_at: a.created_at })),
    ...(mail || []).map((m: any) => ({ channel: mailCh[m.connector_id], email: m.account_email, connected_at: m.updated_at })),
  ];
}

/** Connected channels for every sub-account of a developer, keyed by sub-account id (developer portal view). */
export async function subChannelsOverview(admin: any, devUserId: string) {
  const { data: subs } = await admin.from('developer_sub_accounts').select('id').eq('developer_user_id', devUserId);
  const ids = (subs || []).map((s: any) => s.id);
  const map: Record<string, any[]> = {};
  if (!ids.length) return map;
  for (const id of ids) map[id] = [];
  const mailCh = Object.fromEntries(Object.entries(MAIL_CONNECTORS).map(([k, v]) => [v, k]));
  const [{ data: nums }, { data: soc }, { data: mail }] = await Promise.all([
    admin.from('developer_sub_account_numbers').select('sub_account_id,display_phone,connected_at').in('sub_account_id', ids).eq('status', 'connected'),
    admin.from('social_meta_accounts').select('id,platform,page_id,ig_user_id,name,username,user_id,created_at').eq('status', 'connected').in('user_id', ids),
    admin.from('app_user_connections').select('connector_id,account_email,user_id,updated_at').in('user_id', ids).in('connector_id', Object.values(MAIL_CONNECTORS)),
  ]);
  for (const n of nums || []) map[n.sub_account_id]?.push({ channel: 'whatsapp', label: n.display_phone || 'WhatsApp number', connected_at: n.connected_at });
  for (const a of soc || []) map[a.user_id]?.push({ channel: a.platform, account_id: a.id, label: a.username ? `@${a.username}` : (a.name || a.page_id || a.platform), connected_at: a.created_at });
  for (const m of mail || []) map[m.user_id]?.push({ channel: mailCh[m.connector_id], label: m.account_email || mailCh[m.connector_id], connected_at: m.updated_at });
  return map;
}

/** Remove one channel (optionally one account) of a sub-account. */
export async function disconnectSubChannel(admin: any, subId: string, channel: Channel, accountId?: string) {
  if (channel === 'instagram' || channel === 'facebook') {
    let q = admin.from('social_meta_accounts').delete().eq('user_id', subId).eq('platform', channel);
    if (accountId) q = q.or(`id.eq.${accountId.replace(/[^A-Za-z0-9-]/g, '')},page_id.eq.${accountId.replace(/\D/g, '') || '0'}`);
    await q;
  } else if (channel !== 'whatsapp') {
    await admin.from('app_user_connections').delete().eq('user_id', subId).eq('connector_id', MAIL_CONNECTORS[channel]);
    await admin.from('email_api_inbox_state').delete().eq('user_id', subId);
  }
}
export async function deleteAllSubChannels(admin: any, subId: string) {
  await admin.from('social_meta_accounts').delete().eq('user_id', subId);
  await admin.from('app_user_connections').delete().eq('user_id', subId);
  await admin.from('email_api_inbox_state').delete().eq('user_id', subId);
}

/** Map an owner id (from social/mail rows) to its developer when it is a sub-account. */
export async function subAccountOwner(admin: any, ownerId: string) {
  const { data } = await admin.from('developer_sub_accounts').select('id,developer_user_id,external_id').eq('id', ownerId).maybeSingle();
  return data as { id: string; developer_user_id: string; external_id: string } | null;
}

type Ctx = { admin: any; sub: { id: string; developer_user_id: string; external_id: string }; channel: Channel; claim: () => Promise<boolean>; back: (s: string, extra?: Record<string, string>) => string };

/** Hosted connect page actions for non-WhatsApp channels. Returns [status, body]. */
export async function handleChannelConnect(ctx: Ctx, raw: any): Promise<[number, Record<string, unknown>]> {
  const { admin, sub, channel } = ctx;
  const action = raw?.action;
  if (action === 'start') {
    if (channel === 'domain_email') return [400, { success: false, error: 'Use the form' }];
    const origin = raw?.origin;
    if (!okOrigin(origin)) return [400, { success: false, error: 'Invalid origin' }];
    const state = crypto.randomUUID();
    let url: string;
    if (channel === 'gmail') url = await subGmailAuthUrl(origin);
    else if (channel === 'outlook') url = subOutlookAuthUrl(origin);
    else if (channel === 'instagram') {
      const ig = await igCreds(admin);
      if (!ig.appId) return [500, { success: false, error: 'Instagram connect is not configured' }];
      url = `https://www.instagram.com/oauth/authorize?${new URLSearchParams({ client_id: ig.appId, redirect_uri: metaRedirect(origin), state, response_type: 'code', enable_fb_login: '0', force_authentication: '1', scope: IG_SCOPES.join(',') })}`;
    } else {
      const { appId } = await getMetaAppCreds(admin);
      url = `https://www.facebook.com/v21.0/dialog/oauth?${new URLSearchParams({ client_id: appId, redirect_uri: metaRedirect(origin), state, response_type: 'code', scope: FB_SCOPES.join(',') })}`;
    }
    return [200, { success: true, url, state }];
  }
  if (action !== 'complete') return [400, { success: false, error: 'Unknown action' }];

  if (!(await ctx.claim())) return [410, { success: false, error: 'This link was already used.' }];
  const fail = async (msg: string): Promise<[number, Record<string, unknown>]> => {
    await forwardToCustomerWebhooks(admin, sub.developer_user_id, `${channel}.sub_account.failed`, { sub_account_id: sub.id, external_id: sub.external_id, error: msg });
    return [400, { success: false, error: msg, redirect_url: ctx.back('failed', { error: msg.slice(0, 200) }) }];
  };
  try {
    const code = typeof raw?.code === 'string' ? raw.code.replace(/#_$/, '') : '';
    const origin = raw?.origin;
    let label = '';
    let extra: Record<string, string> = {};
    if (channel === 'domain_email') {
      const { email, creds } = await verifySubCustomEmail(raw);
      await saveConnectionKeyForUser(sub.id, MAIL_CONNECTORS.domain_email, creds, email);
      label = email; extra = { email };
    } else {
      if (code.length < 10 || code.length > 2000 || !okOrigin(origin)) return await fail('Login was not completed');
      if (channel === 'gmail' || channel === 'outlook') {
        const r = channel === 'gmail' ? await subGmailExchange(code) : await subOutlookExchange(code, origin);
        await saveConnectionKeyForUser(sub.id, MAIL_CONNECTORS[channel], r.refreshToken, r.email);
        label = r.email || channel; extra = r.email ? { email: r.email } : {};
      } else {
        const rows = channel === 'instagram' ? [await instagramAccount(admin, code, origin)] : await facebookPages(admin, code, origin);
        for (const { row, token } of rows) {
          const { data: taken } = await admin.from('social_meta_accounts').select('user_id').eq('platform', channel).eq('page_id', row.page_id).eq('status', 'connected').neq('user_id', sub.id).limit(1);
          if (taken?.length) return await fail(`${row.name} is already connected elsewhere.`);
          const { data: acc, error } = await admin.from('social_meta_accounts').upsert({
            ...row, user_id: sub.id, platform: channel, status: 'connected', is_default: true, ai_reply_comments: false, ai_reply_messages: false,
          }, { onConflict: 'user_id,platform,page_id' }).select('id').single();
          if (error || !acc) throw new Error(error?.message || 'Save failed');
          await admin.from('social_meta_tokens').upsert({ account_id: acc.id, page_access_token: token, updated_at: new Date().toISOString() });
        }
        label = rows.map((r) => r.row.name).join(', ');
        extra = { account: rows[0].row.page_id };
      }
    }
    await admin.from('developer_sub_accounts').update({ status: 'connected', updated_at: new Date().toISOString() }).eq('id', sub.id);
    await forwardToCustomerWebhooks(admin, sub.developer_user_id, `${channel}.sub_account.connected`, { sub_account_id: sub.id, external_id: sub.external_id, channel, account: label });
    return [200, { success: true, label, redirect_url: ctx.back('connected', extra) }];
  } catch (e) {
    return await fail((e as Error).message || 'Connection failed');
  }
}

async function instagramAccount(admin: any, code: string, origin: string) {
  const ig = await igCreds(admin);
  if (!ig.appId || !ig.secret) throw new Error('Instagram connect is not configured');
  const { token, profile: me, userId: igId } = await exchangeInstagramLogin(ig.appId, ig.secret, code, metaRedirect(origin));
  await fetch(`${INSTAGRAM_GRAPH_URL}/me/subscribed_apps?subscribed_fields=comments,messages,message_reactions&access_token=${encodeURIComponent(token)}`, { method: 'POST' }).catch(() => {});
  return { row: { page_id: igId, ig_user_id: igId, name: me.username ? `@${me.username}` : (me.name || 'Instagram'), username: me.username ?? null, picture_url: me.profile_picture_url ?? null }, token };
}

async function facebookPages(admin: any, code: string, origin: string) {
  const { appId, secret } = await getMetaAppCreds(admin);
  if (!secret) throw new Error('Facebook connect is not configured');
  const short = await j(`${GRAPH}/oauth/access_token?client_id=${appId}&client_secret=${encodeURIComponent(secret)}&redirect_uri=${encodeURIComponent(metaRedirect(origin))}&code=${encodeURIComponent(code)}`);
  const long = await j(`${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${encodeURIComponent(secret)}&fb_exchange_token=${encodeURIComponent(short.access_token)}`);
  const pages = await j(`${GRAPH}/me/accounts?fields=id,name,access_token,picture{url}&limit=50&access_token=${encodeURIComponent(long.access_token)}`);
  const list: any[] = pages?.data || [];
  if (!list.length) throw new Error('No Facebook Page found. Allow access to your Page during login.');
  for (const p of list) await fetch(`${GRAPH}/${p.id}/subscribed_apps?subscribed_fields=feed,messages,message_reactions,message_echoes&access_token=${encodeURIComponent(p.access_token)}`, { method: 'POST' }).catch(() => {});
  return list.map((p) => ({ row: { page_id: p.id, ig_user_id: null, name: p.name, username: null, picture_url: p.picture?.data?.url ?? null }, token: p.access_token as string }));
}
