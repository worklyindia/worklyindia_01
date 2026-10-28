// Purchase pipeline against GoDaddy.
//
// Preferred path is the v3 quote-then-execute flow, which locks the real
// supplier price in a quoteToken. If the account/endpoint does not support v3
// (older API entitlement), we fall back to the officially documented v1
// purchase endpoint and record that fact on the order so profit is never
// derived from a stale search price.

import { godaddy, GoDaddyError } from "../_shared/godaddy/client.ts";
import { fromMicros } from "../_shared/godaddy/pricing.ts";

export interface SupplierQuote {
  /** Locked supplier price for the whole term, in USD. */
  totalUsd: number;
  /** Supplier cost of the FIRST year only, in USD (promotional on most TLDs). */
  firstYearUsd: number;
  renewalUsd: number | null;
  listUsd: number | null;
  currency: string;
  quoteToken: string | null;
  expiresAt: string | null;
  /** "v3_quote" when the price is locked, "v1_availability" when only estimated. */
  source: "v3_quote" | "v1_availability";
}


export interface AvailabilityResult {
  available: boolean;
  priceUsd: number;
  /** REAL renewal price per year reported by GoDaddy. 0 when not reported. */
  renewalUsd: number;
  currency: string;
  period: number;
  definitive: boolean;
}

export async function checkAvailability(domain: string, forTransfer = false): Promise<AvailabilityResult> {
  const res = await godaddy<Record<string, unknown>>({
    path: "/v1/domains/available",
    query: { domain, checkType: "FULL", forTransfer },
  });
  const out = {
    available: res.available === true,
    priceUsd: fromMicros(res.price),
    renewalUsd: fromMicros(res.renewalPrice),
    currency: String(res.currency ?? "USD"),
    period: Number(res.period ?? 1) || 1,
    definitive: res.definitive !== false,
  };
  // Verification trail: the RAW registrar figures behind every displayed price.
  console.log(
    `[godaddy-price] ${domain} available=${out.available} currency=${out.currency} ` +
      `price=${out.priceUsd} renewal=${out.renewalUsd} period=${out.period}`,
  );
  return out;
}

export async function bulkAvailability(domains: string[]): Promise<AvailabilityResult[] & { domain: string }[]> {
  try {
    return await bulkAvailabilityRaw(domains);
  } catch (e) {
    // GoDaddy rate-limits the bulk endpoint separately; fall back to
    // single-domain checks so search keeps working.
    if (!(e instanceof GoDaddyError) || e.status !== 429) throw e;
    const list = domains.slice(0, 10);
    const settled = await Promise.allSettled(list.map((d) => checkAvailability(d)));
    const out = settled
      .map((r, i) => (r.status === "fulfilled" ? { ...r.value, domain: list[i] } : null))
      .filter(Boolean);
    if (!out.length) throw e;
    return out as any;
  }
}

async function bulkAvailabilityRaw(domains: string[]): Promise<AvailabilityResult[] & { domain: string }[]> {
  const res = await godaddy<Record<string, unknown>>({
    path: "/v1/domains/available",
    method: "POST",
    // FULL is what makes GoDaddy return the real renewalPrice for each domain.
    query: { checkType: "FULL" },
    body: domains,
  });
  const list = (res.domains ?? []) as Record<string, unknown>[];
  const mapped = list.map((d) => ({
    domain: String(d.domain ?? "").toLowerCase(),
    available: d.available === true,
    priceUsd: fromMicros(d.price),
    renewalUsd: fromMicros(d.renewalPrice),
    currency: String(d.currency ?? "USD"),
    period: Number(d.period ?? 1) || 1,
    definitive: d.definitive !== false,
  }));
  console.log(
    "[godaddy-price] bulk " +
      mapped
        .map((m) => `${m.domain}:${m.available ? "free" : "taken"}:${m.currency}:${m.priceUsd}/${m.renewalUsd}x${m.period}`)
        .join(" | "),
  );
  return mapped as any;
}


/**
 * Locks the supplier price. Tries v3 quote first; falls back to a fresh v1
 * availability check when v3 is unavailable for this account.
 */
export async function getRegistrationQuote(params: {
  domain: string;
  period: number;
  privacy: boolean;
  /**
   * Supplier renewal cost per year in USD, used to price years 2..n on the v1
   * fallback path. GoDaddy's availability endpoint returns only the (usually
   * promotional) first-year price — multiplying it by the term would sell a
   * multi-year registration far below what the extra years actually cost us.
   */
  renewalUsdPerYear?: number | null;
}): Promise<SupplierQuote> {
  try {
    const res = await godaddy<Record<string, any>>({
      path: "/v3/domains/purchase/quote",
      method: "POST",
      body: {
        domain: params.domain,
        period: params.period,
        privacy: params.privacy,
        renewAuto: true,
      },
    });

    const total = fromMicros(res?.total ?? res?.price ?? res?.currentPrice?.total);
    if (total > 0) {
      const renewal = fromMicros(res?.renewalPrice ?? res?.renewal?.total) || null;
      const firstYear = fromMicros(res?.firstTermPrice?.total ?? res?.firstYearPrice) ||
        Math.max(0, total - (renewal ?? 0) * Math.max(0, params.period - 1)) ||
        total / Math.max(1, params.period);
      return {
        totalUsd: total,
        firstYearUsd: firstYear,
        renewalUsd: renewal,
        listUsd: fromMicros(res?.listPrice ?? res?.firstTermPrice?.list ?? res?.undiscountedTotal) || null,
        currency: String(res?.currency ?? "USD"),
        quoteToken: res?.quoteToken ? String(res.quoteToken) : null,
        expiresAt: res?.expiresAt ? new Date(String(res.expiresAt)).toISOString() : null,
        source: "v3_quote",
      };
    }
  } catch (e) {
    // 404 / 400 => v3 quote not available for this account; fall through.
    if (e instanceof GoDaddyError && ![400, 404, 405, 501].includes(e.status)) throw e;
  }

  const avail = await checkAvailability(params.domain);
  if (!avail.available) throw new GoDaddyError("That domain is no longer available.", 409, "UNAVAILABLE");
  if (avail.priceUsd <= 0) throw new GoDaddyError("GoDaddy did not return a price for this domain.", 502, "NO_PRICE");

  const period = Math.max(1, Number(params.period) || 1);
  const firstYearUsd = avail.priceUsd / (avail.period || 1);
  const renewalPerYear = Number(params.renewalUsdPerYear ?? 0) > 0
    ? Number(params.renewalUsdPerYear)
    : avail.renewalUsd;
  // Years 2..n cost the renewal rate, not the first-year promo rate.
  const extraYearUsd = Number.isFinite(renewalPerYear) && renewalPerYear > 0 ? renewalPerYear : firstYearUsd;

  return {
    totalUsd: firstYearUsd + extraYearUsd * (period - 1),
    firstYearUsd,
    renewalUsd: avail.renewalUsd > 0 ? avail.renewalUsd : null,
    listUsd: null,
    currency: avail.currency,
    quoteToken: null,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    source: "v1_availability",
  };
}


export interface ExecuteResult {
  orderId: string | null;
  operationId: string | null;
  status: string;
}

export async function executeRegistration(params: {
  domain: string;
  period: number;
  privacy: boolean;
  quoteToken: string | null;
  contact: Record<string, unknown>;
  consent: Record<string, unknown>;
}): Promise<ExecuteResult> {
  if (params.quoteToken) {
    const res = await godaddy<Record<string, any>>({
      path: "/v3/domains/purchase/execute",
      method: "POST",
      body: {
        quoteToken: params.quoteToken,
        contacts: {
          registrant: params.contact,
          admin: params.contact,
          tech: params.contact,
          billing: params.contact,
        },
        consent: params.consent,
      },
    });
    return {
      orderId: res?.orderId ? String(res.orderId) : null,
      operationId: res?.operationId ? String(res.operationId) : null,
      status: String(res?.status ?? "registration_pending"),
    };
  }

  const res = await godaddy<Record<string, any>>({
    path: "/v1/domains/purchase",
    method: "POST",
    body: {
      domain: params.domain,
      period: params.period,
      privacy: params.privacy,
      renewAuto: true,
      consent: params.consent,
      contactRegistrant: params.contact,
      contactAdmin: params.contact,
      contactTech: params.contact,
      contactBilling: params.contact,
    },
  });
  return {
    orderId: res?.orderId ? String(res.orderId) : null,
    operationId: null,
    status: "registration_pending",
  };
}

/** Confirms a registration landed by looking the domain up in the account. */
export async function pollRegistration(domain: string): Promise<{ registered: boolean; status: string }> {
  try {
    const res = await godaddy<Record<string, any>>({ path: `/v1/domains/${encodeURIComponent(domain)}` });
    const status = String(res?.status ?? "UNKNOWN");
    return { registered: status === "ACTIVE", status };
  } catch (e) {
    if (e instanceof GoDaddyError && e.status === 404) return { registered: false, status: "NOT_FOUND" };
    throw e;
  }
}

export async function purchaseAgreements(tld: string, privacy: boolean) {
  return await godaddy({
    path: "/v1/domains/agreements",
    query: { tlds: tld, privacy, forTransfer: false },
  });
}
