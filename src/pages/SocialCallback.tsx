import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { linkSocialAccount } from '@/hooks/useSocialConnect';
import {
  snapshotProviderToken,
  readPendingSocialLink,
  clearPendingSocialLink,
  captureFromSession,
} from '@/lib/socialTokenSnapshot';
import {
  readPendingPlatform,
  clearPendingPlatform,
  retryAfterAlreadyLinked,
  type SocialOAuthPlatform,
} from '@/lib/socialOAuth';

const LABEL: Record<SocialOAuthPlatform, string> = {
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
  azure: 'Microsoft Azure',
};

const VALID_CALLBACK_PLATFORMS: SocialOAuthPlatform[] = [
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

/**
 * Finishes the social OAuth connect round-trip.
 *
 * The provider token only exists on the session created by the OAuth code
 * exchange, so this page waits for it, stores it server-side, and only then
 * returns the user to AI Connect — instead of the generic /auth page which
 * used to bounce people to the home screen mid-flow.
 */
export default function SocialCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<'working' | 'done' | 'error'>('working');
  const ran = useRef(false);

  const platformParam = searchParams.get('platform');
  const platform: SocialOAuthPlatform | null =
    platformParam && VALID_CALLBACK_PLATFORMS.includes(platformParam as SocialOAuthPlatform)
      ? (platformParam as SocialOAuthPlatform)
      : readPendingPlatform();
  const returnPath = decodeURIComponent(searchParams.get('return') || '/ai-assistant/connect');

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    let cancelled = false;

    // The provider token lives only on the session emitted by the code
    // exchange, so grab it straight off the auth event as well.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      captureFromSession(session);
    });
    supabase.auth.getSession().then(({ data }) => captureFromSession(data.session));

    const errorCode = (
      searchParams.get('error_code') ||
      new URLSearchParams(window.location.hash.replace(/^#/, '')).get('error_code') ||
      ''
    ).toLowerCase();

    // The identity is already attached to this account, so linkIdentity can
    // never succeed. Re-run plain OAuth to harvest a fresh provider token.
    if (errorCode === 'identity_already_exists' && searchParams.get('add') === '1') {
      toast.error('This account is already connected. Sign out of it on the provider site (or use a private window) and pick a different account.');
      navigate(returnPath, { replace: true });
      return () => {
        cancelled = true;
        sub.subscription.unsubscribe();
      };
    }

    if (errorCode === 'identity_already_exists' && platform) {
      retryAfterAlreadyLinked(platform, returnPath).then(({ error }) => {
        if (error && !cancelled) {
          // Duplicate account on another profile: show the reason, then go back.
          toast.error((error as Error)?.message || 'Could not connect this account.');
          navigate(returnPath, { replace: true });
        }
      });
      return () => {
        cancelled = true;
        sub.subscription.unsubscribe();
      };
    }

    const finish = async () => {
      const deadline = Date.now() + 25000;
      while (!cancelled && Date.now() < deadline) {
        snapshotProviderToken();
        const pending = readPendingSocialLink();
        const { data } = await supabase.auth.getSession();
        if (pending?.accessToken && data.session) {
          try {
            await linkSocialAccount(pending);
            clearPendingSocialLink();
            clearPendingPlatform();
            window.dispatchEvent(new CustomEvent('social-connection-updated'));
            if (cancelled) return;
            setState('done');
            toast.success(`${LABEL[pending.platform] || 'Account'} connected`);
            navigate(returnPath, { replace: true });
            return;
          } catch (e) {
            console.error('[SocialCallback] link failed', e);
            if (!cancelled) setState('error');
            return;
          }
        }
        await new Promise((r) => setTimeout(r, 400));
      }
      if (!cancelled) setState('error');
    };

    finish();
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [navigate, platform, returnPath, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="max-w-sm w-full text-center space-y-4">
        {state === 'working' && (
          <>
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <h1 className="text-base font-semibold">
              Connecting {platform ? LABEL[platform] : 'your account'}…
            </h1>
            <p className="text-sm text-muted-foreground">
              Please wait, we are saving your authorisation.
            </p>
          </>
        )}

        {state === 'done' && (
          <>
            <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-600" />
            <h1 className="text-base font-semibold">Connected</h1>
          </>
        )}

        {state === 'error' && (
          <>
            <AlertTriangle className="h-8 w-8 mx-auto text-destructive" />
            <h1 className="text-base font-semibold">Could not finish connecting</h1>
            <p className="text-sm text-muted-foreground">
              The authorisation did not return an access token. Please try connecting again.
            </p>
            <Button onClick={() => navigate(returnPath, { replace: true })} className="w-full">
              Back to AI Connect
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
