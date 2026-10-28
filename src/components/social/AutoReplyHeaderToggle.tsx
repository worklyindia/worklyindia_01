import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { fetchAutoReplySettings, saveAutoReplySettings } from '@/hooks/useYouTubeGrowth';
import {
  fetchSocialAutoReplySettings,
  saveSocialAutoReplySettings,
  type SocialPlatform,
} from '@/hooks/useSocialConnect';
import { getUserBotSettings, saveUserBotSettings } from '@/hooks/useUserTelegramBot';
import { getGmailSettings, saveGmailSettings } from '@/hooks/useUserGmail';
import { getOutlookSettings, saveOutlookSettings } from '@/hooks/useUserOutlook';
import { getCustomEmailStatus, saveCustomEmailSettings } from '@/hooks/useUserCustomEmail';

const SOCIAL: string[] = ['x', 'linkedin', 'github', 'gitlab', 'discord', 'slack', 'twitch'];

type Adapter = {
  get: () => Promise<boolean>;
  set: (v: boolean) => Promise<void>;
};

function adapterFor(key: string, accountId?: string | null): Adapter | null {
  if (key === 'youtube') {
    return {
      get: async () => !!(await fetchAutoReplySettings(accountId))?.settings?.enabled,
      set: async (v) => { await saveAutoReplySettings({ enabled: v } as any, accountId); },
    };
  }
  if (SOCIAL.includes(key)) {
    const p = key as SocialPlatform;
    return {
      get: async () => !!(await fetchSocialAutoReplySettings(p, accountId))?.settings?.enabled,
      set: async (v) => { await saveSocialAutoReplySettings(p, { enabled: v } as any, accountId); },
    };
  }
  if (key === 'telegram') {
    return {
      get: async () => !!(await getUserBotSettings(accountId))?.settings?.enabled,
      set: async (v) => { await saveUserBotSettings({ enabled: v }, accountId); },
    };
  }
  if (key === 'gmail') {
    return {
      get: async () => !!(await getGmailSettings(accountId || undefined))?.settings?.enabled,
      set: async (v) => { await saveGmailSettings({ enabled: v }, accountId || undefined); },
    };
  }
  if (key === 'outlook') {
    return {
      get: async () => !!(await getOutlookSettings(accountId || undefined))?.settings?.enabled,
      set: async (v) => { await saveOutlookSettings({ enabled: v }, accountId || undefined); },
    };
  }
  if (key === 'email') {
    return {
      get: async () => !!(await getCustomEmailStatus(null, accountId || null))?.settings?.enabled,
      set: async (v) => { await saveCustomEmailSettings({ enabled: v }, accountId || null); },
    };
  }
  if (key === 'whatsapp') {
    return {
      get: async () => {
        const { data } = await supabase
          .from('employer_whatsapp_accounts' as any)
          .select('ai_auto_reply')
          .maybeSingle();
        return !!(data as any)?.ai_auto_reply;
      },
      set: async (v) => {
        const { data } = await supabase
          .from('employer_whatsapp_accounts' as any)
          .select('company_id')
          .maybeSingle();
        const companyId = (data as any)?.company_id;
        if (!companyId) throw new Error('WhatsApp account not found');
        const { error } = await supabase
          .from('employer_whatsapp_accounts' as any)
          .update({ ai_auto_reply: v } as any)
          .eq('company_id', companyId);
        if (error) throw new Error(error.message);
      },
    };
  }
  return null;
}

/** Compact AI auto-reply on/off switch shown in the settings page header. */
export default function AutoReplyHeaderToggle({
  platform,
  connected,
  accountId,
}: {
  platform: string;
  connected: boolean;
  accountId?: string | null;
}) {
  const adapter = adapterFor(platform.toLowerCase(), accountId);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!adapter || !connected) { setLoading(false); return; }
    setLoading(true);
    try {
      setEnabled(await adapter.get());
    } catch {
      /* keep off */
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform, connected, accountId]);

  useEffect(() => { load(); }, [load]);

  if (!adapter || !connected) return null;

  const onChange = async (v: boolean) => {
    const prev = enabled;
    setEnabled(v);
    setSaving(true);
    try {
      await adapter.set(v);
      toast.success(v ? 'AI auto reply is on' : 'AI auto reply is off');
    } catch (e: any) {
      setEnabled(prev);
      toast.error(e?.message || 'Could not change AI auto reply');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2 shrink-0">
      <span className="text-[11px] font-medium text-muted-foreground hidden xs:inline sm:inline">
        AI auto
      </span>
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : (
        <Switch
          checked={enabled}
          disabled={saving}
          onCheckedChange={onChange}
          aria-label="AI auto reply on or off"
        />
      )}
    </div>
  );
}
