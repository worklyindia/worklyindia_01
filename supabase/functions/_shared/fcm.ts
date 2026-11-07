// Firebase Cloud Messaging (HTTP v1) helper for Supabase Edge Functions.
// Uses the service account stored in FIREBASE_SERVICE_ACCOUNT_JSON to mint a
// Google OAuth access token, then sends messages to device tokens.

import { filterBannedUsers } from './banGuard.ts';

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

export interface PushAction {
  action: string;
  title: string;
  url?: string;
  icon?: string;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  image?: string;
  actions?: PushAction[];
  data?: Record<string, string>;
  /** Notification grouping key (replaces an earlier notification with the same tag). */
  tag?: string;
  /** Keep the notification on screen until the user interacts with it. */
  requireInteraction?: boolean;
  /** How long FCM should retry delivery, in seconds (default 4 weeks). */
  ttlSeconds?: number;
  /** Only the latest message with the same collapse key is delivered. */
  collapseKey?: string;
  /** 'high' wakes the device immediately, 'normal' batches for battery. */
  priority?: 'high' | 'normal';
  /** Data-only delivery: no visible notification (background sync / badge updates). */
  silent?: boolean;
  /** App badge count for iOS / Android launchers. */
  badgeCount?: number;
  /** Label shown in Firebase console delivery reports. */
  analyticsLabel?: string;
  /** Android notification channel id. */
  androidChannelId?: string;
}

export interface SendResult {
  sent: number;
  failed: number;
  invalidTokens: string[];
  errors: string[];
}

let cachedToken: { token: string; expiresAt: number } | null = null;
let cachedAccount: ServiceAccount | null = null;

export function getServiceAccount(): ServiceAccount | null {
  if (cachedAccount) return cachedAccount;
  const raw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ServiceAccount;
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) return null;
    parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
    cachedAccount = parsed;
    return parsed;
  } catch (_e) {
    console.error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON');
    return null;
  }
}

export function isFcmConfigured(): boolean {
  return getServiceAccount() !== null;
}

function base64url(input: Uint8Array | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const raw = atob(body);
  const buf = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
  return buf.buffer;
}

async function getAccessToken(): Promise<string> {
  const account = getServiceAccount();
  if (!account) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not configured');

  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({
      iss: account.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsigned = `${header}.${claims}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(account.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned)),
  );
  const jwt = `${unsigned}.${base64url(signature)}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const bodyText = await res.text();
  if (!res.ok) {
    throw new Error(`Google token exchange failed [${res.status}]: ${bodyText}`);
  }
  const parsed = JSON.parse(bodyText) as { access_token: string; expires_in: number };
  cachedToken = {
    token: parsed.access_token,
    expiresAt: Date.now() + parsed.expires_in * 1000,
  };
  return parsed.access_token;
}

// --- Brand logo (header logo) used as the notification icon ----------------
const FALLBACK_ICON = '/icons/icon-192x192.png';
let cachedBrandIcon: { url: string; expiresAt: number } | null = null;

/** Fetch the site header logo from brand assets so push icons follow the brand. */
export async function getBrandIcon(): Promise<string> {
  if (cachedBrandIcon && cachedBrandIcon.expiresAt > Date.now()) return cachedBrandIcon.url;

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !serviceKey) return FALLBACK_ICON;

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/get_brand_assets`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    if (!res.ok) return FALLBACK_ICON;
    const assets = await res.json() as { logo_url?: string; favicon_url?: string } | null;
    const url = assets?.logo_url || assets?.favicon_url;
    if (!url) return FALLBACK_ICON;
    cachedBrandIcon = { url, expiresAt: Date.now() + 5 * 60_000 };
    return url;
  } catch (_e) {
    return FALLBACK_ICON;
  }
}

function buildMessage(token: string, payload: PushPayload) {
  // Data-only message: the browser must NOT auto-display it, otherwise the
  // service worker shows a second copy of the same notification.
  const data: Record<string, string> = { ...(payload.data ?? {}) };
  data.title = payload.title;
  data.body = payload.body;
  if (payload.url) data.url = payload.url;
  if (payload.icon) data.icon = payload.icon;
  if (payload.image) data.image = payload.image;
  if (payload.actions?.length) data.actions = JSON.stringify(payload.actions.slice(0, 2));
  if (!data.tag) data.tag = `workly-${payload.title}`.slice(0, 60);

  return {
    message: {
      token,
      data,
      // Data-only high-priority delivery is required so the native Android
      // messaging service can render the rich image + action buttons itself.
      // A notification envelope makes Android auto-display a plain notification
      // in the background and bypasses onMessageReceived().
      android: {
        priority: 'HIGH',
      },
      apns: {
        headers: { 'apns-priority': '10' },
        payload: { aps: { 'content-available': 1, sound: 'default' } },
      },
      webpush: {
        headers: { Urgency: 'high' },
        fcm_options: payload.url ? { link: payload.url } : undefined,
      },
    },
  };
}

/** Send one payload to many device tokens. Returns per-batch stats. */
export async function sendToTokens(tokens: string[], payloadInput: PushPayload): Promise<SendResult> {
  const result: SendResult = { sent: 0, failed: 0, invalidTokens: [], errors: [] };
  const unique = [...new Set(tokens.filter(Boolean))];
  if (unique.length === 0) return result;

  // Default the notification icon to the live site header logo.
  const payload: PushPayload = { ...payloadInput, icon: payloadInput.icon || await getBrandIcon() };

  const account = getServiceAccount();
  if (!account) {
    result.failed = unique.length;
    result.errors.push('FIREBASE_SERVICE_ACCOUNT_JSON is not configured');
    return result;
  }

  const accessToken = await getAccessToken();
  const endpoint = `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`;

  // Small concurrency to stay well inside edge-function limits.
  const chunkSize = 10;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (token) => {
        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(buildMessage(token, payload)),
          });
          if (res.ok) {
            result.sent++;
            return;
          }
          const errorBody = await res.text();
          result.failed++;
          if (res.status === 404 || res.status === 400 || /UNREGISTERED|INVALID_ARGUMENT/.test(errorBody)) {
            result.invalidTokens.push(token);
          }
          result.errors.push(`token:${token.slice(0, 12)} [${res.status}] ${errorBody.slice(0, 300)}`);
        } catch (error) {
          result.failed++;
          result.errors.push(error instanceof Error ? error.message : String(error));
        }
      }),
    );
  }

  return result;
}

/** Look up enabled device tokens for the given users. */
export async function getUserTokens(
  supabase: { from: (table: string) => any },
  userIds: string[],
): Promise<string[]> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('fcm_token')
    .in('user_id', ids)
    .eq('enabled', true);
  if (error) {
    console.error('Failed to load push_subscriptions:', error.message);
    return [];
  }
  return (data ?? []).map((row: { fcm_token: string }) => row.fcm_token);
}

/** Remove tokens FCM reported as dead so we stop paying for them. */
export async function pruneInvalidTokens(
  supabase: { from: (table: string) => any },
  tokens: string[],
): Promise<void> {
  if (tokens.length === 0) return;
  const { error } = await supabase.from('push_subscriptions').delete().in('fcm_token', tokens);
  if (error) console.error('Failed to prune invalid tokens:', error.message);
}

/** Convenience: send to every enabled device of the given users. */
export async function sendToUsers(
  supabase: { from: (table: string) => any },
  userIds: string[],
  payload: PushPayload,
): Promise<SendResult> {
  // Banned users receive no push until unbanned — their tokens stay stored.
  const allowedIds = await filterBannedUsers(supabase, userIds);
  if (allowedIds.length === 0) {
    return { sent: 0, failed: 0, invalidTokens: [], errors: [] };
  }
  const tokens = await getUserTokens(supabase, allowedIds);
  const result = await sendToTokens(tokens, payload);
  await pruneInvalidTokens(supabase, result.invalidTokens);
  return result;
}

// ---------------------------------------------------------------------------
// Legacy compatibility layer
// Older code built OneSignal REST payloads (headings/contents/include_*).
// These helpers accept the same shape and deliver through FCM instead, so
// call sites only needed a one-line change during the migration.
// ---------------------------------------------------------------------------

export interface LegacyPayload {
  headings?: { en?: string };
  contents?: { en?: string };
  url?: string;
  data?: Record<string, unknown>;
  big_picture?: string;
  chrome_web_image?: string;
  chrome_web_icon?: string;
  web_buttons?: { id?: string; text?: string; url?: string; icon?: string }[];
  buttons?: { id?: string; text?: string; url?: string; icon?: string }[];
  include_subscription_ids?: string[];
  include_player_ids?: string[];
  tokens?: string[];
}

export async function sendLegacyPush(
  supabase: { from: (table: string) => any },
  payload: LegacyPayload,
): Promise<{ ok: boolean; id: string; recipients: number; failed: number; errors: string[] }> {
  const tokens = [
    ...(payload.include_subscription_ids ?? []),
    ...(payload.include_player_ids ?? []),
    ...(payload.tokens ?? []),
  ].filter((t): t is string => typeof t === 'string' && t.length > 0);

  const title = payload.headings?.en ?? 'Workly India';
  const body = payload.contents?.en ?? '';
  const data: Record<string, string> = {};
  for (const [k, v] of Object.entries(payload.data ?? {})) {
    if (v !== null && v !== undefined) data[k] = String(v);
  }

  const result = await sendToTokens(tokens, {
    title,
    body,
    url: payload.url,
    icon: payload.chrome_web_icon,
    image: payload.big_picture ?? payload.chrome_web_image,
    // The legacy send_push path sends buttons; raw pushes use web_buttons.
    // Forward either shape so native Android can render the same action buttons.
    actions: (payload.web_buttons ?? payload.buttons ?? [])
      .filter((b) => b && b.text)
      .slice(0, 2)
      .map((b, i) => ({ action: b!.id ?? `act${i}`, title: b!.text!, url: b!.url, icon: b!.icon })),
    data,
  });
  await pruneInvalidTokens(supabase, result.invalidTokens);

  return {
    ok: result.sent > 0,
    id: crypto.randomUUID(),
    recipients: result.sent,
    failed: result.failed,
    errors: result.errors,
  };
}

/** Drop-in stand-in for the old `fetch(onesignal…)` call: same `.ok`/`.json()` surface. */
export async function legacyFetchCompat(
  supabase: { from: (table: string) => any },
  payload: LegacyPayload,
) {
  const r = await sendLegacyPush(supabase, payload);
  const body = {
    id: r.id,
    recipients: r.recipients,
    sent: r.recipients,
    failed: r.failed,
    errors: r.errors,
  };
  return {
    ok: r.ok,
    status: r.ok ? 200 : 500,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}
