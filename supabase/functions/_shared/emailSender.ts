// Single email entry point for the whole app (`/send-email`).
//
// Mail sirf owner ke connected mailbox se jata hai:
//   domain mailbox -> Outlook -> Gmail, aur wahi set jis side ka email hai
//   (job seeker / employer). Koi third-party sender fallback nahi hai.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  injectSocialRow,
  injectBrandHeader,
  loadSocialLinks,
  injectFooterInfo,
  loadFooterInfo,
  injectContactLink,
  buildBrandedEmail,
  SOCIAL_ROW_MARKER_START,
  FOOTER_INFO_MARKER_START,
  CONTACT_LINK_MARKER_START,
  type SocialMap,
  type FooterBrandInfo,
  type EmailBranding,
  type SocialPlatform,
} from "./engagementEmailTemplates.ts";
import { CANONICAL_DOMAIN } from './domain.ts';
import { sendWebsiteEmail } from './websiteEmailSender.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Cache the social map + footer brand info briefly for warm invocations.
// Keep TTL short so admin updates show up in outgoing emails almost immediately.
let cachedFooter: { map: SocialMap; info: FooterBrandInfo; branding: EmailBranding; ts: number } | null = null;
const FOOTER_TTL_MS = 30 * 1000;

function serviceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key);
}

async function getFooterData(): Promise<{ map: SocialMap; info: FooterBrandInfo; branding: EmailBranding }> {
  if (cachedFooter && Date.now() - cachedFooter.ts < FOOTER_TTL_MS) {
    return { map: cachedFooter.map, info: cachedFooter.info, branding: cachedFooter.branding };
  }
  try {
    const sb = serviceClient();
    if (!sb) {
      return { map: {}, info: { location: 'Ahmedabad, Gujarat', udyam: 'UDYAM-GJ-18-0022888', domain: CANONICAL_DOMAIN, contactEmail: '' }, branding: {} };
    }
    const [map, info, brandResult, emailSettingsResult] = await Promise.all([
      loadSocialLinks(sb),
      loadFooterInfo(sb),
      sb.rpc('get_brand_assets'),
      sb.from('app_settings').select('setting_key, setting_value').in('setting_key', [
        'email_social_icon_instagram', 'email_social_icon_youtube', 'email_social_icon_telegram',
        'email_social_icon_twitter', 'email_social_icon_facebook', 'email_social_icon_linkedin',
        'email_social_icon_whatsapp',
        'email_header_image',
      ]),
    ]);
    const assets = brandResult.data && typeof brandResult.data === 'object' ? brandResult.data as Record<string, unknown> : {};
    const settings = Object.fromEntries((emailSettingsResult.data || []).map((row: any) => [row.setting_key, row.setting_value || '']));
    const socialIconUrls: Partial<Record<SocialPlatform, string>> = {};
    for (const platform of ['instagram', 'youtube', 'telegram', 'twitter', 'facebook', 'linkedin', 'whatsapp'] as SocialPlatform[]) {
      const value = settings[`email_social_icon_${platform}`];
      if (typeof value === 'string' && value.trim()) socialIconUrls[platform] = value.trim();
    }
    const branding: EmailBranding = {
      brandName: typeof assets.brand_name === 'string' ? assets.brand_name : 'Workly India',
      tagline: typeof assets.brand_tagline === 'string' ? assets.brand_tagline : 'Find. Work. Grow.',
      logoUrl: typeof assets.logo_url === 'string' ? assets.logo_url : '',
      headerEnabled: true,
      headerImageUrl: typeof settings.email_header_image === 'string' ? settings.email_header_image.trim() : '',
      primaryColor: typeof assets.primary_color === 'string' ? assets.primary_color : '#3B5CE4',
      secondaryColor: typeof assets.secondary_color === 'string' ? assets.secondary_color : '#0DB17E',
      socialIconUrls,
    };
    cachedFooter = { map, info, branding, ts: Date.now() };
    return { map, info, branding };
  } catch (e) {
    console.warn("[send-email] getFooterData failed:", e);
    return { map: {}, info: { location: 'Ahmedabad, Gujarat', udyam: 'UDYAM-GJ-18-0022888', domain: CANONICAL_DOMAIN, contactEmail: '' }, branding: {} };
  }
}

/**
 * Resolve the real display name for a recipient:
 *  - Employer / company account  -> company_name
 *  - Job seeker account          -> profile full_name
 * Falls back to whatever the caller passed (or a neutral greeting).
 */
function looksLikePlaceholderName(name: string | undefined | null, email: string): boolean {
  if (!name) return true;
  const n = name.trim().toLowerCase();
  if (!n) return true;
  const local = (email || '').split('@')[0].toLowerCase();
  return n === local || n === (email || '').toLowerCase() || ['user', 'friend', 'there', 'customer'].includes(n);
}

/** Recipient ke hisaab se audience: employer account -> employer, warna jobseeker. */
async function resolveAudience(to: string, given?: string): Promise<'jobseeker' | 'employer' | null> {
  if (given === 'employer' || given === 'jobseeker') return given;
  try {
    const sb = serviceClient();
    if (!sb || !to) return null;
    const { data: profile } = await sb.from('profiles').select('id').ilike('email', to).maybeSingle();
    if (profile) return 'jobseeker';
    const { data: company } = await sb.from('companies').select('id').ilike('email', to).maybeSingle();
    if (company) return 'employer';
  } catch (e) {
    console.warn('[send-email] resolveAudience failed:', e);
  }
  return null;
}

async function resolveRecipientName(to: string, toName?: string): Promise<string> {
  const fallback = (toName && toName.trim()) || (to ? to.split('@')[0] : 'there');
  try {
    if (!to || !looksLikePlaceholderName(toName, to)) return fallback;
    const sb = serviceClient();
    if (!sb) return fallback;

    // Personal profile name first — a job seeker must never be greeted with a
    // company name just because the same address also owns a company account.
    const { data: profile } = await sb
      .from('profiles')
      .select('full_name')
      .eq('email', to)
      .maybeSingle();
    if (profile?.full_name && String(profile.full_name).trim()) {
      return String(profile.full_name).trim();
    }

    const { data: company } = await sb
      .from('companies')
      .select('company_name')
      .eq('email', to)
      .maybeSingle();
    if (company?.company_name && String(company.company_name).trim()) {
      return String(company.company_name).trim();
    }
  } catch (e) {
    console.warn('[send-email] resolveRecipientName failed:', e);
  }
  return fallback;
}

/**
 * Har send ka record. Pehle ye events provider ke webhook se aate the; ab mail
 * humare apne mailbox se jata hai, isliye result yahin se log hota hai taaki
 * owner portal ki email history aur analytics chalti rahein.
 */
async function logOutboundEvent(args: {
  to: string;
  subject: string;
  audience: 'jobseeker' | 'employer' | null;
  ok: boolean;
  provider?: string;
  from?: string;
  messageId?: string;
  error?: string;
}) {
  try {
    const sb = serviceClient();
    if (!sb) return;
    let userId: string | null = null;
    if (args.audience === 'employer') {
      const { data } = await sb.from('companies').select('user_id').ilike('email', args.to).maybeSingle();
      userId = data?.user_id ?? null;
    } else {
      const { data } = await sb.from('profiles').select('user_id').ilike('email', args.to).maybeSingle();
      userId = data?.user_id ?? null;
    }
    await sb.from('email_outbound_events').insert({
      recipient_email: args.to,
      event_type: args.ok ? 'delivered' : 'error',
      subject: args.subject,
      message_id: args.messageId ?? null,
      bounce_reason: args.ok ? null : String(args.error || 'send failed').slice(0, 1000),
      user_id: userId,
      user_type: args.audience,
      raw_payload: { provider: args.provider ?? null, from: args.from ?? null },
      event_at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('[send-email] outbound event log failed (ignored):', e);
  }
}

export const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let recipient = '';
  let mailSubject = '';
  let audience: 'jobseeker' | 'employer' | null = null;

  try {
    const {
      to,
      toName,
      subject,
      htmlContent,
      textContent,
      senderName,
      // Owner-designed templates render their own greeting/heading — the shell
      // must not add a second one on top (preview === delivered email).
      templateMode,
      suppressGreeting,
      suppressTitle,
      // "jobseeker" | "employer" — picks the owner's mailbox set for that side.
      audience: audienceHint,
    } = await req.json();

    if (!to || !subject) throw new Error("Missing required fields: to or subject");

    recipient = String(to);
    mailSubject = String(subject);
    console.log(`Sending email to: ${to}, subject: ${subject}`);

    // Load social links + footer brand info once and ensure every outgoing
    // email shows the branded footer with up-to-date DB values.
    const { map: socialMap, info: footerInfo, branding } = await getFooterData();
    const displayName = await resolveRecipientName(to, toName);
    let finalHtml = typeof htmlContent === 'string' && htmlContent.trim()
      ? htmlContent
      : `<p>${typeof textContent === 'string' ? textContent : ''}</p>`;

    // Fix greetings that were rendered with an email prefix / placeholder name.
    const localPart = typeof to === "string" ? to.split("@")[0] : "";
    if (displayName && localPart) {
      finalHtml = finalHtml.replace(
        /(&gt;|>)(\s*Hi|\s*Hello|\s*Dear)\s+([^,<]{1,80}),/gi,
        (match: string, lead: string, hello: string, current: string) => {
          const cur = current.trim().toLowerCase();
          const isPlaceholder =
            cur === localPart.toLowerCase() ||
            cur === String(to).toLowerCase() ||
            ["user", "friend", "there", "customer"].includes(cur);
          return isPlaceholder ? `${lead}${hello} ${displayName},` : match;
        }
      );
    }

    if (finalHtml.includes(SOCIAL_ROW_MARKER_START)) {
      // Template-rendered email — re-inject populated icons + fresh footer info
      finalHtml = injectSocialRow(finalHtml, socialMap, branding.socialIconUrls);
      finalHtml = injectBrandHeader(finalHtml, branding);
      if (finalHtml.includes(FOOTER_INFO_MARKER_START)) {
        finalHtml = injectFooterInfo(finalHtml, senderName || "Workly India", footerInfo);
      }
      if (finalHtml.includes(CONTACT_LINK_MARKER_START)) {
        finalHtml = injectContactLink(finalHtml, footerInfo.contactEmail);
      }
    } else {
      // Legacy / raw HTML caller — wrap in branded shell so footer + social
      // icons are guaranteed (single visual identity across every email).
      // Detect a greeting / heading the caller already rendered, so the shell
      // never duplicates it (this is what made delivered mail differ from the
      // owner-portal preview).
      const plain = String(finalHtml)
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
      const isCompleteTemplate = templateMode === 'complete';
      const hasOwnGreeting =
        isCompleteTemplate ||
        suppressGreeting === true ||
        /^(hi|hello|hey|dear|namaste)\b[^.!?]{0,60}[,:]/i.test(plain);
      const subjectPlain = String(subject || "").replace(/\s+/g, " ").trim();
      const hasOwnTitle =
        isCompleteTemplate ||
        suppressTitle === true ||
        (subjectPlain.length > 3 && plain.toLowerCase().includes(subjectPlain.toLowerCase()));

      finalHtml = buildBrandedEmail({
        recipientName: displayName,
        title: subject,
        bodyHtml: finalHtml,
        socialMap,
        showGreeting: !hasOwnGreeting,
        showTitle: !hasOwnTitle,
      });
      finalHtml = injectSocialRow(finalHtml, socialMap, branding.socialIconUrls);
      finalHtml = injectBrandHeader(finalHtml, branding);
      finalHtml = injectFooterInfo(finalHtml, senderName || "Workly India", footerInfo);
      finalHtml = injectContactLink(finalHtml, footerInfo.contactEmail);
    }

    // Only path: the mailbox the owner connected — domain email first, then
    // Outlook, then Gmail, inside that audience's own mailbox set.
    audience = await resolveAudience(String(to), audienceHint);
    const mailboxErrors: string[] = [];
    const result = await sendWebsiteEmail({
      to,
      toName: displayName,
      subject,
      html: finalHtml,
      text: textContent,
      senderName: senderName || "Workly India",
      audience,
    }, mailboxErrors);

    if (!result) {
      const sideLabel = audience === 'employer' ? 'employer' : audience === 'jobseeker' ? 'job seeker' : 'default';
      const detail = mailboxErrors.length ? ` Mailbox error: ${mailboxErrors.join(' | ')}` : '';
      throw new Error(
        `No working mailbox for the ${sideLabel} side. Connect or fix the domain email / Outlook / Gmail mailbox for this side.${detail}`
      );
    }

    console.log(`Email sent via ${result.provider} (${result.from}) to: ${to}`);
    await logOutboundEvent({
      to: recipient,
      subject: mailSubject,
      audience,
      ok: true,
      provider: result.provider,
      from: result.from,
      messageId: result.messageId,
    });

    return new Response(
      JSON.stringify({ success: true, messageId: result.messageId, provider: result.provider, from: result.from }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Send email error:", errorMessage);
    if (recipient) {
      await logOutboundEvent({ to: recipient, subject: mailSubject, audience, ok: false, error: errorMessage });
    }
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};
