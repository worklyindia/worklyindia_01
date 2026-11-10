// Shared MIME composer used by every outgoing mail path (Gmail API + SMTP).
// Supports multiple recipients, cc/bcc, HTML + plain text alternative and
// real file attachments (PDF / image / any URL). Server-only.

export interface MailAttachmentInput {
  url?: string;
  name?: string;
  /** Raw bytes (when already downloaded). */
  bytes?: Uint8Array;
  mimeType?: string;
}

export interface ComposeInput {
  from: string;
  fromName?: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: MailAttachmentInput[];
  inReplyTo?: string;
  references?: string;
}

const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

/** Splits "a@x.com, b@y.com; c@z.com" into a clean, deduped address list. */
export function parseRecipients(value: unknown): string[] {
  if (!value) return [];
  const raw = Array.isArray(value) ? value.join(",") : String(value);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[,;\n]+/)) {
    const addr = part.trim().replace(/^<|>$/g, "");
    if (!addr) continue;
    const email = addr.match(/[^\s<>]+@[^\s<>]+\.[^\s<>]+/)?.[0];
    if (!email) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(email);
  }
  return out;
}

export function encodeHeaderWord(value: string): string {
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  const bytes = new TextEncoder().encode(value);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return `=?UTF-8?B?${btoa(bin)}?=`;
}

function base64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function wrap76(b64: string): string {
  return b64.replace(/.{1,76}/g, "$&\r\n").trimEnd();
}

function guessMime(name: string): string {
  const ext = name.toLowerCase().split(".").pop() || "";
  const map: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    txt: "text/plain",
    csv: "text/csv",
    html: "text/html",
    json: "application/json",
    zip: "application/zip",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    mp3: "audio/mpeg",
    mp4: "video/mp4",
  };
  return map[ext] || "application/octet-stream";
}

function filenameFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname;
    const last = decodeURIComponent(path.split("/").filter(Boolean).pop() || "");
    if (last) return last;
  } catch { /* ignore */ }
  return "attachment";
}

/** Downloads attachment URLs into bytes. Failed downloads are skipped. */
export async function resolveAttachments(
  items: MailAttachmentInput[] = [],
): Promise<{ ok: Required<Pick<MailAttachmentInput, "name" | "bytes" | "mimeType">>[]; failed: string[] }> {
  const ok: any[] = [];
  const failed: string[] = [];
  for (const item of items.slice(0, 5)) {
    try {
      if (item.bytes) {
        const name = item.name || "attachment";
        ok.push({ name, bytes: item.bytes, mimeType: item.mimeType || guessMime(name) });
        continue;
      }
      if (!item.url) continue;
      const res = await fetch(item.url, { redirect: "follow" });
      if (!res.ok) {
        failed.push(item.name || item.url);
        continue;
      }
      const buf = new Uint8Array(await res.arrayBuffer());
      if (!buf.length || buf.length > MAX_ATTACHMENT_BYTES) {
        failed.push(item.name || item.url);
        continue;
      }
      let name = item.name || filenameFromUrl(item.url);
      const headerType = (res.headers.get("content-type") || "").split(";")[0].trim();
      if (!/\.[a-z0-9]{2,5}$/i.test(name)) {
        const extFromType = Object.entries({
          "application/pdf": "pdf",
          "image/png": "png",
          "image/jpeg": "jpg",
          "image/webp": "webp",
          "image/gif": "gif",
          "text/csv": "csv",
          "text/html": "html",
          "text/plain": "txt",
        }).find(([t]) => t === headerType)?.[1];
        if (extFromType) name += "." + extFromType;
      }
      ok.push({ name, bytes: buf, mimeType: headerType || guessMime(name) });
    } catch {
      failed.push(item.name || item.url || "attachment");
    }
  }
  return { ok, failed };
}

export function htmlToText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|h[1-6]|li|tr)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Builds a complete RFC-2822 message (headers + body) ready for Gmail/SMTP. */
export function buildMimeMessage(
  input: ComposeInput,
  attachments: { name: string; bytes: Uint8Array; mimeType: string }[] = [],
): string {
  const boundaryMixed = `mix_${crypto.randomUUID().replace(/-/g, "")}`;
  const boundaryAlt = `alt_${crypto.randomUUID().replace(/-/g, "")}`;

  const text = input.text?.trim() || (input.html ? htmlToText(input.html) : "");
  const html = input.html?.trim() || "";

  const headers: string[] = [
    input.fromName
      ? `From: ${encodeHeaderWord(input.fromName)} <${input.from}>`
      : `From: ${input.from}`,
    `To: ${input.to.join(", ")}`,
  ];
  if (input.cc?.length) headers.push(`Cc: ${input.cc.join(", ")}`);
  if (input.bcc?.length) headers.push(`Bcc: ${input.bcc.join(", ")}`);
  headers.push(`Subject: ${encodeHeaderWord(input.subject || "(no subject)")}`);
  if (input.inReplyTo) headers.push(`In-Reply-To: ${input.inReplyTo}`);
  if (input.references) headers.push(`References: ${input.references}`);
  headers.push("MIME-Version: 1.0");

  const bodyPart = (): string => {
    if (html && text) {
      return [
        `Content-Type: multipart/alternative; boundary="${boundaryAlt}"`,
        "",
        `--${boundaryAlt}`,
        'Content-Type: text/plain; charset="UTF-8"',
        "Content-Transfer-Encoding: base64",
        "",
        wrap76(base64(new TextEncoder().encode(text))),
        `--${boundaryAlt}`,
        'Content-Type: text/html; charset="UTF-8"',
        "Content-Transfer-Encoding: base64",
        "",
        wrap76(base64(new TextEncoder().encode(html))),
        `--${boundaryAlt}--`,
      ].join("\r\n");
    }
    if (html) {
      return [
        'Content-Type: text/html; charset="UTF-8"',
        "Content-Transfer-Encoding: base64",
        "",
        wrap76(base64(new TextEncoder().encode(html))),
      ].join("\r\n");
    }
    return [
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      wrap76(base64(new TextEncoder().encode(text || " "))),
    ].join("\r\n");
  };

  if (!attachments.length) {
    return `${headers.join("\r\n")}\r\n${bodyPart()}\r\n`;
  }

  const parts: string[] = [
    ...headers,
    `Content-Type: multipart/mixed; boundary="${boundaryMixed}"`,
    "",
    `--${boundaryMixed}`,
    bodyPart(),
  ];
  for (const att of attachments) {
    parts.push(
      `--${boundaryMixed}`,
      `Content-Type: ${att.mimeType}; name="${att.name.replace(/"/g, "")}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${att.name.replace(/"/g, "")}"`,
      "",
      wrap76(base64(att.bytes)),
    );
  }
  parts.push(`--${boundaryMixed}--`, "");
  return parts.join("\r\n");
}
