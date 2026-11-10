import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { godaddy, GoDaddyError } from "./godaddyClient.ts";
import { handleGodaddyExtras, NOT_HANDLED } from "./godaddyExtras.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// ---------------- validation helpers ----------------

const DOMAIN_RE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const RECORD_TYPES = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SRV", "CAA"] as const;
type RecordType = (typeof RECORD_TYPES)[number];

class InputError extends Error {}

function requireDomain(value: unknown): string {
  const domain = String(value ?? "").trim().toLowerCase();
  if (!DOMAIN_RE.test(domain)) throw new InputError("Please enter a valid domain name, e.g. example.com");
  return domain;
}

function requireRecordType(value: unknown): RecordType {
  const type = String(value ?? "").trim().toUpperCase();
  if (!(RECORD_TYPES as readonly string[]).includes(type)) {
    throw new InputError(`Record type must be one of: ${RECORD_TYPES.join(", ")}`);
  }
  return type as RecordType;
}

function requireRecordName(value: unknown): string {
  const name = String(value ?? "").trim();
  if (!name || name.length > 255 || /\s/.test(name)) {
    throw new InputError("Record name is required and cannot contain spaces.");
  }
  return name;
}

function validateRecords(input: unknown, type: RecordType) {
  if (!Array.isArray(input) || input.length === 0) throw new InputError("At least one record value is required.");
  if (input.length > 100) throw new InputError("Too many records in a single update (max 100).");

  return input.map((r) => {
    const rec = (r ?? {}) as Record<string, unknown>;
    const data = String(rec.data ?? "").trim();
    if (!data) throw new InputError("Record value cannot be empty.");
    if (data.length > 1024) throw new InputError("Record value is too long.");

    const ttl = Number(rec.ttl ?? 3600);
    if (!Number.isFinite(ttl) || ttl < 600 || ttl > 604800) {
      throw new InputError("TTL must be between 600 and 604800 seconds.");
    }

    if (type === "A" && !/^\d{1,3}(\.\d{1,3}){3}$/.test(data)) {
      throw new InputError("An A record needs a valid IPv4 address, e.g. 192.0.2.1");
    }
    if (type === "AAAA" && !/^[0-9a-f:]+$/i.test(data)) {
      throw new InputError("An AAAA record needs a valid IPv6 address.");
    }
    if ((type === "CNAME" || type === "NS") && !/^[a-z0-9.\-_]+\.?$/i.test(data)) {
      throw new InputError(`A ${type} record must point to a valid hostname.`);
    }

    const out: Record<string, unknown> = { data, ttl };
    if (type === "MX") {
      const priority = Number(rec.priority ?? 10);
      if (!Number.isFinite(priority) || priority < 0 || priority > 65535) {
        throw new InputError("MX priority must be between 0 and 65535.");
      }
      out.priority = priority;
    }
    if (type === "SRV") {
      out.priority = Number(rec.priority ?? 1);
      out.weight = Number(rec.weight ?? 1);
      out.port = Number(rec.port ?? 443);
      out.service = String(rec.service ?? "").trim();
      out.protocol = String(rec.protocol ?? "").trim();
      if (!out.service || !out.protocol) throw new InputError("SRV records need a service and protocol.");
      if (!Number.isFinite(out.port as number) || (out.port as number) < 1 || (out.port as number) > 65535) {
        throw new InputError("SRV port must be between 1 and 65535.");
      }
    }
    return out;
  });
}

function validateNameservers(value: unknown): string[] {
  if (!Array.isArray(value) || value.length < 2) throw new InputError("Please provide at least two nameservers.");
  if (value.length > 13) throw new InputError("You can set at most 13 nameservers.");
  return value.map((ns) => {
    const host = String(ns ?? "").trim().toLowerCase();
    if (!DOMAIN_RE.test(host)) throw new InputError(`"${host}" is not a valid nameserver hostname.`);
    return host;
  });
}

function validateUrl(value: unknown): string {
  const raw = String(value ?? "").trim();
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new InputError("Please enter a full destination URL including https://");
  }
  if (!["http:", "https:"].includes(url.protocol)) throw new InputError("Forwarding URL must start with http:// or https://");
  return url.toString();
}

function requireCertificateId(value: unknown): string {
  const id = String(value ?? "").trim();
  if (!/^[A-Za-z0-9-]{6,64}$/.test(id)) throw new InputError("Please provide a valid certificate ID.");
  return id;
}

function requireCsr(value: unknown): string {
  const csr = String(value ?? "").trim();
  if (!/-----BEGIN (NEW )?CERTIFICATE REQUEST-----/.test(csr) || csr.length < 200 || csr.length > 8000) {
    throw new InputError("Paste a valid PEM certificate signing request (CSR).");
  }
  return csr;
}

const CERT_PRODUCT_TYPES = [
  "DV_SSL",
  "DV_WILDCARD_SSL",
  "EV_SSL",
  "OV_SSL",
  "OV_WILDCARD_SSL",
  "UCC_DV_SSL",
  "UCC_EV_SSL",
  "UCC_OV_SSL",
];

/** Builds and validates the body shared by certificate validate + purchase. */
function buildCertificateOrder(p: Record<string, unknown>): Record<string, unknown> {
  const csr = requireCsr(p.csr);
  const productType = String(p.productType ?? "DV_SSL").toUpperCase();
  if (!CERT_PRODUCT_TYPES.includes(productType)) throw new InputError("Select a valid certificate product.");
  const period = Math.min(Math.max(Number(p.period ?? 1), 1), 3);
  const slotSize = String(p.slotSize ?? "").toUpperCase();

  const order: Record<string, unknown> = { csr, productType, period };
  if (typeof p.commonName === "string" && p.commonName.trim()) {
    order.commonName = p.commonName.trim().toLowerCase();
  }
  if (Array.isArray(p.subjectAlternativeNames) && p.subjectAlternativeNames.length) {
    order.subjectAlternativeNames = p.subjectAlternativeNames
      .slice(0, 100)
      .map((s) => String(s).trim().toLowerCase())
      .filter(Boolean);
  }
  if (["FIVE", "TEN", "FIFTEEN", "TWENTY", "THIRTY", "FOURTY", "FIFTY", "HUNDRED"].includes(slotSize)) {
    order.slotSize = slotSize;
  }
  if (typeof p.callbackUrl === "string" && p.callbackUrl.trim()) order.callbackUrl = validateUrl(p.callbackUrl);
  if (p.contact && typeof p.contact === "object") order.contact = p.contact;
  if (p.organization && typeof p.organization === "object") order.organization = p.organization;
  if (typeof p.intelVPro === "boolean") order.intelVPro = p.intelVPro;
  if (typeof p.rootType === "string") order.rootType = p.rootType;
  return order;
}

function requireConfirmation(payload: Record<string, unknown>, domain: string) {
  const typed = String(payload.confirmDomain ?? "").trim().toLowerCase();
  if (typed !== domain) {
    throw new InputError("Type the exact domain name to confirm this action.");
  }
}

/** Root domain, or `sub.domain` when a subdomain label is supplied. */
function forwardTarget(domain: string, subdomain: unknown): string {
  const sub = String(subdomain ?? "").trim().toLowerCase().replace(/\.$/, "");
  if (!sub || sub === "@") return domain;
  if (sub === domain || sub.endsWith(`.${domain}`)) {
    if (!DOMAIN_RE.test(sub)) throw new InputError("That subdomain is not valid.");
    return sub;
  }
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9-]{1,63})*$/.test(sub)) {
    throw new InputError("That subdomain is not valid.");
  }
  return `${sub}.${domain}`;
}

// ---------------- USD -> INR rate ----------------

let fxCache: { day: string; rate: number; source: string; at: number } | null = null;
/** Google's card moves intraday, so this quote is only reused for 15 minutes. */
const FX_TTL_MS = 15 * 60 * 1000;

const today = () => new Date().toISOString().slice(0, 10);

/** Plain median of a non-empty list. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const m = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return Number(m.toFixed(4));
}

const saneFx = (n: number) => Number.isFinite(n) && n > 20 && n < 500;

/** Google Finance USD-INR — the exact number shown on Google's currency card. */
async function googleFinanceRate(): Promise<{ rate: number; source: string } | null> {
  try {
    const res = await fetch("https://www.google.com/finance/quote/USD-INR", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    for (const p of [
      /,(\d{2,3}(?:\.\d{1,6})?),"USD \/ INR"/,
      /data-last-price="(\d{2,3}(?:\.\d{1,6})?)"/,
      /class="YMlKec fxKbKc">[^\d]*(\d{2,3}(?:\.\d{1,6})?)/,
    ]) {
      const rate = Number(html.match(p)?.[1]);
      if (saneFx(rate)) return { rate: Number(rate.toFixed(4)), source: "google_finance" };
    }
  } catch { /* ignore */ }
  return null;
}

/** Yahoo USDINR=X — an intraday mid-market quote, like Google's card. */
async function yahooRate(): Promise<{ rate: number; source: string } | null> {
  try {
    const res = await fetch(
      "https://query1.finance.yahoo.com/v8/finance/chart/USDINR=X?interval=1m&range=1d",
      { headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" } },
    );
    if (!res.ok) return null;
    const j = await res.json();
    const rate = Number(j?.chart?.result?.[0]?.meta?.regularMarketPrice);
    if (!saneFx(rate)) return null;
    return { rate: Number(rate.toFixed(4)), source: "yahoo_finance" };
  } catch { /* ignore */ }
  return null;
}

async function fetchUsdInrRate(): Promise<{ rate: number; day: string; source: string }> {
  const day = today();
  if (fxCache && fxCache.day === day && Date.now() - fxCache.at < FX_TTL_MS) {
    const { rate, source } = fxCache;
    return { rate, day, source };
  }

  // Intraday quotes first: they are what the owner compares against on Google.
  const [google, yahoo] = await Promise.all([googleFinanceRate(), yahooRate()]);
  if (google) {
    fxCache = { day, rate: google.rate, source: google.source, at: Date.now() };
    return { rate: google.rate, day, source: google.source };
  }
  if (yahoo) {
    fxCache = { day, rate: yahoo.rate, source: yahoo.source, at: Date.now() };
    return { rate: yahoo.rate, day, source: yahoo.source };
  }

  // Reference feeds. Each publishes a value date; anything older than today is
  // a lagging fixing and is dropped, since that is what made the saved rate
  // drift below Google's number.
  const sources: Array<{ url: string; pick: (j: any) => number; day: (j: any) => string | undefined }> = [
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

  const found: Array<{ rate: number; source: string; stale: boolean }> = [];
  for (const s of sources) {
    try {
      const res = await fetch(s.url, { headers: { Accept: "application/json" } });
      if (!res.ok) continue;
      const j = await res.json();
      const rate = s.pick(j);
      if (!saneFx(rate)) continue;
      const valueDay = s.day(j);
      found.push({ rate, source: new URL(s.url).hostname, stale: !!valueDay && valueDay < day });
    } catch {
      /* try next source */
    }
  }

  const pool = found.filter((f) => !f.stale).length ? found.filter((f) => !f.stale) : found;
  if (pool.length) {
    // Drop feeds more than 2% from the median, then average the rest.
    const med = median(pool.map((f) => f.rate));
    const kept = pool.filter((f) => Math.abs(f.rate - med) / med <= 0.02);
    const used = kept.length ? kept : pool;
    const rate = Number((used.reduce((s, f) => s + f.rate, 0) / used.length).toFixed(4));
    const source = `median:${used.map((f) => f.source).join("+")}`;
    fxCache = { day, rate, source, at: Date.now() };
    return { rate, day, source };
  }

  // Last known rate, or a safe fallback so pricing still renders.
  const fallback = fxCache?.rate ?? 88;
  fxCache = { day, rate: fallback, source: "fallback", at: Date.now() };
  return { rate: fallback, day, source: "fallback" };
}


// ---------------- action handlers ----------------

type Payload = Record<string, unknown>;

async function handleAction(action: string, p: Payload): Promise<unknown> {
  switch (action) {
    case "usd_inr_rate": {
      const fx = await fetchUsdInrRate();
      return { rate: fx.rate, day: fx.day, source: fx.source };
    }


    // ---- search / availability ----
    case "check_availability": {
      const domain = requireDomain(p.domain);
      const availability = await godaddy({
        path: "/v1/domains/available",
        query: { domain, checkType: "FULL", forTransfer: false },
      });
      return { availability };
    }

    case "suggest": {
      const query = String(p.query ?? "").trim().slice(0, 100);
      if (!query) throw new InputError("Enter a keyword or domain to search.");
      const limit = Math.min(Math.max(Number(p.limit ?? 12), 1), 25);
      const suggestions = await godaddy({
        path: "/v1/domains/suggest",
        query: { query, limit, waitMs: 2000 },
      });
      return { suggestions };
    }

    case "check_bulk": {
      const list = Array.isArray(p.domains) ? p.domains.slice(0, 25).map(requireDomain) : [];
      if (!list.length) throw new InputError("No domains to check.");
      const results = await godaddy({
        path: "/v1/domains/available",
        method: "POST",
        query: { checkType: "FAST" },
        body: list,
      });
      return { results };
    }

    // ---- portfolio ----
    case "list_domains": {
      const domains = await godaddy({
        path: "/v1/domains",
        query: { limit: Math.min(Number(p.limit ?? 100), 1000), includes: "nameServers" },
      });
      return { domains };
    }

    case "get_domain": {
      const domain = requireDomain(p.domain);
      const details = await godaddy({ path: `/v1/domains/${encodeURIComponent(domain)}` });
      return { details };
    }

    case "update_domain": {
      const domain = requireDomain(p.domain);
      const body: Record<string, unknown> = {};
      if (typeof p.renewAuto === "boolean") body.renewAuto = p.renewAuto;
      if (typeof p.locked === "boolean") body.locked = p.locked;
      if (typeof p.exposeWhois === "boolean") body.exposeWhois = p.exposeWhois;
      if (p.nameServers !== undefined) body.nameServers = validateNameservers(p.nameServers);
      if (!Object.keys(body).length) throw new InputError("Nothing to update.");
      await godaddy({ path: `/v1/domains/${encodeURIComponent(domain)}`, method: "PATCH", body });
      return { updated: true };
    }

    case "update_nameservers": {
      const domain = requireDomain(p.domain);
      const nameServers = validateNameservers(p.nameServers);
      await godaddy({
        path: `/v1/domains/${encodeURIComponent(domain)}`,
        method: "PATCH",
        body: { nameServers },
      });
      return { updated: true, nameServers };
    }

    case "cancel_domain": {
      const domain = requireDomain(p.domain);
      requireConfirmation(p, domain);
      await godaddy({ path: `/v1/domains/${encodeURIComponent(domain)}`, method: "DELETE" });
      return { cancelled: true };
    }

    // ---- DNS ----
    case "list_records": {
      const domain = requireDomain(p.domain);
      const records = await godaddy({
        path: `/v1/domains/${encodeURIComponent(domain)}/records`,
        query: { limit: 500 },
      });
      return { records };
    }

    case "replace_records": {
      // Replaces every record of a given type+name (add / edit both use this).
      const domain = requireDomain(p.domain);
      const type = requireRecordType(p.type);
      const name = requireRecordName(p.name);
      const records = validateRecords(p.records, type);
      await godaddy({
        path: `/v1/domains/${encodeURIComponent(domain)}/records/${type}/${encodeURIComponent(name)}`,
        method: "PUT",
        body: records,
      });
      return { saved: true };
    }

    case "delete_records": {
      const domain = requireDomain(p.domain);
      const type = requireRecordType(p.type);
      const name = requireRecordName(p.name);
      if (p.confirm !== true) throw new InputError("Please confirm before deleting DNS records.");
      await godaddy({
        path: `/v1/domains/${encodeURIComponent(domain)}/records/${type}/${encodeURIComponent(name)}`,
        method: "DELETE",
      });
      return { deleted: true };
    }

    // ---- contacts ----
    case "update_contacts": {
      const domain = requireDomain(p.domain);
      const contacts = (p.contacts ?? {}) as Record<string, unknown>;
      if (!Object.keys(contacts).length) throw new InputError("No contact details provided.");
      await godaddy({
        path: `/v1/domains/${encodeURIComponent(domain)}/contacts`,
        method: "PATCH",
        body: contacts,
      });
      return { updated: true };
    }

    // ---- forwarding (root domain or a subdomain) ----
    case "get_forwarding": {
      const domain = requireDomain(p.domain);
      const forwards = await godaddy({
        path: `/v1/domains/forwards/${encodeURIComponent(domain)}`,
        query: { includeSubs: true },
      });
      return { forwards };
    }

    case "update_forwarding": {
      const domain = requireDomain(p.domain);
      const fqdn = forwardTarget(domain, p.subdomain);
      const url = validateUrl(p.url);
      const type = String(p.type ?? "").toUpperCase() === "MASKED" ? "MASKED" : "REDIRECT";
      const body: Record<string, unknown> = { type, url };
      if (p.mask && typeof p.mask === "object") body.mask = p.mask;
      await godaddy({
        path: `/v1/domains/forwards/${encodeURIComponent(fqdn)}`,
        method: "PUT",
        body,
      });
      return { updated: true, fqdn };
    }

    case "delete_forwarding": {
      const domain = requireDomain(p.domain);
      const fqdn = forwardTarget(domain, p.subdomain);
      if (p.confirm !== true) throw new InputError("Please confirm before removing forwarding.");
      await godaddy({
        path: `/v1/domains/forwards/${encodeURIComponent(fqdn)}`,
        method: "DELETE",
      });
      return { deleted: true, fqdn };
    }


    // ---- transfer ----
    case "check_transfer": {
      const domain = requireDomain(p.domain);
      const availability = await godaddy({
        path: "/v1/domains/available",
        query: { domain, checkType: "FULL", forTransfer: true },
      });
      return { availability };
    }

    case "transfer_in": {
      const domain = requireDomain(p.domain);
      requireConfirmation(p, domain);
      const authCode = String(p.authCode ?? "").trim();
      if (!authCode) throw new InputError("An authorization (EPP) code is required to transfer a domain.");
      const result = await godaddy({
        path: `/v1/domains/${encodeURIComponent(domain)}/transfer`,
        method: "POST",
        body: {
          authCode,
          renewAuto: p.renewAuto !== false,
          privacy: p.privacy === true,
          period: 1,
          consent: p.consent,
        },
      });
      return { transfer: result };
    }

    case "resend_transfer_email": {
      const domain = requireDomain(p.domain);
      await godaddy({
        path: `/v1/domains/${encodeURIComponent(domain)}/transferOutEmail`,
        method: "POST",
      });
      return { sent: true };
    }

    // ---- purchase support ----
    case "purchase_schema": {
      const tld = String(p.tld ?? "").trim().replace(/^\./, "").toLowerCase();
      if (!/^[a-z]{2,63}$/.test(tld)) throw new InputError("Invalid domain extension.");
      const schema = await godaddy({ path: `/v1/domains/purchase/schema/${tld}` });
      return { schema };
    }

    case "purchase_agreements": {
      const tlds = String(p.tlds ?? "").trim().toLowerCase();
      if (!tlds) throw new InputError("Invalid domain extension.");
      const agreements = await godaddy({
        path: "/v1/domains/agreements",
        query: { tlds, privacy: p.privacy === true, forTransfer: p.forTransfer === true },
      });
      return { agreements };
    }

    case "purchase_domain": {
      const domain = requireDomain(p.domain);
      requireConfirmation(p, domain);
      const order = (p.order ?? {}) as Record<string, unknown>;
      if (!order.consent) throw new InputError("Registration consent details are required.");
      const result = await godaddy({
        path: "/v1/domains/purchase",
        method: "POST",
        body: { ...order, domain },
      });
      return { order: result };
    }

    // ---- host / glue records (domains.host:update) ----
    case "create_host": {
      const domain = requireDomain(p.domain);
      const name = requireRecordName(p.name).toLowerCase();
      const ipAddresses = (Array.isArray(p.ipAddresses) ? p.ipAddresses : []).map((ip) => {
        const value = String(ip ?? "").trim();
        if (!/^(\d{1,3}\.){3}\d{1,3}$|^[0-9a-f:]{2,45}$/i.test(value)) {
          throw new InputError(`"${value}" is not a valid IP address.`);
        }
        return value;
      });
      if (!ipAddresses.length) throw new InputError("At least one IP address is required for a host record.");
      await godaddy({
        path: `/v1/domains/${encodeURIComponent(domain)}/hosts`,
        method: "POST",
        body: { name, ipAddresses },
      });
      return { created: true, name, ipAddresses };
    }

    case "update_host": {
      const domain = requireDomain(p.domain);
      const name = requireRecordName(p.name).toLowerCase();
      const ipAddresses = (Array.isArray(p.ipAddresses) ? p.ipAddresses : []).map((ip) => String(ip ?? "").trim()).filter(Boolean);
      if (!ipAddresses.length) throw new InputError("At least one IP address is required for a host record.");
      await godaddy({
        path: `/v1/domains/${encodeURIComponent(domain)}/hosts/${encodeURIComponent(name)}`,
        method: "PUT",
        body: { ipAddresses },
      });
      return { updated: true, name, ipAddresses };
    }

    case "delete_host": {
      const domain = requireDomain(p.domain);
      const name = requireRecordName(p.name).toLowerCase();
      await godaddy({
        path: `/v1/domains/${encodeURIComponent(domain)}/hosts/${encodeURIComponent(name)}`,
        method: "DELETE",
      });
      return { deleted: true, name };
    }

    case "get_host": {
      const domain = requireDomain(p.domain);
      const name = requireRecordName(p.name).toLowerCase();
      const host = await godaddy({
        path: `/v1/domains/${encodeURIComponent(domain)}/hosts/${encodeURIComponent(name)}`,
      });
      return { host };
    }

    // ---- DNS: add / replace-all (dns:update) ----
    case "add_records": {
      const domain = requireDomain(p.domain);
      const list = Array.isArray(p.records) ? p.records : [];
      if (!list.length) throw new InputError("At least one record is required.");
      if (list.length > 100) throw new InputError("Too many records in a single update (max 100).");
      const body = list.map((r) => {
        const rec = (r ?? {}) as Record<string, unknown>;
        const type = requireRecordType(rec.type);
        const name = requireRecordName(rec.name);
        const [validated] = validateRecords([rec], type);
        return { ...validated, type, name };
      });
      await godaddy({
        path: `/v1/domains/${encodeURIComponent(domain)}/records`,
        method: "PATCH",
        body,
      });
      return { added: true, count: body.length };
    }

    case "replace_all_records": {
      const domain = requireDomain(p.domain);
      if (p.confirm !== true) throw new InputError("Please confirm before replacing the whole DNS zone.");
      const list = Array.isArray(p.records) ? p.records : [];
      if (!list.length) throw new InputError("At least one record is required.");
      const body = list.map((r) => {
        const rec = (r ?? {}) as Record<string, unknown>;
        const type = requireRecordType(rec.type);
        const name = requireRecordName(rec.name);
        const [validated] = validateRecords([rec], type);
        return { ...validated, type, name };
      });
      await godaddy({
        path: `/v1/domains/${encodeURIComponent(domain)}/records`,
        method: "PUT",
        body,
      });
      return { replaced: true, count: body.length };
    }

    // ---- renewal (domain:update) ----
    case "renew_domain": {
      const domain = requireDomain(p.domain);
      requireConfirmation(p, domain);
      const period = Math.min(Math.max(Number(p.period ?? 1), 1), 10);
      const renewal = await godaddy({
        path: `/v1/domains/${encodeURIComponent(domain)}/renew`,
        method: "POST",
        body: { period },
      });
      return { renewal, period };
    }

    // ---- pending actions (domain:read / domain:update) ----
    case "list_actions": {
      const domain = requireDomain(p.domain);
      const actions = await godaddy({
        path: `/v1/domains/${encodeURIComponent(domain)}/actions`,
      });
      return { actions };
    }

    case "cancel_action": {
      const domain = requireDomain(p.domain);
      const type = String(p.type ?? "").trim().toUpperCase();
      if (!/^[A-Z_]{2,60}$/.test(type)) throw new InputError("Select a valid pending action to cancel.");
      await godaddy({
        path: `/v1/domains/${encodeURIComponent(domain)}/actions/${encodeURIComponent(type)}`,
        method: "DELETE",
      });
      return { cancelled: true, type };
    }

    // ---- contact validation & verification (contact:update) ----
    case "validate_contacts": {
      const contacts = (p.contacts ?? {}) as Record<string, unknown>;
      if (!Object.keys(contacts).length) throw new InputError("No contact details provided.");
      await godaddy({
        path: "/v1/domains/contacts/validate",
        method: "POST",
        query: { marketId: String(p.marketId ?? "en-IN") },
        body: contacts,
      });
      return { valid: true };
    }

    case "verify_registrant_email": {
      const domain = requireDomain(p.domain);
      await godaddy({
        path: `/v1/domains/${encodeURIComponent(domain)}/verifyRegistrantEmail`,
        method: "POST",
      });
      return { sent: true };
    }

    // ---- transfer out (transfer:execute) ----
    case "transfer_out": {
      const domain = requireDomain(p.domain);
      requireConfirmation(p, domain);
      await godaddy({
        path: `/v1/domains/${encodeURIComponent(domain)}/transferOut`,
        method: "POST",
      });
      return { started: true };
    }

    // ---- explicit re-sync of one domain from GoDaddy ----
    case "sync_domain": {
      const domain = requireDomain(p.domain);
      const details = await godaddy({ path: `/v1/domains/${encodeURIComponent(domain)}` });
      return { details, synced: true };
    }

    // ---- live SSL certificate status for a domain ----
    case "ssl_status": {
      const domain = requireDomain(p.domain);
      const host = String(p.host ?? domain).trim().toLowerCase();
      const target = host === domain || host === `www.${domain}` ? host : domain;

      let httpsOk = false;
      let httpsError: string | null = null;
      let statusCode: number | null = null;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(`https://${target}/`, {
          method: "HEAD",
          redirect: "manual",
          signal: controller.signal,
        });
        clearTimeout(timer);
        httpsOk = true;
        statusCode = res.status;
      } catch (e) {
        httpsOk = false;
        const msg = e instanceof Error ? e.message : String(e);
        httpsError = /certificate|tls|ssl/i.test(msg)
          ? "The certificate could not be validated."
          : "HTTPS did not respond for this domain.";
      }

      // Public Certificate Transparency lookup for issuer + validity dates.
      let cert: Record<string, unknown> | null = null;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(
          `https://crt.sh/?q=${encodeURIComponent(target)}&output=json&exclude=expired`,
          { headers: { Accept: "application/json" }, signal: controller.signal },
        );
        clearTimeout(timer);
        if (res.ok) {
          const rows = (await res.json()) as Array<Record<string, any>>;
          if (Array.isArray(rows) && rows.length) {
            const newest = rows
              .filter((r) => r?.not_after)
              .sort((a, b) => new Date(b.not_after).getTime() - new Date(a.not_after).getTime())[0];
            if (newest) {
              const notAfter = new Date(String(newest.not_after));
              cert = {
                issuer: String(newest.issuer_name ?? "").replace(/^.*?O=([^,]+).*$/, "$1") || "Unknown",
                common_name: String(newest.common_name ?? target),
                valid_from: newest.not_before ? new Date(String(newest.not_before)).toISOString() : null,
                valid_to: notAfter.toISOString(),
                days_remaining: Math.floor((notAfter.getTime() - Date.now()) / 86400000),
              };
            }
          }
        }
      } catch (e) {
        console.error("crt.sh lookup failed:", e instanceof Error ? e.message : String(e));
      }

      const days = cert?.days_remaining as number | undefined;
      const state = !httpsOk && !cert
        ? "none"
        : typeof days === "number" && days < 0
          ? "expired"
          : typeof days === "number" && days <= 30
            ? "expiring"
            : httpsOk
              ? "active"
              : "issued";

      return {
        ssl: {
          host: target,
          state,
          https_ok: httpsOk,
          https_status: statusCode,
          error: httpsError,
          certificate: cert,
          auto_renew_note:
            "Certificates issued by your hosting provider (Lovable, Cloudflare, GoDaddy hosting) renew automatically before expiry.",
        },
      };
    }

    // ---- WHOIS privacy add-on (paid Full Domain Protection) ----
    case "privacy_agreements": {
      const domain = requireDomain(p.domain);
      const tld = domain.split(".").slice(1).join(".");
      const agreements = await godaddy({
        path: "/v1/domains/agreements",
        query: { tlds: tld, privacy: true, forTransfer: false },
      });
      return { agreements };
    }

    case "privacy_purchase": {
      const domain = requireDomain(p.domain);
      const consent = (p.consent ?? {}) as Record<string, unknown>;
      const keys = Array.isArray(consent.agreementKeys) ? consent.agreementKeys.map(String) : [];
      if (!keys.length) throw new InputError("Please accept the privacy agreement before continuing.");
      const purchase = await godaddy({
        path: `/v1/domains/${encodeURIComponent(domain)}/privacy/purchase`,
        method: "POST",
        body: {
          consent: {
            agreementKeys: keys,
            agreedBy: String(consent.agreedBy ?? "customer").slice(0, 255),
            agreedAt: String(consent.agreedAt ?? new Date().toISOString()),
          },
        },
      });
      return { purchased: true, purchase };
    }

    case "privacy_delete": {
      const domain = requireDomain(p.domain);
      requireConfirmation(p, domain);
      await godaddy({
        path: `/v1/domains/${encodeURIComponent(domain)}/privacy`,
        method: "DELETE",
      });
      return { deleted: true };
    }

    // ---- bulk operations across many owned domains ----
    case "bulk_update_domains": {
      const list = Array.isArray(p.domains) ? p.domains.slice(0, 50).map(requireDomain) : [];
      if (!list.length) throw new InputError("Select at least one domain.");
      const patch: Record<string, unknown> = {};
      if (typeof p.renewAuto === "boolean") patch.renewAuto = p.renewAuto;
      if (typeof p.locked === "boolean") patch.locked = p.locked;
      if (typeof p.exposeWhois === "boolean") patch.exposeWhois = p.exposeWhois;
      if (p.nameServers !== undefined) patch.nameServers = validateNameservers(p.nameServers);
      if (!Object.keys(patch).length) throw new InputError("Nothing to update.");

      const results: Array<{ domain: string; ok: boolean; error?: string }> = [];
      for (const domain of list) {
        try {
          await godaddy({
            path: `/v1/domains/${encodeURIComponent(domain)}`,
            method: "PATCH",
            body: patch,
          });
          results.push({ domain, ok: true });
        } catch (e) {
          results.push({
            domain,
            ok: false,
            error: e instanceof Error ? e.message : "Update failed.",
          });
        }
      }
      return {
        results,
        succeeded: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok).length,
      };
    }

    // ---- paid SSL certificates (GoDaddy Certificates API) ----
    case "certificate_list": {
      const customerId = String(p.customerId ?? "").trim();
      if (!/^[A-Za-z0-9-]{4,64}$/.test(customerId)) {
        throw new InputError("A valid GoDaddy customer ID is required to list certificates.");
      }
      const certificates = await godaddy({
        path: `/v2/customers/${encodeURIComponent(customerId)}/certificates`,
        query: { limit: Math.min(Number(p.limit ?? 50), 200), offset: Number(p.offset ?? 0) },
      });
      return { certificates };
    }

    case "certificate_get": {
      const id = requireCertificateId(p.certificateId);
      const certificate = await godaddy({ path: `/v1/certificates/${encodeURIComponent(id)}` });
      return { certificate };
    }

    case "certificate_actions": {
      const id = requireCertificateId(p.certificateId);
      const actions = await godaddy({ path: `/v1/certificates/${encodeURIComponent(id)}/actions` });
      return { actions };
    }

    case "certificate_download": {
      const id = requireCertificateId(p.certificateId);
      const download = await godaddy({ path: `/v1/certificates/${encodeURIComponent(id)}/download` });
      return { download };
    }

    case "certificate_validate": {
      const order = buildCertificateOrder(p);
      await godaddy({ path: "/v1/certificates/validate", method: "POST", body: order });
      return { valid: true };
    }

    case "certificate_purchase": {
      const order = buildCertificateOrder(p);
      if (p.consent !== true) throw new InputError("Please accept the certificate terms before purchasing.");
      const result = await godaddy({ path: "/v1/certificates", method: "POST", body: order });
      return { order: result };
    }

    case "certificate_reissue": {
      const id = requireCertificateId(p.certificateId);
      const csr = requireCsr(p.csr);
      const body: Record<string, unknown> = { csr };
      if (Array.isArray(p.subjectAlternativeNames)) {
        body.subjectAlternativeNames = p.subjectAlternativeNames.slice(0, 100).map((s) => String(s).trim().toLowerCase());
      }
      if (typeof p.commonName === "string" && p.commonName.trim()) {
        body.commonName = p.commonName.trim().toLowerCase();
      }
      if (typeof p.callbackUrl === "string" && p.callbackUrl.trim()) body.callbackUrl = validateUrl(p.callbackUrl);
      await godaddy({
        path: `/v1/certificates/${encodeURIComponent(id)}/reissue`,
        method: "POST",
        body,
      });
      return { reissued: true, certificateId: id };
    }

    case "certificate_renew": {
      const id = requireCertificateId(p.certificateId);
      const csr = requireCsr(p.csr);
      const period = Math.min(Math.max(Number(p.period ?? 1), 1), 3);
      await godaddy({
        path: `/v1/certificates/${encodeURIComponent(id)}/renew`,
        method: "POST",
        body: { csr, period },
      });
      return { renewed: true, certificateId: id };
    }

    case "certificate_cancel": {
      const id = requireCertificateId(p.certificateId);
      if (p.confirm !== true) throw new InputError("Please confirm before cancelling this certificate.");
      await godaddy({
        path: `/v1/certificates/${encodeURIComponent(id)}/cancel`,
        method: "POST",
      });
      return { cancelled: true, certificateId: id };
    }

    case "certificate_revoke": {
      const id = requireCertificateId(p.certificateId);
      if (p.confirm !== true) throw new InputError("Please confirm before revoking this certificate.");
      const reason = String(p.reason ?? "CESSATION_OF_OPERATION").toUpperCase();
      const allowed = ["AFFILIATION_CHANGED", "CESSATION_OF_OPERATION", "KEY_COMPROMISE", "PRIVILEGE_WITHDRAWN", "SUPERSEDED"];
      if (!allowed.includes(reason)) throw new InputError("Select a valid revocation reason.");
      await godaddy({
        path: `/v1/certificates/${encodeURIComponent(id)}/revoke`,
        method: "POST",
        body: { reason },
      });
      return { revoked: true, certificateId: id };
    }


    default: {
      // Everything else (abuse, aftermarket, agreements, countries, orders,
      // shoppers, subscriptions, TLDs, domains v2, notifications, maintenances).
      const extra = await handleGodaddyExtras(action, p);
      if (extra !== NOT_HANDLED) return extra;
      throw new InputError("Unsupported domain action.");
    }
  }
}

/** Actions whose success changes GoDaddy state, so the saved copy must be refreshed. */
const MUTATING_ACTIONS = new Set([
  "update_domain",
  "update_nameservers",
  "renew_domain",
  "update_contacts",
  "transfer_in",
  "transfer_out",
  "cancel_action",
  "sync_domain",
  "privacy_purchase",
  "privacy_delete",
]);


/** Pulls the live GoDaddy record for one domain and mirrors it into managed_domains. */
async function syncDomainRow(
  supabase: SupabaseClient<any, "public", any>,
  userId: string,
  domain: string,
): Promise<Record<string, unknown> | null> {
  try {
    const d = await godaddy<Record<string, any>>({ path: `/v1/domains/${encodeURIComponent(domain)}` });
    const row = {
      user_id: userId,
      provider: "godaddy",
      domain: domain.toLowerCase(),
      status: String(d?.status ?? "unknown"),
      expires_at: d?.expires ? new Date(String(d.expires)).toISOString() : null,
      renew_auto: d?.renewAuto === true,
      locked: d?.locked === true,
      nameservers: Array.isArray(d?.nameServers) ? d.nameServers.map(String) : [],
      metadata: {
        privacy: d?.privacy === true,
        exposeWhois: d?.exposeWhois === true,
        domainId: d?.domainId ?? null,
        contactRegistrant: d?.contactRegistrant ?? null,
        transferProtected: d?.transferProtected ?? null,
      },
      last_synced_at: new Date().toISOString(),
    };
    await supabase.from("managed_domains").upsert(row, { onConflict: "user_id,provider,domain" });
    return d;
  } catch (e) {
    console.error("domain sync skipped:", e instanceof Error ? e.message : String(e));
    return null;
  }
}


// ---------------- entry point ----------------

/**
 * Merged into the already-deployed `check-api-health` function so GoDaddy domain
 * management works without provisioning a brand new edge function.
 * The host function parses the JSON body and delegates here when it has an `action`.
 */
export async function handleGodaddyRequest(req: Request, body: Payload): Promise<Response> {

  try {
    // 1. Authenticate the Supabase user.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Please sign in to manage domains." }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: userData } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    const user = userData?.user;
    if (!user) return json({ error: "Your session has expired. Please sign in again." }, 401);

    // 2. Authorize: employers (company owners) and admins only.
    const [{ data: company }, { data: roles }] = await Promise.all([
      supabase.from("companies").select("id").eq("user_id", user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", user.id),
    ]);

    const roleList = (roles ?? []).map((r: { role: string }) => r.role);
    const isPrivileged = roleList.some((r) => ["owner", "admin"].includes(r));
    if (!company && !isPrivileged) {
      return json({ error: "You do not have access to domain management." }, 403);
    }

    // 3. Route the action.
    const action = String(body.action ?? "");

    // ---- temporary diagnostic: what currency does GoDaddy really answer in? ----
    // Admin/owner only. Returns the RAW availability payload for one domain under
    // different marketId/currencyType combinations so we can confirm whether the
    // reseller account is USD-only (in which case the billing currency must be
    // changed on GoDaddy's side — no stored/fake INR prices are ever invented).
    if (action === "raw_currency_probe") {
      if (!isPrivileged) return json({ error: "Admins only." }, 403);
      const domain = requireDomain(body.domain ?? "example.com");
      const variants: Array<{ label: string; query: Record<string, string> }> = [
        { label: "store default (marketId=en-IN, currencyType=INR)", query: {} },
        { label: "explicit INR / en-IN", query: { currencyType: "INR", marketId: "en-IN" } },
        { label: "explicit USD / en-US", query: { currencyType: "USD", marketId: "en-US" } },
        { label: "marketId only (en-IN, no currencyType)", query: { currencyType: "", marketId: "en-IN" } },
      ];

      const probes: unknown[] = [];
      for (const v of variants) {
        try {
          const raw = await godaddy<Record<string, unknown>>({
            path: "/v1/domains/available",
            query: { domain, checkType: "FULL", forTransfer: false, ...v.query },
          });
          probes.push({
            variant: v.label,
            raw,
            reported_currency: (raw as Record<string, unknown>)?.currency ?? null,
            price_micro: (raw as Record<string, unknown>)?.price ?? null,
          });
          console.log(`[currency-probe] ${v.label} ->`, JSON.stringify(raw));
        } catch (e) {
          probes.push({ variant: v.label, error: e instanceof Error ? e.message : String(e) });
        }
      }

      return json({
        success: true,
        domain,
        note:
          "GoDaddy returns prices in micro-units (price / 1e6) of `currency`. If every variant reports USD, the reseller account is USD-only and its billing currency must be switched to INR at GoDaddy.",
        probes,
      });
    }

    let result: unknown;

    if (action === "list_domains") {
      // Live portfolio from GoDaddy, but never fail the screen: fall back to saved rows.
      let live: Record<string, unknown>[] = [];
      try {
        const r = await handleAction(action, body) as { domains?: unknown };
        if (Array.isArray(r.domains)) live = r.domains as Record<string, unknown>[];
      } catch (liveError) {
        console.error(
          "list_domains live fetch failed, using saved domains:",
          liveError instanceof Error ? liveError.message : String(liveError),
        );
      }

      if (live.length) {
        const rows = live.slice(0, 500).map((d) => ({
          user_id: user.id,
          provider: "godaddy",
          domain: String(d.domain ?? "").toLowerCase(),
          status: String(d.status ?? "unknown"),
          expires_at: d.expires ? new Date(String(d.expires)).toISOString() : null,
          renew_auto: d.renewAuto === true,
          locked: d.locked === true,
          nameservers: Array.isArray(d.nameServers) ? d.nameServers.map(String) : [],
          metadata: { privacy: d.privacy === true, domainId: d.domainId ?? null },
          last_synced_at: new Date().toISOString(),
        })).filter((r) => r.domain);

        try {
          await supabase.from("managed_domains").upsert(rows, { onConflict: "user_id,provider,domain" });
        } catch (persistError) {
          console.error(
            "godaddy-domains persistence skipped:",
            persistError instanceof Error ? persistError.message : String(persistError),
          );
        }
      }

      // Merge saved domains (test/demo entries included) with the live list.
      const merged = [...live];
      try {
        const { data: saved } = await supabase
          .from("managed_domains")
          .select("domain,status,expires_at,renew_auto,locked,nameservers,metadata")
          .eq("user_id", user.id);

        const seen = new Set(merged.map((d) => String(d.domain ?? "").toLowerCase()));
        for (const s of saved ?? []) {
          const name = String((s as Record<string, unknown>).domain ?? "").toLowerCase();
          if (!name || seen.has(name)) continue;
          const row = s as Record<string, any>;
          merged.push({
            domain: name,
            status: row.status ?? "unknown",
            expires: row.expires_at ?? null,
            renewAuto: row.renew_auto === true,
            locked: row.locked === true,
            privacy: row.metadata?.privacy === true,
            nameServers: Array.isArray(row.nameservers) ? row.nameservers : [],
          });
          seen.add(name);
        }
      } catch (readError) {
        console.error(
          "saved domains read skipped:",
          readError instanceof Error ? readError.message : String(readError),
        );
      }

      result = { domains: merged };
    } else {
      result = await handleAction(action, body);

      // Keep the website's saved copy in step with GoDaddy after any change.
      if (MUTATING_ACTIONS.has(action) && typeof body.domain === "string") {
        const domain = String(body.domain).trim().toLowerCase();
        if (DOMAIN_RE.test(domain)) {
          const live = await syncDomainRow(supabase, user.id, domain);
          if (live) result = { ...(result as object), details: live, synced: true };
        }
      }

      // A cancelled domain no longer exists at GoDaddy: drop the saved row.
      if (action === "cancel_domain" && typeof body.domain === "string") {
        try {
          await supabase
            .from("managed_domains")
            .delete()
            .eq("user_id", user.id)
            .eq("provider", "godaddy")
            .eq("domain", String(body.domain).trim().toLowerCase());
        } catch (e) {
          console.error("saved domain delete skipped:", e instanceof Error ? e.message : String(e));
        }
      }
    }


    return json({ success: true, ...(result as object) });

  } catch (error) {
    if (error instanceof InputError) return json({ error: error.message }, 400);
    if (error instanceof Error && error.name === "ExtrasInputError") return json({ error: error.message }, 400);
    if (error instanceof GoDaddyError) {
      return json({ error: error.message, code: error.code }, error.status >= 400 && error.status < 600 ? error.status : 500);
    }
    console.error("godaddy-domains unexpected error:", error instanceof Error ? error.message : String(error));
    return json({ error: "Something went wrong while contacting the domain service." }, 500);
  }
}
