import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import handler from './pricing-seo.js';

test('anonymous pricing uses bundled website HTML without fetching a protected deployment', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pricing-shell-'));
  const cwd = process.cwd();
  const originalFetch = globalThis.fetch;
  const requests = [];
  try {
    await mkdir(join(directory, 'dist'));
    await writeFile(join(directory, 'dist/index.html'), '<!doctype html><html><head><title>Workly India</title><link rel="canonical" href="https://worklyindia.devs.surf/"><script type="module" src="/assets/app.js"></script></head><body><div id="root"></div></body></html>');
    process.chdir(directory);
    globalThis.fetch = async (url, options) => {
      requests.push({ url, options });
      return new Response(JSON.stringify({ jobs: { duration_packages: [{ months: 1, points: 160 }] } }));
    };
    const response = { headers: {}, code: 0, body: '', setHeader(key, value) { this.headers[key] = value; }, status(code) { this.code = code; return this; }, send(body) { this.body = body; return this; } };
    await handler({ query: {} }, response);
    assert.equal(response.code, 200);
    assert.match(response.body, /₹160/);
    assert.match(response.body, /id="public-pricing"/);
    assert.match(response.body, /src="\/assets\/app.js"/);
    assert.match(response.body, /https:\/\/worklyindia\.devs\.surf\/pricing/);
    assert.equal(requests.length, 1);
    assert.match(requests[0].url, /supabase\.co\/rest\/v1\/rpc\/get_public_pricing$/);
    assert.equal(requests[0].options.headers.Authorization, undefined);
    assert.equal(response.headers['Cache-Control'], 'no-store');
  } finally {
    globalThis.fetch = originalFetch;
    process.chdir(cwd);
    await rm(directory, { recursive: true, force: true });
  }
});