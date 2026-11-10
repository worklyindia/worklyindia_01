import { useCallback, useRef } from 'react';
import { deleteStorageUrl } from '@/utils/storageCleanup';

/**
 * Collects storage URLs that must only be removed once a template save has
 * actually succeeded. Deleting a picture while the owner is still editing would
 * leave the saved template pointing at a file that no longer exists.
 *
 * Pending URLs are grouped by the template they belong to, so saving one
 * template can never delete a picture that another unsaved template still uses.
 */
export function useDeferredStorageCleanup() {
  const pending = useRef<Map<string, string[]>>(new Map());

  /** Remember a URL for deletion after the next successful save of `event`. */
  const queueDeletion = useCallback((url: string | null | undefined, event = 'default') => {
    const trimmed = (url || '').trim();
    if (!trimmed) return;
    const list = pending.current.get(event) ?? [];
    if (!list.includes(trimmed)) list.push(trimmed);
    pending.current.set(event, list);
  }, []);

  /** Delete everything collected for `event`. Safe to call repeatedly. */
  const flushDeletions = useCallback(async (event = 'default') => {
    const urls = pending.current.get(event);
    if (!urls || urls.length === 0) return;
    pending.current.delete(event);
    await Promise.all(urls.map((url) => deleteStorageUrl(url).catch(() => false)));
  }, []);

  return { queueDeletion, flushDeletions };
}
