// Domain renewal / expiry reminders.
//
// Runs daily from pg_cron. Reads live expiry dates from GoDaddy, maps each
// domain back to the buyer through `domain_orders`, and sends a reminder at
// 30 days and again at 7 days before expiry.
//
// De-duplication is enforced by the unique constraint on
// (user_id, domain, days_before, expires_at) in `domain_renewal_reminders`,
// so a re-run on the same day can never double-send.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { godaddy } from "../_shared/godaddy/client.ts";
import { BRAND_CONFIG } from "../_shared/brandConfig.ts";
import { fanoutLifecycleChannels } from "../_shared/lifecycleFanout.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/** Reminder windows, in days before expiry. */
const WINDOWS = [30, 7] as const;

interface GoDaddyDomain {
  domain: string;
  status?: string;
  expires?: string;
  renewAuto?: boolean;
  renewDeadline?: string;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/** Whole days from now until `iso`, or null when unparseable. */
function daysUntil(iso?: string): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.ceil((then - Date.now()) / 86_400_000);
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

function buildEmail(domain: string, days: number, expires: string, autoRenew: boolean) {
  const urgent = days <= 7;
  const heading = urgent
    ? `Your domain ${domain} expires in ${days} days`
    : `${domain} is due for renewal in ${days} days`;

  const action = autoRenew
    ? `<p style="margin:0 0 12px">Auto-renew is <strong>on</strong> for this domain, so it should renew
       automatically on ${formatDate(expires)}. Please make sure the payment method on your
       registrar account is valid, otherwise the renewal will fail.</p>`
    : `<p style="margin:0 0 12px">Auto-renew is <strong>off</strong> for this domain. If you do not renew it
       before ${formatDate(expires)}, the domain will expire and your website and email on it will
       stop working.</p>`;

  const html = `
    <h2 style="margin:0 0 12px;font-size:20px">${heading}</h2>
    <p style="margin:0 0 12px">Hello,</p>
    <p style="margin:0 0 12px">
      This is a reminder that <strong>${domain}</strong> expires on
      <strong>${formatDate(expires)}</strong>.
    </p>
    ${action}
    <p style="margin:16px 0">
      <a href="https://${BRAND_CONFIG.domain}/domains"
         style="background:#3B5CE4;color:#ffffff;padding:12px 20px;border-radius:6px;
                text-decoration:none;display:inline-block">Manage this domain</a>
    </p>
    <p style="margin:0;color:#666;font-size:13px">
      You can turn these reminders off for any domain from the Domains page.
    </p>`;

  const text =
    `${heading}\n\n${domain} expires on ${formatDate(expires)}. ` +
    (autoRenew
      ? "Auto-renew is on; check that your payment method is valid."
      : "Auto-renew is off; renew it before the expiry date to avoid losing the domain.") +
    `\n\nManage it here: https://${BRAND_CONFIG.domain}/domains`;

  return { subject: heading, html, text };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Server is not configured." }, 500);
  }

  // Only the scheduler (service role key) may trigger a send run.
  const auth = req.headers.get("Authorization") || "";
  if (auth.replace(/^Bearer\s+/i, "").trim() !== serviceKey) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  const summary = {
    scanned: 0,
    matched: 0,
    sent: 0,
    skipped_already_sent: 0,
    skipped_no_owner: 0,
    skipped_disabled: 0,
    failed: 0,
    errors: [] as string[],
  };

  try {
    // 1. Live expiry data straight from the registrar.
    const domains = await godaddy<GoDaddyDomain[]>({
      path: "/v1/domains",
      query: { statuses: "ACTIVE", limit: 1000 },
    });
    const list = Array.isArray(domains) ? domains : [];
    summary.scanned = list.length;

    // 2. Keep only the ones sitting exactly on a reminder window.
    const due = list
      .map((d) => ({ d, days: daysUntil(d.expires) }))
      .filter(
        (x): x is { d: GoDaddyDomain; days: number } =>
          x.days !== null && (WINDOWS as readonly number[]).includes(x.days),
      );

    if (due.length === 0) {
      return json({ ok: true, ...summary, note: "No domains in a reminder window today." });
    }

    // 3. Map each domain to the buyer via their completed order.
    const names = due.map((x) => x.d.domain);
    const { data: orders, error: ordersError } = await supabase
      .from("domain_orders")
      .select("domain, user_id, renewal_reminders_enabled")
      .in("domain", names)
      .eq("status", "completed");

    if (ordersError) throw new Error(`Order lookup failed: ${ordersError.message}`);

    const ownerByDomain = new Map<string, { user_id: string; enabled: boolean }>();
    for (const o of orders ?? []) {
      if (!o.domain || !o.user_id) continue;
      // Most recent completed order wins; first row is enough for ownership.
      if (!ownerByDomain.has(o.domain)) {
        ownerByDomain.set(o.domain, {
          user_id: o.user_id,
          enabled: o.renewal_reminders_enabled !== false,
        });
      }
    }

    for (const { d, days } of due) {
      const owner = ownerByDomain.get(d.domain);
      if (!owner) {
        summary.skipped_no_owner += 1;
        continue;
      }
      if (!owner.enabled) {
        summary.skipped_disabled += 1;
        continue;
      }
      summary.matched += 1;

      const expires = d.expires as string;

      // 4. Claim the send first. The unique index makes this the lock:
      //    if the row already exists we know a reminder went out.
      const { error: claimError } = await supabase
        .from("domain_renewal_reminders")
        .insert({
          user_id: owner.user_id,
          domain: d.domain,
          days_before: days,
          expires_at: expires,
          channel: "email",
          provider: "godaddy",
        });

      if (claimError) {
        if (claimError.code === "23505") {
          summary.skipped_already_sent += 1;
        } else {
          summary.failed += 1;
          summary.errors.push(`${d.domain}: ${claimError.message}`);
        }
        continue;
      }

      // 5. Look up the recipient address.
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("user_id", owner.user_id)
        .maybeSingle();

      const { subject, html, text } = buildEmail(
        d.domain,
        days,
        expires,
        d.renewAuto === true,
      );

      // 6. In-app notification always; email when we have an address.
      const { error: notifyError } = await supabase.from("notifications").insert({
        user_id: owner.user_id,
        title: subject,
        message: `${d.domain} expires on ${formatDate(expires)}.`,
        type: "domain_renewal",
        action_url: "/domains",
        metadata: { domain: d.domain, days_before: days, expires_at: expires },
      });
      if (notifyError) {
        summary.errors.push(`${d.domain} notification: ${notifyError.message}`);
      }

      if (profile?.email) {
        // Owner's saved "domain_expiry" template wins; the built-in email is
        // only used when no template is saved for this event.
        let templateSent = false;
        try {
          const fan = await fanoutLifecycleChannels(supabase, {
            userId: owner.user_id,
            templateKey: "domain_expiry",
            variables: {
              domain: d.domain,
              days: days,
              expiry_date: formatDate(expires),
              date: formatDate(expires),
              name: profile.full_name || "",
            },
            email: profile.email,
            channels: ["email"],
            audience: "jobseeker",
            fallbackTitle: subject,
            fallbackMessage: text,
          });
          templateSent = fan.email === "sent";
        } catch (_e) {
          templateSent = false;
        }

        if (!templateSent) {
          const { error: mailError } = await supabase.functions.invoke("email-api/send-email", {
            body: {
              to: profile.email,
              toName: profile.full_name || undefined,
              subject,
              htmlContent: html,
              textContent: text,
              audience: "jobseeker",
            },
          });
          if (mailError) {
            summary.failed += 1;
            summary.errors.push(`${d.domain} email: ${mailError.message}`);
            continue;
          }
        }
      }

      summary.sent += 1;
    }

    return json({ ok: true, ...summary });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[domain-renewal-reminders]", message);
    return json({ ok: false, ...summary, error: message }, 500);
  }
});
