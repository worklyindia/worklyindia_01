/**
 * Grabs the OAuth `provider_token` as early as possible after a social
 * redirect.
 *
 * supabase-js keeps the provider token only on the session object that comes
 * straight out of the code exchange; a token refresh (which the app does on
 * boot) silently drops it. Reading it directly from the persisted auth-token
 * entry in storage — before any refresh can happen — makes the LinkedIn / X
 * connect flow reliable.
 */

const PENDING_KEY = 'pending_social_link';

export type SnapshotPlatform =
  | 'linkedin'
  | 'x'
  | 'github'
  | 'gitlab'
  | 'bitbucket'
  | 'discord'
  | 'figma'
  | 'notion'
  | 'twitch'
  | 'slack'
  | 'spotify'
  | 'workos'
  | 'azure';

/** Scopes we request per platform — stored so the backend/AI knows the powers. */
const SCOPES: Record<SnapshotPlatform, string> = {
  linkedin: 'openid profile email w_member_social',
  x: 'tweet.read tweet.write users.read offline.access',
  github: 'read:user user:email',
  gitlab: 'read_user read_api',
  bitbucket: 'email',
  discord: 'identify email',
  figma: '',
  notion: '',
  twitch: 'user:read:email',
  slack: 'openid email profile',
  spotify: 'user-read-email user-read-private',
  workos: '',
  azure: 'openid email profile',
};

/** Rough token lifetimes so refresh kicks in on time. */
const TTL_MS: Record<SnapshotPlatform, number> = {
  x: 2 * 60 * 60 * 1000,
  linkedin: 55 * 24 * 60 * 60 * 1000,
  github: 365 * 24 * 60 * 60 * 1000,
  gitlab: 2 * 60 * 60 * 1000,
  bitbucket: 365 * 24 * 60 * 60 * 1000,
  discord: 7 * 24 * 60 * 60 * 1000,
  figma: 365 * 24 * 60 * 60 * 1000,
  notion: 90 * 24 * 60 * 60 * 1000,
  twitch: 365 * 24 * 60 * 60 * 1000,
  slack: 365 * 24 * 60 * 60 * 1000,
  spotify: 365 * 24 * 60 * 60 * 1000,
  workos: 365 * 24 * 60 * 60 * 1000,
  azure: 365 * 24 * 60 * 60 * 1000,
};
const PLATFORM_KEY = 'pending_social_platform';

export type PendingSocialLink = {
  platform: SnapshotPlatform;
  accessToken: string;
  refreshToken?: string | null;
  accountId?: string | null;
  accountName?: string | null;
  accountHandle?: string | null;
  accountPicture?: string | null;
  accountEmail?: string | null;
  scopes?: string | null;
  expiresAt?: string | null;
};

/** The captured provider-token payload waiting to be sent server-side. */
export function readPendingSocialLink(): PendingSocialLink | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY) || localStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as PendingSocialLink) : null;
  } catch {
    return null;
  }
}

export function clearPendingSocialLink() {
  try {
    sessionStorage.removeItem(PENDING_KEY);
    localStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}

function read(key: string): string | null {
  try {
    return sessionStorage.getItem(key) || localStorage.getItem(key);
  } catch {
    return null;
  }
}

function platformOf(provider?: string | null): SnapshotPlatform | null {
  const p = String(provider || '').toLowerCase();
  if (p === 'linkedin_oidc' || p === 'linkedin') return 'linkedin';
  if (p === 'x' || p === 'twitter') return 'x';
  if (p === 'github') return 'github';
  if (p === 'gitlab') return 'gitlab';
  if (p === 'bitbucket') return 'bitbucket';
  if (p === 'discord') return 'discord';
  if (p === 'figma') return 'figma';
  if (p === 'notion') return 'notion';
  if (p === 'twitch') return 'twitch';
  if (p === 'slack') return 'slack';
  if (p === 'spotify') return 'spotify';
  if (p === 'workos') return 'workos';
  if (p === 'azure') return 'azure';
  return null;
}

function findAuthSession(): any | null {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !/^sb-.*-auth-token$/.test(key)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      // supabase-js v2 stores the session directly, older/newer wrap it
      return parsed?.currentSession || parsed?.session || parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * If a provider token is present in the persisted session, stash the pending
 * social link payload so `SocialTokenCapture` can push it to the server.
 * Returns true when something was captured.
 */
export function snapshotProviderToken(): boolean {
  const session = findAuthSession();
  const providerToken = session?.provider_token;
  if (!providerToken || !session?.user) return false;

  const identities: any[] = session.user.identities || [];
  const platform =
    (read(PLATFORM_KEY) as SnapshotPlatform | null) ||
    platformOf(session.user.app_metadata?.provider) ||
    platformOf(identities[identities.length - 1]?.provider);
  if (!platform || !(platform in SCOPES)) return false;

  const identity = latestIdentity(identities, platform);
  const meta = identity?.identity_data || session.user.user_metadata || {};

  const payload = JSON.stringify({
    platform,
    accessToken: providerToken,
    refreshToken: session.provider_refresh_token || null,
    accountId: meta.provider_id || meta.sub || null,
    accountName: meta.full_name || meta.name || null,
    accountHandle: meta.user_name || meta.preferred_username || meta.nickname || null,
    accountPicture: meta.avatar_url || meta.picture || null,
    accountEmail: meta.email || null,
    scopes: SCOPES[platform],
    expiresAt: new Date(Date.now() + TTL_MS[platform]).toISOString(),
  });

  try {
    sessionStorage.setItem(PENDING_KEY, payload);
    localStorage.setItem(PENDING_KEY, payload);
  } catch {
    /* ignore */
  }
  console.log('[socialTokenSnapshot] captured provider token for', platform);
  return true;
}

/** Run the snapshot now and for a short while after boot (token arrives async). */
/**
 * Capture the provider token from a live auth-event session object.
 * supabase-js only exposes `provider_token` on the session emitted by the code
 * exchange, so reading it from the event is more reliable than storage.
 */
export function captureFromSession(session: any): boolean {
  const providerToken = session?.provider_token;
  if (!providerToken || !session?.user) return false;

  const identities: any[] = session.user.identities || [];
  const platform =
    (read(PLATFORM_KEY) as SnapshotPlatform | null) ||
    platformOf(session.user.app_metadata?.provider) ||
    platformOf(identities[identities.length - 1]?.provider);
  if (!platform || !(platform in SCOPES)) return false;

  const identity = latestIdentity(identities, platform);
  const meta = identity?.identity_data || session.user.user_metadata || {};

  const payload = JSON.stringify({
    platform,
    accessToken: providerToken,
    refreshToken: session.provider_refresh_token || null,
    accountId: meta.provider_id || meta.sub || null,
    accountName: meta.full_name || meta.name || null,
    accountHandle: meta.user_name || meta.preferred_username || meta.nickname || null,
    accountPicture: meta.avatar_url || meta.picture || null,
    accountEmail: meta.email || null,
    scopes: SCOPES[platform],
    expiresAt: new Date(Date.now() + TTL_MS[platform]).toISOString(),
  });

  try {
    sessionStorage.setItem(PENDING_KEY, payload);
    localStorage.setItem(PENDING_KEY, payload);
  } catch {
    /* ignore */
  }
  return true;
}

export function startProviderTokenSnapshot() {
  if (typeof window === 'undefined') return;
  if (snapshotProviderToken()) return;
  let tries = 0;
  const timer = window.setInterval(() => {
    tries += 1;
    if (snapshotProviderToken() || tries > 40) window.clearInterval(timer);
  }, 250);
}

/** Newest matching identity, so a freshly added second account is not mistaken for the first. */
function latestIdentity(identities: any[], platform: string): any {
  const stamp = (i: any) => Date.parse(i?.last_sign_in_at || i?.updated_at || i?.created_at || '') || 0;
  return identities
    .filter((i) => platformOf(i.provider) === platform)
    .sort((a, b) => stamp(b) - stamp(a))[0];
}
