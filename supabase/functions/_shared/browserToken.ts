// Shared helpers for browser-token-based Quick Login.

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TOKEN_BYTES = 32;

export function generateRawToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  // URL-safe base64
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function hashToken(raw: string): Promise<string> {
  const data = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function getClientIp(req: Request): string | null {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null
  );
}

export function isAuthUserAllowed(user: any): boolean {
  if (!user || user.deleted_at) return false;
  const bannedUntil = user.banned_until;
  if (!bannedUntil || bannedUntil === "none") return true;
  const t = new Date(bannedUntil).getTime();
  return Number.isNaN(t) || t <= Date.now();
}

export function getAuthAvatarUrl(user: any): string {
  const meta = user?.user_metadata || {};
  const direct =
    meta.avatar_url ||
    meta.picture ||
    meta.picture_url ||
    meta.avatar ||
    meta.profile_picture ||
    meta.profile_image_url;
  if (direct) return direct;
  for (const identity of user?.identities || []) {
    const data = identity?.identity_data || {};
    const url = data.avatar_url || data.picture || data.picture_url || data.avatar;
    if (url) return url;
  }
  return "";
}
