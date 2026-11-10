// Reads secrets saved on the Owner Portal Secrets page (public.owner_secrets).
// Uses the service role key, so it only works inside edge functions — never
// expose the returned values to the browser.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cache = new Map<string, { value: string | null; at: number }>();
const TTL_MS = 60_000;

export async function getOwnerSecret(name: string): Promise<string | null> {
  const hit = cache.get(name);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/owner_secrets?name=eq.${encodeURIComponent(name)}&select=value`,
      {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
      },
    );
    if (!res.ok) {
      cache.set(name, { value: null, at: Date.now() });
      return null;
    }
    const rows = (await res.json()) as Array<{ value: string | null }>;
    const value = rows?.[0]?.value?.trim() || null;
    cache.set(name, { value, at: Date.now() });
    return value;
  } catch {
    return null;
  }
}

export async function getOwnerSecretJson(name: string): Promise<Record<string, unknown> | null> {
  const raw = await getOwnerSecret(name);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * The single Google OAuth client for every Google connect (Gmail, YouTube,
 * AdSense, Search Console, Analytics, Drive). The Owner Secrets page values
 * win; edge env vars are only a fallback.
 */
export async function getSharedGoogleClient(): Promise<{ clientId: string; clientSecret: string } | null> {
  const [id, secret] = await Promise.all([
    getOwnerSecret("GOOGLE_OAUTH_CLIENT_ID"),
    getOwnerSecret("GOOGLE_OAUTH_CLIENT_SECRET"),
  ]);
  if (id && secret) return { clientId: id, clientSecret: secret };
  const envId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID") || Deno.env.get("GOOGLE_CLIENT_ID") || "";
  const envSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET") || Deno.env.get("GOOGLE_CLIENT_SECRET") || "";
  return envId && envSecret ? { clientId: envId, clientSecret: envSecret } : null;
}
