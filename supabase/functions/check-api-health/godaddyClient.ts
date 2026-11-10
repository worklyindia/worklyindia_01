// Reusable server-side GoDaddy Domains API helper.
// The PAT never leaves this module and is never returned to the client.

const GODADDY_BASE = Deno.env.get("GODADDY_API_BASE") || "https://api.godaddy.com";

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

/**
 * Builds Authorization header candidates.
 * GoDaddy docs recommend Personal Access Tokens as Bearer tokens. We try PAT
 * first, then fall back to the classic production key/secret pair for v1 APIs.
 */
function authHeaders(): string[] {
  const headers: string[] = [];
  const token = cleanSecret(Deno.env.get("GODADDY_PAT"));
  if (token) {
    const normalized = token.replace(/^authorization:\s*/i, "").trim();
    if (normalized.toLowerCase().startsWith("bearer ") || normalized.toLowerCase().startsWith("sso-key ")) {
      headers.push(normalized);
    } else if (normalized.includes(":")) {
      headers.push(`sso-key ${normalized}`);
    } else {
      headers.push(`Bearer ${normalized}`);
    }
  }

  const key = cleanSecret(Deno.env.get("GODADDY_API_KEY"));
  const secret = cleanSecret(Deno.env.get("GODADDY_API_SECRET"));
  if (key && secret) headers.push(`sso-key ${key}:${secret}`);

  const unique = Array.from(new Set(headers));
  if (unique.length) return unique;

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
      return "This GoDaddy token does not have permission for this action.";
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
}

export async function godaddy<T = unknown>(req: GoDaddyRequest): Promise<T> {
  const url = new URL(req.path, GODADDY_BASE);
  if (req.query) {
    for (const [k, v] of Object.entries(req.query)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
  }

  const candidates = authHeaders();
  const headers: Record<string, string> = { Accept: "application/json" };
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
      console.error(`GoDaddy ${req.method ?? "GET"} ${url.pathname} -> ${res.status}`);
      throw new GoDaddyError(humanize(res.status, parsed ?? lastUnauthorizedBody), res.status, `HTTP_${res.status}`);
    }

    return (parsed ?? ({} as T)) as T;
  }

  throw new GoDaddyError(humanize(401, lastUnauthorizedBody), 401, "HTTP_401");
}
