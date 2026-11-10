import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { fetchSocialAutoReplySettings, saveSocialAutoReplySettings, type SocialPlatform } from '@/hooks/useSocialConnect';

/** Per-account AI auto reply on/off switch. */
export default function SocialAccountAutoReplyToggle({ platform, accountId }: { platform: SocialPlatform; accountId: string }) {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let alive = true;
    setBusy(true);
    fetchSocialAutoReplySettings(platform, accountId)
      .then((r) => { if (alive) setEnabled(!!r.settings?.enabled); })
      .catch(() => { if (alive) setEnabled(false); })
      .finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, [platform, accountId]);

  const change = async (v: boolean) => {
    setEnabled(v);
    setBusy(true);
    try {
      const s = await saveSocialAutoReplySettings(platform, { enabled: v }, accountId);
      setEnabled(!!s?.enabled);
      toast.success(v ? 'AI auto reply turned on' : 'AI auto reply turned off');
    } catch (e) {
      setEnabled(!v);
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return <Switch checked={enabled} disabled={busy} onCheckedChange={change} aria-label="AI auto reply" />;
}
