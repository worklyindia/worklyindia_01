import { useConnectionRefresh } from '@/hooks/useConnectionRefresh';
import { notifyConnectionUpdated } from '@/lib/connectionUpdates';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import PlatformCard from '@/components/social/PlatformCard';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import DisconnectAccountPicker from '@/components/social/DisconnectAccountPicker';
import { metaChatRequest } from '@/lib/metaChatScope';
import { metaReplyPatch } from '../../../supabase/functions/_shared/supportReplyScope';

export type MetaPlatform = 'facebook' | 'instagram';

export interface MetaAccount {
  id: string;
  platform: MetaPlatform;
  name: string | null;
  username: string | null;
  picture_url: string | null;
  page_id?: string | null;
  ig_user_id?: string | null;
  status?: string;
  is_default?: boolean;
  ai_reply_comments: boolean;
  ai_reply_messages: boolean;
  ai_tone: string | null;
  ai_language: string | null;
  ai_reply_length: string | null;
  ai_business_info: string | null;
  ai_custom_instructions: string | null;
  ai_signature: string | null;
}

export const META_STATE_KEY = 'meta_social_oauth';
export const metaRedirectUri = () => `${window.location.origin}/oauth/meta/return`;

export async function metaSocialAction(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('workly-india', {
    body: { scope: 'meta_social', ...body },
  });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const text = ctx && typeof ctx.text === 'function' ? await ctx.text().catch(() => '') : '';
    let msg = error.message;
    try { msg = JSON.parse(text).error || msg; } catch { /* keep */ }
    throw new Error(msg);
  }
  if (!data?.success) throw new Error(data?.error || 'Request failed');
  if (['callback', 'disconnect', 'set_default'].includes(String(body.action))) notifyConnectionUpdated();
  return data;
}

const FacebookLogo = () => (
  <svg width={28} height={28} viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="12" fill="#1877F2" />
    <path fill="#fff" d="M13.4 19.5v-6h2l.3-2.4h-2.3V9.6c0-.7.2-1.2 1.2-1.2h1.2V6.3a16 16 0 0 0-1.8-.1c-1.8 0-3 1.1-3 3.1v1.8H9v2.4h2v6h2.4Z" />
  </svg>
);

const InstagramLogo = () => (
  <svg width={28} height={28} viewBox="0 0 24 24" aria-hidden="true">
    <defs>
      <linearGradient id="igGrad" x1="0" y1="1" x2="1" y2="0">
        <stop offset="0" stopColor="#FEDA75" /><stop offset=".35" stopColor="#FA7E1E" />
        <stop offset=".65" stopColor="#D62976" /><stop offset="1" stopColor="#4F5BD5" />
      </linearGradient>
    </defs>
    <rect width="24" height="24" rx="6" fill="url(#igGrad)" />
    <rect x="5.5" y="5.5" width="13" height="13" rx="4" fill="none" stroke="#fff" strokeWidth="1.6" />
    <circle cx="12" cy="12" r="3.2" fill="none" stroke="#fff" strokeWidth="1.6" />
    <circle cx="16.3" cy="7.7" r=".9" fill="#fff" />
  </svg>
);

export const META_INFO: Record<MetaPlatform, { name: string; description: string; color: string; logo: JSX.Element; inbox: string }> = {
  facebook: {
    name: 'Facebook Page',
    description: 'Connect your Facebook Page so AI can auto reply to post comments and Messenger inbox messages.',
    color: '#1877F2',
    logo: <FacebookLogo />,
    inbox: 'Messenger inbox messages',
  },
  instagram: {
    name: 'Instagram',
    description: 'Connect your Instagram Business account so AI can auto reply to post comments and DMs.',
    color: '#D62976',
    logo: <InstagramLogo />,
    inbox: 'Instagram DMs',
  },
};

/** AI Connect card for Facebook Page / Instagram Business: AI replies to comments and inbox. */
export function useMetaSocialAccount(platform: MetaPlatform, enabled = true, wantedId?: string | null, audience?: 'support') {
  const [accounts, setAccounts] = useState<MetaAccount[]>([]);
  const [loading, setLoading] = useState(enabled);
  const reload = useCallback(async () => {
    if (!enabled) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await metaSocialAction({ action: 'status', ...(audience ? { audience } : {}) });
      setAccounts((data.accounts as MetaAccount[]).filter((a) => a.platform === platform));
    } catch { setAccounts([]); }
    finally { setLoading(false); }
  }, [enabled, platform, audience]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const key = `${platform}:${audience || ''}`;
  useEffect(() => { void reload().then(() => setLoadedKey(key)); }, [reload, key]);
  useConnectionRefresh(reload, enabled);
  const account = accounts.find((a) => a.id === wantedId) || accounts.find((a) => (a as any).is_default) || accounts[0] || null;
  return { account, accounts, loading: loading || (enabled && loadedKey !== key), reload };
}

/** Separate on/off switches for post comments and inbox/DM replies, saved instantly. */
export function MetaReplyToggles({ account, platform, onSaved, audience }: { account: MetaAccount; platform: MetaPlatform; onSaved: () => void; audience?: 'support' }) {
  const [s, setS] = useState({ comments: account.ai_reply_comments, messages: account.ai_reply_messages });
  const [busy, setBusy] = useState(false);
  useEffect(() => { setS({ comments: account.ai_reply_comments, messages: account.ai_reply_messages }); }, [account]);
  const toggle = async (key: 'comments' | 'messages', v: boolean) => {
    const next = { ...s, [key]: v };
    setS(next); setBusy(true);
    try {
      await metaSocialAction(metaChatRequest({ action: 'settings', platform, account_id: account.id, settings: metaReplyPatch(key, v) }, audience));
      toast.success('Saved');
      onSaved();
    } catch (e) { setS(s); toast.error((e as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={`${account.id}-top-c`} className="text-sm">AI reply to post comments</Label>
        <Switch id={`${account.id}-top-c`} checked={s.comments} disabled={busy} onCheckedChange={(v) => void toggle('comments', v)} />
      </div>
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={`${account.id}-top-m`} className="text-sm">AI reply to {META_INFO[platform].inbox}</Label>
        <Switch id={`${account.id}-top-m`} checked={s.messages} disabled={busy} onCheckedChange={(v) => void toggle('messages', v)} />
      </div>
    </div>
  );
}

export default function MetaSocialAIConnectCard({ platform, autoConnect = false, returnTo, audience }: { platform: MetaPlatform; autoConnect?: boolean; returnTo?: string; audience?: 'support' }) {
  const navigate = useNavigate();
  const { accounts, account, loading, reload } = useMetaSocialAccount(platform, true, null, audience);
  const aud = audience ? { audience } : {};
  const [busy, setBusy] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);
  const info = META_INFO[platform];
  const autoStarted = useRef(false);

  const connect = async () => {
    setBusy(true);
    try {
      const state = crypto.randomUUID();
      // Customer Service Instagram uses Instagram Login (instagram_business_manage_comments), the
      // method whose comment replies already work on AI Connect.
      const instagramLogin = platform === 'instagram' && audience === 'support';
      sessionStorage.setItem(META_STATE_KEY, JSON.stringify({ state, platform, audience, instagramLogin, returnTo: returnTo || `/ai-assistant/connect/${platform}/settings` }));
      const data = await metaSocialAction({ action: 'connect_url', ...aud, platform, ...(instagramLogin ? { instagram_login: true } : {}), redirect_uri: metaRedirectUri(), state });
      window.location.href = data.url;
    } catch (e) { toast.error((e as Error).message); setBusy(false); }
  };

  useEffect(() => {
    if (autoConnect && !loading && !busy && !autoStarted.current) {
      autoStarted.current = true;
      void connect();
    }
  }, [autoConnect, busy, loading]);

  const disconnectOne = async (id: string) => {
    setBusy(true);
    try {
      await metaSocialAction({ action: 'disconnect', ...aud, platform, account_id: id });
      toast.success(`${info.name} account disconnected`);
      await reload();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  const flags = account
    ? [account.ai_reply_comments && 'Comments', account.ai_reply_messages && 'Inbox'].filter(Boolean).join(' + ')
    : '';

  return (
    <>
      <PlatformCard
        name={info.name}
        connectLabel="Connect"
        description={info.description}
        logo={info.logo}
        connected={!!account}
        connectedLabel={accounts.length > 1 ? `${accounts.length} accounts connected` : account?.name || 'Connected'}
        subLabel={account ? (flags ? `AI reply on: ${flags}` : 'AI reply is off') : null}
        onConnect={connect}
        onSettings={account && !audience ? () => navigate(`/ai-assistant/connect/${platform}/settings`) : undefined}
        onDisconnect={account ? () => (accounts.length > 1 ? setPickOpen(true) : void disconnectOne(account.id)) : undefined}
        loading={busy || loading}
        brandColor={info.color}
      >
        {audience && accounts.map((item) => <SupportMetaSettings key={item.id} account={item} platform={platform} reload={reload} />)}
      </PlatformCard>
      <DisconnectAccountPicker
        open={pickOpen}
        onOpenChange={setPickOpen}
        label={info.name}
        accounts={accounts.map((a) => ({ id: a.id, name: a.name || info.name, sub: a.username ? `@${a.username}` : null, picture: a.picture_url }))}
        onDisconnect={disconnectOne}
      />
    </>
  );
}

function SupportMetaSettings({ account, platform, reload }: { account: MetaAccount; platform: MetaPlatform; reload: () => Promise<void> }) {
  return <div className="mt-4 space-y-3 border-t border-border pt-4">
    <h4 className="break-words text-sm font-medium">{account.name || account.username || META_INFO[platform].name}</h4>
    <MetaReplyToggles account={account} platform={platform} audience="support" onSaved={() => void reload()} />
  </div>;
}
