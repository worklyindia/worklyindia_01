import { useConnectionRefresh } from '@/hooks/useConnectionRefresh';
import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Mail, Plug, Trash2 } from 'lucide-react';
import SupportAccountReplySettings from './SupportAccountReplySettings';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { connectGmail, disconnectGmailFor, getGmailStatusFor } from '@/hooks/useUserGmail';
import { connectOutlook, disconnectOutlookFor, getOutlookStatusFor } from '@/hooks/useUserOutlook';
import {
  MAIL_PROVIDER_PRESETS,
  connectCustomEmail,
  disconnectCustomEmail,
  getCustomEmailStatus,
} from '@/hooks/useUserCustomEmail';

export type Scope = 'jobseeker' | 'employer' | 'support';
type Provider = 'custom_email' | 'outlook' | 'gmail';

const PROVIDERS: { id: Provider; label: string; note: string }[] = [
  { id: 'custom_email', label: 'Domain Email', note: 'First choice — your own domain mailbox' },
  { id: 'outlook', label: 'Outlook', note: 'Used when Domain Email is not available' },
  { id: 'gmail', label: 'Gmail', note: 'Used when Outlook is not available' },
];

interface Status {
  connected: boolean;
  accountEmail?: string | null;
  mailboxMissing?: boolean;
}

const statusFor = async (provider: Provider, scope: Scope): Promise<Status> => {
  const res =
    provider === 'gmail'
      ? await getGmailStatusFor(scope)
      : provider === 'outlook'
        ? await getOutlookStatusFor(scope)
        : await getCustomEmailStatus(scope);
  return {
    connected: !!res?.connected,
    accountEmail: res?.accountEmail ?? null,
    mailboxMissing: !!res?.mailboxMissing,
  };
};

export function DomainMailboxDialog({
  open,
  scope,
  onOpenChange,
  onConnected,
}: {
  open: boolean;
  scope: Scope;
  onOpenChange: (v: boolean) => void;
  onConnected: () => void;
}) {
  const { toast } = useToast();
  const [preset, setPreset] = useState('hostinger');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [imapHost, setImapHost] = useState(MAIL_PROVIDER_PRESETS.hostinger.imapHost);
  const [smtpHost, setSmtpHost] = useState(MAIL_PROVIDER_PRESETS.hostinger.smtpHost);
  const [saving, setSaving] = useState(false);

  const applyPreset = (key: string) => {
    setPreset(key);
    const p = MAIL_PROVIDER_PRESETS[key];
    if (!p) return;
    setImapHost(p.imapHost);
    setSmtpHost(p.smtpHost);
  };

  const submit = async () => {
    const p = MAIL_PROVIDER_PRESETS[preset];
    setSaving(true);
    try {
      await connectCustomEmail(
        {
          email: email.trim(),
          password,
          imapHost: imapHost.trim(),
          imapPort: p?.imapPort || 993,
          smtpHost: smtpHost.trim(),
          smtpPort: p?.smtpPort || 465,
        },
        scope,
      );
      toast({ title: 'Domain email connected' });
      onOpenChange(false);
      setPassword('');
      onConnected();
    } catch (e) {
      toast({
        title: 'Could not connect',
        description: e instanceof Error ? e.message : 'Please check the email and password.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Connect domain email</DialogTitle>
          <DialogDescription>
            {scope === 'employer' ? 'Employer' : scope === 'support' ? 'Customer service' : 'Job seeker'} mail will use this mailbox.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Mail provider</Label>
            <Select value={preset} onValueChange={applyPreset}>
              <SelectTrigger>
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
            {MAIL_PROVIDER_PRESETS[preset]?.hint && (
              <p className="text-[11px] text-muted-foreground">{MAIL_PROVIDER_PRESETS[preset].hint}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Email address</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="noreply@yourdomain.com" />
          </div>
          <div className="space-y-1.5">
            <Label>Password / app password</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">IMAP server</Label>
              <Input value={imapHost} onChange={(e) => setImapHost(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">SMTP server</Label>
              <Input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={saving || !email.trim() || !password}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Connect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MailboxCard({
  provider,
  label,
  note,
  scope,
}: {
  provider: Provider;
  label: string;
  note: string;
  scope: Scope;
}) {
  const { toast } = useToast();
  const [status, setStatus] = useState<Status>({ connected: false });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [domainOpen, setDomainOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(await statusFor(provider, scope));
    } catch {
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  }, [provider, scope]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useConnectionRefresh(refresh);

  const connect = async () => {
    if (provider === 'custom_email') {
      setDomainOpen(true);
      return;
    }
    setBusy(true);
    try {
      if (provider === 'gmail') await connectGmail(scope);
      else await connectOutlook(scope);
      toast({ title: `${label} connected` });
      await refresh();
    } catch (e) {
      toast({
        title: `Could not connect ${label}`,
        description: e instanceof Error ? e.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      if (provider === 'gmail') await disconnectGmailFor(scope);
      else if (provider === 'outlook') await disconnectOutlookFor(scope);
      else await disconnectCustomEmail(scope);
      toast({ title: `${label} removed` });
      await refresh();
    } catch (e) {
      toast({
        title: 'Could not remove',
        description: e instanceof Error ? e.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card>
        <CardContent className="flex items-center gap-3 p-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Mail className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{label}</p>
            {loading ? (
              <p className="text-[11px] text-muted-foreground">Checking…</p>
            ) : status.connected ? (
              <p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                {status.accountEmail || 'Connected'}
              </p>
            ) : status.mailboxMissing ? (
              <p className="truncate text-[11px] text-amber-500">
                No Outlook mailbox on that account — connect again with your Outlook address
              </p>
            ) : (
              <p className="truncate text-[11px] text-muted-foreground">{note}</p>
            )}
          </div>
          {status.connected ? (
            <Button aria-label={`Disconnect ${label}`} variant="ghost" size="icon" className="h-8 w-8" onClick={disconnect} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={connect} disabled={busy || loading}>
              {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Plug className="mr-1 h-3.5 w-3.5" />}
              Connect
            </Button>
          )}
        </CardContent>
        {scope === 'support' && status.connected && <div className="px-3 pb-3"><SupportAccountReplySettings channel={provider} /></div>}
      </Card>
      {provider === 'custom_email' && (
        <DomainMailboxDialog open={domainOpen} scope={scope} onOpenChange={setDomainOpen} onConnected={refresh} />
      )}
    </>
  );
}

/**
 * Sending mailboxes for the notification templates — one set for job seekers
 * and one for employers. Each set is tried in order: Domain Email → Outlook →
 * Gmail. These are separate from the AI Connect page connections.
 */
export default function TemplateMailboxCards() {
  return (
    <div className="space-y-5">
      {(['jobseeker', 'employer'] as Scope[]).map((scope) => (
        <div key={scope} className="space-y-2">
          <div>
            <h3 className="text-sm font-semibold">
              {scope === 'jobseeker' ? 'Job seeker emails' : 'Employer emails'}
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Sent from Domain Email first; if that is not connected or fails, Outlook, then Gmail.
            </p>
          </div>
          {PROVIDERS.map((p) => (
            <MailboxCard key={p.id} provider={p.id} label={p.label} note={p.note} scope={scope} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** One mailbox set (Domain Email → Outlook → Gmail) for a single scope. */
export function ScopedMailboxCards({ scope }: { scope: Scope }) {
  return (
    <div className="space-y-2">
      {PROVIDERS.map((p) => (
        <MailboxCard key={p.id} provider={p.id} label={p.label} note={p.note} scope={scope} />
      ))}
    </div>
  );
}
