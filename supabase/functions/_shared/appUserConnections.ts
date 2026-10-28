// Server-only helpers: encrypted per-user credential storage.
// Used for App User Connector connection keys (Gmail) and for each user's
// own Telegram bot token. Never import this from browser code.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

/**
 * Owner-portal mailboxes are stored separately from the AI Connect page ones:
 * the same provider gets its own row per audience, e.g.
 * "google_mail:jobseeker" / "google_mail:employer". No scope = AI Connect.
 */
export type MailScope = "jobseeker" | "employer" | "support";

const SCOPES: MailScope[] = ["jobseeker", "employer", "support"];

export function scopedConnector(base: string, scope: unknown): string {
  const s = normalizeScope(scope);
  return s ? `${base}:${s}` : base;
}

export function normalizeScope(scope: unknown): MailScope | null {
  const s = String(scope ?? "").toLowerCase() as MailScope;
  return SCOPES.includes(s) ? s : null;
}

export const adminClient = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

/**
 * AES-GCM key. Prefers the Lovable-provisioned APP_USER_CONNECTION_KEY_SECRET
 * (base64, 32 bytes). Falls back to a SHA-256 digest of the service role key
 * so encryption always works on this project.
 */
async function cryptoKey(): Promise<CryptoKey> {
  const provided = Deno.env.get("APP_USER_CONNECTION_KEY_SECRET");
  let raw: Uint8Array<ArrayBuffer>;
  if (provided) {
    try {
      raw = Uint8Array.from(atob(provided), (c) => c.charCodeAt(0));
    } catch {
      raw = new Uint8Array(
        await crypto.subtle.digest("SHA-256", new TextEncoder().encode(provided)),
      );
    }
    if (raw.length !== 32) {
      raw = new Uint8Array(await crypto.subtle.digest("SHA-256", raw));
    }
  } else {
    const seed = `lovable-app-user-connections:${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""}`;
    raw = new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(seed)),
    );
  }
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      await cryptoKey(),
      new TextEncoder().encode(plaintext),
    ),
  );
  const buf = new Uint8Array(iv.length + ct.length);
  buf.set(iv);
  buf.set(ct, iv.length);
  let s = "";
  for (const b of buf) s += String.fromCharCode(b);
  return btoa(s);
}

export async function decryptSecret(stored: string): Promise<string> {
  const buf = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: buf.subarray(0, 12) },
    await cryptoKey(),
    buf.subarray(12),
  );
  return new TextDecoder().decode(plain);
}

/* ------------------------- connector key storage ------------------------- */

export async function saveConnectionKeyForUser(
  userId: string,
  connectorId: string,
  connectionAPIKey: string,
  accountEmail?: string | null,
) {
  const { error } = await adminClient().from("app_user_connections").upsert(
    {
      user_id: userId,
      connector_id: connectorId,
      connection_key_ciphertext: await encryptSecret(connectionAPIKey),
      account_email: accountEmail ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,connector_id" },
  );
  if (error) throw error;
}

export async function getConnectionRow(userId: string, connectorId: string) {
  // Transient network/DB hiccups used to surface as "mailbox not connected".
  // Retry a couple of times and only then let the error bubble up.
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await adminClient()
      .from("app_user_connections")
      .select("connection_key_ciphertext, account_email, updated_at")
      .eq("user_id", userId)
      .eq("connector_id", connectorId)
      .maybeSingle();
    if (!error) return data;
    lastError = error;
    await new Promise((r) => setTimeout(r, 150 * (attempt + 1)));
  }
  throw lastError;
}


export async function getConnectionKeyForUser(
  userId: string,
  connectorId: string,
): Promise<string | null> {
  const row = await getConnectionRow(userId, connectorId);
  return row ? await decryptSecret(row.connection_key_ciphertext) : null;
}

export async function setConnectionEmail(
  userId: string,
  connectorId: string,
  email: string | null,
) {
  await adminClient()
    .from("app_user_connections")
    .update({ account_email: email })
    .eq("user_id", userId)
    .eq("connector_id", connectorId);
}

export async function deleteConnectionForUser(userId: string, connectorId: string) {
  await adminClient()
    .from("app_user_connections")
    .delete()
    .eq("user_id", userId)
    .eq("connector_id", connectorId);
}

/* ------------------------------- auth util ------------------------------- */

export async function requireUserId(req: Request): Promise<string> {
  const token = (req.headers.get("Authorization") || "").replace("Bearer ", "").trim();
  if (!token) throw new Error("AUTH_REQUIRED: sign in first");
  const { data, error } = await adminClient().auth.getUser(token);
  if (error || !data?.user) throw new Error("AUTH_REQUIRED: invalid session");
  return data.user.id;
}
