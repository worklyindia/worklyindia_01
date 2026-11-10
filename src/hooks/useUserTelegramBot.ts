import { useConnectionRefresh } from '@/hooks/useConnectionRefresh';
import { notifyConnectionUpdated } from '@/lib/connectionUpdates';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface UserBotInfo {
  botId: string;
  botUsername: string | null;
  botName: string | null;
  isActive?: boolean;
  isDefault?: boolean;
  connectedAt?: string | null;
}

export interface UserBotAccount {
  account_id: string;
  name: string | null;
  username: string | null;
  is_default: boolean;
  enabled: boolean;
}

export interface UserBotStatus {
  connected: boolean;
  botId?: string | null;
  bots?: UserBotInfo[];
  accounts?: UserBotAccount[];
  botUsername?: string | null;
  botName?: string | null;
  isActive?: boolean;
  connectedAt?: string | null;
}

export interface UserBotSettings {
  enabled: boolean;
  tone: string;
  language: string;
  reply_length: string;
  business_info: string;
  custom_instructions: string;
  signature: string;
  skip_abusive: boolean;
  max_replies_per_day: number;
  business_hours_only: boolean;
  business_hours_start: string;
  business_hours_end: string;
  last_reply_at?: string | null;
}

export interface UserBotReplyLogItem {
  id: string;
  chat_id: number | null;
  from_name: string | null;
  user_message: string | null;
  ai_reply: string | null;
  status: string;
  error: string | null;
  created_at: string;
}

async function callTelegram(payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('email-api/telegram', { body: payload });
  if (error) {
    let msg = error.message;
    try {
      const ctx = (error as any).context;
      if (ctx?.json) { const j = await ctx.json(); msg = j?.error || j?.message || msg; }
    } catch { /* keep generic */ }
    throw new Error(msg);
  }
  if (data && data.success === false) throw new Error(data.error || 'Request failed');
  if (['user_bot_link', 'user_bot_unlink', 'user_bot_set_default'].includes(String(payload.action))) notifyConnectionUpdated();
  return data;
}

export const linkUserBot = (token: string) => callTelegram({ action: 'user_bot_link', token });
const bot = (botId?: string | null) => (botId ? { botId } : {});
// Unlinks a single bot (the given account id, else the default/first one). Other linked bots are untouched.
export const unlinkUserBot = (botId?: string | null) => callTelegram({ action: 'user_bot_unlink', ...bot(botId) });
export const setDefaultUserBot = (botId: string) => callTelegram({ action: 'user_bot_set_default', botId });
// Alias kept for the naming requested alongside getUserBots/unlinkUserBot.
export const setUserBotDefault = (botId: string) => setDefaultUserBot(botId);
export const getUserBotSettings = (botId?: string | null) => callTelegram({ action: 'user_bot_settings_get', ...bot(botId) });
export const saveUserBotSettings = (settings: Partial<UserBotSettings>, botId?: string | null) =>
  callTelegram({ action: 'user_bot_settings_save', settings, ...bot(botId) });
export const getUserBotReplies = (limit = 20, botId?: string | null) =>
  callTelegram({ action: 'user_bot_replies', limit, ...bot(botId) });
// Lists every bot the user has linked: {accounts:[{account_id, name, username, is_default, enabled}]}.
export const getUserBots = async (): Promise<UserBotAccount[]> => {
  const res = await callTelegram({ action: 'user_bot_list' });
  return (res?.accounts || []) as UserBotAccount[];
};

// `botId` is optional: when omitted the status/accounts reported focus on the
// user's default bot (falling back to the first linked one), same as the backend.
export function useUserTelegramBot(enabled = true, botId?: string | null) {
  const [status, setStatus] = useState<UserBotStatus>({ connected: false });
  const [accounts, setAccounts] = useState<UserBotAccount[]>([]);
  const [loading, setLoading] = useState(enabled);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await callTelegram({ action: 'user_bot_status', ...bot(botId) });
      setStatus({
        connected: !!res?.connected,
        botId: res?.botId ?? null,
        bots: (res?.bots || []) as UserBotInfo[],
        accounts: (res?.accounts || []) as UserBotAccount[],
        botUsername: res?.botUsername ?? null,
        botName: res?.botName ?? null,
        isActive: res?.isActive,
        connectedAt: res?.connectedAt ?? null,
      });
      setAccounts((res?.accounts || []) as UserBotAccount[]);
    } catch {
      setStatus({ connected: false });
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, botId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useConnectionRefresh(refresh, enabled);

  return { status, accounts, loading, refresh };
}
