import { handleR2Buckets, r2Management } from './r2Buckets.ts';
const assert = (value: boolean, message: string) => { if (!value) throw new Error(message); };
const makeApi = (handle: (req: Request) => Promise<Response>) => r2Management('0'.repeat(32), 'test-only-placeholder', (input, init) => handle(new Request(input, init)));
const ok = (result: unknown) => new Response(JSON.stringify({ success: true, result }));
Deno.test('R2 bucket create is private; public update and delete route correctly', async () => {
  const methods: string[] = [];
  const api = makeApi(async (req) => {
    methods.push(req.method);
    if (req.method === 'POST') assert((await req.json()).name === 'website', 'create body');
    if (req.method === 'PUT') assert((await req.json()).enabled === true && req.url.endsWith('/website/domains/managed'), 'visibility update');
    return ok({});
  });
  for (const body of [{ action: 'r2-sa-create-bucket', name: 'website' }, { action: 'r2-sa-update-bucket', name: 'website', public: true }, { action: 'r2-sa-delete-bucket', name: 'website' }]) {
    const res = await handleR2Buckets(body, api, {}); assert(res.status === 200, 'success'); await res.text();
  }
  assert(methods.join(',') === 'POST,PUT,DELETE', 'provider operations');
});
Deno.test('R2 bucket list preserves pagination and actual public state', async () => {
  const api = makeApi(async (req) => req.url.includes('domains/managed') ? ok({ enabled: req.url.includes('/first/') }) : ok({ buckets: [{ name: req.url.includes('cursor=next') ? 'second' : 'first' }], cursor: req.url.includes('cursor=next') ? '' : 'next' }));
  const res = await handleR2Buckets({ action: 'r2-sa-list-buckets' }, api, {});
  const data = await res.json(); assert(data.buckets.length === 2 && data.buckets[0].public && !data.buckets[1].public, 'list and visibility');
});
Deno.test('R2 rejects invalid bucket names and propagates provider permission failure without retry', async () => {
  let calls = 0;
  const api = makeApi(async () => { calls++; return new Response(JSON.stringify({ success: false, errors: [{ message: 'Missing permission' }] }), { status: 403 }); });
  const invalid = await handleR2Buckets({ action: 'r2-sa-delete-bucket', name: '../other' }, api, {}); assert(invalid.status === 400 && calls === 0, 'validation'); await invalid.text();
  try { await handleR2Buckets({ action: 'r2-sa-delete-bucket', name: 'website' }, api, {}); throw new Error('expected failure'); }
  catch (e) { assert(e instanceof Error && e.message.includes('Workers R2 Storage') && calls === 1, 'permission surfaced without retry'); }
});Deno.test('R2 create honours Public switch and saves a per-bucket max file size', async () => {
  const calls: string[] = [];
  const api = makeApi(async (req) => { calls.push(`${req.method} ${new URL(req.url).pathname.split('/r2/buckets')[1]}`); return ok({}); });
  let saved: Record<string, number> = {};
  const limits = { read: async () => saved, write: async (m: Record<string, number>) => { saved = m; } };
  await (await handleR2Buckets({ action: 'r2-sa-create-bucket', name: 'photos', public: true, fileSizeLimitMb: 5 }, api, {}, undefined, limits)).text();
  assert(calls.join('|') === 'POST |PUT /photos/domains/managed', 'public enabled after create');
  assert(saved.photos === 5 * 1024 * 1024, 'limit saved in bytes');
  calls.length = 0;
  await (await handleR2Buckets({ action: 'r2-sa-create-bucket', name: 'secret', public: false, fileSizeLimitMb: 5 }, api, {}, undefined, limits)).text();
  assert(calls.join('|') === 'POST ', 'private create makes no visibility call');
  await (await handleR2Buckets({ action: 'r2-sa-update-bucket', name: 'photos', fileSizeLimitMb: 2048 }, api, {}, undefined, limits)).text();
  assert(saved.photos === 2048 * 1024 * 1024, 'large limits saved');
  await (await handleR2Buckets({ action: 'r2-sa-update-bucket', name: 'photos', fileSizeLimitMb: 0 }, api, {}, undefined, limits)).text();
  assert(saved.photos === undefined, 'no limit clears saved value');
});
