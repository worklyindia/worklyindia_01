import { supabase } from '@/integrations/supabase/client';

export interface SeoSnapshot {
  title: string;
  description: string;
  hashtags: string[];
  tags: string[];
  categoryId?: string;
}

const same = (a: string[], b: string[]) =>
  a.length === b.length && a.every((x, i) => x.toLowerCase() === (b[i] || '').toLowerCase());

/**
 * Saves "what the AI suggested" vs "what the creator actually published" so the
 * next generation can learn the creator's own voice (never blindly copied).
 * Best-effort: a failure here must never break the YouTube update flow.
 */
export async function recordSeoFeedback(
  videoId: string,
  ai: SeoSnapshot,
  final: SeoSnapshot,
): Promise<void> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id;
    if (!userId) return;

    const edited: string[] = [];
    if (ai.title.trim() !== final.title.trim()) edited.push('title');
    if (ai.description.trim() !== final.description.trim()) edited.push('description');
    if (!same(ai.hashtags, final.hashtags)) edited.push('hashtags');
    if (!same(ai.tags, final.tags)) edited.push('tags');

    const lower = (xs: string[]) => xs.map((x) => x.toLowerCase());
    const removed = ai.tags.filter((t) => !lower(final.tags).includes(t.toLowerCase()));
    const added = final.tags.filter((t) => !lower(ai.tags).includes(t.toLowerCase()));

    await supabase.from('youtube_seo_feedback').insert({
      user_id: userId,
      video_id: videoId,
      ai_title: ai.title,
      ai_description: ai.description,
      ai_hashtags: ai.hashtags,
      ai_tags: ai.tags,
      final_title: final.title,
      final_description: final.description,
      final_hashtags: final.hashtags,
      final_tags: final.tags,
      category_id: final.categoryId ?? null,
      edited_fields: edited,
      removed_tags: removed,
      added_tags: added,
    });
  } catch {
    /* learning is optional — ignore */
  }
}
