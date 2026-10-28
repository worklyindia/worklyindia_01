import { supabase } from '@/integrations/supabase/client';
import { buildYouTubePayload } from '@/utils/youtubeSeoPayload';
import { recordSeoFeedback } from '@/utils/youtubeSeoLearning';
import type { YtSeoUpdatePayload, YtSeoField } from '@/components/ai-chat/YouTubeSeoUpdateCard';

/**
 * Headless "Update YouTube now" — same work the old Update card did, but
 * without any UI. The AI asks for permission in chat; as soon as the user
 * says "haan", this runs straight away (single fast API path).
 */
export async function applyYtSeoUpdate(
  data: YtSeoUpdatePayload,
): Promise<{ ok: boolean; message: string }> {
  try {
    const changedOnly = data.fields && data.fields.length ? data.fields : null;
    const keep = (f: YtSeoField) => !!changedOnly && !changedOnly.includes(f);

    // Current metadata — needed so untouched fields stay exactly as they are.
    let cur: any = {};
    try {
      const { data: res } = await supabase.functions.invoke('unified-youtube-api', {
        body: { action: 'yt_video_meta', videoId: data.videoId },
      });
      if (res?.success) cur = res.video || {};
    } catch {
      /* meta is best-effort */
    }

    const title = keep('title') && cur.title ? String(cur.title) : data.title;
    const description =
      keep('description') && typeof cur.description === 'string'
        ? String(cur.description)
        : data.description;
    const tags = keep('tags') && Array.isArray(cur.tags) ? cur.tags.map(String) : data.tags || [];
    const hashtags =
      keep('hashtags') && typeof cur.description === 'string'
        ? (String(cur.description).match(/#[\p{L}\p{N}\p{M}_]{2,40}/gu) || []).slice(0, 15)
        : data.hashtags || [];
    const categoryId =
      keep('categoryId') && cur.categoryId
        ? String(cur.categoryId)
        : data.categoryId || (cur.categoryId ? String(cur.categoryId) : '');

    const built = buildYouTubePayload(
      { title, description, tags, hashtags, categoryId },
      {
        current: {
          title: cur.title,
          description: cur.description,
          tags: cur.tags,
          categoryId: cur.categoryId,
        },
      },
    );
    if (!built.ok) throw new Error(built.errors[0] || 'SEO data invalid — kuch update nahi kiya.');

    const { data: upRes, error: upErr } = await supabase.functions.invoke('unified-youtube-api', {
      body: {
        action: 'yt_video_update',
        videoId: data.videoId,
        patch: {
          title: built.payload.title,
          description: built.payload.description,
          tags: built.payload.tags,
          hashtags: built.payload.hashtags,
          categoryId: built.payload.categoryId,
          privacyStatus: ['public', 'private', 'unlisted'].includes(cur.privacyStatus)
            ? cur.privacyStatus
            : 'public',
          madeForKids: !!cur.madeForKids,
          license: cur.license,
          embeddable: cur.embeddable,
          publicStatsViewable: cur.publicStatsViewable,
          defaultLanguage: cur.defaultLanguage,
        },
      },
    });
    if (upErr) throw upErr;
    if (!upRes?.success) throw new Error(upRes?.error || upRes?.errors?.[0] || 'Update failed');

    void recordSeoFeedback(
      data.videoId,
      {
        title: data.title,
        description: data.description,
        hashtags: data.hashtags || [],
        tags: data.tags || [],
      },
      {
        title: built.payload.title,
        description: built.payload.description,
        hashtags: built.payload.hashtags || [],
        tags: built.payload.tags || [],
        categoryId: built.payload.categoryId,
      },
    );

    const changed: string[] = Array.isArray(upRes.changed)
      ? upRes.changed
      : Array.isArray(upRes.willChange)
        ? upRes.willChange
        : [];

    return {
      ok: true,
      message:
        `✅ YouTube par live update ho gaya — "${built.payload.title}"` +
        (changed.length ? ` (${changed.join(', ')})` : ''),
    };
  } catch (e: any) {
    return {
      ok: false,
      message: `❌ Update nahi ho paya — ${e?.message || 'Update failed'}. Purana SEO safe hai, dobara "haan" bolo to phir try karungi.`,
    };
  }
}

/** "haan / ha / yes / ok / update kar do" — user ki permission. */
export function isYtUpdateApproval(raw: string): boolean {
  const t = String(raw || '')
    .toLowerCase()
    .replace(/[!.?,🙏👍✅]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t || t.length > 40) return false;
  if (/\b(nahi|nai|mat|no|cancel|ruk|stop)\b/.test(t)) return false;
  if (/^(h+a+n?|haan|haa|ha|ji|ji haan|yes|yep|yup|ya|y|ok|okay|okey|sure|done|karo|kar do|thik hai|theek hai|sahi hai|go|go ahead|update|update karo|update kar do|haan update|haan update karo|haan update kar do|update kardo|live karo|live kar do|yes update|ok update)$/.test(t))
    return true;
  return /\b(update|live)\b/.test(t) && /\b(kar|karo|kardo|do|de|dedo)\b/.test(t);
}
