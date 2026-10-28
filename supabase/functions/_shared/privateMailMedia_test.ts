import { assertEquals, assertNotEquals, assertStringIncludes } from 'jsr:@std/assert@1';
import { mailMediaPrefix } from './privateMailMedia.ts';

Deno.test('private email keys stay isolated by owner mailbox and message', async () => {
  const prefix = await mailMediaPrefix('owner-a', 'gmail:account-a', 'message-a');
  assertStringIncludes(prefix, 'mail/owner-a/');
  assertNotEquals(prefix, await mailMediaPrefix('owner-b', 'gmail:account-a', 'message-a'));
  assertNotEquals(prefix, await mailMediaPrefix('owner-a', 'gmail:account-b', 'message-a'));
  assertNotEquals(prefix, await mailMediaPrefix('owner-a', 'gmail:account-a', 'message-b'));
  assertEquals(prefix, await mailMediaPrefix('owner-a', 'gmail:account-a', 'message-a'));
});