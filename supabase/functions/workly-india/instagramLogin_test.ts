import { assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { exchangeInstagramLogin, instagramTokenResponse } from '../_shared/instagramLogin.ts';
Deno.test('Instagram normalizes flat and wrapped tokens', () => {
  assertEquals(instagramTokenResponse({ access_token: 'flat' }).access_token, 'flat');
  assertEquals(instagramTokenResponse({ data: [{ access_token: 'wrapped' }] }).access_token, 'wrapped');
});
Deno.test('Instagram code POST, unversioned long-token GET, current profile request', async () => {
  const original = globalThis.fetch;
  const requests: Array<{ url: URL; method: string }> = [];
  globalThis.fetch = (input, init) => {
    requests.push({ url: new URL(String(input)), method: (init as { method?: string } | undefined)?.method || 'GET' });
    return Promise.resolve(Response.json(requests.length === 1 ? { data: [{ access_token: 'short', user_id: '42' }] } : requests.length === 2 ? { access_token: 'long' } : { user_id: '42', username: 'business' }));
  };
  try {
    const result = await exchangeInstagramLogin('app', 'secret', 'code', 'https://example.com');
    assertEquals(result.token, 'long'); assertEquals(result.userId, '42');
    assertEquals(requests[0].method, 'POST'); assertEquals(requests[1].url.pathname, '/access_token'); assertEquals(requests[1].method, 'GET');
    assertEquals(requests[1].url.searchParams.get('access_token'), 'short');
    assertEquals(requests[2].url.pathname, '/v25.0/me'); assertEquals(requests[2].url.searchParams.get('access_token'), 'long');
  } finally { globalThis.fetch = original; }
});
Deno.test('Instagram failure is terminal without short-token fallback', async () => {
  const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = () => Promise.resolve(++calls === 1 ? Response.json({ access_token: 'short' }) : Response.json({ error: { message: 'Unsupported request - method type: get' } }, { status: 400 }));
  try {
    await assertRejects(() => exchangeInstagramLogin('app', 'secret', 'code', 'https://example.com'), Error, 'long-lived token exchange [400]: This Instagram account is not allowed');
    assertEquals(calls, 2);
  } finally { globalThis.fetch = original; }
});
