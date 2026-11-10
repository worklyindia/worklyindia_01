// =============================================================================
// Expiry reminders — Push + Email + Telegram
// -----------------------------------------------------------------------------
// Runs daily from pg_cron. Sends the owner's saved templates for the four
// expiry events that previously had no sender at all:
//
//   job_expiry          -> employer, job post about to expire
//   boost_expiry        -> employer, job boost about to end
//   verification_expiry -> employer, verified badge about to lapse
//   ai_plan_expiry      -> job seeker, AI plan about to end
//
// Every reminder goes through email-api `send_push`, which
// applies the owner's Push template and fans the SAME event out to Email and
// Telegram with the correct audience — so a login holding both a job seeker
// and an employer profile is served on the right side, never skipped.
//
// De-duplication: one row per (entity_type, entity_id, stage) in
// `expiry_notification_log`, protected by a unique index, so re-runs on the
// same day can never double-send.
// =============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Days before expiry at which a reminder goes out. */
const WINDOWS = [7, 1] as const;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });

/** Whole days from now until `iso`, or null when unparseable. */
function daysUntil(iso?: string | null): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.ceil((then - Date.now()) / 86_400_000);
}

/**
 * Which reminder this item is due for: "7d" / "1d" before expiry, or
 * "expired" within the first day after it lapsed. null = nothing due today.
 */
function stageFor(days: number | null): string | null {
  if (days === null) return null;
  if (days <= 0) return days >= -1 ? "expired" : null;
  return (WINDOWS as readonly number[]).includes(days) ? `${days}d` : null;
}


interface Reminder {
  entityType: string;
  entityId: string;
  userId: string;
  stage: string;
  expiresAt: string;
  templateKey: string;
  audience: "employer" | "job_seeker";
  variables: Record<string, string>;
  fallbackTitle: string;
  fallbackMessage: string;
  actionUrl: string;
}

async function collect(supabase: any): Promise<Reminder[]> {
  const out: Reminder[] = [];
  const horizon = new Date(Date.now() + (Math.max(...WINDOWS) + 1) * 86_400_000).toISOString();
  // Look back far enough to catch items that lapsed since the last run.
  const since = new Date(Date.now() - 36 * 3_600_000).toISOString();

  // ---------------------------------------------------------- job_expiry ----
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, title, expires_at, status, company_id, companies!inner(user_id, company_name)")
    .not("expires_at", "is", null)
    .gte("expires_at", since)
    .lte("expires_at", horizon);

  for (const j of jobs ?? []) {
    const days = daysUntil(j.expires_at);
    const stage = stageFor(days);
    const userId = j.companies?.user_id ? String(j.companies.user_id) : null;
    if (!stage || !userId) continue;
    const expiryDate = formatDate(j.expires_at);
    out.push({
      entityType: "job",
      entityId: String(j.id),
      userId,
      stage: `job_expiry:${stage}`,
      expiresAt: j.expires_at,
      templateKey: "job_expiry",
      audience: "employer",
      variables: {
        job_title: String(j.title || "Your job post"),
        company: String(j.companies?.company_name || ""),
        expiry_date: expiryDate,
        days: String(Math.max(days ?? 0, 0)),
      },
      fallbackTitle: "Job post expiring soon ⏰",
      fallbackMessage: `Job : ${j.title}\nExpires on : ${expiryDate}\nExtend it to stay visible.`,
      actionUrl: "/employer-portal",
    });
  }

  // -------------------------------------------------------- boost_expiry ----
  const { data: boosts } = await supabase
    .from("job_boosts")
    .select("id, user_id, boost_end_date, status, jobs(title)")
    .not("boost_end_date", "is", null)
    .gte("boost_end_date", since)
    .lte("boost_end_date", horizon);

  for (const b of boosts ?? []) {
    const days = daysUntil(b.boost_end_date);
    const stage = stageFor(days);
    if (!stage || !b.user_id) continue;
    const expiryDate = formatDate(b.boost_end_date);
    const title = String(b.jobs?.title || "Your boosted job");
    out.push({
      entityType: "job_boost",
      entityId: String(b.id),
      userId: String(b.user_id),
      stage: `boost_expiry:${stage}`,
      expiresAt: b.boost_end_date,
      templateKey: "boost_expiry",
      audience: "employer",
      variables: { job_title: title, expiry_date: expiryDate, days: String(Math.max(days ?? 0, 0)) },
      fallbackTitle: "Job boost ending ⏰",
      fallbackMessage: `Job : ${title}\nBoost ends on : ${expiryDate}\nRenew it to keep the top spot.`,
      actionUrl: "/employer-portal",
    });
  }

  // ------------------------------------------------- verification_expiry ----
  const { data: companies } = await supabase
    .from("companies")
    .select("id, user_id, company_name, verified_plan_end, is_verified")
    .eq("is_verified", true)
    .not("verified_plan_end", "is", null)
    .gte("verified_plan_end", since)
    .lte("verified_plan_end", horizon);

  for (const c of companies ?? []) {
    const days = daysUntil(c.verified_plan_end);
    const stage = stageFor(days);
    if (!stage || !c.user_id) continue;
    const expiryDate = formatDate(c.verified_plan_end);
    out.push({
      entityType: "company_verification",
      entityId: String(c.id),
      userId: String(c.user_id),
      stage: `verification_expiry:${stage}`,
      expiresAt: c.verified_plan_end,
      templateKey: "verification_expiry",
      audience: "employer",
      variables: {
        company: String(c.company_name || ""),
        expiry_date: expiryDate,
        days: String(Math.max(days ?? 0, 0)),
      },
      fallbackTitle: "Verified badge expiring ⏰",
      fallbackMessage: `Company : ${c.company_name}\nExpires on : ${expiryDate}\nRenew it to stay verified.`,
      actionUrl: "/employer-portal",
    });
  }

  // ------------------------------------------------------ ai_plan_expiry ----
  const { data: plans } = await supabase
    .from("ai_chat_subscriptions")
    .select("id, user_id, plan_id, ends_at, status, ai_chat_plans(name)")
    .not("ends_at", "is", null)
    .gte("ends_at", since)
    .lte("ends_at", horizon);

  for (const p of plans ?? []) {
    const days = daysUntil(p.ends_at);
    const stage = stageFor(days);
    if (!stage || !p.user_id) continue;
    const expiryDate = formatDate(p.ends_at);
    const planName = String(p.ai_chat_plans?.name || "Your AI plan");
    out.push({
      entityType: "ai_plan",
      entityId: String(p.id),
      userId: String(p.user_id),
      stage: `ai_plan_expiry:${stage}`,
      expiresAt: p.ends_at,
      templateKey: "ai_plan_expiry",
      audience: "job_seeker",
      variables: { plan: planName, expiry_date: expiryDate, days: String(Math.max(days ?? 0, 0)) },
      fallbackTitle: "AI plan expiring ⏰",
      fallbackMessage: `Plan : ${planName}\nExpires on : ${expiryDate}\nRenew it to avoid interruption.`,
      actionUrl: "/ai-assistant/subscription",
    });
  }

  return out;
}

/** Reserve the reminder; false means it already went out. */
async function claim(supabase: any, r: Reminder): Promise<boolean> {
  const { error } = await supabase.from("expiry_notification_log").insert({
    entity_type: r.entityType,
    entity_id: r.entityId,
    user_id: r.userId,
    stage: r.stage,
    expires_at: r.expiresAt,
    sent_at: new Date().toISOString(),
  });
  if (!error) return true;
  if (String(error.code) === "23505") return false;
  console.warn(`[expiry-reminders] claim failed for ${r.stage} ${r.entityId}:`, error.message);
  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const summary = { checked: 0, sent: 0, skipped: 0, failed: 0, errors: [] as string[] };

  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch (_e) {
      body = {};
    }
    const dryRun = body?.dry_run === true;

    const reminders = await collect(supabase);
    summary.checked = reminders.length;

    if (dryRun) {
      return json({ ok: true, dry_run: true, ...summary, reminders });
    }

    for (const r of reminders) {
      if (!(await claim(supabase, r))) {
        summary.skipped += 1;
        continue;
      }

      const { error } = await supabase.functions.invoke("email-api", {
        body: {
          action: "send_push",
          user_id: r.userId,
          event_type: r.templateKey,
          audience: r.audience,
          title: r.fallbackTitle,
          message: r.fallbackMessage,
          action_url: r.actionUrl,
          variables: r.variables,
        },
      });

      if (error) {
        summary.failed += 1;
        summary.errors.push(`${r.stage} ${r.entityId}: ${error.message}`);
        // Release the claim so the next run retries this reminder.
        await supabase
          .from("expiry_notification_log")
          .delete()
          .eq("entity_type", r.entityType)
          .eq("entity_id", r.entityId)
          .eq("stage", r.stage);
        continue;
      }

      summary.sent += 1;
    }

    console.log(
      `[expiry-reminders] checked=${summary.checked} sent=${summary.sent} skipped=${summary.skipped} failed=${summary.failed}`,
    );
    return json({ ok: true, ...summary });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[expiry-reminders]", message);
    return json({ ok: false, ...summary, error: message }, 500);
  }
});
