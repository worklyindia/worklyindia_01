// Meta is the only authority on a WhatsApp number's messaging tier and quality rating.
// The copies in employer_whatsapp_accounts / developer_sub_account_numbers are a cache that
// only moves when Meta pushes a webhook, and webhooks are not guaranteed to arrive. A missed
// push would let the website show a limit Meta already lowered (sends then fail at Meta's end)
// or hide one Meta already granted (the owner loses messages they were allowed to send).
// So every time a limits screen or profile screen is opened, the live values are re-read from
// Meta and written straight back, keeping the website and Meta in step in both directions.
// Meta deprecated `messaging_limit_tier` (it keeps returning the old per-number value, e.g. TIER_250)
// after moving limits to the business portfolio on Oct 7, 2025. The real limit - the one WhatsApp
// Manager shows - is `whatsapp_business_manager_messaging_limit`, so that field is read first.
const GRAPH = 'https://graph.facebook.com/v25.0';
const LEGACY_GRAPH = 'https://graph.facebook.com/v21.0';
const FIELDS = 'quality_rating,whatsapp_business_manager_messaging_limit,status';
const LEGACY_FIELDS = 'quality_rating,messaging_limit_tier,status';

const NUMERIC_TIERS: Record<string, string> = {
  '50': 'TIER_50', '250': 'TIER_250', '1000': 'TIER_1K', '2000': 'TIER_2K',
  '10000': 'TIER_10K', '100000': 'TIER_100K',
};

/** Turn whatever Meta sends ("TIER_2K", "TIER_2000", "2000", "2,000") into one tier name. */
export function normalizeTier(v: unknown): string | null {
  if (typeof v === 'number' && Number.isFinite(v)) v = String(v);
  if (typeof v !== 'string') return null;
  const raw = v.trim().toUpperCase();
  if (!raw) return null;
  const digits = raw.replace(/^TIER_/, '').replace(/[,\s]/g, '');
  if (NUMERIC_TIERS[digits]) return NUMERIC_TIERS[digits];
  if (/^\d+K$/.test(digits)) return `TIER_${digits}`;
  if (digits === 'UNLIMITED') return 'TIER_UNLIMITED';
  return raw;
}

/** The current messaging tier from a Meta phone-number object: new field first, deprecated one only as fallback. */
export function readTier(obj: unknown): string | null {
  const o = (obj ?? {}) as Record<string, unknown>;
  return normalizeTier(o.whatsapp_business_manager_messaging_limit) ?? normalizeTier(o.messaging_limit_tier);
}
// Meta phone statuses where Meta refuses to send/call: the website mirrors the block and lifts it
// automatically as soon as Meta reports the number usable again.
const BLOCKED_STATUSES = new Set(['BANNED', 'RESTRICTED', 'FLAGGED', 'DELETED', 'DISCONNECTED']);
export function isMetaBlockedStatus(status?: string | null): boolean {
  return !!status && BLOCKED_STATUSES.has(String(status).toUpperCase());
}
const TTL_MS = 60 * 1000; // one page load per minute per number is enough to stay in step
const MAX_NUMBERS = 12; // a page never needs to re-check more numbers than this at once
const TIMEOUT_MS = 4000;

export type LiveTier = { quality_rating: string | null; messaging_tier: string | null; meta_status?: string | null };

// Per-instance cache so refreshing the page a few times does not add Graph calls every time.
const cache = new Map<string, { at: number; live: LiveTier }>();

function fresh(pid: string): LiveTier | null {
  const hit = cache.get(pid);
  if (!hit || Date.now() - hit.at > TTL_MS) return null;
  return hit.live;
}

/**
 * Meta's tier/quality for a number if this instance learned it moments ago, else null.
 * The send path uses this so it enforces what Meta last said even if a webhook was missed.
 * Cheap and offline: never touches the network.
 */
export function peekCachedTier(phoneNumberId?: string | null): LiveTier | null {
  if (!phoneNumberId) return null;
  return fresh(String(phoneNumberId));
}

/** Read tier, quality and status live from Meta for one number (no cache, no database write). */
export async function fetchLiveTier(phoneNumberId: string, token: string): Promise<LiveTier | null> {
  return (await liveFields(phoneNumberId, token, GRAPH, FIELDS)) ?? (await liveFields(phoneNumberId, token, LEGACY_GRAPH, LEGACY_FIELDS));
}

async function liveFields(phoneNumberId: string, token: string, graph: string, fields: string): Promise<LiveTier | null> {
  try {
    const url = `${graph}/${phoneNumberId}?fields=${fields}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const j = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!j) return null;
    const quality = typeof j.quality_rating === 'string' && j.quality_rating ? j.quality_rating.toUpperCase() : null;
    const tier = readTier(j);
    const status = typeof j.status === 'string' && j.status ? j.status.toUpperCase() : null;
    if (!quality && !tier && !status) return null;
    return { quality_rating: quality, messaging_tier: tier, meta_status: status };
  } catch {
    return null; // Meta unreachable: keep the stored values, never invent new ones
  }
}

/** Store Meta's live tier/quality for one number (used by the profile screens, which already fetched it). */
export async function rememberLiveTier(
  db: any,
  phoneNumberId: string | null | undefined,
  live: LiveTier | null | undefined,
): Promise<void> {
  if (!phoneNumberId || !live) return;
  const patch: Record<string, unknown> = {};
  if (live.quality_rating) patch.quality_rating = live.quality_rating;
  if (live.messaging_tier) patch.messaging_tier = live.messaging_tier;
  if (live.meta_status) { patch.meta_status = live.meta_status; patch.meta_blocked = isMetaBlockedStatus(live.meta_status); }
  if (!Object.keys(patch).length) return;
  const pid = String(phoneNumberId);
  cache.set(pid, { at: Date.now(), live });
  patch.updated_at = new Date().toISOString();
  await Promise.all([
    db.from('employer_whatsapp_accounts').update(patch).eq('phone_number_id', pid),
    db.from('developer_sub_account_numbers').update(patch).eq('phone_number_id', pid),
  ]);
}

/**
 * Re-read Meta's tier and quality for every connected number and write them back.
 * Returns the live values (phone_number_id -> tier/quality) for callers to show immediately.
 * Never throws and never blocks a page: a number whose lookup fails keeps its stored values.
 */
export async function syncWhatsappTiersFromMeta(
  db: any,
  numbers: { phone_number_id: string | null; token: string | null }[],
): Promise<Map<string, LiveTier>> {
  const out = new Map<string, LiveTier>();
  const seen = new Set<string>();
  const jobs: Promise<void>[] = [];

  for (const n of numbers) {
    const pid = n.phone_number_id ? String(n.phone_number_id) : '';
    if (!pid || !n.token || seen.has(pid)) continue;
    seen.add(pid);
    if (jobs.length >= MAX_NUMBERS) break;
    jobs.push((async () => {
      const cached = fresh(pid);
      if (cached) { out.set(pid, cached); return; }
      const live = await fetchLiveTier(pid, n.token as string);
      if (!live) return;
      cache.set(pid, { at: Date.now(), live });
      out.set(pid, live);
      await rememberLiveTier(db, pid, live);
    })());
  }

  await Promise.all(jobs);
  return out;
}

/**
 * True when Meta has blocked this number (live cache first, else the stored flag).
 * Every send path checks this so the website never sends or calls through a number Meta blocked.
 */
export async function isNumberMetaBlocked(db: any, phoneNumberId?: string | null): Promise<boolean> {
  if (!phoneNumberId) return false;
  const pid = String(phoneNumberId);
  const live = fresh(pid);
  if (live?.meta_status) return isMetaBlockedStatus(live.meta_status);
  const [a, b] = await Promise.all([
    db.from('employer_whatsapp_accounts').select('meta_blocked').eq('phone_number_id', pid).eq('meta_blocked', true).limit(1),
    db.from('developer_sub_account_numbers').select('meta_blocked').eq('phone_number_id', pid).eq('meta_blocked', true).limit(1),
  ]);
  return !!((a?.data || []).length || (b?.data || []).length);
}

/** Daily backstop (cron -> workly-india scope tier_refresh): re-read every connected number from Meta. */
export async function refreshAllTiers(db: any): Promise<{ checked: number; updated: number }> {
  const tokens = new Map<string, string>();
  for (const table of ['employer_whatsapp_tokens', 'developer_sub_account_tokens']) {
    const { data } = await db.from(table).select('phone_number_id,access_token');
    for (const t of data || []) if (t?.phone_number_id && t?.access_token) tokens.set(String(t.phone_number_id), String(t.access_token));
  }
  const pids = new Set<string>();
  for (const table of ['employer_whatsapp_accounts', 'developer_sub_account_numbers']) {
    const { data } = await db.from(table).select('phone_number_id');
    for (const n of data || []) if (n?.phone_number_id) pids.add(String(n.phone_number_id));
  }
  const numbers = [...pids].map((pid) => ({ phone_number_id: pid, token: tokens.get(pid) ?? null })).filter((n) => n.token);
  let updated = 0;
  for (let i = 0; i < numbers.length; i += MAX_NUMBERS) {
    updated += (await syncWhatsappTiersFromMeta(db, numbers.slice(i, i + MAX_NUMBERS))).size;
  }
  return { checked: numbers.length, updated };
}
