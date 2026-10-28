import { useState } from 'react';
import { Bot, Loader2, KeyRound, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { setupSocialBot, type SocialPlatform } from '@/hooks/useSocialConnect';

interface Props {
  platform: SocialPlatform;
  label: string;
  brandColor: string;
  /** Already-saved channel name, if any */
  channelName?: string | null;
  onSaved: () => void;
}

const HELP: Record<string, { token: string; channel: string; secret?: string }> = {
  twitch: {
    token: 'dev.twitch.tv/console → apni App ka Client ID use karke user access token banao (scopes: user:read:chat user:write:chat user:bot channel:bot). Isi account se bot reply karega.',
    channel: 'Jis Twitch channel ki chat par reply karna hai uska naam (jaise: mychannel).',
    secret: 'dev.twitch.tv/console → Applications → Manage → Client Secret (token wali app ka hi).',
  },
  discord: {
    token: 'Discord Developer Portal → Your App → Bot → Token. Bot ko apne server mein invite karo (Send Messages permission ke saath).',
    channel: 'Discord mein channel par right-click → Copy Channel ID (Developer Mode on hona chahiye).',
  },
  slack: {
    token: 'api.slack.com/apps → Your App → OAuth & Permissions → Bot User OAuth Token (xoxb-...). Scopes: channels:read, channels:history, chat:write, users:read. Bot ko channel mein /invite karo.',
    channel: 'Slack mein channel par click → About → neeche Channel ID.',
  },
};

export default function SocialBotSetupCard({ platform, label, brandColor, channelName, onSaved }: Props) {
  const [token, setToken] = useState('');
  const [channelId, setChannelId] = useState('');
  const [secret, setSecret] = useState('');
  const isTwitch = platform === 'twitch';
  const [saving, setSaving] = useState(false);
  const help = HELP[platform] || HELP.discord;

  const save = async () => {
    if (!token.trim() || !channelId.trim() || (isTwitch && !secret.trim())) {
      toast.error(isTwitch ? 'Token, channel name aur Client Secret daalo' : 'Bot token aur Channel ID dono daalo');
      return;
    }
    setSaving(true);
    try {
      const res = await setupSocialBot(platform, token.trim(), channelId.trim(), isTwitch ? secret.trim() : undefined);
      toast.success(`${label} bot connected${res?.channelName ? ` — ${res.channelName}` : ''}`);
      setToken('');
      setChannelId('');
      setSecret('');
      onSaved();
    } catch (e: any) {
      toast.error(e?.message || 'Bot connect nahi ho paya');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div
            className="h-8 w-8 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${brandColor}1a` }}
          >
            <Bot className="h-4 w-4" style={{ color: brandColor }} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{label} bot setup</p>
            <p className="text-[11px] text-muted-foreground">
              {channelName ? `Connected to ${channelName} — change karna ho to neeche naya daalo` : (isTwitch ? 'Auto-reply ke liye token, channel aur Client Secret chahiye' : 'Auto-reply ke liye bot token + channel ID chahiye')}
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1"><KeyRound className="h-3 w-3" /> {isTwitch ? 'User access token' : 'Bot token'}</Label>
          <Input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={platform === 'slack' ? 'xoxb-...' : isTwitch ? 'Twitch access token' : 'Discord bot token'}
            autoComplete="off"
          />
          <p className="text-[11px] text-muted-foreground">{help.token}</p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1"><Hash className="h-3 w-3" /> {isTwitch ? 'Channel name' : 'Channel ID'}</Label>
          <Input
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
            placeholder={isTwitch ? 'channel name' : 'Channel ID'}
            autoComplete="off"
          />
          <p className="text-[11px] text-muted-foreground">{help.channel}</p>
        </div>

        {isTwitch && (
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1"><KeyRound className="h-3 w-3" /> Client Secret</Label>
            <Input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="Client Secret" autoComplete="off" />
            <p className="text-[11px] text-muted-foreground">{help.secret}</p>
          </div>
        )}

        <Button size="sm" className="w-full" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save bot'}
        </Button>
      </CardContent>
    </Card>
  );
}
