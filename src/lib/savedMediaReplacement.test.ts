import { describe, expect, test } from 'bun:test';
import { replaceSavedMedia } from './savedMediaReplacement';

describe('saved Cloudflare media cleanup', () => {
  test('replacement commits the new URL before deleting the old Cloudflare file', async () => {
    const calls: string[] = [];
    await replaceSavedMedia({ oldUrl: 'old-cloudflare.png', upload: async () => 'new-cloudflare.png',
      save: async url => { calls.push(`save:${url}`); },
      cleanup: async url => { calls.push(`delete:${url}`); return true; } });
    expect(calls).toEqual(['save:new-cloudflare.png', 'delete:old-cloudflare.png']);
  });
  test('removal clears the saved URL and deletes the Cloudflare file', async () => {
    const calls: string[] = [];
    const result = await replaceSavedMedia({ oldUrl: 'old-cloudflare.png',
      save: async url => { calls.push(`save:${url}`); },
      cleanup: async url => { calls.push(`delete:${url}`); return true; } });
    expect(calls).toEqual(['save:', 'delete:old-cloudflare.png']);
    expect(result).toEqual({ url: '', cleanupPending: false });
  });
  test('failed save preserves the previous file and cleans up the unused upload', async () => {
    const deleted: string[] = [];
    await expect(replaceSavedMedia({ oldUrl: 'old-cloudflare.png', upload: async () => 'new-cloudflare.png',
      save: async () => { throw new Error('save failed'); },
      cleanup: async url => { deleted.push(url); return true; } })).rejects.toThrow('save failed');
    expect(deleted).toEqual(['new-cloudflare.png']);
  });
  test('deletion errors are reported instead of claiming successful cleanup', async () => {
    const result = await replaceSavedMedia({ oldUrl: 'old-cloudflare.png', save: async () => {},
      cleanup: async () => { throw new Error('Cloudflare unavailable'); } });
    expect(result.cleanupPending).toBe(true);
  });
});