import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { linkSocialAccount, type SocialPlatform } from '@/hooks/useSocialConnect';
import { snapshotProviderToken } from '@/lib/socialTokenSnapshot';

const PENDING_KEY = 'pending_social_link';
const PLATFORM_KEY = 'pending_social_platform';

function platformOf(provider?: string | null): SocialPlatform | null {
  if (!provider) return null;
  const p = String(provider).toLowerCase();
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

type Pending = {
  platform: SocialPlatform;
  accessToken: string;
  refreshToken?: string | null;
  accountId?: string | null;
  accountName?: string | null;
  accountHandle?: string | null;
  accountPicture?: string | null;
  accountEmail?: string | null;
};

function readPending(): Pending | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY) || localStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as Pending) : null;
  } catch {
    return null;
  }
}

function writePending(p: Pending) {
  try {
    const raw = JSON.stringify(p);
    sessionStorage.setItem(PENDING_KEY, raw);
    localStorage.setItem(PENDING_KEY, raw);
  } catch {
    /* ignore */
  }
}

function clearPending() {
  try {
    sessionStorage.removeItem(PENDING_KEY);
    localStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}

const VALID_PLATFORMS: SocialPlatform[] = [
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

function readPendingPlatform(): SocialPlatform | null {
  try {
    const value = sessionStorage.getItem(PLATFORM_KEY) || localStorage.getItem(PLATFORM_KEY);
    return VALID_PLATFORMS.includes(value as SocialPlatform) ? (value as SocialPlatform) : null;
  } catch {
    return null;
  }
}

function clearPendingPlatform() {
  try {
    sessionStorage.removeItem(PLATFORM_KEY);
    localStorage.removeItem(PLATFORM_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Whenever a user signs in (or links) with LinkedIn / X — from the job seeker
 * login, employer login or the AI Connect page — the provider token from that
 * OAuth session is stored server-side so the AI Connect page shows the account
 * as connected and AI features can use its data.
 *
 * The provider token only exists on the session right after the OAuth
 * redirect (a token refresh drops it), so it is persisted immediately and the
 * server link is retried until it succeeds.
 */
export default function SocialTokenCapture() {
  const linking = useRef(false);

  useEffect(() => {
    const flush = async () => {
      snapshotProviderToken();
      if (linking.current) return;
      const pending = readPending();
      if (!pending?.accessToken) return;
      const { data } = await supabase.auth.getSession();
      if (!data.session) return; // wait until the app session exists

      linking.current = true;
      try {
        await linkSocialAccount(pending);
        clearPending();
        clearPendingPlatform();
        window.dispatchEvent(new CustomEvent('social-connection-updated'));
        console.log(`[SocialTokenCapture] ${pending.platform} linked`);
      } catch (e) {
        console.error('[SocialTokenCapture] link failed', e);
      } finally {
        linking.current = false;
      }
    };

    const capture = async (session: any) => {
      const providerToken: string | undefined = session?.provider_token;
      if (providerToken && session?.user) {
        const identities: any[] = session.user.identities || [];
        const provider =
          session.user.app_metadata?.provider ||
          identities[identities.length - 1]?.provider;
        // During identity linking app_metadata.provider often remains the user's
        // original login provider, so prefer the explicit connect intent.
        const platform = readPendingPlatform() || platformOf(provider);
        if (platform) {
          const identity = identities.find((i) => platformOf(i.provider) === platform);
          const meta = identity?.identity_data || session.user.user_metadata || {};
          writePending({
            platform,
            accessToken: providerToken,
            refreshToken: session.provider_refresh_token || null,
            accountId: meta.provider_id || meta.sub || null,
            accountName: meta.full_name || meta.name || null,
            accountHandle: meta.user_name || meta.preferred_username || meta.nickname || null,
            accountPicture: meta.avatar_url || meta.picture || null,
            accountEmail: meta.email || null,
          });
        }
      }
      await flush();
    };

    supabase.auth.getSession().then(({ data }) => capture(data.session));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      capture(session);
    });

    // Retry for a while: the session (and the provider token written to
    // storage by the code exchange) can land a moment after first paint.
    const timers = [500, 1500, 3000, 5000, 8000, 12000].map((ms) =>
      window.setTimeout(flush, ms),
    );

    return () => {
      sub.subscription.unsubscribe();
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  return null;
}
