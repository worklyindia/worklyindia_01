// Meta-style tiered rate limiting for WhatsApp sends.
// Mirrors Meta's own behavior: 24h messaging-tier caps (250/1K/10K/100K), per-second
// burst protection, and automatic throttling when a number's quality rating drops.
// Enforced per developer API key, per sub-account, and per phone number — whichever
// limit is hit first blocks the send, so one bad actor can never affect others.

import { syncWhatsappTiersFromMeta, isNumberMetaBlocked, isMetaBlockedStatus, normalizeTier } from './whatsappTierSync.ts';

export type WhatsappScope = {
  apiKeyId?: string | null;
  subAccountId?: string | null;
  phoneNumberId?: string | null;
};

export type WhatsappLimitResult = {
  allowed: boolean;
  reason?: 'tier_limit' | 'burst_limit' | 'meta_blocked';
  scope?: string;
  used?: number;
  limit?: number;
  remaining?: number;
  resets_at?: string;
  retry_after_seconds?: number;
};

// Meta messaging tiers → conversations per rolling 24h.
const TIER_LIMITS: Record<string, number> = {
  TIER_50: 50,
  TIER_250: 250,
  TIER_1K: 1000,
  TIER_2K: 2000,
  TIER_10K: 10000,
  TIER_100K: 100000,
  TIER_UNLIMITED: 1000000,
  UNTIERED: 250,
  NOT_APPLICABLE: 250,
};

export function tierLimitFromMeta(messagingTier: string | null | undefined): number {
  if (!messagingTier) return 250; // safest default, same as Meta's starting tier
  return TIER_LIMITS[normalizeTier(messagingTier) ?? ''] ?? 250;
}

const BURST_PER_SECOND = 20; // conservative; Meta's standard throughput is ~80 msgs/sec

async function consumeOne(
  db: any,
  scope: 'api_key' | 'sub_account' | 'phone_number',
  scopeId: string,
  tierLimit: number,
  quality: string | null,
): Promise<WhatsappLimitResult> {
  const { data, error } = await db.rpc('consume_whatsapp_send', {
    _scope: scope,
    _scope_id: scopeId,
    _tier_limit: tierLimit,
    _burst_limit: BURST_PER_SECOND,
    _quality: quality,
  });
  if (error || !data) {
    console.error('consume_whatsapp_send failed', scope, error);
    // Fail closed on the phone-number scope (protects Meta rating); fail open is
    // never acceptable for shared-quality infrastructure.
    return { allowed: false, reason: 'tier_limit', scope, used: 0, limit: 0, remaining: 0 };
  }
  return { ...(data as WhatsappLimitResult), scope };
}

// Checks every applicable scope; the first denial wins. Counters for later scopes
// are only incremented when all earlier scopes allow the send.
export async function consumeWhatsappSend(
  db: any,
  scope: WhatsappScope,
  opts: { tierLimit?: number; quality?: string | null } = {},
): Promise<WhatsappLimitResult> {
  const tierLimit = opts.tierLimit ?? 250;
  const quality = opts.quality ?? null;
  if (scope.phoneNumberId && await isNumberMetaBlocked(db, scope.phoneNumberId)) {
    return { allowed: false, reason: 'meta_blocked', scope: 'phone_number', used: 0, limit: 0, remaining: 0 };
  }
  if (scope.apiKeyId) {
    const r = await consumeOne(db, 'api_key', scope.apiKeyId, tierLimit, quality);
    if (!r.allowed) return r;
  }
  if (scope.subAccountId) {
    const r = await consumeOne(db, 'sub_account', scope.subAccountId, tierLimit, quality);
    if (!r.allowed) return r;
  }
  if (scope.phoneNumberId) {
    const r = await consumeOne(db, 'phone_number', scope.phoneNumberId, tierLimit, quality);
    if (!r.allowed) return r;
  }
  return { allowed: true };
}

// Current 24h usage for a scope, for self-serve status responses.
export async function whatsappSendUsage(db: any, scope: string, scopeId: string) {
  const { data, error } = await db.rpc('get_whatsapp_send_usage', { _scope: scope, _scope_id: scopeId });
  if (error) { console.error('get_whatsapp_send_usage failed', error); return null; }
  return data as { used: number; window_start: string; resets_at?: string };
}

// Self-serve 429 payload: the developer sees exactly what happened and when it resets,
// so they never need to contact support for a rate limit.
export function whatsappLimitError(r: WhatsappLimitResult) {
  return {
    success: false,
    error: r.reason === 'meta_blocked'
      ? 'This WhatsApp number is blocked by Meta. Sending and calls are paused until Meta unblocks it; it unlocks automatically then.'
      : r.reason === 'burst_limit'
      ? 'Sending too fast. Slow down to stay within the per-second throughput limit.'
      : 'WhatsApp sending limit reached for this number. Try again after the limit resets (see resets_at), usually within 24 hours.',
    reason: r.reason,
    scope: r.scope,
    used: r.used,
    limit: r.limit,
    remaining: r.remaining ?? 0,
    resets_at: r.resets_at ?? null,
    retry_after_seconds: r.reason === 'meta_blocked' ? null : (r.retry_after_seconds ?? 60),
  };
}

// Full self-serve overview for one developer: their API key, their own account's
// numbers, and every sub-account with its numbers — each with 24h usage and tier.
// Shared by the public API (x-api-key) and the Developer Portal page (JWT), so both
// always show identical numbers.
export async function whatsappLimitsOverview(db: any, devUserId: string, apiKeyId: string | null) {
  // Distinct customers messaged in the last 7 days — Meta upgrades a number to the
  // next tier when it reaches half its current limit in unique customers (GREEN quality).
  const uniqueCustomers7d = async (phoneNumberId: string | null): Promise<number> => {
    if (!phoneNumberId) return 0;
    try {
      const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      const { data } = await db.from('whatsapp_messages')
        .select('recipient_phone')
        .eq('whatsapp_phone_number_id', phoneNumberId)
        .eq('direction', 'outbound')
        .gte('created_at', since)
        .limit(1000);
      return new Set((data || []).map((r: any) => r.recipient_phone).filter(Boolean)).size;
    } catch { return 0; }
  };

  const numRow = async (n: any) => {
    // Meta's live tier/quality beats the stored copy: the column only moves when Meta's
    // webhook arrives, so a missed push must never make the site show a limit Meta no longer
    // honors (or hide one it already granted).
    const live = n?.phone_number_id ? liveTiers.get(String(n.phone_number_id)) : null;
    const tier = live?.messaging_tier ?? n?.messaging_tier ?? null;
    const quality = live?.quality_rating ?? n?.quality_rating ?? null;
    const metaStatus = live?.meta_status ?? n?.meta_status ?? null;
    const blocked = live?.meta_status ? isMetaBlockedStatus(live.meta_status) : !!n?.meta_blocked;
    const limit = tierLimitFromMeta(tier);
    const u = n?.phone_number_id ? await whatsappSendUsage(db, 'phone_number', n.phone_number_id) : null;
    const unique7d = await uniqueCustomers7d(n?.phone_number_id ?? null);
    return {
      phone_number_id: n?.phone_number_id ?? null,
      phone: n?.display_phone ?? null,
      verified_name: n?.verified_name ?? null,
      quality_rating: quality,
      meta_status: metaStatus,
      meta_blocked: blocked,
      tier: tier ?? 'TIER_250',
      limit_24h: limit,
      used_24h: u?.used ?? 0,
      remaining_24h: Math.max(limit - (u?.used ?? 0), 0),
      resets_at: u?.resets_at ?? null,
      unique_customers_7d: unique7d,
      unlimited: String(tier ?? '').toUpperCase() === 'TIER_UNLIMITED',
      // Meta: 250 -> 2,000 needs business verification (or 2,000 delivered messages in 30 days), so there is
      // no unique-customer target. 2,000 -> 10,000 -> 100,000 -> Unlimited are automatic once unique
      // customers in 7 days reach half of the current limit (1,000 / 5,000 / 50,000) with GREEN quality.
      next_tier_at: limit >= 1000 && limit < 1000000 ? Math.floor(limit / 2) : 0,
      next_limit: limit < 250 ? 250 : limit < 2000 ? 2000 : limit < 10000 ? 10000 : limit < 100000 ? 100000 : limit < 1000000 ? 1000000 : null,
    };
  };

  const keyUsage = apiKeyId ? await whatsappSendUsage(db, 'api_key', apiKeyId) : null;

  const { data: company } = await db.from('companies').select('id').eq('user_id', devUserId).limit(1).maybeSingle();
  let accountNumbers: any[] = [];
  const tokens = new Map<string, string>();
  if (company?.id) {
    const { data: nums } = await db.from('employer_whatsapp_accounts')
      .select('phone_number_id,display_phone,verified_name,quality_rating,messaging_tier,status,meta_status,meta_blocked')
      .eq('company_id', company.id).eq('status', 'connected').not('phone_number_id', 'is', null);
    accountNumbers = nums || [];
    const { data: toks } = await db.from('employer_whatsapp_tokens')
      .select('phone_number_id,access_token').eq('company_id', company.id);
    for (const t of toks || []) if (t?.phone_number_id && t?.access_token) tokens.set(String(t.phone_number_id), String(t.access_token));
  }

  // Only connected sub-accounts are listed; disconnected ones are removed, not kept around.
  const { data: subs } = await db.from('developer_sub_accounts')
    .select('id,external_id,name,status,created_at').eq('developer_user_id', devUserId).eq('status', 'connected').order('created_at', { ascending: true });
  // Lifetime-style usage: outbound messages in the last 30 days, per sub-account.
  const sent30d = async (subAccountId: string): Promise<number> => {
    try {
      const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      const { count } = await db.from('whatsapp_messages')
        .select('id', { count: 'exact', head: true })
        .eq('direction', 'outbound')
        .eq('metadata->>sub_account_id', subAccountId)
        .gte('created_at', since);
      return count ?? 0;
    } catch { return 0; }
  };

  const subRows: { sub: any; nums: any[]; used: number; resets_at: string | null; sent30d: number }[] = [];
  for (const s of subs || []) {
    const { data: nums } = await db.from('developer_sub_account_numbers')
      .select('phone_number_id,display_phone,verified_name,quality_rating,messaging_tier,meta_status,meta_blocked')
      .eq('sub_account_id', s.id).eq('status', 'connected').order('connected_at', { ascending: true });
    const su = await whatsappSendUsage(db, 'sub_account', s.id);
    subRows.push({ sub: s, nums: nums || [], used: su?.used ?? 0, resets_at: su?.resets_at ?? null, sent30d: await sent30d(s.id) });
  }

  const subNumbers = subRows.flatMap((r) => r.nums);
  const subPids = subNumbers.map((n: any) => n?.phone_number_id).filter(Boolean);
  if (subPids.length) {
    const { data: stoks } = await db.from('developer_sub_account_tokens')
      .select('phone_number_id,access_token').in('phone_number_id', subPids);
    for (const t of stoks || []) if (t?.phone_number_id && t?.access_token) tokens.set(String(t.phone_number_id), String(t.access_token));
  }

  // Meta owns a number's tier and quality rating; the database columns are only a cache that
  // moves when Meta's webhook arrives. Re-read both live and write them back before anything
  // is shown, so the page can never display a limit Meta has already raised or already lowered.
  const liveTiers = await syncWhatsappTiersFromMeta(
    db,
    [...accountNumbers, ...subNumbers].map((n: any) => ({
      phone_number_id: n?.phone_number_id ? String(n.phone_number_id) : null,
      token: n?.phone_number_id ? tokens.get(String(n.phone_number_id)) ?? null : null,
    })),
  );

  return {
    success: true,
    api_key: { used_24h: keyUsage?.used ?? 0, resets_at: keyUsage?.resets_at ?? null },
    account: { numbers: await Promise.all(accountNumbers.map(numRow)) },
    sub_accounts: await Promise.all(subRows.map(async (r) => ({
      sub_account_id: r.sub.id,
      external_id: r.sub.external_id,
      name: r.sub.name,
      status: r.sub.status,
      used_24h: r.used,
      sent_30d: r.sent30d,
      resets_at: r.resets_at,
      numbers: await Promise.all(r.nums.map(numRow)),
    }))),
  };
}
