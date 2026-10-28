import { useConnectionRefresh } from '@/hooks/useConnectionRefresh';
import { notifyConnectionUpdated } from '@/lib/connectionUpdates';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { supabaseUrl } from '@/constants/supabase';
import { toast } from 'sonner';

// Same redirect URI as every other Google connect (Gmail, AdSense, ...):
// the unified-google-api edge function bounces the browser back to /ai-assistant.
export const YT_REDIRECT_URI = typeof window !== 'undefined'
  ? `${supabaseUrl()}/functions/v1/unified-google-api`
  : '';

export interface YouTubeConnection {
  channelId: string;
  channelTitle: string;
  channelThumbnail: string | null;
  subscriberCount: number;
  connectedAt?: string;
}

export interface YouTubeSnapshot {
  connected: boolean;
  cached?: boolean;
  analyticsError?: string | null;
  range: { days: number; startDate: string; endDate: string };
  channel: {
    id: string; title: string; description?: string; customUrl?: string;
    thumbnail?: string; publishedAt?: string; banner?: string | null;
    keywords?: string | null; country?: string | null; privacyStatus?: string | null;
    madeForKids?: boolean | null; topicCategories?: string[]; hiddenSubscriberCount?: boolean;
    categories?: { id: string; name: string; count: number }[]; primaryCategory?: string | null;
    subscriberCount: number; viewCount: number; videoCount: number;
  };
  totals: {
    views: number; estimatedMinutesWatched: number; averageViewDuration: number;
    subscribersGained: number; subscribersLost: number; netSubscribers: number;
    likes: number; comments: number; engagementRate: number; subsPer1kViews: number;
    dislikes?: number; shares?: number; averageViewPercentage?: number;
    viewsChangePct: number | null; watchTimeChangePct: number | null;
  };
  daily: Array<{ date: string; views: number; estimatedMinutesWatched: number; subscribersGained: number; subscribersLost: number; likes: number; comments: number }>;
  trafficSources: Array<{ source: string; views: number }>;
  countries?: Array<{ key: string; views: number }>;
  devices?: Array<{ key: string; views: number }>;
  subscribedStatus?: Array<{ key: string; views: number }>;
  posts?: { supported: boolean; items: unknown[]; note?: string };
  videos: {
    total: number; medianViews: number; shortsCount?: number; longCount?: number;
    all?: YouTubeVideoStat[];
    recent: YouTubeVideoStat[]; top: YouTubeVideoStat[]; weak: YouTubeVideoStat[];
  };
  format: {
    shorts: { count: number; avgViews: number; avgEngagement: number };
    longForm: { count: number; avgViews: number; avgEngagement: number };
  };
  cadence: { uploadsPerWeekLast90: number; avgGapDays: number | null; recentGaps: number[] };
  scores: {
    overall: number; content: number; consistency: number;
    engagement: number; subscriberGrowth: number; topicStrategy: number; trend: number;
  };
}

export interface YouTubeVideoStat {
  videoId: string; title: string; thumbnail: string; publishedAt: string;
  views: number; likes: number; comments: number; duration: string;
  isShort: boolean; ageDays: number; viewsPerDay: number; engagementRate: number;
  durationSeconds?: number; description?: string; privacyStatus?: string | null; isLive?: boolean;
}

async function callYT(payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('unified-youtube-api', { body: payload });
  if (error) throw new Error(error.message);
  if (data && data.success === false && data.error) throw new Error(data.error);
  if (['yt_oauth_exchange', 'yt_disconnect', 'yt_set_default'].includes(String(payload.action))) notifyConnectionUpdated();
  return data;
}

export function useYouTubeGrowth() {
  const [connection, setConnection] = useState<YouTubeConnection | null>(null);
  const [snapshot, setSnapshot] = useState<YouTubeSnapshot | null>(null);
  const [days, setDays] = useState<0 | 7 | 28 | 90 | 365>(28);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const exchangedCode = useRef<string | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await callYT({ action: 'yt_status' });
      setConnection(res?.connected ? res.connection : null);
      return !!res?.connected;
    } catch {
      setConnection(null);
      return false;
    } finally {
      setChecking(false);
    }
  }, []);

  const loadSnapshot = useCallback(async (range = days, force = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await callYT({ action: 'yt_snapshot', days: range, force });
      if (res?.connected === false) { setConnection(null); setSnapshot(null); return; }
      setSnapshot(res as YouTubeSnapshot);
    } catch (e: any) {
      setError(e?.message || 'Could not load YouTube analytics');
    } finally {
      setLoading(false);
    }
  }, [days]);

  const connect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const res = await callYT({ action: 'yt_oauth_url', redirectUri: YT_REDIRECT_URI, origin: window.location.origin });
      if (!res?.url) throw new Error('Could not start Google sign-in');
      sessionStorage.setItem('yt_oauth_pending', '1');
      window.location.href = res.url;
    } catch (e: any) {
      setConnecting(false);
      const msg = e?.message || 'YouTube connect failed';
      setError(msg);
      toast.error(msg);
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await callYT({ action: 'yt_disconnect' });
      setConnection(null);
      setSnapshot(null);
      toast.success('YouTube disconnected. Stored channel data deleted.');
    } catch (e: any) {
      toast.error(e?.message || 'Disconnect failed');
    }
  }, []);

  const changeRange = useCallback((d: 0 | 7 | 28 | 90 | 365) => {
    setDays(d);
    loadSnapshot(d);
  }, [loadSnapshot]);

  // Handle OAuth redirect back (?code=... on /ai-assistant)
  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    const oauthError = url.searchParams.get('error');
    const pending = sessionStorage.getItem('yt_oauth_pending');

    const clean = () => {
      url.searchParams.delete('code');
      url.searchParams.delete('error');
      url.searchParams.delete('state');
      url.searchParams.delete('scope');
      url.searchParams.delete('authuser');
      url.searchParams.delete('prompt');
      window.history.replaceState({}, '', url.pathname + (url.search === '?' ? '' : url.search));
      sessionStorage.removeItem('yt_oauth_pending');
    };

    if (oauthError && pending) {
      toast.error('YouTube access was not granted');
      clean();
      const back = sessionStorage.getItem('yt_oauth_return');
      sessionStorage.removeItem('yt_oauth_return');
      if (back && back.startsWith('/') && back !== window.location.pathname) { window.location.replace(back); return; }
      refreshStatus();
      return;
    }

    if (code && pending && exchangedCode.current !== code) {
      exchangedCode.current = code;
      setConnecting(true);
      clean();
      (async () => {
        try {
          const res = await callYT({ action: 'yt_oauth_exchange', code, redirectUri: YT_REDIRECT_URI });
          setConnection(res.connection);
          toast.success(`Connected: ${res.connection?.channelTitle}`);
          const back = sessionStorage.getItem('yt_oauth_return');
          if (back) {
            sessionStorage.removeItem('yt_oauth_return');
            if (back.startsWith('/') && back !== window.location.pathname) { window.location.replace(back); return; }
          }
          await loadSnapshot(28, true);
        } catch (e: any) {
          toast.error(e?.message || 'YouTube connection failed');
        } finally {
          setConnecting(false);
          setChecking(false);
        }
      })();
      return;
    }

    refreshStatus().then((isConnected) => { if (isConnected) loadSnapshot(28); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useConnectionRefresh(refreshStatus, true);

  return {
    connection, snapshot, days, checking, loading, connecting, error,
    connect, disconnect, loadSnapshot, changeRange, refreshStatus,
  };
}

export interface YouTubeVideoAnalytics {
  range: { days: number; startDate: string; endDate: string };
  analyticsError?: string | null;
  video: {
    videoId: string; title: string; description: string; thumbnail: string;
    publishedAt: string; ageDays: number; durationSeconds: number; duration: string;
    isShort: boolean; privacyStatus: string | null; tags: string[];
    categoryId: string | null; definition: string | null; caption: boolean;
    lifetime: { views: number; likes: number; comments: number; favorites: number; viewsPerDay: number; engagementRate: number };
  };
  totals: {
    views: number; estimatedMinutesWatched: number; averageViewDuration: number;
    averageViewPercentage: number; subscribersGained: number; subscribersLost: number;
    netSubscribers: number; likes: number; dislikes: number; shares: number; comments: number;
  };
  daily: Array<{ date: string; views: number; estimatedMinutesWatched: number; averageViewPercentage: number; subscribersGained: number; subscribersLost: number; likes: number; shares: number; comments: number }>;
  trafficSources: Array<{ source: string; views: number }>;
  countries: Array<{ key: string; views: number }>;
  devices: Array<{ key: string; views: number }>;
  subscribedStatus: Array<{ key: string; views: number }>;
}

export async function fetchVideoAnalytics(videoId: string, days: 0 | 7 | 28 | 90 | 365 = 28) {
  const res = await callYT({ action: 'yt_video', videoId, days });
  if (res?.connected === false) throw new Error('YouTube not connected');
  return res as YouTubeVideoAnalytics;
}

export interface YouTubeVideoMeta {
  videoId: string;
  title: string;
  description: string;
  tags: string[];
  categoryId: string;
  defaultLanguage: string;
  thumbnail: string;
  publishedAt: string;
  privacyStatus: 'public' | 'private' | 'unlisted';
  license: string;
  embeddable: boolean;
  publicStatsViewable: boolean;
  madeForKids: boolean;
  duration: string;
}

export interface YouTubeCategory { id: string; title: string }

export async function fetchVideoMeta(videoId: string): Promise<{
  video: YouTubeVideoMeta; categories: YouTubeCategory[]; canEdit: boolean;
}> {
  const res = await callYT({ action: 'yt_video_meta', videoId });
  if (res?.connected === false) throw new Error('YouTube not connected');
  return { video: res.video, categories: res.categories || [], canEdit: !!res.canEdit };
}

export async function updateVideoMeta(
  videoId: string,
  patch: Partial<YouTubeVideoMeta> & { thumbnailBase64?: string; thumbnailMime?: string },
) {
  const res = await callYT({ action: 'yt_video_update', videoId, patch });
  if (res?.connected === false) throw new Error('YouTube not connected');
  return res;
}

export interface YouTubeUploadMeta {
  title: string;
  description: string;
  tags: string[];
  categoryId: string;
  defaultLanguage: string;
  privacyStatus: 'public' | 'private' | 'unlisted';
  madeForKids: boolean;
  embeddable: boolean;
  publicStatsViewable: boolean;
  license: string;
  publishAt?: string;
}

export async function fetchUploadCategories(): Promise<{ categories: YouTubeCategory[]; canEdit: boolean }> {
  const res = await callYT({ action: 'yt_upload_categories' });
  if (res?.connected === false) throw new Error('YouTube not connected');
  return { categories: res.categories || [], canEdit: !!res.canEdit };
}

export async function startResumableUpload(file: File, meta: YouTubeUploadMeta): Promise<string> {
  const res = await callYT({
    action: 'yt_upload_init',
    fileSize: file.size,
    fileType: file.type || 'video/*',
    meta,
  });
  if (res?.connected === false) throw new Error('YouTube not connected');
  if (!res?.uploadUrl) throw new Error('Could not start upload');
  return res.uploadUrl as string;
}

/** Uploads the file bytes straight to YouTube's resumable session with progress. */
export function uploadVideoFile(
  uploadUrl: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<{ id: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    xhr.setRequestHeader('Content-Type', file.type || 'video/*');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const json = JSON.parse(xhr.responseText || '{}');
          resolve({ id: json.id });
        } catch { resolve({ id: '' }); }
      } else {
        let msg = `Upload failed (${xhr.status})`;
        try { msg = JSON.parse(xhr.responseText)?.error?.message || msg; } catch { /* ignore */ }
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(file);
  });
}

export async function uploadThumbnailForVideo(videoId: string, base64: string, mime: string) {
  return callYT({ action: 'yt_upload_thumbnail', videoId, thumbnailBase64: base64, thumbnailMime: mime });
}

export const YT_LANGUAGES: Array<{ code: string; label: string }> = [
  { code: '', label: 'Not set' },
  { code: 'hi', label: 'Hindi' },
  { code: 'en', label: 'English' },
  { code: 'en-US', label: 'English (US)' },
  { code: 'en-IN', label: 'English (India)' },
  { code: 'bn', label: 'Bengali' },
  { code: 'mr', label: 'Marathi' },
  { code: 'te', label: 'Telugu' },
  { code: 'ta', label: 'Tamil' },
  { code: 'gu', label: 'Gujarati' },
  { code: 'kn', label: 'Kannada' },
  { code: 'ml', label: 'Malayalam' },
  { code: 'pa', label: 'Punjabi' },
  { code: 'or', label: 'Odia' },
  { code: 'as', label: 'Assamese' },
  { code: 'ur', label: 'Urdu' },
  { code: 'ne', label: 'Nepali' },
  { code: 'ar', label: 'Arabic' },
  { code: 'es', label: 'Spanish' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'ru', label: 'Russian' },
  { code: 'id', label: 'Indonesian' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'zh', label: 'Chinese' },
];

export const YT_TAG_MAX_TOTAL_CHARS = 500;
export const YT_TAG_MAX_COUNT = 60;
export const YT_TITLE_MAX = 100;
export const YT_TITLE_IDEAL = 70;
export const YT_DESC_MAX = 5000;
export const YT_HASHTAG_MAX = 15;

/* --------------------------- AI SEO Master (YouTube) --------------------------- */

export interface YTSeoCheck { level: 'error' | 'warn' | 'ok'; message: string }

export interface YTSeoPack {
  canEdit: boolean;
  aiPowered: boolean;
  kind: 'short' | 'video';
  score: number;
  categoryMismatch: boolean;
  channelCategoryMismatch: boolean;
  channel: {
    title: string; handle: string | null; url: string | null; subscriberCount: number;
    primaryCategoryId: string | null; primaryCategoryTitle: string | null;
  };
  categories: YouTubeCategory[];
  current: {
    videoId: string; title: string; description: string; tags: string[]; hashtags: string[];
    categoryId: string; categoryTitle: string | null; defaultLanguage: string;
    durationSeconds: number; isShort: boolean; views: number; publishedAt: string; tagChars: number;
  };
  /** Publishable payload only — these fields go to YouTube verbatim. */
  suggestion: {
    title: string; titleAlternatives: string[]; description: string; tags: string[];
    tagChars: number; hashtags: string[]; categoryId: string; categoryTitle: string;
    valid: boolean;
  };
  /** Internal explanation — never published to YouTube. */
  internal: {
    categoryReason: string; keywords: string[]; summary: string;
    removedTags: string[]; validationErrors: string[]; categoryCorrected: boolean;
  };
  checks: YTSeoCheck[];
}

/** AI SEO pack for an existing video (videoId) or a new upload draft. */
export async function fetchSeoPack(opts: {
  videoId?: string;
  brief?: string;
  draft?: {
    title?: string; description?: string; tags?: string[];
    categoryId?: string; defaultLanguage?: string; isShort?: boolean;
  };
}): Promise<YTSeoPack> {
  const res = await callYT({ action: 'yt_seo_pack', ...opts });
  if (res?.connected === false) throw new Error('YouTube not connected');
  return res as YTSeoPack;
}

export interface YTSeoAuditItem {
  videoId: string; title: string; isShort: boolean; categoryId: string;
  categoryTitle: string; tagCount: number; problems: string[]; health: number;
}

export interface YTSeoAudit {
  canEdit: boolean;
  channel: YTSeoPack['channel'] & { topics?: string[] };
  categories: YouTubeCategory[];
  totals: { scanned: number; needsWork: number; categoryMismatch: number; avgHealth: number };
  items: YTSeoAuditItem[];
}

/** Full-channel SEO audit of the latest uploads (read-only). */
export async function fetchSeoAudit(): Promise<YTSeoAudit> {
  const res = await callYT({ action: 'yt_seo_channel_audit' });
  if (res?.connected === false) throw new Error('YouTube not connected');
  return res as YTSeoAudit;
}


/* ----------------------------- AI Auto Reply ----------------------------- */

export interface YTAutoReplySettings {
  enabled: boolean;
  tone: string;
  language: string;
  reply_scope: 'all' | 'shorts' | 'long';
  reply_length: 'auto' | 'short' | 'medium';
  max_replies_per_run: number;
  custom_instructions: string;
  signature: string;
  skip_negative: boolean;
  last_run_at?: string | null;
  last_run_status?: string | null;
}

export interface YTAutoReplyLogItem {
  id: string;
  comment_id: string;
  video_id: string | null;
  video_title: string | null;
  is_short: boolean | null;
  author_name: string | null;
  comment_text: string | null;
  reply_text: string | null;
  status: string;
  error: string | null;
  created_at: string;
}

export async function fetchAutoReplySettings(accountId?: string | null): Promise<{ settings: YTAutoReplySettings; totalReplies: number }> {
  const res = await callYT({ action: 'yt_autoreply_get', account_id: accountId || undefined });
  return { settings: res.settings as YTAutoReplySettings, totalReplies: Number(res.totalReplies || 0) };
}

export async function saveAutoReplySettings(settings: Partial<YTAutoReplySettings>, accountId?: string | null): Promise<YTAutoReplySettings> {
  const res = await callYT({ action: 'yt_autoreply_save', settings, account_id: accountId || undefined });
  return res.settings as YTAutoReplySettings;
}

export interface YTChannelAccount { account_id: string; name: string | null; is_default: boolean }
/** Every YouTube channel this user has connected. */
export async function listYouTubeChannels(): Promise<YTChannelAccount[]> {
  const res = await callYT({ action: 'yt_accounts_list' });
  return (res?.accounts || []) as YTChannelAccount[];
}
export const setYouTubeDefault = (accountId: string) => callYT({ action: 'yt_set_default', account_id: accountId });
export const disconnectYouTubeChannel = (accountId: string) => callYT({ action: 'yt_disconnect', account_id: accountId });
/** Starts Google sign-in to add another channel, returning to `returnPath` afterwards. */
export async function addYouTubeChannel(returnPath: string) {
  const res = await callYT({ action: 'yt_oauth_url', redirectUri: YT_REDIRECT_URI, origin: window.location.origin });
  if (!res?.url) throw new Error('Could not start Google sign-in');
  sessionStorage.setItem('yt_oauth_pending', '1');
  sessionStorage.setItem('yt_oauth_return', returnPath);
  window.location.href = res.url;
}

export async function runAutoReply(opts: { dryRun?: boolean; limit?: number } = {}) {
  return callYT({ action: 'yt_autoreply_run', dryRun: !!opts.dryRun, limit: opts.limit }) as Promise<{
    scanned: number; replied: number; skipped: number; note?: string;
    items: Array<{ commentId: string; author: string; comment: string; reply: string; videoTitle?: string; posted: boolean; error?: string }>;
  }>;
}

export async function fetchAutoReplyLog(limit = 20, todayOnly = false): Promise<YTAutoReplyLogItem[]> {
  const res = await callYT({ action: 'yt_autoreply_log', limit, todayOnly });
  return (res.items || []) as YTAutoReplyLogItem[];
}
