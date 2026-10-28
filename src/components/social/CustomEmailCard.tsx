import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AtSign,
  CheckCircle2,
  Link2,
  Loader2,
  Save,
  Settings as SettingsIcon,
  Unlink,
} from 'lucide-react';
import { toast } from 'sonner';
import ConfirmDisconnectDialog from '@/components/social/ConfirmDisconnectDialog';
import PlatformCard from '@/components/social/PlatformCard';
import {
  MAIL_PROVIDER_PRESETS,
  connectCustomEmail,
  disconnectCustomEmail,
  getCustomEmailReplies,
  saveCustomEmailSettings,
  useUserCustomEmail,
  type CustomEmailReplyLogItem,
  type CustomEmailSettings,
} from '@/hooks/useUserCustomEmail';

const DEFAULTS: CustomEmailSettings = {
  enabled: false,
  tone: 'professional',
  language: 'auto',
  business_info: '',
  custom_instructions: '',
  signature: '',
  max_replies_per_run: 5,
  only_unread: true,
  skip_promotions: true,
};

interface CustomEmailCardProps {
  variant?: 'connect' | 'settings' | 'full';
  onOpenSettings?: () => void;
}

export default function CustomEmailCard({
  variant = 'full',
  onOpenSettings,
}: CustomEmailCardProps) {
  const { status, loading, refresh } = useUserCustomEmail();
  const [settings, setSettings] = useState<CustomEmailSettings>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [log, setLog] = useState<CustomEmailReplyLogItem[]>([]);
  const [logOpen, setLogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // connect dialog state
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState('workspace');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [imapHost, setImapHost] = useState(MAIL_PROVIDER_PRESETS.workspace.imapHost);
  const [imapPort, setImapPort] = useState(993);
  const [smtpHost, setSmtpHost] = useState(MAIL_PROVIDER_PRESETS.workspace.smtpHost);
  const [smtpPort, setSmtpPort] = useState(465);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (status.settings) setSettings({ ...DEFAULTS, ...status.settings });
  }, [status.settings]);

  const applyProvider = (key: string) => {
    setProvider(key);
    const p = MAIL_PROVIDER_PRESETS[key];
    if (!p) return;
    setImapHost(p.imapHost);
    setImapPort(p.imapPort);
    setSmtpHost(p.smtpHost);
    setSmtpPort(p.smtpPort);
  };

  const patch = (p: Partial<CustomEmailSettings>) => setSettings((s) => ({ ...s, ...p }));

  const persist = async (p: Partial<CustomEmailSettings>) => {
    setSaving(true);
    try {
      const res = await saveCustomEmailSettings({ ...settings, ...p });
      setSettings({ ...DEFAULTS, ...(res?.settings || {}) });
      toast.success('Email settings saved');
    } catch (e: any) {
      toast.error(e?.message || 'Could not save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      await connectCustomEmail({ email, password, imapHost, imapPort, smtpHost, smtpPort });
      toast.success('Mailbox connected');
      setOpen(false);
      setPassword('');
      await refresh();
    } catch (e: any) {
      toast.error(e?.message || 'Could not connect this mailbox');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectCustomEmail();
      toast.success('Mailbox disconnected');
      await refresh();
    } catch (e: any) {
      toast.error(e?.message || 'Could not disconnect');
    }
  };

  const showSettings = variant !== 'connect';
  const showConnectRow = variant !== 'settings';
  const preset = MAIL_PROVIDER_PRESETS[provider];

  const connectDialog = (
    <>
  {/* Connect mailbox dialog */}
  <Dialog open={open} onOpenChange={setOpen}>
    <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <AtSign className="h-5 w-5 text-primary" />
          Connect your domain email
        </DialogTitle>
        <DialogDescription>
          Pick your email provider, then enter your mailbox login. AI will read new emails and
          reply from your own address.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3 pt-1">
        <div className="space-y-1.5">
          <Label className="text-xs">Provider</Label>
          <Select value={provider} onValueChange={applyProvider}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(MAIL_PROVIDER_PRESETS).map(([key, p]) => (
                <SelectItem key={key} value={key}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {preset?.hint && (
            <p className="text-[11px] text-muted-foreground">{preset.hint}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Email address</Label>
          <Input
            className="h-9 text-sm"
            type="email"
            placeholder="you@yourdomain.com"
            value={email}
            onChange={(e) => setEmail(e.target.value.trim())}
            autoComplete="off"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Password / app password</Label>
          <Input
            className="h-9 text-sm"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          <p className="text-[11px] text-muted-foreground">
            Stored encrypted on the server and never shown again.
          </p>
        </div>

        <div className="grid grid-cols-[1fr_84px] gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs">IMAP server</Label>
            <Input
              className="h-9 text-sm"
              placeholder="imap.yourhost.com"
              value={imapHost}
              onChange={(e) => setImapHost(e.target.value.trim())}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Port</Label>
            <Input
              className="h-9 text-sm"
              type="number"
              value={imapPort}
              onChange={(e) => setImapPort(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="grid grid-cols-[1fr_84px] gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs">SMTP server</Label>
            <Input
              className="h-9 text-sm"
              placeholder="smtp.yourhost.com"
              value={smtpHost}
              onChange={(e) => setSmtpHost(e.target.value.trim())}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Port</Label>
            <Input
              className="h-9 text-sm"
              type="number"
              value={smtpPort}
              onChange={(e) => setSmtpPort(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={connecting}>
            Cancel
          </Button>
          <Button
            onClick={handleConnect}
            disabled={connecting || !email || !password || !imapHost || !smtpHost}
          >
            {connecting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Link2 className="h-4 w-4 mr-2" />
            )}
            Connect
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
    </>
  );



  // On the AI Connect list every integration uses the exact same card layout.
  if (variant === 'connect') {
    return (
      <>
        <PlatformCard
          name="Domain Email"
          connectLabel="Connect email"
          description="Google Workspace, Hostinger, GoDaddy, Namecheap, Zoho, cPanel — AI replies from your own domain email."
          logo={<AtSign className="h-7 w-7 text-primary" />}
          connected={status.connected}
          connectedLabel="Connected"
          subLabel={status.accountEmail || 'Your mailbox'}
          onConnect={() => setOpen(true)}
          onDisconnect={status.connected ? handleDisconnect : undefined}
          onSettings={onOpenSettings}
          loading={loading || connecting}
          brandColor="#4F46E5"
        />
        {connectDialog}
      </>
    );
  }

  return (
    <Card className="border-border/60 bg-card shadow-sm">
      <CardContent className="p-4 sm:p-5 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <AtSign className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-semibold flex flex-wrap items-center gap-2">
                Domain Email
                {status.connected && (
                  <Badge variant="secondary" className="h-5 text-[10px] gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Connected
                  </Badge>
                )}
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 break-words">
                {status.connected
                  ? status.accountEmail || 'Your mailbox'
                  : 'Google Workspace, Hostinger, GoDaddy, Namecheap, Zoho, cPanel — AI replies from your own domain email.'}
              </p>
            </div>
          </div>
          {!showConnectRow ? null : loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : status.connected ? (
            <div className="flex w-full items-center gap-2 sm:w-auto sm:shrink-0">
              {onOpenSettings && (
                <Button
                  variant="outline"
                  className="h-11 flex-1 text-sm sm:h-9 sm:flex-none"
                  onClick={onOpenSettings}
                >
                  <SettingsIcon className="h-4 w-4 mr-1.5" />
                  Settings
                </Button>
              )}
              <Button
                variant="ghost"
                className="h-11 flex-1 text-sm text-destructive hover:text-destructive sm:h-9 sm:flex-none"
                onClick={() => setConfirmOpen(true)}
              >
                <Unlink className="h-4 w-4 mr-1.5" />
                Disconnect
              </Button>
            </div>
          ) : (
            <Button
              className="h-11 w-full text-sm sm:h-9 sm:w-auto sm:shrink-0"
              onClick={() => setOpen(true)}
            >
              <Link2 className="h-4 w-4 mr-1.5" />
              Connect email
            </Button>
          )}
        </div>


        {status.connected && showSettings && (
          <>
            <div className="flex items-center justify-between gap-3 pt-1 border-t border-border/60">
              <div>
                <Label className="text-xs font-medium">AI Auto-Reply</Label>
                <p className="text-[11px] text-muted-foreground">
                  New emails in this mailbox get an automatic AI reply.
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
                  max={20}
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
                checked={settings.skip_promotions ?? true}
                onCheckedChange={(v) => patch({ skip_promotions: v })}
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

      {connectDialog}

      <ConfirmDisconnectDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        platform="Email"
        account={status.accountEmail}
        onConfirm={handleDisconnect}
      />
    </Card>
  );
}
