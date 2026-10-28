import type { JSX } from "react";
import { useEffect, useState } from "react";
import { supabase } from '@/integrations/supabase/client';
import { supabasePublishableKey, supabaseUrl } from '@/constants/supabase';
import { toast } from 'sonner';

interface OAuthProviderButtonsProps {
  onGoogle: () => void;
  onLinkedIn: () => void;
  onTwitter: () => void;
  onGitHub?: () => void;
  onGitLab?: () => void;
  disabled?: boolean;
  className?: string;
  /**
   * Jahan OAuth round-trip ke baad user ko land karana hai (e.g. "/ai-assistant").
   * Diya gaya ho to provider /auth?redirect=... par wapas aata hai.
   */
  returnPath?: string;
}

/** Button key → Supabase settings flag. */
const SETTINGS_FLAG: Record<string, string> = {
  google: 'google',
  facebook: 'facebook',
  linkedin: 'linkedin_oidc',
  // NOTE: 'x' (Twitter OAuth 2.0) jaan-boojh kar yahan NAHI hai — Supabase ka
  // /auth/v1/settings endpoint `external.twitter` mein deprecated Twitter
  // provider ka status bhejta hai, naye "X / Twitter (OAuth 2.0)" ka nahi.
  // Isliye X icon hamesha dikhta hai; agar project par X disabled hoga to
  // click par Supabase ka error toast dikh jayega.
  github: 'github',
  gitlab: 'gitlab',
  azure: 'azure',
  workos: 'workos',
  bitbucket: 'bitbucket',
  discord: 'discord',
  figma: 'figma',
  notion: 'notion',
  twitch: 'twitch',
  slack_oidc: 'slack_oidc',
  spotify: 'spotify',
};

/** Supabase project par jo providers enabled hain unhi ke icons dikhao. */
const useEnabledProviders = () => {
  const [enabled, setEnabled] = useState<Record<string, boolean> | null>(null);

  useEffect(() => {
    let active = true;
    const url = supabaseUrl();
    const key = supabasePublishableKey();
    if (!url || !key) return;
    fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active && data?.external) setEnabled(data.external as Record<string, boolean>);
      })
      .catch(() => {
        /* network issue → sab icons dikhte rahenge */
      });
    return () => {
      active = false;
    };
  }, []);

  return enabled;
};

type SupabaseProvider =
  | 'facebook'
  | 'github'
  | 'gitlab'
  | 'bitbucket'
  | 'discord'
  | 'figma'
  | 'notion'
  | 'twitch'
  | 'slack_oidc'
  | 'spotify'
  | 'azure'
  | 'workos';


type SimpleProvider = {
  id: SupabaseProvider;
  label: string;
  color: string;
  path: string;
};

/** Supabase par enabled single-path providers. */
const SIMPLE_PROVIDERS: SimpleProvider[] = [
  {
    id: 'facebook',
    label: 'Facebook',
    color: '#1877F2',
    path: 'M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047v-2.66c0-3.025 1.792-4.697 4.533-4.697 1.313 0 2.686.236 2.686.236v2.971H15.83c-1.491 0-1.956.93-1.956 1.886v2.264h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z',
  },
  {
    id: 'azure',
    label: 'Microsoft',
    color: '#00A4EF',
    path: 'M0 0h11.377v11.372H0zm12.623 0H24v11.372H12.623zM0 12.623h11.377V24H0zm12.623 0H24V24H12.623z',
  },
  {
    id: 'workos',
    label: 'WorkOS',
    color: '#6363F1',
    path: 'M12 2 3 7v10l9 5 9-5V7zm0 2.3 6.9 3.83L12 11.96 5.1 8.13zM5 9.86l6 3.33v6.66l-6-3.33zm8 9.99v-6.66l6-3.33v6.66z',
  },
  {
    id: 'github',

    label: 'GitHub',
    color: 'currentColor',
    path: 'M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.06-.72.08-.71.08-.71 1.17.08 1.78 1.2 1.78 1.2 1.04 1.79 2.73 1.27 3.4.97.1-.76.41-1.28.74-1.57-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 015.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.12 3.05.74.8 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.25 5.67.42.36.8 1.08.8 2.18v3.23c0 .31.21.68.8.56A11.51 11.51 0 0023.5 12C23.5 5.73 18.27.5 12 .5z',
  },
  {
    id: 'bitbucket',
    label: 'Bitbucket',
    color: '#2684FF',
    path: 'M.778 1.213a.768.768 0 0 0-.768.892l3.263 19.81c.084.5.515.868 1.022.873h15.65a.772.772 0 0 0 .77-.646l3.27-20.03a.768.768 0 0 0-.768-.891zM14.52 15.53H9.522L8.17 8.466h7.561z',
  },
  {
    id: 'discord',
    label: 'Discord',
    color: '#5865F2',
    path: 'M20.317 4.369a19.8 19.8 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.211.375-.445.865-.608 1.25a18.3 18.3 0 0 0-5.487 0 12 12 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.7 19.7 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.058a.08.08 0 0 0 .031.055 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14 14 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13 13 0 0 1-1.872-.892.077.077 0 0 1-.008-.128q.189-.142.368-.291a.074.074 0 0 1 .078-.01c3.927 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .079.009q.18.15.37.292a.077.077 0 0 1-.007.128 12 12 0 0 1-1.873.891.077.077 0 0 0-.041.107c.36.698.772 1.363 1.225 1.993a.077.077 0 0 0 .084.028 19.8 19.8 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.06.06 0 0 0-.031-.03M8.02 15.331c-1.183 0-2.157-1.086-2.157-2.419s.955-2.419 2.157-2.419c1.211 0 2.176 1.096 2.157 2.42 0 1.332-.955 2.418-2.157 2.418m7.975 0c-1.183 0-2.157-1.086-2.157-2.419s.955-2.419 2.157-2.419c1.211 0 2.176 1.096 2.157 2.42 0 1.332-.946 2.418-2.157 2.418',
  },
  {
    id: 'figma',
    label: 'Figma',
    color: '#F24E1E',
    path: 'M8.5 24a4 4 0 0 0 4-4v-4h-4a4 4 0 0 0 0 8m-4-20a4 4 0 0 1 4-4h4v8h-4a4 4 0 0 1-4-4m0 8a4 4 0 0 1 4-4h4v8h-4a4 4 0 0 1-4-4m12-8a4 4 0 0 1-4 4V0a4 4 0 0 1 4 4m3.5 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  },
  {
    id: 'notion',
    label: 'Notion',
    color: 'currentColor',
    path: 'M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.98-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.746-.887l-15.177.887c-.56.047-.75.327-.75.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.746 0-.933-.234-1.494-.933l-4.577-7.186v6.952l1.448.327s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.746-.933z',
  },
  {
    id: 'twitch',
    label: 'Twitch',
    color: '#9146FF',
    path: 'M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0 1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z',
  },
  {
    id: 'slack_oidc',
    label: 'Slack',
    color: '#4A154B',
    path: 'M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521zm10.122 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523z',
  },
  {
    id: 'spotify',
    label: 'Spotify',
    color: '#1DB954',
    path: 'M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0m5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02m1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6s.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2m.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.56.3',
  },
];

/** Login pages intentionally offer only these five account providers. */
const LOGIN_PROVIDER_ORDER = ['google', 'linkedin', 'x', 'workos', 'azure'] as const;

/**
 * WorkOS ka /sso/authorize endpoint EK selector maangta hai:
 * `connection` (conn_...), `organization` (org_...) ya `provider`
 * (GoogleOAuth / MicrosoftOAuth / authkit).
 * Selector ke bina WorkOS `error.workos.com/sso/invalid-connection-selector`
 * par bhej deta hai. Default `authkit` — WorkOS hosted login screen jahan
 * user Google/Microsoft/email chun sakta hai. Enterprise SSO ke liye
 * VITE_WORKOS_CONNECTION_ID ya VITE_WORKOS_ORGANIZATION_ID set karein.
 */
const WORKOS_CONNECTION_ID = import.meta.env.VITE_WORKOS_CONNECTION_ID?.trim();
const WORKOS_ORGANIZATION_ID = import.meta.env.VITE_WORKOS_ORGANIZATION_ID?.trim();
const WORKOS_PROVIDER = import.meta.env.VITE_WORKOS_PROVIDER?.trim() || 'authkit';

const WORKOS_QUERY_PARAMS: Record<string, string> = WORKOS_CONNECTION_ID
  ? { connection: WORKOS_CONNECTION_ID }
  : WORKOS_ORGANIZATION_ID
    ? { organization: WORKOS_ORGANIZATION_ID }
    // NOTE: Supabase par `provider` reserved hai, isliye WorkOS ke provider
    // selector ke liye `workos_provider` bhejna padta hai.
    : { workos_provider: WORKOS_PROVIDER };




/**
 * Single horizontally scrollable row of round social sign-in icons.
 * Har icon ke neeche mini label (Google, LinkedIn, ...) show hota hai.
 */
const OAuthProviderButtons = ({
  onGoogle,
  onLinkedIn,
  onTwitter,
  onGitHub,
  onGitLab,
  disabled,
  className = '',
  returnPath,
}: OAuthProviderButtonsProps) => {
  const enabledProviders = useEnabledProviders();

  const signInWith = async (provider: SupabaseProvider) => {
    // - workos: SSO endpoint ko selector chahiye (connection/organization/provider).
    //   WORKOS_QUERY_PARAMS hamesha set hota hai (default authkit).
    // - azure (Microsoft): account chooser force karo taaki silent wrong-account
    //   login na ho.
    const extras: Record<
      string,
      { scopes?: string; queryParams?: Record<string, string> }
    > = {
      // Keep consumer Facebook Login isolated from the separate WhatsApp
      // Business integration. Supabase already adds `email`, so adding only
      // `public_profile` here produces exactly the two basic login scopes.
      facebook: { scopes: 'public_profile' },
      workos: { queryParams: WORKOS_QUERY_PARAMS },
      azure: {
        scopes: 'openid email profile offline_access',
        queryParams: { prompt: 'select_account' },
      },
    };

    if (returnPath) {
      try {
        sessionStorage.setItem('oauth_return_path', returnPath);
        localStorage.setItem('oauth_return_path', returnPath);
      } catch {
        /* ignore */
      }
    }

    const redirectTo = returnPath
      ? `${window.location.origin}/auth?redirect=${encodeURIComponent(returnPath)}`
      : `${window.location.origin}${window.location.pathname}`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        ...extras[provider],
      },
    });
    if (error) toast.error(error.message);
  };


  const items: { key: string; label: string; onClick: () => void; icon: JSX.Element }[] = [
    {
      key: 'google',
      label: 'Google',
      onClick: onGoogle,
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
      ),
    },
    {
      key: 'linkedin',
      label: 'LinkedIn',
      onClick: onLinkedIn,
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="#0A66C2" aria-hidden="true">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      ),
    },
    {
      key: 'x',
      label: 'X',
      onClick: onTwitter,
      icon: (
        <svg className="w-5 h-5 text-foreground" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
    },
    {
      key: 'gitlab',
      label: 'GitLab',
      onClick: onGitLab ?? (() => signInWith('gitlab')),
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#E24329" d="M12 22.5l3.95-12.16H8.05L12 22.5z" />
          <path fill="#FC6D26" d="M12 22.5L8.05 10.34H2.51L12 22.5z" />
          <path fill="#FCA326" d="M2.51 10.34L1.31 14.03a.82.82 0 00.3.92L12 22.5 2.51 10.34z" />
          <path fill="#E24329" d="M2.51 10.34h5.54L5.67 3a.41.41 0 00-.78 0L2.51 10.34z" />
          <path fill="#FC6D26" d="M12 22.5l3.95-12.16h5.54L12 22.5z" />
          <path fill="#FCA326" d="M21.49 10.34l1.2 3.69a.82.82 0 01-.3.92L12 22.5l9.49-12.16z" />
          <path fill="#E24329" d="M21.49 10.34h-5.54L18.33 3a.41.41 0 01.78 0l2.38 7.34z" />
        </svg>
      ),
    },
    ...SIMPLE_PROVIDERS.map((p) => ({

      key: p.id,
      label: p.label,
      onClick:
        p.id === 'github' && onGitHub ? onGitHub : () => signInWith(p.id),
      icon: (
        <svg
          className={`w-6 h-6 ${p.color === 'currentColor' ? 'text-foreground' : ''}`}
          viewBox="0 0 24 24"
          fill={p.color}
          aria-hidden="true"
        >
          <path d={p.path} />
        </svg>
      ),
    })),
  ];

  // Sirf wahi icons dikhao jo Supabase project par enabled hain.
  const loginItems = LOGIN_PROVIDER_ORDER.flatMap((key) => {
    const item = items.find((candidate) => candidate.key === key);
    return item ? [item] : [];
  });

  const visibleItems = enabledProviders
    ? loginItems.filter((item) => {
        const flag = SETTINGS_FLAG[item.key];
        return flag ? enabledProviders[flag] !== false : true;
      })
    : loginItems;

  return (
    <div
      className={`relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 overflow-x-auto overflow-y-hidden overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:left-0 sm:w-full sm:translate-x-0 ${className}`}
    >
      <div className="flex min-w-max flex-nowrap items-start justify-center gap-3 px-4 pb-1 sm:gap-4">
        {visibleItems.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={item.onClick}
            disabled={disabled}
            aria-label={`Continue with ${item.label}`}
            title={item.label}
            className="flex w-14 shrink-0 flex-col items-center gap-1 disabled:opacity-50"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card shadow-sm transition-transform active:scale-95 hover:bg-accent">
              {item.icon}
            </span>
            <span className="w-full truncate text-center text-[10px] leading-tight text-muted-foreground">
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default OAuthProviderButtons;
