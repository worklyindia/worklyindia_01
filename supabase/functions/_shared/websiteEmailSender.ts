// Server-only: sends website emails from a mailbox the owner connected.
//
// Two sets of mailboxes exist:
//   * Owner portal → Email Templates → sending mailboxes. One set per audience
//     ("jobseeker" / "employer"), stored as "<provider>:<audience>".
//   * AI Connect page (unscoped "<provider>"), used as a last resort.
//
// Within a set the order is always: domain mailbox → Outlook → Gmail.
// Returns null when no mailbox is connected — email then fails visibly (no third-party fallback).
import { adminClient } from "./appUserConnections.ts";
import { sendCustomEmailForUser } from "./userCustomEmail.ts";
import { sendOutlookMailForUser } from "./userOutlook.ts";
import { sendGmailForOwner } from "./websiteGmailSender.ts";

export type EmailAudience = "jobseeker" | "employer";

export interface WebsiteSendParams {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text?: string;
  senderName?: string;
  /** Which side of the marketplace this email is addressed to. */
  audience?: EmailAudience | null;
}

export interface WebsiteSendResult {
  provider: "custom_email" | "outlook" | "gmail";
  from: string;
  messageId?: string;
}

// No hardcoded Outlook block: a connected Outlook mailbox is always tried.
// If Microsoft actually locks/blocks it, the policy cooldown below pauses it
// for 24h and Gmail/domain mail takes over automatically.
const BLOCKED_AUTOMATED_OUTLOOK_SENDERS = new Set<string>();

const outlookCooldownUntil = new Map<string, number>();
const OUTLOOK_POLICY_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const OUTLOOK_HOURLY_LIMIT = 10;
const OUTLOOK_DAILY_LIMIT = 60;

function isMicrosoftPolicyBlock(error: unknown): boolean {
  const detail = error instanceof Error ? error.message : String(error);
  return /account.{0,30}(locked|blocked|disabled)|services agreement|accountlocked|erroraccountdisabled|accessdenied|mailbox.*(blocked|locked)|5\.7\.(?:1|3|57|708)/i.test(detail);
}

/** user_id of the accounts holding the owner/admin role (owners first). */
async function ownerUserIds(): Promise<string[]> {
  const { data } = await adminClient()
    .from("user_roles")
    .select("user_id, role")
    .in("role", ["owner", "admin"]);
  const rows = data || [];
  const owners = rows.filter((r: any) => r.role === "owner").map((r: any) => r.user_id);
  const admins = rows.filter((r: any) => r.role === "admin").map((r: any) => r.user_id);
  return [...new Set([...owners, ...admins])];
}

/** Users who have this connector connected, owner accounts first. */
async function candidatesFor(
  connectorId: string,
  owners: string[],
): Promise<Array<{ userId: string; accountEmail: string }>> {
  const { data } = await adminClient()
    .from("app_user_connections")
    .select("user_id, account_email, updated_at")
    .eq("connector_id", connectorId)
    .order("updated_at", { ascending: false });
  const rows = (data || [])
    .filter((r: any) => r.user_id)
    .map((r: any) => ({
      userId: String(r.user_id),
      accountEmail: String(r.account_email || "").trim().toLowerCase(),
    }));
  const preferred = rows.filter((row) => owners.includes(row.userId));
  const ordered = [...preferred, ...rows];
  return ordered.filter((row, index) =>
    ordered.findIndex((candidate) => candidate.userId === row.userId) === index
  );
}

const plainText = (p: WebsiteSendParams) =>
  p.text || p.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

/** Tries domain mailbox → Outlook → Gmail for one mailbox set. */
async function trySet(
  p: WebsiteSendParams,
  suffix: string,
  owners: string[],
  errors: string[],
): Promise<WebsiteSendResult | null> {
  const custom = `custom_email${suffix}`;
  const outlook = `microsoft_outlook${suffix}`;
  const gmail = `google_mail${suffix}`;

  for (const candidate of await candidatesFor(custom, owners)) {
    try {
      const res = await sendCustomEmailForUser(candidate.userId, p.to, p.subject, plainText(p), {
        html: p.html,
        connectorId: custom,
      });
      if (res?.success) return { provider: "custom_email", from: res.from };
      if (res?.error && res.error !== "custom_email_not_connected") {
        errors.push(`${custom}: ${res.error}`);
      }
    } catch (e) {
      errors.push(`${custom}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  for (const candidate of await candidatesFor(outlook, owners)) {
    const cooldownKey = `${outlook}:${candidate.userId}`;
    if (BLOCKED_AUTOMATED_OUTLOOK_SENDERS.has(candidate.accountEmail)) {
      console.warn(`[websiteEmailSender] skipped blocked automated Outlook sender: ${candidate.accountEmail}`);
      continue;
    }
    if ((outlookCooldownUntil.get(cooldownKey) || 0) > Date.now()) {
      console.warn(`[websiteEmailSender] skipped Outlook sender during policy cooldown: ${candidate.accountEmail}`);
      continue;
    }
    // Safe sending limit: Outlook.com locks mailboxes that send in bursts, so
    // only a small hourly/daily share goes through Outlook; the rest uses Gmail.
    const { data: allowed, error: limitError } = await adminClient().rpc("reserve_outlook_send", {
      _user_id: candidate.userId,
      _hour_limit: OUTLOOK_HOURLY_LIMIT,
      _day_limit: OUTLOOK_DAILY_LIMIT,
    });
    if (limitError || allowed !== true) {
      console.warn(`[websiteEmailSender] Outlook safe limit reached, using next mailbox: ${candidate.accountEmail}`);
      continue;
    }
    try {
      const res = await sendOutlookMailForUser(
        candidate.userId,
        { to: p.to, subject: p.subject, html: p.html, text: p.text },
        outlook,
      );
      if (res) return { provider: "outlook", from: res.from };
    } catch (e) {
      if (isMicrosoftPolicyBlock(e)) {
        outlookCooldownUntil.set(cooldownKey, Date.now() + OUTLOOK_POLICY_COOLDOWN_MS);
      }
      errors.push(`${outlook}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  for (const candidate of await candidatesFor(gmail, owners)) {
    try {
      const res = await sendGmailForOwner(candidate.userId, p, gmail);
      if (res) return { provider: "gmail", from: res.from, messageId: res.messageId };
    } catch (e) {
      errors.push(`${gmail}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return null;
}

export async function sendWebsiteEmail(
  p: WebsiteSendParams,
  /** Filled with the exact per-mailbox failures so the caller can report them. */
  errorsOut?: string[],
): Promise<WebsiteSendResult | null> {
  const owners = await ownerUserIds();
  const errors: string[] = errorsOut ?? [];

  const suffixes: string[] = [];
  if (p.audience === "jobseeker" || p.audience === "employer") {
    // Audience mailboxes stay strictly separate — never fall back to AI Connect.
    suffixes.push(`:${p.audience}`);
  } else {
    suffixes.push("");
  }

  for (const suffix of suffixes) {
    const result = await trySet(p, suffix, owners, errors);
    if (result) return result;
  }

  if (errors.length) console.error("[websiteEmailSender] all owner mailboxes failed:", errors.join(" | "));
  return null;
}
