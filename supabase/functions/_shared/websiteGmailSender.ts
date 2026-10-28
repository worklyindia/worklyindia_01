import { getSharedGoogleClient } from "./ownerSecrets.ts";
// Server-only: sends website emails through the Gmail account linked on the
// AI Connect page (connector "google_mail").
import { adminClient, decryptSecret } from "./appUserConnections.ts";

const GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

interface SendParams {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text?: string;
  senderName?: string;
}

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function utf8B64(value: string): string {
  return btoa(unescape(encodeURIComponent(value)));
}

/** RFC 2047 encoded-word for non-ASCII header values. */
function encHeader(value: string): string {
  return /^[\x20-\x7E]*$/.test(value) ? value : `=?UTF-8?B?${utf8B64(value)}?=`;
}

async function accessTokenFor(refreshToken: string): Promise<string> {
  const client = await getSharedGoogleClient();
  if (!client) {
    throw new Error("Google Client ID / Client Secret is not saved on the Secrets page");
  }
  const { clientId, clientSecret } = client;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Google token refresh failed (${res.status}): ${text.slice(0, 300)}`);
  const json = JSON.parse(text);
  if (!json.access_token) throw new Error("Google token refresh returned no access token");
  return json.access_token as string;
}

function buildMime(p: SendParams, fromEmail: string): string {
  const boundary = `=_workly_${Date.now().toString(36)}`;
  const fromName = encHeader(p.senderName || "Workly India");
  const toName = p.toName ? encHeader(p.toName) : "";
  const text = (p.text || p.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
  return [
    `From: ${fromName} <${fromEmail}>`,
    `To: ${toName ? `${toName} <${p.to}>` : p.to}`,
    `Subject: ${encHeader(p.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    utf8B64(text),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    utf8B64(p.html),
    `--${boundary}--`,
  ].join("\r\n");
}

async function sendVia(
  p: SendParams,
  row: { connection_key_ciphertext?: string | null; account_email?: string | null } | null,
): Promise<{ messageId: string; from: string } | null> {
  if (!row?.connection_key_ciphertext || !row.account_email) return null;

  const refreshToken = await decryptSecret(row.connection_key_ciphertext);
  const accessToken = await accessTokenFor(refreshToken);
  const raw = b64url(new TextEncoder().encode(buildMime(p, row.account_email)));

  const res = await fetch(GMAIL_SEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.id) {
    throw new Error(`Gmail send failed (${res.status}): ${JSON.stringify(data).slice(0, 300)}`);
  }
  return { messageId: data.id as string, from: row.account_email };
}

/** Sends through a specific user's linked Gmail account (null = not connected). */
export async function sendGmailForOwner(
  userId: string,
  p: SendParams,
  connectorId = "google_mail",
): Promise<{ messageId: string; from: string } | null> {
  const { data: row, error } = await adminClient()
    .from("app_user_connections")
    .select("connection_key_ciphertext, account_email")
    .eq("connector_id", connectorId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return await sendVia(p, row);
}

/**
 * Sends an email through the most recently linked Gmail account.
 * Returns null when no Gmail account is linked (caller can fall back),
 * throws when the send itself fails.
 */
export async function sendWebsiteEmailViaGmail(
  p: SendParams,
): Promise<{ messageId: string; from: string } | null> {
  const { data: row, error } = await adminClient()
    .from("app_user_connections")
    .select("connection_key_ciphertext, account_email")
    .eq("connector_id", "google_mail")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return await sendVia(p, row);
}
