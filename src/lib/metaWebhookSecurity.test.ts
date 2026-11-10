import { expect, test } from 'bun:test';
import { metaSubscriptionTarget, validMetaSignature } from '../../supabase/functions/_shared/metaWebhookSecurity';

test('Instagram Login subscribes the selected IG account to comments and messages', () => {
  expect(metaSubscriptionTarget('instagram', true, 'page', 'instagram-a')).toEqual({ instagram: true, path: '/instagram-a/subscribed_apps', fields: 'comments,messages,message_reactions' });
});
test('Facebook Login never sends Instagram comments fields to a Facebook Page', () => {
  expect(metaSubscriptionTarget('instagram', false, 'page-a', 'instagram-a')).toEqual({ instagram: false, path: '/page-a/subscribed_apps', fields: 'feed,messages,message_reactions,message_echoes' });
});
test('Facebook comments subscribe through the Page feed', () => {
  expect(metaSubscriptionTarget('facebook', false, 'page-a').fields.split(',')).toContain('feed');
});
test('Webhook rejects a missing signature or signing credential', async () => {
  expect(await validMetaSignature('{}', null, 'test-only-key')).toBe(false);
  expect(await validMetaSignature('{}', 'sha256=' + '0'.repeat(64), '')).toBe(false);
});
test('Webhook verifies only the matching app signature', async () => {
  const raw = '{"object":"instagram"}';
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('test-only-key'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw)));
  const signature = 'sha256=' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  expect(await validMetaSignature(raw, signature, 'test-only-key')).toBe(true);
  expect(await validMetaSignature(raw, signature, 'other-test-key')).toBe(false);
  expect(await validMetaSignature(raw + ' ', signature, 'test-only-key')).toBe(false);
});