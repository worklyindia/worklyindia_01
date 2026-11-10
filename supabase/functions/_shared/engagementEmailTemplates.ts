import { BRAND_CONFIG } from './brandConfig.ts';
import { CANONICAL_DOMAIN, WEBSITE_DOMAIN } from './domain.ts';

// ============================================================
// Mobile-friendly email templates for AI re-engagement
// AI picks the right template_style per intent / message tone.
// All templates are inline-CSS, max-width 600px, mobile-first.
// ============================================================

export type TemplateStyle =
  | 'ai_custom'       // AI generates the entire HTML body itself (most flexible — every email unique)
  | 'hero_cta'        // Big colored hero header + CTA button (announcements, free trial, big nudges)
  | 'minimal_card'    // Clean white card, soft border (profile complete, gentle nudges)
  | 'alert_banner'    // Yellow/orange banner top (urgent: new applicants waiting, action required)
  | 'list_update'     // Bulleted/numbered list style (job matches, multi-item updates)
  | 'plain_text'      // No HTML wrapper — just text-like (most personal, like a friend wrote it)
  | 'newsletter';     // Header image + sections (general re-engagement, monthly-feel)

interface TemplateInput {
  recipientName: string;
  subject: string;
  message: string;       // AI-generated body (may contain \n line breaks; HTML allowed minimally)
  ctaText?: string;
  ctaUrl?: string;
  brandName?: string;
  brandColor?: string;   // hex
  preheader?: string;    // hidden preview text
  htmlBody?: string;     // For ai_custom: full AI-generated inner HTML body (sanitized before render)
  socialMap?: SocialMap; // Optional — DB-loaded social URLs; missing platforms render greyed
}

// ---- Sanitize AI-generated HTML (strip scripts, event handlers, dangerous tags) ----
function sanitizeAiHtml(html: string): string {
  if (!html) return '';
  let cleaned = html;
  // Remove <script>, <style>, <iframe>, <object>, <embed>, <link>, <meta>, <form> tags + content
  cleaned = cleaned.replace(/<\s*(script|style|iframe|object|embed|link|meta|form|input|button)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '');
  cleaned = cleaned.replace(/<\s*(script|style|iframe|object|embed|link|meta|form|input|button)\b[^>]*\/?>/gi, '');
  // Remove on* event handlers (onclick, onload, onerror, etc.)
  cleaned = cleaned.replace(/\s*on[a-z]+\s*=\s*"[^"]*"/gi, '');
  cleaned = cleaned.replace(/\s*on[a-z]+\s*=\s*'[^']*'/gi, '');
  cleaned = cleaned.replace(/\s*on[a-z]+\s*=\s*[^\s>]+/gi, '');
  // Block javascript: and data:text/html in href/src
  cleaned = cleaned.replace(/(href|src)\s*=\s*"\s*javascript:[^"]*"/gi, '$1="#"');
  cleaned = cleaned.replace(/(href|src)\s*=\s*'\s*javascript:[^']*'/gi, "$1='#'");
  cleaned = cleaned.replace(/(href|src)\s*=\s*"\s*data:text\/html[^"]*"/gi, '$1="#"');
  // Strip <html>, <head>, <body> wrappers if AI included them — we add our own
  cleaned = cleaned.replace(/<\/?\s*(html|head|body|!doctype)[^>]*>/gi, '');
  // FORCE FULL-WIDTH on mobile: strip max-width / fixed-width / border-radius from inline styles
  // (These are the things that create the "nested card" look in Gmail mobile)
  cleaned = cleaned.replace(/max-width\s*:\s*[^;"']+;?/gi, '');
  cleaned = cleaned.replace(/border-radius\s*:\s*[^;"']+;?/gi, '');
  // Strip width="600" / width="500" etc. attributes on tables (keep only width="100%")
  cleaned = cleaned.replace(/\bwidth\s*=\s*"(?!100%)\d+%?"/gi, 'width="100%"');
  cleaned = cleaned.replace(/\bwidth\s*=\s*'(?!100%)\d+%?'/gi, "width='100%'");
  // Strip width:600px etc from inline styles (keep width:100%)
  cleaned = cleaned.replace(/width\s*:\s*\d+px\s*;?/gi, 'width:100%;');
  // PREVENT HORIZONTAL SCROLL: strip min-width (any value) — it forces content wider than viewport
  cleaned = cleaned.replace(/min-width\s*:\s*[^;"']+;?/gi, '');
  // Strip fixed pixel widths from divs/sections too (they cause overflow on narrow screens)
  cleaned = cleaned.replace(/\bwidth\s*=\s*"\d+"/gi, 'width="100%"');
  // Remove white-space:nowrap which forces lines wider than screen
  cleaned = cleaned.replace(/white-space\s*:\s*nowrap\s*;?/gi, '');
  // Cap horizontal padding so content doesn't overflow viewport on mobile
  cleaned = cleaned.replace(/padding-left\s*:\s*(\d+)px\s*;?/gi, (_m, px) => parseInt(px) > 24 ? 'padding-left:16px;' : _m);
  cleaned = cleaned.replace(/padding-right\s*:\s*(\d+)px\s*;?/gi, (_m, px) => parseInt(px) > 24 ? 'padding-right:16px;' : _m);
  return cleaned.trim();
}

const DEFAULT_BRAND = 'Workly India';
const DEFAULT_COLOR = '#4F46E5';
const SITE_URL = WEBSITE_DOMAIN;

// ===========================================================
// Social media row — single source of truth for ALL emails.
// PNG icons are served from the app asset CDN because Gmail mobile does not
// reliably render remote SVGs.
// Pass a socialMap loaded from contact_information.additional_info.
// If a platform's URL is missing, the icon shows greyed/non-clickable.
// ===========================================================

export type SocialPlatform = 'instagram' | 'youtube' | 'telegram' | 'twitter' | 'facebook' | 'linkedin' | 'whatsapp';
export type SocialMap = Partial<Record<SocialPlatform, string>>;
export type SocialIconMap = Partial<Record<SocialPlatform, string>>;

export interface EmailBranding {
  brandName?: string;
  tagline?: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  mascotUrl?: string;
  socialIconUrls?: SocialIconMap;
  /** Owner switch: false removes the branded name/logo block from every email. */
  headerEnabled?: boolean;
  /** Owner-uploaded email header image (app_settings.email_header_image). */
  headerImageUrl?: string;
}

const DEFAULT_SOCIAL_LINKS: SocialMap = { ...BRAND_CONFIG.socialLinks };

const SOCIAL_LABELS: Record<SocialPlatform, string> = {
  instagram: 'Instagram',
  youtube: 'YouTube',
  telegram: 'Telegram',
  twitter: 'X (Twitter)',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  whatsapp: 'WhatsApp',
};

const SOCIAL_ORDER: SocialPlatform[] = ['instagram', 'youtube', 'telegram', 'twitter', 'facebook', 'linkedin', 'whatsapp'];

// Stable marker so the unified send-email endpoint can re-inject populated icons even when
// callers render templates without passing socialMap.
export const SOCIAL_ROW_MARKER_START = '<!--__WORKLY_SOCIAL_ROW_START__-->';
export const SOCIAL_ROW_MARKER_END = '<!--__WORKLY_SOCIAL_ROW_END__-->';

const SOCIAL_ICON_PATHS: Record<SocialPlatform, string> = {
  instagram: '/__l5e/assets-v1/81cf78c9-fd84-4df8-be5e-21fe80146378/instagram-email-hd.png',
  youtube: '/__l5e/assets-v1/fb838b7c-3985-4fe1-89b1-bd5f22547d63/youtube-email-hd.png',
  telegram: '/__l5e/assets-v1/0ace6ead-8bf3-41e1-9dc4-f5be895e1c7a/telegram-email-hd.png',
  twitter: '/__l5e/assets-v1/ce14a984-771f-4cd1-9710-f656ac10a3be/x-email-hd.png',
  facebook: '/__l5e/assets-v1/9d99f6f8-670d-41c6-a8f5-2fa1196998c0/facebook-email-hd.png',
  linkedin: '/__l5e/assets-v1/a95b66e3-6810-4247-b297-1cd181f15acf/linkedin-email-hd.png',
  // Hosted on this project's asset CDN (absolute URL — the old EMAIL_ASSET_ORIGIN
  // belongs to the previous project and cannot serve it).
  whatsapp: 'https://id-preview--3ce79f9b-f6a2-4a09-b186-fd00524266d0.lovable.app/__l5e/assets-v1/5a252af7-2e9e-4b85-bc02-7d79c2e221bb/whatsapp-email-hd.png',
};
const EMAIL_ASSET_ORIGIN = 'https://id-preview--b9ded112-1190-4a4d-8689-7209cc25b712.lovable.app';
// Email clients cannot execute the website's JSON/Lottie animation. The GIF
// keeps the same motion in Gmail and other clients that support animated GIFs;
// clients without animation support display its first frame.
const DEFAULT_MASCOT_URL = 'https://jubwzelupbntbetpajqb.supabase.co/storage/v1/object/public/public-assets/notifications/workly-email-mascot-transparent.gif';

// Footer brand info (location/UDYAM/domain) is loaded from DB so admin
// edits in contact_information propagate to every email automatically.
export interface FooterBrandInfo {
  location: string;
  udyam: string;
  domain: string;
  contactEmail: string;
}
const DEFAULT_FOOTER_INFO: FooterBrandInfo = {
  location: 'Ahmedabad, Gujarat',
  udyam: 'UDYAM-GJ-18-0022888',
  domain: CANONICAL_DOMAIN,
  contactEmail: '',
};

export const FOOTER_INFO_MARKER_START = '<!--__WORKLY_FOOTER_INFO_START__-->';
export const FOOTER_INFO_MARKER_END = '<!--__WORKLY_FOOTER_INFO_END__-->';
export const CONTACT_LINK_MARKER_START = '<!--__WORKLY_CONTACT_LINK_START__-->';
export const CONTACT_LINK_MARKER_END = '<!--__WORKLY_CONTACT_LINK_END__-->';

/** Build the Contact Us link for the footer. Always opens the website's
 *  Contact Us page so the reader lands on the form, not a blank mail draft. */
export function contactLinkHtml(_contactEmail?: string): string {
  const href = `${SITE_URL}/contact-us`;
  return `${CONTACT_LINK_MARKER_START}<a href="${href}" target="_blank" rel="noopener noreferrer" style="color:#475569;text-decoration:none;margin:0 7px;">Contact Us</a>${CONTACT_LINK_MARKER_END}`;
}

/** Replace the Contact Us link in already-rendered HTML with one built from DB email. */
export function injectContactLink(html: string, contactEmail?: string): string {
  if (!html || !html.includes(CONTACT_LINK_MARKER_START)) return html;
  const fresh = contactLinkHtml(contactEmail);
  const re = new RegExp(
    `${CONTACT_LINK_MARKER_START.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}[\\s\\S]*?${CONTACT_LINK_MARKER_END.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}`,
    'g'
  );
  return html.replace(re, fresh);
}

/** Build a borderless row of official, high-resolution social logos. */
export function socialRowHtml(socialMap: SocialMap = {}, iconUrls: SocialIconMap = {}): string {
  const cells = SOCIAL_ORDER.map((p) => {
    const label = SOCIAL_LABELS[p];
    const url = socialMap[p];
    const hasValue = Boolean(url);
    const iconPath = SOCIAL_ICON_PATHS[p];
    const iconUrl = iconUrls[p] || (iconPath.startsWith('http') ? iconPath : `${EMAIL_ASSET_ORIGIN}${iconPath}`);
    const opacity = hasValue ? '1' : '0.38';
    const iconClass = p === 'twitter' ? 'social-icon social-icon-x' : 'social-icon';
    const icon = `<img src="${escapeHtml(iconUrl)}" width="36" height="36" alt="${label}" title="${label}" class="${iconClass}" style="display:block;width:36px;height:36px;border:0;outline:none;text-decoration:none;opacity:${opacity};object-fit:contain;background-color:transparent !important;background-image:none !important;border-radius:0;box-shadow:none;" />`;
    const inner = hasValue
      ? `<a href="${url}" target="_blank" rel="noopener noreferrer" style="display:block;text-decoration:none;border:0;" aria-label="${label}">${icon}</a>`
      : icon;
    return `<td width="42" align="center" valign="middle" bgcolor="transparent" style="width:42px;padding:0 3px;border:0;background-color:transparent !important;background-image:none !important;box-shadow:none;">${inner}</td>`;
  }).join('');
  return `${SOCIAL_ROW_MARKER_START}<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 18px;border-collapse:collapse;background:transparent;"><tr>${cells}</tr></table>${SOCIAL_ROW_MARKER_END}`;
}

/**
 * Replace the social row block in an already-rendered email HTML with a
 * freshly-built row using the supplied socialMap. Idempotent and safe to
 * call on HTML that doesn't contain the marker (returns input unchanged).
 */
export function injectSocialRow(html: string, socialMap: SocialMap, iconUrls: SocialIconMap = {}): string {
  if (!html || !html.includes(SOCIAL_ROW_MARKER_START)) return html;
  const fresh = socialRowHtml(socialMap, iconUrls);
  const re = new RegExp(
    `${SOCIAL_ROW_MARKER_START.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}[\\s\\S]*?${SOCIAL_ROW_MARKER_END.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}`,
    'g'
  );
  return html.replace(re, fresh);
}

/**
 * Load social links from contact_information table.
 * Looks for info_type='social' first, then falls back to info_type='general'.additional_info.social.
 * Owner edits these via the existing Contact Info Management page.
 */
export async function loadSocialLinks(supabase: any): Promise<SocialMap> {
  try {
    // PRIMARY source: site_settings.social_links — this is where the owner
    // saves social URLs in the Owner Portal (same source the website footer uses).
    let raw: Record<string, any> = {};
    try {
      const { data: siteRow } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'social_links')
        .maybeSingle();
      if (siteRow?.value && typeof siteRow.value === 'object') raw = { ...siteRow.value };
    } catch { /* ignore, fall back below */ }

    const { data } = await supabase
      .from('contact_information')
      .select('info_type, additional_info')
      .in('info_type', ['social', 'general'])
      .eq('is_active', true);

    const rows = data || [];
    const socialRow = rows.find((r: any) => r.info_type === 'social');
    const generalRow = rows.find((r: any) => r.info_type === 'general');

    // Fallback/merge: dedicated 'social' row > general.additional_info.social > general.additional_info
    const fallbackRaw = socialRow?.additional_info
      || generalRow?.additional_info?.social
      || generalRow?.additional_info
      || {};
    raw = { ...fallbackRaw, ...raw };


    // Start EMPTY — only owner-saved links from contact_information should appear.
    // If owner hasn't saved a platform, the icon renders greyed/non-clickable
    // instead of silently linking to a hardcoded default URL.
    const map: SocialMap = {};
    for (const p of SOCIAL_ORDER) {
      const aliases = p === 'twitter'
        ? ['twitter', 'x', 'twitter_url', 'x_url', 'twitter_link', 'x_link']
        : [p, `${p}_url`, `${p}_link`, p.toUpperCase()];
      const v = aliases.map((key) => raw[key]).find((value) => typeof value === 'string' && value.trim());
      if (typeof v === 'string' && v.trim()) map[p] = normalizeUrl(v.trim(), p);
    }
    return map;
  } catch (e) {
    console.warn('[engagementEmailTemplates] loadSocialLinks failed:', e);
    // Never fall back to hardcoded links — only owner-saved links may appear.
    return {};
  }
}

function normalizeUrl(url: string, platform: SocialPlatform): string {
  if (/^https?:\/\//i.test(url)) return url;
  // WhatsApp: owner may save a plain phone number — turn it into a wa.me chat link.
  if (platform === 'whatsapp') {
    const digits = url.replace(/[^\d]/g, '');
    if (digits) return `https://wa.me/${digits}`;
  }
  if (platform === 'linkedin' && !/^@/.test(url)) return `https://${url.replace(/^\/+/, '')}`;
  if (/^@/.test(url)) {
    const handle = url.slice(1);
    if (platform === 'instagram') return `https://www.instagram.com/${handle}`;
    if (platform === 'youtube') return `https://youtube.com/${handle}`;
    if (platform === 'telegram') return `https://t.me/${handle}`;
    if (platform === 'facebook') return `https://www.facebook.com/${handle}`;
    return `https://x.com/${handle}`;
  }
  return `https://${url}`;
}

/**
 * Load footer brand info (location, udyam, domain) from contact_information.
 * Falls back to defaults if missing. Admin can update these via the
 * Contact Info Management page (general row > additional_info).
 */
export async function loadFooterInfo(supabase: any): Promise<FooterBrandInfo> {
  try {
    // Owner-saved canonical domain (Owner Portal → Domain Settings) wins over everything.
    let ownerDomain = '';
    try {
      const { data: d } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', 'canonical_domain')
        .maybeSingle();
      if (d?.setting_value && typeof d.setting_value === 'string') {
        ownerDomain = d.setting_value.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
      }
    } catch { /* ignore */ }

    // Load all active contact rows so we can pick the best email (contact > support > general).
    const { data } = await supabase
      .from('contact_information')
      .select('info_type, address, email, additional_info')
      .eq('is_active', true);
    const rows: any[] = data || [];
    const generalRow = rows.find((r) => r.info_type === 'general') || {};
    const extra = (generalRow.additional_info || {}) as Record<string, any>;

    // Pick contact email: prefer 'contact' row, then 'support', then 'general', then any row with email.
    const emailPriority = ['contact', 'support', 'general'];
    let pickedEmail = '';
    for (const t of emailPriority) {
      const r = rows.find((x) => x.info_type === t && typeof x.email === 'string' && x.email.trim());
      if (r) { pickedEmail = r.email.trim(); break; }
    }
    if (!pickedEmail) {
      const any = rows.find((x) => typeof x.email === 'string' && x.email.trim());
      if (any) pickedEmail = any.email.trim();
    }

    return {
      location: pickFirstText(generalRow.address, extra.location, extra.footer_location, DEFAULT_FOOTER_INFO.location),
      udyam: pickFirstText(extra.udyam, extra.document_number, extra.udyam_registration, DEFAULT_FOOTER_INFO.udyam),
      domain: pickFirstText(ownerDomain, extra.domain, extra.website, extra.site_url, DEFAULT_FOOTER_INFO.domain),
      contactEmail: pickedEmail,
    };
  } catch (e) {
    console.warn('[engagementEmailTemplates] loadFooterInfo failed:', e);
    return DEFAULT_FOOTER_INFO;
  }
}

/** Build the dynamic footer info block HTML (year/location/udyam/domain). */
export function footerInfoHtml(brand: string, info: FooterBrandInfo = DEFAULT_FOOTER_INFO): string {
  const yr = new Date().getFullYear();
  // Address line intentionally omitted — only copyright, registration and domain.
  return `${FOOTER_INFO_MARKER_START}<div class="e-fine" style="font-size:11px;color:#6b7280;margin-top:18px;line-height:1.7;">
        © ${yr} ${escapeHtml(brand)}<br>
        ${escapeHtml(info.udyam)} · <a href="https://${escapeHtml(info.domain)}" style="color:#6b7280;text-decoration:none;">${escapeHtml(info.domain)}</a>
      </div>${FOOTER_INFO_MARKER_END}`;
}

function pickFirstText(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

/** Replace the footer info block in already-rendered HTML. */
export function injectFooterInfo(html: string, brand: string, info: FooterBrandInfo): string {
  if (!html || !html.includes(FOOTER_INFO_MARKER_START)) return html;
  const fresh = footerInfoHtml(brand, info);
  const re = new RegExp(
    `${FOOTER_INFO_MARKER_START.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}[\\s\\S]*?${FOOTER_INFO_MARKER_END.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}`,
    'g'
  );
  return html.replace(re, fresh);
}

function escapeHtml(value: unknown): string {
  const s = typeof value === 'string' ? value : String(value ?? '');
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function nl2br(s: string): string {
  return escapeHtml(s).replace(/\n/g, '<br>');
}

function preheader(text: string): string {
  return `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#fff;opacity:0;">${escapeHtml(text)}</div>`;
}

export const BRAND_HEADER_MARKER_START = '<!--__WORKLY_BRAND_HEADER_START__-->';
export const BRAND_HEADER_MARKER_END = '<!--__WORKLY_BRAND_HEADER_END__-->';

// Owner-supplied transparent Workly India logo shown at the top of every email.
const EMAIL_HEADER_LOGO_URL = 'https://jubwzelupbntbetpajqb.supabase.co/storage/v1/object/public/brand-assets/site/1769cddb-7244-4b4b-a86f-e0ca3bc028db/email_header_image-1790185045198.png';
export function brandHeader(branding: EmailBranding = {}): string {
  const src = escapeHtml(branding.headerImageUrl || EMAIL_HEADER_LOGO_URL);
  return `${BRAND_HEADER_MARKER_START}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:transparent;"><tr><td align="center" style="padding:20px 16px 8px;background:transparent;"><img src="${src}" width="300" alt="Workly India" style="display:block;width:300px;max-width:80%;height:auto;border:0;outline:none;background:transparent !important;margin:0 auto;" /></td></tr></table>${BRAND_HEADER_MARKER_END}`;
}

export function injectBrandHeader(html: string, branding: EmailBranding): string {
  if (!html || !html.includes(BRAND_HEADER_MARKER_START)) return html;
  const re = new RegExp(
    `${BRAND_HEADER_MARKER_START.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}[\\s\\S]*?${BRAND_HEADER_MARKER_END.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}`,
    'g'
  );
  return html.replace(re, brandHeader(branding));
}

// (Job Seeker / Employer buttons removed by owner request.)

// Full footer with social row, link directory, and compliance.
// socialMap is loaded from contact_information; if a platform's link is missing,
// the icon renders greyed/non-clickable (still visible).
function footer(brand: string, socialMap: SocialMap = {}, info: FooterBrandInfo = DEFAULT_FOOTER_INFO): string {
  return `
    <div class="e-footer" style="border-top:1px solid #e5e9f2;padding:26px 20px 22px;text-align:center;color:#475569;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
      <div class="e-foot-title" style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:14px;">Connect with us</div>
      ${socialRowHtml(socialMap)}
      <div class="foot-links" style="font-size:12px;line-height:2;color:#475569;">
        <a href="${SITE_URL}/about-us" style="color:#475569;text-decoration:none;margin:0 7px;">About Us</a>
        <a href="${SITE_URL}/how-it-works" style="color:#475569;text-decoration:none;margin:0 7px;">How It Works</a>
        <a href="${SITE_URL}/privacy" style="color:#475569;text-decoration:none;margin:0 7px;">Privacy Policy</a><br>
        <a href="${SITE_URL}/mission" style="color:#475569;text-decoration:none;margin:0 7px;">Mission</a>
        <a href="${SITE_URL}/vision" style="color:#475569;text-decoration:none;margin:0 7px;">Vision</a>
        <a href="${SITE_URL}/why-choose-us" style="color:#475569;text-decoration:none;margin:0 7px;">Why Choose ${escapeHtml(brand)}</a><br>
        <a href="${SITE_URL}/refund-policy" style="color:#475569;text-decoration:none;margin:0 7px;">Refund &amp; Cancellation</a>
        <a href="${SITE_URL}/terms-conditions" style="color:#475569;text-decoration:none;margin:0 7px;">Terms &amp; Conditions</a><br>
        ${contactLinkHtml(info.contactEmail)}
        <a href="${SITE_URL}/points-policy" style="color:#475569;text-decoration:none;margin:0 7px;">Points Policy</a>
        <a href="${SITE_URL}/faq" style="color:#475569;text-decoration:none;margin:0 7px;">FAQ</a><br>
        <a href="${SITE_URL}/blog" style="color:#475569;text-decoration:none;margin:0 7px;">Blog</a>
        <a href="${SITE_URL}/disclaimer" style="color:#475569;text-decoration:none;margin:0 7px;">Disclaimer</a>
      </div>
      ${footerInfoHtml(brand, info)}
    </div>`;
}

function wrap(inner: string, preheaderText: string, brand?: string, socialMap: SocialMap = {}): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformat"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title></title>
<style>
  :root { color-scheme: light; supported-color-schemes: light; }
  body, table { margin:0 !important; padding:0 !important; }
  html, body, .body, .email-wrapper, .email-card, .e-body { background-color:#ffffff !important; color:#374151; }
  td { margin:0 !important; }
  html, body { width:100% !important; max-width:100% !important; overflow-x:hidden !important; }
  table { border-collapse:collapse !important; max-width:100% !important; }
  img { display:block; border:0; outline:none; text-decoration:none; max-width:100%; height:auto; }
  p, div, td, a, span, li, h1, h2, h3 { word-wrap:break-word !important; overflow-wrap:break-word !important; word-break:break-word !important; }
  *, *::before, *::after { box-sizing:border-box !important; }
  blockquote, pre, code, h4, h5, h6 { word-wrap:break-word !important; overflow-wrap:break-word !important; word-break:break-word !important; white-space:normal !important; max-width:100% !important; }
  blockquote { margin:0 0 16px !important; padding:12px 16px !important; }
  @media only screen and (max-width: 600px) {
    .email-wrapper, .email-card { width:100% !important; max-width:100% !important; }
    .email-card { border-radius:0 !important; }
    .full-bleed { border-radius:0 !important; }
    .btn-stack { width:100% !important; }
    .foot-links a { display:inline-block; margin:4px 6px !important; }
  }
  /* Keep a dependable light canvas. Mail apps may use dark chrome around it,
     but cannot turn dark text invisible or invert only part of a content card. */
  @media (prefers-color-scheme: dark) {
    html, body, .body, .email-wrapper, .email-card, .e-body { background-color:#ffffff !important; color:#374151 !important; }
  }
</style>
</head>
<body class="body" bgcolor="#ffffff" style="margin:0;padding:0;background-color:#ffffff;color:#374151;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;width:100%;max-width:100%;overflow-x:hidden;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;color-scheme:light;">
${preheader(preheaderText)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" class="email-wrapper" style="width:100%;border-collapse:collapse;margin:0;padding:0;background-color:#ffffff;color:#374151;">
  <tr><td align="center" valign="top" style="padding:0;margin:0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" class="email-card" style="max-width:100%;width:100%;border-collapse:collapse;margin:0;background-color:#ffffff;color:#374151;">
       <tr><td style="padding:0;margin:0;">${brandHeader()}</td></tr>
      <tr><td class="e-body" bgcolor="#ffffff" style="padding:0;margin:0;background-color:#ffffff;color:#374151;">${inner}</td></tr>
      <tr><td style="padding:0;margin:0;">${footer(brand || DEFAULT_BRAND, socialMap)}</td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

// ---- Template 1: Hero CTA ----
function heroCta(t: TemplateInput): string {
  const color = t.brandColor || DEFAULT_COLOR;
  const inner = `
    <div style="background:${color};padding:32px 24px;text-align:center;color:#fff;">
      <div style="font-size:13px;letter-spacing:1px;text-transform:uppercase;opacity:.85;">${escapeHtml(t.brandName || DEFAULT_BRAND)}</div>
      <h1 style="margin:8px 0 0;font-size:24px;line-height:1.3;">${escapeHtml(t.subject)}</h1>
    </div>
    <div style="padding:28px 24px;color:#333;font-size:16px;line-height:1.6;">
      <p style="margin:0 0 18px;">Hi ${escapeHtml(t.recipientName)},</p>
      <div style="margin:0 0 24px;">${nl2br(t.message)}</div>
      ${t.ctaUrl ? `<div style="text-align:center;margin:28px 0 8px;">
        <a href="${t.ctaUrl}" style="background:${color};color:#fff;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:600;display:inline-block;font-size:16px;">${escapeHtml(t.ctaText || 'Get started')}</a>
      </div>` : ''}
      
    </div>`;
  return wrap(inner, t.preheader || t.subject, t.brandName, t.socialMap);
}

// ---- Template 2: Minimal Card ----
function minimalCard(t: TemplateInput): string {
  const color = t.brandColor || DEFAULT_COLOR;
  const inner = `
    <div style="padding:32px 24px;color:#222;font-size:16px;line-height:1.6;">
      <div style="font-size:14px;color:${color};font-weight:600;margin-bottom:8px;">${escapeHtml(t.brandName || DEFAULT_BRAND)}</div>
      <h2 style="margin:0 0 16px;font-size:20px;color:#111;">${escapeHtml(t.subject)}</h2>
      <p style="margin:0 0 14px;color:#444;">Hi ${escapeHtml(t.recipientName)},</p>
      <div style="margin:0 0 20px;color:#555;">${nl2br(t.message)}</div>
      ${t.ctaUrl ? `<a href="${t.ctaUrl}" style="color:${color};font-weight:600;text-decoration:none;border-bottom:2px solid ${color};padding-bottom:2px;">${escapeHtml(t.ctaText || 'Continue →')}</a>` : ''}
      
    </div>`;
  return wrap(inner, t.preheader || t.subject, t.brandName, t.socialMap);
}

// ---- Template 3: Alert Banner ----
function alertBanner(t: TemplateInput): string {
  const color = t.brandColor || DEFAULT_COLOR;
  const inner = `
    <div style="background:#FEF3C7;border-left:4px solid #F59E0B;padding:16px 20px;color:#78350F;font-size:14px;font-weight:600;">
      ⚡ Action needed
    </div>
    <div style="padding:28px 24px;color:#333;font-size:16px;line-height:1.6;">
      <h2 style="margin:0 0 14px;font-size:20px;color:#111;">${escapeHtml(t.subject)}</h2>
      <p style="margin:0 0 14px;">Hi ${escapeHtml(t.recipientName)},</p>
      <div style="margin:0 0 22px;">${nl2br(t.message)}</div>
      ${t.ctaUrl ? `<div style="text-align:left;margin:24px 0 8px;">
        <a href="${t.ctaUrl}" style="background:${color};color:#fff;padding:12px 22px;text-decoration:none;border-radius:6px;font-weight:600;display:inline-block;">${escapeHtml(t.ctaText || 'Take action')}</a>
      </div>` : ''}
      
    </div>`;
  return wrap(inner, t.preheader || t.subject, t.brandName, t.socialMap);
}

// ---- Template 4: List Update ----
function listUpdate(t: TemplateInput): string {
  const color = t.brandColor || DEFAULT_COLOR;
  // Auto-detect bullet lines (lines starting with - or • or numbers)
  const lines = t.message.split('\n');
  const rendered = lines.map(l => {
    const trimmed = l.trim();
    if (/^[-•*]\s+/.test(trimmed)) {
      return `<li style="margin:6px 0;color:#444;">${escapeHtml(trimmed.replace(/^[-•*]\s+/, ''))}</li>`;
    }
    if (/^\d+[\.\)]\s+/.test(trimmed)) {
      return `<li style="margin:6px 0;color:#444;">${escapeHtml(trimmed.replace(/^\d+[\.\)]\s+/, ''))}</li>`;
    }
    return trimmed ? `<p style="margin:8px 0;color:#444;">${escapeHtml(trimmed)}</p>` : '';
  }).join('');
  const hasList = /<li/.test(rendered);
  const body = hasList ? `<ul style="padding-left:20px;margin:0 0 20px;">${rendered}</ul>` : `<div style="margin:0 0 20px;">${rendered}</div>`;

  const inner = `
    <div style="padding:28px 24px;color:#333;font-size:16px;line-height:1.6;">
      <div style="font-size:13px;color:${color};font-weight:600;letter-spacing:.5px;text-transform:uppercase;margin-bottom:6px;">${escapeHtml(t.brandName || DEFAULT_BRAND)}</div>
      <h2 style="margin:0 0 16px;font-size:20px;color:#111;">${escapeHtml(t.subject)}</h2>
      <p style="margin:0 0 14px;">Hi ${escapeHtml(t.recipientName)},</p>
      ${body}
      ${t.ctaUrl ? `<div style="text-align:center;margin:24px 0 8px;">
        <a href="${t.ctaUrl}" style="background:${color};color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:600;display:inline-block;">${escapeHtml(t.ctaText || 'View all')}</a>
      </div>` : ''}
      
    </div>`;
  return wrap(inner, t.preheader || t.subject, t.brandName, t.socialMap);
}

// ---- Template 5: Plain Text (most personal, looks like a 1:1 email) ----
function plainText(t: TemplateInput): string {
  const color = t.brandColor || DEFAULT_COLOR;
  const inner = `
    <div style="padding:28px 24px;color:#222;font-size:16px;line-height:1.7;font-family:Georgia,'Times New Roman',serif;">
      <p style="margin:0 0 16px;">Hi ${escapeHtml(t.recipientName)},</p>
      <div style="margin:0 0 18px;color:#333;">${nl2br(t.message)}</div>
      ${t.ctaUrl ? `<p style="margin:18px 0;"><a href="${t.ctaUrl}" style="color:${color};font-weight:600;">${escapeHtml(t.ctaText || t.ctaUrl)}</a></p>` : ''}
      <p style="margin:24px 0 0;color:#555;">— Team ${escapeHtml(t.brandName || DEFAULT_BRAND)}</p>
      
    </div>`;
  return wrap(inner, t.preheader || t.subject, t.brandName, t.socialMap);
}

// ---- Template 6: Newsletter ----
function newsletter(t: TemplateInput): string {
  const color = t.brandColor || DEFAULT_COLOR;
  const inner = `
    <div style="background:linear-gradient(135deg,${color},#7C3AED);padding:24px;text-align:center;color:#fff;">
      <div style="font-size:20px;font-weight:700;">${escapeHtml(t.brandName || DEFAULT_BRAND)}</div>
      <div style="font-size:12px;opacity:.85;margin-top:4px;">Your weekly update</div>
    </div>
    <div style="padding:28px 24px;color:#333;font-size:16px;line-height:1.6;">
      <h2 style="margin:0 0 12px;font-size:20px;color:#111;">${escapeHtml(t.subject)}</h2>
      <p style="margin:0 0 14px;">Hi ${escapeHtml(t.recipientName)},</p>
      <div style="background:#F9FAFB;border-radius:8px;padding:18px;margin:0 0 20px;color:#444;">${nl2br(t.message)}</div>
      ${t.ctaUrl ? `<div style="text-align:center;margin:20px 0 8px;">
        <a href="${t.ctaUrl}" style="background:${color};color:#fff;padding:13px 26px;text-decoration:none;border-radius:8px;font-weight:600;display:inline-block;">${escapeHtml(t.ctaText || 'Read more')}</a>
      </div>` : ''}
      
    </div>`;
  return wrap(inner, t.preheader || t.subject, t.brandName, t.socialMap);
}

// ---- Template 0: AI Custom — AI generates entire HTML body itself ----
function aiCustom(t: TemplateInput): string {
  const safeBody = sanitizeAiHtml(t.htmlBody || '');
  // If AI didn't return HTML, fall back to plain message wrapped in basic styling
  if (!safeBody) {
    return plainText(t);
  }
  // No extra wrapper — let the AI body sit edge-to-edge inside the email-card.
  // Footer gets its own padding so it doesn't touch the side.
  const inner = `${safeBody}`;
  return wrap(inner, t.preheader || t.subject, t.brandName, t.socialMap);
}

const RENDERERS: Record<TemplateStyle, (t: TemplateInput) => string> = {
  ai_custom: aiCustom,
  hero_cta: heroCta,
  minimal_card: minimalCard,
  alert_banner: alertBanner,
  list_update: listUpdate,
  plain_text: plainText,
  newsletter,
};

export function renderEmailTemplate(style: TemplateStyle, input: TemplateInput): string {
  const renderer = RENDERERS[style] || aiCustom;
  return renderer(input);
}

// AI guidance — describe each template so the AI can pick wisely
export const TEMPLATE_GUIDE = `
Available email template styles:

★ "ai_custom" (PREFERRED — most flexible) — You design the ENTIRE email body yourself.
   Return your design in "html_body" field as inline-CSS HTML (no <html>/<head>/<body> tags, no <script>, no <style> blocks, no external CSS).
   Constraints:
   - Use ONLY inline style="..." attributes
   - MOBILE-FIRST FULL WIDTH, NO HORIZONTAL SCROLL: ALL tables/divs MUST use width="100%" style="width:100%;". NEVER use fixed pixel widths like width="600" or style="width:600px". NEVER use min-width. NEVER use white-space:nowrap on long text. The email MUST fit inside the phone screen — user should NEVER need to scroll left/right.
   - Inner content padding 16-24px (use padding, not width, to control spacing).
   - Long URLs, emails, codes — wrap them or shorten them. Don't let any single word be wider than ~30 characters without spaces.
   - Images: always add style="max-width:100%;height:auto;display:block;" — never fixed pixel width.
   - NO nested cards with background colors different from the body. Avoid border-radius on outer containers — looks broken on Gmail mobile.
   - Use tables (<table role="presentation" width="100%">) for layouts to ensure Outlook/Gmail compatibility
   - Body text font-size 15-17px for mobile readability
   - Brand color: #4F46E5 (Workly India indigo) — use as accent, but vary per email
   - Include greeting, body, and ONE clear CTA button/link
   - DO NOT include unsubscribe footer (system adds it)
   - DO NOT include <script>, <iframe>, <form>, on* handlers
   - Make each email VISUALLY UNIQUE — vary accent colors, emojis, section structure (NOT width)
   When using ai_custom, "message" should still contain a plain-text version (for email clients that block HTML).

Other preset styles (use only if you don't want to design from scratch):
1. "hero_cta" — Big colored header banner + bold CTA button.
2. "minimal_card" — Clean white, subtle accents, simple text link CTA.
3. "alert_banner" — Yellow "Action needed" banner at top.
4. "list_update" — Bulleted/numbered list layout.
5. "plain_text" — Looks like a 1:1 personal email (serif font, no banner).
6. "newsletter" — Gradient header "Your weekly update" + content card.

DEFAULT: Use "ai_custom" unless the message is very short/simple — then pick a preset.
`;

// Intent → suggested style (used as fallback when AI doesn't specify)
export const INTENT_DEFAULT_STYLE: Record<string, TemplateStyle> = {
  free_trial: 'ai_custom',
  post_job_nudge: 'ai_custom',
  new_applicants: 'ai_custom',
  profile_complete: 'ai_custom',
  reengagement: 'ai_custom',
  job_matches: 'ai_custom',
  personal: 'ai_custom',
};

// ===========================================================
// buildBrandedEmail — single utility used by ALL email senders
// (email-api reminders, send_test_email,
// ai-career-chat send_email_to_user, etc.) so the branded shell,
// social row, footer, and login CTAs are guaranteed identical
// across every email this app sends.
// ===========================================================

export interface BrandedEmailInput {
  recipientName: string;
  title: string;            // email subject / preview title; not repeated in the message body
  bodyHtml?: string;        // pre-rendered inner HTML (sanitized by caller)
  bodyText?: string;        // plain text fallback; auto-converted if no bodyHtml
  attachmentUrl?: string;   // optional — image is inlined, otherwise download CTA
  attachmentName?: string;
  socialMap?: SocialMap;
  footerNote?: string;      // small grey line under body (e.g. "Sent by Workly AI")
  /** Owner-designed templates already contain their own greeting. */
  showGreeting?: boolean;   // default true
  /** Explicitly opt in when a special email needs an in-message heading. */
  showTitle?: boolean;      // default false
}

export function buildBrandedEmail(input: BrandedEmailInput): string {
  const safeTitle = escapeHtml(input.title || 'Workly India');
  const recipientName = escapeHtml(input.recipientName || 'Friend');
  let bodyHtml = input.bodyHtml || '';
  if (!bodyHtml && input.bodyText) {
    bodyHtml = `<p style="font-size:15px;color:#222;line-height:1.6;margin:0 0 12px;">${escapeHtml(input.bodyText).replace(/\n/g, '<br/>')}</p>`;
  }

  // Inline attachment preview
  if (input.attachmentUrl && !bodyHtml.includes(input.attachmentUrl)) {
    const isImg = /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(input.attachmentUrl);
    if (isImg) {
      bodyHtml += `<div style="margin:18px 0;text-align:center;"><img src="${escapeHtml(input.attachmentUrl)}" alt="${escapeHtml(input.attachmentName || 'attachment')}" style="max-width:100%;border-radius:8px;border:1px solid #eee;"/></div>`;
    } else {
      bodyHtml += `<div style="margin:18px 0;text-align:center;"><p style="margin:0 0 8px;color:#555;font-size:13px;">📎 Attached: <strong>${escapeHtml(input.attachmentName || 'file')}</strong></p><a href="${escapeHtml(input.attachmentUrl)}" style="display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:13px;">Download backup link</a></div>`;
    }
  }

  // "Sent by Workly AI" note removed — only show a note when a sender passes one.
  const note = input.footerNote ? input.footerNote.trim() : '';
  const greeting = input.showGreeting === false
    ? ''
    : `<div style="font-size:15px;color:#4b5563;margin-bottom:8px;">Hi ${recipientName},</div>`;
  const heading = input.showTitle === true
    ? `<div style="font-size:21px;font-weight:700;color:#111827;margin:0 0 14px;letter-spacing:-0.2px;">${safeTitle}</div>`
    : '';
  const inner = `
    <div style="padding:30px 6px 26px;color:#1f2937;font-size:15px;line-height:1.7;">
      ${greeting}
      ${heading}
      ${bodyHtml}
      ${note ? `<hr style="border:none;border-top:1px solid #eef0f4;margin:26px 0 18px;"/><div style="font-size:12px;color:#9ca3af;text-align:center;">${escapeHtml(note)}</div>` : ''}
    </div>`;
  return wrap(inner, input.title || DEFAULT_BRAND, DEFAULT_BRAND, input.socialMap || {});
}
