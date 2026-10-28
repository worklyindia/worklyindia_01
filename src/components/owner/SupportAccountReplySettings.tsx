import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { getSupportAccountSettings, saveSupportAccountSettings, type SupportAccountSettings, type SupportChannel } from '@/hooks/useSupportDesk';

export default function SupportAccountReplySettings({ channel, accountId = '' }: { channel: SupportChannel; accountId?: string }) {
  const [settings, setSettings] = useState<SupportAccountSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setSettings(null); setError('');
    getSupportAccountSettings(channel, accountId).then((r) => { if (active) setSettings(r.settings); })
      .catch((e) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [channel, accountId]);
  const save = async (enabled: boolean) => {
    if (!settings || busy) return;
    const previous = settings;
    setSettings({ ...previous, enabled });
    setBusy(true);
    try {
      const r = await saveSupportAccountSettings(channel, accountId, { ...previous, enabled });
      setSettings(r.settings);
      toast.success(enabled ? 'AI auto reply turned on' : 'AI auto reply turned off');
    } catch (e) {
      setSettings(previous);
      toast.error(e instanceof Error ? e.message : 'Could not save');
    } finally { setBusy(false); }
  };
  if (error) return <p role="alert" className="text-sm text-destructive">{error}</p>;
  if (!settings) return <Loader2 className="h-4 w-4 animate-spin" aria-label="Loading reply settings" />;
  const id = `support-reply-${channel}-${accountId}`;
  return <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
    <Label htmlFor={id}>AI auto reply</Label>
    <Switch id={id} aria-label={`${channel} AI auto reply`} checked={settings.enabled} disabled={busy} onCheckedChange={(enabled) => void save(enabled)} />
  </div>;
}
