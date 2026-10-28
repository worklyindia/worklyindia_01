// Cloudflare Turnstile for job seeker / employer login.
// Keys come from the Owner Portal Secrets page (TURNSTILE_SITE_KEY / TURNSTILE_SECRET_KEY).
// Turnstile is active only when BOTH keys are saved.
import { getOwnerSecret } from "./ownerSecrets.ts";

// Public site key of the existing Workly India widget (safe to ship). Owner Secrets value overrides it.
const DEFAULT_SITE_KEY = "0x4AAAAAAFYmcLgHZT66qq76";
const siteKeyOf = async () => (await getOwnerSecret("TURNSTILE_SITE_KEY")) || DEFAULT_SITE_KEY;

export async function getTurnstileConfig(): Promise<{ enabled: boolean; siteKey: string | null }> {
  const [siteKey, secret] = await Promise.all([
    siteKeyOf(),
    getOwnerSecret("TURNSTILE_SECRET_KEY"),
  ]);
  return { enabled: !!(siteKey && secret), siteKey: siteKey && secret ? siteKey : null };
}

export async function verifyTurnstileToken(token: unknown, ip?: string | null): Promise<{ ok: boolean; error?: string }> {
  const secret = await getOwnerSecret("TURNSTILE_SECRET_KEY");
  const siteKey = await siteKeyOf();
  if (!secret || !siteKey) return { ok: true }; // not configured → not enforced
  if (typeof token !== "string" || !token || token.length > 4096) return { ok: false, error: "missing_token" };
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    if (data?.success === true) return { ok: true };
    return { ok: false, error: (data?.["error-codes"] || []).join(",") || "verification_failed" };
  } catch {
    return { ok: false, error: "verification_unavailable" };
  }
}
