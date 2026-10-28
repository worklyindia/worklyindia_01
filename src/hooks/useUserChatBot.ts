import { useConnectionRefresh } from '@/hooks/useConnectionRefresh';
import { notifyConnectionUpdated } from '@/lib/connectionUpdates';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type ChatBotPlatform = 'discord' | 'slack' | 'twitch';

export interface ChatBotStatus {
  connected: boolean;
  botUsername?: string | null;
  botName?: string | null;
  isActive?: boolean;
  connectedAt?: string | null;
  webhookUrl?: string | null;
  meta?: Record<string, unknown>;
}

export interface ChatBotSettings {
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

export interface ChatBotReplyLogItem {
  id: string;
  channel_ref: string | null;
  from_name: string | null;
  user_message: string | null;
  ai_reply: string | null;
  status: string;
  error: string | null;
  created_at: string;
}

async function callChatBots(payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('email-api/chat-bots', { body: payload });
  if (error) throw new Error(error.message);
  if (data && data.success === false) throw new Error(data.error || 'Request failed');
  if (['link', 'unlink'].includes(String(payload.action))) notifyConnectionUpdated();
  return data;
}

export interface ChatBotLinkInput {
  token?: string;
  clientId?: string;
  clientSecret?: string;
  userToken?: string;
  channelLogin?: string;
}

export const linkChatBot = (platform: ChatBotPlatform, input: ChatBotLinkInput) =>
  callChatBots({ action: 'link', platform, ...input });
export const unlinkChatBot = (platform: ChatBotPlatform) =>
  callChatBots({ action: 'unlink', platform });
export const getChatBotSettings = (platform: ChatBotPlatform) =>
  callChatBots({ action: 'settings_get', platform });
export const saveChatBotSettings = (platform: ChatBotPlatform, settings: Partial<ChatBotSettings>) =>
  callChatBots({ action: 'settings_save', platform, settings });
export const getChatBotReplies = (platform: ChatBotPlatform, limit = 20) =>
  callChatBots({ action: 'replies', platform, limit });
export const runChatBotNow = (platform: ChatBotPlatform) =>
  callChatBots({ action: 'run', platform });

export function useUserChatBot(platform: ChatBotPlatform, enabled = true) {
  const [status, setStatus] = useState<ChatBotStatus>({ connected: false });
  const [loading, setLoading] = useState(enabled);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await callChatBots({ action: 'status', platform });
      setStatus({
        connected: !!res?.connected,
        botUsername: res?.botUsername ?? null,
        botName: res?.botName ?? null,
        isActive: res?.isActive,
        connectedAt: res?.connectedAt ?? null,
        meta: res?.meta ?? {},
      });
    } catch {
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  }, [enabled, platform]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useConnectionRefresh(refresh, enabled);

  return { status, loading, refresh };
}
