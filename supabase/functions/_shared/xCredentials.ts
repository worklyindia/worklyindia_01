// App-level X (Twitter) credentials + OAuth 1.0a request signing.
//
// Three credential sets can be configured as secrets, each covering a
// different capability. All of them are optional — whatever exists is used as
// a fallback when the signed-in user's OAuth 2.0 token is missing or expired.
//
//   App-only Bearer  : X_BEARER_TOKEN                       -> public reads
//   OAuth 1.0a       : X_CONSUMER_KEY / X_CONSUMER_SECRET
//                      X_ACCESS_TOKEN / X_ACCESS_TOKEN_SECRET -> read + write
//   OAuth 2.0        : X_OAUTH2_ACCESS_TOKEN / X_OAUTH2_REFRESH_TOKEN
//                      (+ X_CLIENT_ID / X_CLIENT_SECRET for auto refresh)

const env = (k: string) => (Deno.env.get(k) || "").trim();

export const xAppBearer = () => env("X_BEARER_TOKEN") || null;

export const xOAuth2Fallback = () => {
  const access = env("X_OAUTH2_ACCESS_TOKEN");
  if (!access) return null;
  return { access_token: access, refresh_token: env("X_OAUTH2_REFRESH_TOKEN") || null };
};

export interface XOAuth1Creds {
  consumerKey: string;
  consumerSecret: string;
  token: string;
  tokenSecret: string;
}

export function xOAuth1Creds(): XOAuth1Creds | null {
  const consumerKey = env("X_CONSUMER_KEY") || env("X_API_KEY");
  const consumerSecret = env("X_CONSUMER_SECRET") || env("X_API_SECRET");
  const token = env("X_ACCESS_TOKEN");
  const tokenSecret = env("X_ACCESS_TOKEN_SECRET");
  if (!consumerKey || !consumerSecret || !token || !tokenSecret) return null;
  return { consumerKey, consumerSecret, token, tokenSecret };
}

const enc = (s: string) =>
  encodeURIComponent(s).replace(/[!*'()]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());

async function hmacSha1(key: string, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

/**
 * Builds the `Authorization: OAuth ...` header for a request.
 * JSON bodies are not part of the signature base string (X API v2 style).
 */
export async function xOAuth1Header(
  method: string,
  url: string,
  creds: XOAuth1Creds,
): Promise<string> {
  const u = new URL(url);
  const oauth: Record<string, string> = {
    oauth_consumer_key: creds.consumerKey,
    oauth_nonce: crypto.randomUUID().replace(/-/g, ""),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: creds.token,
    oauth_version: "1.0",
  };

  const params: Record<string, string> = { ...oauth };
  u.searchParams.forEach((v, k) => { params[k] = v; });

  const paramString = Object.keys(params)
    .sort()
    .map((k) => `${enc(k)}=${enc(params[k])}`)
    .join("&");
  const base = [method.toUpperCase(), enc(`${u.origin}${u.pathname}`), enc(paramString)].join("&");
  const signingKey = `${enc(creds.consumerSecret)}&${enc(creds.tokenSecret)}`;
  oauth.oauth_signature = await hmacSha1(signingKey, base);

  return "OAuth " + Object.keys(oauth)
    .sort()
    .map((k) => `${enc(k)}="${enc(oauth[k])}"`)
    .join(", ");
}

/** True when at least one app-level credential set is configured. */
export const hasXAppCredentials = () =>
  !!(xAppBearer() || xOAuth1Creds() || xOAuth2Fallback());
