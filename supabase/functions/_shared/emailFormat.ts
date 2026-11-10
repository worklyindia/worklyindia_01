/**
 * Small helpers that make raw mailbox data human-friendly for the AI chat
 * "Email Intelligence" answers (IST date/time, read status, attachment info).
 */

/** Formats any email Date header into readable IST, e.g. "19 August 2026, 10:35 AM (IST)". */
export function istDateTime(raw?: string | null): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  const date = d.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  return `${date}, ${time} (IST)`;
}

/** "aaj 10:35 AM" style relative hint so the AI can say how old the mail is. */
export function relativeAge(raw?: string | null): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute(s) ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour(s) ago`;
  const days = Math.round(hours / 24);
  return `${days} day(s) ago`;
}

/**
 * Pulls the useful links out of an email body (verification, invoice, meeting,
 * tracking, unsubscribe …) so the AI can hand them to the user in chat.
 */
export function extractLinks(body?: string | null, max = 8): { url: string; kind: string }[] {
  if (!body) return [];
  const seen = new Set<string>();
  const out: { url: string; kind: string }[] = [];
  const re = /https?:\/\/[^\s<>"')\]]+/gi;
  for (const raw of body.match(re) || []) {
    const url = raw.replace(/[.,;:]+$/, "");
    const key = url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const l = key;
    const kind = /unsubscribe|optout|opt-out/.test(l)
      ? "unsubscribe"
      : /verify|confirm|activate|validate/.test(l)
      ? "verification"
      : /reset|password/.test(l)
      ? "password reset"
      : /invoice|receipt|billing|payment|pay/.test(l)
      ? "payment/invoice"
      : /meet\.google|zoom\.us|teams\.microsoft|calendar/.test(l)
      ? "meeting"
      : /track|shipment|courier|delivery/.test(l)
      ? "tracking"
      : /\.pdf(\?|$)/.test(l)
      ? "pdf"
      : /\.(png|jpe?g|webp|gif)(\?|$)/.test(l)
      ? "image"
      : "link";
    out.push({ url, kind });
    if (out.length >= max) break;
  }
  // Useful links first, unsubscribe/tracking pixels last.
  return out.sort((a, b) => (a.kind === "unsubscribe" ? 1 : 0) - (b.kind === "unsubscribe" ? 1 : 0));
}

/** Standard notification stamp: date "22 September 2026", time "05:37:20 PM" (IST). */
export function istStampParts(input?: string | Date | null): { date: string; time: string; datetime: string } {
  const d = input ? new Date(input) : new Date();
  const safe = isNaN(d.getTime()) ? new Date() : d;
  const date = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "long", year: "numeric",
  }).format(safe);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
  }).format(safe).toUpperCase();
  return { date, time, datetime: `${date} at ${time}` };
}
