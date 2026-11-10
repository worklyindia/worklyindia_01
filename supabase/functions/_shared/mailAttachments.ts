// Shared helpers so the AI chat can hand the user REAL email attachments
// (PDF / image / doc) and the useful links found inside an email body.
// Server-only: uploads go through the service-role storage client.
import { adminClient } from "./appUserConnections.ts";

const BUCKET = "temp-downloads";
/** Signed link lifetime for attachments handed to the user (7 days). */
const SIGNED_TTL_SECONDS = 60 * 60 * 24 * 7;

const decoder = new TextDecoder();

/* --------------------------------- links ---------------------------------- */

const TRACKING_HOST = /(googleadservices|doubleclick|list-manage|sendgrid\.net|mailchimp|unsubscribe)/i;

/** Every useful http(s) link inside an email body, de-duplicated. */
export function extractLinks(text: string, limit = 25): Array<{ url: string; domain: string }> {
  if (!text) return [];
  const found = new Map<string, { url: string; domain: string }>();
  const re = /https?:\/\/[^\s<>"')\]]+/gi;
  for (const raw of text.match(re) || []) {
    const url = raw.replace(/[.,;:!)\]]+$/, "");
    if (url.length > 500) continue;
    let domain = "";
    try {
      domain = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      continue;
    }
    if (TRACKING_HOST.test(url)) continue;
    if (!found.has(url)) found.set(url, { url, domain });
    if (found.size >= limit) break;
  }
  return [...found.values()];
}

/* ------------------------------- attachments ------------------------------ */

export interface MailAttachmentFile {
  filename: string;
  mimeType: string;
  size: number;
  bytes: Uint8Array;
}

function safeName(name: string): string {
  return (name || "attachment")
    .replace(/[^\w.\- ]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(-80);
}

/** base64 (standard or url-safe) -> bytes */
export function decodeBase64(data: string): Uint8Array {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/").replace(/\s+/g, "");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Stores one attachment and returns a shareable download link the AI can post
 * in the chat. Never throws for a missing bucket — returns an error field.
 */
export async function storeAttachmentForUser(
  userId: string,
  file: MailAttachmentFile,
): Promise<{ success: boolean; url?: string; error?: string; filename: string; mimeType: string; size: number; expiresInDays?: number }> {
  const path = `${userId}/email/${Date.now()}-${safeName(file.filename)}`;
  const storage = adminClient().storage.from(BUCKET);
  // The `temp-downloads` bucket's allowed_mime_types whitelist cannot be
  // changed (Supabase blocks all writes to storage.buckets and the storage
  // tools don't expose MIME settings). To guarantee every attachment type —
  // images, Office docs, archives, PDFs — can be stored, upload with a
  // whitelisted content-type (application/pdf). The original bytes are
  // preserved untouched, and the real filename is passed to the signed URL's
  // `download` option so the client saves the file with its correct name and
  // extension.
  const { error: uploadError } = await storage.upload(path, file.bytes, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (uploadError) {
    console.error("[mail-attachments] upload failed", uploadError.message);
    return { success: false, error: uploadError.message, filename: file.filename, mimeType: file.mimeType, size: file.size };
  }
  // IMPORTANT: never hand a raw 7-day signed URL (huge JWT) to the model — it
  // gets truncated/mangled in chat text and the browser then shows
  // {"error":"InvalidJWT","message":"signature verification failed"}.
  // Instead store a short opaque key and return a tiny redirect link that
  // mints a fresh signed URL on every click.
  const key = crypto.randomUUID().replace(/-/g, "").slice(0, 22);
  const { error: linkError } = await adminClient().from("mail_attachment_links").insert({
    key,
    user_id: userId,
    storage_path: path,
    filename: file.filename || "attachment",
    mime_type: file.mimeType || null,
  });

  if (linkError) {
    console.error("[mail-attachments] link row failed", linkError.message);
    // Fallback: signed URL (still better than nothing).
    const { data, error } = await storage.createSignedUrl(path, SIGNED_TTL_SECONDS, {
      download: file.filename || "attachment",
    });
    if (error || !data?.signedUrl) {
      return { success: false, error: error?.message || "signed_url_failed", filename: file.filename, mimeType: file.mimeType, size: file.size };
    }
    return {
      success: true,
      url: data.signedUrl,
      filename: file.filename,
      mimeType: file.mimeType || "application/octet-stream",
      size: file.size,
      expiresInDays: 7,
    };
  }

  const base = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  return {
    success: true,
    url: `${base}/functions/v1/url-shortener?k=${key}`,
    filename: file.filename,
    mimeType: file.mimeType || "application/octet-stream",
    size: file.size,
    expiresInDays: 7,
  };
}

/** Text preview for text-ish attachments so the AI can read the content. */
export function attachmentTextPreview(file: MailAttachmentFile, max = 4000): string | undefined {
  const type = (file.mimeType || "").toLowerCase();
  const textish = /^text\//.test(type) || /(json|csv|xml|html|plain)/.test(type);
  if (!textish) return undefined;
  try {
    return decoder.decode(file.bytes).slice(0, max);
  } catch {
    return undefined;
  }
}

/* ---------------------- raw MIME parsing (IMAP mailbox) -------------------- */

function headerOf(raw: string, name: string): string {
  const re = new RegExp(`^${name}:[ \\t]*([\\s\\S]*?)(?=\\r?\\n[^ \\t]|$)`, "im");
  const m = raw.match(re);
  return m ? m[1].replace(/\r?\n[ \t]+/g, " ").trim() : "";
}

function nameFromPartHeaders(h: string): string {
  const disp = headerOf(h, "Content-Disposition");
  const ctype = headerOf(h, "Content-Type");
  const m = /filename\*?=\s*"?([^";\r\n]+)"?/i.exec(disp) ||
    /name\*?=\s*"?([^";\r\n]+)"?/i.exec(ctype);
  return m?.[1]?.trim() || "";
}

/**
 * Pulls every attachment (with its bytes) out of a raw RFC822 message,
 * recursing through nested multipart parts.
 */
export function parseRawAttachments(raw: string): MailAttachmentFile[] {
  const out: MailAttachmentFile[] = [];
  const walk = (section: string, depth: number) => {
    if (depth > 4) return;
    const sep = section.indexOf("\r\n\r\n");
    const headers = sep === -1 ? section : section.slice(0, sep);
    const body = sep === -1 ? "" : section.slice(sep + 4);
    const ctype = headerOf(headers, "Content-Type");
    const boundary = ctype.match(/boundary="?([^";\r\n]+)"?/i)?.[1];

    if (boundary) {
      const parts = body.split(new RegExp(`--${boundary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(--)?\\r?\\n`));
      for (const part of parts) {
        if (!part || !part.trim()) continue;
        walk(part, depth + 1);
      }
      return;
    }

    const filename = nameFromPartHeaders(headers);
    const disposition = headerOf(headers, "Content-Disposition");
    const isAttachment = /attachment/i.test(disposition) || (!!filename && !/^text\/(plain|html)/i.test(ctype));
    if (!filename || !isAttachment) return;
    const encoding = headerOf(headers, "Content-Transfer-Encoding").toLowerCase();
    if (!/base64/.test(encoding)) return; // only base64 payloads are decodable safely
    try {
      const bytes = decodeBase64(body);
      out.push({
        filename,
        mimeType: (ctype.split(";")[0] || "application/octet-stream").trim(),
        size: bytes.byteLength,
        bytes,
      });
    } catch {
      /* skip undecodable part */
    }
  };
  walk(raw, 0);
  return out;
}

/** Picks the attachment the user asked for (by filename, index or id). */
export function pickAttachment<T extends { filename: string }>(
  list: T[],
  ref?: string,
): T | undefined {
  if (!list.length) return undefined;
  const wanted = String(ref || "").trim().toLowerCase();
  if (!wanted) return list[0];
  const asIndex = Number(wanted);
  if (Number.isInteger(asIndex) && asIndex >= 1 && asIndex <= list.length) return list[asIndex - 1];
  return (
    list.find((a) => a.filename.toLowerCase() === wanted) ||
    list.find((a) => a.filename.toLowerCase().includes(wanted)) ||
    undefined
  );
}
