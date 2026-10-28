// Reusable server-side GoDaddy Domains API helper.
// The PAT never leaves this module and is never returned to the client.
//
// Versioning: GoDaddy currently exposes availability, suggestions, DNS,
// contacts, nameservers, hosts, forwarding and transfers on v1, and the
// quote-then-execute purchase flow on v3. Callers pass full paths
// (`/v1/...`, `/v2/...`, `/v3/...`) so newer versions can replace older
// endpoints without touching call sites.

const GODADDY_BASE = Deno.env.get("GODADDY_API_BASE") || "https://api.godaddy.com";
const GODADDY_OTE_BASE = "https://api.ote-godaddy.com";

export class GoDaddyError extends Error {
  status: number;
  code: string;
  constructor(message: string, status: number, code = "GODADDY_ERROR") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const cleanSecret = (value: string | undefined): string | null => {
  const cleaned = value?.trim().replace(/^['"]|['"]$/g, "");
  return cleaned ? cleaned : null;
};

export interface AuthCandidate {
  header: string;
  /** Safe label for diagnostics — never contains the secret itself. */
  label: string;
}

/**
 * Builds Authorization header candidates.
 * GoDaddy docs recommend Personal Access Tokens as Bearer tokens. We try the
 * PAT first, then fall back to the classic key/secret pair for v1 APIs.
 */
export function authCandidates(): AuthCandidate[] {
  const out: AuthCandidate[] = [];
  const token = cleanSecret(Deno.env.get("GODADDY_PAT"));
  if (token) {
    const normalized = token.replace(/^authorization:\s*/i, "").trim();
    const lower = normalized.toLowerCase();
    if (lower.startsWith("bearer ")) {
      out.push({ header: normalized, label: "GODADDY_PAT (pre-formatted Bearer)" });
    } else if (lower.startsWith("sso-key ")) {
      out.push({ header: normalized, label: "GODADDY_PAT (pre-formatted sso-key)" });
    } else if (normalized.includes(":")) {
      out.push({ header: `sso-key ${normalized}`, label: "GODADDY_PAT (key:secret -> sso-key)" });
    } else {
      out.push({ header: `Bearer ${normalized}`, label: "GODADDY_PAT (Bearer)" });
    }
  }

  const key = cleanSecret(Deno.env.get("GODADDY_API_KEY"));
  const secret = cleanSecret(Deno.env.get("GODADDY_API_SECRET"));
  if (key && secret) {
    out.push({ header: `sso-key ${key}:${secret}`, label: "GODADDY_API_KEY/SECRET (sso-key)" });
  }

  const seen = new Set<string>();
  return out.filter((c) => (seen.has(c.header) ? false : (seen.add(c.header), true)));
}

function authHeaders(): string[] {
  const candidates = authCandidates();
  if (candidates.length) return candidates.map((c) => c.header);
  throw new GoDaddyError(
    "Domain service is not configured yet. Please add a GoDaddy Personal Access Token.",
    503,
    "NOT_CONFIGURED",
  );
}

/** Converts a GoDaddy error body into a safe, human readable message. */
function humanize(status: number, body: unknown): string {
  const raw = typeof body === "object" && body !== null
    ? String((body as Record<string, unknown>).message ?? "")
    : "";

  switch (status) {
    case 400:
      return raw || "The information provided is not valid. Please review and try again.";
    case 401:
      return "The GoDaddy access token is invalid or expired. Please update it.";
    case 403:
      return raw || "This GoDaddy token does not have permission for this action.";
    case 404:
      return "That domain or record could not be found in your GoDaddy account.";
    case 409:
      return raw || "This change conflicts with the current domain state.";
    case 422:
      return raw || "The request could not be processed with the values provided.";
    case 429:
      return "Too many requests to GoDaddy. Please wait a moment and retry.";
    default:
      if (status >= 500) return "GoDaddy is temporarily unavailable. Please retry shortly.";
      return raw || "The domain request could not be completed.";
  }
}

export interface GoDaddyRequest {
  path: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  shopperId?: string;
  /** Optional override, used only by diagnostics. */
  baseUrl?: string;
}

/** Endpoints whose response contains prices we quote to customers. */
const PRICED_PATHS = [
  "/v1/domains/available",
  "/v1/domains/suggest",
  "/v1/domains/purchase",
  "/v1/domains/renew",
  "/v3/domains/purchase",
];

export async function godaddy<T = unknown>(req: GoDaddyRequest): Promise<T> {
  const url = new URL(req.path, req.baseUrl || GODADDY_BASE);
  if (req.query) {
    for (const [k, v] of Object.entries(req.query)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
  }

  // Ask GoDaddy for prices in the storefront's own market AND currency so the
  // figures we show are the registrar's real local retail prices (what the
  // customer would pay on godaddy.com/en-in), not a USD price converted through
  // an exchange rate. Without `currencyType` GoDaddy answers in USD.
  const marketId = cleanSecret(Deno.env.get("GODADDY_MARKET_ID")) || "en-IN";
  const currency = (cleanSecret(Deno.env.get("GODADDY_CURRENCY")) || "INR").toUpperCase();
  if (PRICED_PATHS.some((p) => url.pathname.startsWith(p))) {
    if (!url.searchParams.has("currencyType")) url.searchParams.set("currencyType", currency);
    if (!url.searchParams.has("marketId")) url.searchParams.set("marketId", marketId);
  }

  const candidates = authHeaders();
  const headers: Record<string, string> = { Accept: "application/json", "X-Market-Id": marketId };
  if (req.body !== undefined) headers["Content-Type"] = "application/json";
  if (req.shopperId) headers["X-Shopper-Id"] = req.shopperId;


  let lastUnauthorizedBody: unknown = null;

  for (let i = 0; i < candidates.length; i += 1) {
    let res: Response;
    try {
      res = await fetch(url.toString(), {
        method: req.method ?? "GET",
        headers: { ...headers, Authorization: candidates[i] },
        body: req.body !== undefined ? JSON.stringify(req.body) : undefined,
      });
    } catch (_e) {
      // Never log headers / token.
      throw new GoDaddyError("Could not reach GoDaddy. Check your connection and retry.", 502, "NETWORK");
    }

    const text = await res.text();
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }
    }

    if (res.status === 401 && i < candidates.length - 1) {
      lastUnauthorizedBody = parsed;
      continue;
    }

    if (!res.ok) {
      // Transient rate limit: wait briefly and retry the same request instead of
      // surfacing "Too many requests" to the visitor on a momentary burst.
      const idempotent = (req.method ?? "GET") === "GET";
      if (res.status === 429 && idempotent) {
        const retryAfter = Number(res.headers.get("retry-after"));
        const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 5) * 1000 : 1500;
        let retried = false;
        for (let attempt = 0; attempt < 2 && !retried; attempt += 1) {
          await new Promise((r) => setTimeout(r, waitMs * (attempt + 1)));
          try {
            const retryRes = await fetch(url.toString(), {
              method: req.method ?? "GET",
              headers: { ...headers, Authorization: candidates[i] },
              body: req.body !== undefined ? JSON.stringify(req.body) : undefined,
            });
            if (retryRes.ok) {
              const retryText = await retryRes.text();
              return (retryText ? JSON.parse(retryText) : null) as T;
            }
            if (retryRes.status !== 429) {
              const retryText = await retryRes.text();
              let retryParsed: unknown = null;
              try {
                retryParsed = retryText ? JSON.parse(retryText) : null;
              } catch {
                retryParsed = null;
              }
              console.error(`GoDaddy ${req.method ?? "GET"} ${url.pathname} -> ${retryRes.status}`);
              throw new GoDaddyError(humanize(retryRes.status, retryParsed), retryRes.status, `HTTP_${retryRes.status}`);
            }
          } catch (e) {
            if (e instanceof GoDaddyError) throw e;
            throw new GoDaddyError("Could not reach GoDaddy. Check your connection and retry.", 502, "NETWORK");
          }
        }
      }
      console.error(`GoDaddy ${req.method ?? "GET"} ${url.pathname} -> ${res.status} ${text.slice(0, 200)}`);
      throw new GoDaddyError(humanize(res.status, parsed ?? lastUnauthorizedBody), res.status, `HTTP_${res.status}`);
    }

    return (parsed ?? ({} as T)) as T;
  }

  throw new GoDaddyError(humanize(401, lastUnauthorizedBody), 401, "HTTP_401");
}

// ---------------- diagnostics (admin only, never leaks the secret) ----------------

export interface DiagnosticAttempt {
  credential: string;
  environment: "production" | "ote";
  base_url: string;
  http_status: number | null;
  ok: boolean;
  message: string;
}

export interface GoDaddyDiagnostics {
  configured: boolean;
  credentials_present: string[];
  attempts: DiagnosticAttempt[];
  working: { credential: string; environment: string } | null;
  likely_cause: string;
  next_step: string;
}

export async function runDiagnostics(): Promise<GoDaddyDiagnostics> {
  const candidates = authCandidates();
  const present: string[] = [];
  if (Deno.env.get("GODADDY_PAT")) present.push("GODADDY_PAT");
  if (Deno.env.get("GODADDY_API_KEY")) present.push("GODADDY_API_KEY");
  if (Deno.env.get("GODADDY_API_SECRET")) present.push("GODADDY_API_SECRET");

  if (!candidates.length) {
    return {
      configured: false,
      credentials_present: present,
      attempts: [],
      working: null,
      likely_cause: "No usable GoDaddy credential is configured.",
      next_step: "Add GODADDY_PAT (or GODADDY_API_KEY + GODADDY_API_SECRET) in Supabase secrets.",
    };
  }

  const envs: Array<{ environment: "production" | "ote"; base: string }> = [
    { environment: "production", base: GODADDY_BASE },
    { environment: "ote", base: GODADDY_OTE_BASE },
  ];

  const attempts: DiagnosticAttempt[] = [];
  let working: GoDaddyDiagnostics["working"] = null;

  for (const env of envs) {
    for (const cand of candidates) {
      const url = new URL("/v1/domains/available?domain=example-availability-probe-9x7.com", env.base);
      let status: number | null = null;
      let message = "";
      try {
        const res = await fetch(url.toString(), {
          headers: { Accept: "application/json", Authorization: cand.header },
        });
        status = res.status;
        const text = (await res.text()).slice(0, 300);
        let parsed: unknown = null;
        try {
          parsed = JSON.parse(text);
        } catch { /* ignore */ }
        message = res.ok ? "Authenticated successfully." : humanize(res.status, parsed);
        if (res.ok && !working) working = { credential: cand.label, environment: env.environment };
      } catch {
        message = "Network error reaching GoDaddy.";
      }
      attempts.push({
        credential: cand.label,
        environment: env.environment,
        base_url: env.base,
        http_status: status,
        ok: status === 200,
        message,
      });
    }
  }

  let likely_cause: string;
  let next_step: string;

  if (working) {
    if (working.environment === "ote") {
      likely_cause = "The credential only works against GoDaddy's OTE (test) environment.";
      next_step = "Create a production key/PAT at developer.godaddy.com, or set GODADDY_API_BASE to https://api.ote-godaddy.com for test mode.";
    } else {
      likely_cause = "Credentials are valid against GoDaddy production.";
      next_step = "No action needed.";
    }
  } else if (attempts.some((a) => a.http_status === 403)) {
    likely_cause = "GoDaddy accepted the credential but denied the scope/permission.";
    next_step = "Re-issue the PAT with domains.domain:read/create/update/delete, domains.dns:update, domains.contact:update, domains.forward:update, domains.host:update, domains.nameserver:update and domains.transfer:execute/update.";
  } else if (attempts.every((a) => a.http_status === 401)) {
    likely_cause = "GoDaddy rejected every credential with 401. Production API keys are only issued to accounts with 20+ domains or an approved reseller agreement; a key created for a non-eligible account returns 401 on production.";
    next_step = "Check the key at developer.godaddy.com > Keys: confirm it is a Production key (not OTE), re-copy the key and secret with no extra spaces, and confirm the account meets GoDaddy's production eligibility rules.";
  } else {
    likely_cause = "GoDaddy could not be reached or returned an unexpected status.";
    next_step = "Retry shortly; if it persists, check GoDaddy's API status page.";
  }

  return { configured: true, credentials_present: present, attempts, working, likely_cause, next_step };
}
