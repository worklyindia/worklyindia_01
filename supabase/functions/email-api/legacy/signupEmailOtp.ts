import { istStampParts } from "../../_shared/emailFormat.ts";
// Signup email OTP: sends a 6-digit code before an account is created.
// Job Seeker + AI signups go from the Job Seeker mailbox, Employer signups
// from the Employer mailbox (Email Template settings).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { escapeHtmlAttribute, renderEmailTemplateHtml } from "../../_shared/templateHtml.ts";
import { AUTH_OTP_EXPIRY_SECONDS, authOtpExpiresAt, renderAuthEmail } from "../../_shared/authEmailTemplates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EXPIRY_MIN = AUTH_OTP_EXPIRY_SECONDS / 60;
const COOLDOWN_SEC = 60;
const MAX_ATTEMPTS = 5;
type Page = "jobseeker" | "employer" | "ai";
const PAGES: Page[] = ["jobseeker", "employer", "ai"];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

async function sha256(v: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function otpHtml(name: string, code: string) {
  return renderAuthEmail({ name, plan: {
    to: '', templateKey: 'email_verification', otp: code,
    link: '', tokenHash: '', newEmail: '', oldEmail: '',
  } }).html;
}

// Owner-editable template (Email Templates → Job Seekers / Employers → Signup OTP).
function fill(text: string | null | undefined, values: Record<string, string>, html = false) {
  let out = String(text || "");
  for (const [k, v] of Object.entries(values)) {
    out = out.replace(new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, "gi"), html ? esc(v) : v);
  }
  return out.replace(/\{\{\s*[\w.]+\s*\}\}/g, "").trim();
}

async function loadSignupTemplate(sb: any, audience: string) {
  const key = audience === "employer" ? "employer_signup_otp" : "jobseeker_signup_otp";
  const { data } = await sb.from("email_lifecycle_templates").select("*").eq("event_type", key).maybeSingle();
  return data && data.enabled !== false ? data : null;
}

export async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(url, key);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid request" }, 400); }
  const action = String(body?.action || "");
  const page = String(body?.page || "") as Page;
  const email = String(body?.email || "").trim().toLowerCase();
  if (!PAGES.includes(page)) return json({ error: "Invalid page" }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 255) {
    return json({ error: "Enter a valid email" }, 400);
  }
  const audience = page === "employer" ? "employer" : "jobseeker";

  if (action === "send") {
    const { data: setting } = await sb.from("app_settings").select("setting_value")
      .eq("setting_key", `signup_email_otp_${page}`).maybeSingle();
    if (setting?.setting_value !== "true") return json({ error: "Email OTP is off for this page" }, 400);

    const { data: last } = await sb.from("signup_email_otps").select("created_at")
      .ilike("email", email).eq("audience", page).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (last) {
      const wait = COOLDOWN_SEC - Math.floor((Date.now() - new Date(last.created_at).getTime()) / 1000);
      if (wait > 0) return json({ error: `Please wait ${wait}s before resending`, retryAfter: wait }, 429);
    }

    const code = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
    await sb.from("signup_email_otps").delete().ilike("email", email).eq("audience", page);
    await sb.from("signup_email_otps").insert({
      email, audience: page, code_hash: await sha256(`${email}:${code}`),
      expires_at: new Date(authOtpExpiresAt(Date.now())).toISOString(),
    });

    const name = String(body?.name || "").slice(0, 100);
    const tpl = await loadSignupTemplate(sb, audience);
    const now = new Date();
    const vals = {
      name: name || "there", otp: code, email, expiry_minutes: String(EXPIRY_MIN),
      date: istStampParts(now).date,
      time: istStampParts(now).time,
    };
    const tplImage = tpl?.image_url
      ? `<p style="margin:0 0 20px;text-align:center;"><img src="${escapeHtmlAttribute(tpl.image_url)}" alt="" style="display:block;max-width:100%;height:auto;margin:0 auto;border:0;" /></p>` : "";
    const subject = fill(tpl?.subject, vals) || `${code} is your Workly India verification code`;
    const htmlContent = `${tplImage}${otpHtml(name, code)}`;
    const res = await fetch(`${url}/functions/v1/email-api/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        to: email, toName: name || email.split("@")[0],
        subject,
        senderName: "Workly India", audience,
        htmlContent, templateMode: "complete",
        suppressGreeting: true, suppressTitle: true,
        textContent: `Your Workly India verification code is ${code}. It expires in ${EXPIRY_MIN} minutes.`,
      }),
    });
    const out = await res.json().catch(() => ({}));
    if (!out?.success) {
      console.error("[signup-email-otp] send failed", out);
      return json({ error: "Could not send the code. Please try again later." }, 502);
    }
    return json({ success: true, cooldown: COOLDOWN_SEC });
  }

  if (action === "verify") {
    const code = String(body?.code || "").replace(/\D/g, "");
    if (code.length !== 6) return json({ error: "Enter the 6-digit code", verified: false }, 400);
    const { data: row } = await sb.from("signup_email_otps").select("*")
      .ilike("email", email).eq("audience", page).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!row) return json({ error: "Please request a new code", verified: false }, 400);
    if (new Date(row.expires_at).getTime() < Date.now()) return json({ error: "Code expired. Please resend.", verified: false }, 400);
    if (row.attempts >= MAX_ATTEMPTS) return json({ error: "Too many tries. Please resend.", verified: false }, 400);
    if (row.code_hash !== (await sha256(`${email}:${code}`))) {
      await sb.from("signup_email_otps").update({ attempts: row.attempts + 1 }).eq("id", row.id);
      return json({ error: "Wrong code", verified: false }, 400);
    }
    await sb.from("signup_email_otps").update({ verified: true }).eq("id", row.id);
    return json({ verified: true });
  }

  return json({ error: "Unknown action" }, 400);
}
