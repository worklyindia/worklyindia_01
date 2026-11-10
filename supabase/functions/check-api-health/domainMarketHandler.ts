// Domain marketplace API: search, daily offers, pricing, quote -> pay -> register,
// order tracking and the admin pricing / sales dashboards.
//
// Merged into the already-deployed `check-api-health` function so the domain
// marketplace works without provisioning a brand new edge function.
// Architecture: Frontend -> check-api-health -> GoDaddy. The GoDaddy PAT and
// every internal cost/profit figure stay on this side of the boundary.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { godaddy, GoDaddyError, runDiagnostics } from "../_shared/godaddy/client.ts";
import {
  computePrice,
  getFxRate,
  loadSettings,
  loadTldPricing,
  publicPrice,
  type PricingSettings,
} from "../_shared/godaddy/pricing.ts";
import {
  bulkAvailability,
  checkAvailability,
  executeRegistration,
  getRegistrationQuote,
  pollRegistration,
  purchaseAgreements,
} from "./godaddyPurchase.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

class InputError extends Error {}
class AuthError extends Error {}
class ForbiddenError extends Error {}

const DOMAIN_RE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

function requireDomain(value: unknown): string {
  const domain = String(value ?? "").trim().toLowerCase();
  if (!DOMAIN_RE.test(domain)) throw new InputError("Please enter a valid domain name, e.g. example.com");
  return domain;
}

const tldOf = (domain: string) => domain.split(".").slice(1).join(".");

// ---------------- renewals of owned domains ----------------

/** Terms offered on the renewal screen. */
const RENEWAL_TERMS = [1, 2, 3, 5, 10];

function normalizeTerm(value: unknown): number {
  const years = Math.round(Number(value ?? 1));
  if (!RENEWAL_TERMS.includes(years)) throw new InputError("Please choose a valid renewal term.");
  return years;
}

function addYears(date: Date, years: number): Date {
  const d = new Date(date.getTime());
  d.setFullYear(d.getFullYear() + years);
  return d;
}

/** Registrar facts for a domain that already sits in the GoDaddy account. */
async function ownedDomainInfo(domain: string): Promise<{
  expires: string | null;
  status: string | null;
  renewAuto: boolean;
  renewable: boolean;
}> {
  const d = await godaddy<Record<string, unknown>>({ path: `/v1/domains/${encodeURIComponent(domain)}` });
  return {
    expires: d?.expires ? String(d.expires) : null,
    status: d?.status ? String(d.status) : null,
    renewAuto: d?.renewAuto === true,
    renewable: d?.renewable !== false,
  };
}

/**
 * REAL GoDaddy renewal cost per year, in USD. The domain itself is taken, so
 * GoDaddy only quotes the renewal figure on a FULL availability check; when it
 * omits it we probe an unregistered name on the same TLD, which returns the
 * registry's current renewal price for that extension.
 */
async function renewalSupplierPerYear(domain: string): Promise<{ perYearUsd: number; currency: string }> {
  try {
    const direct = await checkAvailability(domain);
    if (direct.renewalUsd > 0) return { perYearUsd: direct.renewalUsd, currency: direct.currency };
  } catch { /* fall through to the TLD probe */ }

  const tld = tldOf(domain);
  for (let i = 0; i < 3; i += 1) {
    const probe = `wk${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}.${tld}`;
    try {
      const res = await checkAvailability(probe);
      if (res.available && res.renewalUsd > 0) return { perYearUsd: res.renewalUsd, currency: res.currency };
      if (res.available && res.priceUsd > 0) return { perYearUsd: res.priceUsd, currency: res.currency };
    } catch { /* try another probe name */ }
  }
  throw new InputError("GoDaddy did not return a renewal price for this domain right now. Please try again shortly.");
}


const admin = (): SupabaseClient =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

interface Ctx {
  db: SupabaseClient;
  userId: string | null;
  isAdmin: boolean;
  isCron: boolean;
}

async function buildContext(req: Request): Promise<Ctx> {
  const db = admin();
  const headerSecret = req.headers.get("x-cron-secret");
  let isCron = false;
  if (headerSecret) {
    // Primary: Lovable-managed cron secret. Fallback: a DB-held token that
    // pg_cron jobs embed (only service_role can read domain_cron_auth, and
    // pg_cron runs inside the database, so the token never leaves the server).
    const envSecret = Deno.env.get("LOVABLE_CRON_SECRET");
    if (envSecret && headerSecret === envSecret) {
      isCron = true;
    } else {
      const { data: cronAuth } = await db
        .from("domain_cron_auth")
        .select("token")
        .eq("id", true)
        .maybeSingle();
      isCron = !!cronAuth?.token && headerSecret === cronAuth.token;
    }
  }

  const authHeader = req.headers.get("Authorization");
  let userId: string | null = null;
  let isAdmin = false;

  if (authHeader?.startsWith("Bearer ")) {
    const { data } = await db.auth.getUser(authHeader.replace("Bearer ", ""));
    if (data?.user) {
      userId = data.user.id;
      const [{ data: roles }, { data: adminRow }] = await Promise.all([
        db.from("user_roles").select("role").eq("user_id", userId),
        db.from("admin_users").select("role").eq("user_id", userId).maybeSingle(),
      ]);
      isAdmin =
        (roles ?? []).some((r: { role: string }) => ["admin", "owner"].includes(r.role)) ||
        ["admin", "owner"].includes(String(adminRow?.role ?? ""));
    }
  }

  return { db, userId, isAdmin, isCron };
}

function requireUser(ctx: Ctx): string {
  if (!ctx.userId) throw new AuthError("Please sign in to continue.");
  return ctx.userId;
}

function requireAdmin(ctx: Ctx) {
  if (!ctx.isAdmin) throw new ForbiddenError("Admin access is required.");
}

// ---------------- pricing helpers ----------------

async function pricingContext(db: SupabaseClient) {
  const settings = await loadSettings(db);
  const [tldMap, fx] = await Promise.all([loadTldPricing(db), getFxRate(db, settings)]);
  return { settings, tldMap, fx };
}

// ---------------- daily offers ----------------

const OFFER_BATCH_CAP = 40;
const LEASE_MINUTES = 10;
// Offers must feel like deals. Single-word domains on new TLDs are often
// registry-premium (₹40k–₹4L) — anything above this cap never becomes an offer.
const OFFER_MAX_CUSTOMER_PRICE = 5000;
const OFFER_PREFIXES = ["get", "my", "try", "go", "pro", "best"];

async function acquireLease(db: SupabaseClient, job: string): Promise<boolean> {
  const now = new Date();
  const { data } = await db.from("domain_job_state").select("*").eq("job_name", job).maybeSingle();
  if (!data) {
    await db.from("domain_job_state").insert({ job_name: job, lease_until: new Date(now.getTime() + LEASE_MINUTES * 60000).toISOString() });
    return true;
  }
  if (data.is_paused) return false;
  if (data.lease_until && new Date(data.lease_until) > now) return false;
  const { error } = await db
    .from("domain_job_state")
    .update({ lease_until: new Date(now.getTime() + LEASE_MINUTES * 60000).toISOString(), last_run_at: now.toISOString() })
    .eq("job_name", job)
    .or(`lease_until.is.null,lease_until.lt.${now.toISOString()}`);
  return !error;
}

async function releaseLease(db: SupabaseClient, job: string, error?: string) {
  await db
    .from("domain_job_state")
    .update({
      lease_until: null,
      last_error: error ?? null,
      last_success_at: error ? undefined : new Date().toISOString(),
      consecutive_failures: error ? undefined : 0,
    })
    .eq("job_name", job);
}

async function pauseJob(db: SupabaseClient, job: string, reason: string) {
  await db.from("domain_job_state").update({ is_paused: true, pause_reason: reason, lease_until: null }).eq("job_name", job);
}

function offerCandidates(settings: PricingSettings): string[] {
  const keywords = settings.offer_keywords
    .slice(0, 6)
    .map((k) => k.replace(/[^a-z0-9-]/gi, "").toLowerCase())
    .filter(Boolean);
  const tlds = settings.offer_tlds.slice(0, 10).map((t) => t.replace(/^\./, ""));

  const plain: string[] = [];
  const combos: string[] = [];
  for (const k of keywords) for (const t of tlds) plain.push(`${k}.${t}`);
  // Prefixed combos (getwork.in, myremote.shop…) are normally priced, unlike
  // premium single-word domains — interleave them so offers stay affordable.
  for (const k of keywords) for (const p of OFFER_PREFIXES) for (const t of tlds.slice(0, 4)) combos.push(`${p}${k}.${t}`);

  const out: string[] = [];
  for (let i = 0; out.length < OFFER_BATCH_CAP && (i < combos.length || i < plain.length); i += 1) {
    if (i < combos.length) out.push(combos[i]);
    if (i < plain.length && out.length < OFFER_BATCH_CAP) out.push(plain[i]);
  }
  return out;
}

async function refreshOffers(db: SupabaseClient) {
  const job = "domain_offers_refresh";
  if (!(await acquireLease(db, job))) return { skipped: true, reason: "locked_or_paused" };

  try {
    const { settings, tldMap, fx } = await pricingContext(db);
    const candidates = offerCandidates(settings).filter((d) => DOMAIN_RE.test(d));
    if (!candidates.length) {
      await releaseLease(db, job);
      return { skipped: true, reason: "no_candidates" };
    }

    const results = await bulkAvailability(candidates.slice(0, OFFER_BATCH_CAP));
    const day = new Date().toISOString().slice(0, 10);
    const rows = (results as any[])
      .filter((r) => r.available && r.priceUsd > 0)
      .map((r) => {
        const tld = tldOf(r.domain);
        const price = computePrice(
          {
            supplierUsd: r.priceUsd,
            supplierRenewalUsd: r.renewalUsd > 0 ? r.renewalUsd : null,
            tld,
            supplierCurrency: r.currency,
          },
          settings,
          tldMap,
          fx,
        );
        const popular = tldMap.get(tld)?.is_popular ? 1 : 0;
        return {
          offer_day: day,
          domain: r.domain,
          tld,
          available: true,
          supplier_cost_usd: price.supplier_cost_usd,
          supplier_renewal_usd: r.renewalUsd > 0 ? r.renewalUsd : null,
          supplier_list_usd: null,
          customer_price: price.customer_price,
          customer_renewal_price: price.renewal_price,
          currency: price.currency,
          exchange_rate: fx.rate,
          // Ranking uses only real signals: popular TLD and the real live price.
          rank_score: popular * 50 + Math.max(0, 50 - price.customer_price / 100),
          source_keyword: r.domain.split(".")[0],
          expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        };
      })
      // Never surface registry-premium domains as "offers".
      .filter((row) => row.customer_price > 0 && row.customer_price <= OFFER_MAX_CUSTOMER_PRICE);

    if (rows.length) await db.from("domain_offers").upsert(rows, { onConflict: "offer_day,domain" });
    await db.from("domain_offers").delete().lt("expires_at", new Date().toISOString());
    await releaseLease(db, job);
    return { refreshed: rows.length };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (e instanceof GoDaddyError && [401, 402, 403].includes(e.status)) {
      await pauseJob(db, job, message);
      return { paused: true, reason: message };
    }
    await releaseLease(db, job, message);
    throw e;
  }
}

// ---------------- razorpay ----------------

function razorpayKeys() {
  const id = Deno.env.get("RAZORPAY_KEY_ID")?.trim();
  const secret = Deno.env.get("RAZORPAY_KEY_SECRET")?.trim();
  if (!id || !secret) throw new InputError("Online payment is not configured yet. Please contact support.");
  return { id, secret };
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------------- taken-domain enrichment ----------------

/**
 * Public RDAP (WHOIS successor) lookup — free, keyless, and safe to call from
 * the server. Used only to enrich *taken* domains so their card still shows
 * useful facts (registrar, registration/expiry dates, status, nameservers).
 */
async function rdapLookup(domain: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
      headers: { Accept: "application/rdap+json" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const j: any = await res.json();

    const events: any[] = Array.isArray(j?.events) ? j.events : [];
    const dateOf = (action: string) => {
      const target = action.toLowerCase();
      return events.find((e) => String(e?.eventAction ?? "").toLowerCase() === target)?.eventDate ?? null;
    };

    const entities: any[] = Array.isArray(j?.entities) ? j.entities : [];
    const registrarEntity = entities.find((e: any) =>
      (Array.isArray(e?.roles) ? e.roles : [e?.roles]).filter(Boolean).includes("registrar")
    );

    const registrarName = (() => {
      if (!registrarEntity) return null;
      const vcard = Array.isArray(registrarEntity?.vcardArray?.[1]) ? registrarEntity.vcardArray[1] : [];
      const fn = vcard.find((f: any) => Array.isArray(f) && f[0] === "fn");
      if (fn?.[3]) return String(fn[3]);
      if (registrarEntity?.handle) return String(registrarEntity.handle);
      if (Array.isArray(registrarEntity?.publicIds) && registrarEntity.publicIds[0]?.identifier) {
        return String(registrarEntity.publicIds[0].identifier);
      }
      return null;
    })();

    const created = dateOf("registration");
    const ageYears = created
      ? Math.max(0, Math.floor((Date.now() - new Date(created).getTime()) / (365.25 * 24 * 3600 * 1000)))
      : null;

    const statuses = (Array.isArray(j?.status) ? j.status : []).slice(0, 4).map((s: any) => {
      const str = String(s);
      const hash = str.lastIndexOf("#");
      return hash >= 0 ? str.slice(hash + 1) : str;
    });

    return {
      registrar: registrarName ? String(registrarName).slice(0, 80) : null,
      created_at: created,
      updated_at: dateOf("last changed") ?? dateOf("last update of rdap database"),
      expires_at: dateOf("expiration"),
      age_years: ageYears,
      status: statuses,
      nameservers: (Array.isArray(j?.nameservers) ? j.nameservers : [])
        .slice(0, 4)
        .map((n: any) => String(n?.ldhName ?? "").toLowerCase())
        .filter(Boolean),
    };
  } catch {
    return null;
  }
}

// ---------------- actions ----------------

async function handleAction(action: string, p: Record<string, any>, ctx: Ctx): Promise<unknown> {
  const { db } = ctx;

  switch (action) {
    // ---------- public ----------
    case "storefront": {
      const settings = await loadSettings(db);
      const { data: tlds } = await db
        .from("domain_tld_pricing")
        .select("tld, is_popular, sort_order")
        .eq("active", true)
        .order("sort_order", { ascending: true });
      return {
        sales_enabled: settings.sales_enabled,
        currency: settings.currency,
        offer_badge_text: settings.offer_badge_text,
        affiliate_url: settings.affiliate_url ?? null,
        popular_tlds: (tlds ?? []).filter((t: any) => t.is_popular).map((t: any) => t.tld),
        tlds: (tlds ?? []).map((t: any) => t.tld),
      };
    }

    case "offers": {
      // Offers are only a *shortlist of domain names*. Every price shown is
      // fetched live from GoDaddy at read time and passed through the same
      // charge calculator as search, so the storefront can never display a
      // stale or different price than the registrar's current one.
      const day = new Date().toISOString().slice(0, 10);
      const limit = Math.min(Number(p.limit ?? 12), 30);
      const readNames = async (n: number) =>
        (
          await db
            .from("domain_offers")
            .select("domain, tld, rank_score")
            .eq("offer_day", day)
            .order("rank_score", { ascending: false })
            .limit(n)
        ).data ?? [];

      let names = await readNames(limit);
      if (names.length < 4) {
        try {
          await refreshOffers(db);
          names = await readNames(limit);
        } catch { /* offers stay empty; UI shows an empty state */ }
      }
      if (!names.length) return { offers: [] };

      const { settings, tldMap, fx } = await pricingContext(db);
      const live = (await bulkAvailability(names.map((o: any) => o.domain).slice(0, 25))) as any[];
      const byDomain = new Map(live.map((r) => [r.domain, r]));

      const offers = names
        .map((o: any) => {
          const r = byDomain.get(o.domain);
          if (!r || r.available !== true || r.priceUsd <= 0) return null;
          const price = computePrice(
            {
              supplierUsd: r.priceUsd,
              supplierRenewalUsd: r.renewalUsd > 0 ? r.renewalUsd : null,
              periodYears: r.period,
              tld: tldOf(o.domain),
              supplierCurrency: r.currency,
            },
            settings,
            tldMap,
            fx,
          );
          return {
            domain: o.domain,
            ...publicPrice(price),
          };
        })
        .filter(Boolean)
        .filter((o: any) => Number(o.price) > 0 && Number(o.price) <= OFFER_MAX_CUSTOMER_PRICE);

      return { offers };
    }


    case "search": {
      const raw = String(p.query ?? "").trim().toLowerCase().slice(0, 100);
      if (!raw) throw new InputError("Enter a keyword or domain to search.");
      const { settings, tldMap, fx } = await pricingContext(db);

      const exactDomain = DOMAIN_RE.test(raw) ? raw : null;
      const keyword = (exactDomain ? raw.split(".")[0] : raw).replace(/[^a-z0-9-]/g, "");
      if (!keyword) throw new InputError("Enter a valid keyword.");

      const wanted = new Set<string>();
      if (exactDomain) wanted.add(exactDomain);
      for (const tld of settings.offer_tlds.slice(0, 10)) wanted.add(`${keyword}.${tld.replace(/^\./, "")}`);

      let suggestions: string[] = [];
      try {
        const sug = await godaddy<any[]>({ path: "/v1/domains/suggest", query: { query: keyword, limit: 15, waitMs: 2000 } });
        suggestions = (sug ?? []).map((s: any) => String(s.domain ?? "").toLowerCase()).filter((d) => DOMAIN_RE.test(d));
      } catch { /* suggestions are optional */ }
      for (const s of suggestions) {
        if (wanted.size >= 25) break;
        wanted.add(s);
      }

      const results = (await bulkAvailability([...wanted].slice(0, 25))) as any[];

      const mapped = results.map((r) => {
        // Taken domains still show whatever pricing data the registrar
        // returned, so the row looks the same as an available one.
        if (r.priceUsd <= 0) {
          return { domain: r.domain, tld: tldOf(r.domain), available: r.available === true } as any;
        }
        const price = computePrice(
          {
            supplierUsd: r.priceUsd,
            // Real renewal price reported by GoDaddy for this exact domain.
            supplierRenewalUsd: r.renewalUsd > 0 ? r.renewalUsd : null,
            // GoDaddy prices some TLDs (.ai, .co.uk…) over a multi-year minimum
            // term. Carrying that period through keeps the label honest.
            periodYears: r.period,
            tld: tldOf(r.domain),
            supplierCurrency: r.currency,
          },
          settings,
          tldMap,
          fx,
        );
        return {
          domain: r.domain,
          available: r.available === true,
          ...publicPrice(price),
        } as any;
      });

      // --- enrich taken domains with public WHOIS facts only ---
      // No invented "typical price" is added: if GoDaddy reports no price for a
      // taken domain, the card simply shows no price.
      const takenNoPrice = mapped.filter((m: any) => !m.available && !m.price);
      if (takenNoPrice.length) {
        // RDAP is best-effort and capped so search stays fast.
        const whoisList = await Promise.all(takenNoPrice.slice(0, 8).map((m: any) => rdapLookup(m.domain)));
        takenNoPrice.forEach((m: any, i: number) => {
          if (i < whoisList.length && whoisList[i]) m.whois = whoisList[i];
        });
      }

      return {
        results: mapped,
        sales_enabled: settings.sales_enabled,
        currency: settings.currency,
      };
    }

    // Named market_check_availability so it never collides with the raw
    // GoDaddy `check_availability` action served by godaddyHandler.ts.
    case "market_check_availability": {
      const domain = requireDomain(p.domain);
      const { settings, tldMap, fx } = await pricingContext(db);
      const avail = await checkAvailability(domain);
      if (!avail.available || avail.priceUsd <= 0) return { domain, available: false };
      const price = computePrice(
        {
          supplierUsd: avail.priceUsd,
          supplierRenewalUsd: avail.renewalUsd > 0 ? avail.renewalUsd : null,
          periodYears: avail.period,
          tld: tldOf(domain),
          supplierCurrency: avail.currency,
        },
        settings,
        tldMap,
        fx,
      );
      return { domain, available: true, ...publicPrice(price) };
    }

    // ---------- purchase flow ----------
    case "create_quote": {
      const userId = requireUser(ctx);
      const domain = requireDomain(p.domain);
      const period = Math.min(Math.max(Number(p.period ?? 1), 1), 10);
      const privacy = p.privacy === true;

      const { settings, tldMap, fx } = await pricingContext(db);
      if (!settings.sales_enabled) throw new InputError("Domain sales are currently disabled.");

      // Real GoDaddy quotes: the domain itself, and (when asked) the registrar's
      // own privacy cost derived from the difference between the two quotes.
      const {
        base: baseQuote,
        purchase: quote,
        protectionFee,
        protectionPrice,
        privacyAvailable,
        privacyFree,
        protectionFeeSource,
      } = await quoteWithPrivacy(domain, period, privacy, settings, fx);

      // If the registrar will not sell privacy for this domain we register
      // without it rather than failing the order.
      const effectivePrivacy = privacy && privacyAvailable;

      const price = computePrice(
        {
          supplierUsd: baseQuote.totalUsd,
          supplierFirstYearUsd: baseQuote.firstYearUsd,
          supplierRenewalUsd: baseQuote.renewalUsd,
          periodYears: period,
          supplierCurrency: baseQuote.currency,
          tld: tldOf(domain),
        },
        settings,
        tldMap,
        fx,
      );


      const { data: order, error } = await db
        .from("domain_orders")
        .insert({
          user_id: userId,
          domain,
          tld: tldOf(domain),
          period,
          privacy: effectivePrivacy,
          provider: "godaddy",
          supplier_cost: price.supplier_cost_usd,
          supplier_currency: quote.currency,
          exchange_rate: fx.rate,
          markup_type: price.markup_type,
          markup_value: price.markup_value,
          tax_amount: 0,
          customer_price: price.customer_price + protectionFee,
          currency: price.currency,
          // Privacy is passed through at the registrar's own cost, so it adds no profit.
          profit: price.profit,
          renewal_price: price.renewal_price,
          status: "pending",
          quote_token: quote.quoteToken,
          quote_expires_at: quote.expiresAt,
          status_reason: quote.source === "v1_availability" ? "price_from_v1_availability" : null,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);

      const pub = publicPrice(price);
      const renewalPerYear = pub.renewal_price == null ? null : Number(pub.renewal_price);
      return {
        order_id: order.id,
        domain,
        period,
        privacy: effectivePrivacy,
        privacy_requested: privacy,
        privacy_available: privacyAvailable,
        privacy_free: privacyFree,
        price_locked: quote.source === "v3_quote",
        quote_expires_at: quote.expiresAt,
        ...pub,
        protection_fee: protectionFee,
        // Price of protection for the SELECTED term, shown even when the
        // toggle is off (registrar price first, owner-set price as fallback).
        protection_price: protectionPrice,
        protection_fee_source: protectionFeeSource,
        // Registration price for the whole selected term, excluding privacy.
        registration_price: Number(pub.price ?? 0),
        // Per-year renewal price and the full cost of renewing the same term.
        renewal_price: renewalPerYear,
        renewal_total: renewalPerYear == null ? null : renewalPerYear * period,
        // Totals include the protection add-on so the UI never has to guess.
        price: Number(pub.price ?? 0) + protectionFee,
      };
    }


    case "agreements": {
      requireUser(ctx);
      const domain = requireDomain(p.domain);
      const agreements = await purchaseAgreements(tldOf(domain), p.privacy === true);
      return { agreements };
    }

    case "save_contact": {
      const userId = requireUser(ctx);
      const orderId = String(p.order_id ?? "");
      const c = (p.contact ?? {}) as Record<string, any>;

      const str = (key: string, max: number, required = true) => {
        const value = String(c[key] ?? "").trim().slice(0, max);
        if (required && !value) throw new InputError(`Please fill in the ${key.replace(/([A-Z])/g, " $1").toLowerCase()} field.`);
        return value;
      };
      const email = str("email", 120);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new InputError("Please enter a valid email address.");
      const country = str("country", 2).toUpperCase();
      if (!/^[A-Z]{2}$/.test(country)) throw new InputError("Please select a valid country.");

      const contact = {
        nameFirst: str("nameFirst", 60),
        nameLast: str("nameLast", 60),
        organization: String(c.organization ?? "").trim().slice(0, 100) || undefined,
        email,
        phone: str("phone", 25),
        addressMailing: {
          address1: str("address1", 120),
          address2: String(c.address2 ?? "").trim().slice(0, 120) || undefined,
          city: str("city", 60),
          state: str("state", 60),
          postalCode: str("postalCode", 20),
          country,
        },
        consent: {
          agreementKeys: Array.isArray(c.agreementKeys) && c.agreementKeys.length ? c.agreementKeys.slice(0, 10).map(String) : ["DNRA"],
          agreedBy: "customer",
          agreedAt: new Date().toISOString(),
        },
      };

      const { data: order, error } = await db
        .from("domain_orders")
        .update({ contact })
        .eq("id", orderId)
        .eq("user_id", userId)
        .in("status", ["pending", "payment_pending", "paid"])
        .select("id, status")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!order) throw new InputError("Order not found or no longer editable.");

      // Details arriving after payment mean registration was waiting on them.
      if (order.status === "paid") return await registerPaidOrder(db, orderId);
      return { saved: true };
    }


    case "create_payment": {
      const userId = requireUser(ctx);
      const { id: keyId, secret } = razorpayKeys();
      const orderId = String(p.order_id ?? "");
      const { data: order } = await db.from("domain_orders").select("*").eq("id", orderId).eq("user_id", userId).maybeSingle();
      if (!order) throw new InputError("Order not found.");
      if (!["pending", "payment_pending"].includes(order.status)) throw new InputError("This order can no longer be paid.");

      const amountPaise = Math.round(Number(order.customer_price) * 100);
      const res = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${keyId}:${secret}`)}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: amountPaise,
          currency: order.currency || "INR",
          receipt: `dom_${orderId.slice(0, 30)}`,
          notes: { domain: order.domain, domain_order_id: orderId },
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        console.error("razorpay order failed", res.status);
        throw new InputError(payload?.error?.description || "Could not start the payment.");
      }

      await db
        .from("domain_orders")
        .update({ status: "payment_pending", payment_order_id: payload.id, payment_provider: "razorpay" })
        .eq("id", orderId);

      return { razorpay_order_id: payload.id, amount: amountPaise, currency: payload.currency, key_id: keyId, domain: order.domain };
    }

    // One Razorpay order for every domain in the cart. Each domain keeps its
    // own domain_orders row (own quote, own registration); they simply share
    // the payment_order_id, like line items on one receipt.
    case "create_cart_payment": {
      const userId = requireUser(ctx);
      const { id: keyId, secret } = razorpayKeys();
      const orderIds: string[] = Array.isArray(p.order_ids) ? p.order_ids.map(String).slice(0, 10) : [];
      if (!orderIds.length) throw new InputError("Your cart is empty.");

      const { data: orders } = await db.from("domain_orders").select("*").eq("user_id", userId).in("id", orderIds);
      const payable = (orders ?? []).filter((o: any) => ["pending", "payment_pending"].includes(o.status));
      if (payable.length !== orderIds.length) {
        throw new InputError("Some domains in your cart are no longer payable. Please review your cart.");
      }

      const amountPaise = Math.round(payable.reduce((sum: number, o: any) => sum + Number(o.customer_price), 0) * 100);
      if (amountPaise <= 0) throw new InputError("Invalid cart total.");

      const res = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${keyId}:${secret}`)}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: amountPaise,
          currency: payable[0].currency || "INR",
          receipt: `cart_${Date.now().toString(36)}`.slice(0, 40),
          notes: { cart_order_ids: orderIds.join(","), domains: payable.map((o: any) => o.domain).join(", ").slice(0, 200) },
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        console.error("razorpay cart order failed", res.status);
        throw new InputError(payload?.error?.description || "Could not start the payment.");
      }

      await db
        .from("domain_orders")
        .update({ status: "payment_pending", payment_order_id: payload.id, payment_provider: "razorpay" })
        .eq("user_id", userId)
        .in("id", orderIds);

      return { razorpay_order_id: payload.id, amount: amountPaise, currency: payload.currency, key_id: keyId, order_ids: orderIds };
    }

    case "confirm_payment": {
      const userId = requireUser(ctx);
      const { secret } = razorpayKeys();
      const orderIds: string[] = Array.isArray(p.order_ids) && p.order_ids.length
        ? p.order_ids.map(String).slice(0, 10)
        : [String(p.order_id ?? "")];
      const razorpayOrderId = String(p.razorpay_order_id ?? "");
      const razorpayPaymentId = String(p.razorpay_payment_id ?? "");
      const signature = String(p.razorpay_signature ?? "");
      if (!orderIds[0] || !razorpayOrderId || !razorpayPaymentId || !signature) throw new InputError("Incomplete payment details.");

      const expected = await hmacSha256Hex(secret, `${razorpayOrderId}|${razorpayPaymentId}`);
      if (expected !== signature) {
        await db.from("domain_orders").update({ status: "failed", status_reason: "payment_signature_mismatch" }).eq("user_id", userId).in("id", orderIds);
        throw new ForbiddenError("Payment could not be verified.");
      }

      const results: Array<Record<string, unknown>> = [];
      for (const orderId of orderIds) {
        const { data: order } = await db.from("domain_orders").select("*").eq("id", orderId).eq("user_id", userId).maybeSingle();
        if (!order) {
          results.push({ order_id: orderId, status: "failed", reason: "order_not_found" });
          continue;
        }
        if (order.payment_order_id !== razorpayOrderId) throw new ForbiddenError("Payment does not match this order.");
        if (["registered", "registration_pending"].includes(order.status)) {
          results.push({ status: order.status, domain: order.domain });
          continue;
        }

        await db
          .from("domain_orders")
          .update({ status: "paid", payment_id: razorpayPaymentId, payment_amount: order.customer_price })
          .eq("id", orderId);

        try {
          results.push(await registerPaidOrder(db, orderId));
        } catch (e) {
          results.push({ status: "failed", domain: order.domain, reason: (e instanceof Error ? e.message : String(e)).slice(0, 200) });
        }
      }

      if (orderIds.length === 1) return results[0];
      const ok = (s: unknown) => ["paid", "registration_pending", "registered"].includes(String(s));
      return {
        status: results.every((r) => ok(r.status)) ? "paid" : results.some((r) => ok(r.status)) ? "partial" : "failed",
        orders: results,
      };
    }

    case "order_status": {
      const userId = requireUser(ctx);
      const orderId = String(p.order_id ?? "");
      const { data: order } = await db
        .from("domain_orders")
        .select("id, domain, tld, status, status_reason, registration_status, customer_price, currency, renewal_price, created_at")
        .eq("id", orderId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!order) throw new InputError("Order not found.");

      if (order.status === "registration_pending") {
        try {
          const poll = await pollRegistration(order.domain);
          if (poll.registered) {
            await db.from("domain_orders").update({ status: "registered", registration_status: poll.status }).eq("id", order.id);
            order.status = "registered";
            order.registration_status = poll.status;
          } else {
            await db.from("domain_orders").update({ registration_status: poll.status }).eq("id", order.id);
            order.registration_status = poll.status;
          }
        } catch { /* keep last known status */ }
      }
      return { order };
    }

    case "my_orders": {
      const userId = requireUser(ctx);
      const { data } = await db
        .from("domain_orders")
        .select("id, domain, tld, status, status_reason, registration_status, customer_price, currency, renewal_price, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      return { orders: data ?? [] };
    }

    // ---------- renewal of an owned domain ----------

    // Live GoDaddy renewal pricing for a domain the customer already owns.
    case "renewal_quote": {
      requireUser(ctx);
      const domain = requireDomain(p.domain);
      const { settings, tldMap, fx } = await pricingContext(db);

      const info = await ownedDomainInfo(domain);
      const supplier = await renewalSupplierPerYear(domain);
      const price = computePrice(
        {
          supplierUsd: supplier.perYearUsd,
          supplierRenewalUsd: supplier.perYearUsd,
          periodYears: 1,
          tld: tldOf(domain),
          supplierCurrency: supplier.currency,
        },
        settings,
        tldMap,
        fx,
      );
      const perYear = price.renewal_price ?? price.customer_price;
      if (!perYear || perYear <= 0) throw new InputError("Renewal price is not available for this domain right now.");

      const base = info.expires ? new Date(info.expires) : new Date();
      const options = RENEWAL_TERMS.map((years) => ({
        years,
        price_per_year: perYear,
        total: Math.round(perYear * years),
        new_expiry: addYears(base, years).toISOString(),
      }));

      return {
        domain,
        currency: price.currency,
        price_per_year: perYear,
        expires: info.expires,
        status: info.status,
        renew_auto: info.renewAuto,
        renewable: info.renewable,
        sales_enabled: settings.sales_enabled,
        options,
      };
    }

    case "create_renewal_payment": {
      const userId = requireUser(ctx);
      const { id: keyId, secret } = razorpayKeys();
      const domain = requireDomain(p.domain);
      const period = normalizeTerm(p.period);

      const { settings, tldMap, fx } = await pricingContext(db);
      if (!settings.sales_enabled) throw new InputError("Domain sales are currently disabled.");

      const info = await ownedDomainInfo(domain);
      const supplier = await renewalSupplierPerYear(domain);
      const price = computePrice(
        {
          supplierUsd: supplier.perYearUsd,
          supplierRenewalUsd: supplier.perYearUsd,
          periodYears: 1,
          tld: tldOf(domain),
          supplierCurrency: supplier.currency,
        },
        settings,
        tldMap,
        fx,
      );
      const perYear = price.renewal_price ?? price.customer_price;
      if (!perYear || perYear <= 0) throw new InputError("Renewal price is not available for this domain right now.");
      const total = Math.round(perYear * period);

      const { data: row, error } = await db
        .from("domain_renewal_orders")
        .insert({
          user_id: userId,
          domain,
          tld: tldOf(domain),
          period,
          currency: price.currency,
          price_per_year: perYear,
          customer_price: total,
          supplier_cost: price.renewal_supplier_cost ?? price.supplier_cost,
          exchange_rate: fx.rate,
          status: "pending",
          expires_before: info.expires,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);

      const amountPaise = Math.round(total * 100);
      const res = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: { Authorization: `Basic ${btoa(`${keyId}:${secret}`)}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountPaise,
          currency: price.currency || "INR",
          receipt: `ren_${String(row.id).slice(0, 30)}`,
          notes: { domain, years: String(period), renewal_order_id: row.id },
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        console.error("razorpay renewal order failed", res.status);
        await db.from("domain_renewal_orders").update({ status: "failed", status_reason: "payment_init_failed" }).eq("id", row.id);
        throw new InputError(payload?.error?.description || "Could not start the payment.");
      }

      await db
        .from("domain_renewal_orders")
        .update({ status: "payment_pending", payment_provider: "razorpay", payment_order_id: payload.id })
        .eq("id", row.id);

      return {
        renewal_order_id: row.id,
        razorpay_order_id: payload.id,
        domain,
        period,
        amount: amountPaise,
        currency: payload.currency,
        key_id: keyId,
        total,
        price_per_year: perYear,
        expires_before: info.expires,
      };
    }

    case "confirm_renewal_payment": {
      const userId = requireUser(ctx);
      const { secret } = razorpayKeys();
      const renewalOrderId = String(p.renewal_order_id ?? "");
      const razorpayOrderId = String(p.razorpay_order_id ?? "");
      const razorpayPaymentId = String(p.razorpay_payment_id ?? "");
      const signature = String(p.razorpay_signature ?? "");
      if (!renewalOrderId || !razorpayOrderId || !razorpayPaymentId || !signature) {
        throw new InputError("Incomplete payment details.");
      }

      const { data: order } = await db
        .from("domain_renewal_orders")
        .select("*")
        .eq("id", renewalOrderId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!order) throw new InputError("Renewal order not found.");
      if (order.status === "renewed") {
        return { status: "renewed", domain: order.domain, period: order.period, expires_after: order.expires_after };
      }
      if (order.payment_order_id !== razorpayOrderId) throw new ForbiddenError("Payment does not match this order.");

      const expected = await hmacSha256Hex(secret, `${razorpayOrderId}|${razorpayPaymentId}`);
      if (expected !== signature) {
        await db.from("domain_renewal_orders").update({ status: "failed", status_reason: "payment_signature_mismatch" }).eq("id", order.id);
        throw new ForbiddenError("Payment could not be verified.");
      }

      await db
        .from("domain_renewal_orders")
        .update({ status: "paid", payment_id: razorpayPaymentId, payment_amount: order.customer_price, updated_at: new Date().toISOString() })
        .eq("id", order.id);

      try {
        await godaddy({
          path: `/v1/domains/${encodeURIComponent(order.domain)}/renew`,
          method: "POST",
          body: { period: Number(order.period) || 1 },
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        await db
          .from("domain_renewal_orders")
          .update({ status: "failed", status_reason: message.slice(0, 300), updated_at: new Date().toISOString() })
          .eq("id", order.id);
        throw e;
      }

      // Read back the registrar's own new expiry date whenever it is available.
      let expiresAfter: string | null = null;
      try {
        const info = await ownedDomainInfo(order.domain);
        expiresAfter = info.expires;
      } catch { /* fall back to the calculated date */ }
      if (!expiresAfter) {
        const base = order.expires_before ? new Date(order.expires_before) : new Date();
        expiresAfter = addYears(base, Number(order.period) || 1).toISOString();
      }

      await db
        .from("domain_renewal_orders")
        .update({ status: "renewed", expires_after: expiresAfter, status_reason: null, updated_at: new Date().toISOString() })
        .eq("id", order.id);

      return {
        status: "renewed",
        domain: order.domain,
        period: order.period,
        amount: order.customer_price,
        currency: order.currency,
        expires_before: order.expires_before,
        expires_after: expiresAfter,
      };
    }

    case "my_renewals": {
      const userId = requireUser(ctx);
      const { data } = await db
        .from("domain_renewal_orders")
        .select("id, domain, period, status, customer_price, currency, expires_before, expires_after, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      return { renewals: data ?? [] };
    }


    // ---------- admin ----------
    case "diagnostics": {
      // Read-only and never leaks secret values — safe for server-side cron probes too.
      if (!ctx.isAdmin && !ctx.isCron) throw new ForbiddenError("Admin access is required.");
      return { diagnostics: await runDiagnostics() };
    }

    case "admin_settings": {
      requireAdmin(ctx);
      const [{ data: settings }, { data: tlds }, { data: jobs }] = await Promise.all([
        db.from("domain_pricing_settings").select("*").eq("singleton", true).maybeSingle(),
        db.from("domain_tld_pricing").select("*").order("sort_order", { ascending: true }),
        db.from("domain_job_state").select("*"),
      ]);
      const fx = await getFxRate(db, await loadSettings(db));
      return { settings, tlds: tlds ?? [], jobs: jobs ?? [], fx };
    }

    case "admin_refresh_fx": {
      // Owner tapped the refresh icon: re-check today's live USD -> INR rate now
      // and overwrite the saved value for today. The owner's own manual rate is
      // ignored here on purpose, so the answer is always the real market rate.
      requireAdmin(ctx);
      const s = await loadSettings(db);
      const fx = await getFxRate(
        db,
        { ...s, fx_mode: s.fx_mode === "manual" ? "ai" : s.fx_mode },
        { force: true },
      );
      return { fx };
    }


    case "admin_save_settings": {
      requireAdmin(ctx);
      const patch = (p.settings ?? {}) as Record<string, unknown>;
      const allowed = [
        // The ONLY knobs that exist: the storefront switch, the two flat
        // charges, currency, FX safety net and the offers shortlist inputs.
        "sales_enabled", "currency",
        "default_markup_fixed", "renewal_markup_fixed",
        "protection_price_per_year",
        "fx_mode", "fx_manual_rate",
        "offer_badge_text", "offer_keywords", "offer_tlds",
        "affiliate_url",
      ];
      const body: Record<string, unknown> = {};
      for (const key of allowed) if (key in patch) body[key] = patch[key];
      if (!Object.keys(body).length) throw new InputError("Nothing to update.");
      const { error } = await db.from("domain_pricing_settings").update(body).eq("singleton", true);
      if (error) throw new Error(error.message);
      return { saved: true };
    }

    case "admin_save_tld": {
      requireAdmin(ctx);
      const row = (p.tld ?? {}) as Record<string, unknown>;
      const tld = String(row.tld ?? "").replace(/^\./, "").toLowerCase();
      if (!/^[a-z0-9.-]{2,63}$/.test(tld)) throw new InputError("Enter a valid extension, e.g. com");
      // The TLD table is a CATALOGUE only: which extensions to show, in what
      // order. It holds no prices — every price comes live from GoDaddy.
      const { error } = await db.from("domain_tld_pricing").upsert(
        {
          tld,
          is_popular: row.is_popular === true,
          sort_order: Number(row.sort_order ?? 0) || 0,
          active: row.active !== false,
        },
        { onConflict: "tld" },
      );
      if (error) throw new Error(error.message);
      return { saved: true };
    }

    case "admin_delete_tld": {
      requireAdmin(ctx);
      const tld = String(p.tld ?? "").replace(/^\./, "").toLowerCase();
      await db.from("domain_tld_pricing").delete().eq("tld", tld);
      return { deleted: true };
    }

    case "admin_price_preview": {
      requireAdmin(ctx);
      const { settings, tldMap, fx } = await pricingContext(db);
      const supplierUsd = Number(p.supplier_usd ?? 12);
      const price = computePrice(
        { supplierUsd, tld: String(p.tld ?? "com"), supplierCurrency: String(p.supplier_currency ?? "USD") },
        settings,
        tldMap,
        fx,
      );
      return { preview: price, fx };
    }

    case "admin_stats": {
      requireAdmin(ctx);
      const { data: orders } = await db
        .from("domain_orders")
        .select("id, domain, tld, status, customer_price, supplier_cost, exchange_rate, profit, payment_amount, created_at, user_id")
        .order("created_at", { ascending: false })
        .limit(1000);

      const rows = orders ?? [];
      const paidStatuses = ["paid", "registration_pending", "registered"];
      const paid = rows.filter((o: any) => paidStatuses.includes(o.status));
      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);

      const revenue = paid.reduce((s: number, o: any) => s + Number(o.payment_amount ?? o.customer_price ?? 0), 0);
      const cost = paid.reduce((s: number, o: any) => s + Number(o.supplier_cost ?? 0) * Number(o.exchange_rate ?? 0), 0);
      const profit = paid.reduce((s: number, o: any) => s + Number(o.profit ?? 0), 0);

      const byTld = new Map<string, { tld: string; count: number; revenue: number; profit: number }>();
      for (const o of paid) {
        const entry = byTld.get(o.tld) ?? { tld: o.tld, count: 0, revenue: 0, profit: 0 };
        entry.count += 1;
        entry.revenue += Number(o.payment_amount ?? o.customer_price ?? 0);
        entry.profit += Number(o.profit ?? 0);
        byTld.set(o.tld, entry);
      }

      const daily = new Map<string, { day: string; count: number; revenue: number; profit: number }>();
      for (const o of paid) {
        const day = String(o.created_at).slice(0, 10);
        const entry = daily.get(day) ?? { day, count: 0, revenue: 0, profit: 0 };
        entry.count += 1;
        entry.revenue += Number(o.payment_amount ?? o.customer_price ?? 0);
        entry.profit += Number(o.profit ?? 0);
        daily.set(day, entry);
      }

      return {
        totals: {
          orders: rows.length,
          sales: paid.length,
          today_sales: paid.filter((o: any) => new Date(o.created_at) >= startOfDay).length,
          today_revenue: paid
            .filter((o: any) => new Date(o.created_at) >= startOfDay)
            .reduce((s: number, o: any) => s + Number(o.payment_amount ?? o.customer_price ?? 0), 0),
          revenue,
          supplier_cost: Math.round(cost),
          gross_profit: Math.round(profit),
          margin_percent: revenue > 0 ? Number(((profit / revenue) * 100).toFixed(2)) : 0,
          pending_registrations: rows.filter((o: any) => ["paid", "registration_pending"].includes(o.status)).length,
          failed_registrations: rows.filter((o: any) => o.status === "failed").length,
        },
        top_tlds: [...byTld.values()].sort((a, b) => b.count - a.count).slice(0, 10),
        daily: [...daily.values()].sort((a, b) => (a.day < b.day ? 1 : -1)).slice(0, 30),
        recent: rows.slice(0, 50),
        reseller_warning:
          "'Supplier cost' is GoDaddy's live API price for each domain. Unless this account is an authorized reseller it is list price, not wholesale, so real margin may differ.",
      };
    }

    case "admin_refresh_offers": {
      requireAdmin(ctx);
      return await refreshOffers(db);
    }

    case "admin_resume_job": {
      requireAdmin(ctx);
      await db
        .from("domain_job_state")
        .update({ is_paused: false, pause_reason: null, lease_until: null, consecutive_failures: 0 })
        .eq("job_name", String(p.job_name ?? "domain_offers_refresh"));
      return { resumed: true };
    }

    case "admin_retry_registration": {
      requireAdmin(ctx);
      return await registerPaidOrder(db, String(p.order_id ?? ""));
    }

    // ---------- cron ----------




    case "cron_refresh_offers": {
      if (!ctx.isCron && !ctx.isAdmin) throw new ForbiddenError("Not allowed.");
      return await refreshOffers(db);
    }

    // Daily renewal / expiry reminder run. pg_cron hits this action; the actual
    // sending lives in the `domain-renewal-reminders` function, which only
    // accepts the service role key.
    case "cron_renewal_reminders": {
      if (!ctx.isCron && !ctx.isAdmin) throw new ForbiddenError("Not allowed.");
      const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/domain-renewal-reminders`;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
        },
        body: JSON.stringify({ trigger: ctx.isCron ? "cron" : "admin" }),
      });
      const text = await res.text();
      let parsed: unknown = null;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        parsed = null;
      }
      if (!res.ok) throw new Error(`Reminder run failed (${res.status}).`);
      return { reminders: parsed };
    }

    // Per-domain reminder preference. `domain_orders` is not user-writable, so
    // the toggle is applied here after an ownership check.
    case "set_renewal_reminders": {
      const userId = requireUser(ctx);
      const domain = requireDomain(p.domain);
      const enabled = p.enabled !== false;
      const { data: owned } = await db
        .from("domain_orders")
        .select("id")
        .eq("user_id", userId)
        .eq("domain", domain)
        .eq("status", "completed")
        .limit(1);
      if (!owned?.length) throw new ForbiddenError("That domain is not on your account.");
      const { error } = await db
        .from("domain_orders")
        .update({ renewal_reminders_enabled: enabled })
        .eq("user_id", userId)
        .eq("domain", domain);
      if (error) throw new Error("Could not save the reminder preference.");
      return { enabled };
    }

    // Reminder preference + log for the signed-in user's domains.
    case "renewal_reminder_status": {
      const userId = requireUser(ctx);
      const { data } = await db
        .from("domain_orders")
        .select("domain, renewal_reminders_enabled")
        .eq("user_id", userId)
        .eq("status", "completed");
      const { data: sent } = await db
        .from("domain_renewal_reminders")
        .select("domain, days_before, expires_at, sent_at")
        .eq("user_id", userId)
        .order("sent_at", { ascending: false })
        .limit(50);
      return { preferences: data ?? [], recent: sent ?? [] };
    }


    default:
      throw new InputError("Unsupported domain action.");
  }
}

/**
 * Fetches the real GoDaddy quote for a domain and, when privacy is requested,
 * the registrar's true privacy cost (quote with privacy minus quote without).
 * Nothing stored in our database ever influences these figures.
 */
async function quoteWithPrivacy(
  domain: string,
  period: number,
  privacy: boolean,
  settings: PricingSettings,
  fx: { rate: number },
): Promise<{
  base: Awaited<ReturnType<typeof getRegistrationQuote>>;
  purchase: Awaited<ReturnType<typeof getRegistrationQuote>>;
  /** Charged only when privacy was requested. */
  protectionFee: number;
  /** Price of protection for this term, shown even when the toggle is off. */
  protectionPrice: number;
  /** False when neither the registrar nor the owner can price protection. */
  privacyAvailable: boolean;
  /** True when the registrar bundles privacy at no extra cost. */
  privacyFree: boolean;
  /** Where the shown protection price came from. */
  protectionFeeSource: "registrar" | "owner" | "free" | "none";
}> {
  const base = await getRegistrationQuote({ domain, period, privacy: false, renewalUsdPerYear: null });
  // Owner-set fallback price, used only when GoDaddy returns no privacy price.
  const ownerFee = Math.round(Math.max(0, Number(settings.protection_price_per_year ?? 0) || 0) * period);

  // The protection price is always resolved for the SELECTED term so the UI can
  // show it before the toggle is switched on.
  let withPrivacy: Awaited<ReturnType<typeof getRegistrationQuote>> | null = null;
  try {
    withPrivacy = await getRegistrationQuote({ domain, period, privacy: true, renewalUsdPerYear: null });
  } catch {
    withPrivacy = null;
  }

  // The registrar could not price privacy. Fall back to the owner's own
  // configured protection price when one is set, otherwise carry on without it
  // instead of blocking the whole checkout with an error.
  if (!withPrivacy || withPrivacy.source !== "v3_quote") {
    return {
      base,
      purchase: base,
      protectionFee: privacy ? ownerFee : 0,
      protectionPrice: ownerFee,
      privacyAvailable: ownerFee > 0,
      privacyFree: false,
      protectionFeeSource: ownerFee > 0 ? "owner" : "none",
    };
  }

  const store = String(settings.currency || "INR").toUpperCase();
  const cur = String(withPrivacy.currency || "USD").toUpperCase();
  const diff = Math.max(0, withPrivacy.totalUsd - base.totalUsd);
  const registrarFee = Math.round(cur === store ? diff : diff * fx.rate);

  // A zero difference means GoDaddy did not price privacy separately for this
  // TLD: use the owner's price when set, otherwise treat it as included free.
  if (registrarFee <= 0) {
    return {
      base,
      purchase: privacy && ownerFee <= 0 ? withPrivacy : base,
      protectionFee: privacy ? ownerFee : 0,
      protectionPrice: ownerFee,
      privacyAvailable: true,
      privacyFree: ownerFee <= 0,
      protectionFeeSource: ownerFee > 0 ? "owner" : "free",
    };
  }

  return {
    base,
    purchase: privacy ? withPrivacy : base,
    protectionFee: privacy ? registrarFee : 0,
    protectionPrice: registrarFee,
    privacyAvailable: true,
    privacyFree: false,
    protectionFeeSource: "registrar",
  };
}



/**
 * Executes registration for an order that has been paid. Re-quotes when the
 * locked quote has expired and refuses to proceed if the supplier price rose.
 */
async function registerPaidOrder(db: SupabaseClient, orderId: string) {
  const { data: order } = await db.from("domain_orders").select("*").eq("id", orderId).maybeSingle();
  if (!order) throw new InputError("Order not found.");
  if (!["paid", "registration_pending", "failed"].includes(order.status)) {
    throw new InputError("This order is not ready for registration.");
  }

  const contact = (order.contact ?? null) as Record<string, unknown> | null;
  if (!contact) {
    await db.from("domain_orders").update({ status: "paid", status_reason: "awaiting_registrant_details" }).eq("id", orderId);
    return { status: "paid", needs_contact: true, domain: order.domain };
  }

  // ---- payment-moment cost verification (ALWAYS, not only on expiry) ----
  //
  // Right before we spend money at GoDaddy we re-fetch the supplier cost and
  // the live USD/INR rate and re-run the full pricing engine (GST + gateway fee
  // + minimum profit). If what the customer actually paid no longer clears
  // cost + fees + minimum profit, the registration is blocked instead of being
  // executed at a loss.
  const settings = await loadSettings(db);
  const [tldMap, fx] = await Promise.all([loadTldPricing(db), getFxRate(db, settings)]);
  const { base: freshBase, purchase: fresh, protectionFee } = await quoteWithPrivacy(
    order.domain,
    Number(order.period ?? 1) || 1,
    order.privacy === true,
    settings,
    fx,
  );
  const price = computePrice(
    {
      supplierUsd: freshBase.totalUsd,
      supplierFirstYearUsd: freshBase.firstYearUsd,
      supplierRenewalUsd: freshBase.renewalUsd,
      periodYears: Number(order.period ?? 1) || 1,
      supplierCurrency: freshBase.currency,
      tld: order.tld,
    },

    settings,
    tldMap,
    fx,
  );

  // Privacy is a real GoDaddy line item; strip it so we compare like with like
  // against the domain price the engine just produced.
  const paidTotal = Number(order.payment_amount ?? order.customer_price ?? 0);
  const paidForDomain = paidTotal - protectionFee;

  if (paidForDomain + 0.5 < price.customer_price) {
    await db
      .from("domain_orders")
      .update({
        status: "failed",
        status_reason: "price_increased_after_payment",
        quote_token: fresh.quoteToken,
        quote_expires_at: fresh.expiresAt,
        supplier_cost: price.supplier_cost_usd,
        exchange_rate: fx.rate,
      })
      .eq("id", orderId);
    return { status: "failed", reason: "price_increased_after_payment", domain: order.domain };
  }

  // A still-valid v3 quote token keeps the locked supplier price; otherwise the
  // fresh token (or null for the v1 path) is used.
  const expired = !order.quote_expires_at || new Date(order.quote_expires_at) <= new Date();
  const quoteToken: string | null = expired ? fresh.quoteToken : (order.quote_token ?? fresh.quoteToken);

  await db
    .from("domain_orders")
    .update({
      quote_token: quoteToken,
      quote_expires_at: expired ? fresh.expiresAt : order.quote_expires_at,
      supplier_cost: price.supplier_cost_usd,
      exchange_rate: fx.rate,
      // Renewal is always re-priced from the fresh supplier cost so a stale,
      // too-cheap renewal figure can never be carried forward.
      renewal_price: price.renewal_price,
      profit: Math.round(paidTotal - price.supplier_cost),
    })
    .eq("id", orderId);


  await db.from("domain_orders").update({ status: "registration_pending", status_reason: null }).eq("id", orderId);

  try {
    const result = await executeRegistration({
      domain: order.domain,
      period: order.period,
      privacy: order.privacy,
      quoteToken,
      contact,
      consent: (order.contact as any)?.consent ?? { agreementKeys: ["DNRA"], agreedBy: "customer", agreedAt: new Date().toISOString() },
    });
    await db
      .from("domain_orders")
      .update({
        provider_order_id: result.orderId,
        provider_operation_id: result.operationId,
        registration_status: result.status,
      })
      .eq("id", orderId);
    return { status: "registration_pending", domain: order.domain, provider_order_id: result.orderId };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db.from("domain_orders").update({ status: "failed", status_reason: message.slice(0, 300) }).eq("id", orderId);
    throw e;
  }
}

// ---------------- routing ----------------

/**
 * Every action the marketplace serves. `check-api-health` dispatches to this
 * handler when the request action is in this set. Note the priced availability
 * check is `market_check_availability` — the bare `check_availability` action
 * belongs to the raw GoDaddy management handler (godaddyHandler.ts).
 */
const MARKET_ACTIONS = new Set([
  "storefront",
  "offers",
  "search",
  "market_check_availability",
  "create_quote",
  "agreements",
  "save_contact",
  "create_payment",
  "create_cart_payment",
  "confirm_payment",
  "order_status",
  "my_orders",
  "diagnostics",
  "admin_settings",
  "admin_save_settings",
  "admin_refresh_fx",
  "admin_save_tld",
  "admin_delete_tld",
  "admin_price_preview",
  "admin_stats",
  "admin_refresh_offers",
  "admin_resume_job",
  "admin_retry_registration",
  "cron_refresh_offers",
  "cron_renewal_reminders",
  "set_renewal_reminders",
  "renewal_reminder_status",
  "renewal_quote",
  "create_renewal_payment",
  "confirm_renewal_payment",
  "my_renewals",

]);

export const isDomainMarketAction = (action: string): boolean => MARKET_ACTIONS.has(action);

/**
 * Entry point called by `check-api-health` when the request carries a
 * marketplace action. Owns its own auth model: public actions need no login,
 * purchase actions need a signed-in user, admin actions need admin/owner.
 */
export async function handleDomainMarketRequest(req: Request, body: Record<string, any>): Promise<Response> {
  try {
    const ctx = await buildContext(req);
    const action = String(body.action ?? "");
    if (!action) return json({ error: "Missing action." }, 400);
    const result = await handleAction(action, body, ctx);
    return json({ success: true, ...(result as object) });
  } catch (error) {
    if (error instanceof InputError) return json({ error: error.message }, 400);
    if (error instanceof AuthError) return json({ error: error.message }, 401);
    if (error instanceof ForbiddenError) return json({ error: error.message }, 403);
    if (error instanceof GoDaddyError) {
      return json({ error: error.message, code: error.code }, error.status >= 400 && error.status < 600 ? error.status : 500);
    }
    console.error("domain-market error:", error instanceof Error ? error.message : String(error));
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
}
