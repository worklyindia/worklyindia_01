import { useState, useEffect, useRef } from 'react';
import { goBack } from "@/lib/goBack";
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useYouTubeGrowth } from '@/hooks/useYouTubeGrowth';
import {
  useSocialConnections,
  disconnectSocialAccount,
  type SocialPlatform,
} from '@/hooks/useSocialConnect';
import {
  YouTubeLogo,
  XLogo,
  LinkedInLogo,
  TelegramLogo,
  BitbucketLogo,
  DiscordLogo,
  FigmaLogo,
  NotionLogo,
  TwitchLogo,
  SlackLogo,
  SpotifyLogo,
  AzureLogo,
  SupabaseLogo,
} from '@/components/social/SocialPlatformLogos';
import { startSocialOAuth, type SocialOAuthPlatform } from '@/lib/socialOAuth';
import GmailAutoReplyCard from '@/components/social/GmailAutoReplyCard';
import OutlookAutoReplyCard from '@/components/social/OutlookAutoReplyCard';
import CustomEmailCard from '@/components/social/CustomEmailCard';
import PlatformCard from '@/components/social/PlatformCard';
import WhatsAppAIConnectCard from '@/components/social/WhatsAppAIConnectCard';
import MetaSocialAIConnectCard from '@/components/social/MetaSocialAIConnectCard';
import GoogleBusinessProfileCard from '@/components/social/GoogleBusinessProfileCard';
import DisconnectAccountPicker from '@/components/social/DisconnectAccountPicker';


import {
  useUserTelegramBot,
  linkUserBot,
  unlinkUserBot,
} from '@/hooks/useUserTelegramBot';
import {
  useUserChatBot,
  linkChatBot,
  unlinkChatBot,
  type ChatBotPlatform,
} from '@/hooks/useUserChatBot';
import {
  useUserIntegrations,
  unlinkUserIntegration,
  startSupabaseOAuth,
} from '@/hooks/useUserIntegrations';

import { ArrowLeft, Loader2, Bot, ExternalLink } from 'lucide-react';

import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function AIConnect() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const addTarget = searchParams.get('add');
  const addReturn = searchParams.get('return') || (addTarget ? `/ai-assistant/connect/${addTarget}/settings` : '/ai-assistant/connect');
  const addStarted = useRef(false);
  const { user, profile, signInWithLinkedIn, signInWithTwitter, signInWithGitHub, signInWithGitLab, updateProfile } = useAuth();
  const {
    connection: ytConnection,
    checking: ytChecking,
    connecting: ytConnecting,
    connect: ytConnect,
    disconnect: ytDisconnect,
    refreshStatus,
  } = useYouTubeGrowth();

  const [telegramOpen, setTelegramOpen] = useState(false);
  const [botToken, setBotToken] = useState('');
  const [telegramSaving, setTelegramSaving] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);

  // Discord / Slack / Twitch: per-user bot connections (token based, like Telegram).
  const [chatBotOpen, setChatBotOpen] = useState<ChatBotPlatform | null>(null);
  const [chatBotSaving, setChatBotSaving] = useState(false);
  const [chatBotFields, setChatBotFields] = useState({
    token: '',
    clientId: '',
    clientSecret: '',
    userToken: '',
    channelLogin: '',
  });
  const discordBot = useUserChatBot('discord', !!user);
  const slackBot = useUserChatBot('slack', !!user);
  const twitchBot = useUserChatBot('twitch', !!user);
  const chatBotHooks: Record<ChatBotPlatform, ReturnType<typeof useUserChatBot>> = {
    discord: discordBot,
    slack: slackBot,
    twitch: twitchBot,
  };

  const handleChatBotConnect = async () => {
    if (!user || !chatBotOpen) {
      toast.error('Please log in first');
      return;
    }
    setChatBotSaving(true);
    try {
      const res = await linkChatBot(chatBotOpen, {
        token: chatBotFields.token.trim(),
        clientId: chatBotFields.clientId.trim(),
        clientSecret: chatBotFields.clientSecret.trim(),
        userToken: chatBotFields.userToken.trim(),
        channelLogin: chatBotFields.channelLogin.trim(),
      });
      toast.success(`Bot connected: ${res?.botName || res?.botUsername || 'bot'}`);
      setChatBotOpen(null);
      setChatBotFields({ token: '', clientId: '', clientSecret: '', userToken: '', channelLogin: '' });
      chatBotHooks[chatBotOpen].refresh();
    } catch (e: any) {
      toast.error(e?.message || 'Bot connect failed');
    }
    setChatBotSaving(false);
  };

  const handleChatBotDisconnect = async (platform: ChatBotPlatform) => {
    try {
      await unlinkChatBot(platform);
      toast.success('Bot disconnected');
      chatBotHooks[platform].refresh();
    } catch (e: any) {
      toast.error(e?.message || 'Disconnect failed');
    }
  };

  const {
    status: botStatus,
    loading: botLoading,
    refresh: refreshBot,
  } = useUserTelegramBot(!!user);

  const {
    connections: socialConnections,
    get: getSocial,
    loading: socialLoading,
    refresh: refreshSocial,
  } = useSocialConnections(!!user);
  const xConn = getSocial('x');
  const liConn = getSocial('linkedin');
  const ghConn = getSocial('github');
  const glConn = getSocial('gitlab');
  const bitbucketConn = getSocial('bitbucket');
  const figmaConn = getSocial('figma');
  const notionConn = getSocial('notion');
  const spotifyConn = getSocial('spotify');
  const azureConn = getSocial('azure');
  const discordConn = getSocial('discord');
  const twitchConn = getSocial('twitch');
  const slackConn = getSocial('slack');

  const {
    get: getIntegration,
    loading: integrationsLoading,
    refresh: refreshIntegrations,
  } = useUserIntegrations(!!user);
  const supabaseIntegration = getIntegration('supabase');

  const [supabaseBusy, setSupabaseBusy] = useState(false);

  /** Official Supabase OAuth: opens the Supabase login/consent screen. */
  const handleSupabaseConnect = async () => {
    if (!user) {
      toast.error('Please log in first');
      return;
    }
    setSupabaseBusy(true);
    try {
      await startSupabaseOAuth();
    } catch (e: any) {
      toast.error(e?.message || 'Could not start Supabase authorization');
      setSupabaseBusy(false);
    }
  };

  const handleIntegrationDisconnect = async (provider: 'supabase') => {
    try {
      await unlinkUserIntegration(provider);
      toast.success('Disconnected');
      refreshIntegrations();
    } catch (e: any) {
      toast.error(e?.message || 'Disconnect failed');
    }
  };


  const [disconnectTarget, setDisconnectTarget] = useState<SocialPlatform | null>(null);
  const disconnectOne = async (platform: SocialPlatform, accountId: string | null) => {
    try {
      await disconnectSocialAccount(platform, accountId);
      toast.success('Disconnected');
      await refreshSocial();
    } catch (e: any) {
      toast.error(e?.message || 'Disconnect failed');
    }
  };
  // With several accounts, let the user pick which one to disconnect.
  const handleSocialDisconnect = async (platform: SocialPlatform) => {
    const list = socialConnections.filter((c) => c.platform === platform);
    if (list.length > 1) { setDisconnectTarget(platform); return; }
    await disconnectOne(platform, list[0]?.accountId ?? null);
  };


  const handleYouTubeConnect = async () => {
    if (!user) {
      toast.error('Please log in first');
      return;
    }
    await ytConnect();
  };

  const handleLinkedInConnect = async () => {
    if (!user) {
      toast.error('Please log in first');
      return;
    }
    setOauthLoading('linkedin');
    const { error } = await signInWithLinkedIn('/ai-assistant/connect');
    if (error) {
      toast.error(error.message || 'LinkedIn connect failed');
    }
    setOauthLoading(null);
  };

  const handleTwitterConnect = async () => {
    if (!user) {
      toast.error('Please log in first');
      return;
    }
    setOauthLoading('twitter');
    const { error } = await signInWithTwitter('/ai-assistant/connect');
    if (error) {
      toast.error(error.message || 'X connect failed');
    }
    setOauthLoading(null);
  };

  const handleGitConnect = async (platform: 'github' | 'gitlab') => {
    if (!user) {
      toast.error('Please log in first');
      return;
    }
    setOauthLoading(platform);
    const { error } =
      platform === 'github'
        ? await signInWithGitHub('/ai-assistant/connect')
        : await signInWithGitLab('/ai-assistant/connect');
    if (error) {
      toast.error((error as any)?.message || `${platform} connect failed`);
    }
    setOauthLoading(null);
  };

  const handleGenericConnect = async (platform: SocialOAuthPlatform) => {
    if (!user) {
      toast.error('Please log in first');
      return;
    }
    setOauthLoading(platform);
    const { error } = await startSocialOAuth(platform, '/ai-assistant/connect');
    if (error) {
      toast.error((error as any)?.message || `${platform} connect failed`);
    }
    setOauthLoading(null);
  };

  const handleBotConnect = async () => {
    if (!user) {
      toast.error('Please log in first');
      return;
    }
    const token = botToken.trim();
    if (!/^\d{6,}:[\w-]{20,}$/.test(token)) {
      toast.error('That bot token looks invalid. Paste the token you copied from BotFather.');
      return;
    }
    setTelegramSaving(true);
    try {
      const res = await linkUserBot(token);
      toast.success(`Bot connected: @${res?.botUsername || 'bot'}`);
      setBotToken('');
      setTelegramOpen(false);
      refreshBot();
      navigate(addReturn, { replace: true });
    } catch (e: any) {
      toast.error(e?.message || 'Bot connect failed');
    }
    setTelegramSaving(false);
  };

  const handleBotDisconnect = async () => {
    setTelegramSaving(true);
    try {
      await unlinkUserBot();
      toast.success('Telegram bot disconnected');
      refreshBot();
    } catch (e: any) {
      toast.error(e?.message || 'Disconnect failed');
    }
    setTelegramSaving(false);
  };

  useEffect(() => {
    if (!user || !addTarget || addStarted.current) return;
    addStarted.current = true;
    if (addTarget === 'telegram') { setTelegramOpen(true); return; }
    // Mailboxes are added from their own settings page (a popup needs a tap there).
    if (addTarget === 'gmail' || addTarget === 'outlook') { navigate(`/ai-assistant/connect/${addTarget}/settings`, { replace: true }); return; }
    if (addTarget === 'youtube') { void handleYouTubeConnect(); return; }
    if (addTarget === 'linkedin') { void signInWithLinkedIn(addReturn); return; }
    if (addTarget === 'x') { void signInWithTwitter(addReturn); return; }
    if (addTarget === 'github') { void signInWithGitHub(addReturn); return; }
    if (addTarget === 'gitlab') { void signInWithGitLab(addReturn); return; }
    if (['discord', 'slack', 'twitch'].includes(addTarget)) void startSocialOAuth(addTarget as SocialOAuthPlatform, addReturn);
  }, [addReturn, addTarget, signInWithGitHub, signInWithGitLab, signInWithLinkedIn, signInWithTwitter, user]);

  

  return (
    <div className="min-h-screen bg-background">
      <DisconnectAccountPicker
        open={!!disconnectTarget}
        onOpenChange={(v) => !v && setDisconnectTarget(null)}
        label={disconnectTarget ? disconnectTarget.toUpperCase() === 'X' ? 'X' : disconnectTarget[0].toUpperCase() + disconnectTarget.slice(1) : ''}
        accounts={socialConnections.filter((c) => c.platform === disconnectTarget).map((c) => ({
          id: c.accountId ?? '', name: c.accountName || c.channelName || c.accountHandle || c.accountEmail || 'Account',
          sub: c.accountHandle ? `@${c.accountHandle.replace(/^@/, '')}` : c.accountEmail, picture: c.accountPicture,
        }))}
        onDisconnect={(id) => disconnectOne(disconnectTarget as SocialPlatform, id)}
      />
      <Helmet>
        <title>AI Connect | Workly India</title>
        <meta
          name="description"
          content="Connect your YouTube, X, LinkedIn and Telegram accounts with AI."
        />
      </Helmet>

      {/* Mobile-friendly sticky header */}
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-2 px-3 py-2.5 safe-top">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => goBack(navigate, '/ai-assistant')}
            className="h-9 w-9 shrink-0"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-semibold truncate">AI Connect</h1>
            <p className="text-[11px] text-muted-foreground truncate">
              Link your social accounts
            </p>
          </div>
        </div>
      </header>

      <main className="px-3 py-4 sm:px-4 sm:py-6 max-w-2xl mx-auto">
        {!user && (
          <Card className="mb-4 border-dashed border-border bg-muted/30">
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground">
                Log in to connect your accounts with AI features.
              </p>
              <Button
                size="sm"
                className="mt-3"
                onClick={() => navigate('/auth?redirect=/ai-assistant/connect')}
              >
                Log in / Sign up
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3 sm:space-y-4">
          <PlatformCard
            name="YouTube"
            description="Connect your channel to get AI-powered analytics, reply suggestions and content ideas."
            logo={<YouTubeLogo size={28} />}
            connected={!!ytConnection}
            connectedLabel={ytConnection?.channelTitle || 'Connected'}
            onConnect={handleYouTubeConnect}
            onDisconnect={ytDisconnect}
            onSettings={() => navigate('/ai-assistant/connect/youtube/settings')}
            loading={ytChecking || ytConnecting}
            brandColor="#FF0000"
          />

          <PlatformCard
            name="LinkedIn"
            description="Sync your LinkedIn profile so AI can personalize your professional outreach."
            logo={<LinkedInLogo size={28} />}
            connected={!!liConn}
            connectedLabel={liConn?.accountName || 'Connected'}
            onConnect={handleLinkedInConnect}
            onDisconnect={liConn ? () => handleSocialDisconnect('linkedin') : undefined}
            onSettings={() => navigate('/ai-assistant/connect/linkedin/settings')}
            loading={oauthLoading === 'linkedin' || socialLoading}
            brandColor="#0A66C2"
          />

          <PlatformCard
            name="X (Twitter)"
            description="Connect X to let AI analyze your posts and suggest trending content."
            logo={<XLogo size={28} className="text-foreground" />}
            connected={!!xConn}
            connectedLabel={xConn?.accountHandle ? `@${xConn.accountHandle}` : 'Connected'}
            onConnect={handleTwitterConnect}
            onDisconnect={xConn ? () => handleSocialDisconnect('x') : undefined}
            onSettings={() => navigate('/ai-assistant/connect/x/settings')}
            loading={oauthLoading === 'twitter' || socialLoading}
            brandColor="#000000"
          />

          <PlatformCard
            name="GitHub"
            description="Connect GitHub so AI can auto reply to new issues and comments on your repositories."
            logo={
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" className="text-foreground" aria-hidden="true">
                <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.06-.72.08-.71.08-.71 1.17.08 1.78 1.2 1.78 1.2 1.04 1.79 2.73 1.27 3.4.97.1-.76.41-1.28.74-1.57-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 015.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.12 3.05.74.8 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.25 5.67.42.36.8 1.08.8 2.18v3.23c0 .31.21.68.8.56A11.51 11.51 0 0023.5 12C23.5 5.73 18.27.5 12 .5z" />
              </svg>
            }
            connected={!!ghConn}
            connectedLabel={ghConn?.accountHandle ? `@${ghConn.accountHandle}` : 'Connected'}
            onConnect={() => handleGitConnect('github')}
            onDisconnect={ghConn ? () => handleSocialDisconnect('github') : undefined}
            onSettings={ghConn ? () => navigate('/ai-assistant/connect/github/settings') : undefined}
            loading={oauthLoading === 'github' || socialLoading}
            brandColor="#181717"
          />

          <PlatformCard
            name="GitLab"
            description="Connect GitLab so AI can auto reply to new issues and comments on your projects."
            logo={
              <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#E24329" d="M12 22.5l3.95-12.16H8.05L12 22.5z" />
                <path fill="#FC6D26" d="M12 22.5L8.05 10.34H2.51L12 22.5z" />
                <path fill="#FCA326" d="M2.51 10.34L1.31 14.03a.82.82 0 00.3.92L12 22.5 2.51 10.34z" />
                <path fill="#E24329" d="M2.51 10.34h5.54L5.67 3a.41.41 0 00-.78 0L2.51 10.34z" />
                <path fill="#FC6D26" d="M12 22.5l3.95-12.16h5.54L12 22.5z" />
                <path fill="#FCA326" d="M21.49 10.34l1.2 3.69a.82.82 0 01-.3.92L12 22.5l9.49-12.16z" />
                <path fill="#E24329" d="M21.49 10.34h-5.54L18.33 3a.41.41 0 01.78 0l2.38 7.34z" />
              </svg>
            }
            connected={!!glConn}
            connectedLabel={glConn?.accountHandle ? `@${glConn.accountHandle}` : 'Connected'}
            onConnect={() => handleGitConnect('gitlab')}
            onDisconnect={glConn ? () => handleSocialDisconnect('gitlab') : undefined}
            onSettings={glConn ? () => navigate('/ai-assistant/connect/gitlab/settings') : undefined}
            loading={oauthLoading === 'gitlab' || socialLoading}
            brandColor="#FC6D26"
          />

                    <PlatformCard
            name="Discord"
            description="Connect Discord so AI can auto reply to messages for your business."
            logo={<DiscordLogo size={28} />}
            connected={discordBot.status.connected}
            connectedLabel={discordBot.status.botUsername ? `@${discordBot.status.botUsername}` : discordConn?.accountName || 'Connected'}
            onConnect={() => handleGenericConnect('discord')}
            onDisconnect={discordBot.status.connected ? () => handleChatBotDisconnect('discord') : discordConn ? () => handleSocialDisconnect('discord') : undefined}
            onSettings={discordBot.status.connected ? () => navigate('/ai-assistant/connect/discord/settings') : undefined}
            loading={discordBot.loading || oauthLoading === 'discord'}
            brandColor="#5865F2"
          />

                              <PlatformCard
            name="Twitch"
            description="Connect Twitch so AI can auto reply to messages for your business."
            logo={<TwitchLogo size={28} />}
            connected={twitchBot.status.connected}
            connectedLabel={twitchBot.status.botUsername ? `@${twitchBot.status.botUsername}` : twitchConn?.accountName || 'Connected'}
            onConnect={() => handleGenericConnect('twitch')}
            onDisconnect={twitchBot.status.connected ? () => handleChatBotDisconnect('twitch') : twitchConn ? () => handleSocialDisconnect('twitch') : undefined}
            onSettings={twitchBot.status.connected || twitchConn ? () => navigate('/ai-assistant/connect/twitch/settings') : undefined}
            loading={twitchBot.loading || oauthLoading === 'twitch'}
            brandColor="#9146FF"
          />

          <PlatformCard
            name="Slack"
            description="Connect Slack so AI can auto reply to messages for your business."
            logo={<SlackLogo size={28} />}
            connected={slackBot.status.connected}
            connectedLabel={slackBot.status.botName || slackConn?.accountName || 'Connected'}
            onConnect={() => handleGenericConnect('slack')}
            onDisconnect={slackBot.status.connected ? () => handleChatBotDisconnect('slack') : slackConn ? () => handleSocialDisconnect('slack') : undefined}
            onSettings={slackBot.status.connected ? () => navigate('/ai-assistant/connect/slack/settings') : undefined}
            loading={slackBot.loading || oauthLoading === 'slack'}
            brandColor="#4A154B"
          />

                                        <PlatformCard
            name="Telegram"
            description="Connect your own Telegram bot — AI will automatically reply to messages sent to that bot."

            logo={<TelegramLogo size={28} />}
            connected={botStatus.connected}
            connectedLabel={botStatus.botUsername ? `@${botStatus.botUsername}` : 'Connected'}
            onConnect={() => setTelegramOpen(true)}
            onDisconnect={botStatus.connected ? handleBotDisconnect : undefined}
            onSettings={() => navigate('/ai-assistant/connect/telegram/settings')}
            loading={telegramSaving || botLoading}
            brandColor="#24A1DE"
          />


          {user && <WhatsAppAIConnectCard />}

          {user && <MetaSocialAIConnectCard platform="facebook" autoConnect={addTarget === 'facebook'} returnTo={addReturn} />}

          {user && <MetaSocialAIConnectCard platform="instagram" autoConnect={addTarget === 'instagram'} returnTo={addReturn} />}


          <GmailAutoReplyCard
            variant="connect"
            onOpenSettings={() => navigate('/ai-assistant/connect/gmail/settings')}
          />


          <OutlookAutoReplyCard
            variant="connect"
            onOpenSettings={() => navigate('/ai-assistant/connect/outlook/settings')}
          />

          <CustomEmailCard
            variant="connect"
            onOpenSettings={() => navigate('/ai-assistant/connect/email/settings')}
          />

          <GoogleBusinessProfileCard enabled={!!user} />
        </div>



        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          Your data is only used to power AI features. You can disconnect anytime.
        </p>
      </main>

      {/* Telegram bot token dialog */}
      <Dialog open={telegramOpen} onOpenChange={setTelegramOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TelegramLogo size={22} />
              Connect your Telegram bot
            </DialogTitle>
            <DialogDescription>
              Enter your bot token. AI will automatically reply to every message that
              bot receives, based on your business details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <ol className="space-y-1.5 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground list-decimal list-inside">
              <li>
                Open{' '}
                <a
                  href="https://t.me/BotFather"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                >
                  @BotFather <ExternalLink className="h-3 w-3" />
                </a>{' '}
                on Telegram
              </li>
              <li>Send <code>/newbot</code> and choose a name + username</li>
              <li>Paste the token you receive (like <code>123456:ABC-DEF...</code>) below</li>
            </ol>
            <div className="space-y-2">
              <Label htmlFor="telegram-bot-token">Bot token</Label>
              <Input
                id="telegram-bot-token"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value.trim())}
                placeholder="123456789:AAExxxxxxxxxxxxxxxxxxxxxxxxxx"
                autoComplete="off"
                spellCheck={false}
              />
              <p className="text-[11px] text-muted-foreground">
                Your token is stored encrypted and is never shown in the browser.
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setTelegramOpen(false)}
                disabled={telegramSaving}
              >
                Cancel
              </Button>
              <Button
                onClick={handleBotConnect}
                disabled={telegramSaving || !botToken.trim()}
                className="bg-[#24A1DE] text-white hover:bg-[#1d8ac2]"
              >
                {telegramSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Bot className="h-4 w-4 mr-2" />
                )}
                Connect bot
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Discord / Slack / Twitch bot connect dialog */}
      <Dialog open={!!chatBotOpen} onOpenChange={(o) => !o && setChatBotOpen(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {chatBotOpen === 'discord' && <DiscordLogo size={22} />}
              {chatBotOpen === 'slack' && <SlackLogo size={22} />}
              {chatBotOpen === 'twitch' && <TwitchLogo size={22} />}
              Connect your {chatBotOpen === 'discord' ? 'Discord' : chatBotOpen === 'slack' ? 'Slack' : 'Twitch'} bot
            </DialogTitle>
            <DialogDescription>
              {chatBotOpen === 'discord' &&
                'AI will auto-reply when someone @mentions your bot in your server.'}
              {chatBotOpen === 'slack' &&
                'AI will auto-reply to DMs and @mentions sent to your Slack bot.'}
              {chatBotOpen === 'twitch' &&
                'AI will auto-reply to chat messages on your Twitch channel.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {chatBotOpen === 'discord' && (
              <ol className="space-y-1.5 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground list-decimal list-inside">
                <li>
                  Open{' '}
                  <a
                    href="https://discord.com/developers/applications"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                  >
                    Discord Developer Portal <ExternalLink className="h-3 w-3" />
                  </a>{' '}
                  and create an application
                </li>
                <li>Go to <code>Bot</code> → copy the bot token</li>
                <li>Invite the bot to your server (OAuth2 → URL Generator → bot scope)</li>
                <li>Paste the token below</li>
              </ol>
            )}
            {chatBotOpen === 'slack' && (
              <ol className="space-y-1.5 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground list-decimal list-inside">
                <li>
                  Open{' '}
                  <a
                    href="https://api.slack.com/apps"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                  >
                    api.slack.com/apps <ExternalLink className="h-3 w-3" />
                  </a>{' '}
                  and create an app
                </li>
                <li>Add bot scopes: <code>app_mentions:read</code>, <code>chat:write</code>, <code>im:history</code>, <code>im:read</code>, <code>users:read</code></li>
                <li>Install the app to your workspace and copy the <code>xoxb-</code> token</li>
                <li>After connecting, paste the webhook URL shown in Settings into Event Subscriptions (enable <code>app_mention</code> and <code>message.im</code>)</li>
              </ol>
            )}
            {chatBotOpen === 'twitch' && (
              <ol className="space-y-1.5 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground list-decimal list-inside">
                <li>
                  Register an app on{' '}
                  <a
                    href="https://dev.twitch.tv/console/apps"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                  >
                    dev.twitch.tv/console <ExternalLink className="h-3 w-3" />
                  </a>{' '}
                  → note the Client ID and Secret
                </li>
                <li>Generate a user access token for your bot account with <code>user:read:chat</code>, <code>user:write:chat</code>, <code>user:bot</code> scopes</li>
                <li>Make the bot a moderator of your channel (<code>/mod yourbot</code>)</li>
                <li>Fill all four fields below</li>
              </ol>
            )}

            {(chatBotOpen === 'discord' || chatBotOpen === 'slack') && (
              <div className="space-y-2">
                <Label htmlFor="chatbot-token">Bot token</Label>
                <Input
                  id="chatbot-token"
                  value={chatBotFields.token}
                  onChange={(e) => setChatBotFields((f) => ({ ...f, token: e.target.value }))}
                  placeholder={chatBotOpen === 'slack' ? 'xoxb-...' : 'Discord bot token'}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            )}

            {chatBotOpen === 'twitch' && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="tw-client-id">Client ID</Label>
                  <Input
                    id="tw-client-id"
                    value={chatBotFields.clientId}
                    onChange={(e) => setChatBotFields((f) => ({ ...f, clientId: e.target.value }))}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tw-client-secret">Client Secret</Label>
                  <Input
                    id="tw-client-secret"
                    value={chatBotFields.clientSecret}
                    onChange={(e) => setChatBotFields((f) => ({ ...f, clientSecret: e.target.value }))}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tw-user-token">Bot user access token</Label>
                  <Input
                    id="tw-user-token"
                    value={chatBotFields.userToken}
                    onChange={(e) => setChatBotFields((f) => ({ ...f, userToken: e.target.value }))}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tw-channel">Your channel name</Label>
                  <Input
                    id="tw-channel"
                    value={chatBotFields.channelLogin}
                    onChange={(e) => setChatBotFields((f) => ({ ...f, channelLogin: e.target.value }))}
                    placeholder="e.g. worklyindia"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
              </div>
            )}

            <p className="text-[11px] text-muted-foreground">
              Your credentials are stored encrypted and are never shown in the browser.
            </p>

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setChatBotOpen(null)}
                disabled={chatBotSaving}
              >
                Cancel
              </Button>
              <Button
                onClick={handleChatBotConnect}
                disabled={
                  chatBotSaving ||
                  (chatBotOpen !== 'twitch' && !chatBotFields.token.trim()) ||
                  (chatBotOpen === 'twitch' &&
                    (!chatBotFields.clientId.trim() ||
                      !chatBotFields.clientSecret.trim() ||
                      !chatBotFields.userToken.trim() ||
                      !chatBotFields.channelLogin.trim()))
                }
              >
                {chatBotSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Bot className="h-4 w-4 mr-2" />
                )}
                Connect bot
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

