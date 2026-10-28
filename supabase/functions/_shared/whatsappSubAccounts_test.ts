import { assertEquals } from 'jsr:@std/assert@1';
import { isAllowedReturnUrl, isSessionUsable, CONNECT_LINK_TTL_MS } from './whatsappSubAccounts.ts';

Deno.test('connect links last exactly 1 hour', () => assertEquals(CONNECT_LINK_TTL_MS, 3_600_000));
Deno.test('return_url must be https', () => {
  assertEquals(isAllowedReturnUrl('https://dev.example.com/done'), true);
  assertEquals(isAllowedReturnUrl('http://dev.example.com/done'), false);
  assertEquals(isAllowedReturnUrl('javascript:alert(1)'), false);
});
Deno.test('connect link works once and not after expiry', () => {
  const now = Date.now();
  assertEquals(isSessionUsable({ expires_at: new Date(now + 1000).toISOString(), used_at: null }, now), true);
  assertEquals(isSessionUsable({ expires_at: new Date(now + 1000).toISOString(), used_at: new Date(now).toISOString() }, now), false);
  assertEquals(isSessionUsable({ expires_at: new Date(now - 1).toISOString(), used_at: null }, now), false);
});
