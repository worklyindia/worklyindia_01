// The developer limits screen must show Meta's current tier for every number it lists —
// the employer's own numbers and each sub-account's numbers. These tests run the real
// overview with a fake Meta and a fake database, so a screen can never drift from Meta.
import { assertEquals } from 'jsr:@std/assert';
import { whatsappLimitsOverview } from '../_shared/whatsappRateLimit.ts';

const realFetch = globalThis.fetch;

function stubFetch(byNumber: Record<string, { whatsapp_business_manager_messaging_limit: string; quality_rating: string }>) {
  globalThis.fetch = (async (input: unknown) => {
    const url = String(input);
    const hit = Object.keys(byNumber).find((pid) => url.includes(`/${pid}?`));
    if (!hit) return new Response(JSON.stringify({ error: { message: 'not found' } }), { status: 404 });
    return new Response(JSON.stringify({ id: hit, ...byNumber[hit] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
}

type Filter = (row: any) => boolean;

/** A database stand-in that really applies the filters the overview asks for. */
function fakeDb(tables: Record<string, any[]>) {
  return {
    rpc: async (name: string) =>
      name === 'get_whatsapp_send_usage'
        ? { data: { used: 7, window_start: '2026-10-08T00:00:00Z', resets_at: '2026-10-09T00:00:00Z' }, error: null }
        : { data: null, error: null },
    from(name: string) {
      const rows = tables[name] ?? [];
      const filters: Filter[] = [];
      const b: any = {
        _patch: null as any,
        update(patch: any) { b._patch = patch; return b; },
        select() { return b; },
        eq(field: string, value: unknown) { filters.push((r) => String(r[field]) === String(value)); return b; },
        not(field: string, op: string, value: unknown) {
          filters.push((r) => (op === 'is' && value === null ? r[field] !== null && r[field] !== undefined : r[field] !== value));
          return b;
        },
        gte(field: string, value: unknown) { filters.push((r) => String(r[field]) >= String(value)); return b; },
        in(field: string, list: unknown[]) { filters.push((r) => list.some((v) => String(v) === String(r[field]))); return b; },
        order() { return b; },
        limit() { return b; },
        maybeSingle() {
          const hit = rows.find((r) => filters.every((f) => f(r)));
          return Promise.resolve({ data: hit ?? null, error: null });
        },
        then(resolve: (v: unknown) => void) {
          const matched = rows.filter((r) => filters.every((f) => f(r)));
          if (b._patch) for (const r of matched) Object.assign(r, b._patch);
          resolve({ data: matched, error: null });
        },
      };
      return b;
    },
  };
}

/** Fixture for one developer with one employer number and one sub-account number. */
function tables(pid: string, subPid: string) {
  const recent = new Date(Date.now() - 3600_000).toISOString();
  return {
    companies: [{ id: 'c1', user_id: 'dev-1' }],
    employer_whatsapp_accounts: [{
      id: 'a1', company_id: 'c1', phone_number_id: pid, display_phone: '+919999999999',
      verified_name: 'Workly', quality_rating: 'GREEN', messaging_tier: 'TIER_250', status: 'connected',
    }],
    employer_whatsapp_tokens: [{ company_id: 'c1', phone_number_id: pid, access_token: 'tok-emp' }],
    developer_sub_accounts: [{
      id: 's1', developer_user_id: 'dev-1', external_id: 'ext-1', name: 'Shop',
      status: 'connected', created_at: '2026-01-01',
    }],
    developer_sub_account_numbers: [{
      sub_account_id: 's1', phone_number_id: subPid, display_phone: '+918888888888',
      verified_name: 'Shop', quality_rating: 'GREEN', messaging_tier: 'TIER_250', status: 'connected',
    }],
    developer_sub_account_tokens: [{ phone_number_id: subPid, access_token: 'tok-sub' }],
    whatsapp_messages: [
      { whatsapp_phone_number_id: pid, recipient_phone: '+917000000001', direction: 'outbound', created_at: recent },
      { whatsapp_phone_number_id: pid, recipient_phone: '+917000000002', direction: 'outbound', created_at: recent },
      { whatsapp_phone_number_id: subPid, recipient_phone: '+917000000003', direction: 'outbound', created_at: recent },
    ],
  };
}

Deno.test('limits overview shows the tier Meta granted, not the one stored at connect time', async () => {
  const [pid, subPid] = ['7001', '7002'];
  const t = tables(pid, subPid);
  stubFetch({
    [pid]: { whatsapp_business_manager_messaging_limit: 'TIER_1K', quality_rating: 'GREEN' },
    [subPid]: { whatsapp_business_manager_messaging_limit: 'TIER_10K', quality_rating: 'GREEN' },
  });
  const overview = await whatsappLimitsOverview(fakeDb(t), 'dev-1', null);
  globalThis.fetch = realFetch;

  const emp = (overview as any).account.numbers[0];
  assertEquals(emp.limit_24h, 1000, 'a number Meta raised to 1K must show 1000, not the stored 250');
  assertEquals(emp.tier, 'TIER_1K');
  assertEquals(emp.remaining_24h, 993, 'remaining must use Meta\'s limit and the real usage');
  assertEquals(emp.next_tier_at, 500, 'the next tier needs half of the live limit in unique customers');
  assertEquals(emp.used_24h, 7);
  assertEquals(emp.unique_customers_7d, 2);
  assertEquals(emp.quality_rating, 'GREEN');

  const sub = (overview as any).sub_accounts[0].numbers[0];
  assertEquals(sub.limit_24h, 10000, 'a sub-account number Meta raised must show its own live limit');
  assertEquals(sub.tier, 'TIER_10K');
  assertEquals(sub.unique_customers_7d, 1);
  assertEquals((overview as any).sub_accounts[0].used_24h, 7, 'the sub-account total must still be listed');

  assertEquals(t.employer_whatsapp_accounts[0].messaging_tier, 'TIER_1K', 'Meta\'s answer must be stored for the send path');
  assertEquals(t.developer_sub_account_numbers[0].messaging_tier, 'TIER_10K');
});

Deno.test('limits overview keeps the stored tier when Meta is unreachable', async () => {
  const [pid, subPid] = ['7101', '7102'];
  const t = tables(pid, subPid);
  globalThis.fetch = (async () => new Response('{}', { status: 503 })) as typeof fetch;
  const overview = await whatsappLimitsOverview(fakeDb(t), 'dev-1', null);
  globalThis.fetch = realFetch;

  assertEquals((overview as any).account.numbers[0].limit_24h, 250, 'an outage must not silently change what the page shows');
  assertEquals((overview as any).sub_accounts[0].numbers[0].limit_24h, 250);
  assertEquals(t.employer_whatsapp_accounts[0].messaging_tier, 'TIER_250');
  assertEquals(t.developer_sub_account_numbers[0].messaging_tier, 'TIER_250');
});

Deno.test('tier mapping matches every tier Meta returns, including TIER_2K', async () => {
  const { tierLimitFromMeta } = await import('../_shared/whatsappRateLimit.ts');
  assertEquals(tierLimitFromMeta('TIER_250'), 250);
  assertEquals(tierLimitFromMeta('TIER_1K'), 1000);
  assertEquals(tierLimitFromMeta('TIER_2K'), 2000, 'Meta\'s 2000 tier must show 2000, not fall back to 250');
  assertEquals(tierLimitFromMeta('TIER_10K'), 10000);
  assertEquals(tierLimitFromMeta('TIER_100K'), 100000);
  assertEquals(tierLimitFromMeta('UNTIERED'), 250);
  assertEquals(tierLimitFromMeta(null), 250);
});

Deno.test('limits overview lists only connected sub-accounts', async () => {
  const [pid, subPid] = ['7201', '7202'];
  const t = tables(pid, subPid);
  t.developer_sub_accounts.push({ id: 's2', developer_user_id: 'dev-1', external_id: 'ext-2', name: 'Old', status: 'disconnected', created_at: '2026-01-02' });
  stubFetch({
    [pid]: { whatsapp_business_manager_messaging_limit: 'TIER_250', quality_rating: 'GREEN' },
    [subPid]: { whatsapp_business_manager_messaging_limit: 'TIER_250', quality_rating: 'GREEN' },
  });
  const overview = await whatsappLimitsOverview(fakeDb(t), 'dev-1', null);
  globalThis.fetch = realFetch;

  assertEquals((overview as any).sub_accounts.length, 1, 'a disconnected sub-account must not be listed');
  assertEquals((overview as any).sub_accounts[0].external_id, 'ext-1');
});

Deno.test('limits overview follows Meta tiers 250, 2000, 10000, 100000, Unlimited with the right next step', async () => {
  const steps: [string, number, number, number | null][] = [
    ['TIER_250', 250, 0, 2000],
    ['TIER_2K', 2000, 1000, 10000],
    ['TIER_10K', 10000, 5000, 100000],
    ['TIER_100K', 100000, 50000, 1000000],
    ['TIER_UNLIMITED', 1000000, 0, null],
  ];
  for (const [i, [tier, limit, nextAt, nextLimit]] of steps.entries()) {
    const pid = `78${i}1`;
    const t = tables(pid, `78${i}2`);
    stubFetch({
      [pid]: { whatsapp_business_manager_messaging_limit: tier, quality_rating: 'GREEN' },
      [`78${i}2`]: { whatsapp_business_manager_messaging_limit: 'TIER_250', quality_rating: 'GREEN' },
    });
    const overview = await whatsappLimitsOverview(fakeDb(t), 'dev-1', null);
    globalThis.fetch = realFetch;
    const row = (overview as any).account.numbers[0];
    assertEquals(row.limit_24h, limit, tier);
    assertEquals(row.next_tier_at, nextAt, `${tier} unique-customer target`);
    assertEquals(row.next_limit, nextLimit, `${tier} next limit`);
    assertEquals(row.unlimited, tier === 'TIER_UNLIMITED');
  }
});
