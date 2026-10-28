// The website must never show a WhatsApp limit that disagrees with Meta, in either
// direction: Meta raising a tier has to reach the screen, and Meta lowering one has to
// reach it too. These tests drive the sync with a fake Meta and a fake database.
import { assert, assertEquals } from 'jsr:@std/assert';
import { syncWhatsappTiersFromMeta, peekCachedTier, normalizeTier, readTier } from '../_shared/whatsappTierSync.ts';
import { tierLimitFromMeta } from '../_shared/whatsappRateLimit.ts';

type Row = Record<string, unknown>;

function makeDb(tables: Record<string, Row[]>) {
  return {
    from(name: string) {
      const rows = tables[name] ?? (tables[name] = []);
      const builder: any = {
        _patch: null as Row | null,
        _field: '',
        _value: undefined as unknown,
        update(patch: Row) { builder._patch = patch; return builder; },
        eq(field: string, value: unknown) { builder._field = field; builder._value = value; return builder; },
        then(resolve: (v: unknown) => void) {
          for (const r of rows) {
            if (String(r[builder._field]) === String(builder._value)) Object.assign(r, builder._patch ?? {});
          }
          resolve({ data: null, error: null });
        },
      };
      return builder;
    },
  };
}

const realFetch = globalThis.fetch;
let calls = 0;

function stubFetch(body: unknown, ok = true) {
  globalThis.fetch = (async (input: unknown) => {
    calls++;
    return new Response(JSON.stringify(body), {
      status: ok ? 200 : 500,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
}

Deno.test('syncWhatsappTiersFromMeta: a tier Meta raised reaches the screen and the database', async () => {
  const pid = '9001';
  const tables: Record<string, Row[]> = {
    employer_whatsapp_accounts: [{ phone_number_id: pid, messaging_tier: 'TIER_250', quality_rating: 'GREEN' }],
    developer_sub_account_numbers: [{ phone_number_id: pid, messaging_tier: 'TIER_250', quality_rating: 'GREEN' }],
  };
  stubFetch({ id: pid, whatsapp_business_manager_messaging_limit: 'TIER_10K', quality_rating: 'green' });
  const out = await syncWhatsappTiersFromMeta(makeDb(tables), [{ phone_number_id: pid, token: 'tok' }]);
  globalThis.fetch = realFetch;

  assertEquals(out.get(pid)?.messaging_tier, 'TIER_10K', 'the raised tier must be shown');
  assertEquals(out.get(pid)?.quality_rating, 'GREEN');
  assertEquals(tables.employer_whatsapp_accounts[0].messaging_tier, 'TIER_10K', 'the raised tier must be stored');
  assertEquals(tables.developer_sub_account_numbers[0].messaging_tier, 'TIER_10K');
});

Deno.test('syncWhatsappTiersFromMeta: a tier Meta lowered reaches the screen and the database', async () => {
  const pid = '9002';
  const tables: Record<string, Row[]> = {
    employer_whatsapp_accounts: [{ phone_number_id: pid, messaging_tier: 'TIER_10K', quality_rating: 'GREEN' }],
    developer_sub_account_numbers: [{ phone_number_id: pid, messaging_tier: 'TIER_10K', quality_rating: 'GREEN' }],
  };
  stubFetch({ id: pid, whatsapp_business_manager_messaging_limit: 'TIER_1K', quality_rating: 'YELLOW' });
  const out = await syncWhatsappTiersFromMeta(makeDb(tables), [{ phone_number_id: pid, token: 'tok' }]);
  globalThis.fetch = realFetch;

  assertEquals(out.get(pid)?.messaging_tier, 'TIER_1K', 'the lowered tier must be shown, not the old higher one');
  assertEquals(tables.employer_whatsapp_accounts[0].messaging_tier, 'TIER_1K', 'the lowered tier must be stored');
  assertEquals(tables.employer_whatsapp_accounts[0].quality_rating, 'YELLOW');
});

Deno.test('syncWhatsappTiersFromMeta: when Meta cannot be reached nothing is invented or changed', async () => {
  const pid = '9003';
  const tables: Record<string, Row[]> = {
    employer_whatsapp_accounts: [{ phone_number_id: pid, messaging_tier: 'TIER_1K', quality_rating: 'GREEN' }],
    developer_sub_account_numbers: [{ phone_number_id: pid, messaging_tier: 'TIER_1K', quality_rating: 'GREEN' }],
  };
  stubFetch({ error: { message: 'service unavailable' } }, false);
  const out = await syncWhatsappTiersFromMeta(makeDb(tables), [{ phone_number_id: pid, token: 'tok' }]);
  globalThis.fetch = realFetch;

  assertEquals(out.size, 0, 'no live answer means nothing new to show');
  assertEquals(tables.employer_whatsapp_accounts[0].messaging_tier, 'TIER_1K', 'stored values must survive an outage');
  assertEquals(tables.employer_whatsapp_accounts[0].quality_rating, 'GREEN');
});

Deno.test('syncWhatsappTiersFromMeta: a second look within a minute reuses Meta\'s answer', async () => {
  const pid = '9004';
  const tables: Record<string, Row[]> = {
    employer_whatsapp_accounts: [{ phone_number_id: pid, messaging_tier: 'TIER_250', quality_rating: 'GREEN' }],
    developer_sub_account_numbers: [],
  };
  stubFetch({ id: pid, whatsapp_business_manager_messaging_limit: 'TIER_1K', quality_rating: 'GREEN' });
  const db = makeDb(tables);
  const first = await syncWhatsappTiersFromMeta(db, [{ phone_number_id: pid, token: 'tok' }]);
  const afterFirst = calls;
  const second = await syncWhatsappTiersFromMeta(db, [{ phone_number_id: pid, token: 'tok' }]);
  globalThis.fetch = realFetch;

  assertEquals(first.get(pid)?.messaging_tier, 'TIER_1K');
  assertEquals(second.get(pid)?.messaging_tier, 'TIER_1K', 'the page still gets Meta\'s answer on a reload');
  assertEquals(calls, afterFirst, 'a reload must not ask Meta again within the minute');
});

Deno.test('peekCachedTier: the send path sees Meta\'s latest word, and nothing for unknown numbers', async () => {
  const pid = '9005';
  const tables: Record<string, Row[]> = {
    employer_whatsapp_accounts: [{ phone_number_id: pid, messaging_tier: 'TIER_250', quality_rating: 'GREEN' }],
    developer_sub_account_numbers: [],
  };
  stubFetch({ id: pid, whatsapp_business_manager_messaging_limit: 'TIER_100K', quality_rating: 'RED' });
  await syncWhatsappTiersFromMeta(makeDb(tables), [{ phone_number_id: pid, token: 'tok' }]);
  globalThis.fetch = realFetch;

  assertEquals(peekCachedTier(pid)?.messaging_tier, 'TIER_100K', 'a send must be checked against Meta\'s current tier');
  assertEquals(peekCachedTier(pid)?.quality_rating, 'RED');
  assertEquals(peekCachedTier('9999'), null, 'a number nobody refreshed has no cached answer');
  assertEquals(peekCachedTier(null), null);
});

Deno.test('Meta shows 2000 while the deprecated field still says TIER_250: the page must show 2000', async () => {
  const pid = '9010';
  const tables: Record<string, Row[]> = {
    employer_whatsapp_accounts: [{ phone_number_id: pid, messaging_tier: 'TIER_250', quality_rating: 'GREEN' }],
    developer_sub_account_numbers: [],
  };
  stubFetch({ id: pid, messaging_limit_tier: 'TIER_250', whatsapp_business_manager_messaging_limit: 'TIER_2K', quality_rating: 'GREEN' });
  const out = await syncWhatsappTiersFromMeta(makeDb(tables), [{ phone_number_id: pid, token: 'tok' }]);
  globalThis.fetch = realFetch;

  assertEquals(out.get(pid)?.messaging_tier, 'TIER_2K');
  assertEquals(tables.employer_whatsapp_accounts[0].messaging_tier, 'TIER_2K');
  assertEquals(tierLimitFromMeta(out.get(pid)?.messaging_tier), 2000);
});

Deno.test('tier names Meta may send map to the real limits', () => {
  assertEquals(normalizeTier('2000'), 'TIER_2K');
  assertEquals(normalizeTier('TIER_2000'), 'TIER_2K');
  assertEquals(normalizeTier('tier_10k'), 'TIER_10K');
  assertEquals(readTier({ messaging_limit_tier: 'TIER_250' }), 'TIER_250');
  assertEquals(tierLimitFromMeta('TIER_UNLIMITED'), 1000000, 'unlimited must not fall back to 250');
  assertEquals(tierLimitFromMeta(null), 250);
});
