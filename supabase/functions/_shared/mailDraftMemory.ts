// Durable "email drafted but NOT sent yet" memory.
//
// Why this exists: the send tools are two-step (draft → confirm). Edge
// Functions serve consecutive chat turns from different isolates and the model
// sometimes forgets to re-send `confirmed: true`, so the user said "haan, bhej
// do", got another draft back, and the model still claimed "email bhej diya".
// Persisting the exact draft lets the SERVER send it on a plain confirmation —
// no trust in the model required.
import { adminClient } from "./appUserConnections.ts";

export interface PendingMailDraft {
  kind: "new" | "reply";
  mailbox: "gmail" | "domain";
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  body: string;
  html_body?: string;
  attachments?: any[];
  message_id?: string;
  subject_hint?: string;
  from_hint?: string;
  at: number;
}

/** A draft older than this is stale — never auto-send it. */
const DRAFT_TTL_MS = 30 * 60 * 1000;

export async function rememberMailDraft(
  userId: string,
  draft: PendingMailDraft,
): Promise<void> {
  if (!userId) return;
  const { error } = await adminClient()
    .from("ai_mail_context")
    .upsert(
      { user_id: userId, pending_draft: draft, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  if (error) console.error("[mail-draft] save failed", error.message);
}

export async function recallMailDraft(
  userId: string,
): Promise<PendingMailDraft | undefined> {
  if (!userId) return undefined;
  try {
    const { data } = await adminClient()
      .from("ai_mail_context")
      .select("pending_draft")
      .eq("user_id", userId)
      .maybeSingle();
    const draft = data?.pending_draft as PendingMailDraft | null;
    if (!draft?.at || Date.now() - draft.at > DRAFT_TTL_MS) return undefined;
    return draft;
  } catch (e) {
    console.error("[mail-draft] load failed", (e as any)?.message || e);
    return undefined;
  }
}

export async function clearMailDraft(userId: string): Promise<void> {
  if (!userId) return;
  try {
    await adminClient()
      .from("ai_mail_context")
      .update({ pending_draft: null, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
  } catch (e) {
    console.error("[mail-draft] clear failed", (e as any)?.message || e);
  }
}

/**
 * "haan", "ha", "yes send kare", "bhej do", "send kar de", "ok bhejo"…
 * Deliberately strict: a plain approval only. Anything with new instructions
 * ("subject badal do", "ruko") must NOT auto-send.
 */
export function isSendConfirmation(text: string): boolean {
  const t = String(text || "").toLowerCase().trim();
  if (!t || t.length > 60) return false;
  if (/\b(ruk|rok|wait|mat|nahi|nhi|no|cancel|badal|change|edit|dobara likh)\b/.test(t)) {
    return false;
  }
  const YES =
    /\b(haan|han|haa|ha|hn|ji|yes|yep|yup|yeah|ok|okay|okey|k|sure|theek|thik|sahi|bilkul|confirm|approved?|go ahead)\b/;
  const SEND =
    /\b(bhej|bhejo|bhej do|bhejdo|bheg|send|send kar|send karo|send kare|send kar de|sent|kar do|kardo|kr do|daal do|maar do|fire)\b/;
  return YES.test(t) || SEND.test(t);
}
