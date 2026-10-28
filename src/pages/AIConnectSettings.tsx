import { useCallback, useEffect, useState } from 'react';
import { goBack } from "@/lib/goBack";
import { Helmet } from 'react-helmet-async';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useYouTubeGrowth, listYouTubeChannels, setYouTubeDefault, disconnectYouTubeChannel, addYouTubeChannel, type YTChannelAccount } from '@/hooks/useYouTubeGrowth';
import { useSocialConnections } from '@/hooks/useSocialConnect';
import { useUserTelegramBot } from '@/hooks/useUserTelegramBot';
import { useUserGmail } from '@/hooks/useUserGmail';
import { useUserOutlook } from '@/hooks/useUserOutlook';
import { useUserCustomEmail } from '@/hooks/useUserCustomEmail';
import SocialBotSetupCard from '@/components/social/SocialBotSetupCard';
import AutoReplyHeaderToggle from '@/components/social/AutoReplyHeaderToggle';
import { useUserChatBot, type ChatBotPlatform } from '@/hooks/useUserChatBot';
import { disconnectGmail, connectGmail, setGmailDefault } from '@/hooks/useUserGmail';
import { disconnectOutlook, connectOutlook, setOutlookDefault } from '@/hooks/useUserOutlook';
import { disconnectCustomEmail, connectCustomEmail, setCustomEmailDefault, MAIL_PROVIDER_PRESETS } from '@/hooks/useUserCustomEmail';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { unlinkUserBot, linkUserBot, setDefaultUserBot } from '@/hooks/useUserTelegramBot';
import GoogleBusinessProfileCard from '@/components/social/GoogleBusinessProfileCard';
import PlatformBusinessProfileCard from '@/components/social/PlatformBusinessProfileCard';
import EmployerNumberSwitcher from '@/components/employer/whatsapp/EmployerNumberSwitcher';
import EmployerWhatsAppAISettings from '@/components/employer/whatsapp/EmployerWhatsAppAISettings';
import WhatsAppSetupGate from '@/components/whatsapp/WhatsAppSetupGate';
import EmployerWhatsAppConnectCard from '@/components/employer/whatsapp/EmployerWhatsAppConnectCard';
import { useEmployerWhatsApp } from '@/components/employer/whatsapp/useEmployerWhatsApp';
import SocialAccountSwitcher from '@/components/social/SocialAccountSwitcher';
import SocialAccountAutoReplyToggle from '@/components/social/SocialAccountAutoReplyToggle';
import type { SocialPlatform, SocialConnectionInfo } from '@/hooks/useSocialConnect';
import { META_INFO, metaSocialAction, useMetaSocialAccount, MetaReplyToggles, type MetaPlatform } from '@/components/social/MetaSocialAIConnectCard';

const MULTI_SOCIAL = ['x', 'linkedin', 'github', 'gitlab', 'discord', 'slack', 'twitch'];
// Platforms whose accounts are listed by their own hooks (not social connections).
const MULTI_OWN = ['telegram', 'gmail', 'outlook', 'youtube', 'email'];
// Legacy mailboxes are stored with an empty account id; the switcher needs a non-empty one.
const DEFAULT_ID = '__default';
const toUi = (id: string | number | null | undefined) => (id === null || id === undefined || id === '' ? DEFAULT_ID : String(id));
const toReal = (id: string | null | undefined) => (!id || id === DEFAULT_ID ? '' : id);
const asAccount = (platform: string, id: string, name: string, handle: string | null, isDefault: boolean): SocialConnectionInfo => ({
  platform: platform as SocialPlatform, accountId: id, accountName: name, accountHandle: handle, accountPicture: null,
  accountEmail: null, followers: 0, following: 0, posts: 0, canPost: false, scopes: null, isDefault,
});

const TITLES: Record<string, string> = {
  youtube: 'YouTube settings',
  linkedin: 'LinkedIn settings',
  x: 'X (Twitter) settings',
  github: 'GitHub settings',
  gitlab: 'GitLab settings',
  telegram: 'Telegram settings',
  gmail: 'Gmail settings',
  outlook: 'Outlook settings',
  email: 'Domain email settings',
  whatsapp: 'WhatsApp settings',
  discord: 'Discord settings',
  slack: 'Slack settings',
  twitch: 'Twitch settings',
  facebook: 'Facebook Page settings',
  instagram: 'Instagram settings',
  google_business: 'Google Business Profile settings',
};

const CHAT_BOT_BRAND: Record<ChatBotPlatform, { label: string; color: string }> = {
  discord: { label: 'Discord', color: '#5865F2' },
  slack: { label: 'Slack', color: '#4A154B' },
  twitch: { label: 'Twitch', color: '#9146FF' },
};


export default function AIConnectSettings() {
  const navigate = useNavigate();
  const { platform = '' } = useParams();
  const { user, loading: authLoading } = useAuth();
  const key = platform.toLowerCase();
  const title = TITLES[key] || 'AI Connect settings';

  const { connection: ytConnection, checking: ytChecking, disconnect: ytDisconnect } = useYouTubeGrowth();
  const [ytChannels, setYtChannels] = useState<YTChannelAccount[]>([]);
  const [ytListLoading, setYtListLoading] = useState(key === 'youtube');
  const refreshYt = useCallback(async () => {
    if (key !== 'youtube') return;
    try { setYtChannels(await listYouTubeChannels()); } catch { /* keep previous */ } finally { setYtListLoading(false); }
  }, [key]);
  useEffect(() => { if (user) void refreshYt(); }, [user, refreshYt]);
  const [searchParams, setSearchParams] = useSearchParams();
  const { connections: socialConnections, get: getSocial, loading: socialLoading, refresh: refreshSocial } = useSocialConnections(
    !!user && ['x', 'linkedin', 'github', 'gitlab', 'discord', 'slack', 'twitch'].includes(key),
  );
  const { status: botStatus, loading: botLoading, refresh: refreshBot } = useUserTelegramBot(
    !!user && key === 'telegram',
  );
  const isChatBot = false;
  const { status: chatBotStatus, loading: chatBotLoading } = useUserChatBot(
    (isChatBot ? key : 'twitch') as ChatBotPlatform,
    !!user && isChatBot,
  );
  const whatsapp = useEmployerWhatsApp();
  const gmail = useUserGmail(!!user && key === 'gmail');
  const outlook = useUserOutlook(!!user && key === 'outlook');
  const customEmail = useUserCustomEmail(!!user && key === 'email');
  const mailEmail = key === 'gmail' ? gmail.status.accountEmail : key === 'outlook' ? outlook.status.accountEmail : key === 'email' ? customEmail.status.accountEmail : null;
  const isMeta = key === 'facebook' || key === 'instagram';
  const metaPlatform = (isMeta ? key : 'facebook') as MetaPlatform;
  const meta = useMetaSocialAccount(metaPlatform, !!user && isMeta, searchParams.get('account'));

  const isMulti = MULTI_SOCIAL.includes(key);
  const platformAccounts = isMulti ? socialConnections.filter((c) => c.platform === key) : [];
  const wantedAccount = searchParams.get('account');
  const currentAccount =
    platformAccounts.find((a) => a.accountId === wantedAccount) ||
    platformAccounts.find((a) => a.isDefault) ||
    platformAccounts[0] ||
    null;
  const accountId = currentAccount?.accountId || '';
  const selectAccount = (id: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('account', id);
    setSearchParams(next, { replace: true });
  };

  const isOwnMulti = MULTI_OWN.includes(key);
  const ownAccounts: SocialConnectionInfo[] = key === 'telegram'
    ? ((botStatus.accounts && botStatus.accounts.length)
        ? botStatus.accounts.map((a) => asAccount(key, String(a.account_id), a.name || a.username || 'Telegram bot', a.username, !!a.is_default))
        : (botStatus.bots || []).map((b) => asAccount(key, String(b.botId), b.botName || b.botUsername || 'Telegram bot', b.botUsername, !!b.isDefault)))
    : key === 'gmail'
      ? gmail.accounts.map((a) => asAccount(key, toUi(a.account_id), a.email || (a.is_default ? gmail.status.accountEmail : null) || 'Gmail account', null, a.is_default))
        : key === 'outlook'
        ? outlook.accounts.map((a) => asAccount(key, toUi(a.account_id), a.email || (a.is_default ? outlook.status.accountEmail : null) || 'Outlook account', null, a.is_default))
        : key === 'youtube'
          ? ytChannels.map((c) => asAccount(key, c.account_id, c.name || 'YouTube channel', null, c.is_default))
          : key === 'email'
            ? customEmail.accounts.map((a) => asAccount(key, toUi(a.account_id), a.email || (a.is_default ? customEmail.status.accountEmail : null) || 'Domain mailbox', null, a.is_default))
            : [];
  const ownCurrent =
    ownAccounts.find((a) => a.accountId === wantedAccount) ||
    ownAccounts.find((a) => a.isDefault) ||
    ownAccounts[0] ||
    null;
  const ownAccountId = key === 'telegram' || key === 'youtube' ? ownCurrent?.accountId || '' : toReal(ownCurrent?.accountId);
  const reloadOwn = async () => {
    if (key === 'telegram') await refreshBot();
    else if (key === 'gmail') await gmail.refresh();
    else if (key === 'outlook') await outlook.refresh();
    else if (key === 'youtube') await refreshYt();
    else if (key === 'email') await customEmail.refresh();
  };

  const [tgOpen, setTgOpen] = useState(false);
  const [tgToken, setTgToken] = useState('');
  const [tgSaving, setTgSaving] = useState(false);
  const [mailOpen, setMailOpen] = useState(false);
  const [mailSaving, setMailSaving] = useState(false);
  const [mailProvider, setMailProvider] = useState('workspace');
  const [mail, setMail] = useState({ email: '', password: '', imapHost: MAIL_PROVIDER_PRESETS.workspace.imapHost, imapPort: 993, smtpHost: MAIL_PROVIDER_PRESETS.workspace.smtpHost, smtpPort: 465 });
  const pickProvider = (p: string) => {
    setMailProvider(p);
    const preset = MAIL_PROVIDER_PRESETS[p];
    if (preset) setMail((m) => ({ ...m, imapHost: preset.imapHost, imapPort: preset.imapPort, smtpHost: preset.smtpHost, smtpPort: preset.smtpPort }));
  };
  const saveMailbox = async () => {
    const email = mail.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast.error('Enter a valid email address'); return; }
    if (!mail.password || !mail.imapHost || !mail.smtpHost) { toast.error('Fill in password and mail server details'); return; }
    setMailSaving(true);
    try {
      const res = await connectCustomEmail({ ...mail, email });
      toast.success(`Mailbox added: ${email}`);
      setMail((m) => ({ ...m, email: '', password: '' }));
      setMailOpen(false);
      await customEmail.refresh();
      selectAccount(toUi(res?.account_id));
    } catch (e) {
      toast.error((e as Error).message || 'Could not connect this mailbox');
    } finally {
      setMailSaving(false);
    }
  };
  // Adds another account while staying on this settings page.
  const addOwnAccount = async () => {
    if (key === 'telegram') { setTgOpen(true); return; }
    if (key === 'email') { setMailOpen(true); return; }
    if (key === 'youtube') {
      try { await addYouTubeChannel(window.location.pathname); }
      catch (e) { toast.error((e as Error).message || 'Could not add channel'); }
      return;
    }
    try {
      if (key === 'gmail') await connectGmail();
      else if (key === 'outlook') await connectOutlook();
      toast.success('Account added');
      await reloadOwn();
    } catch (e) {
      toast.error((e as Error).message || 'Could not add account');
    }
  };
  const saveTelegramBot = async () => {
    const token = tgToken.trim();
    if (!/^\d{5,}:[\w-]{20,}$/.test(token)) { toast.error('That bot token looks invalid. Paste the token from BotFather.'); return; }
    setTgSaving(true);
    try {
      const res = await linkUserBot(token);
      toast.success(`Bot added: @${res?.botUsername || 'bot'}`);
      setTgToken('');
      setTgOpen(false);
      await refreshBot();
      if (res?.botId) selectAccount(String(res.botId));
    } catch (e) {
      toast.error((e as Error).message || 'Could not add bot');
    } finally {
      setTgSaving(false);
    }
  };
  const makeOwnDefault = (id: string) =>
    key === 'telegram' ? setDefaultUserBot(id)
      : key === 'gmail' ? setGmailDefault(toReal(id))
      : key === 'youtube' ? setYouTubeDefault(id)
      : key === 'email' ? setCustomEmailDefault(toReal(id))
      : setOutlookDefault(toReal(id));
  const removeOwn = async (id: string) => {
    if (key === 'telegram') await unlinkUserBot(id);
    else if (key === 'gmail') await disconnectGmail(toReal(id) || undefined);
    else if (key === 'outlook') await disconnectOutlook(toReal(id) || undefined);
    else if (key === 'youtube') await disconnectYouTubeChannel(id);
    else if (key === 'email') await disconnectCustomEmail(null, toReal(id) || null);
    const next = new URLSearchParams(searchParams);
    next.delete('account');
    setSearchParams(next, { replace: true });
  };

  const loading = authLoading ||
    (key === 'youtube' && (ytChecking || ytListLoading) && !ytChannels.length) ||
    (key === 'email' && customEmail.loading && !customEmail.accounts.length) ||
    (['x', 'linkedin', 'github', 'gitlab', 'discord', 'slack', 'twitch'].includes(key) && socialLoading) ||
    (key === 'telegram' && botLoading) ||
    (key === 'gmail' && gmail.loading && !gmail.accounts.length) ||
    (key === 'outlook' && outlook.loading && !outlook.accounts.length) ||
    (key === 'whatsapp' && whatsapp.loading) ||
    (isChatBot && chatBotLoading);
  const pageLoading = loading || (isMeta && meta.loading);

  const connected =
    key === 'youtube'
      ? !!ytConnection || ownAccounts.length > 0
      : key === 'x'
        ? !!getSocial('x')
        : key === 'linkedin' || key === 'github' || key === 'gitlab' || key === 'discord' || key === 'slack' || key === 'twitch'
          ? !!getSocial(key)
          : key === 'telegram'
            ? botStatus.connected || ownAccounts.length > 0
            : key === 'gmail'
              ? gmail.status.connected || ownAccounts.length > 0
              : key === 'outlook'
                ? outlook.status.connected || ownAccounts.length > 0
              : key === 'email'
                ? customEmail.status.connected || ownAccounts.length > 0
              : key === 'whatsapp'
                ? whatsapp.connected
                : isMeta
                  ? !!meta.account
            : isChatBot
              ? chatBotStatus.connected
              : true;

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{title} | Workly India</title>
        <meta name="description" content={`Manage AI auto-reply ${title.toLowerCase()} for your connected account.`} />
      </Helmet>

      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-2 px-3 py-2.5 safe-top">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => goBack(navigate, '/ai-assistant/connect')}
            className="h-9 w-9 shrink-0"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-semibold truncate">{title}</h1>
            <p className="text-[11px] text-muted-foreground truncate">AI auto reply settings</p>
          </div>
        </div>
      </header>

      {key === 'whatsapp' && whatsapp.account ? (
        <EmployerNumberSwitcher accounts={whatsapp.accounts} current={whatsapp.account} reload={whatsapp.reload} />
      ) : null}
      {isMeta && meta.accounts.length > 0 && !pageLoading && (
        <SocialAccountSwitcher
          platform={key as SocialPlatform}
          label={META_INFO[metaPlatform].name}
          accounts={meta.accounts.map((a) => ({
            platform: key as SocialPlatform, accountId: a.id, accountName: a.name || META_INFO[metaPlatform].name,
            accountHandle: a.username || null, accountPicture: a.picture_url || null, accountEmail: null,
            followers: 0, following: 0, posts: 0, canPost: false, scopes: null, isDefault: !!(a as any).is_default,
          }))}
          current={meta.account ? { platform: key as SocialPlatform, accountId: meta.account.id, accountName: meta.account.name, accountHandle: meta.account.username, accountPicture: meta.account.picture_url, accountEmail: null, followers: 0, following: 0, posts: 0, canPost: false, scopes: null, isDefault: !!(meta.account as any).is_default } : null}
          onSelect={selectAccount}
          reload={meta.reload}
          addPath={`/ai-assistant/connect?add=${key}&return=${encodeURIComponent(window.location.pathname)}`}
          onMakeDefault={(id) => metaSocialAction({ action: 'set_default', platform: metaPlatform, account_id: id })}
          onRemove={async (id) => { await metaSocialAction({ action: 'disconnect', platform: metaPlatform, account_id: id }); const next = new URLSearchParams(searchParams); next.delete('account'); setSearchParams(next, { replace: true }); }}
        />
      )}
      {isOwnMulti && ownAccounts.length > 0 && !pageLoading && (
        <SocialAccountSwitcher
          platform={key as SocialPlatform}
          label={title.replace(' settings', '')}
          accounts={ownAccounts}
          current={ownCurrent}
          onSelect={selectAccount}
          reload={reloadOwn}
          onAdd={() => void addOwnAccount()}
          onMakeDefault={makeOwnDefault}
          onRemove={removeOwn}
        />
      )}
      {!isMulti && !isMeta && !(isOwnMulti && ownAccounts.length > 0) && key !== 'whatsapp' && connected && !pageLoading && (
        <SocialAccountSwitcher
          platform={key as SocialPlatform}
          label={title.replace(' settings', '')}
          accounts={[{
            platform: key as SocialPlatform,
            accountId: isMeta ? meta.account?.id || key : key,
            accountName: mailEmail ? mailEmail : key === 'youtube' ? (ytConnection as any)?.channelTitle || 'YouTube' : key === 'telegram' ? botStatus.botName || botStatus.botUsername || 'Telegram bot' : isMeta ? meta.account?.name || META_INFO[metaPlatform].name : title.replace(' settings', ''),
            accountHandle: key === 'telegram' ? botStatus.botUsername || null : isMeta ? meta.account?.username || null : null, accountPicture: isMeta ? meta.account?.picture_url || null : null, accountEmail: null,
            followers: 0, following: 0, posts: 0, canPost: false, scopes: null, isDefault: true,
          }]}
          current={null}
          onSelect={() => {}}
          reload={() => {}}
          single
          addPath={`/ai-assistant/connect?add=${key}&return=${encodeURIComponent(window.location.pathname + window.location.search)}`}
          onRemove={async () => {
            if (key === 'gmail') await disconnectGmail();
            else if (key === 'outlook') await disconnectOutlook();
            else if (key === 'email') await disconnectCustomEmail();
            else if (key === 'telegram') await unlinkUserBot();
            else if (key === 'youtube') await ytDisconnect();
            navigate('/ai-assistant/connect');
          }}
        />
      )}
      {isMulti && platformAccounts.length > 0 && (
        <SocialAccountSwitcher
          platform={key as SocialPlatform}
          label={title.replace(' settings', '')}
          accounts={platformAccounts}
          current={currentAccount}
          onSelect={selectAccount}
          reload={refreshSocial}
        />
      )}

      <main className="w-full px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-4 sm:py-6 sm:max-w-2xl sm:mx-auto space-y-3">
        {!pageLoading && connected && key !== 'whatsapp' && key !== 'google_business' && (
          <Card>
            <CardContent className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="text-base font-semibold">AI auto reply</p>
                <p className="truncate text-xs text-muted-foreground">
                  {isMeta && meta.account
                    ? meta.account.name || META_INFO[metaPlatform].name
                    : isMulti && currentAccount
                    ? currentAccount.accountName || currentAccount.accountHandle || title.replace(' settings', '')
                    : isOwnMulti && ownCurrent
                    ? ownCurrent.accountName || title.replace(' settings', '')
                    : title.replace(' settings', '')}
                </p>
              </div>
              {isMeta && meta.account ? null : isMulti && accountId ? (
                <SocialAccountAutoReplyToggle key={accountId} platform={key as SocialPlatform} accountId={accountId} />
              ) : isOwnMulti && ownCurrent ? (
                <AutoReplyHeaderToggle key={ownAccountId || DEFAULT_ID} platform={key} connected accountId={ownAccountId || null} />
              ) : (
                <AutoReplyHeaderToggle platform={key} connected />
              )}
            </CardContent>
            {isMeta && meta.account && (
              <CardContent className="border-t p-4">
                <MetaReplyToggles key={meta.account.id} account={meta.account} platform={metaPlatform} onSaved={() => void meta.reload()} />
              </CardContent>
            )}
          </Card>
        )}
        {pageLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : key === 'google_business' ? (
          <GoogleBusinessProfileCard enabled={!!user} variant="page" />
        ) : key === 'whatsapp' && !connected ? (
          <EmployerWhatsAppConnectCard onConnected={() => void whatsapp.reload()} />
        ) : !connected ? (
          <Card className="border-dashed">
            <CardContent className="p-4 text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                This account is not connected yet. Connect it first to manage settings.
              </p>
              <Button size="sm" onClick={() => (isOwnMulti ? void addOwnAccount() : navigate(`/ai-assistant/connect?add=${key}&return=${encodeURIComponent(window.location.pathname)}`))}>
                Connect {title.replace(' settings', '')}
              </Button>
            </CardContent>
          </Card>
        ) : key === 'youtube' ? (
          <PlatformBusinessProfileCard key={ownAccountId || DEFAULT_ID} accountId={ownAccountId} platform="youtube" label="YouTube" />
        ) : key === 'x' ? (
          <PlatformBusinessProfileCard key={accountId} accountId={accountId} platform="x" label="X (Twitter)" />
        ) : key === 'linkedin' ? (
          <PlatformBusinessProfileCard key={accountId} accountId={accountId} platform="linkedin" label="LinkedIn" />
        ) : key === 'github' ? (
          <PlatformBusinessProfileCard key={accountId} accountId={accountId} platform="github" label="GitHub" />
        ) : key === 'gitlab' ? (
          <PlatformBusinessProfileCard key={accountId} accountId={accountId} platform="gitlab" label="GitLab" />
        ) : key === 'discord' || key === 'slack' || key === 'twitch' ? (
          <>
            <PlatformBusinessProfileCard key={accountId} accountId={accountId} platform={key} label={CHAT_BOT_BRAND[key as ChatBotPlatform].label} />
            <SocialBotSetupCard
              platform={key}
              label={CHAT_BOT_BRAND[key as ChatBotPlatform].label}
              brandColor={CHAT_BOT_BRAND[key as ChatBotPlatform].color}
              channelName={(getSocial(key) as any)?.channelName || (getSocial(key) as any)?.profile_data?.channel_name || null}
              onSaved={refreshSocial}
            />
          </>
        ) : key === 'telegram' ? (
          <PlatformBusinessProfileCard key={ownAccountId || DEFAULT_ID} accountId={ownAccountId} platform="telegram" label="Telegram" />
        ) : isMeta && meta.account ? (
          <PlatformBusinessProfileCard key={meta.account.id} accountId={meta.account.id} platform={metaPlatform} label={META_INFO[metaPlatform].name} />
        ) : key === 'gmail' ? (
          <PlatformBusinessProfileCard key={ownAccountId || DEFAULT_ID} accountId={ownAccountId} platform="gmail" label="Gmail" />
        ) : key === 'outlook' ? (
          <PlatformBusinessProfileCard key={ownAccountId || DEFAULT_ID} accountId={ownAccountId} platform="outlook" label="Outlook" />
        ) : key === 'whatsapp' && whatsapp.account ? (
          <WhatsAppSetupGate key={whatsapp.account.phone_number_id || 'default'} scope="employer">
            <EmployerWhatsAppAISettings account={whatsapp.account} reload={whatsapp.reload} />
          </WhatsAppSetupGate>
        ) : key === 'email' ? (
          <PlatformBusinessProfileCard key={ownAccountId || DEFAULT_ID} accountId={ownAccountId} platform="email" label="Domain email" />
        ) : (
          <p className="text-sm text-muted-foreground text-center py-10">Unknown platform.</p>
        )}
      </main>

      <Dialog open={mailOpen} onOpenChange={(v) => !mailSaving && setMailOpen(v)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add a domain mailbox</DialogTitle>
            <DialogDescription>Your existing mailboxes stay connected. Each mailbox gets its own AI reply and business details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Email provider</Label>
              <Select value={mailProvider} onValueChange={pickProvider}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(MAIL_PROVIDER_PRESETS).map(([k, p]) => <SelectItem key={k} value={k}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {MAIL_PROVIDER_PRESETS[mailProvider]?.hint && <p className="text-[11px] text-muted-foreground">{MAIL_PROVIDER_PRESETS[mailProvider].hint}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mb-email">Email address</Label>
              <Input id="mb-email" type="email" value={mail.email} onChange={(e) => setMail({ ...mail, email: e.target.value })} placeholder="you@yourdomain.com" autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mb-pass">Password / app password</Label>
              <Input id="mb-pass" type="password" value={mail.password} onChange={(e) => setMail({ ...mail, password: e.target.value })} autoComplete="new-password" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 space-y-1.5"><Label htmlFor="mb-imap">IMAP server</Label><Input id="mb-imap" value={mail.imapHost} onChange={(e) => setMail({ ...mail, imapHost: e.target.value })} /></div>
              <div className="space-y-1.5"><Label htmlFor="mb-imapp">Port</Label><Input id="mb-imapp" type="number" value={mail.imapPort} onChange={(e) => setMail({ ...mail, imapPort: Number(e.target.value) || 993 })} /></div>
              <div className="col-span-2 space-y-1.5"><Label htmlFor="mb-smtp">SMTP server</Label><Input id="mb-smtp" value={mail.smtpHost} onChange={(e) => setMail({ ...mail, smtpHost: e.target.value })} /></div>
              <div className="space-y-1.5"><Label htmlFor="mb-smtpp">Port</Label><Input id="mb-smtpp" type="number" value={mail.smtpPort} onChange={(e) => setMail({ ...mail, smtpPort: Number(e.target.value) || 465 })} /></div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setMailOpen(false)} disabled={mailSaving}>Cancel</Button>
            <Button onClick={() => void saveMailbox()} disabled={mailSaving || !mail.email.trim() || !mail.password}>
              {mailSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Add mailbox
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={tgOpen} onOpenChange={(v) => !tgSaving && setTgOpen(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add another Telegram bot</DialogTitle>
            <DialogDescription>Your existing bots stay connected. Paste the new bot token from @BotFather.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="settings-telegram-token">Bot token</Label>
            <Input id="settings-telegram-token" value={tgToken} onChange={(e) => setTgToken(e.target.value)} placeholder="123456:ABC-DEF..." autoComplete="off" />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setTgOpen(false)} disabled={tgSaving}>Cancel</Button>
            <Button onClick={() => void saveTelegramBot()} disabled={tgSaving || !tgToken.trim()}>
              {tgSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Add bot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
