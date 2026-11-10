/**
 * Shared detection for automated / no-reply / bulk email.
 * Used by Gmail and Domain Email auto-reply so the AI never answers
 * bank alerts, OTPs, newsletters and other "do not reply" machines.
 * Real people (any domain) always pass, and a NEW message in an
 * already-answered thread still gets a reply (dedupe is per message id).
 */

const NOREPLY_LOCAL = /^(no[._-]?reply|do[._-]?not[._-]?reply|donotreply|mailer[-_]?daemon|postmaster|bounce[sd]?|notification[s]?|notify|alerts?|bankalerts?|auto(mated|reply|mailer)?|system|noreply\d*|info[-_]?bot|updates?|newsletter|news|promo(tions?)?|offers?|deals?|marketing|billing|invoice|receipts?|statements?|otp|verify|verification|security[-_]?alerts?|support[-_]?bot|robot|daemon)$/i;

const NOREPLY_FRAGMENT = /(no[-_.]?reply|donotreply|do-not-reply|mailer-daemon|bounce|postmaster|notifications?@|bankalerts?@|autoresponder)/i;

const BODY_MARKERS = [
  /please\s+do\s*not\s+reply/i,
  /do\s*not\s+reply\s+to\s+this/i,
  /this\s+is\s+an?\s+(automatically|auto|system)[- ]?(generated|created)/i,
  /system\s+generated\s+(e-?mail|message)/i,
  /is\s+an\s+auto(mated)?\s+(e-?mail|message|response)/i,
  /unsubscribe\s+(from|here)/i,
  /no\s+longer\s+wish\s+to\s+receive/i,
];

export interface AutomatedCheckInput {
  fromEmail?: string | null;
  subject?: string | null;
  body?: string | null;
  /** Raw header lookup: name -> value (case-insensitive is handled by caller). */
  getHeader?: (name: string) => string | null | undefined;
}

/** Returns a skip reason string when the mail is machine-generated, else null. */
export function automatedSkipReason(input: AutomatedCheckInput): string | null {
  const from = (input.fromEmail || "").toLowerCase().trim();
  if (!from) return "no_sender";

  const local = from.split("@")[0] || "";
  if (NOREPLY_LOCAL.test(local) || NOREPLY_FRAGMENT.test(from)) return "noreply_sender";

  const h = input.getHeader;
  if (h) {
    const autoSubmitted = (h("Auto-Submitted") || "").toLowerCase();
    if (autoSubmitted && autoSubmitted !== "no") return "auto_submitted";
    const precedence = (h("Precedence") || "").toLowerCase();
    if (/bulk|junk|list|auto_reply/.test(precedence)) return "bulk_precedence";
    if (h("List-Unsubscribe") || h("List-Id") || h("List-Unsubscribe-Post")) return "bulk_list";
    if (h("X-Auto-Response-Suppress")) return "auto_response_suppress";
    if ((h("X-Autoreply") || h("X-Autorespond"))) return "auto_responder";
    const campaign = h("X-Mailer") || h("X-Campaign-Id") || h("X-Mailgun-Sid") || h("X-SES-Outgoing") || h("X-SG-EID");
    if (campaign && /mailchimp|sendgrid|mailgun|amazonses|netcore|sendinblue|brevo|zeptomail|campaign/i.test(campaign)) {
      return "bulk_mailer";
    }
    const replyTo = (h("Reply-To") || "").toLowerCase();
    if (replyTo && NOREPLY_FRAGMENT.test(replyTo)) return "noreply_replyto";
  }

  const text = `${input.subject || ""}\n${input.body || ""}`;
  if (BODY_MARKERS.some((re) => re.test(text))) return "do_not_reply_body";

  return null;
}
