import { useConnectionRefresh } from '@/hooks/useConnectionRefresh';
import { notifyConnectionUpdated } from '@/lib/connectionUpdates';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type SocialPlatform =
  | 'x'
  | 'linkedin'
  | 'github'
  | 'gitlab'
  | 'bitbucket'
  | 'discord'
  | 'figma'
  | 'notion'
  | 'twitch'
  | 'slack'
  | 'spotify'
  | 'workos'
  | 'azure';

export interface SocialConnectionInfo {
  platform: SocialPlatform;
  accountId: string | null;
  accountName: string | null;
  accountHandle: string | null;
  accountPicture: string | null;
  accountEmail: string | null;
  followers: number;
  following: number;
  posts: number;
  canPost: boolean;
  scopes: string | null;
  connectedAt?: string;
  lastSyncedAt?: string | null;
  isDefault?: boolean;
  channelName?: string | null;
}

export interface SocialAutoReplySettings {
  enabled: boolean;
  tone: string;
  language: string;
  reply_scope: 'all' | 'mentions' | 'comments';
  reply_length: 'auto' | 'short' | 'medium';
  max_replies_per_run: number;
  custom_instructions: string;
  signature: string;
  skip_negative: boolean;
  last_run_at?: string | null;
  last_run_status?: string | null;
}

export interface SocialAutoReplyLogItem {
  id: string;
  platform: string;
  target_id: string;
  post_id: string | null;
  post_text: string | null;
  author_name: string | null;
  comment_text: string | null;
  reply_text: string | null;
  status: string;
  error: string | null;
  created_at: string;
}

export async function callSocial(payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('unified-social-api', { body: payload });
  if (error) throw new Error(error.message);
  if (data && data.success === false && data.error) throw new Error(data.error);
  if (['social_link', 'social_disconnect', 'social_set_default', 'social_bot_setup'].includes(String(payload.action))) notifyConnectionUpdated();
  return data;
}

export async function fetchSocialStatus(): Promise<SocialConnectionInfo[]> {
  const res = await callSocial({ action: 'social_status' });
  return (res?.connections || []) as SocialConnectionInfo[];
}

export async function linkSocialAccount(payload: {
  platform: SocialPlatform;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: string | null;
  scopes?: string | null;
  accountId?: string | null;
  accountName?: string | null;
  accountHandle?: string | null;
  accountPicture?: string | null;
  accountEmail?: string | null;
}) {
  return callSocial({ action: 'social_link', ...payload });
}

export async function setupSocialBot(platform: SocialPlatform, botToken: string, channelId: string, clientSecret?: string) {
  return callSocial({ action: 'social_bot_setup', platform, botToken, channelId, clientSecret });
}

export async function disconnectSocialAccount(platform: SocialPlatform, accountId?: string | null) {
  const res = await callSocial({ action: 'social_disconnect', platform, ...(accountId != null ? { accountId } : {}) });
  // Also drop the Supabase Auth identity so the social account is fully released.
  const { unlinkSocialIdentity } = await import('@/lib/socialOAuth');
  await unlinkSocialIdentity(platform, accountId);
  return res;
}

export async function setDefaultSocialAccount(platform: SocialPlatform, accountId: string) {
  return callSocial({ action: 'social_set_default', platform, accountId });
}

export async function fetchSocialSnapshot(platform: SocialPlatform) {
  return callSocial({ action: 'social_snapshot', platform });
}

export async function fetchSocialAutoReplySettings(platform: SocialPlatform, accountId?: string | null): Promise<{
  settings: SocialAutoReplySettings;
  totalReplies: number;
}> {
  const res = await callSocial({ action: 'social_autoreply_get', platform, ...(accountId != null ? { accountId } : {}) });
  return { settings: res.settings as SocialAutoReplySettings, totalReplies: Number(res.totalReplies || 0) };
}

export async function saveSocialAutoReplySettings(
  platform: SocialPlatform,
  settings: Partial<SocialAutoReplySettings>,
  accountId?: string | null,
): Promise<SocialAutoReplySettings> {
  const res = await callSocial({ action: 'social_autoreply_save', platform, settings, ...(accountId != null ? { accountId } : {}) });
  return res.settings as SocialAutoReplySettings;
}

export async function runSocialAutoReply(
  platform: SocialPlatform,
  opts: { dryRun?: boolean; limit?: number } = {},
) {
  return callSocial({
    action: 'social_autoreply_run',
    platform,
    dryRun: !!opts.dryRun,
    limit: opts.limit,
  }) as Promise<{
    scanned: number;
    replied: number;
    skipped: number;
    note?: string;
    items: Array<{ targetId: string; author: string; comment: string; reply: string; posted: boolean; error?: string }>;
  }>;
}

export async function fetchSocialAutoReplyLog(
  platform: SocialPlatform,
  limit = 20,
  todayOnly = false,
): Promise<SocialAutoReplyLogItem[]> {
  const res = await callSocial({ action: 'social_autoreply_log', platform, limit, todayOnly });
  return (res.items || []) as SocialAutoReplyLogItem[];
}

/** Connection status for X + LinkedIn. */
export function useSocialConnections(enabled = true) {
  const [connections, setConnections] = useState<SocialConnectionInfo[]>([]);
  const [loading, setLoading] = useState(enabled);

  const refresh = useCallback(async () => {
    if (!enabled) { setLoading(false); return; }
    setLoading(true);
    try {
      setConnections(await fetchSocialStatus());
    } catch {
      setConnections([]);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => { refresh(); }, [refresh]);

  useConnectionRefresh(refresh, enabled);

  const get = useCallback(
    (platform: SocialPlatform) => connections.find((c) => c.platform === platform) || null,
    [connections],
  );

  return { connections, loading, refresh, get };
}
