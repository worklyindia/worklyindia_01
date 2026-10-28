/**
 * Shared helpers for per-app-user Google OAuth connections.
 * Server-only: reads GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET /
 * GOOGLE_TOKEN_ENC_KEY from the edge function environment.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getOwnerSecret, getOwnerSecretJson } from "./ownerSecrets.ts";

export const GOOGLE_PRODUCTS = [
  "adsense",
  "search_console",
  "analytics",
  "drive",
  "business_profile",
] as const;

export type GoogleProduct = (typeof GOOGLE_PRODUCTS)[number];

const BASE_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

export const PRODUCT_SCOPES: Record<GoogleProduct, string[]> = {
  adsense: ["https://www.googleapis.com/auth/adsense.readonly"],
  search_console: ["https://www.googleapis.com/auth/webmasters"],
  analytics: [
    // Data API (reporting) + Admin API (accounts, properties, data streams)
    "https://www.googleapis.com/auth/analytics.readonly",
    "https://www.googleapis.com/auth/analytics.edit",
  ],
  drive: [
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/drive.file",
  ],
  business_profile: ["https://www.googleapis.com/auth/business.manage"],
};

/** Hosts each product is allowed to call through the server-side proxy. */
export const PRODUCT_API_HOSTS: Record<GoogleProduct, string[]> = {
  adsense: ["adsense.googleapis.com"],
  search_console: ["searchconsole.googleapis.com", "www.googleapis.com"],
  analytics: [
    "analyticsdata.googleapis.com",
    "analyticsadmin.googleapis.com",
  ],
  drive: ["www.googleapis.com"],
  business_profile: [
    "mybusinessaccountmanagement.googleapis.com",
    "mybusinessbusinessinformation.googleapis.com",
    "mybusiness.googleapis.com",
  ],
};

export function isGoogleProduct(value: unknown): value is GoogleProduct {
  return typeof value === "string" &&
    (GOOGLE_PRODUCTS as readonly string[]).includes(value);
}

export function scopesFor(product: GoogleProduct): string[] {
  return [...BASE_SCOPES, ...PRODUCT_SCOPES[product]];
}

/** Owner Secrets page cards holding the OAuth 2.0 Client ID + Secret per product. */
export const PRODUCT_OAUTH_SECRET: Record<GoogleProduct, { id: string; secret: string }> = {
  adsense: {
    id: "GOOGLE_ADSENSE_OAUTH_CLIENT_ID",
    secret: "GOOGLE_ADSENSE_OAUTH_CLIENT_SECRET",
  },
  search_console: {
    id: "GOOGLE_SEARCH_CONSOLE_OAUTH_CLIENT_ID",
    secret: "GOOGLE_SEARCH_CONSOLE_OAUTH_CLIENT_SECRET",
  },
  analytics: {
    id: "GOOGLE_ANALYTICS_OAUTH_CLIENT_ID",
    secret: "GOOGLE_ANALYTICS_OAUTH_CLIENT_SECRET",
  },
  drive: {
    id: "GOOGLE_DRIVE_OAUTH_CLIENT_ID",
    secret: "GOOGLE_DRIVE_OAUTH_CLIENT_SECRET",
  },
  business_profile: {
    id: "GOOGLE_BUSINESS_PROFILE_OAUTH_CLIENT_ID",
    secret: "GOOGLE_BUSINESS_PROFILE_OAUTH_CLIENT_SECRET",
  },
};

/** Legacy single-JSON card names (kept so previously saved JSONs keep working). */
const PRODUCT_OAUTH_SECRET_JSON: Record<GoogleProduct, string> = {
  adsense: "GOOGLE_ADSENSE_OAUTH_CLIENT_JSON",
  search_console: "GOOGLE_SEARCH_CONSOLE_OAUTH_CLIENT_JSON",
  analytics: "GOOGLE_ANALYTICS_OAUTH_CLIENT_JSON",
  drive: "GOOGLE_DRIVE_OAUTH_CLIENT_JSON",
  business_profile: "GOOGLE_BUSINESS_PROFILE_OAUTH_CLIENT_JSON",
};

function clientFromJson(json: Record<string, unknown>) {
  const raw = (json.web ?? json.installed ?? json) as Record<string, unknown>;
  const clientId = typeof raw.client_id === "string" ? raw.client_id : null;
  const clientSecret = typeof raw.client_secret === "string" ? raw.client_secret : null;
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export async function requireOAuthClient(product?: GoogleProduct) {
  if (product) {
    const names = PRODUCT_OAUTH_SECRET[product];
    const [savedId, savedSecret] = await Promise.all([
      getOwnerSecret(names.id),
      getOwnerSecret(names.secret),
    ]);
    if (savedId && savedSecret) {
      return { clientId: savedId, clientSecret: savedSecret };
    }
    // Legacy: single JSON card saved earlier.
    const savedJson = await getOwnerSecretJson(PRODUCT_OAUTH_SECRET_JSON[product]);
    const fromJson = savedJson ? clientFromJson(savedJson) : null;
    if (fromJson) return fromJson;
  }
  // Shared Secrets-page pair: one Client ID/Secret for every Google product.
  const [sharedId, sharedSecret] = await Promise.all([
    getOwnerSecret("GOOGLE_OAUTH_CLIENT_ID"),
    getOwnerSecret("GOOGLE_OAUTH_CLIENT_SECRET"),
  ]);
  if (sharedId && sharedSecret) {
    return { clientId: sharedId, clientSecret: sharedSecret };
  }
  const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID") || Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET") || Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error(
      "Google OAuth is not configured yet. Save GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET on the Secrets page.",
    );
  }
  return { clientId, clientSecret };
}

/** True when the shared env client or any per-product saved client exists. */
export async function isOAuthConfigured(): Promise<boolean> {
  if (Deno.env.get("GOOGLE_OAUTH_CLIENT_ID") && Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")) {
    return true;
  }
  const [sharedId, sharedSecret] = await Promise.all([
    getOwnerSecret("GOOGLE_OAUTH_CLIENT_ID"),
    getOwnerSecret("GOOGLE_OAUTH_CLIENT_SECRET"),
  ]);
  if (sharedId && sharedSecret) return true;
  for (const product of GOOGLE_PRODUCTS) {
    const names = PRODUCT_OAUTH_SECRET[product];
    const [savedId, savedSecret] = await Promise.all([
      getOwnerSecret(names.id),
      getOwnerSecret(names.secret),
    ]);
    if (savedId && savedSecret) return true;
    const savedJson = await getOwnerSecretJson(PRODUCT_OAUTH_SECRET_JSON[product]);
    if (savedJson && clientFromJson(savedJson)) return true;
  }
  return false;
}

export function callbackUrl(): string {
  const base = Deno.env.get("SUPABASE_URL");
  if (!base) throw new Error("SUPABASE_URL is not set");
  // Served by the already-deployed unified-google-api (project is at its function cap).
  return `${base}/functions/v1/unified-google-api`;
}

export function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

// ==================== token encryption ====================

async function encryptionKey(): Promise<CryptoKey> {
  const raw = Deno.env.get("GOOGLE_TOKEN_ENC_KEY");
  if (!raw) throw new Error("GOOGLE_TOKEN_ENC_KEY is not set");
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(raw),
  );
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptToken(plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      await encryptionKey(),
      new TextEncoder().encode(plaintext),
    ),
  );
  const buf = new Uint8Array(iv.length + ciphertext.length);
  buf.set(iv);
  buf.set(ciphertext, iv.length);
  return btoa(String.fromCharCode(...buf));
}

export async function decryptToken(stored: string): Promise<string> {
  const buf = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: buf.subarray(0, 12) },
    await encryptionKey(),
    buf.subarray(12),
  );
  return new TextDecoder().decode(plaintext);
}

// ==================== access token handling ====================

interface ConnectionRow {
  id: string;
  product: string;
  scopes: string[];
  access_token_ciphertext: string | null;
  refresh_token_ciphertext: string | null;
  token_expires_at: string | null;
}

/**
 * Returns a valid access token for this user + product, refreshing it with the
 * stored refresh token when the current one is expired or about to expire.
 */
export async function getAccessTokenForUser(
  userId: string,
  product: GoogleProduct,
): Promise<string | null> {
  const supabase = adminClient();
  const { data, error } = await supabase
    .from("google_user_connections")
    .select(
      "id, product, scopes, access_token_ciphertext, refresh_token_ciphertext, token_expires_at",
    )
    .eq("user_id", userId)
    .eq("product", product)
    .maybeSingle();

  if (error) throw error;
  const row = data as ConnectionRow | null;
  if (!row) return null;

  const expiresAt = row.token_expires_at
    ? new Date(row.token_expires_at).getTime()
    : 0;
  if (row.access_token_ciphertext && expiresAt - Date.now() > 60_000) {
    return decryptToken(row.access_token_ciphertext);
  }

  if (!row.refresh_token_ciphertext) return null;

  const { clientId, clientSecret } = await requireOAuthClient(product);
  const refreshToken = await decryptToken(row.refresh_token_ciphertext);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const body = await res.text();
  if (!res.ok) {
    await supabase
      .from("google_user_connections")
      .update({ status: "needs_reconnect", last_error: body.slice(0, 500) })
      .eq("id", row.id);
    throw new Error(`Google token refresh failed [${res.status}]: ${body}`);
  }

  const token = JSON.parse(body) as {
    access_token: string;
    expires_in?: number;
  };
  await supabase
    .from("google_user_connections")
    .update({
      access_token_ciphertext: await encryptToken(token.access_token),
      token_expires_at: new Date(
        Date.now() + (token.expires_in ?? 3600) * 1000,
      ).toISOString(),
      status: "connected",
      last_error: null,
    })
    .eq("id", row.id);

  return token.access_token;
}
