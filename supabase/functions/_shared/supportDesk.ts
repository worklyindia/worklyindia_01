// Owner customer-service desk.
//
// Its own mailbox slots ("custom_email:support", "microsoft_outlook:support",
// "google_mail:support") and its own persona + settings, completely separate
// from the AI Connect page mailboxes (which stay a normal personal assistant).
//
// Sending / replying priority: Domain Email → Outlook → Gmail.
import { adminClient, requireUserId } from "./appUserConnections.ts";
import { runCustomEmailAutoReplyFor } from "./userCustomEmail.ts";
import { runOutlookAutoReplyFor } from "./userOutlook.ts";
import { runGmailAutoReplyFor } from "./userGmail.ts";
import { loadSupportAccountSettings } from './supportReplySettings.ts';
import { SUPPORT_CHANNELS, type SupportChannel } from './supportReplyScope.ts';
import { z } from 'npm:zod@3';

export const SUPPORT_ACTIONS = [
  "support_settings_get",
  "support_settings_save",
  "support_autoreply_run",
  "support_autoreply_cron",
  "support_account_settings_get",
  "support_account_settings_save",
] as const;

export type SupportAction = (typeof SUPPORT_ACTIONS)[number];

export function isSupportAction(action: unknown): action is SupportAction {
  return SUPPORT_ACTIONS.includes(String(action) as SupportAction);
}

export interface SupportSettings {
  enabled: boolean;
  brand_name: string;
  tone: string;
  language: string;
  business_info: string;
  custom_instructions: string;
  signature: string;
  max_replies_per_run: number;
  only_unread: boolean;
  skip_promotions: boolean;
  last_run_at?: string | null;
  last_run_status?: string | null;
}

const DEFAULTS: SupportSettings = {
  enabled: false,
  brand_name: "Workly India",
  tone: "friendly",
  language: "auto",
  business_info: "",
  custom_instructions: "",
  signature: "",
  max_replies_per_run: 5,
  only_unread: true,
  skip_promotions: true,
};

const KEYS = Object.keys(DEFAULTS) as Array<keyof SupportSettings>;

async function loadSettings(userId: string): Promise<SupportSettings> {
  const { data } = await adminClient()
    .from("owner_support_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  const out: any = { ...DEFAULTS };
  if (data) {
    for (const k of KEYS) if (data[k] !== null && data[k] !== undefined) out[k] = data[k];
    out.last_run_at = data.last_run_at ?? null;
    out.last_run_status = data.last_run_status ?? null;
  }
  return out as SupportSettings;
}

async function saveSettings(userId: string, patch: Partial<SupportSettings>) {
  const merged: any = { ...(await loadSettings(userId)) };
  for (const k of KEYS) if (patch[k] !== undefined && patch[k] !== null) merged[k] = patch[k];
  merged.max_replies_per_run = Math.max(1, Math.min(20, Number(merged.max_replies_per_run) || 5));
  const row: any = { user_id: userId, updated_at: new Date().toISOString() };
  for (const k of KEYS) row[k] = merged[k];
  delete row.last_run_at;
  delete row.last_run_status;
  const { error } = await adminClient()
    .from("owner_support_settings")
    .upsert(row, { onConflict: "user_id" });
  if (error) throw error;
  return await loadSettings(userId);
}

/** Customer-support persona used for every support-desk mailbox. */
function persona(s: SupportSettings): string {
  const brand = s.brand_name || "our company";
  return [
    `You are the official customer support agent of ${brand}, replying to a customer email.`,
    "Greet the customer, answer the actual question, and give the next clear step.",
    "Be helpful and solution-focused; apologise briefly when something went wrong.",
    "Use the current verified website facts. If you cannot confirm something, say so; never promise that staff are checking or will reply soon without confirmation.",
  ].join(" ");
}

type ProviderResult = { provider: string; result: any };

/**
 * Runs the support auto reply on every connected support mailbox, in the
 * fallback order Domain Email → Outlook → Gmail.
 */
async function runSupportAutoReply(userId: string, dryRun: boolean) {
  const settings = await loadSettings(userId);

  const common = { persona: persona(settings) };
  const shared = {
    enabled: true,
    tone: settings.tone,
    language: settings.language,
    business_info: settings.business_info,
    custom_instructions: settings.custom_instructions,
    signature: settings.signature,
    max_replies_per_run: settings.max_replies_per_run,
    only_unread: settings.only_unread,
    skip_promotions: settings.skip_promotions,
  };

  const runs: ProviderResult[] = [];
  const attempt = async (provider: string, fn: () => Promise<any>) => {
    try {
      runs.push({ provider, result: await fn() });
    } catch (e: any) {
      runs.push({ provider, result: { success: false, error: e?.message || String(e) } });
    }
  };

  const [custom, outlook, gmail] = await Promise.all(['custom_email', 'outlook', 'gmail'].map((channel) => loadSupportAccountSettings(adminClient(), userId, channel as SupportChannel)));
  if (custom.enabled || dryRun) await attempt("custom_email", () =>
    runCustomEmailAutoReplyFor(userId, dryRun, {
      connectorId: "custom_email:support",
      settings: { ...shared, ...custom } as any,
      ...common,
    })
  );
  if (outlook.enabled || dryRun) await attempt("outlook", () =>
    runOutlookAutoReplyFor(userId, dryRun, {
      connectorId: "microsoft_outlook:support",
      settings: { ...shared, ...outlook } as any,
      ...common,
    })
  );
  if (gmail.enabled || dryRun) await attempt("gmail", () =>
    runGmailAutoReplyFor(userId, dryRun, {
      connectorId: "google_mail:support",
      settings: { ...shared, ...gmail, reply_scope: "all" } as any,
      ...common,
    })
  );

  const connected = runs.filter((r) => r.result?.success);
  const replied = connected.reduce((n, r) => n + (Number(r.result?.replied) || 0), 0);
  const scanned = connected.reduce((n, r) => n + (Number(r.result?.scanned) || 0), 0);

  if (!dryRun) {
    await adminClient().from("owner_support_settings").upsert({
      user_id: userId,
      last_run_at: new Date().toISOString(),
      last_run_status: connected.length
        ? `${scanned} scanned, ${replied} replied (${connected.map((r) => r.provider).join(", ")})`
        : runs.length ? runs.map((r) => `${r.provider}: ${r.result?.error || 'no replies'}`).join('; ') : 'All support email auto replies are off',
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
  }

  return { success: true, scanned, replied, runs };
}

async function runSupportCron(req: Request, body: any) {
  const key = req.headers.get("x-cron-key") || body?.cronKey || "";
  const cronKey = Deno.env.get("YT_AUTOREPLY_CRON_KEY") || "";
  if (key !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") && !(cronKey && key === cronKey)) {
    return { success: false, error: "Unauthorized" };
  }
  const { data: rows } = await adminClient()
    .from("admin_users")
    .select("user_id")
    .eq("role", "owner");
  const results: any[] = [];
  for (const r of rows || []) {
    try {
      results.push({ userId: r.user_id, ...(await runSupportAutoReply(r.user_id, false)) });
    } catch (e: any) {
      results.push({ userId: r.user_id, error: e?.message || String(e) });
    }
  }
  return { success: true, users: results.length, results };
}

export async function handleSupportAction(action: SupportAction, req: Request, body: any): Promise<any> {
  if (action === "support_autoreply_cron") return await runSupportCron(req, body);
  const userId = await requireUserId(req);
  const admin = adminClient();
  const { data: owner, error: roleError } = await admin.from('admin_users').select('role').eq('user_id', userId).maybeSingle();
  if (roleError || owner?.role !== 'owner') throw new Error('Only the owner can manage customer service settings');

  if (action === 'support_account_settings_get' || action === 'support_account_settings_save') {
    const parsed = z.object({ channel: z.enum(SUPPORT_CHANNELS), account_id: z.string().max(255).default('') }).safeParse(body);
    if (!parsed.success) throw new Error('Invalid support account');
    const { channel, account_id: accountId } = parsed.data;
    if (channel === 'whatsapp') {
      const { data: number } = await admin.from('whatsapp_audience_accounts').select('phone_number_id').eq('audience', 'customer_service').eq('status', 'connected').eq('phone_number_id', accountId).maybeSingle();
      if (!number) throw new Error('Connect this Customer Service WhatsApp number first');
    } else if (accountId) throw new Error('Invalid mailbox account');
    if (action === 'support_account_settings_save') {
      const value = z.object({ enabled: z.boolean(), tone: z.string().min(1).max(30), language: z.string().min(1).max(30), business_info: z.string().max(3000), custom_instructions: z.string().max(1500), signature: z.string().max(200) }).safeParse(body.settings);
      if (!value.success) throw new Error('Invalid auto-reply settings');
      const { error } = await admin.from('support_account_reply_settings').upsert({ user_id: userId, channel, account_id: accountId, settings: value.data, updated_at: new Date().toISOString() }, { onConflict: 'user_id,channel,account_id' });
      if (error) throw error;
    }
    return { success: true, settings: await loadSupportAccountSettings(admin, userId, channel, accountId) };
  }

  switch (action) {
    case "support_settings_get":
      return { success: true, settings: await loadSettings(userId) };
    case "support_settings_save":
      return { success: true, settings: await saveSettings(userId, body?.settings || {}) };
    case "support_autoreply_run":
      return await runSupportAutoReply(userId, !!body?.dryRun);
  }
}
