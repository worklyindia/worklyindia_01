import { assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { identifyTokenOwner } from './socialTokenOwner.ts';

Deno.test('X identity uses only the supplied token and returns its account', async () => {
  const request: typeof fetch = async (url, init) => {
    assertEquals(String(url), 'https://api.x.com/2/users/me?user.fields=profile_image_url');
    const headers = init && 'headers' in init ? init.headers : undefined;
    assertEquals(new Headers(headers).get('Authorization'), 'Bearer test-user-token');
    return Response.json({ data: { id: 'account-2', name: 'Second account', username: 'second' } });
  };
  const owner = await identifyTokenOwner('x', 'test-user-token', request);
  assertEquals(owner?.id, 'account-2');
  assertEquals(owner?.handle, 'second');
});

Deno.test('LinkedIn identity uses its subject as the account id', async () => {
  const request: typeof fetch = async () => Response.json({ sub: 'linkedin-2', name: 'Member', email: 'member@example.com' });
  const owner = await identifyTokenOwner('linkedin', 'test-token', request);
  assertEquals(owner?.id, 'linkedin-2');
});

Deno.test('GitHub and GitLab normalize numeric ids and profile artwork', async () => {
  for (const platform of ['github', 'gitlab']) {
    const request: typeof fetch = async () => Response.json({ id: 42, login: 'member', avatar_url: 'https://example.com/avatar.png' });
    const owner = await identifyTokenOwner(platform, 'test-token', request);
    assertEquals(owner?.id, '42');
    assertEquals(owner?.picture, 'https://example.com/avatar.png');
  }
});

Deno.test('Invalid tokens and missing identities do not fall back to another account', async () => {
  const denied: typeof fetch = async () => new Response(null, { status: 401 });
  await assertRejects(() => identifyTokenOwner('x', 'test-token', denied), Error, 'RECONNECT_REQUIRED');
  const empty: typeof fetch = async () => Response.json({ data: {} });
  await assertRejects(() => identifyTokenOwner('x', 'test-token', empty), Error, 'identity missing');
});

Deno.test('Other provider-specific linking paths are unchanged', async () => {
  const request: typeof fetch = () => { throw new Error('Unexpected identity request'); };
  assertEquals(await identifyTokenOwner('discord', 'test-token', request), null);
});