// Unified, server-authorized customer service mailbox access. No browser tokens.
import { adminClient, getConnectionKeyForUser, getConnectionRow, requireUserId } from "./appUserConnections.ts";
import { ImapClient, SmtpClient } from "./mailClients.ts";
import { buildMimeMessage, parseRecipients } from "./mailCompose.ts";
import { accessTokenFor as gmailToken, gmail, header, extractBody, b64urlEncode } from "./userGmail.ts";
import { accessTokenFor as outlookToken, graph, stripHtml } from "./userOutlook.ts";
import { decodeBase64, parseRawAttachments } from "./mailAttachments.ts";
import { cacheMailMedia, deleteMailMedia } from './privateMailMedia.ts';

export const SUPPORT_MAIL_ACTIONS = ["support_mail_list", "support_mail_thread", "support_mail_reply", "support_mail_send", "support_mail_attachment", "support_mail_delete"] as const;
export type SupportMailAction = typeof SUPPORT_MAIL_ACTIONS[number];
export const isSupportMailAction = (action: unknown): action is SupportMailAction =>
  SUPPORT_MAIL_ACTIONS.includes(action as SupportMailAction);

const providers = { domain: "custom_email:support", outlook: "microsoft_outlook:support", gmail: "google_mail:support" } as const;
type Provider = keyof typeof providers;
type Owner = { id: string; personal: boolean; defaults?: Partial<Record<Provider, string>> };
const personalProviders = { domain: "custom_email", outlook: "microsoft_outlook", gmail: "google_mail" } as const;
const conn = (owner: Owner, p: Provider) => owner.personal ? (owner.defaults?.[p] || personalProviders[p]) : providers[p];
const settingsTables: Record<Provider, string> = { gmail: "user_gmail_autoreply_settings", outlook: "user_outlook_autoreply_settings", domain: "user_custom_email_settings" };

/** Personal mailboxes: use each provider's AI Connect default account (multi-account aware).
 *  `account` (an email address) selects that specific connected mailbox instead of the default. */
async function withPersonalDefaults(owner: Owner, account?: unknown): Promise<Owner> {
  const db = adminClient();
  const wanted = String(account || "").trim().toLowerCase();
  const defaults: Partial<Record<Provider, string>> = {};
  let matched = false;
  await Promise.all((Object.keys(personalProviders) as Provider[]).map(async (p) => {
    const { data } = await db.from(settingsTables[p]).select("account_id, account_email, is_default").eq("user_id", owner.id);
    const rows = (data || []) as { account_id: string | null; account_email: string | null; is_default: boolean | null }[];
    if (!rows.length) return;
    const exact = wanted ? rows.find(r => String(r.account_id || "").toLowerCase() === wanted || String(r.account_email || "").toLowerCase() === wanted) : undefined;
    if (exact) matched = true;
    const pick = exact || rows.find(r => r.is_default) || rows.find(r => !r.account_id) || rows[0];
    const id = String(pick.account_id || "");
    defaults[p] = id ? `${personalProviders[p]}:acct:${id}` : personalProviders[p];
  }));
  if (wanted && !matched) throw new Error(`Account ${wanted} is not connected in AI Connect`);
  return { ...owner, defaults };
}

/** Every connected AI Connect mailbox for a user, grouped by provider. */
export async function listPersonalAccounts(userId: string) {
  const db = adminClient();
  const out: { provider: Provider; email: string | null; is_default: boolean }[] = [];
  for (const p of Object.keys(personalProviders) as Provider[]) {
    const { data } = await db.from(settingsTables[p]).select("account_id, account_email, is_default").eq("user_id", userId);
    const rows = (data || []) as { account_id: string | null; account_email: string | null; is_default: boolean | null }[];
    rows.forEach(r => out.push({
      provider: p,
      email: r.account_email || (String(r.account_id || "").includes("@") ? String(r.account_id) : null),
      is_default: rows.length === 1 || !!r.is_default,
    }));
  }
  return out;
}
const validProvider = (p: unknown): p is Provider => typeof p === "string" && p in providers;

function senderNameFromAddress(email: string): string {
  const local = email.split("@")[0] || "";
  return local.replace(/[._-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()).trim() || email;
}

async function gmailSenderName(token: string, email: string): Promise<string> {
  try {
    const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok) {
      const profile = await response.json();
      const name = text(profile?.name).trim();
      if (name && name.toLowerCase() !== "email") return name;
    }
  } catch (error) {
    console.error("[support-mail] Gmail display-name lookup failed", error);
  }
  return senderNameFromAddress(email);
}

async function authorizedOwner(req: Request): Promise<string> {
  const caller = await requireUserId(req);
  const db = adminClient();
  const { data: admin, error } = await db.from("admin_users").select("role").eq("user_id", caller).maybeSingle();
  if (error || !admin || !["owner", "admin"].includes(admin.role)) throw new Error("Not authorized for support email");
  if (admin.role === "owner") return caller;
  const { data: grant, error: grantError } = await db.from("admin_permissions").select("permissions").eq("user_id", caller).maybeSingle();
  if (grantError || grant?.permissions?.support?.view !== true) throw new Error("Support access required");
  const { data: owners, error: ownersError } = await db.from("admin_users").select("user_id").eq("role", "owner").limit(2);
  if (ownersError || owners?.length !== 1) throw new Error("Could not identify a unique support mailbox owner");
  return owners[0].user_id;
}

type Attachment = { id: string; filename: string; mimeType: string; size: number };
type Item = { id: string; provider: Provider; mailbox: string; threadId?: string; from: string; to: string; subject: string; date: string; body: string; html?: string; attachments?: Attachment[]; unread: boolean; hasAttachments: boolean };
const text = (v: unknown) => String(v || "");

function decodeText(data: string): string {
  try { return new TextDecoder().decode(decodeBase64(data)); } catch { return ""; }
}

function decodeQuotedPrintable(value: string): string {
  const collapsed = value.replace(/=\r?\n/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < collapsed.length; i++) {
    if (collapsed[i] === "=" && /^[0-9a-f]{2}$/i.test(collapsed.slice(i + 1, i + 3))) {
      bytes.push(parseInt(collapsed.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(...new TextEncoder().encode(collapsed[i]));
    }
  }
  return new TextDecoder().decode(Uint8Array.from(bytes));
}

function gmailHtml(payload: any): string {
  if (!payload) return "";
  if (payload.mimeType === "text/html" && payload.body?.data) return decodeText(payload.body.data);
  for (const part of payload.parts || []) {
    const html = gmailHtml(part);
    if (html) return html;
  }
  return "";
}

function gmailInlineParts(payload: any): Array<{ cid: string; mimeType: string; data?: string; attachmentId?: string }> {
  const found: Array<{ cid: string; mimeType: string; data?: string; attachmentId?: string }> = [];
  const walk = (part: any) => {
    if (!part) return;
    const contentId = header(part.headers || [], "Content-ID").replace(/^<|>$/g, "").trim();
    if (contentId && /^image\//i.test(part.mimeType || "")) found.push({ cid: contentId, mimeType: part.mimeType, data: part.body?.data, attachmentId: part.body?.attachmentId });
    for (const child of part.parts || []) walk(child);
  };
  walk(payload);
  return found;
}

async function gmailHtmlWithInlineImages(token: string, message: any): Promise<string> {
  let html = gmailHtml(message.payload);
  if (!html || !/cid:/i.test(html)) return html;
  for (const part of gmailInlineParts(message.payload).slice(0, 8)) {
    let data = part.data || "";
    if (!data && part.attachmentId) data = (await gmail(token, `/users/me/messages/${encodeURIComponent(message.id)}/attachments/${encodeURIComponent(part.attachmentId)}`)).data || "";
    if (!data || data.length > 3_000_000) continue;
    const standard = data.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(data.length / 4) * 4, "=");
    const safeCid = part.cid.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    html = html.replace(new RegExp(`cid:${safeCid}`, "gi"), `data:${part.mimeType};base64,${standard}`);
  }
  return html;
}

function gmailFiles(payload: any): Attachment[] {
  const files: Attachment[] = [];
  const walk = (part: any, path: string) => {
    if (!part) return;
    if (part.filename && (part.body?.attachmentId || part.body?.data)) files.push({
      id: path, filename: part.filename,
      mimeType: part.mimeType || "application/octet-stream", size: part.body?.size || 0,
    });
    for (const [index, child] of (part.parts || []).entries()) walk(child, `${path}.${index}`);
  };
  walk(payload, "root");
  return files;
}

function gmailPart(payload: any, partId: string, path = "root"): any {
  if (!payload) return null;
  if (path === partId) return payload;
  for (const [index, child] of (payload.parts || []).entries()) {
    const result = gmailPart(child, partId, `${path}.${index}`);
    if (result) return result;
  }
  return null;
}

function decodeCharset(bytes: Uint8Array, charset: string): string {
  try { return new TextDecoder(charset || "utf-8").decode(bytes); } catch { return new TextDecoder().decode(bytes); }
}

/** Walk the MIME tree (nested multipart/mixed → related → alternative) and return the first text/html part. */
function domainHtml(raw: string): string {
  const split = raw.search(/\r?\n\r?\n/);
  if (split < 0) return "";
  const headers = raw.slice(0, split).replace(/\r?\n[ \t]+/g, " ");
  const body = raw.slice(split).replace(/^\r?\n\r?\n/, "");
  const type = headers.match(/^content-type:\s*([^;\r\n]+)/im)?.[1]?.trim().toLowerCase() || "text/plain";
  if (type.startsWith("multipart/")) {
    const boundary = headers.match(/boundary\s*=\s*"?([^";\r\n]+)"?/i)?.[1];
    if (!boundary) return "";
    const parts = body.split(new RegExp(`\\r?\\n?--${boundary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:--)?[ \\t]*\\r?\\n?`));
    for (const part of parts) {
      if (!part.trim()) continue;
      const html = domainHtml(part);
      if (html) return html;
    }
    return "";
  }
  if (type !== "text/html") return "";
  const charset = headers.match(/charset\s*=\s*"?([^";\s]+)/i)?.[1] || "utf-8";
  const encoding = headers.match(/^content-transfer-encoding:\s*(\S+)/im)?.[1]?.toLowerCase() || "";
  if (encoding === "base64") {
    try { return decodeCharset(decodeBase64(body.replace(/\s+/g, "")), charset); } catch { return ""; }
  }
  if (encoding === "quoted-printable") return decodeQuotedPrintable(body);
  return body.trim();
}

function readableBody(body: string, html: string): string {
  if (html && (/^\s*(?:@media|<style|<!doctype|<html)/i.test(body) || /\{\s*(?:font-size|line-height|color):[^}]+\}/i.test(body))) {
    return stripHtml(html).replace(/\s+/g, " ").trim();
  }
  return body;
}

async function domainCredentials(owner: Owner) {
  const raw = await getConnectionKeyForUser(owner.id, conn(owner, "domain"));
  if (!raw) throw new Error("Domain Email is not connected");
  // Custom email connections store JSON credentials as the encrypted connection key.
  const credentials = JSON.parse(raw);
  return credentials;
}

async function listProvider(owner: Owner, provider: Provider, fetchLimit = 20): Promise<{ mailbox: string; items: Item[] }> {
  const row = await getConnectionRow(owner.id, conn(owner, provider));
  if (!row) return { mailbox: "", items: [] };
  let mailbox = row.account_email || "";
  if (provider === "domain") {
    const imap = new ImapClient();
    try {
      const credentials = await domainCredentials(owner);
      mailbox ||= credentials.email;
      await imap.login(credentials);
      const messages = await imap.listInbox(false, fetchLimit);
      return { mailbox, items: messages.map(m => ({ id: m.uid, provider, mailbox, from: m.from, to: m.to, subject: m.subject, date: m.date, body: m.body, unread: m.unread, hasAttachments: m.attachments.length > 0 })) };
    } finally { imap.logout(); }
  }
  const refresh = await getConnectionKeyForUser(owner.id, conn(owner, provider));
  if (!refresh) return { mailbox: "", items: [] };
  if (provider === "gmail") {
    const token = await gmailToken(refresh);
    if (!mailbox) mailbox = (await gmail(token, "/users/me/profile")).emailAddress || "";
    const list = await gmail(token, `/users/me/messages?maxResults=${fetchLimit}&q=${encodeURIComponent("in:inbox -in:chats")}`);
    const full = await Promise.all((list.messages || []).map((m: any) => gmail(token, `/users/me/messages/${encodeURIComponent(m.id)}?format=full`).catch(() => null)));
    return { mailbox, items: full.filter(Boolean).map((m: any) => ({ id: m.id, threadId: m.threadId, provider, mailbox, from: header(m.payload?.headers, "From"), to: header(m.payload?.headers, "To"), subject: header(m.payload?.headers, "Subject") || "(no subject)", date: header(m.payload?.headers, "Date"), body: extractBody(m.payload).slice(0, 12000), unread: (m.labelIds || []).includes("UNREAD"), hasAttachments: !!JSON.stringify(m.payload?.parts || []).match(/attachmentId/) })) };
  }
  const token = await outlookToken(refresh);
  if (!mailbox) {
    const profile = await graph(token, "/me?$select=mail,userPrincipalName");
    mailbox = profile.mail || profile.userPrincipalName || "";
  }
  const list = await graph(token, `/me/mailFolders/inbox/messages?$top=${fetchLimit}&$orderby=receivedDateTime%20desc&$select=id,conversationId,subject,bodyPreview,receivedDateTime,from,toRecipients,isRead,hasAttachments`);
  return { mailbox, items: (list.value || []).map((m: any) => ({ id: m.id, threadId: m.conversationId, provider, mailbox, from: m.from?.emailAddress?.address || "", to: (m.toRecipients || []).map((r: any) => r.emailAddress?.address).join(", "), subject: m.subject || "(no subject)", date: m.receivedDateTime, body: m.bodyPreview || "", unread: !m.isRead, hasAttachments: !!m.hasAttachments })) };
}

async function thread(owner: Owner, provider: Provider, id: string): Promise<Item[]> {
  let mailbox = (await getConnectionRow(owner.id, conn(owner, provider)))?.account_email || "";
  if (provider === "domain") {
    const imap = new ImapClient();
    try {
      const credentials = await domainCredentials(owner);
      mailbox ||= credentials.email;
      await imap.login(credentials);
      const m = await imap.fetchOne(id);
      if (!m) throw new Error("Message not found in support inbox");
      if (m.unread) await imap.markSeen(m.uid).catch(() => {});
      const raw = await imap.fetchRawMessage(id);
      const attachments = raw ? parseRawAttachments(raw).map((file, index) => ({ id: String(index), filename: file.filename, mimeType: file.mimeType, size: file.size })) : [];
      const html = raw ? domainHtml(raw) : "";
      return [{ id: m.uid, provider, mailbox, from: m.from, to: m.to, subject: m.subject, date: m.date, body: readableBody(m.body, html), html, attachments, unread: m.unread, hasAttachments: attachments.length > 0 }];
    } finally { imap.logout(); }
  }
  const refresh = await getConnectionKeyForUser(owner.id, conn(owner, provider));
  if (!refresh) throw new Error("Support mailbox not connected");
  if (provider === "gmail") {
    const token = await gmailToken(refresh);
    if (!mailbox) mailbox = (await gmail(token, "/users/me/profile")).emailAddress || "";
    const source = await gmail(token, `/users/me/messages/${encodeURIComponent(id)}?format=full`);
    if (!(source.labelIds || []).includes("INBOX")) throw new Error("Message not found in support inbox");
    const t = await gmail(token, `/users/me/threads/${encodeURIComponent(source.threadId)}?format=full`);
    if ((source.labelIds || []).includes("UNREAD")) await gmail(token, `/users/me/messages/${encodeURIComponent(id)}/modify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ removeLabelIds: ["UNREAD"] }) }).catch(() => {});
    return await Promise.all((t.messages || []).map(async (m: any) => ({ id: m.id, threadId: m.threadId, provider, mailbox, from: header(m.payload?.headers, "From"), to: header(m.payload?.headers, "To"), subject: header(m.payload?.headers, "Subject"), date: header(m.payload?.headers, "Date"), body: extractBody(m.payload), html: await gmailHtmlWithInlineImages(token, m), attachments: gmailFiles(m.payload), unread: (m.labelIds || []).includes("UNREAD"), hasAttachments: gmailFiles(m.payload).length > 0 })));
  }
  const token = await outlookToken(refresh);
  if (!mailbox) {
    const profile = await graph(token, "/me?$select=mail,userPrincipalName");
    mailbox = profile.mail || profile.userPrincipalName || "";
  }
  const source = await graph(token, `/me/messages/${encodeURIComponent(id)}?$select=id,conversationId,parentFolderId`);
  const inbox = await graph(token, "/me/mailFolders/inbox?$select=id");
  if (source.parentFolderId !== inbox.id) throw new Error("Message not found in support inbox");
  const query = new URLSearchParams({ "$filter": `conversationId eq '${source.conversationId.replace(/'/g, "''")}'`, "$top": "30", "$select": "id,conversationId,subject,body,receivedDateTime,from,toRecipients,isRead,hasAttachments" });
  const t = await graph(token, `/me/messages?${query}`);
  await graph(token, `/me/messages/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isRead: true }) }).catch(() => {});
  const messages = await Promise.all((t.value || []).map(async (m: any) => {
    const attachments = m.hasAttachments ? await graph(token, `/me/messages/${encodeURIComponent(m.id)}/attachments?$select=id,name,contentType,size`).then((r: any) => (r.value || []).map((f: any) => ({ id: f.id, filename: f.name, mimeType: f.contentType, size: f.size }))).catch(() => []) : [];
    return { id: m.id, threadId: m.conversationId, provider, mailbox, from: m.from?.emailAddress?.address || "", to: (m.toRecipients || []).map((r: any) => r.emailAddress?.address).join(", "), subject: m.subject, date: m.receivedDateTime, body: m.body?.contentType === "html" ? stripHtml(m.body?.content || "") : m.body?.content || "", html: m.body?.contentType === "html" ? m.body?.content || "" : "", attachments, unread: !m.isRead, hasAttachments: !!m.hasAttachments };
  }));
  return messages;
}

async function downloadAttachment(owner: Owner, provider: Provider, id: string, messageId: string, attachmentId: string, suppliedMessages?: Item[]) {
  const messages = suppliedMessages || await thread(owner, provider, id);
  const message = messages.find(m => m.id === messageId);
  const attachment = message?.attachments?.find(a => a.id === attachmentId);
  if (!message || !attachment) throw new Error("Attachment not found in this conversation");
  if (attachment.size > 8_000_000) throw new Error("Attachment is too large to download here (8 MB limit)");
  let data = "";
  if (provider === "domain") {
    const imap = new ImapClient();
    try {
      await imap.login(await domainCredentials(owner));
      const raw = await imap.fetchRawMessage(messageId);
      const file = raw ? parseRawAttachments(raw)[Number(attachmentId)] : null;
      if (!file || file.size > 8_000_000) throw new Error("Attachment unavailable or too large");
      const bytes = file.bytes;
      const chunks: string[] = [];
      for (let i = 0; i < bytes.length; i += 32768) chunks.push(String.fromCharCode(...bytes.subarray(i, i + 32768)));
      data = btoa(chunks.join(""));
    } finally { imap.logout(); }
  } else if (provider === "gmail") {
    const refresh = await getConnectionKeyForUser(owner.id, conn(owner, "gmail"));
    if (!refresh) throw new Error("Gmail support mailbox not connected");
    const token = await gmailToken(refresh);
    const source = await gmail(token, `/users/me/messages/${encodeURIComponent(messageId)}?format=full`);
    const part = gmailPart(source.payload, attachmentId);
    data = part?.body?.data || (part?.body?.attachmentId ? (await gmail(token, `/users/me/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(part.body.attachmentId)}`)).data : "");
  } else {
    const refresh = await getConnectionKeyForUser(owner.id, conn(owner, "outlook"));
    if (!refresh) throw new Error("Outlook support mailbox not connected");
    const token = await outlookToken(refresh);
    data = (await graph(token, `/me/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`)).contentBytes || "";
  }
  if (!data || decodeBase64(data).byteLength > 8_000_000) throw new Error("Attachment unavailable or too large");
  await cacheMailMedia(owner.id, conn(owner, provider), messageId, attachmentId, decodeBase64(data), attachment.mimeType);
  return { success: true, filename: attachment.filename, mimeType: attachment.mimeType, data };
}

type OutFile = { name: string; bytes: Uint8Array; mimeType: string };
function parseFiles(input: unknown): OutFile[] {
  if (!Array.isArray(input)) return [];
  if (input.length > 5) throw new Error("Attach up to 5 files");
  let total = 0;
  return input.map((f: any) => {
    const name = text(f?.name).slice(0, 200) || "file";
    const mimeType = /^[\w.+-]+\/[\w.+-]+$/.test(text(f?.mimeType)) ? text(f.mimeType) : "application/octet-stream";
    const bin = atob(text(f?.data));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    total += bytes.length;
    if (total > 15 * 1024 * 1024) throw new Error("Attachments must be under 15 MB in total");
    return { name, bytes, mimeType };
  });
}
function toB64(bytes: Uint8Array) { let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); }

async function reply(owner: Owner, provider: Provider, id: string, body: string, files: OutFile[] = []) {
  if (!body.trim() && files.length) body = " ";
  if (!body.trim() && !files.length || body.length > 20000) throw new Error("Reply must be between 1 and 20,000 characters");
  const messages = await thread(owner, provider, id);
  const selected = messages.find(m => m.id === id);
  if (!selected) throw new Error("Message not found");
  const mailbox = selected.mailbox;
  const recipient = parseRecipients(selected.from)[0];
  if (!recipient || recipient.toLowerCase() === mailbox.toLowerCase()) throw new Error("Select an incoming customer email to reply to");
  const subject = /^re:/i.test(selected.subject) ? selected.subject : `Re: ${selected.subject}`;
  for (const [index, file] of files.entries()) await cacheMailMedia(owner.id, conn(owner, provider), id, `sent-${crypto.randomUUID()}-${index}`, file.bytes, file.mimeType);
  if (provider === "domain") {
    const credentials = await domainCredentials(owner);
    const senderName = senderNameFromAddress(credentials.email);
    const imap = new ImapClient();
    let source;
    try { await imap.login(credentials); source = await imap.fetchOne(id); } finally { imap.logout(); }
    if (!source) throw new Error("Message not found");
    const smtp = new SmtpClient();
    try {
      await smtp.login(credentials);
      await smtp.sendRaw({ from: credentials.email, rcpts: [recipient], data: buildMimeMessage({ from: credentials.email, fromName: senderName, to: [recipient], subject, text: body, inReplyTo: source.messageId || undefined, references: [source.references, source.messageId].filter(Boolean).join(" ") || undefined }, files) });
    } finally { await smtp.quit(); }
  } else if (provider === "gmail") {
    const refresh = await getConnectionKeyForUser(owner.id, conn(owner, "gmail"));
    if (!refresh) throw new Error("Gmail support mailbox not connected");
    const token = await gmailToken(refresh);
    const source = await gmail(token, `/users/me/messages/${encodeURIComponent(id)}?format=full`);
    const headers = source.payload?.headers || [];
    const to = parseRecipients(header(headers, "Reply-To") || header(headers, "From"))[0];
    if (!to) throw new Error("No reply address");
    const raw = buildMimeMessage({ from: mailbox, fromName: await gmailSenderName(token, mailbox), to: [to], subject, text: body, inReplyTo: header(headers, "Message-ID") || undefined, references: [header(headers, "References"), header(headers, "Message-ID")].filter(Boolean).join(" ") || undefined }, files);
    const sent = await gmail(token, "/users/me/messages/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ raw: b64urlEncode(raw), threadId: source.threadId }) });
    if (!sent?.id) throw new Error("Gmail did not confirm sending");
  } else {
    const refresh = await getConnectionKeyForUser(owner.id, conn(owner, "outlook"));
    if (!refresh) throw new Error("Outlook support mailbox not connected");
    const token = await outlookToken(refresh);
    // Create a reply draft, replace the quoted body, then send inside the Graph thread.
    const draft = await graph(token, `/me/messages/${encodeURIComponent(id)}/createReply`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    if (!draft?.id) throw new Error("Outlook did not create a reply draft");
    await graph(token, `/me/messages/${encodeURIComponent(draft.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: { contentType: "Text", content: body } }) });
    for (const f of files) await graph(token, `/me/messages/${encodeURIComponent(draft.id)}/attachments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ "@odata.type": "#microsoft.graph.fileAttachment", name: f.name, contentType: f.mimeType, contentBytes: toB64(f.bytes) }) });
    await graph(token, `/me/messages/${encodeURIComponent(draft.id)}/send`, { method: "POST" });
  }
  return { success: true, sent: true };
}

async function sendNew(owner: Owner, provider: Provider, to: unknown, subject: unknown, body: unknown) {
  const recipients = parseRecipients(to);
  if (recipients.length !== 1 || typeof subject !== "string" || !subject.trim() || subject.length > 300 || typeof body !== "string" || !body.trim() || body.length > 20000) {
    throw new Error("Enter one valid recipient, a subject and a message");
  }
  const row = await getConnectionRow(owner.id, conn(owner, provider));
  if (!row) throw new Error("Support mailbox not connected");
  const recipient = recipients[0];
  if (provider === "domain") {
    const credentials = await domainCredentials(owner);
    const senderName = senderNameFromAddress(credentials.email);
    const smtp = new SmtpClient();
    try {
      await smtp.login(credentials);
      await smtp.sendRaw({ from: credentials.email, rcpts: [recipient], data: buildMimeMessage({ from: credentials.email, fromName: senderName, to: [recipient], subject: subject.trim(), text: body.trim() }) });
    } finally { await smtp.quit(); }
  } else if (provider === "gmail") {
    const refresh = await getConnectionKeyForUser(owner.id, conn(owner, "gmail"));
    if (!refresh) throw new Error("Gmail support mailbox not connected");
    const token = await gmailToken(refresh);
    const mailbox = (await gmail(token, "/users/me/profile")).emailAddress;
    if (!mailbox) throw new Error("Could not identify Gmail address");
    const raw = buildMimeMessage({ from: mailbox, fromName: await gmailSenderName(token, mailbox), to: [recipient], subject: subject.trim(), text: body.trim() });
    const sent = await gmail(token, "/users/me/messages/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ raw: b64urlEncode(raw) }) });
    if (!sent?.id) throw new Error("Gmail did not confirm sending");
  } else {
    const refresh = await getConnectionKeyForUser(owner.id, conn(owner, "outlook"));
    if (!refresh) throw new Error("Outlook support mailbox not connected");
    const token = await outlookToken(refresh);
    await graph(token, "/me/sendMail", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: { subject: subject.trim(), body: { contentType: "Text", content: body.trim() }, toRecipients: [{ emailAddress: { address: recipient } }] }, saveToSentItems: true }) });
  }
  return { success: true, sent: true };
}

/** Moves the given inbox messages to trash (Gmail/Outlook) or expunges them (IMAP domain mail). */
async function deleteMails(owner: Owner, provider: Provider, ids: string[]) {
  if (!ids.length) throw new Error("Choose at least one email to delete");
  if (ids.length > 50) throw new Error("Delete up to 50 emails at a time");
  await deleteMailMedia(owner.id, conn(owner, provider), ids);
  if (provider === "domain") {
    const imap = new ImapClient();
    try {
      await imap.login(await domainCredentials(owner));
      for (const id of ids) await imap.deleteMessage(id);
    } finally { imap.logout(); }
    return { success: true, deleted: ids.length };
  }
  const refresh = await getConnectionKeyForUser(owner.id, conn(owner, provider));
  if (!refresh) throw new Error("Support mailbox not connected");
  if (provider === "gmail") {
    const token = await gmailToken(refresh);
    for (const id of ids) await gmail(token, `/users/me/messages/${encodeURIComponent(id)}/trash`, { method: "POST" });
  } else {
    const token = await outlookToken(refresh);
    for (const id of ids) {
      await graph(token, `/me/messages/${encodeURIComponent(id)}/move`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ destinationId: "deleteditems" }) });
    }
  }
  return { success: true, deleted: ids.length };
}

export async function handleSupportMailAction(action: SupportMailAction, req: Request, input: any): Promise<any> {
  // scope "personal": the signed-in user's own AI Connect mailboxes (e.g. employers).
  const owner: Owner = input?.scope === "personal"
    ? await withPersonalDefaults({ id: await requireUserId(req), personal: true })
    : { id: await authorizedOwner(req), personal: false };
  return await runMailAction(owner, action, input);
}

/** Public Email API: run an action on a user's own AI Connect mailboxes (caller already authenticated by API key). */
export async function runPersonalMailAction(userId: string, action: SupportMailAction, input: any): Promise<any> {
  return await runMailAction(await withPersonalDefaults({ id: userId, personal: true }, input?.account), action, input);
}

async function runMailAction(owner: Owner, action: SupportMailAction, input: any): Promise<any> {
  if (action === "support_mail_list") {
    const offset = Math.max(0, Math.min(10000, Math.floor(Number(input?.offset) || 0)));
    const limit = Math.max(1, Math.min(50, Math.floor(Number(input?.limit) || 20)));
    const results = await Promise.allSettled((Object.keys(providers) as Provider[]).map(p => listProvider(owner, p, offset + limit)));
    const mailboxes = results.map((r, i) => ({ provider: (Object.keys(providers) as Provider[])[i], connected: r.status === "fulfilled" && !!r.value.mailbox, mailbox: r.status === "fulfilled" ? r.value.mailbox : "", error: r.status === "rejected" ? text(r.reason?.message || "Mailbox unavailable") : "" }));
    const merged = results.flatMap(r => r.status === "fulfilled" ? r.value.items : []).sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
    return { success: true, items: merged.slice(offset, offset + limit), hasMore: merged.length > offset + limit, mailboxes };
  }
  if (action === "support_mail_send") {
    if (!validProvider(input?.provider)) throw new Error("Choose a connected support mailbox");
    return await sendNew(owner, input.provider, input.to, input.subject, input.body);
  }
  if (action === "support_mail_delete") {
    const provider = input?.provider;
    if (!validProvider(provider)) throw new Error("Choose a connected support mailbox");
    if (!await getConnectionRow(owner.id, conn(owner, provider))) throw new Error("Support mailbox not connected");
    const ids = Array.isArray(input?.ids) ? input.ids.map((v: unknown) => text(v)).filter((v: string) => v && v.length <= 512) : [];
    return await deleteMails(owner, provider, ids);
  }
  const provider = input?.provider;
  if (!validProvider(provider) || !text(input?.id) || text(input.id).length > 512) throw new Error("Invalid mailbox message");
  if (!await getConnectionRow(owner.id, conn(owner, provider))) throw new Error("Support mailbox not connected");
  if (action === "support_mail_thread") {
    const items = (await thread(owner, provider, input.id)).sort((a, b) => (Date.parse(a.date) || 0) - (Date.parse(b.date) || 0));
    for (const item of items) for (const attachment of item.attachments || []) {
      if (attachment.size <= 8_000_000) await downloadAttachment(owner, provider, input.id, item.id, attachment.id, items);
    }
    return { success: true, items };
  }
  if (action === "support_mail_attachment") return await downloadAttachment(owner, provider, input.id, text(input.messageId), text(input.attachmentId));
  return await reply(owner, provider, input.id, text(input?.body), parseFiles(input?.files));
}