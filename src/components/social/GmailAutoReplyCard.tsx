import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CheckCircle2,
  Loader2,
  Mail,
  Save,
  Settings as SettingsIcon,
  Unlink,
} from 'lucide-react';
import { toast } from 'sonner';
import ConfirmDisconnectDialog from '@/components/social/ConfirmDisconnectDialog';
import PlatformCard from '@/components/social/PlatformCard';
import {
  connectGmail,
  disconnectGmail,
  getGmailReplies,
  getGmailSettings,
  saveGmailSettings,
  useUserGmail,
  type GmailReplyLogItem,
  type GmailSettings,
} from '@/hooks/useUserGmail';


const DEFAULTS: GmailSettings = {
  enabled: false,
  tone: 'professional',
  language: 'auto',
  business_info: '',
  custom_instructions: '',
  signature: '',
  max_replies_per_run: 5,
  only_unread: true,
  skip_promotions: true,
  reply_scope: 'all',
};

interface GmailAutoReplyCardProps {
  /** "connect" shows only the connect/disconnect row, "settings" shows the full settings form. */
  variant?: 'connect' | 'settings' | 'full';
  onOpenSettings?: () => void;
}

export default function GmailAutoReplyCard({
  variant = 'full',
  onOpenSettings,
}: GmailAutoReplyCardProps) {
  const { status, loading, refresh } = useUserGmail();
  const [settings, setSettings] = useState<GmailSettings>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [log, setLog] = useState<GmailReplyLogItem[]>([]);
  const [logOpen, setLogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);


  const loadSettings = useCallback(async () => {
    if (!status.connected) return;
    try {
      const res = await getGmailSettings();
      setSettings({ ...DEFAULTS, ...(res?.settings || {}) });
    } catch {
      /* keep defaults */
    }
  }, [status.connected]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const patch = (p: Partial<GmailSettings>) => setSettings((s) => ({ ...s, ...p }));

  const persist = async (p: Partial<GmailSettings>) => {
    setSaving(true);
    try {
      const res = await saveGmailSettings({ ...settings, ...p });
      setSettings({ ...DEFAULTS, ...(res?.settings || {}) });
      toast.success('Gmail settings saved');
    } catch (e: any) {
      toast.error(e?.message || 'Could not save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      await connectGmail();
      toast.success('Gmail connected');
      await refresh();
      await loadSettings();
    } catch (e: any) {
      toast.error(e?.message || 'Gmail connection failed');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectGmail();
      toast.success('Gmail disconnected');
      await refresh();
    } catch (e: any) {
      toast.error(e?.message || 'Could not disconnect');
    }
  };

  const showSettings = variant !== 'connect';
  const showConnectRow = variant !== 'settings';

  // On the AI Connect list every integration uses the exact same card layout.
  if (variant === 'connect') {
    return (
      <PlatformCard
        name="Gmail"
        description="Connect your own Gmail account — AI will automatically draft and send replies to emails you receive."
        logo={<Mail size={28} className="h-7 w-7 text-[#EA4335]" />}
        connected={status.connected}
        connectedLabel="Connected"
        subLabel={status.accountEmail || 'Your Gmail account'}
        onConnect={handleConnect}
        onDisconnect={status.connected ? handleDisconnect : undefined}
        onSettings={onOpenSettings}
        loading={loading || connecting}
        brandColor="#EA4335"
      >
        {!status.connected && status.clientConfigured === false && (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-500">
            Google sign-in is not configured yet. An admin needs to add the Google OAuth client ID and
            secret in Supabase before Gmail can be connected.
          </p>
        )}
      </PlatformCard>
    );
  }

  return (
    <Card className="border-border/60 bg-card shadow-sm">
      <CardContent className="p-4 sm:p-5 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-9 w-9 rounded-lg bg-[#EA4335]/10 flex items-center justify-center shrink-0">
              <Mail className="h-4.5 w-4.5 text-[#EA4335]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-semibold flex items-center gap-2">
                Gmail
                {status.connected && (
                  <Badge variant="secondary" className="h-5 text-[10px] gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Connected
                  </Badge>
                )}
              </h3>
              {status.connected && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {status.accountEmail || 'Your Gmail account'}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-0.5">
                Connect your own Gmail account — AI will automatically draft and send replies to emails you receive.
              </p>

            </div>
          </div>
          {!showConnectRow ? null : loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : status.connected ? (
            <div className="flex items-center gap-2">
              {onOpenSettings && (
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onOpenSettings}>
                  <SettingsIcon className="h-3.5 w-3.5 mr-1.5" />
                  Settings
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs text-destructive hover:text-destructive"
                onClick={() => setConfirmOpen(true)}
              >
                <Unlink className="h-3.5 w-3.5 mr-1.5" />
                Disconnect
              </Button>
            </div>
          ) : (
            <Button size="sm" className="h-8 text-xs" disabled={connecting} onClick={handleConnect}>
              {connecting ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Mail className="h-3.5 w-3.5 mr-1.5" />
              )}
              Connect Gmail
            </Button>
          )}
        </div>

        {!status.connected && status.clientConfigured === false && (
          <p className="text-xs text-amber-600 dark:text-amber-500">
            Google sign-in is not configured yet. An admin needs to add the Google OAuth client ID and
            secret in Supabase before Gmail can be connected.
          </p>
        )}

        {status.connected && showSettings && (
          <>
            <div className="flex items-center justify-between gap-3 pt-1 border-t border-border/60">
              <div>
                <Label className="text-xs font-medium">AI Auto-Reply</Label>
                <p className="text-[11px] text-muted-foreground">
                  New emails will get an automatic AI reply.
                </p>
              </div>
              <Switch
                checked={settings.enabled}
                disabled={saving}
                onCheckedChange={(v) => {
                  patch({ enabled: v });
                  persist({ enabled: v });
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Tone</Label>
                <Select value={settings.tone} onValueChange={(v) => patch({ tone: v })}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="friendly">Friendly</SelectItem>
                    <SelectItem value="concise">Concise</SelectItem>
                    <SelectItem value="supportive">Supportive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Language</Label>
                <Select value={settings.language} onValueChange={(v) => patch({ language: v })}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto (same as sender)</SelectItem>
                    <SelectItem value="Hindi">Hindi</SelectItem>
                    <SelectItem value="Hinglish">Hinglish</SelectItem>
                    <SelectItem value="English">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Business info</Label>
              <Textarea
                rows={4}
                className="text-sm"
                  placeholder="Business name, services, timings, pricing, common answers…"
                value={settings.business_info}
                onChange={(e) => patch({ business_info: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Custom instructions (optional)</Label>
              <Textarea
                rows={2}
                className="text-sm"
                value={settings.custom_instructions}
                onChange={(e) => patch({ custom_instructions: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Email signature</Label>
              <Input
                className="h-9 text-sm"
                placeholder="Regards, Your Name"
                value={settings.signature}
                onChange={(e) => patch({ signature: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Max replies per run</Label>
                <Input
                  type="number"
                  min={1}
                  max={25}
                  className="h-9 text-sm"
                  value={settings.max_replies_per_run}
                  onChange={(e) => patch({ max_replies_per_run: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <Label className="text-xs">Only unread emails</Label>
              <Switch
                checked={settings.only_unread}
                onCheckedChange={(v) => patch({ only_unread: v })}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label className="text-xs">Skip promotions / spam</Label>
              <Switch
                checked={settings.skip_promotions}
                onCheckedChange={(v) => patch({ skip_promotions: v })}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="text-xs">Reply to Gmail senders only</Label>
                <p className="text-[10px] text-muted-foreground">
                  Off = auto reply to every real sender (recommended)
                </p>
              </div>
              <Switch
                checked={settings.reply_scope === 'gmail_only'}
                onCheckedChange={(v) => patch({ reply_scope: v ? 'gmail_only' : 'all' })}
              />
            </div>



            <div>
              <Button className="h-11 w-full" disabled={saving} onClick={() => persist({})}>
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                )}
                Save
              </Button>
            </div>

            {logOpen && (
              <div className="rounded-lg border border-border/60 divide-y">
                {log.length === 0 && (
                  <p className="p-3 text-xs text-muted-foreground">No AI replies yet.</p>
                )}
                {log.map((item) => (
                  <div key={item.id} className="p-3 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium truncate">{item.from_email}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {new Date(item.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1">{item.subject}</p>
                    <p className="text-xs line-clamp-3">{item.reply_text || `— ${item.status}`}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>

      <ConfirmDisconnectDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        platform="Gmail"
        account={status.accountEmail}
        onConfirm={handleDisconnect}
      />
    </Card>

  );
}
