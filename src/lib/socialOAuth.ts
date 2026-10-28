import { supabase } from '@/integrations/supabase/client';

export type SocialOAuthPlatform =
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

const PROVIDER: Record<SocialOAuthPlatform, string> = {
  linkedin: 'linkedin_oidc',
  x: 'x',
  github: 'github',
  gitlab: 'gitlab',
  bitbucket: 'bitbucket',
  discord: 'discord',
  figma: 'figma',
  notion: 'notion',
  twitch: 'twitch',
  slack: 'slack',
  spotify: 'spotify',
  workos: 'workos',
  azure: 'azure',
};

const SCOPES: Record<SocialOAuthPlatform, string> = {
  linkedin: 'openid profile email w_member_social',
  x: 'tweet.read tweet.write users.read offline.access',
  github: 'read:user user:email public_repo',
  gitlab: 'read_user api',
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

/** All provider strings Supabase may report for a platform. */
const PROVIDER_ALIASES: Record<SocialOAuthPlatform, string[]> = {
  linkedin: ['linkedin_oidc', 'linkedin'],
  x: ['x', 'twitter'],
  github: ['github'],
  gitlab: ['gitlab'],
  bitbucket: ['bitbucket'],
  discord: ['discord'],
  figma: ['figma'],
  notion: ['notion'],
  twitch: ['twitch'],
  slack: ['slack'],
  spotify: ['spotify'],
  workos: ['workos'],
  azure: ['azure'],
};

export const RETURN_PATH_KEY = 'oauth_return_path';
export const PENDING_PLATFORM_KEY = 'pending_social_platform';

function store(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

const VALID_PLATFORMS: SocialOAuthPlatform[] = [
  'linkedin',
  'x',
  'github',
  'gitlab',
  'bitbucket',
  'discord',
  'figma',
  'notion',
  'twitch',
  'slack',
  'spotify',
  'workos',
  'azure',
];

export function readPendingPlatform(): SocialOAuthPlatform | null {
  try {
    const v = sessionStorage.getItem(PENDING_PLATFORM_KEY) || localStorage.getItem(PENDING_PLATFORM_KEY);
    return VALID_PLATFORMS.includes(v as SocialOAuthPlatform) ? (v as SocialOAuthPlatform) : null;
  } catch {
    return null;
  }
}

export function clearPendingPlatform() {
  try {
    sessionStorage.removeItem(PENDING_PLATFORM_KEY);
    localStorage.removeItem(PENDING_PLATFORM_KEY);
  } catch {
    /* ignore */
  }
}

/** True when Supabase refused a link because the identity is already attached. */
export function isIdentityAlreadyLinked(error: unknown): boolean {
  const err = error as { code?: string; status?: number; message?: string } | null;
  if (!err) return false;
  const code = String(err.code || '').toLowerCase();
  const msg = String(err.message || '').toLowerCase();
  return (
    code === 'identity_already_exists' ||
    msg.includes('identity is already linked') ||
    msg.includes('identity already exists')
  );
}

/** Whether this provider is already an identity on the signed-in account. */
async function alreadyLinked(platform: SocialOAuthPlatform): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getUserIdentities();
    const aliases = PROVIDER_ALIASES[platform];
    return (data?.identities || []).some((i) => aliases.includes(String(i.provider).toLowerCase()));
  } catch {
    return false;
  }
}

/** Owner/admin accounts are exempt from the duplicate-account block. */
async function isOwnerUser(): Promise<boolean> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const { data } = await supabase
      .from('admin_users')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();
    return !!data && ['admin', 'owner'].includes(String(data.role));
  } catch {
    return false;
  }
}

const PLATFORM_LABEL: Record<SocialOAuthPlatform, string> = {
  linkedin: 'LinkedIn',
  x: 'X (Twitter)',
  github: 'GitHub',
  gitlab: 'GitLab',
  bitbucket: 'Bitbucket',
  discord: 'Discord',
  figma: 'Figma',
  notion: 'Notion',
  twitch: 'Twitch',
  slack: 'Slack',
  spotify: 'Spotify',
  workos: 'WorkOS',
  azure: 'Microsoft',
};

/** Error shown when the social account is attached to a different Workly India account. */
function duplicateAccountError(platform: SocialOAuthPlatform): Error {
  return new Error(
    `This ${PLATFORM_LABEL[platform]} account is already connected to another Workly India account. Disconnect it from that account first, then try again.`,
  );
}

/**
 * Decide what to do when `linkIdentity` reports the identity already exists:
 * - identity belongs to THIS user (e.g. after a disconnect) → re-run OAuth for a fresh token
 * - current user is owner/admin → allowed, re-run OAuth
 * - otherwise → the account is connected elsewhere; block with a clear error
 */
async function handleAlreadyLinked(
  platform: SocialOAuthPlatform,
  credentials: unknown,
): Promise<{ error: unknown | null }> {
  if (await alreadyLinked(platform)) {
    const { error } = await supabase.auth.signInWithOAuth(credentials as never);
    return { error: error || null };
  }
  if (await isOwnerUser()) {
    const { error } = await supabase.auth.signInWithOAuth(credentials as never);
    return { error: error || null };
  }
  return { error: duplicateAccountError(platform) };
}

/**
 * Start the OAuth round-trip used to connect LinkedIn / X on the AI Connect page.
 *
 * A provider token is only handed to us during an OAuth redirect, and
 * `linkIdentity()` fails with 422 `identity_already_exists` once the identity
 * is attached to the account — which happens after the very first attempt, or
 * after a disconnect (disconnecting drops our stored token but keeps the auth
 * identity). In that case we re-run `signInWithOAuth` instead: the identity
 * belongs to this same user, so it returns the same session plus a fresh
 * `provider_token` for us to store.
 */
export async function startSocialOAuth(
  platform: SocialOAuthPlatform,
  returnPath: string,
  opts: { addAnother?: boolean } = {},
): Promise<{ error: unknown | null }> {
  store(RETURN_PATH_KEY, returnPath);
  store(PENDING_PLATFORM_KEY, platform);

  // Return straight to the dedicated callback page: the generic /auth route
  // runs a profile-based redirect that bounced users to the home screen before
  // the provider token could be stored.
  const redirectTo =
    `${window.location.origin}/social-callback?platform=${platform}` +
    `&return=${encodeURIComponent(returnPath)}` + (opts.addAnother ? '&add=1' : '');

  const credentials = {
    provider: PROVIDER[platform],
    options: { redirectTo, scopes: SCOPES[platform] },
  } as never;

  // Adding a second account must link a NEW identity to this user. Never fall
  // back to signInWithOAuth here: a different provider account would sign the
  // user into another app account.
  if (opts.addAnother) {
    const { error } = await supabase.auth.linkIdentity(credentials);
    return { error: error || null };
  }

  // Already attached? Skip linkIdentity entirely, it can only 422.
  if (await alreadyLinked(platform)) {
    const { error } = await supabase.auth.signInWithOAuth(credentials);
    return { error: error || null };
  }

  const { error } = await supabase.auth.linkIdentity(credentials);
  if (error && isIdentityAlreadyLinked(error)) {
    return handleAlreadyLinked(platform, credentials);
  }
  return { error: error || null };
}

/**
 * Re-run OAuth after Supabase bounced back with `identity_already_exists`.
 * Used by the auth callback so a stuck user recovers without another tap.
 */
export async function retryAfterAlreadyLinked(
  platform: SocialOAuthPlatform,
  returnPath: string,
): Promise<{ error: unknown | null }> {
  const redirectTo =
    `${window.location.origin}/social-callback?platform=${platform}` +
    `&return=${encodeURIComponent(returnPath)}`;
  const credentials = {
    provider: PROVIDER[platform],
    options: { redirectTo, scopes: SCOPES[platform] },
  } as never;
  // The identity exists somewhere: only re-run OAuth when it belongs to this
  // user (or the user is owner/admin). Otherwise it is attached to a different
  // account — signing in with OAuth would log this user into that account.
  return handleAlreadyLinked(platform, credentials);
}

/**
 * Remove the Supabase Auth identity behind a disconnected AI Connect account,
 * so the social account is fully released and can be connected to another
 * Workly India account (or a different social account can be linked here).
 * Skips silently when the identity is the user's only sign-in method.
 */
export async function unlinkSocialIdentity(
  platform: SocialOAuthPlatform,
  accountId?: string | null,
): Promise<void> {
  try {
    const { data } = await supabase.auth.getUserIdentities();
    const all = data?.identities || [];
    const aliases = PROVIDER_ALIASES[platform] || [];
    const forProvider = all.filter((i) => aliases.includes(i.provider));
    if (!forProvider.length) return;
    const id = accountId != null ? String(accountId) : null;
    let targets = forProvider;
    if (id) {
      const matched = forProvider.filter((i) => {
        const d = (i.identity_data || {}) as Record<string, unknown>;
        return [i.id, (i as { identity_id?: string }).identity_id, d.sub, d.provider_id, d.user_name, d.preferred_username]
          .filter(Boolean).map(String).includes(id);
      });
      targets = matched.length ? matched : forProvider.length === 1 ? forProvider : [];
    }
    let remaining = all.length;
    for (const identity of targets) {
      if (remaining <= 1) break; // never remove the last way to sign in
      const { error } = await supabase.auth.unlinkIdentity(identity);
      if (!error) remaining -= 1;
      else console.warn('unlinkIdentity failed', error.message);
    }
    await supabase.auth.refreshSession();
  } catch (e) {
    console.warn('unlinkSocialIdentity error', e);
  }
}
