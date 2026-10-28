// Server-side pricing engine for the domain marketplace.
//
// THE ONLY PRICING RULE IN THIS APP:
//
//   customer first payment = live GoDaddy price for THAT exact domain + Domain Charge
//   customer renewal       = live GoDaddy renewal price for THAT domain + Renewal Charge
//
// There is no stored price table, no per-TLD "market" price, no percentage
// markup, no tax gross-up, no gateway gross-up, no market cap, no estimated
// renewal and no invented "was" price. If GoDaddy reports no figure for a
// domain, we show no figure. This guarantees the storefront always tracks the
// real registrar market, so neither the owner nor the customer can lose money.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { getOwnerSecret, getOwnerSecretJson } from "../ownerSecrets.ts";

export interface PricingSettings {
  /** Master switch for the storefront. */
  sales_enabled: boolean;
  /** Store currency. GoDaddy is queried in this same currency. */
  currency: string;
  /** Flat amount added on top of the live GoDaddy registration price. */
  default_markup_fixed: number;
  /** Flat amount added on top of the live GoDaddy renewal price. */
  renewal_markup_fixed: number;
  /**
   * Owner-set Full Domain Protection price per year, used ONLY when GoDaddy
   * does not return a privacy price for the domain. 0 = no fallback.
   */
  protection_price_per_year: number;
  /**
   * Exchange-rate mode, used only if GoDaddy ever answers in another currency.
   * live   = market rate from public FX feeds
   * manual = the owner's own fixed rate
   * ai     = market feeds cross-checked by AI once per day, then saved
   */
  fx_mode: "live" | "manual" | "ai";
  fx_manual_rate: number | null;
  /** Storefront badge label. Display only — never affects a price. */
  offer_badge_text: string;
  /** Keywords/extensions used to build the daily shortlist of domain NAMES. */
  offer_keywords: string[];
  offer_tlds: string[];
  /** GoDaddy CJ affiliate link used when domain sales are switched off. */
  affiliate_url?: string | null;
}

export const DEFAULT_SETTINGS: PricingSettings = {
  sales_enabled: false,
  currency: "INR",
  default_markup_fixed: 50,
  renewal_markup_fixed: 50,
  protection_price_per_year: 0,
  fx_mode: "live",
  fx_manual_rate: null,
  offer_badge_text: "Daily Deal",
  offer_keywords: ["work", "remote", "jobs", "hire", "career"],
  offer_tlds: ["com", "in", "co", "net", "org", "io", "shop", "online", "site", "store"],
  affiliate_url: null,
};

/**
 * Row from `domain_tld_pricing`. This table is now purely a CATALOGUE of which
 * extensions to show and in what order — it holds no prices at all.
 */
export interface TldPricing {
  tld: string;
  active?: boolean;
  is_popular?: boolean;
  sort_order?: number | null;
  [key: string]: unknown;
}

export async function loadSettings(db: SupabaseClient): Promise<PricingSettings> {
  const { data } = await db.from("domain_pricing_settings").select("*").eq("singleton", true).maybeSingle();
  if (!data) return { ...DEFAULT_SETTINGS };
  const row = data as Record<string, unknown>;
  return {
    sales_enabled: row.sales_enabled === true,
    currency: String(row.currency ?? DEFAULT_SETTINGS.currency) || "INR",
    default_markup_fixed: Math.max(0, Number(row.default_markup_fixed ?? DEFAULT_SETTINGS.default_markup_fixed) || 0),
    renewal_markup_fixed: Math.max(0, Number(row.renewal_markup_fixed ?? DEFAULT_SETTINGS.renewal_markup_fixed) || 0),
    protection_price_per_year: Math.max(0, Number(row.protection_price_per_year ?? 0) || 0),
    fx_mode: row.fx_mode === "manual" ? "manual" : row.fx_mode === "ai" ? "ai" : "live",
    fx_manual_rate: row.fx_manual_rate == null ? null : Number(row.fx_manual_rate),
    offer_badge_text: String(row.offer_badge_text ?? DEFAULT_SETTINGS.offer_badge_text) || "Daily Deal",
    offer_keywords: Array.isArray(row.offer_keywords)
      ? (row.offer_keywords as string[])
      : DEFAULT_SETTINGS.offer_keywords,
    offer_tlds: Array.isArray(row.offer_tlds) ? (row.offer_tlds as string[]) : DEFAULT_SETTINGS.offer_tlds,
    affiliate_url: row.affiliate_url ? String(row.affiliate_url) : null,
  };
}

export async function loadTldPricing(db: SupabaseClient): Promise<Map<string, TldPricing>> {
  const { data } = await db.from("domain_tld_pricing").select("tld, active, is_popular, sort_order").eq("active", true);
  const map = new Map<string, TldPricing>();
  for (const row of (data ?? []) as TldPricing[]) map.set(row.tld.replace(/^\./, "").toLowerCase(), row);
  return map;
}

// ---------------- FX ----------------

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Google Custom Search as an extra, independent USD -> INR opinion.
 * Google's own currency card is what the owner sees when they search
 * "1 usd to inr", so treating it as a feed keeps our rate in step with it.
 * Silently skipped when Custom Search is not configured.
 */
async function fetchGoogleUsdInr(): Promise<{ rate: number; source: string } | null> {
  // Prefer the Custom Search JSON saved on the Owner Portal Secrets page, then
  // the individual boxes on that page, then Supabase env secrets.
  const cseJson = await getOwnerSecretJson("GOOGLE_CUSTOM_SEARCH_JSON");
  const cx =
    (cseJson?.cx as string) || (cseJson?.search_engine_id as string) ||
    (await getOwnerSecret("GOOGLE_CUSTOM_SEARCH_ENGINE_ID")) ||
    Deno.env.get("GOOGLE_CUSTOM_SEARCH_ENGINE_ID");
  const savedKey = await getOwnerSecret("GOOGLE_CUSTOM_SEARCH_API_KEY");
  const key =
    (cseJson?.api_key as string) ||
    (savedKey && !savedKey.startsWith("{") ? savedKey : null) ||
    Deno.env.get("GOOGLE_CUSTOM_SEARCH_API_KEY");
  if (!cx || !key) return null;

  try {
    const url = new URL("https://www.googleapis.com/customsearch/v1");
    url.searchParams.set("cx", cx);
    url.searchParams.set("key", key);
    url.searchParams.set("q", "1 USD to INR today exchange rate");
    url.searchParams.set("num", "5");
    url.searchParams.set("dateRestrict", "d1");
    url.searchParams.set("gl", "in");
    url.searchParams.set("hl", "en");

    const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
    if (!res.ok) {
      console.error("Google CSE fx lookup failed:", res.status);
      return null;
    }

    const data = await res.json();
    const text = (data?.items ?? [])
      .map((i: any) => `${i?.title ?? ""} ${i?.snippet ?? ""}`)
      .join(" ");

    // Collect every plausible "1 USD = 9x.xx INR" style number in the results
    // and take their median, so one stale snippet cannot skew the answer.
    const hits: number[] = [];
    for (const m of text.matchAll(/(\d{2,3}(?:\.\d{1,4})?)\s*(?:indian\s+rupee|inr|₹|rs\.?)/gi)) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > 20 && n < 500) hits.push(n);
    }
    for (const m of text.matchAll(/(?:inr|₹|rs\.?)\s*(\d{2,3}(?:\.\d{1,4})?)/gi)) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > 20 && n < 500) hits.push(n);
    }
    if (!hits.length) return null;

    return { rate: median(hits), source: "google_search" };
  } catch (e) {
    console.error("Google CSE fx lookup error:", e);
    return null;
  }
}

/** A single USD -> INR opinion. `live` feeds move intraday like Google's card. */
interface FxCandidate {
  rate: number;
  source: string;
  /** True for intraday/mid-market quotes, false for once-a-day reference rates. */
  live: boolean;
  /** Feed's own value date (YYYY-MM-DD) when it publishes one. */
  day?: string;
}

const saneFx = (n: number) => Number.isFinite(n) && n > 20 && n < 500;

/**
 * Google Finance (USD-INR) — the exact number shown on Google's own currency
 * card when the owner searches "1 usd to inr". Google serves this page through
 * a few different markups, and the lightweight `_/finance` price endpoint is
 * often reachable where the full page is not, so both are tried.
 */
async function fetchGoogleFinanceUsdInr(): Promise<FxCandidate | null> {
  // The `hl`/`gl` variant is served without the consent interstitial, so it is
  // tried first; redirects must be followed or Google answers only a 302.
  const urls = [
    "https://www.google.com/finance/quote/USD-INR?hl=en&gl=US",
    "https://www.google.com/finance/quote/USD-INR",
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        redirect: "follow",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "no-cache",
        },
      });
      if (!res.ok) continue;
      const html = await res.text();
      if (!html) continue;

      const patterns = [
        /,(\d{2,3}(?:\.\d{1,6})?),"USD \/ INR"/,
        /data-last-price="(\d{2,3}(?:\.\d{1,6})?)"/,
        /class="YMlKec fxKbKc">[^\d]*(\d{2,3}(?:\.\d{1,6})?)/,
        /"USD \/ INR"[^\d]{0,40}(\d{2,3}\.\d{1,6})/,
      ];
      for (const p of patterns) {
        const rate = Number(html.match(p)?.[1]);
        if (saneFx(rate)) {
          return { rate: Number(rate.toFixed(4)), source: "google_finance", live: true };
        }
      }
    } catch (e) {
      console.error("Google Finance fx lookup error:", e);
    }
  }
  return null;
}

/**
 * Yahoo Finance USDINR=X — an intraday mid-market quote. Google's card is also
 * an intraday mid-market quote, so this is the closest stand-in whenever the
 * Google Finance page itself cannot be read from the server.
 */
async function fetchYahooUsdInr(): Promise<FxCandidate | null> {
  try {
    const res = await fetch(
      "https://query1.finance.yahoo.com/v8/finance/chart/USDINR=X?interval=1m&range=1d",
      { headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" } },
    );
    if (!res.ok) return null;
    const j = await res.json();
    const rate = Number(j?.chart?.result?.[0]?.meta?.regularMarketPrice);
    if (!saneFx(rate)) return null;
    return { rate: Number(rate.toFixed(4)), source: "yahoo_finance", live: true };
  } catch (e) {
    console.error("Yahoo fx lookup error:", e);
    return null;
  }
}

async function fetchAllUsdInr(): Promise<FxCandidate[]> {
  // Once-a-day reference feeds. They publish a value date, which is checked
  // below: an ECB/daily feed still serving yesterday's fixing is dropped,
  // because that is exactly how the saved rate drifted away from Google's.
  const daily: Array<{ url: string; pick: (j: any) => number; day: (j: any) => string | undefined }> = [
    {
      url: "https://open.er-api.com/v6/latest/USD",
      pick: (j) => Number(j?.rates?.INR),
      day: (j) =>
        typeof j?.time_last_update_utc === "string"
          ? new Date(j.time_last_update_utc).toISOString().slice(0, 10)
          : undefined,
    },
    {
      url: "https://api.frankfurter.dev/v1/latest?base=USD&symbols=INR",
      pick: (j) => Number(j?.rates?.INR),
      day: (j) => (typeof j?.date === "string" ? j.date : undefined),
    },
    {
      url: "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json",
      pick: (j) => Number(j?.usd?.inr),
      day: (j) => (typeof j?.date === "string" ? j.date : undefined),
    },
  ];

  const found: FxCandidate[] = [];
  for (const s of daily) {
    try {
      const res = await fetch(s.url, { headers: { Accept: "application/json" } });
      if (!res.ok) continue;
      const j = await res.json();
      const rate = s.pick(j);
      if (!saneFx(rate)) continue;
      found.push({ rate, source: new URL(s.url).hostname, live: false, day: s.day(j) });
    } catch { /* next source */ }
  }

  // Intraday feeds: Google's own card, Yahoo's mid-market quote and, when
  // configured, Google Custom Search snippets.
  const [gFinance, yahoo, gSearch] = await Promise.all([
    fetchGoogleFinanceUsdInr(),
    fetchYahooUsdInr(),
    fetchGoogleUsdInr(),
  ]);
  if (gFinance) found.push(gFinance);
  if (yahoo) found.push(yahoo);
  if (gSearch) found.push({ ...gSearch, live: true });

  return found;
}

/** Plain median of a non-empty list. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const m = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return Number(m.toFixed(4));
}

/** Drops reference feeds that are still publishing an older value date. */
function freshOnly(candidates: FxCandidate[]): FxCandidate[] {
  const day = today();
  const fresh = candidates.filter((c) => c.live || !c.day || c.day >= day);
  return fresh.length ? fresh : candidates;
}

/**
 * Outlier-resistant consensus. Google's currency card is the number the owner
 * sees, so it wins outright; Yahoo's intraday quote is the next best match for
 * it. Stale daily fixings never decide the rate on their own.
 */
function consensusRate(candidates: FxCandidate[]): { rate: number; source: string } {
  const pool = freshOnly(candidates);
  const names = pool.map((c) => c.source).join("+");
  // Google's card shows two decimals, so the saved rate uses the same rounding.
  const r2 = (n: number) => Number(n.toFixed(2));

  const google = pool.find((c) => c.source === "google_finance");
  if (google) return { rate: r2(google.rate), source: `google:${names}` };

  const live = pool.filter((c) => c.live);
  if (live.length) {
    return { rate: r2(median(live.map((c) => c.rate))), source: `live:${names}` };
  }

  const anchor = median(pool.map((c) => c.rate));
  const kept = pool.filter((c) => Math.abs(c.rate - anchor) / anchor <= 0.02);
  const used = kept.length ? kept : pool;
  const avg = used.reduce((s, c) => s + c.rate, 0) / used.length;
  return {
    rate: r2(avg),
    source: `median:${used.map((c) => c.source).join("+")}`,
  };
}


async function fetchLiveUsdInr(): Promise<{ rate: number; source: string } | null> {
  const all = await fetchAllUsdInr();
  if (!all.length) return null;
  // Even outside AI mode, agree across feeds instead of trusting the first one.
  return consensusRate(all);
}


/**
 * AI-verified USD -> INR rate. Every feed (including Google's own currency
 * card via Custom Search) is read first, then the AI cross-checks them and
 * returns the single rate that best matches today's real market.
 * Whenever the AI cannot run — no key, gateway error, unusable answer — we fall
 * back to the deterministic median/outlier consensus rather than the first feed,
 * so the saved rate is still the agreed market rate and never a stale outlier.
 */
async function fetchAiVerifiedUsdInr(): Promise<{ rate: number; source: string } | null> {
  const candidates = await fetchAllUsdInr();
  if (!candidates.length) return null;

  const consensus = consensusRate(candidates);

  // An intraday quote was readable (Google's own card, Yahoo's mid-market
  // quote or Google search snippets): that IS the number the owner sees on
  // Google, so it is used verbatim and the AI is not asked to blend it with
  // lagging once-a-day fixings.
  if (candidates.some((c) => c.live)) return consensus;


  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return consensus;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.7-flash",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: [
              "You verify today's USD to INR exchange rate for a domain store.",
              "The owner compares the saved rate against Google's currency card, so the answer must match an intraday mid-market quote.",
              "`google_finance`, `yahoo_finance` and `google_search` are intraday quotes; the other feeds are once-a-day reference fixings that lag and must never outweigh an intraday quote.",
              "Prefer the intraday quotes; use the daily fixings only when no intraday quote is given.",
              "Drop clear outliers (more than about 2% from the reference rate), then use the median of what remains.",
              "Never invent a rate that is not supported by the feeds given.",
              'Respond ONLY with JSON: {"rate": <number>}',
            ].join("\n"),
          },
          {
            role: "user",
            content: `Date: ${today()}\nFeeds:\n${candidates
              .map((c) => `${c.source}: ${c.rate}${c.live ? " (intraday)" : ` (daily fixing, value date ${c.day ?? "unknown"})`}`)
              .join("\n")}\nReference rate: ${consensus.rate}`,
          },
        ],
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const raw = data?.choices?.[0]?.message?.content ?? "";
      const rate = Number(JSON.parse(String(raw).replace(/^```(?:json)?/i, "").replace(/```$/, "").trim())?.rate);
      // Sanity gate: the AI may not stray more than 2% from the feed consensus.
      const sane =
        Number.isFinite(rate) &&
        rate > 20 &&
        rate < 500 &&
        Math.abs(rate - consensus.rate) / consensus.rate <= 0.02;
      if (sane) {
        return { rate, source: `ai:${candidates.map((c) => c.source).join("+")}` };
      }
      console.error("AI fx answer rejected, using median consensus instead:", raw);
    } else {
      // 402/429/5xx from the gateway all land here — median takes over.
      console.error("AI fx verification failed:", res.status, await res.text());
    }
  } catch (e) {
    console.error("AI fx verification error:", e);
  }

  return consensus;
}


export interface FxRate {
  rate: number;
  day: string;
  source: string;
}

/**
 * USD -> INR rate. Only ever used as a safety net: GoDaddy is asked for prices
 * in the store currency, so in normal operation no conversion happens at all.
 */
export async function getFxRate(
  db: SupabaseClient,
  settings: PricingSettings,
  opts: { force?: boolean } = {},
): Promise<FxRate> {
  const day = today();
  const aiMode = settings.fx_mode === "ai";

  if (settings.fx_mode === "manual" && Number(settings.fx_manual_rate) > 0) {
    // The owner's own 1 USD -> INR rate. It is used EXACTLY as entered, so the
    // conversion is fully predictable. The owner portal shows the live market
    // rate next to the field and warns when the entered rate sits below it.
    return { rate: Number(settings.fx_manual_rate), day, source: "admin_manual" };
  }


  const { data: cached } = await db
    .from("domain_fx_rates")
    .select("rate, rate_day, source")
    .eq("rate_day", day)
    .maybeSingle();

  // One update per calendar day: the first read of a new date fetches today's
  // rate and saves it, and every later read that day reuses the saved number.
  // Prices therefore stay stable within a day and refresh once the date changes.
  // Only a Google/intraday-anchored save is trusted; a rate agreed purely from
  // lagging daily fixings is retried so it can still be upgraded to Google's.
  const cachedSource = String(cached?.source ?? "");
  const anchored = /(google_finance|google_search|yahoo_finance|admin_manual)/.test(cachedSource);
  if (cached?.rate && anchored && !opts.force) return { rate: Number(cached.rate), day, source: cachedSource };

  // A forced re-check must never settle for a lagging daily fixing: try the AI
  // (Google-anchored) path first and fall back to the plain live feeds.
  const live = aiMode
    ? (await fetchAiVerifiedUsdInr()) ?? (await fetchLiveUsdInr())
    : (await fetchLiveUsdInr()) ?? (opts.force ? await fetchAiVerifiedUsdInr() : null);

  if (live) {
    const stamped = `${live.source}|t=${new Date().toISOString()}`;
    await db.from("domain_fx_rates").upsert(
      {
        rate_day: day,
        base_currency: "USD",
        quote_currency: "INR",
        rate: live.rate,
        source: stamped,
      },
      { onConflict: "rate_day" },
    );
    return { rate: live.rate, day, source: stamped };
  }

  if (cached?.rate) {
    // A forced re-check that could not reach any feed must say so, otherwise the
    // owner sees a "rate updated" message for a number that never changed.
    const src = String(cached.source);
    return { rate: Number(cached.rate), day, source: opts.force ? `stale:${src}` : src };
  }


  const { data: last } = await db
    .from("domain_fx_rates")
    .select("rate, rate_day, source")
    .order("rate_day", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (last?.rate) return { rate: Number(last.rate), day, source: `stale:${last.source}` };

  return { rate: 88, day, source: "fallback" };
}

// ---------------- price computation ----------------

export interface PriceInput {
  /** Live GoDaddy price for the quoted term, in the currency GoDaddy answered in. */
  supplierUsd: number;
  /** Live GoDaddy first-year figure, when the term above covers several years. */
  supplierFirstYearUsd?: number | null;
  /** Live GoDaddy renewal price. */
  supplierRenewalUsd?: number | null;
  /** Registration term in years that `supplierUsd` covers. Defaults to 1. */
  periodYears?: number;
  /** Currency GoDaddy actually answered in. */
  supplierCurrency?: string | null;
  tld: string;
}

export interface PriceBreakdown {
  tld: string;
  /** Number of years the quoted price actually covers (GoDaddy's own `period`). */
  period_years: number;
  /** Raw GoDaddy figure, for the admin verification trail. */
  supplier_cost_usd: number;
  /** Raw GoDaddy figure converted to the store currency. */
  supplier_cost: number;
  exchange_rate: number;
  /** Always "fixed": the owner's flat Domain Charge. */
  markup_type: "fixed";
  /** The Domain Charge that was added. */
  markup_value: number;
  customer_price: number;
  renewal_price: number | null;
  /** Live GoDaddy renewal cost in the store currency. Internal only. */
  renewal_supplier_cost: number | null;
  /** The Renewal Charge, i.e. the owner's profit on a renewal. Internal only. */
  renewal_profit: number | null;
  /** The Domain Charge, i.e. the owner's profit on the registration. */
  profit: number;
  currency: string;
}

const round = (n: number) => Math.round(n);
const num = (v: unknown, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export function computePrice(
  input: PriceInput,
  settings: PricingSettings,
  _tldMap: Map<string, TldPricing>,
  fx: FxRate,
): PriceBreakdown {
  const tld = input.tld.replace(/^\./, "").toLowerCase();

  // GoDaddy is queried in the storefront's own market and currency, so when it
  // answers in our currency we use that real price completely untouched. Only a
  // foreign-currency answer is converted, through the live FX rate.
  const storeCurrency = String(settings.currency || "INR").toUpperCase();
  const supplierCurrency = String(input.supplierCurrency || "USD").toUpperCase();
  const toStore = (amount: number) =>
    supplierCurrency === storeCurrency ? Math.max(0, amount) : Math.max(0, amount) * fx.rate;

  const periodYears = Math.max(1, Math.round(num(input.periodYears, 1)));
  const domainCharge = Math.max(0, num(settings.default_markup_fixed));
  const renewalCharge = Math.max(0, num(settings.renewal_markup_fixed));

  // ---- registration: REAL GoDaddy price for the term GoDaddy quoted ----
  const supplierInStore = toStore(num(input.supplierUsd));
  const price = round(supplierInStore + domainCharge);

  // ---- renewal: REAL GoDaddy figure only, never an estimate ----
  // GoDaddy's availability endpoint (checkType=FULL) reports `renewalPrice` for
  // every domain. That number is the only renewal cost we ever use; when the
  // registrar reports none we return null and the UI shows no renewal price.
  const reportedRenewal = num(input.supplierRenewalUsd);
  const renewalCost = reportedRenewal > 0 ? round(toStore(reportedRenewal)) : 0;
  const renewalPrice = renewalCost > 0 ? round(renewalCost + renewalCharge) : null;

  return {
    tld,
    period_years: periodYears,
    supplier_cost_usd: Number(num(input.supplierUsd).toFixed(4)),
    supplier_cost: round(supplierInStore),
    exchange_rate: fx.rate,
    markup_type: "fixed",
    markup_value: round(domainCharge),
    customer_price: price,
    renewal_price: renewalPrice,
    renewal_supplier_cost: renewalCost || null,
    renewal_profit: renewalPrice != null ? round(renewalCharge) : null,
    profit: round(domainCharge),
    currency: settings.currency || "INR",
  };
}

/**
 * Strips every internal field so the browser only ever sees the two selling
 * prices, the term they cover and the currency. Nothing else exists.
 */
export function publicPrice(b: PriceBreakdown) {
  return {
    tld: b.tld,
    period_years: b.period_years,
    price: b.customer_price,
    renewal_price: b.renewal_price,
    currency: b.currency,
  };
}

/**
 * GoDaddy returns prices in micro-units (1,000,000 = one unit of `currency`)
 * on every endpoint we use. Values below that scale are already whole units.
 */
export const fromMicros = (value: unknown): number => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n >= 10_000 ? n / 1_000_000 : n;
};
