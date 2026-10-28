import { test, expect } from 'bun:test';
import { cleanupConversationMedia } from './whatsappMediaCleanup';

test('whole chat deletion removes attachments beyond the first page', async () => {
  const removed: string[] = [];
  const rows = Array.from({ length: 501 }, (_, i) => ({ metadata: { media_url: `https://pub-example.r2.dev/media/chat-whatsapp/11111111-2222-3333-4444-555555555555/${i}.png` } }));
  await cleanupConversationMedia(['chat-1'], async (ids, from, to) => {
    expect(ids).toEqual(['chat-1']);
    return rows.slice(from, to + 1);
  }, async (url) => { removed.push(url); });
  expect(removed).toHaveLength(501);
  expect(removed[500]).toEndWith('/500.png');
});