// Minimal IMAP + SMTP clients over implicit TLS for custom / domain mailboxes
// (Google Workspace, Hostinger, GoDaddy, Namecheap, Zoho, cPanel, etc).
// Server-only — never import from browser code.

const encoder = new TextEncoder();
const decoder = new TextDecoder();

class TlsLineConn {
  private conn!: Deno.TlsConn;
  private buf = "";

  async connect(hostname: string, port: number) {
    this.conn = await Deno.connectTls({ hostname, port });
  }

  close() {
    try { this.conn.close(); } catch { /* ignore */ }
  }

  async write(data: string) {
    await this.conn.write(encoder.encode(data));
  }

  /** Reads until `predicate(buffer)` is true, then returns + clears the buffer. */
  async readUntil(predicate: (chunk: string) => boolean, timeoutMs = 20000): Promise<string> {
    const deadline = Date.now() + timeoutMs;
    const tmp = new Uint8Array(65536);
    while (!predicate(this.buf)) {
      if (Date.now() > deadline) throw new Error("Mail server timed out");
      const n = await this.conn.read(tmp);
      if (n === null) break;
      this.buf += decoder.decode(tmp.subarray(0, n));
    }
    const out = this.buf;
    this.buf = "";
    return out;
  }
}

/* ---------------------------------- IMAP ---------------------------------- */

export interface MailboxCredentials {
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  email: string;
  password: string;
}

export interface FetchedMessage {
  uid: string;
  from: string;
  fromEmail: string;
  to: string;
  cc: string;
  date: string;
  subject: string;
  messageId: string;
  references: string;
  replyTo: string;
  unread: boolean;
  flags: string[];
  attachments: string[];
  body: string;
  /** Raw header block, used for automated/bulk mail detection. */
  rawHeaders: string;
}

/** Reads a single header value from a raw header block. */
export function readHeader(rawHeaders: string, name: string): string {
  return headerOf(rawHeaders, name);
}


function quote(v: string) {
  return `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function headerOf(raw: string, name: string): string {
  const re = new RegExp(`^${name}:[ \\t]*([\\s\\S]*?)(?=\\r?\\n[^ \\t]|$)`, "im");
  const m = raw.match(re);
  return m ? m[1].replace(/\r?\n[ \t]+/g, " ").trim() : "";
}

function decodeMimeWords(value: string): string {
  return value.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_all, _cs, enc, text) => {
    try {
      if (enc.toUpperCase() === "B") {
        const bin = atob(text);
        return decoder.decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
      }
      const bytes: number[] = [];
      const s = text.replace(/_/g, " ");
      for (let i = 0; i < s.length; i++) {
        if (s[i] === "=" && /[0-9A-Fa-f]{2}/.test(s.slice(i + 1, i + 3))) {
          bytes.push(parseInt(s.slice(i + 1, i + 3), 16));
          i += 2;
        } else bytes.push(s.charCodeAt(i));
      }
      return decoder.decode(Uint8Array.from(bytes));
    } catch {
      return text;
    }
  });
}

function extractPlainBody(raw: string): string {
  const sep = raw.indexOf("\r\n\r\n");
  const headers = sep === -1 ? raw : raw.slice(0, sep);
  let body = sep === -1 ? "" : raw.slice(sep + 4);

  const ctype = headerOf(headers, "Content-Type");
  const boundary = ctype.match(/boundary="?([^";]+)"?/i)?.[1];
  if (boundary) {
    const parts = body.split(`--${boundary}`);
    const plain = parts.find((p) => /content-type:\s*text\/plain/i.test(p));
    const chosen = plain || parts.find((p) => /content-type:\s*text\/html/i.test(p));
    if (chosen) {
      const s = chosen.indexOf("\r\n\r\n");
      const partHeaders = s === -1 ? "" : chosen.slice(0, s);
      body = s === -1 ? chosen : chosen.slice(s + 4);
      if (/base64/i.test(headerOf(partHeaders, "Content-Transfer-Encoding"))) {
        try { body = decoder.decode(Uint8Array.from(atob(body.replace(/\s+/g, "")), (c) => c.charCodeAt(0))); } catch { /* keep */ }
      }
    }
  } else if (/base64/i.test(headerOf(headers, "Content-Transfer-Encoding"))) {
    try { body = decoder.decode(Uint8Array.from(atob(body.replace(/\s+/g, "")), (c) => c.charCodeAt(0))); } catch { /* keep */ }
  }

  body = body.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ");
  return body.replace(/<[^>]+>/g, " ").replace(/[ \t]+\n/g, "\n").trim();
}

export function parseAddress(value: string): string {
  const m = value.match(/<([^>]+)>/);
  return (m ? m[1] : value).trim().toLowerCase();
}

export class ImapClient {
  private conn = new TlsLineConn();
  private seq = 0;

  async login(creds: MailboxCredentials) {
    await this.conn.connect(creds.imapHost, creds.imapPort);
    await this.conn.readUntil((b) => b.includes("\r\n"));
    const res = await this.command(`LOGIN ${quote(creds.email)} ${quote(creds.password)}`);
    if (!/ OK /i.test(res)) throw new Error("IMAP login failed — check email and password (app password may be required).");
  }

  async command(cmd: string, timeoutMs = 25000): Promise<string> {
    const tag = `a${++this.seq}`;
    await this.conn.write(`${tag} ${cmd}\r\n`);
    return await this.conn.readUntil(
      (b) => new RegExp(`^${tag} (OK|NO|BAD)`, "im").test(b),
      timeoutMs,
    );
  }

  logout() {
    this.conn.close();
  }

  /** Parses one raw RFC822 message into a full FetchedMessage. */
  private parseRaw(uid: string, raw: string, flags: string[]): FetchedMessage {
    const from = decodeMimeWords(headerOf(raw, "From"));
    const attachments: string[] = [];
    const nameRe = /name\*?=\s*"?([^";\r\n]+)"?/gi;
    for (const block of raw.split(/\r?\n--/)) {
      if (!/content-disposition:\s*attachment/i.test(block)) continue;
      const m = nameRe.exec(block);
      if (m?.[1]) attachments.push(decodeMimeWords(m[1]));
      nameRe.lastIndex = 0;
    }
    return {
      uid,
      from,
      fromEmail: parseAddress(from),
      to: decodeMimeWords(headerOf(raw, "To")),
      cc: decodeMimeWords(headerOf(raw, "Cc")),
      date: headerOf(raw, "Date"),
      subject: decodeMimeWords(headerOf(raw, "Subject")) || "(no subject)",
      messageId: headerOf(raw, "Message-ID"),
      references: headerOf(raw, "References"),
      replyTo: decodeMimeWords(headerOf(raw, "Reply-To")),
      unread: !flags.some((f) => /\\Seen/i.test(f)),
      flags,
      attachments,
      body: extractPlainBody(raw).slice(0, 12000),
      rawHeaders: raw.indexOf("\r\n\r\n") === -1 ? raw.slice(0, 4000) : raw.slice(0, raw.indexOf("\r\n\r\n")),
    };
  }

  /** Fetches the given UIDs (newest first order preserved by caller). */
  private async fetchUids(uids: string[]): Promise<FetchedMessage[]> {
    const out: FetchedMessage[] = [];
    for (const uid of uids) {
      const res = await this.command(`UID FETCH ${uid} (FLAGS BODY.PEEK[])`);
      const start = res.indexOf("}\r\n");
      if (start === -1) continue;
      const flags = (res.slice(0, start).match(/FLAGS \(([^)]*)\)/i)?.[1] || "")
        .split(/\s+/)
        .filter(Boolean);
      out.push(this.parseRaw(uid, res.slice(start + 3), flags));
    }
    return out;
  }

  /** Runs a raw IMAP search in the given mailbox and returns full messages. */
  async searchMailbox(
    criteria: string,
    limit: number,
    mailbox = "INBOX",
  ): Promise<FetchedMessage[]> {
    const sel = await this.command(`SELECT ${quote(mailbox)}`);
    if (!/ OK /i.test(sel)) throw new Error(`Mailbox "${mailbox}" not found`);
    const search = await this.command(`UID SEARCH ${criteria || "ALL"}`);
    if (!/ OK /i.test(search)) throw new Error("IMAP search failed");
    const line = search.split(/\r?\n/).find((l) => /^\* SEARCH/i.test(l)) || "";
    const uids = line.replace(/^\* SEARCH/i, "").trim().split(/\s+/).filter(Boolean);
    return await this.fetchUids(uids.slice(-limit).reverse());
  }

  async listInbox(onlyUnread: boolean, limit: number): Promise<FetchedMessage[]> {
    return await this.searchMailbox(onlyUnread ? "UNSEEN" : "ALL", limit);
  }

  /** Full details for one message by UID (or Message-ID header). */
  async fetchOne(id: string, mailbox = "INBOX"): Promise<FetchedMessage | null> {
    const criteria = /^\d+$/.test(id) ? `UID ${id}` : `HEADER Message-ID ${quote(id)}`;
    const found = await this.searchMailbox(criteria, 1, mailbox);
    return found[0] ?? null;
  }

  /** Raw RFC822 source of one message — needed to pull attachment bytes out. */
  async fetchRawMessage(id: string, mailbox = "INBOX"): Promise<string | null> {
    const sel = await this.command(`SELECT ${quote(mailbox)}`);
    if (!/ OK /i.test(sel)) throw new Error(`Mailbox "${mailbox}" not found`);
    let uid = id;
    if (!/^\d+$/.test(id)) {
      const search = await this.command(`UID SEARCH HEADER Message-ID ${quote(id)}`);
      const line = search.split(/\r?\n/).find((l) => /^\* SEARCH/i.test(l)) || "";
      uid = line.replace(/^\* SEARCH/i, "").trim().split(/\s+/).filter(Boolean).pop() || "";
      if (!uid) return null;
    }
    const res = await this.command(`UID FETCH ${uid} (BODY.PEEK[])`, 60000);
    const start = res.indexOf("}\r\n");
    if (start === -1) return null;
    return res.slice(start + 3);
  }



  /** Lists the mailbox folder names available on the account. */
  async listMailboxes(): Promise<string[]> {
    const res = await this.command('LIST "" "*"');
    return res
      .split(/\r?\n/)
      .filter((l) => /^\* LIST/i.test(l))
      .map((l) => l.match(/"([^"]+)"\s*$/)?.[1] || l.split(" ").pop() || "")
      .filter(Boolean);
  }

  async markSeen(uid: string) {
    await this.command(`UID STORE ${uid} +FLAGS (\\Seen)`);
  }

  /** Adds or removes IMAP flags, e.g. \\Seen, \\Flagged, \\Deleted. */
  async storeFlags(uid: string, flags: string[], add: boolean, mailbox = "INBOX") {
    await this.command(`SELECT ${quote(mailbox)}`);
    const res = await this.command(
      `UID STORE ${uid} ${add ? "+" : "-"}FLAGS (${flags.join(" ")})`,
    );
    if (!/ OK /i.test(res)) throw new Error("Could not update message flags");
  }

  /** Marks the message deleted and expunges it. */
  async deleteMessage(uid: string, mailbox = "INBOX") {
    await this.storeFlags(uid, ["\\Deleted"], true, mailbox);
    await this.command("EXPUNGE");
  }
}


/* ---------------------------------- SMTP ---------------------------------- */

function b64(input: string) {
  const bytes = encoder.encode(input);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function encodeSubject(subject: string) {
  return /^[\x20-\x7E]*$/.test(subject) ? subject : `=?UTF-8?B?${b64(subject)}?=`;
}

export class SmtpClient {
  private conn = new TlsLineConn();

  private async expect(codes: string[], timeoutMs = 20000) {
    const res = await this.conn.readUntil(
      (b) => /\r\n$/.test(b) && /^\d{3} /m.test(b.split(/\r\n/).filter(Boolean).pop() || ""),
      timeoutMs,
    );
    const last = res.split(/\r\n/).filter(Boolean).pop() || "";
    if (!codes.some((c) => last.startsWith(c))) {
      throw new Error(`SMTP error: ${last.slice(0, 200)}`);
    }
    return res;
  }

  private async send(line: string, codes: string[]) {
    await this.conn.write(`${line}\r\n`);
    return await this.expect(codes);
  }

  async login(creds: MailboxCredentials) {
    await this.conn.connect(creds.smtpHost, creds.smtpPort);
    await this.expect(["220"]);
    await this.send(`EHLO ${creds.smtpHost}`, ["250"]);
    await this.send("AUTH LOGIN", ["334"]);
    await this.send(b64(creds.email), ["334"]);
    try {
      await this.send(b64(creds.password), ["235"]);
    } catch {
      throw new Error("SMTP login failed — check email and password (app password may be required).");
    }
  }

  async sendMail(opts: {
    from: string;
    to: string;
    subject: string;
    body: string;
    inReplyTo?: string;
    references?: string;
  }) {
    await this.send(`MAIL FROM:<${parseAddress(opts.from)}>`, ["250"]);
    await this.send(`RCPT TO:<${parseAddress(opts.to)}>`, ["250", "251"]);
    await this.send("DATA", ["354"]);
    const headers = [
      `From: ${opts.from}`,
      `To: ${opts.to}`,
      `Subject: ${encodeSubject(opts.subject)}`,
      opts.inReplyTo ? `In-Reply-To: ${opts.inReplyTo}` : "",
      opts.references ? `References: ${opts.references}` : "",
      "MIME-Version: 1.0",
      'Content-Type: text/plain; charset="UTF-8"',
    ].filter(Boolean);
    const safeBody = opts.body.replace(/\r?\n/g, "\r\n").replace(/\r\n\./g, "\r\n..");
    await this.conn.write(`${headers.join("\r\n")}\r\n\r\n${safeBody}\r\n.\r\n`);
    await this.expect(["250"]);
  }

  /**
   * Sends an already composed MIME message (HTML, attachments, multiple
   * recipients incl. cc/bcc — every envelope recipient must be in `rcpts`).
   */
  async sendRaw(opts: { from: string; rcpts: string[]; data: string }) {
    await this.send(`MAIL FROM:<${parseAddress(opts.from)}>`, ["250"]);
    for (const rcpt of opts.rcpts) {
      await this.send(`RCPT TO:<${parseAddress(rcpt)}>`, ["250", "251"]);
    }
    await this.send("DATA", ["354"]);
    const safe = opts.data.replace(/\r?\n/g, "\r\n").replace(/\r\n\./g, "\r\n..");
    await this.conn.write(`${safe}\r\n.\r\n`);
    await this.expect(["250"]);
  }


  async quit() {
    try { await this.send("QUIT", ["221"]); } catch { /* ignore */ }
    this.conn.close();
  }
}
