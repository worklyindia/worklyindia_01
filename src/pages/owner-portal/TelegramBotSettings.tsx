import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Bot, Save } from 'lucide-react';

type Audience = 'job_seeker' | 'employer';

const AUDIENCE_LABEL: Record<Audience, string> = {
  job_seeker: 'Job seekers bot',
  employer: 'Employers bot',
};

interface BotSetting {
  bot_token: string;
  bot_username: string;
}

const EMPTY_BOTS: Record<Audience, BotSetting> = {
  job_seeker: { bot_token: '', bot_username: '' },
  employer: { bot_token: '', bot_username: '' },
};

export default function TelegramBotSettings() {
  const navigate = useNavigate();
  const [bots, setBots] = useState<Record<Audience, BotSetting>>(EMPTY_BOTS);
  const [channelUsername, setChannelUsername] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('telegram_audience_bots' as any).select('*');
    if (error) {
      console.error('Telegram bot settings load failed:', error);
      toast.error('Bot settings could not be loaded. Please refresh the page.');
      setLoading(false);
      return;
    }
    const next = { job_seeker: { ...EMPTY_BOTS.job_seeker }, employer: { ...EMPTY_BOTS.employer } };
    let channel = '';
    (data || []).forEach((row: any) => {
      if (row.audience === 'job_seeker' || row.audience === 'employer') {
        next[row.audience as Audience] = {
          bot_token: row.bot_token || '',
          bot_username: row.bot_username || '',
        };
      }
      if (row.audience === 'employer' && row.channel_username) channel = row.channel_username;
    });
    setBots(next);
    setChannelUsername(channel);
    setLoading(false);
  };

  /** Token save karte hi username nikalta hai aur webhook bhi set kar deta hai. */
  const setupBot = async (
    token: string,
    audience: Audience,
  ): Promise<{ username: string | null; webhookSet: boolean }> => {
    if (!token) return { username: null, webhookSet: false };
    try {
      const { data } = await supabase.functions.invoke('email-api/telegram', {
        body: { action: 'bot_setup', token, audience },
      });
      return { username: data?.username || null, webhookSet: !!data?.webhookSet };
    } catch (error) {
      console.error('Bot setup failed:', error);
      return { username: null, webhookSet: false };
    }
  };

  const save = async () => {
    setSaving(true);
    const failedHooks: Audience[] = [];
    const rows = await Promise.all(
      (Object.keys(bots) as Audience[]).map(async (key) => {
        const token = bots[key].bot_token.trim();
        let username = '';
        if (token) {
          const res = await setupBot(token, key);
          username = res.username ?? bots[key].bot_username;
          if (!res.webhookSet) failedHooks.push(key);
        }
        return {
          audience: key,
          bot_token: token || null,
          bot_username: username || null,
          channel_username:
            key === 'employer' ? channelUsername.trim().replace(/^@/, '') || null : null,
          updated_at: new Date().toISOString(),
        };
      }),
    );

    const { error } = await supabase
      .from('telegram_audience_bots' as any)
      .upsert(rows as any, { onConflict: 'audience' });
    setSaving(false);

    if (error) {
      console.error('Telegram bot settings save failed:', error);
      toast.error('Bot settings could not be saved. Please try again.');
      return;
    }
    if (failedHooks.length) {
      toast.warning(
        `Saved, lekin webhook set nahi hua: ${failedHooks.map((k) => AUDIENCE_LABEL[k]).join(', ')}`,
      );
    } else {
      toast.success('Bot settings saved aur webhook set ho gaya.');
    }
    void load();
  };

  return (
    <div className="container max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/owner-portal/telegram-templates')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Telegram bots</h1>
          <p className="text-sm text-muted-foreground">
            Job seekers aur employers ke liye alag bot token add kijiye. Token save karte hi bot ka
            username apne aap aa jayega.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <div className="space-y-6">
          {(Object.keys(bots) as Audience[]).map((key) => (
            <Card key={key}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Bot className="w-5 h-5 text-primary" />
                  {AUDIENCE_LABEL[key]}
                </CardTitle>
                <CardDescription>
                  {key === 'job_seeker'
                    ? 'Job seekers ke saare messages is bot se jayenge.'
                    : 'Employers ke messages aur channel job post is bot se jayenge.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Bot API token</Label>
                  <Input
                    value={bots[key].bot_token}
                    placeholder="123456789:AAExampleTokenFromBotFather"
                    onChange={(e) =>
                      setBots((prev) => ({ ...prev, [key]: { ...prev[key], bot_token: e.target.value } }))
                    }
                  />
                </div>

                {bots[key].bot_username && (
                  <div className="rounded-lg border p-3">
                    <p className="text-sm font-medium">Bot username</p>
                    <p className="text-sm text-muted-foreground">@{bots[key].bot_username}</p>
                  </div>
                )}


                {key === 'employer' && (
                  <div className="space-y-2">
                    <Label>Telegram channel username</Label>
                    <Input
                      value={channelUsername}
                      placeholder="worklyindia_jobs"
                      onChange={(e) => setChannelUsername(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Save karte hi naye job posts isi channel me employers bot se jayenge. Bot ko
                      channel me admin banana zaroori hai.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          <Button onClick={save} disabled={saving} className="w-full">
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save bot settings'}
          </Button>
        </div>
      )}
    </div>
  );
}
