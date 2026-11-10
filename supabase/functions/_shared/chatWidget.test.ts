import { expect, mock, test } from 'bun:test';

mock.module('npm:@supabase/supabase-js@2/cors', () => ({ corsHeaders: { 'Access-Control-Allow-Origin': '*' } }));
const { handlePublicWidget, handleWidgetManage } = await import('./chatWidget');

test('removed AI visitor chat returns 410 and never accesses owner data', async () => {
  const admin = new Proxy({}, { get() { throw new Error('Retired widget must not access data'); } });
  for (const action of ['config', 'history', 'send', 'sync']) {
    const response = await handlePublicWidget(new Request('https://example.com'), { action, text: 'Hello' }, admin);
    expect(response.status).toBe(410);
    expect((await response.json()).success).toBe(false);
  }
});

test('retired visitor management cannot send messages or reenable AI', async () => {
  const admin = new Proxy({}, { get() { throw new Error('Retired management must not access data'); } });
  for (const action of ['reply', 'set_ai']) {
    const response = await handleWidgetManage(new Request('https://example.com'), { action }, admin);
    expect(response.status).toBe(410);
  }
});
test('widget PIN must be exactly 6 digits', async () => {
  const { isValidPin } = await import('./chatWidget');
  expect(isValidPin('123456')).toBe(true);
  expect(isValidPin('12345')).toBe(false);
  expect(isValidPin('1234567')).toBe(false);
  expect(isValidPin('12a456')).toBe(false);
});

test('widget works only with an active, unexpired subscription', async () => {
  const { hasActiveSubscription } = await import('./chatWidget');
  const now = Date.parse('2026-10-11T00:00:00Z');
  expect(hasActiveSubscription([], now)).toBe(false);
  expect(hasActiveSubscription([{ status: 'cancelled', expires_at: null }], now)).toBe(false);
  expect(hasActiveSubscription([{ status: 'active', expires_at: '2026-10-10T00:00:00Z' }], now)).toBe(false);
  expect(hasActiveSubscription([{ status: 'active', expires_at: '2026-11-10T00:00:00Z' }], now)).toBe(true);
});

test('per-message widget charging is removed', async () => {
  const admin = new Proxy({}, { get() { throw new Error('must not access data'); } });
  const response = await handleWidgetManage(new Request('https://example.com'), { action: 'charge' }, admin);
  expect(response.status).toBe(410);
});
