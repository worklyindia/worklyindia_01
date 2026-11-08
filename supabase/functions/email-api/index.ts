import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { composeNotification } from "../_shared/ai-notification-composer.ts";
import { buildBrandedEmail, loadSocialLinks } from "../_shared/engagementEmailTemplates.ts";
import { WEBSITE_DOMAIN } from '../_shared/domain.ts';
import { sendGmailForUser } from "../_shared/userGmail.ts";
import { sendCustomEmailForUser } from "../_shared/userCustomEmail.ts";
import { isFcmConfigured, legacyFetchCompat, getServiceAccount, sendToTokens, sendToUsers, type PushPayload } from '../_shared/fcm.ts';
import { notifyPayment, type PaymentStatus } from '../_shared/paymentNotify.ts';
import { notifyPoints } from '../_shared/pointsNotify.ts';
import { fanoutLifecycleChannels, fanoutLifecycleBothSides, isNeutralEvent, claimSend, resolveDisplayName, enrichTemplateValues } from '../_shared/lifecycleFanout.ts';
import { isBanExemptEvent, isUserBanned } from '../_shared/banGuard.ts';
import { isEmployerEvent } from '../_shared/lifecycleFanout.ts';
import { runFestivalGreetings } from '../_shared/festivalGreetings.ts';
import { runBirthdayGreetings } from '../_shared/birthdayGreetings.ts';
import { runDailyGreetings } from '../_shared/dailyGreetings.ts';
import { handler as telegramHandler } from './legacy/telegram.ts';
import { CHAT_BOT_ACTIONS, handleChatBotAction, type ChatBotAction } from '../_shared/userChatBots.ts';
import { handler as emailTriggerHandler } from './legacy/emailTrigger.ts';
import { handler as sendEmailHandler } from './legacy/emailSender.ts';
import { handler as channelPreferenceHandler } from './legacy/channelPreference.ts';
import { handler as accountDeletedHandler } from './legacy/accountDeleted.ts';
import { handler as signupEmailOtpHandler } from './legacy/signupEmailOtp.ts';
import { handler as profileCompletionRemindersHandler } from './legacy/profileCompletionReminders.ts';
import { handler as authHookHandler } from './legacy/authHook.ts';
// Support mail threads return original HTML (full MIME tree) so the chat renders emails like a mail app.
import { handleSupportMailAction, isSupportMailAction } from '../_shared/supportMailChat.ts';
import { handleSupportAction, isSupportAction } from '../_shared/supportDesk.ts';
import { handlePublicEmailApi, pollEmailWebhooks } from '../_shared/emailPublicApi.ts';
import { trackApiResponse } from '../_shared/apiQuota.ts';
import { handleDeveloperOAuthApps } from '../_shared/developerOAuthApps.ts';

// Single email entry point — every email in this app goes through the unified send-email endpoint.
// Direct HTTP call (not functions.invoke) avoids known runtime hang issues.
async function sendBrandedEmail(opts: {
  to: string;
  toName: string;
  subject: string;
  bodyHtml?: string;
  bodyText?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  footerNote?: string;
  socialMap?: any;
}): Promise<{
  ok: boolean;
  status: number;
  response: any;
}> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const html = buildBrandedEmail({
    recipientName: opts.toName,
    title: opts.subject,
    bodyHtml: opts.bodyHtml,
    bodyText: opts.bodyText,
    attachmentUrl: opts.attachmentUrl,
    attachmentName: opts.attachmentName,
    footerNote: opts.footerNote,
    socialMap: opts.socialMap || {}
  });
  const r = await fetch(`${supabaseUrl}/functions/v1/email-api/send-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey
    },
    body: JSON.stringify({
      to: opts.to,
      toName: opts.toName,
      subject: opts.subject,
      htmlContent: html
    })
  });
  const j = await r.json().catch(() => ({}));
  return {
    ok: r.ok && j?.success !== false,
    status: r.status,
    response: j
  };
}
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-points-trigger-secret, x-api-key, x-developer-oauth-apps',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

// =============================================================================
//  MERGED FROM notification-card-image
//  Generates a 1200×630 SVG social card and uploads to storage (cached by hash)
// =============================================================================
const CARD_BUCKET = "notification-cards";
const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;
type CardTheme = {
  from: string;
  to: string;
  chip: string;
  chipText: string;
};
const CARD_THEMES: Record<string, CardTheme> = {
  blue: {
    from: "#3B5CE4",
    to: "#1E3AC8",
    chip: "#FFFFFF",
    chipText: "#1E3AC8"
  },
  green: {
    from: "#0DB17E",
    to: "#06825C",
    chip: "#FFFFFF",
    chipText: "#06825C"
  },
  purple: {
    from: "#8B5CF6",
    to: "#6D28D9",
    chip: "#FFFFFF",
    chipText: "#6D28D9"
  },
  orange: {
    from: "#F59E0B",
    to: "#D97706",
    chip: "#FFFFFF",
    chipText: "#92400E"
  },
  red: {
    from: "#EF4444",
    to: "#B91C1C",
    chip: "#FFFFFF",
    chipText: "#7F1D1D"
  },
  brand: {
    from: "#3B5CE4",
    to: "#0DB17E",
    chip: "#FFFFFF",
    chipText: "#1E3AC8"
  }
};
const CARD_KIND_DEFAULTS: Record<string, {
  accent: string;
  badge: string;
}> = {
  job_match: {
    accent: "blue",
    badge: "NEW JOBS"
  },
  profile_complete: {
    accent: "purple",
    badge: "PROFILE"
  },
  employer_post_first_job: {
    accent: "green",
    badge: "POST A JOB"
  },
  employer_new_applications: {
    accent: "blue",
    badge: "APPLICATIONS"
  },
  application_update: {
    accent: "green",
    badge: "UPDATE"
  },
  weekly_digest: {
    accent: "purple",
    badge: "WEEKLY"
  },
  interview_tips: {
    accent: "purple",
    badge: "TIPS"
  },
  trending_skills: {
    accent: "purple",
    badge: "TRENDING"
  },
  jobs_closing_soon: {
    accent: "red",
    badge: "CLOSING SOON"
  },
  fraud_alert: {
    accent: "red",
    badge: "ALERT"
  },
  birthday: {
    accent: "purple",
    badge: "BIRTHDAY"
  },
  festival_greeting: {
    accent: "orange",
    badge: "FESTIVAL"
  },
  generic: {
    accent: "brand",
    badge: "WORKLY"
  }
};
function cardEscapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function cardWrap(text: string, maxCharsPerLine: number, maxLines: number): string[] {
  const words = (text || "").trim().split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const tentative = current ? `${current} ${w}` : w;
    if (tentative.length <= maxCharsPerLine) {
      current = tentative;
    } else {
      if (current) lines.push(current);
      current = w;
      if (lines.length === maxLines - 1 && current.length > maxCharsPerLine) {
        lines.push(current.slice(0, maxCharsPerLine - 1) + "…");
        return lines;
      }
    }
    if (lines.length >= maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    const last = lines[maxLines - 1];
    lines[maxLines - 1] = last.length > maxCharsPerLine - 1 ? last.slice(0, maxCharsPerLine - 1) + "…" : last + "…";
  }
  return lines;
}
function buildCardSvg(opts: {
  title: string;
  subtitle?: string;
  badge: string;
  theme: CardTheme;
}): string {
  const {
    title,
    subtitle,
    badge,
    theme
  } = opts;
  const titleLines = cardWrap(title, 28, 3);
  const subLines = subtitle ? cardWrap(subtitle, 50, 2) : [];
  const titleSize = titleLines.length >= 3 ? 64 : titleLines.length === 2 ? 76 : 88;
  const titleLineHeight = titleSize * 1.15;
  const titleStartY = 230;
  const titleTspans = titleLines.map((l, i) => `<tspan x="80" y="${titleStartY + i * titleLineHeight}">${cardEscapeXml(l)}</tspan>`).join("");
  const subStartY = titleStartY + titleLines.length * titleLineHeight + 30;
  const subTspans = subLines.map((l, i) => `<tspan x="80" y="${subStartY + i * 38}">${cardEscapeXml(l)}</tspan>`).join("");
  const badgeWidth = Math.max(160, badge.length * 18 + 60);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${theme.from}"/>
      <stop offset="100%" stop-color="${theme.to}"/>
    </linearGradient>
    <radialGradient id="glow" cx="85%" cy="15%" r="60%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="url(#bg)"/>
  <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="url(#glow)"/>
  <circle cx="1080" cy="120" r="180" fill="#FFFFFF" fill-opacity="0.05"/>
  <circle cx="1150" cy="540" r="120" fill="#FFFFFF" fill-opacity="0.04"/>
  <circle cx="40"  cy="560" r="80"  fill="#FFFFFF" fill-opacity="0.04"/>
  <rect x="80" y="80" rx="28" ry="28" width="${badgeWidth}" height="56" fill="${theme.chip}"/>
  <text x="${80 + badgeWidth / 2}" y="117" text-anchor="middle"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif"
        font-size="22" font-weight="800" letter-spacing="2"
        fill="${theme.chipText}">${cardEscapeXml(badge.toUpperCase())}</text>
  <text font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif"
        font-size="${titleSize}" font-weight="800" fill="#FFFFFF"
        style="text-shadow: 0 2px 8px rgba(0,0,0,0.15)">${titleTspans}</text>
  ${subLines.length ? `<text x="80" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif"
       font-size="30" font-weight="500" fill="#FFFFFF" fill-opacity="0.92">${subTspans}</text>` : ""}
  <g transform="translate(80, 540)">
    <circle cx="22" cy="22" r="22" fill="#FFFFFF"/>
    <text x="22" y="32" text-anchor="middle"
          font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif"
          font-size="26" font-weight="900" fill="${theme.from}">W</text>
    <text x="60" y="20"
          font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif"
          font-size="22" font-weight="700" fill="#FFFFFF">Workly India</text>
    <text x="60" y="44"
          font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif"
          font-size="16" font-weight="500" fill="#FFFFFF" fill-opacity="0.85">Find. Work. Grow.</text>
  </g>
</svg>`;
}
async function cardSha1Hex(s: string): Promise<string> {
  const data = new TextEncoder().encode(s);
  const buf = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}
async function generateNotificationCardImage(supabase: any, body: any) {
  const title = String(body?.title || "").trim();
  const subtitle = body?.subtitle ? String(body.subtitle).trim() : "";
  const kind = String(body?.kind || "generic");
  if (!title) {
    return {
      status: 400,
      payload: {
        error: "title is required"
      }
    };
  }
  const defaults = CARD_KIND_DEFAULTS[kind] || CARD_KIND_DEFAULTS.generic;
  const accent = String(body?.accent || defaults.accent);
  const badge = String(body?.badge || defaults.badge);
  const theme = CARD_THEMES[accent] || CARD_THEMES.brand;
  const svg = buildCardSvg({
    title,
    subtitle,
    badge,
    theme
  });
  const hash = await cardSha1Hex(svg);
  const objectPath = `cards/${kind}/${hash}.svg`;
  const publicUrl = supabase.storage.from(CARD_BUCKET).getPublicUrl(objectPath).data.publicUrl;
  let cached = false;
  try {
    const head = await fetch(publicUrl, {
      method: "HEAD"
    });
    if (head.ok) cached = true;
  } catch (_e) {/* ignore */}
  if (!cached) {
    const {
      error: upErr
    } = await supabase.storage.from(CARD_BUCKET).upload(objectPath, new Blob([svg], {
      type: "image/svg+xml"
    }), {
      cacheControl: "31536000",
      upsert: true,
      contentType: "image/svg+xml"
    });
    if (upErr) {
      console.error("[card-image] upload failed:", upErr);
      return {
        status: 500,
        payload: {
          error: "upload failed",
          detail: upErr.message
        }
      };
    }
  }
  return {
    status: 200,
    payload: {
      ok: true,
      url: publicUrl,
      cached,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      kind,
      accent
    }
  };
}

// =============================================================================
//  MERGED FROM notification-track
//  Public, no-auth tracking: /open (1x1 gif), /click (302), /event (POST json)
// =============================================================================
const TRACK_PIXEL = Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b]);
function isTrackUuid(s: string | null | undefined): s is string {
  return !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
function safeTrackRedirect(raw: string | null): string {
  if (!raw) return WEBSITE_DOMAIN;
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return WEBSITE_DOMAIN;
    }
    return u.toString();
  } catch {
    return WEBSITE_DOMAIN;
  }
}
async function logTrackEvent(supabase: any, params: {
  user_id?: string | null;
  event_type: string;
  channel: string;
  action: string;
  variant_id?: string | null;
  message_log_id?: string | null;
  user_agent?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    await supabase.rpc("log_notification_engagement", {
      p_user_id: isTrackUuid(params.user_id) ? params.user_id : null,
      p_event_type: params.event_type || "unknown",
      p_channel: params.channel || "unknown",
      p_action: params.action,
      p_variant_id: isTrackUuid(params.variant_id) ? params.variant_id : null,
      p_message_log_id: isTrackUuid(params.message_log_id) ? params.message_log_id : null,
      p_user_agent: params.user_agent ?? null,
      p_metadata: params.metadata ?? {}
    });
  } catch (e) {
    console.error("[track] log error", e);
  }
}

// =============================================================================
//  MERGED FROM notification-learning-engine
// =============================================================================
function variantScore(opened: number, clicked: number, dismissed: number, converted: number, sent: number): number {
  if (sent === 0) return 0;
  const raw = (opened + clicked * 3 + converted * 5 - dismissed * 2) / sent;
  const confidence = Math.min(1, sent / 30);
  return Number((raw * confidence).toFixed(4));
}
interface LearnUserAgg {
  user_id: string;
  hour_counts: Record<number, {
    sent: number;
    engaged: number;
  }>;
  channel_counts: Record<string, {
    sent: number;
    opened: number;
    clicked: number;
  }>;
  total_sent: number;
  total_opened: number;
  total_clicked: number;
  total_converted: number;
  total_dismissed: number;
  total_unsubscribed: number;
  last_engagement: string | null;
}
function learnPickBestHour(hour_counts: LearnUserAgg["hour_counts"]) {
  const scored = Object.entries(hour_counts).map(([h, v]) => ({
    hour: Number(h),
    engaged: v.engaged,
    sent: v.sent,
    rate: v.sent > 0 ? v.engaged / v.sent : 0
  })).filter(x => x.sent >= 2);
  scored.sort((a, b) => b.engaged - a.engaged || b.rate - a.rate);
  const active = scored.filter(x => x.engaged > 0).slice(0, 3).map(x => x.hour);
  const silent = scored.filter(x => x.sent >= 3 && x.engaged === 0).map(x => x.hour);
  return {
    best: scored[0]?.hour ?? null,
    second: scored[1]?.hour ?? null,
    active,
    silent
  };
}
function learnPickBestChannel(channel_counts: LearnUserAgg["channel_counts"]) {
  const ctr: Record<string, number> = {};
  let best: string | null = null;
  let bestRate = -1;
  for (const [ch, v] of Object.entries(channel_counts)) {
    const rate = v.sent > 0 ? v.clicked / v.sent : 0;
    ctr[ch] = Number(rate.toFixed(4));
    if (v.sent >= 3 && rate > bestRate) {
      bestRate = rate;
      best = ch;
    }
  }
  return {
    best,
    ctr
  };
}
function learnRecommendDailyCap(total_sent: number, total_dismissed: number, total_unsub: number, fatigue: number): number {
  if (total_unsub > 0) return 1;
  if (fatigue > 0.6) return 1;
  if (fatigue > 0.3) return 2;
  if (total_sent < 5) return 3;
  if (total_dismissed / Math.max(1, total_sent) > 0.4) return 2;
  return 4;
}
async function rebuildUserIntelligence(supabase: any, sinceHours = 168): Promise<number> {
  const since = new Date(Date.now() - sinceHours * 3600 * 1000).toISOString();
  const {
    data: events,
    error
  } = await supabase.from("notification_engagement_events").select("user_id, channel, action, hour_of_day, occurred_at").gte("occurred_at", since).not("user_id", "is", null).limit(50000);
  if (error) throw error;
  if (!events || events.length === 0) return 0;
  const byUser = new Map<string, LearnUserAgg>();
  for (const e of events) {
    const uid = e.user_id as string;
    let agg = byUser.get(uid);
    if (!agg) {
      agg = {
        user_id: uid,
        hour_counts: {},
        channel_counts: {},
        total_sent: 0,
        total_opened: 0,
        total_clicked: 0,
        total_converted: 0,
        total_dismissed: 0,
        total_unsubscribed: 0,
        last_engagement: null
      };
      byUser.set(uid, agg);
    }
    const h = e.hour_of_day as number;
    if (!agg.hour_counts[h]) agg.hour_counts[h] = {
      sent: 0,
      engaged: 0
    };
    const ch = String(e.channel || "unknown");
    if (!agg.channel_counts[ch]) agg.channel_counts[ch] = {
      sent: 0,
      opened: 0,
      clicked: 0
    };
    switch (e.action) {
      case "sent":
        agg.total_sent++;
        agg.hour_counts[h].sent++;
        agg.channel_counts[ch].sent++;
        break;
      case "opened":
        agg.total_opened++;
        agg.hour_counts[h].engaged++;
        agg.channel_counts[ch].opened++;
        if (!agg.last_engagement || e.occurred_at > agg.last_engagement) agg.last_engagement = e.occurred_at;
        break;
      case "clicked":
      case "converted":
        if (e.action === "clicked") agg.total_clicked++;else agg.total_converted++;
        agg.hour_counts[h].engaged++;
        agg.channel_counts[ch].clicked++;
        if (!agg.last_engagement || e.occurred_at > agg.last_engagement) agg.last_engagement = e.occurred_at;
        break;
      case "dismissed":
        agg.total_dismissed++;
        break;
      case "unsubscribed":
        agg.total_unsubscribed++;
        break;
    }
  }
  const rows = [...byUser.values()].map(agg => {
    const {
      best,
      second,
      active,
      silent
    } = learnPickBestHour(agg.hour_counts);
    const channelPick = learnPickBestChannel(agg.channel_counts);
    const sample = agg.total_sent + agg.total_opened + agg.total_clicked;
    const overallCtr = agg.total_sent > 0 ? agg.total_clicked / agg.total_sent : 0;
    const fatigue = agg.total_sent > 0 ? Math.min(1, (agg.total_dismissed * 0.5 + agg.total_unsubscribed * 5) / agg.total_sent) : 0;
    const confidence = Math.min(1, sample / 25);
    return {
      user_id: agg.user_id,
      best_send_hour: best,
      second_best_hour: second,
      best_channel: channelPick.best,
      channel_ctr: channelPick.ctr,
      total_sent: agg.total_sent,
      total_opened: agg.total_opened,
      total_clicked: agg.total_clicked,
      total_converted: agg.total_converted,
      overall_ctr: Number(overallCtr.toFixed(4)),
      fatigue_score: Number(fatigue.toFixed(3)),
      recommended_daily_cap: learnRecommendDailyCap(agg.total_sent, agg.total_dismissed, agg.total_unsubscribed, fatigue),
      active_hours: active,
      silent_hours: silent,
      last_engagement_at: agg.last_engagement,
      last_learned_at: new Date().toISOString(),
      sample_size: sample,
      confidence: Number(confidence.toFixed(2))
    };
  });
  let written = 0;
  for (let i = 0; i < rows.length; i += 1000) {
    const chunk = rows.slice(i, i + 1000);
    const {
      error: upErr
    } = await supabase.from("user_notification_intelligence").upsert(chunk, {
      onConflict: "user_id"
    });
    if (upErr) {
      console.error("[learning] upsert chunk error", upErr);
      continue;
    }
    written += chunk.length;
  }
  return written;
}
async function rebuildVariantPerformance(supabase: any): Promise<number> {
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const {
    data: events,
    error
  } = await supabase.from("notification_engagement_events").select("variant_id, event_type, channel, action").gte("occurred_at", since).not("variant_id", "is", null).limit(100000);
  if (error) throw error;
  if (!events || events.length === 0) return 0;
  type V = {
    event_type: string;
    channel: string;
    sent: number;
    opened: number;
    clicked: number;
    dismissed: number;
    converted: number;
  };
  const byVariant = new Map<string, V>();
  for (const e of events) {
    const id = e.variant_id as string;
    let v = byVariant.get(id);
    if (!v) {
      v = {
        event_type: e.event_type,
        channel: e.channel,
        sent: 0,
        opened: 0,
        clicked: 0,
        dismissed: 0,
        converted: 0
      };
      byVariant.set(id, v);
    }
    if (e.action === "sent") v.sent++;else if (e.action === "opened") v.opened++;else if (e.action === "clicked") v.clicked++;else if (e.action === "dismissed") v.dismissed++;else if (e.action === "converted") v.converted++;
  }
  const ids = [...byVariant.keys()];
  const meta = new Map<string, {
    language?: string;
    audience?: string;
  }>();
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    const {
      data: m
    } = await supabase.from("notification_ai_variants").select("id, language, audience").in("id", chunk);
    (m || []).forEach((r: any) => meta.set(r.id, {
      language: r.language,
      audience: r.audience
    }));
  }
  const rows = [...byVariant.entries()].map(([id, v]) => {
    const md = meta.get(id) || {};
    return {
      variant_id: id,
      event_type: v.event_type,
      channel: v.channel,
      language: md.language ?? null,
      audience: md.audience ?? null,
      sent_count: v.sent,
      opened_count: v.opened,
      clicked_count: v.clicked,
      dismissed_count: v.dismissed,
      converted_count: v.converted,
      score: variantScore(v.opened, v.clicked, v.dismissed, v.converted, v.sent),
      last_scored_at: new Date().toISOString()
    };
  });
  let written = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const {
      error: upErr
    } = await supabase.from("notification_variant_performance").upsert(chunk, {
      onConflict: "variant_id"
    });
    if (upErr) {
      console.error("[learning] variant upsert error", upErr);
      continue;
    }
    written += chunk.length;
  }
  return written;
}

// Slugify title to derive a stable event_type when caller doesn't supply one
function deriveEventType(eventType: string | undefined, title: string): string {
  if (eventType && typeof eventType === 'string') return eventType.toLowerCase().replace(/[^a-z0-9_]+/g, '_').slice(0, 60);
  return (title || 'notification').toLowerCase().replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '') // strip emojis
  .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'notification';
}

// Best-effort fetch of user language preference
async function getUserLanguage(sb: any, userId: string | undefined): Promise<string> {
  if (!userId) return 'english';
  try {
    const {
      data
    } = await sb.from('profiles').select('preferred_language, language').eq('user_id', userId).maybeSingle();
    const l = (data?.preferred_language || data?.language || '').toString().toLowerCase();
    if (l.includes('hi') && !l.includes('en')) return 'hindi';
    if (l.includes('en') && !l.includes('hi')) return 'english';
    return 'english';
  } catch {
    return 'english';
  }
}

// Helper to ensure full URLs
function ensureFullUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url.replace('https://wfhindia.app', WEBSITE_DOMAIN).replace('https://wfhindia.com', WEBSITE_DOMAIN).replace(WEBSITE_DOMAIN, WEBSITE_DOMAIN);
  }
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${WEBSITE_DOMAIN}${path}`;
}

// Replace template variables
const replaceTemplateVariables = (content: string, variables: Record<string, any>): string => {
  let result = content;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'gi');
    result = result.replace(regex, String(value ?? ''));
  }
  return result;
};

// =============================================================================
//  Push template variables ({{name}}, {{mobile}}, {{date}} ...)
// =============================================================================

const IST = 'Asia/Kolkata';

/** Current IST date (DD/MM/YYYY) and time (HH:MM:SS AM/PM). */
const istStamp = (input?: string | Date) => {
  const d = input ? new Date(input) : new Date();
  const safe = isNaN(d.getTime()) ? new Date() : d;
  const date = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST,
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(safe);
  const time = new Intl.DateTimeFormat('en-US', {
    timeZone: IST,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).format(safe).toUpperCase();
  return {
    date,
    time,
    datetime: `${date} ${time}`
  };
};

/**
 * Replace {{key}} placeholders with real values. Any line that still holds an
 * unresolved placeholder is dropped, so empty "Mobile : " lines never ship.
 */
const fillTemplateText = (text: string, values: Record<string, unknown>): string => {
  if (!text) return '';
  let out = String(text);
  for (const [key, raw] of Object.entries(values)) {
    const value = raw == null ? '' : formatTemplateValue(key, String(raw));
    if (!value) continue;
    out = out.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi'), value);
  }
  if (!/\{\{\s*[\w.]+\s*\}\}/.test(out)) return out.trim();
  const kept = out.split('\n').filter(line => !/\{\{\s*[\w.]+\s*\}\}/.test(line)).join('\n').trim();
  // Never lose the owner's saved text: if every line held a placeholder, keep
  // the text and remove only the placeholders themselves.
  return kept || out.replace(/\{\{\s*[\w.]+\s*\}\}/g, '').replace(/[ \t]{2,}/g, ' ').replace(/^[\s:.-]+|[\s:.-]+$/g, '').trim();
};
const TITLE_CASE_VARIABLES = new Set(['name', 'job_title', 'company', 'status', 'mode']);
const formatTemplateValue = (key: string, value: string): string => {
  const clean = value.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  if (!TITLE_CASE_VARIABLES.has(key)) return clean;
  return clean.replace(/(^|[\s/(-])([a-z])/g, (_match, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`);
};

/** Build the variable map from explicit variables + the push data payload. */
const buildPushVariables = (variables: Record<string, unknown> | undefined | null, data: Record<string, unknown> | undefined | null, occurredAt?: string): Record<string, unknown> => {
  const d = (data ?? {}) as Record<string, unknown>;
  const stamp = istStamp(occurredAt);
  const derived: Record<string, unknown> = {
    name: d.applicant_name ?? d.name ?? d.full_name ?? d.fullName ?? d.user_name ?? d.userName ?? d.candidate_name ?? d.candidateName,
    mobile: d.applicant_phone ?? d.mobile ?? d.phone ?? d.phone_number ?? d.phoneNumber ?? d.whatsapp_number,
    whatsapp: d.applicant_whatsapp_number ?? d.api_whatsapp_number ?? d.whatsapp_number ?? d.whatsapp ?? d.applicant_phone ?? d.mobile ?? d.phone ?? d.phone_number ?? d.phoneNumber,
    email: d.applicant_email ?? d.email ?? d.user_email ?? d.userEmail,
    location: d.applicant_location ?? d.location ?? d.city ?? d.job_location ?? d.jobLocation,
    job_title: d.job_title ?? d.jobTitle ?? d.title ?? d.position ?? d.role,
    company: d.company_name ?? d.companyName ?? d.company ?? d.employer_name ?? d.employerName,
    status: d.status ?? d.new_status ?? d.newStatus ?? d.application_status,
    amount: d.amount ?? d.price ?? d.total ?? d.total_amount ?? d.totalAmount,
    points: d.points ?? d.points_added ?? d.pointsAdded ?? d.credits,
    balance: d.balance ?? d.wallet_balance ?? d.walletBalance ?? d.new_balance,
    order_id: d.order_id ?? d.orderId ?? d.payment_id ?? d.paymentId ?? d.transaction_id ?? d.transactionId,
    otp: d.otp ?? d.code ?? d.otp_code ?? d.verification_code,
    link: d.link ?? d.url ?? d.action_url ?? d.actionUrl ?? d.meeting_link ?? d.join_url,
    plan: d.plan ?? d.plan_name ?? d.planName ?? d.package ?? d.package_name,
    reason: d.reason ?? d.note ?? d.message_reason ?? d.rejection_reason,
    salary: d.salary ?? d.salary_range ?? d.salaryRange ?? d.pay,
    experience: d.experience ?? d.experience_required ?? d.experienceRequired,
    interview_date: d.interview_date ?? d.interviewDate ?? d.scheduled_date ?? d.scheduledDate,
    interview_time: d.interview_time ?? d.interviewTime ?? d.scheduled_time ?? d.scheduledTime,
    expiry_date: d.expiry_date ?? d.expiryDate ?? d.expires_at ?? d.expiresAt ?? d.valid_till,
    days: d.days ?? d.days_left ?? d.daysLeft ?? d.remaining_days,
    count: d.count ?? d.total_count ?? d.jobs_count ?? d.applications_count,
    job_type: d.job_type ?? d.jobType ?? d.employment_type ?? d.employmentType,
    job_url: d.job_url ?? d.jobUrl ?? d.link ?? d.url ?? d.action_url ?? d.actionUrl,
    mode: d.mode ?? d.interview_mode ?? d.interviewMode ?? d.meeting_mode ?? d.payment_mode,
    referral_name: d.referral_name ?? d.referralName ?? d.referred_name ?? d.referredName ?? d.referred_company ?? d.friend_name,
    prize: d.prize ?? d.reward ?? d.reward_amount ?? d.rewardAmount,
    rank: d.rank ?? d.position_rank ?? d.leaderboard_rank,
    festival: d.festival ?? d.festival_name ?? d.occasion,
    domain: d.domain ?? d.domain_name ?? d.website,
    expiry_minutes: d.expiry_minutes ?? d.expiryMinutes ?? d.otp_expiry_minutes ?? d.valid_for_minutes
  };
  // An explicitly supplied variable wins, but only when it actually carries a
  // value — an empty/undefined override must not erase a derived value.
  const merged: Record<string, unknown> = {
    ...derived
  };
  for (const [k, v] of Object.entries(variables ?? {})) {
    if (v !== undefined && v !== null && String(v).trim() !== '') merged[k] = v;
  }
  // Contact values used by Telegram's native phone detection and wa.me links.
  const mobileDigits = String(merged.mobile ?? '').replace(/\D/g, '');
  const whatsappValue = String(merged.whatsapp ?? merged.mobile ?? '').trim();
  const whatsappDigits = whatsappValue.replace(/\D/g, '');
  return {
    ...merged,
    ...(whatsappValue ? {
      whatsapp: whatsappValue
    } : {}),
    ...(mobileDigits ? {
      mobile_digits: mobileDigits
    } : {}),
    ...(whatsappDigits ? {
      whatsapp_digits: whatsappDigits
    } : {}),
    date: stamp.date,
    time: stamp.time,
    datetime: stamp.datetime,
    post_date: merged.post_date ?? stamp.date,
    post_time: merged.post_time ?? stamp.time
  };
};

/**
 * Several app events share one owner template. Keep this in sync with
 * PUSH_EVENT_ALIASES in src/config/pushTemplateCatalog.ts.
 */
const PUSH_EVENT_ALIASES: Record<string, string> = {
  welcome: 'signup_welcome',
  user_signup_welcome: 'signup_welcome',
  employer_welcome: 'employer_signup_welcome',
  profile_completed: 'profile_complete',
  user_profile_completed: 'profile_complete',
  company_profile_complete: 'profile_complete',
  application_reviewed: 'application_under_review',
  application_under_review_status: 'application_under_review',
  application_selected: 'application_hired',
  application_status: 'application_status_changed',
  status_change: 'application_status_changed',
  interview_scheduled: 'interview_status_update',
  interview_rescheduled: 'interview_status_update',
  interview_cancelled: 'interview_status_update',
  interview_completed: 'interview_status_update',
  employer_interview_cancelled: 'employer_interview_scheduled',
  employer_interview_completed: 'employer_interview_scheduled',
  employer_job_posted: 'job_posted',
  job_live: 'job_posted',
  payment_successful: 'payment_success',
  employer_payment_success: 'payment_success',
  employer_payment_successful: 'payment_success',
  employer_payment_failed: 'payment_failed',
  milestone_achieved: 'referral_milestone',
  user_withdrawal_approved: 'referral_withdrawal',
  employer_withdrawal_approved: 'referral_withdrawal',
  user_withdrawal_failed: 'referral_withdrawal',
  withdrawal_status: 'referral_withdrawal',
  // Events that had no owner template mapping, so they used to fall back to
  // generated text. They now reuse the closest saved template.
  interview_reminder: 'application_interview_scheduled',
  employer_interview_reminder: 'employer_interview_scheduled',
  interview_reminder_employer: 'employer_interview_scheduled',
  job_recommendation: 'new_job_match',
  job_alert: 'new_job_match',
  new_jobs_for_you: 'new_job_match',
  user_payment_success: 'payment_success',
  user_payment_failed: 'payment_failed',
  payment_failure: 'payment_failed',
  employer_profile_completed: 'profile_complete',
  employer_signup_otp_sent: 'employer_2fa_otp',
  signup_otp: 'jobseeker_2fa_otp',
  otp_sent: 'jobseeker_2fa_otp',
  user_telegram_connected: 'bot_code_used_job_seeker',
  employer_telegram_connected: 'bot_code_used_employer',
  application_received: 'new_application_received',
  job_application_received: 'new_application_received',
  referral_signup: 'referral_join',
  referral_joined: 'referral_join',
  commission_credited: 'commission_earned',
  job_expiring_soon: 'job_expiry',
  boost_expiring_soon: 'boost_expiry',
  domain_expiring_soon: 'domain_expiry',
  verification_expiring_soon: 'verification_expiry',
  user_referral_reward: 'commission_earned',
  employer_referral_reward: 'commission_earned',
  user_referral_invite: 'referral_join',
  employer_referral_invite: 'referral_join',
  user_signup_otp: 'jobseeker_2fa_otp',
  user_signup_otp_sent: 'jobseeker_2fa_otp',
  company_signup_otp: 'employer_2fa_otp',
  user_profile_whatsapp_verify: 'jobseeker_2fa_otp',
  company_profile_whatsapp_verify: 'employer_2fa_otp',
  profile_incomplete: 'profile_incomplete_job_seeker',
  user_profile_incomplete: 'profile_incomplete_job_seeker',
  employer_profile_incomplete: 'profile_incomplete_employer',
  company_profile_incomplete: 'profile_incomplete_employer',
  employer_job_expiring: 'job_expiry',
  employer_job_expiry: 'job_expiry',
  low_balance: 'employer_low_balance',
  employer_low_points: 'employer_low_balance',
  user_profile_viewed: 'profile_viewed',
  employer_viewed_profile: 'profile_viewed',
  // Notifications that were sent without any editable template.
  job_expiring: 'job_expiry',
  referral_reward: 'commission_earned',
  withdrawal_approved: 'referral_withdrawal',
  employer_withdrawal_failed: 'referral_withdrawal',
  payment_received: 'payment_success',
  candidate_shortlisted: 'application_shortlisted',
  telegram_2fa_otp: 'jobseeker_2fa_otp',
  employer_telegram_2fa_otp: 'employer_2fa_otp',
  user_refund_initiated: 'refund_initiated',
  user_subscription_expiring: 'subscription_expiring',
  employer_subscription_expiring: 'subscription_expiring',
  job_digest: 'weekly_digest'
};

/**
 * Every application status has its own owner template.
 * Keep in sync with APPLICATION_STATUS_TEMPLATES in
 * src/config/pushTemplateCatalog.ts.
 */
const APPLICATION_STATUS_TEMPLATES: Record<string, string> = {
  reviewed: 'application_under_review',
  under_review: 'application_under_review',
  in_review: 'application_under_review',
  shortlisted: 'application_shortlisted',
  interview_scheduled: 'application_interview_scheduled',
  interview: 'application_interview_scheduled',
  hired: 'application_hired',
  selected: 'application_hired',
  rejected: 'application_rejected',
  not_selected: 'application_rejected',
  withdrawn: 'application_withdrawn'
};
const applicationStatusTemplateKey = (status: string): string => APPLICATION_STATUS_TEMPLATES[String(status || '').trim().toLowerCase().replace(/[\s-]+/g, '_')] ?? 'application_status_changed';
const resolveTemplateKey = (eventKey: string): string => {
  const key = String(eventKey || '').replace(/^push_/, '');
  return PUSH_EVENT_ALIASES[key] ?? key;
};

/** Apply an owner template's text with variables, keeping safe fallbacks. */
const applyPushTemplate = (template: Record<string, any>, values: Record<string, unknown>, fallback: {
  title: string;
  message: string;
}) => {
  // A raw placeholder must NEVER reach the user, so every fallback is stripped
  // of unresolved {{...}} too before it is used.
  const clean = (text: string) => String(text || '').replace(/\{\{\s*[\w.]+\s*\}\}/g, '').replace(/^[\s:.-]+|[\s:.-]+$/g, '').trim();
  const title = fillTemplateText(template.title ?? '', values) || clean(fallback.title) || 'Workly India';
  const message = fillTemplateText(template.body ?? '', values) || clean(fallback.message) || 'You have a new update on Workly India.';
  const buttonText = template.button_text ? fillTemplateText(String(template.button_text), values) || clean(String(template.button_text)) || undefined : undefined;
  const buttonUrl = template.button_url ? fillTemplateText(String(template.button_url), values) || clean(String(template.button_url)) || undefined : undefined;
  return {
    title,
    message,
    buttonText,
    buttonUrl
  };
};

// =============================================================================
//  MERGED FROM process-notification-queue
//  Drains notification_trigger_queue and fans out to all channels with AI msgs
// =============================================================================
type Audience = "user" | "employer";
interface EventTemplate {
  title: string;
  message: string;
  ctaText?: string;
  ctaUrl?: string;
  audience: Audience;
  channels: Array<"inapp" | "push" | "email" | "telegram">;
  emailSubject?: string;
}
const SITE = WEBSITE_DOMAIN;
const BRAND = "Workly India";

// ---------------------------------------------------------------------------
// Brand logo used as the notification icon. The previous hardcoded storage URL
// returned HTTP 400, so Chrome fell back to a letter avatar ("no logo" bug).
// We now read the live logo the website header uses, cached per instance.
// ---------------------------------------------------------------------------
const FALLBACK_NOTIFICATION_ICON = `${WEBSITE_DOMAIN}/icons/icon-192x192.png`;

// ---------------------------------------------------------------------------
// Push rich-media size cap (cached-egress control).
// Every device that receives a push downloads the big-picture image. Storage
// originals can be 1-3 MB each; routing the URL through the wsrv.nl image
// proxy (already used across the site) caps it at 1080px JPEG (~40-90 KB).
// The proxy fetches the original from Supabase once and caches it, so repeat
// deliveries of the same image cause almost no storage egress.
// ---------------------------------------------------------------------------
const PUSH_IMAGE_MAX_WIDTH = 1080;
const PUSH_IMAGE_QUALITY = 72;
/** Resolve template CTA paths before sending to Android, whose PendingIntent requires an absolute URL. */
function absolutePushUrl(value: unknown, fallback: string = SITE): string {
  const raw = typeof value === "string" ? value.trim() : "";
  try {
    return new URL(raw || fallback, SITE).toString();
  } catch {
    return SITE;
  }
}

function capPushImageUrl(url: unknown): string | undefined {
  if (typeof url !== 'string') return undefined;
  const u = url.trim();
  if (!u || !/^https?:\/\//i.test(u)) return undefined;
  if (u.includes('wsrv.nl')) return u; // already proxied/capped
  const looksImage = /\.(png|jpe?g|webp|gif|bmp|avif)(\?|#|$)/i.test(u) || u.includes('/storage/');
  if (!looksImage) return u; // svg / unknown -> untouched
  try {
    const proxy = new URL('https://wsrv.nl/');
    proxy.searchParams.set('url', u);
    proxy.searchParams.set('w', String(PUSH_IMAGE_MAX_WIDTH));
    proxy.searchParams.set('we', ''); // never enlarge small images
    proxy.searchParams.set('q', String(PUSH_IMAGE_QUALITY));
    proxy.searchParams.set('output', 'jpg'); // universal: Android, Chrome, iOS attachments
    return proxy.toString();
  } catch (_e) {
    return u;
  }
}
let cachedBrandLogoUrl: string | null = null;
async function getBrandLogoUrl(client: any): Promise<string> {
  if (cachedBrandLogoUrl) return cachedBrandLogoUrl;
  try {
    const {
      data
    } = await client.rpc('get_brand_assets');
    const url = data && typeof data === 'object' ? (data as Record<string, unknown>).logo_url : null;
    if (typeof url === 'string' && url.startsWith('http')) {
      cachedBrandLogoUrl = url.split('?')[0];
      return cachedBrandLogoUrl;
    }
  } catch (err) {
    console.error('getBrandLogoUrl failed:', err);
  }
  return FALLBACK_NOTIFICATION_ICON;
}

/** Pick the social platform artwork for Chrome web push without replacing the
 * Workly brand artwork used by native Android notifications and action icons. */
function getSocialChromeIcon(source: unknown): string | null {
  if (!source || typeof source !== 'object') return null;
  const value = source as Record<string, unknown>;
  const text = [
    value.platform, value.source, value.provider, value.channel, value.integration,
    value.type, value.event_type, value.notification_type, value.template_key,
    value.templateKey, value.platform_name, value.social_platform
  ].filter(Boolean).join(' ').toLowerCase();

  if (/whats.?app|\bwa\b/.test(text)) return `${WEBSITE_DOMAIN}/whatsapp-notification-icon.png`;
  if (/instagram|\binsta\b/.test(text)) return `${WEBSITE_DOMAIN}/notifications/instagram.svg`;
  if (/messenger/.test(text)) return `${WEBSITE_DOMAIN}/notifications/facebook.svg`;
  if (/facebook|\bfb\b/.test(text)) return `${WEBSITE_DOMAIN}/notifications/facebook.svg`;
  return null;
}
const EVENT_CATALOG: Record<string, EventTemplate> = {
  push_signup_welcome: {
    title: `Welcome to ${BRAND}! 🎉`,
    message: "Your job search starts here. Complete your profile and unlock matches with top employers.",
    ctaText: "Complete profile",
    ctaUrl: `${SITE}/profile`,
    audience: "user",
    channels: ["inapp", "push", "email", "telegram"],
    emailSubject: `Welcome to ${BRAND} — let's find your next job`
  },
  user_profile_completed: {
    title: "Profile complete — you're ready! ✅",
    message: "Great! Your profile is live. Recruiters can now discover you.",
    ctaText: "Browse jobs",
    ctaUrl: `${SITE}/jobs`,
    audience: "user",
    channels: ["inapp", "push", "email"]
  },
  application_submitted: {
    title: "Application submitted ✓",
    message: "Your application has been delivered to the employer. We'll notify you the moment they respond.",
    ctaText: "Track applications",
    ctaUrl: `${SITE}/my-applications`,
    audience: "user",
    channels: ["inapp", "push", "email", "telegram"]
  },
  application_shortlisted: {
    title: "🎯 You've been shortlisted!",
    message: "An employer just shortlisted your application. Keep an eye out — an interview invite may follow.",
    ctaText: "View application",
    ctaUrl: `${SITE}/my-applications`,
    audience: "user",
    channels: ["inapp", "push", "email", "telegram"]
  },
  application_rejected: {
    title: "Application update",
    message: "An employer has reviewed your application. Don't lose heart — many more opportunities are waiting.",
    ctaText: "Find similar jobs",
    ctaUrl: `${SITE}/jobs`,
    audience: "user",
    channels: ["inapp", "push", "email"]
  },
  application_viewed: {
    title: "👀 Employer viewed your application",
    message: "An employer just opened your profile. Stay ready in case they reach out.",
    ctaText: "View application",
    ctaUrl: `${SITE}/my-applications`,
    audience: "user",
    channels: ["inapp", "push"]
  },
  interview_scheduled: {
    title: "📅 Interview scheduled!",
    message: "You have an upcoming interview. Tap to see the date, time and joining details.",
    ctaText: "Interview details",
    ctaUrl: `${SITE}/my-interviews`,
    audience: "user",
    channels: ["inapp", "push", "email", "telegram"]
  },
  interview_reminder: {
    title: "⏰ Interview reminder",
    message: "Your interview starts soon. Be ready!",
    ctaText: "Open interview",
    ctaUrl: `${SITE}/my-interviews`,
    audience: "user",
    channels: ["inapp", "push", "email", "telegram"]
  },
  job_recommendation: {
    title: "🚀 New jobs match your skills",
    message: "Fresh openings just landed in your field. Apply before they close.",
    ctaText: "View matches",
    ctaUrl: `${SITE}/jobs`,
    audience: "user",
    channels: ["inapp", "push", "email"]
  },
  user_payment_success: {
    title: "Payment successful ✅",
    message: "Your payment has been received. Thank you for trusting Workly.",
    ctaText: "View receipt",
    ctaUrl: `${SITE}/wallet-history`,
    audience: "user",
    channels: ["inapp", "push", "email"]
  },
  user_telegram_connected: {
    title: "✅ Telegram connected",
    message: "You'll now get instant job alerts on Telegram too. Stay tuned!",
    ctaText: "Open dashboard",
    ctaUrl: `${SITE}/dashboard`,
    audience: "user",
    channels: ["inapp", "email", "telegram"]
  },
  push_employer_signup_welcome: {
    title: `Welcome to ${BRAND} for Employers! 🚀`,
    message: "Post your first job in minutes and reach thousands of qualified candidates.",
    ctaText: "Post a job",
    ctaUrl: `${SITE}/employer/post-job`,
    audience: "employer",
    channels: ["inapp", "push", "email", "telegram"],
    emailSubject: `Welcome to ${BRAND} — start hiring today`
  },
  employer_signup_otp_sent: {
    title: "Your verification code",
    message: "Use the OTP we just sent to verify your company account.",
    audience: "employer",
    channels: ["email"],
    emailSubject: `${BRAND} — verify your company account`
  },
  employer_profile_completed: {
    title: "Company profile complete ✅",
    message: "Your company profile is live. Job seekers can now find your openings.",
    ctaText: "Post a job",
    ctaUrl: `${SITE}/employer/post-job`,
    audience: "employer",
    channels: ["inapp", "push", "email"]
  },
  job_posted: {
    title: "Your job is live! 🎉",
    message: "Your posting is now visible to thousands of candidates. Applications will start flowing in.",
    ctaText: "View posting",
    ctaUrl: `${SITE}/employer/jobs`,
    audience: "employer",
    channels: ["inapp", "push", "email", "telegram"]
  },
  new_application_received: {
    title: "🔔 New application received",
    message: "A candidate just applied to your job. Review their profile and shortlist now.",
    ctaText: "View application",
    ctaUrl: `${SITE}/employer/applications`,
    audience: "employer",
    channels: ["inapp", "push", "email", "telegram"]
  },
  employer_payment_success: {
    title: "Payment received ✅",
    message: "Your payment is confirmed. Your premium features are now active.",
    ctaText: "View invoice",
    ctaUrl: `${SITE}/employer/billing`,
    audience: "employer",
    channels: ["inapp", "push", "email"]
  },
  employer_interview_reminder: {
    title: "⏰ Interview reminder",
    message: "Your interview with a candidate is starting soon.",
    ctaText: "Join interview",
    ctaUrl: `${SITE}/employer/interviews`,
    audience: "employer",
    channels: ["inapp", "push", "telegram"]
  }
};
async function getRecipient(sb: any, userId: string, audience: Audience) {
  if (audience === "employer") {
    const {
      data
    } = await sb.from("companies").select("user_id, company_name, email, telegram_chat_id").eq("user_id", userId).maybeSingle();
    if (!data) return null;
    return {
      user_id: data.user_id,
      name: data.company_name || "Employer",
      email: data.email,
      telegram_chat_id: data.telegram_chat_id
    };
  }
  const {
    data
  } = await sb.from("profiles").select("user_id, full_name, email, telegram_chat_id").eq("user_id", userId).maybeSingle();
  if (!data) return null;
  return {
    user_id: data.user_id,
    name: data.full_name || "User",
    email: data.email,
    telegram_chat_id: data.telegram_chat_id
  };
}
function emailHtml(opts: {
  greeting: string;
  body: string;
  ctaText?: string;
  ctaUrl?: string;
}) {
  const cta = opts.ctaText && opts.ctaUrl ? `<div style="text-align:center;margin:28px 0;"><a href="${opts.ctaUrl}" style="background:#1E40AF;color:#ffffff;padding:14px 32px;text-decoration:none;font-weight:600;border-radius:6px;display:inline-block;">${opts.ctaText}</a></div>` : "";
  return `<!doctype html><html><body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;"><tr><td style="background:#1E40AF;padding:24px;color:#ffffff;"><div style="font-size:13px;letter-spacing:1.5px;text-transform:uppercase;opacity:.85;">${BRAND}</div></td></tr><tr><td style="padding:28px 24px;color:#222;font-size:16px;line-height:1.6;"><p style="margin:0 0 14px;">${opts.greeting}</p><div style="margin:0 0 14px;">${opts.body}</div>${cta}<p style="margin:24px 0 0;color:#777;font-size:13px;">— Team ${BRAND}</p></td></tr><tr><td style="border-top:1px solid #e5e9f2;padding:14px 24px;color:#888;font-size:12px;text-align:center;">You're receiving this because you have an account on ${BRAND}.</td></tr></table></td></tr></table></body></html>`;
}
async function processOne(sb: any, row: any, requestId: string): Promise<{
  ok: boolean;
  error?: string;
  channels?: any;
}> {
  // An event missing from the catalog used to be dropped entirely, so its saved
  // owner template never went out. Now we build a generic entry from the
  // template key and let the owner template drive the content.
  const catalogEvt = EVENT_CATALOG[row.event_type];
  const fallbackKey = resolveTemplateKey(row.event_type);
  const evt: EventTemplate = catalogEvt ?? {
    title: BRAND,
    message: `You have a new update on ${BRAND}.`,
    ctaUrl: SITE,
    audience: isEmployerEvent(fallbackKey) ? "employer" : "user",
    channels: ["inapp", "push", "email", "telegram"]
  };
  const recipient = (await getRecipient(sb, row.user_id, evt.audience)) ?? (await getRecipient(sb, row.user_id, evt.audience === "employer" ? "user" : "employer"));
  if (!recipient) return {
    ok: false,
    error: "Recipient profile not found"
  };
  const variables = {
    name: recipient.name,
    user_name: recipient.name,
    cta: evt.ctaText || "Open dashboard",
    cta_url: evt.ctaUrl || SITE,
    ...(row.metadata || {})
  };
  // The owner-edited templates in the Owner Portal are the source of truth for
  // lifecycle messages. The queue used to compose its own text from a hardcoded
  // catalog, so owner edits were silently ignored for queued events. Resolve the
  // same template key the direct lifecycle path uses and fill it with real data.
  const templateKey = resolveTemplateKey(row.event_type);
  const side = evt.audience === "employer" ? "employer" : "jobseeker";
  const values = await enrichTemplateValues(sb, {
    userId: recipient.user_id,
    templateKey,
    employerSide: side === "employer",
    values: {
      ...buildPushVariables((row.metadata as any)?.variables as Record<string, unknown> | undefined, (row.metadata ?? {}) as Record<string, unknown>, row.created_at as string ?? undefined),
      ...variables
    }
  });
  const results: Record<string, any> = {};

  // 1. IN-APP
  if (evt.channels.includes("inapp")) {
    try {
      const ai = await composeNotification({
        eventType: row.event_type,
        channel: "push",
        audience: evt.audience,
        language: (row.metadata as any)?.language || "english",
        variables,
        fallbackTitle: evt.title,
        fallbackMessage: evt.message
      });
      const table = evt.audience === "employer" ? "employer_notifications" : "notifications";
      const {
        error
      } = await sb.from(table).insert({
        user_id: recipient.user_id,
        title: ai.title || evt.title,
        message: ai.message,
        type: row.event_type,
        is_read: false,
        action_url: evt.ctaUrl || null,
        metadata: {
          source: "queue",
          trigger_id: row.id,
          ai_source: ai.source
        }
      });
      results.inapp = error ? {
        ok: false,
        error: error.message
      } : {
        ok: true
      };
    } catch (e) {
      results.inapp = {
        ok: false,
        error: (e as Error).message
      };
    }
  }

  // 2. PUSH — the owner's push_lifecycle_templates row wins. AI composition is
  // used only when that event has no saved template yet.
  if (evt.channels.includes("push")) {
    try {
      const {
        data: pushTpl
      } = await sb.from("push_lifecycle_templates").select("*").eq("event_type", templateKey).maybeSingle();
      if (pushTpl && pushTpl.enabled === false) {
        results.push = {
          ok: false,
          skipped: true,
          error: "template disabled in Owner Portal"
        };
      } else if (pushTpl?.title && pushTpl?.body) {
        if (!isFcmConfigured()) {
          results.push = {
            ok: false,
            error: "Firebase not configured"
          };
        } else {
          const filled = applyPushTemplate(pushTpl, values, {
            title: evt.title,
            message: evt.message
          });
          const pushUrl = absolutePushUrl(filled.buttonUrl || evt.ctaUrl || SITE);
          const r = await sendToUsers(sb, [recipient.user_id], {
            title: filled.title,
            body: filled.message,
            url: pushUrl,
            image: capPushImageUrl(pushTpl.image_url),
            icon: pushTpl.icon_url || undefined,
            actions: filled.buttonText ? [{
              action: "open",
              title: filled.buttonText,
              url: pushUrl
            }] : [],
            tag: `queue-${templateKey}-${row.id}`
          });
          results.push = r.sent > 0 ? {
            ok: true,
            data: {
              recipients: r.sent
            },
            source: "owner_template"
          } : {
            ok: false,
            error: r.errors[0] ?? "no tokens"
          };
        }
      } else {
        const ai = await composeNotification({
          eventType: row.event_type,
          channel: "push",
          audience: evt.audience,
          language: (row.metadata as any)?.language || "english",
          variables,
          fallbackTitle: evt.title,
          fallbackMessage: evt.message
        });
        if (isFcmConfigured()) {
          const r = await sendToUsers(sb, [recipient.user_id], {
            title: ai.title || evt.title,
            body: ai.message,
            ...(evt.ctaUrl ? {
              url: evt.ctaUrl
            } : {})
          });
          results.push = r.sent > 0 ? {
            ok: true,
            data: {
              recipients: r.sent
            }
          } : {
            ok: false,
            error: r.errors[0] ?? "no tokens"
          };
        } else {
          results.push = {
            ok: false,
            error: "Firebase not configured"
          };
        }
      }
    } catch (e) {
      results.push = {
        ok: false,
        error: (e as Error).message
      };
    }
  }

  // 3. EMAIL — hand off to the shared owner-template fan-out so a queued event
  // sends the same Email the Owner Portal shows, with the same branding,
  // opt-out, ban and duplicate-send rules as a direct lifecycle send.
  if (evt.channels.includes("email") && recipient.email) {
    try {
      const fan = await fanoutLifecycleChannels(sb, {
        userId: recipient.user_id,
        templateKey,
        variables: values,
        email: recipient.email,
        channels: ['email'],
        audience: side,
        fallbackTitle: evt.emailSubject || evt.title,
        fallbackMessage: evt.message
      });
      let emailSubject = typeof fan.subject === 'string' ? fan.subject : '';
      if (fan.email === 'sent') {
        results.email = {
          ok: true,
          source: "owner_template"
        };
      } else if (fan.email === 'no_template') {
        // Nothing saved for this event: keep the previous AI/compose behaviour
        // so deliveries that used to happen keep happening.
        const ai = await composeNotification({
          eventType: row.event_type,
          channel: "email",
          audience: evt.audience,
          language: (row.metadata as any)?.language || "english",
          variables,
          fallbackTitle: evt.emailSubject || evt.title,
          fallbackMessage: evt.message,
          fallbackHtml: emailHtml({
            greeting: `Hi ${recipient.name},`,
            body: evt.message,
            ctaText: evt.ctaText,
            ctaUrl: evt.ctaUrl
          })
        });
        const subject = ai.title || evt.emailSubject || evt.title;
        emailSubject = subject;
        const html = ai.html || emailHtml({
          greeting: `Hi ${recipient.name},`,
          body: ai.message || evt.message,
          ctaText: evt.ctaText,
          ctaUrl: evt.ctaUrl
        });
        const {
          data,
          error
        } = await sb.functions.invoke("email-api/send-email", {
          body: {
            to: recipient.email,
            toName: recipient.name,
            subject,
            htmlContent: html,
            audience: side
          }
        });
        results.email = error ? {
          ok: false,
          error: error.message
        } : {
          ok: true,
          messageId: (data as any)?.messageId
        };
      } else if (fan.email === 'failed') {
        results.email = {
          ok: false,
          error: fan.errors.find(e => e.startsWith('email:')) || 'email send failed'
        };
      } else {
        results.email = {
          ok: false,
          skipped: true,
          error: fan.email
        };
      }
      // Record every queued email, whichever path delivered it, so the Email
      // dashboard keeps seeing queue-driven traffic.
      const emailRes = results.email as any;
      await sb.from("email_outbound_events").insert({
        recipient_email: recipient.email,
        event_type: emailRes?.ok ? "queued" : "error",
        subject: String(emailSubject || templateKey),
        user_id: recipient.user_id,
        user_type: side === "employer" ? "employer" : "jobseeker",
        message_id: emailRes?.messageId || null,
        bounce_reason: emailRes?.ok ? null : String(emailRes?.error || "email not delivered"),
        raw_payload: {
          event_type: row.event_type,
          source: "queue",
          template_key: templateKey,
          template_status: fan.email
        },
        event_at: new Date().toISOString()
      }).then(() => null).catch(() => null);
    } catch (e) {
      results.email = {
        ok: false,
        error: (e as Error).message
      };
    }
  }

  // 4. TELEGRAM — same owner-template fan-out as Email, so the message the
  // owner wrote is what actually lands in the chat.
  if (evt.channels.includes("telegram") && recipient.telegram_chat_id) {
    try {
      const fan = await fanoutLifecycleChannels(sb, {
        userId: recipient.user_id,
        templateKey,
        variables: values,
        chatId: recipient.telegram_chat_id,
        channels: ['telegram'],
        audience: side,
        fallbackTitle: evt.title,
        fallbackMessage: evt.message
      });
      if (fan.telegram === 'sent') {
        results.telegram = {
          ok: true,
          source: "owner_template"
        };
      } else if (fan.telegram === 'no_template') {
        const ai = await composeNotification({
          eventType: row.event_type,
          channel: "telegram",
          audience: evt.audience,
          language: (row.metadata as any)?.language || "english",
          variables,
          fallbackTitle: evt.title,
          fallbackMessage: evt.message
        });
        const text = `<b>${ai.title || evt.title}</b>\n\n${ai.message}${evt.ctaUrl ? `\n\n${evt.ctaText || "Open"} → ${evt.ctaUrl}` : ""}`;
        const {
          data,
          error
        } = await sb.functions.invoke("email-api/telegram", {
          body: {
            action: "send",
            audience: side === "employer" ? "employer" : "job_seeker",
            chat_id: recipient.telegram_chat_id,
            text,
            parse_mode: "HTML"
          }
        });
        const sendOk = !error && (data as any)?.success !== false;
        results.telegram = sendOk ? {
          ok: true,
          data
        } : {
          ok: false,
          error: error?.message || (data as any)?.error || "telegram send failed"
        };
      } else if (fan.telegram === 'failed') {
        results.telegram = {
          ok: false,
          error: fan.errors.find(e => e.startsWith('telegram:')) || 'telegram send failed'
        };
      } else {
        results.telegram = {
          ok: false,
          skipped: true,
          error: fan.telegram
        };
      }
    } catch (e) {
      results.telegram = {
        ok: false,
        error: (e as Error).message
      };
    }
  }
  const totalSent = Object.values(results).filter((r: any) => r?.ok).length;
  const totalFailed = Object.values(results).filter((r: any) => r && r.ok === false).length;
  await sb.from("unified_notification_logs").insert({
    event_type: row.event_type,
    user_id: recipient.user_id,
    user_type: evt.audience === "employer" ? "employer" : "jobseeker",
    recipient_name: recipient.name,
    channels_requested: evt.channels,
    results,
    total_sent: totalSent,
    total_failed: totalFailed,
    triggered_by: "queue",
    trigger_source: "email-api",
    metadata: {
      trigger_id: row.id
    }
  }).then(() => null).catch(() => null);
  return {
    ok: totalSent > 0 || totalFailed === 0,
    channels: results
  };
}
serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  const requestId = crypto.randomUUID().substring(0, 8);
  const startTime = Date.now();
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const oneSignalAppId = isFcmConfigured() ? 'firebase' : '';
    const oneSignalApiKey = isFcmConfigured() ? 'firebase' : '';

    // -------------------------------------------------------------------
    // Path-based routes (merged from notification-track) — handled BEFORE
    // JSON parsing because these are GETs / public tracking endpoints.
    // -------------------------------------------------------------------
    const reqUrl = new URL(req.url);
    const subPath = reqUrl.pathname.replace(/^.*\/email-api/, "") || "/";
    const ua = req.headers.get("user-agent") ?? null;

    if (subPath === '/developer-oauth-apps' || req.headers.get('x-developer-oauth-apps') === '1') {
      const response = await handleDeveloperOAuthApps(req);
      return new Response(response.body, { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Public Email API for developers (Developer Portal wfh_ key) and its inbox → webhook poller (cron).
    if ((req.headers.get('x-api-key') || '').startsWith('wfh_')) return await trackApiResponse(req, () => handlePublicEmailApi(req));
    if (subPath.startsWith('/email-api-poll')) {
      const out = await pollEmailWebhooks();
      return new Response(JSON.stringify({ success: true, ...out }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // -------------------------------------------------------------------
    // MERGED SUB-FUNCTIONS — one deployed notification function.
    // Old standalone functions now live under ./legacy and are routed here.
    // -------------------------------------------------------------------
    if (subPath.startsWith('/telegram')) return await telegramHandler(req);
    // Per-user Discord / Slack / Twitch AI auto-reply bots.
    if (subPath.startsWith('/chat-bots')) {
      const rawBody = await req.text();
      let cbBody: any = {};
      try { cbBody = rawBody ? JSON.parse(rawBody) : {}; } catch { cbBody = {}; }
      const cbAction = (reqUrl.searchParams.get('action') || cbBody?.action || '') as ChatBotAction;
      if (!CHAT_BOT_ACTIONS.includes(cbAction)) {
        return new Response(JSON.stringify({ success: false, error: 'unknown_action' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      try {
        const out = await handleChatBotAction(cbAction, req, cbBody, reqUrl, supabaseUrl, rawBody);
        if (out && typeof out === 'object' && '__raw' in out) {
          return new Response(String(out.__raw), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
          });
        }
        return new Response(JSON.stringify(out), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (e: any) {
        console.error('[chat-bots]', cbAction, e);
        const msg = e?.message || 'Request failed';
        const status = String(msg).startsWith('AUTH_REQUIRED') ? 401 : 400;
        return new Response(JSON.stringify({ success: false, error: msg }), {
          status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    if (subPath.startsWith('/email-trigger')) return await emailTriggerHandler(req);
    if (subPath.startsWith('/send-email')) return await sendEmailHandler(req);
    if (subPath.startsWith('/channel-preference')) return await channelPreferenceHandler(req);
    if (subPath.startsWith('/account-deleted')) return await accountDeletedHandler(req);
    if (subPath.startsWith('/signup-email-otp')) return await signupEmailOtpHandler(req);
    if (subPath.startsWith('/profile-completion-reminders')) return await profileCompletionRemindersHandler(req);
    // Supabase Auth Send Email hook (verify signup, password reset, magic link,
    // email change). Protected by its webhook signature, so no user session.
    if (subPath.startsWith('/auth-hook')) return await authHookHandler(req);
    // Supabase Auth Send Email hook (verify signup, password reset, magic link,
    // email change). Protected by its webhook signature, so no user session.
    if (req.method === "GET" && subPath.endsWith("/open")) {
      const p = reqUrl.searchParams;
      await logTrackEvent(supabase, {
        user_id: p.get("u"),
        event_type: p.get("e") ?? "unknown",
        channel: p.get("c") ?? "email",
        action: "opened",
        variant_id: p.get("v"),
        message_log_id: p.get("m"),
        user_agent: ua
      });
      return new Response(TRACK_PIXEL, {
        headers: {
          ...corsHeaders,
          "Content-Type": "image/gif",
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          "Pragma": "no-cache"
        }
      });
    }
    if (req.method === "GET" && subPath.endsWith("/click")) {
      const p = reqUrl.searchParams;
      const to = safeTrackRedirect(p.get("to"));
      await logTrackEvent(supabase, {
        user_id: p.get("u"),
        event_type: p.get("e") ?? "unknown",
        channel: p.get("c") ?? "unknown",
        action: "clicked",
        variant_id: p.get("v"),
        message_log_id: p.get("m"),
        user_agent: ua,
        metadata: {
          to
        }
      });
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          Location: to,
          "Cache-Control": "no-store"
        }
      });
    }

    // GET-only health/info ping (replaces standalone tracker root)
    if (req.method === "GET") {
      return new Response(JSON.stringify({
        ok: true,
        service: "email-api",
        endpoints: ["/open", "/click", "POST /event", "POST {action:track_event|run_learning_engine|...}"]
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }

    // POST /event — raw track event (legacy notification-track contract)
    if (req.method === "POST" && subPath.endsWith("/event")) {
      let evBody: any = {};
      try {
        evBody = await req.json();
      } catch {/* ignore */}
      const action = String(evBody?.action ?? "").toLowerCase();
      const allowed = new Set(["sent", "delivered", "opened", "clicked", "dismissed", "converted", "unsubscribed", "bounced"]);
      if (!allowed.has(action)) {
        return new Response(JSON.stringify({
          error: "invalid_action"
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
      await logTrackEvent(supabase, {
        user_id: evBody?.user_id ?? null,
        event_type: String(evBody?.event_type ?? "unknown"),
        channel: String(evBody?.channel ?? "unknown"),
        action,
        variant_id: evBody?.variant_id ?? null,
        message_log_id: evBody?.message_log_id ?? null,
        user_agent: ua,
        metadata: evBody?.metadata ?? {}
      });
      return new Response(JSON.stringify({
        ok: true
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const body = await req.json();
    const {
      action
    } = body;
    // The gateway can route nested function URLs to this root handler.
    // Dispatch support mail by action as well as by the legacy subpath.
    if (isSupportAction(action)) {
      try {
        const result = await handleSupportAction(action, req, body);
        return new Response(JSON.stringify(result), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : 'Support settings request failed' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }
    if (isSupportMailAction(action)) {
      try {
        const result = await handleSupportMailAction(action, req, body);
        return new Response(JSON.stringify(result), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : 'Support email request failed' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }
    // ==========================================
    // ACTION: report_payment_event
    // Browser reports a payment outcome (success / failed / cancelled) so the
    // user instantly gets an in-app notification + push for every Razorpay flow.
    // ==========================================
    if (action === 'report_payment_event') {
      const authHeader = req.headers.get('Authorization') ?? '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      const {
        data: authData
      } = token ? await supabase.auth.getUser(token) : {
        data: {
          user: null
        }
      } as any;
      const eventUser = authData?.user;
      if (!eventUser) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Unauthorized'
        }), {
          status: 401,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      const allowedStatuses: PaymentStatus[] = ['success', 'failed', 'cancelled'];
      const eventStatus = body.status as PaymentStatus;
      if (!allowedStatuses.includes(eventStatus)) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid status'
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      const clip = (v: unknown, max: number) => typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;
      const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
      await notifyPayment(supabase, {
        userId: eventUser.id,
        status: eventStatus,
        itemName: clip(body.item_name, 120) ?? 'Payment',
        amountInr: num(body.amount_inr),
        pointsSpent: num(body.points_spent),
        pointsAdded: num(body.points_added),
        method: body.method === 'wallet' ? 'wallet' : 'razorpay',
        paymentId: clip(body.payment_id, 100),
        orderId: clip(body.order_id, 100),
        actionUrl: clip(body.action_url, 200) ?? undefined,
        failureReason: clip(body.reason, 200),
        transactionType: clip(body.transaction_type, 40) as any ?? 'purchase'
      });
      return new Response(JSON.stringify({
        success: true,
        notified: eventStatus
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // ==========================================
    // ACTION: points_ledger_event
    // Called by the points_transactions database trigger: every points credit or
    // debit sends the user an instant notification + push.
    // ==========================================
    if (action === 'points_ledger_event') {
      const providedSecret = req.headers.get('x-points-trigger-secret') ?? '';
      const {
        data: secretRow
      } = await supabase.from('app_secrets').select('value').eq('key', 'points_notify_secret').maybeSingle();
      const expectedSecret = secretRow?.value ?? '';
      if (!expectedSecret || providedSecret !== expectedSecret) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Unauthorized'
        }), {
          status: 401,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      const pointsUserId = typeof body.user_id === 'string' ? body.user_id : null;
      const pointsAmount = Number(body.points_amount);
      if (!pointsUserId || !Number.isFinite(pointsAmount) || pointsAmount === 0) {
        return new Response(JSON.stringify({
          success: true,
          status: 'skipped'
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }

      // A payment flow may have just sent a detailed receipt for the same points
      // movement — skip the ledger notification in that case to avoid duplicates.
      const dedupeSince = new Date(Date.now() - 120_000).toISOString();
      const {
        data: recentPaymentNotifications
      } = await supabase.from('notifications').select('id, metadata').eq('user_id', pointsUserId).eq('type', 'payment').gte('created_at', dedupeSince).order('created_at', {
        ascending: false
      }).limit(5);
      const alreadyNotified = (recentPaymentNotifications ?? []).some((row: any) => {
        const meta = row?.metadata ?? {};
        const added = Number(meta.points_added ?? 0);
        const spent = Number(meta.points_spent ?? 0);
        return pointsAmount > 0 ? added === pointsAmount : spent === Math.abs(pointsAmount);
      });
      if (alreadyNotified) {
        return new Response(JSON.stringify({
          success: true,
          status: 'skipped',
          reason: 'payment_receipt_sent'
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      const pointsResult = await notifyPoints(supabase, {
        userId: pointsUserId,
        pointsAmount,
        balanceAfter: Number.isFinite(Number(body.points_balance_after)) ? Number(body.points_balance_after) : null,
        description: typeof body.description === 'string' ? body.description.slice(0, 200) : null,
        transactionType: typeof body.transaction_type === 'string' ? body.transaction_type : null,
        transactionId: typeof body.id === 'string' ? body.id : null
      });
      return new Response(JSON.stringify({
        success: true,
        status: pointsResult.skipped ? 'skipped' : 'sent'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // ==========================================
    // ACTION: track_event — JSON-action variant of /event
    // ==========================================
    if (action === 'track_event') {
      const trackAction = String(body?.track_action ?? body?.event_action ?? "").toLowerCase();
      const allowed = new Set(["sent", "delivered", "opened", "clicked", "dismissed", "converted", "unsubscribed", "bounced"]);
      if (!allowed.has(trackAction)) {
        return new Response(JSON.stringify({
          error: "invalid_action"
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
      await logTrackEvent(supabase, {
        user_id: body?.user_id ?? null,
        event_type: String(body?.event_type ?? "unknown"),
        channel: String(body?.channel ?? "unknown"),
        action: trackAction,
        variant_id: body?.variant_id ?? null,
        message_log_id: body?.message_log_id ?? null,
        user_agent: ua,
        metadata: body?.metadata ?? {}
      });
      return new Response(JSON.stringify({
        ok: true
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }

    // ==========================================
    // ACTION: run_learning_engine — merged from notification-learning-engine
    // ==========================================
    if (action === 'run_learning_engine') {
      const sinceHours = body?.force_full ? 24 * 30 : 168;
      const [usersUpdated, variantsUpdated] = await Promise.all([rebuildUserIntelligence(supabase, sinceHours), rebuildVariantPerformance(supabase)]);
      const ms = Date.now() - startTime;
      return new Response(JSON.stringify({
        ok: true,
        users_updated: usersUpdated,
        variants_updated: variantsUpdated,
        ms
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }

    // ==========================================
    // ACTION: channel_preference — Email Notifications switch (Settings)
    // Saves the user's own email switch and sends the matching owner-configured
    // confirmation email. Job seekers and employers have their own templates,
    // and the confirmation bypasses the switch itself so the final "OFF" email
    // still reaches the user.
    // ==========================================
    if (action === 'channel_preference') {
      const authHeader = req.headers.get('Authorization') || '';
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      // Validate the caller's token with the service client: the anon key is
      // not guaranteed to be present in this project's function environment.
      const {
        data: userData,
        error: authError
      } = token ? await supabase.auth.getUser(token) : {
        data: null,
        error: new Error('missing Authorization header')
      };
      const authUser = userData?.user;
      if (!authUser) {
        console.error(`[${requestId}] channel_preference auth failed: ${authError?.message || 'no user'}`);
        return new Response(JSON.stringify({
          success: false,
          error: 'Unauthorized'
        }), {
          status: 401,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      const audience = body?.audience === 'employer' ? 'employer' : 'job_seeker';
      const enabled = body?.enabled === true;
      const userId = authUser.id;
      const prefTable = audience === 'employer' ? 'employer_settings' : 'user_settings';
      const {
        error: saveError
      } = await supabase.from(prefTable).upsert({
        user_id: userId,
        email_notifications: enabled
      }, {
        onConflict: 'user_id'
      });
      if (saveError) {
        return new Response(JSON.stringify({
          success: false,
          error: saveError.message
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      const templateKey = audience === 'employer' ? enabled ? 'employer_email_notifications_on' : 'employer_email_notifications_off' : enabled ? 'email_notifications_on' : 'email_notifications_off';
      let prefCompanyName: string | null = null;
      if (audience === 'employer') {
        const {
          data: company
        } = await supabase.from('companies').select('company_name').eq('user_id', userId).maybeSingle();
        prefCompanyName = company?.company_name ? String(company.company_name) : null;
      }
      const prefFanout = await fanoutLifecycleChannels(supabase, {
        userId,
        templateKey,
        channels: ['email'],
        bypassPreferences: true,
        // The signed-in account's own address is the reliable recipient here.
        email: authUser.email || null,
        variables: {
          email: authUser.email || '',
          ...(prefCompanyName ? {
            company: prefCompanyName
          } : {})
        },
        fallbackTitle: enabled ? 'Email notifications are now ON' : 'Email notifications are now OFF',
        fallbackMessage: enabled ? 'Email notifications for your Workly India account are now ON. You will receive job and account updates on this email.' : 'Email notifications for your Workly India account are now OFF. You can turn them back on any time from Settings.'
      });
      return new Response(JSON.stringify({
        success: true,
        channel: 'email',
        enabled,
        template: templateKey,
        delivery: prefFanout.email
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // ==========================================
    // ACTION: get_app_id - Return OneSignal App ID
    // ==========================================
    if (action === 'get_app_id') {
      return new Response(JSON.stringify({
        app_id: oneSignalAppId
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      });
    }

    // ==========================================
    // ACTION: check_config - Verify credentials
    // ==========================================
    if (action === 'check_config' || action === 'check-config') {
      return new Response(JSON.stringify({
        status: 'success',
        message: 'Firebase credentials configured',
        configured: {
          appId: !!oneSignalAppId,
          apiKey: !!oneSignalApiKey
        }
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      });
    }

    // ==========================================
    // ACTION: push_config — PUBLIC Firebase web config for browser registration
    // (merged from the old push-config function; must run BEFORE credential checks)
    // ==========================================
    if (action === 'push_config' || action === 'push-config') {
      const account = getServiceAccount();
      const apiKey = Deno.env.get('FIREBASE_WEB_API_KEY') ?? '';
      const appId = Deno.env.get('FIREBASE_APP_ID') ?? '';
      const vapidKey = Deno.env.get('FIREBASE_VAPID_KEY') ?? '';
      const projectId = Deno.env.get('FIREBASE_PROJECT_ID') ?? account?.project_id ?? '';
      const messagingSenderId = Deno.env.get('FIREBASE_MESSAGING_SENDER_ID') ?? appId.split(':')[1] ?? '';
      const configured = Boolean(apiKey && appId && vapidKey && projectId && messagingSenderId);
      return new Response(JSON.stringify({
        configured,
        config: {
          apiKey,
          projectId,
          appId,
          messagingSenderId
        },
        vapidKey
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      });
    }

    // ==========================================
    // ACTION: send_push_raw — merged from the old send-push function.
    // Accepts { userIds?: string[], tokens?: string[], title, body|message, url, icon, image, actions, data }
    // ==========================================
    if (action === 'send_push_raw' || action === 'send_push_fcm') {
      if (!isFcmConfigured()) {
        return new Response(JSON.stringify({
          status: 'error',
          error: 'Firebase is not configured (FIREBASE_SERVICE_ACCOUNT_JSON missing)'
        }), {
          status: 503,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      const asStringArray = (value: unknown): string[] => Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v.length > 0) : [];
      const asStr = (value: unknown): string | undefined => typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
      const title = asStr(body.title);
      const bodyText = asStr(body.body) ?? asStr(body.message);
      if (!title || !bodyText) {
        return new Response(JSON.stringify({
          status: 'error',
          error: 'title and body are required'
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      if (title.length > 200 || bodyText.length > 1000) {
        return new Response(JSON.stringify({
          status: 'error',
          error: 'title or body too long'
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      const userIds = asStringArray(body.userIds ?? body.user_ids);
      const tokens = asStringArray(body.tokens);
      if (userIds.length === 0 && tokens.length === 0) {
        return new Response(JSON.stringify({
          status: 'error',
          error: 'userIds or tokens required'
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      if (userIds.length > 500 || tokens.length > 500) {
        return new Response(JSON.stringify({
          status: 'error',
          error: 'too many recipients in one call (max 500)'
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
      const isServiceRole = Boolean(serviceKey) && bearer === serviceKey;
      if (!isServiceRole) {
        if (!bearer) {
          return new Response(JSON.stringify({
            status: 'error',
            error: 'Unauthorized'
          }), {
            status: 401,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
        const {
          data: userData,
          error: userError
        } = await supabase.auth.getUser(bearer);
        if (userError || !userData?.user) {
          return new Response(JSON.stringify({
            status: 'error',
            error: 'Unauthorized'
          }), {
            status: 401,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
        if (userIds.length > 0) {
          const { data: roleRows, error: roleError } = await supabase
            .from('user_roles').select('role').eq('user_id', userData.user.id);
          if (roleError) {
            console.error('send_push_raw role lookup failed:', roleError.message);
            return new Response(JSON.stringify({ status: 'error', error: 'Could not verify administrator permissions' }), {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          const isPrivileged = (roleRows ?? []).some((row: { role: string }) => row.role === 'owner' || row.role === 'admin');
          if (!isPrivileged) {
            return new Response(JSON.stringify({ status: 'error', error: 'Only an owner or admin can send notifications to users' }), {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        }
        if (tokens.length > 0) {
          return new Response(JSON.stringify({
            status: 'error',
            error: 'Raw token sending is server-only'
          }), {
            status: 403,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
      }
      const payload: PushPayload = {
        title,
        body: bodyText,
        url: asStr(body.url) ?? asStr(body.actionUrl),
        icon: asStr(body.icon),
        image: capPushImageUrl(asStr(body.image)),
        actions: Array.isArray(body.actions)
          ? body.actions.slice(0, 2).flatMap((candidate: unknown) => {
              if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return [];
              const action = candidate as Record<string, unknown>;
              const actionId = asStr(action.action) ?? asStr(action.id);
              const actionTitle = asStr(action.title) ?? asStr(action.text);
              if (!actionId || !actionTitle) return [];
              return [{
                action: actionId.slice(0, 50),
                title: actionTitle.slice(0, 50),
                url: asStr(action.url),
                icon: asStr(action.icon),
              }];
            })
          : undefined,
        tag: asStr(body.tag)?.slice(0, 120),
        requireInteraction: body.requireInteraction === true ? true : undefined,
        data: body.data && typeof body.data === 'object' && !Array.isArray(body.data) ? Object.fromEntries(Object.entries(body.data as Record<string, unknown>).map(([k, v]) => [k, String(v)])) : undefined
      };
      const results = [];
      if (userIds.length > 0) results.push(await sendToUsers(supabase, userIds, payload));
      if (tokens.length > 0) results.push(await sendToTokens(tokens, payload));
      const sent = results.reduce((n, r) => n + r.sent, 0);
      const failed = results.reduce((n, r) => n + r.failed, 0);
      const errors = results.flatMap(r => r.errors).slice(0, 5);
      return new Response(JSON.stringify({
        status: sent > 0 ? 'success' : 'error',
        success: sent > 0,
        sent,
        failed,
        errors
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // ==========================================
    // ACTION: send_android_release_push — owner-only broadcast after manual APK publication.
    if (action === 'send_android_release_push') {
      if (!isFcmConfigured()) {
        return new Response(JSON.stringify({ success: false, error: 'Firebase is not configured' }), {
          status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
      if (!bearer) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const { data: userData, error: userError } = await supabase.auth.getUser(bearer);
      if (userError || !userData?.user) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const { data: roleRows, error: roleError } = await supabase.from('user_roles')
        .select('role').eq('user_id', userData.user.id);
      if (roleError || !(roleRows ?? []).some((row: { role: string }) => row.role === 'owner' || row.role === 'admin')) {
        return new Response(JSON.stringify({ success: false, error: 'Only an owner or admin can publish Android updates' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const versionName = typeof body.version_name === 'string' ? body.version_name.trim().slice(0, 40) : '';
      const versionCode = typeof body.version_code === 'number' ? body.version_code : Number(body.version_code);
      if (!versionName || !Number.isInteger(versionCode) || versionCode <= 0) {
        return new Response(JSON.stringify({ success: false, error: 'A valid version name and version code are required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const { data: template, error: templateError } = await supabase.from('push_lifecycle_templates')
        .select('*').eq('event_type', 'android_app_update').maybeSingle();
      if (templateError) throw templateError;
      if (!template || template.enabled === false || !template.title || !template.body) {
        return new Response(JSON.stringify({ success: true, sent: 0, skipped: true, reason: 'Android update notification template is disabled or empty' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const { data: deviceRows, error: deviceError } = await supabase.from('push_subscriptions')
        .select('fcm_token').eq('platform', 'android').eq('enabled', true).not('fcm_token', 'is', null);
      if (deviceError) throw deviceError;
      const tokens = [...new Set((deviceRows ?? []).map((row: { fcm_token: string | null }) => row.fcm_token).filter((token): token is string => Boolean(token)))];
      if (tokens.length === 0) {
        return new Response(JSON.stringify({ success: true, sent: 0, failed: 0, message: 'No registered Android devices were found' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const replaceVersion = (value: string) => value.replace(/\\{\\{version_name\\}\\}/g, versionName);
      const targetUrl = absolutePushUrl(template.button_url || '/');
      const result = await sendToTokens(tokens, {
        title: replaceVersion(String(template.title)),
        body: replaceVersion(String(template.body)),
        url: targetUrl,
        icon: template.icon_url || undefined,
        image: capPushImageUrl(template.image_url),
        tag: `workly-android-update-${versionCode}`,
        priority: 'high',
        data: { type: 'android_app_update', version_code: String(versionCode), url: targetUrl }
      });
      return new Response(JSON.stringify({
        success: result.sent > 0,
        sent: result.sent,
        failed: result.failed,
        recipients: tokens.length,
        errors: result.errors.slice(0, 5)
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ACTION: send_lifecycle_push — welcome / goodbye push using the
    // owner-configured template in public.push_lifecycle_templates.
    // Body: { event: 'subscribe' | 'unsubscribe', token: string }
    // ==========================================
    if (action === 'send_lifecycle_push') {
      if (!isFcmConfigured()) {
        return new Response(JSON.stringify({
          status: 'error',
          error: 'Firebase is not configured'
        }), {
          status: 503,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      const event = typeof body.event === 'string' && /^[a-z0-9_]{1,64}$/.test(body.event) ? body.event : 'subscribe';
      const isTest = body.test === true;
      const token = typeof body.token === 'string' ? body.token.trim() : '';
      if (!token) {
        return new Response(JSON.stringify({
          status: 'error',
          error: 'token is required'
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      const isServiceRole = Boolean(serviceKey) && bearer === serviceKey;
      if (!isServiceRole) {
        if (!bearer) {
          return new Response(JSON.stringify({
            status: 'error',
            error: 'Unauthorized'
          }), {
            status: 401,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
        const {
          data: userData,
          error: userError
        } = await supabase.auth.getUser(bearer);
        if (userError || !userData?.user) {
          return new Response(JSON.stringify({
            status: 'error',
            error: 'Unauthorized'
          }), {
            status: 401,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
        // Normal lifecycle sends can target only the caller's own token. Owner
        // tests may target their current browser token before its row is synced.
        const {
          data: owned
        } = await supabase.from('push_subscriptions').select('id').eq('fcm_token', token).eq('user_id', userData.user.id).limit(1);
        // NOTE: has_role() is overloaded in this database, so an RPC call is
        // ambiguous (PGRST203). Read the role table directly instead.
        let isPrivileged = false;
        if (isTest) {
          const {
            data: roleRows,
            error: roleError
          } = await supabase.from('user_roles').select('role').eq('user_id', userData.user.id);
          if (roleError) console.error('role lookup failed:', roleError.message);
          isPrivileged = (roleRows ?? []).some((r: {
            role: string;
          }) => r.role === 'owner' || r.role === 'admin');
        }
        if ((!owned || owned.length === 0) && !isPrivileged) {
          return new Response(JSON.stringify({
            status: 'error',
            error: 'This device is not registered for notifications'
          }), {
            status: 403,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
      }
      const {
        data: template
      } = await supabase.from('push_lifecycle_templates').select('*').eq('event_type', resolveTemplateKey(event)).maybeSingle();
      if (!template || template.enabled === false || !template.title || !template.body) {
        return new Response(JSON.stringify({
          status: 'skipped',
          success: false,
          reason: 'template disabled or empty'
        }), {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }

      // Real data (or sample data on a test send) fills the {{placeholders}}.
      const lifecycleVars = await enrichTemplateValues(supabase, {
        userId: typeof (body as any).user_id === 'string' ? (body as any).user_id : '',
        templateKey: resolveTemplateKey(event),
        values: buildPushVariables((body as any).variables as Record<string, unknown> | undefined, (body as any).data as Record<string, unknown> | undefined)
      });
      const filled = applyPushTemplate(template, lifecycleVars, {
        title: String(template.title),
        message: String(template.body)
      });
      const lifecycleUrl = absolutePushUrl(filled.buttonUrl || '/');
      const lifecycleActions = filled.buttonText ? [{
        action: 'open',
        title: filled.buttonText,
        url: lifecycleUrl
      }] : [];
      let lifecycleResult;
      try {
        lifecycleResult = await sendToTokens([token], {
          title: isTest ? `[TEST] ${filled.title}` : filled.title,
          body: filled.message,
          url: lifecycleUrl,
          icon: template.icon_url || undefined,
          image: capPushImageUrl(template.image_url),
          actions: lifecycleActions,
          // A unique tag per event so 26 test pushes do not replace each other.
          tag: `lifecycle-${event}${isTest ? `-${Date.now()}` : ''}`,
          priority: 'high'
        });
      } catch (sendError) {
        const detail = sendError instanceof Error ? sendError.message : String(sendError);
        console.error(`lifecycle push send failed (${event}):`, detail);
        return new Response(JSON.stringify({
          status: 'error',
          success: false,
          error: detail
        }), {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      if (lifecycleResult.sent === 0) {
        console.error(`lifecycle push not delivered (${event}):`, lifecycleResult.errors.join(' | '));
      }
      return new Response(JSON.stringify({
        status: lifecycleResult.sent > 0 ? 'success' : 'error',
        success: lifecycleResult.sent > 0,
        sent: lifecycleResult.sent,
        failed: lifecycleResult.failed,
        error: lifecycleResult.sent > 0 ? undefined : lifecycleResult.errors[0] ?? 'Push not delivered',
        errors: lifecycleResult.errors.slice(0, 3)
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // Validate credentials for other actions
    if (!oneSignalAppId || !oneSignalApiKey) {
      throw new Error('Firebase credentials not configured');
    }

    // ==========================================
    // ACTION: send_push - Send push to user
    // ==========================================
    if (action === 'send_push') {
      const {
        user_id,
        data
      } = body;
      let {
        title,
        message,
        action_url,
        image_url,
        button_text
      } = body;
      if (!user_id || !title || !message) {
        throw new Error('Missing required fields: user_id, title, message');
      }

      // Banned users receive no notifications until unbanned (push token stays
      // stored — only delivery stops). Ban/unban notices themselves are exempt.
      const rawEventKey = typeof body.event_type === 'string' && body.event_type ? body.event_type : data && typeof data.type === 'string' ? data.type : null;
      const requestedEmployerSide = (body as any).audience ? (body as any).audience === 'employer' : Boolean(rawEventKey && isEmployerEvent(resolveTemplateKey(rawEventKey)));
      const banSide = requestedEmployerSide ? 'employer' : 'job_seeker';
      if (!isBanExemptEvent(rawEventKey) && (await isUserBanned(supabase, user_id, {
        side: banSide,
        checkAuth: true
      }))) {
        return new Response(JSON.stringify({
          status: 'skipped',
          sent: false,
          reason: 'user_banned'
        }), {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }

      // Owner-configured template override (Owner Portal → Push Templates)
      const rawTemplateKey = typeof body.event_type === 'string' && body.event_type ? body.event_type : data && typeof data.type === 'string' ? data.type : null;
      const templateKey = rawTemplateKey ? resolveTemplateKey(rawTemplateKey) : null;
      const employerSide = (body as any).audience ? (body as any).audience === 'employer' : Boolean(templateKey && isEmployerEvent(templateKey));

      // "Hi {{name}}," is the most used line in every template. When the caller
      // does not send a name, look it up (profile for job seekers, company for
      // employers) so the greeting is never dropped from the message.
      const incomingVars = ((body as any).variables ?? {}) as Record<string, unknown>;
      const incomingName = typeof incomingVars.name === 'string' ? incomingVars.name.trim() : '';
      let resolvedName = incomingName;
      if (!resolvedName && templateKey && user_id) {
        resolvedName = (await resolveDisplayName(supabase, user_id, templateKey, employerSide ? 'employer' : 'jobseeker')) || '';
      }
      const callerVariables: Record<string, unknown> = resolvedName ? {
        ...incomingVars,
        name: resolvedName
      } : (() => {
        const v = {
          ...incomingVars
        };
        delete v.name;
        return v;
      })();

      // ---- Live fan-out: Email + Telegram for the same event ----------------
      // Owner Portal → Email Templates / TG Templates. Enabled templates are
      // delivered automatically; a channel failure never blocks the push, and a
      // disabled PUSH template must not stop email/telegram delivery either.
      let fanout: Awaited<ReturnType<typeof fanoutLifecycleChannels>> | null = null;
      if (templateKey && user_id && (body as any).skip_fanout !== true) {
        const fanoutVars = buildPushVariables(callerVariables, data as Record<string, unknown> | undefined, typeof (body as any).occurred_at === 'string' ? (body as any).occurred_at : undefined);

        // Events that belong to neither side (payments, wallet, referrals…) go to
        // BOTH profiles of a shared login, each with its own switches, mailbox
        // and bot. Side-specific events stay on their own side.
        const explicitAudience = (body as any).audience ? employerSide ? 'employer' as const : 'jobseeker' as const : undefined;
        fanout = await fanoutLifecycleBothSides(supabase, {
          userId: user_id,
          templateKey,
          variables: fanoutVars,
          audience: explicitAudience,
          fallbackTitle: title,
          fallbackMessage: message
        });
      }
      let templateApplied = false;
      if (templateKey) {
        const {
          data: pushTemplate
        } = await supabase.from('push_lifecycle_templates').select('*').eq('event_type', templateKey).maybeSingle();
        if (pushTemplate) {
          if (pushTemplate.enabled === false) {
            return new Response(JSON.stringify({
              status: 'skipped',
              sent: false,
              fanout,
              reason: `Push template "${templateKey}" is disabled`
            }), {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
          templateApplied = true;
          const pushVars = await enrichTemplateValues(supabase, {
            userId: user_id,
            templateKey,
            employerSide,
            values: buildPushVariables(callerVariables, data as Record<string, unknown> | undefined, typeof (body as any).occurred_at === 'string' ? (body as any).occurred_at : undefined)
          });
          const filledPush = applyPushTemplate(pushTemplate, pushVars, {
            title,
            message
          });
          title = filledPush.title;
          message = filledPush.message;
          if (filledPush.buttonText) button_text = filledPush.buttonText;
          if (filledPush.buttonUrl) action_url = filledPush.buttonUrl;
          if (pushTemplate.image_url) image_url = String(pushTemplate.image_url);
        }
      }

      // A shared login can own both profiles. Each side's push switch decides
      // independently even though both notifications use the same device token.
      // For events that belong to neither side (payments, wallet, referrals…)
      // the push goes out when EITHER profile still has push switched on, so a
      // dual-profile account never loses the message because of the other side.
      const readPushSwitch = async (table: string): Promise<boolean | null> => {
        const {
          data
        } = await supabase.from(table).select('push_notifications').eq('user_id', user_id).maybeSingle();
        if (!data) return null;
        return data.push_notifications !== false;
      };
      const pushSettingsTable = employerSide ? 'employer_settings' : 'user_settings';
      const otherSettingsTable = employerSide ? 'user_settings' : 'employer_settings';
      const ownPushAllowed = await readPushSwitch(pushSettingsTable);
      const neutralSide = !(body as any).audience && templateKey ? isNeutralEvent(templateKey) : false;
      const otherPushAllowed = ownPushAllowed === false && neutralSide ? await readPushSwitch(otherSettingsTable) : null;
      if (ownPushAllowed === false && otherPushAllowed !== true) {
        return new Response(JSON.stringify({
          status: 'skipped',
          success: true,
          sent: false,
          fanout,
          reason: `${employerSide ? 'Employer' : 'Job seeker'} push notifications are turned off`
        }), {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }

      // Get user's notification tokens
      // Every device this login has enabled — one account can be signed in on
      // the phone and the laptop, and both must ring for the same event.
      const {
        data: tokens,
        error: tokensError
      } = await supabase.from('push_subscriptions').select('player_id:fcm_token').eq('user_id', user_id).eq('enabled', true).order('updated_at', {
        ascending: false
      }).limit(20);
      if (tokensError) throw new Error('Failed to fetch notification tokens');
      if (!tokens || tokens.length === 0) {
        return new Response(JSON.stringify({
          status: 'success',
          message: 'No active notification tokens found',
          sent: false,
          fanout,
          error: 'NO_TOKENS'
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 200
        });
      }
      const playerIds = tokens.map(t => t.player_id);
      const fullActionUrl = ensureFullUrl(action_url);

      // 🤖 AI rephrase — only for SYSTEM-triggered pushes (job alerts, reminders, etc.)
      // When the AI chat / user explicitly authored the title+message (skip_rephrase=true),
      // we MUST honor their exact text — otherwise generic templates like
      // "🖼️ New Image Alert! / New notification" overwrite the real content.
      // Owner templates are authored text — never let the AI rewrite them.
      const skipRephrase = (body as any).skip_rephrase === true || templateApplied;
      let finalTitle = title;
      let finalMessage = message;
      if (!skipRephrase) {
        const evType = deriveEventType((body as any).event_type, title);
        const lang = await getUserLanguage(supabase, user_id);
        const composed = await composeNotification({
          eventType: evType,
          channel: 'push',
          audience: (body as any).audience || 'user',
          language: lang,
          variables: (body as any).variables || {},
          fallbackTitle: title,
          fallbackMessage: message
        });
        finalTitle = composed.title || title;
        finalMessage = composed.message || message;
      } else {}
      const btnLabel = button_text && String(button_text).trim() || 'View';
      // Brand assets — kept as PUBLIC URLs because OneSignal must fetch them.
      // - LARGE_ICON / chrome_web_icon: full-color square logo (>= 192x192 PNG).
      // - SMALL_ICON / chrome_web_badge: monochrome transparent PNG (96x96)
      //   — this is what shows in the system tray / Chrome notification bar.
      //   If we pass a multi-color rectangular logo here Chrome silently drops
      //   the badge, which is exactly the "icon/badge nahi dikh raha" symptom
      //   the user reported.
      const LARGE_ICON = await getBrandLogoUrl(supabase);
      const SMALL_ICON = `${WEBSITE_DOMAIN}/icons/notification-badge.png`;
      // Always force an absolute URL — even if action_url was empty we open the home page
      // (better than OneSignal silently dropping the notification or opening "about:blank",
      // which is the "link error" the user reported).
      const safeActionUrl = fullActionUrl || WEBSITE_DOMAIN;
      const notificationPayload: any = {
        app_id: oneSignalAppId,
        include_subscription_ids: playerIds,
        headings: {
          en: finalTitle
        },
        contents: {
          en: finalMessage
        },
        // Chrome's large notification artwork is the source-platform icon
        // (WhatsApp/Instagram/Facebook/Messenger) when the event identifies it.
        // Workly remains the notification badge and native Android large icon.
        chrome_web_icon: getSocialChromeIcon(data) || LARGE_ICON,
        chrome_web_badge: SMALL_ICON,
        small_icon: 'ic_stat_onesignal_default',
        // Android resource name
        large_icon: LARGE_ICON,
        url: safeActionUrl,
        data: {
          ...(data || {}),
          url: safeActionUrl,
          action_url: safeActionUrl
        },
        web_buttons: [{
          id: 'view',
          text: btnLabel,
          url: safeActionUrl,
          icon: LARGE_ICON
        }],
        buttons: [{
          id: 'view',
          text: btnLabel,
          url: safeActionUrl,
          icon: LARGE_ICON
        }],
        // A shared device can receive both profile sides. A unique tag/topic
        // prevents Chrome/Android from replacing the first side with the second.
        tag: `${employerSide ? 'employer' : 'jobseeker'}-${templateKey || 'push'}-${Date.now()}`,
        web_push_topic: `${employerSide ? 'employer' : 'jobseeker'}-${Date.now()}`,
        priority: 10
      };

      // Rich media — show a card image in push (Android big_picture, iOS attachment, web large image)
      // Size-capped via wsrv.nl so each receiving device downloads ~50-90 KB, not the full original.
      const pushImageUrl = capPushImageUrl(image_url);
      if (pushImageUrl) {
        notificationPayload.big_picture = pushImageUrl; // Android
        notificationPayload.chrome_web_image = pushImageUrl; // Web push (Chrome/Edge)
        notificationPayload.huawei_big_picture = pushImageUrl; // Huawei
        notificationPayload.ios_attachments = {
          card: pushImageUrl
        }; // iOS
      }

      // One event = one push. The same status update can reach this endpoint
      // from several triggers; a short-lived claim keeps only the first send.
      const mayPush = await claimSend(supabase, user_id, 'push', `${employerSide ? 'employer' : 'jobseeker'}:${templateKey || 'push'}`, `${playerIds.join(',')}|${finalTitle}|${finalMessage}`);
      if (!mayPush) {
        return new Response(JSON.stringify({
          status: 'skipped',
          success: true,
          sent: false,
          fanout,
          reason: 'duplicate'
        }), {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      const response = await legacyFetchCompat(supabase, notificationPayload);
      const responseData = await response.json();

      // Har push ka record rakho — owner portal / AI dashboards yahi padhte hain.
      const logPush = async (status: string, errorMessage: string | null, onesignalId: string | null) => {
        try {
          await supabase.from('push_notification_logs').insert({
            user_id,
            status,
            error_message: errorMessage,
            onesignal_id: onesignalId,
            sent_at: new Date().toISOString()
          });
        } catch (logErr) {
          console.warn(`[${requestId}] push log insert failed (ignored):`, logErr);
        }
      };
      if (!response.ok) {
        await logPush('failed', `Firebase push error: ${JSON.stringify(responseData)}`.slice(0, 1000), null);
        throw new Error(`Firebase push error: ${JSON.stringify(responseData)}`);
      }
      await logPush('sent', null, responseData?.id ?? null);
      return new Response(JSON.stringify({
        status: 'success',
        message: 'Notification sent successfully',
        sent: true,
        fanout,
        oneSignalResponse: {
          id: responseData.id,
          recipients: responseData.recipients
        }
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      });
    }

    // ==========================================
    // ACTION: upload_public_image - store a notification banner in public storage
    // ==========================================
    if (action === 'upload_public_image') {
      const {
        filename,
        content_base64,
        content_type
      } = body;
      if (!filename || !content_base64) {
        throw new Error('Missing required fields: filename, content_base64');
      }
      const bin = Uint8Array.from(atob(content_base64), c => c.charCodeAt(0));
      const path = `notifications/${filename}`;
      const {
        error: upErr
      } = await supabase.storage.from('brand-assets').upload(path, bin, {
        contentType: content_type || 'image/jpeg',
        upsert: true
      });
      if (upErr) throw new Error(`Upload failed: ${upErr.message}`);
      const {
        data: pub
      } = supabase.storage.from('brand-assets').getPublicUrl(path);
      return new Response(JSON.stringify({
        status: 'success',
        url: pub.publicUrl
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      });
    }

    // ==========================================
    // ACTION: send_push_direct - Send to player IDs
    // ==========================================
    if (action === 'send_push_direct') {
      const {
        player_ids,
        title,
        message,
        url,
        data,
        image,
        buttons,
        no_ai
      } = body;
      if (!player_ids || !Array.isArray(player_ids) || player_ids.length === 0) {
        throw new Error('Missing required field: player_ids (array)');
      }
      if (!title || !message) {
        throw new Error('Missing required fields: title, message');
      }

      // 🤖 AI rephrase for variety — skipped when the caller wants the exact text
      let finalTitle = title;
      let finalMessage = message;
      if (!no_ai) {
        const evType2 = deriveEventType((body as any).event_type, title);
        const composed2 = await composeNotification({
          eventType: evType2,
          channel: 'push',
          audience: (body as any).audience || 'user',
          language: (body as any).language || 'english',
          variables: (body as any).variables || {},
          fallbackTitle: title,
          fallbackMessage: message
        });
        finalTitle = composed2.title || title;
        finalMessage = composed2.message || message;
      }
      const webButtons = Array.isArray(buttons) && buttons.length ? buttons.slice(0, 2).map((b: any, i: number) => ({
        id: b.id || `act${i}`,
        text: b.text || b.title,
        url: b.url || url
      })) : url ? [{
        id: 'view',
        text: 'View Job',
        url
      }] : undefined;
      const notificationPayload = {
        app_id: oneSignalAppId,
        include_subscription_ids: player_ids,
        headings: {
          en: finalTitle
        },
        contents: {
          en: finalMessage
        },
        ...(url && {
          url
        }),
        ...(data && {
          data
        }),
        ...(capPushImageUrl(image) && {
          big_picture: capPushImageUrl(image)
        }),
        web_buttons: webButtons
      };
      const response = await legacyFetchCompat(supabase, notificationPayload);
      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(`Firebase push error: ${JSON.stringify(responseData)}`);
      }
      return new Response(JSON.stringify({
        status: 'success',
        message: 'Direct notification sent',
        sent: true,
        oneSignalResponse: {
          id: responseData.id,
          recipients: responseData.recipients
        }
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      });
    }

    // ==========================================
    // ACTION: wallet_notification - Send wallet updates
    // ==========================================
    if (action === 'wallet_notification') {
      const {
        user_id,
        title,
        message,
        status,
        transaction_type,
        amount,
        points,
        action_url
      } = body;
      const getEmoji = (status: string, type: string) => {
        if (status === 'success' || status === 'completed') {
          switch (type) {
            case 'purchase':
              return '💰';
            case 'boost':
              return '🚀';
            case 'verification':
              return '✅';
            case 'job_posting':
              return '💼';
            default:
              return '🎉';
          }
        } else if (status === 'failed') return '❌';else if (status === 'pending' || status === 'processing') return '⏳';
        return '📱';
      };
      const emoji = getEmoji(status, transaction_type);
      const finalTitle = `${emoji} ${title}`;

      // Create notification in database
      await supabase.from('notifications').insert({
        user_id,
        title: finalTitle,
        message,
        type: 'payment',
        action_url: action_url || '/wallet-history',
        metadata: {
          status,
          transaction_type,
          amount,
          points
        }
      });

      // Derive lifecycle event key so email/telegram templates also fire
      const walletEventType = status === 'failed' ? 'payment_failed' : transaction_type === 'purchase' ? 'wallet_credit' : 'payment_success';

      // Send push via recursive call
      const pushResult = await supabase.functions.invoke('email-api', {
        body: {
          action: 'send_push',
          user_id,
          title: finalTitle,
          message,
          action_url: action_url || '/wallet-history',
          event_type: walletEventType,
          variables: {
            amount: amount != null ? String(amount) : '',
            points: points != null ? String(points) : '',
            status: String(status || ''),
            transaction_type: String(transaction_type || '')
          }
        }
      });
      return new Response(JSON.stringify({
        success: true,
        message: 'Wallet notification sent'
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // ==========================================
    // ACTION: application_status_notification
    // Sent to the candidate whenever an employer changes their application status.
    // ==========================================
    if (action === 'application_status_notification') {
      const applicationId = body.application_id;
      if (!applicationId || typeof applicationId !== 'string') {
        return new Response(JSON.stringify({
          success: false,
          error: 'application_id is required'
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      const {
        data: application
      } = await supabase.from('job_applications').select('*').eq('id', applicationId).maybeSingle();
      if (!application) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Application not found'
        }), {
          status: 404,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      const newStatus = String(body.new_status || application.status || '').toLowerCase();

      // Dedupe: the DB trigger and the app both call this action. Within a
      // 10 minute window the same application+status is notified only once,
      // otherwise the candidate gets duplicate email / Telegram / push.
      const statusClaim = await claimSend(supabase, String(application.user_id || applicationId), 'push', 'application_status_changed', `app_status:${applicationId}:${newStatus}`);
      if (!statusClaim) {
        return new Response(JSON.stringify({
          success: true,
          status: newStatus,
          skipped: 'duplicate'
        }), {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      const {
        data: statusJob
      } = await supabase.from('jobs').select('id, title, company_id').eq('id', application.job_id).maybeSingle();
      let statusCompanyName = 'the company';
      if (statusJob?.company_id) {
        const {
          data: statusCompany
        } = await supabase.from('companies').select('company_name').eq('id', statusJob.company_id).maybeSingle();
        if (statusCompany?.company_name) statusCompanyName = statusCompany.company_name;
      }
      let candidateUserId: string | null = null;
      if (application.applicant_id) {
        const {
          data: candidateProfile
        } = await supabase.from('profiles').select('user_id').eq('id', application.applicant_id).maybeSingle();
        candidateUserId = candidateProfile?.user_id ?? application.applicant_id;
      }
      if (!candidateUserId) {
        return new Response(JSON.stringify({
          success: false,
          error: 'No candidate account linked to this application'
        }), {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      const statusJobTitle = statusJob?.title || 'the job';
      const statusCopy: Record<string, {
        title: string;
        message: string;
      }> = {
        reviewed: {
          title: '👀 Application Under Review',
          message: `${statusCompanyName} is reviewing your application for ${statusJobTitle}.`
        },
        under_review: {
          title: '👀 Application Under Review',
          message: `${statusCompanyName} is reviewing your application for ${statusJobTitle}.`
        },
        shortlisted: {
          title: '🎉 You Have Been Shortlisted',
          message: `Great news! ${statusCompanyName} shortlisted you for ${statusJobTitle}. Keep your phone reachable.`
        },
        interview_scheduled: {
          title: '📅 Interview Scheduled',
          message: `${statusCompanyName} has scheduled an interview for ${statusJobTitle}. Check your activity page for details.`
        },
        hired: {
          title: '🎊 Congratulations, You Are Hired',
          message: `${statusCompanyName} has selected you for ${statusJobTitle}. Congratulations!`
        },
        rejected: {
          title: '📋 Application Update',
          message: `${statusCompanyName} did not move ahead with your application for ${statusJobTitle}. Keep applying, better jobs are waiting.`
        },
        withdrawn: {
          title: '↩️ Application Withdrawn',
          message: `Your application for ${statusJobTitle} at ${statusCompanyName} has been withdrawn.`
        }
      };
      const copy = statusCopy[newStatus] || {
        title: '📋 Application Update',
        message: `Your application for ${statusJobTitle} at ${statusCompanyName} is now marked as ${newStatus.replace(/_/g, ' ')}.`
      };
      const statusMeta = {
        type: 'application_status_update',
        application_id: applicationId,
        job_id: application.job_id,
        job_title: statusJobTitle,
        company_name: statusCompanyName,
        status: newStatus
      };
      try {
        await supabase.from('notifications').insert({
          user_id: candidateUserId,
          title: copy.title,
          message: copy.message,
          type: 'job_application',
          action_url: '/activity',
          metadata: statusMeta
        });
      } catch (e) {
        console.error('status in-app notification failed', e);
      }
      try {
        await supabase.functions.invoke('email-api', {
          body: {
            action: 'send_push',
            user_id: candidateUserId,
            title: copy.title,
            message: copy.message,
            action_url: '/activity',
            button_text: 'View Activity',
            skip_rephrase: true,
            event_type: applicationStatusTemplateKey(newStatus),
            variables: {
              job_title: statusJobTitle,
              company: statusCompanyName,
              status: newStatus.replace(/_/g, ' ')
            },
            data: statusMeta
          }
        });
      } catch (e) {
        console.error('status push failed', e);
      }
      return new Response(JSON.stringify({
        success: true,
        status: newStatus,
        notified: true
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // ==========================================
    // ACTION: job_application_notification
    // Notifies BOTH the applicant (confirmation) and the employer
    // (with the applicant's name + contact details).
    // ==========================================
    if (action === 'job_application_notification') {
      const applicationId = body.application_id;
      if (!applicationId || typeof applicationId !== 'string') {
        return new Response(JSON.stringify({
          success: false,
          error: 'application_id is required'
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }

      // Dedupe: if this application was already notified, skip (trigger + API safety)
      const {
        data: alreadySent
      } = await supabase.from('notifications').select('id').eq('type', 'job_application').contains('metadata', {
        application_id: applicationId
      }).limit(1);
      if (alreadySent && alreadySent.length > 0) {
        return new Response(JSON.stringify({
          success: true,
          status: 'skipped',
          reason: 'already_notified'
        }), {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      const appliedOn = new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Kolkata'
      }).format(new Date());
      const {
        data: application
      } = await supabase.from('job_applications').select('*').eq('id', applicationId).maybeSingle();
      if (!application) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Application not found'
        }), {
          status: 404,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      const {
        data: job
      } = await supabase.from('jobs').select('id, title, location, company_id').eq('id', application.job_id).maybeSingle();
      let companyName = 'the company';
      let employerUserId: string | null = null;
      if (job?.company_id) {
        const {
          data: company
        } = await supabase.from('companies').select('company_name, user_id').eq('id', job.company_id).maybeSingle();
        if (company?.company_name) companyName = company.company_name;
        employerUserId = company?.user_id ?? null;
      }
      if (!employerUserId && application.employer_id) {
        const {
          data: employerProfile
        } = await supabase.from('profiles').select('user_id').eq('id', application.employer_id).maybeSingle();
        employerUserId = employerProfile?.user_id ?? application.employer_id;
      }
      let applicantUserId: string | null = null;
      let applicantName = application.api_full_name || 'A candidate';
      let applicantEmail = application.api_email || null;
      let applicantPhone = application.api_phone || application.api_whatsapp_number || null;
      let applicantLocation = application.api_location || null;
      if (application.applicant_id) {
        // Current application rows store the authenticated user's UUID, while
        // some legacy rows may contain the profile row UUID. Resolve the normal
        // user_id shape first so employer notifications use the actual applicant.
        const {
          data: profileByUserId
        } = await supabase.from('profiles').select('user_id, full_name, email, phone, whatsapp_number, city, state, location').eq('user_id', application.applicant_id).maybeSingle();
        let applicantProfile = profileByUserId;
        if (!applicantProfile) {
          const {
            data: legacyProfile
          } = await supabase.from('profiles').select('user_id, full_name, email, phone, whatsapp_number, city, state, location').eq('id', application.applicant_id).maybeSingle();
          applicantProfile = legacyProfile;
        }
        if (applicantProfile) {
          applicantUserId = applicantProfile.user_id ?? application.applicant_id;
          applicantName = application.api_full_name || applicantProfile.full_name || applicantName;
          applicantEmail = applicantEmail || applicantProfile.email;
          applicantPhone = applicantPhone || applicantProfile.phone || applicantProfile.whatsapp_number;
          applicantLocation = applicantLocation || [applicantProfile.city, applicantProfile.state].filter(Boolean).join(', ') || applicantProfile.location;
        } else {
          applicantUserId = application.applicant_id;
        }
      }
      const jobTitle = job?.title || 'the job';
      const deliver = async (userId: string, title: string, message: string, actionUrl: string, buttonText: string, data: any) => {
        try {
          await supabase.from('notifications').insert({
            user_id: userId,
            title,
            message,
            type: 'job_application',
            action_url: actionUrl,
            metadata: data
          });
        } catch (e) {
          console.error('application in-app notification failed', e);
        }
        try {
          await supabase.functions.invoke('email-api', {
            body: {
              action: 'send_push',
              user_id: userId,
              title,
              message,
              action_url: actionUrl,
              button_text: buttonText,
              skip_rephrase: true,
              event_type: data?.type,
              variables: {
                name: applicantName,
                mobile: applicantPhone,
                email: applicantEmail,
                location: applicantLocation,
                job_title: jobTitle,
                company: companyName
              },
              occurred_at: application.applied_at || application.created_at || new Date().toISOString(),
              data
            }
          });
        } catch (e) {
          console.error('application push failed', e);
        }
      };
      if (applicantUserId) {
        await deliver(applicantUserId, '✅ Application Submitted', [`Your application for ${jobTitle} at ${companyName} has been submitted successfully.`, `Applied on: ${appliedOn}`, 'The employer will contact you if you are shortlisted.'].join('\n'), '/profile', 'View Application', {
          type: 'application_submitted',
          application_id: applicationId,
          job_id: application.job_id,
          job_title: jobTitle,
          company_name: companyName
        });
      }
      if (employerUserId) {
        await deliver(employerUserId, '📩 New Job Application', [`New application for ${jobTitle}`, `Name: ${applicantName}`, applicantPhone ? `Phone: ${applicantPhone}` : null, applicantEmail ? `Email: ${applicantEmail}` : null, applicantLocation ? `Location: ${applicantLocation}` : null, `Applied on: ${appliedOn}`].filter(Boolean).join('\n'), `/job/${application.job_id}/applicants`, 'View Applicant', {
          type: 'new_application_received',
          application_id: applicationId,
          job_id: application.job_id,
          job_title: jobTitle,
          applicant_name: applicantName,
          applicant_phone: applicantPhone,
          applicant_email: applicantEmail,
          applicant_location: applicantLocation
        });

        // Employer portal notification list
        try {
          await supabase.from('employer_notifications').insert({
            user_id: employerUserId,
            type: 'application',
            title: 'New Application',
            message: `${applicantName} applied for ${jobTitle}`,
            metadata: {
              job_id: application.job_id,
              application_id: applicationId,
              applicant_name: applicantName,
              applicant_phone: applicantPhone,
              applicant_email: applicantEmail,
              applicant_location: applicantLocation,
              applied_on: appliedOn
            },
            action_url: `/job/${application.job_id}/applicants`
          });
        } catch (e) {
          console.error('employer_notifications insert failed', e);
        }
      }
      return new Response(JSON.stringify({
        success: true,
        notified_applicant: Boolean(applicantUserId),
        notified_employer: Boolean(employerUserId)
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // ==========================================
    // ACTION: referral_notification - Send referral updates
    // ==========================================
    if (action === 'referral_notification') {
      const {
        event_type,
        referrer_id,
        referred_user_id,
        referrer_name,
        referred_name,
        commission_amount,
        total_commissions,
        milestone,
        wallet_balance
      } = body;

      // Every referral push goes through the template-aware send_push path so the
      // owner-portal templates (push + email + telegram fanout) are always used
      // instead of hardcoded text.
      const selfUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/email-api`;
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      const sendTemplated = async (payload: Record<string, unknown>) => {
        const res = await fetch(selfUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serviceKey}`,
            apikey: serviceKey
          },
          body: JSON.stringify({
            action: 'send_push',
            skip_rephrase: true,
            ...payload
          })
        });
        const out = await res.json().catch(() => ({}));
        return {
          status: res.status,
          ...out
        };
      };
      const results: unknown[] = [];
      if (event_type === 'referral_join') {
        if (referrer_id) {
          results.push(await sendTemplated({
            user_id: referrer_id,
            event_type: 'referral_join',
            title: 'New referral joined 🎉',
            message: `${referred_name || 'Someone'} joined using your referral code!`,
            action_url: '/referral',
            button_text: 'View Referrals',
            variables: {
              referral_name: referred_name || 'New user',
              balance: wallet_balance != null ? `₹${wallet_balance}` : ''
            },
            data: {
              type: 'referral_join',
              referred_user_id
            }
          }));
        }
        // The referred user already receives the signup welcome template,
        // so no extra hardcoded welcome push is sent here.
      }
      if (event_type === 'commission_earned' && referrer_id) {
        results.push(await sendTemplated({
          user_id: referrer_id,
          event_type: 'commission_earned',
          title: 'Referral earning credited 💸',
          message: `You earned ₹${commission_amount} commission! Total: ₹${total_commissions}`,
          action_url: '/referral',
          button_text: 'View Referrals',
          variables: {
            referral_name: referred_name || '',
            amount: commission_amount != null ? `₹${commission_amount}` : '',
            balance: total_commissions != null ? `₹${total_commissions}` : ''
          },
          data: {
            type: 'commission_earned'
          }
        }));
      }
      if ((event_type === 'milestone_achieved' || event_type === 'referral_milestone') && referrer_id) {
        results.push(await sendTemplated({
          user_id: referrer_id,
          event_type: 'referral_milestone',
          title: 'Referral milestone unlocked 🎯',
          message: `Congratulations! You've reached ${milestone} referrals!`,
          action_url: '/referral',
          button_text: 'View Referrals',
          variables: {
            rank: milestone != null ? String(milestone) : '',
            amount: commission_amount != null ? `₹${commission_amount}` : '',
            balance: total_commissions != null ? `₹${total_commissions}` : ''
          },
          data: {
            type: 'referral_milestone',
            milestone
          }
        }));
      }

      // Referral marketing campaign: nudge users who have not referred anyone yet.
      if (event_type === 'marketing_referral') {
        let targetIds: string[] = Array.isArray((body as any).user_ids) ? (body as any).user_ids.filter((id: unknown) => typeof id === 'string') : [];
        if (targetIds.length === 0) {
          const {
            data: codes
          } = await supabase.from('referral_codes').select('user_id').limit(500);
          targetIds = (codes ?? []).map((row: any) => row.user_id).filter(Boolean);
        }
        for (const targetId of targetIds.slice(0, 500)) {
          results.push(await sendTemplated({
            user_id: targetId,
            event_type: 'marketing_referral',
            title: 'Refer friends, earn rewards',
            message: 'Share your Workly India referral code and earn rewards for every friend who joins.',
            action_url: '/referral',
            button_text: 'Share Now',
            variables: {
              message_type: (body as any).message_type ?? ''
            },
            data: {
              type: 'marketing_referral'
            }
          }));
        }
      }
      return new Response(JSON.stringify({
        success: true,
        message: `${results.length} referral notifications sent`,
        results
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // ==========================================
    // ACTION: trigger_event - Handle automation rules
    // ==========================================
    if (action === 'trigger_event') {
      const {
        event_type,
        user_id,
        user_type,
        name,
        metadata,
        triggered_by,
        trigger_source
      } = body;
      // Find matching automation rules
      const {
        data: rules,
        error: rulesError
      } = await supabase.from('onesignal_automation_rules').select('*').eq('trigger_event', event_type).eq('enabled', true);
      if (rulesError) throw new Error(`Failed to fetch rules: ${rulesError.message}`);
      if (!rules || rules.length === 0) {
        return new Response(JSON.stringify({
          success: true,
          message: 'No active rules for this event'
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      const results = [];
      for (const rule of rules) {
        // Get user's player_id
        let playerIds: string[] = [];
        if (user_id) {
          const {
            data: tokens
          } = await supabase.from('push_subscriptions').select('player_id:fcm_token').eq('user_id', user_id).eq('enabled', true).order('updated_at', {
            ascending: false
          }).limit(20);
          if (tokens?.length) {
            playerIds = tokens.map(t => t.player_id);
          }
        }
        if (playerIds.length === 0) {
          results.push({
            rule_id: rule.id,
            success: false,
            error: 'No tokens found'
          });
          continue;
        }

        // Get user name
        let userName = name || 'User';
        if (!name && user_id) {
          if (user_type === 'employer') {
            const {
              data: company
            } = await supabase.from('companies').select('company_name').eq('user_id', user_id).maybeSingle();
            userName = company?.company_name || 'Employer';
          } else {
            const {
              data: profile
            } = await supabase.from('profiles').select('full_name').eq('user_id', user_id).maybeSingle();
            userName = profile?.full_name || 'User';
          }
        }

        // Build template variables
        const templateVariables: Record<string, string> = {
          user_name: userName,
          name: userName,
          company_name: metadata?.company_name || userName,
          ...metadata
        };

        // Replace variables
        let title = replaceTemplateVariables(rule.title_template, templateVariables);
        let message = replaceTemplateVariables(rule.message_template, templateVariables);
        title = title.replace(/\{\{[^}]+\}\}/g, '');
        message = message.replace(/\{\{[^}]+\}\}/g, '');
        const actionUrl = ensureFullUrl(replaceTemplateVariables(rule.action_url_template || '', templateVariables));

        // Send notification
        const notificationPayload: any = {
          app_id: oneSignalAppId,
          include_subscription_ids: playerIds,
          headings: {
            en: title
          },
          contents: {
            en: message
          }
        };
        if (actionUrl) {
          notificationPayload.url = actionUrl;
          notificationPayload.web_buttons = [{
            id: 'view',
            text: 'View',
            url: actionUrl
          }];
        }
        const response = await legacyFetchCompat(supabase, notificationPayload);
        const responseData = await response.json();
        const success = response.ok && responseData.id;

        // Update rule stats
        await supabase.from('onesignal_automation_rules').update({
          execution_count: (rule.execution_count || 0) + 1,
          last_executed_at: new Date().toISOString()
        }).eq('id', rule.id);
        results.push({
          rule_id: rule.id,
          success,
          notification_id: responseData.id,
          recipients: responseData.recipients
        });
      }
      const executionTime = Date.now() - startTime;
      return new Response(JSON.stringify({
        success: true,
        event_type,
        processed: results.length,
        sent: results.filter(r => r.success).length,
        execution_time_ms: executionTime,
        results
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // ==========================================
    // ACTION: process_queue - Drain notification_trigger_queue (cron)
    // ==========================================
    if (action === 'process_queue') {
      const limit = Math.min(Number(body.limit) || 25, 100);
      const {
        data: queue,
        error: queueErr
      } = await supabase.from("notification_trigger_queue").select("*").eq("status", "pending").order("created_at", {
        ascending: true
      }).limit(limit);
      if (queueErr) {
        return new Response(JSON.stringify({
          ok: false,
          error: queueErr.message
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 500
        });
      }
      if (!queue || queue.length === 0) {
        return new Response(JSON.stringify({
          ok: true,
          processed: 0,
          message: "queue empty"
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 200
        });
      }
      let success = 0,
        failed = 0;
      const qResults: any[] = [];
      for (const row of queue) {
        try {
          const r = await processOne(supabase, row, requestId);
          if (r.ok) {
            success++;
            await supabase.from("notification_trigger_queue").update({
              status: "completed",
              processed_at: new Date().toISOString()
            }).eq("id", row.id);
          } else {
            failed++;
            await supabase.from("notification_trigger_queue").update({
              status: "failed",
              error_message: r.error || "Unknown error",
              processed_at: new Date().toISOString()
            }).eq("id", row.id);
          }
          qResults.push({
            id: row.id,
            event: row.event_type,
            ok: r.ok,
            error: r.error
          });
        } catch (e) {
          failed++;
          await supabase.from("notification_trigger_queue").update({
            status: "failed",
            error_message: (e as Error).message,
            processed_at: new Date().toISOString()
          }).eq("id", row.id);
          qResults.push({
            id: row.id,
            event: row.event_type,
            ok: false,
            error: (e as Error).message
          });
        }
      }
      return new Response(JSON.stringify({
        ok: true,
        processed: queue.length,
        success,
        failed,
        results: qResults
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      });
    }

    // ==========================================
    // ACTION: dispatch_scheduled - Drain user_scheduled_notifications (push/email/telegram/inapp)
    // ==========================================
    if (action === 'dispatch_scheduled') {
      const startedAt = Date.now();
      const limit = Math.min(Number(body.limit) || 50, 100);
      const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';

      // ─── Load per-platform toggles + caps from engagement_settings ──────────
      // Mirrors the AI agent: dispatcher MUST honour the same admin switches so
      // that turning a channel OFF in the UI immediately stops sends — even for
      // already-queued rows. Without this the queue is a "bypass" that lets the
      // OFF state leak through.
      const settingsRows = await supabase.from('engagement_settings').select('setting_key, setting_value');
      const settings: Record<string, any> = {};
      for (const r of settingsRows.data || []) {
        settings[r.setting_key] = r.setting_value;
      }
      const masterEnabled = settings['enabled'] !== false;
      const tgEnabled = settings['platform_telegram_enabled'] === true;
      const pushOneSignalOn = settings['platform_push_onesignal_enabled'] === true;
      const pushVapidOn = settings['platform_push_vapid_enabled'] === true;
      const pushEnabled = pushOneSignalOn || pushVapidOn;
      const emailEnabled = settings['platform_email_enabled'] === true;
      const emailFallbackOnly = settings['email_only_if_no_other_channel'] === true;

      // Load per-user caps from engagement_channel_limits (id=1).
      const {
        data: limitsRow
      } = await supabase.from('engagement_channel_limits').select('*').eq('id', 1).maybeSingle();
      const PUSH_CAP_24H = Number(limitsRow?.push_per_user_24h ?? 5);
      const TG_CAP_24H = Number(limitsRow?.telegram_per_user_24h ?? 5);
      const EMAIL_CAP_7D = Number(limitsRow?.email_per_user_7d ?? 2);
      const EMAIL_GLOBAL_24H = Number(limitsRow?.email_global_24h ?? 150);

      // Provider rate pacing (free-tier safe). Honours engagement_settings
      // overrides if present (rate_*_per_second).
      const tgPerSec = Number(settings['rate_telegram_per_second']) || 25;
      const pushPerSec = Number(settings['rate_push_per_second']) || 125;
      const tgPerUserPerSec = Number(settings['rate_telegram_per_user_per_second']) || 1;
      const minGap: Record<string, number> = {
        telegram: Math.max(1, Math.floor(1000 / tgPerSec)),
        push: Math.max(1, Math.floor(1000 / pushPerSec)),
        email: 100 // gentle email pacing
      };
      const perUserTgMinMs = Math.max(100, Math.floor(1000 / tgPerUserPerSec) + 100);
      const lastChannelSendAt: Record<string, number> = {};
      const lastPerUserTgAt = new Map<string, number>();
      async function pace(ch: string, perUserKey?: string) {
        const gap = minGap[ch] ?? 0;
        if (gap > 0) {
          const wait = gap - (Date.now() - (lastChannelSendAt[ch] || 0));
          if (wait > 0) await new Promise(r => setTimeout(r, wait));
          lastChannelSendAt[ch] = Date.now();
        }
        if (ch === 'telegram' && perUserKey) {
          const wait = perUserTgMinMs - (Date.now() - (lastPerUserTgAt.get(perUserKey) || 0));
          if (wait > 0) await new Promise(r => setTimeout(r, wait));
          lastPerUserTgAt.set(perUserKey, Date.now());
        }
      }

      // Master kill-switch: if engagement is disabled, leave marketing rows
      // untouched (do NOT mark them failed — admin may flip back ON). User's
      // OWN mailbox emails (channel 'mailbox') are personal, user-approved
      // sends and are NEVER blocked by the engagement switches/caps.
      if (!masterEnabled) {
        const {
          data: mailboxDue
        } = await supabase.from('user_scheduled_notifications').select('id').eq('status', 'pending').contains('channels', ['mailbox']).lte('scheduled_for', new Date().toISOString()).limit(1);
        if (!mailboxDue || mailboxDue.length === 0) {
          return new Response(JSON.stringify({
            ok: true,
            processed: 0,
            skipped_reason: 'engagement_master_disabled',
            duration_ms: Date.now() - startedAt
          }), {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            },
            status: 200
          });
        }
      }

      // Helper: count actual successful sends in the audit log per channel.
      // Used to enforce per-user 5/24h (push, telegram) and 2/7d (email).
      async function userSendCount(uid: string, channel: string, sinceIso: string): Promise<number> {
        const {
          count
        } = await supabase.from('engagement_send_log').select('id', {
          count: 'exact',
          head: true
        }).eq('user_id', uid).eq('channel', channel).eq('status', 'sent').gte('sent_at', sinceIso);
        return count || 0;
      }
      // Pre-fetch global email count (24h) once per dispatch tick.
      const since24hIso = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const since7dIso = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      const {
        count: emailGlobal24h0
      } = await supabase.from('engagement_send_log').select('id', {
        count: 'exact',
        head: true
      }).eq('channel', 'email').eq('status', 'sent').gte('sent_at', since24hIso);
      let runtimeEmailGlobal24h = emailGlobal24h0 || 0;
      const {
        data: due,
        error: dueErr
      } = await supabase.from('user_scheduled_notifications').select('*').eq('status', 'pending').lte('scheduled_for', new Date().toISOString()).lt('attempts', 5).order('scheduled_for', {
        ascending: true
      }).limit(limit);
      if (dueErr) {
        return new Response(JSON.stringify({
          ok: false,
          error: dueErr.message
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 500
        });
      }
      const rows: any[] = due || [];
      if (rows.length === 0) {
        return new Response(JSON.stringify({
          ok: true,
          processed: 0,
          duration_ms: Date.now() - startedAt
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 200
        });
      }
      const results: any[] = [];
      for (const row of rows) {
        await supabase.from('user_scheduled_notifications').update({
          attempts: (row.attempts || 0) + 1
        }).eq('id', row.id);
        const channelResults: Record<string, any> = {};
        const requestedChannels = (row.channels || []).map((c: string) => String(c).toLowerCase());
        const skippedChannels: Record<string, string> = {};

        // STEP 1 — Filter by per-platform toggles. inapp is always allowed and
        // 'mailbox' (user's own Gmail/domain mailbox) always runs.
        let channels = requestedChannels.filter((ch: string) => {
          if (ch === 'mailbox') return true;
          if (!masterEnabled) {
            skippedChannels[ch] = 'engagement_master_disabled';
            return false;
          }
          if (ch === 'inapp' || ch === 'in_app') return true;
          if (ch === 'telegram') {
            if (!tgEnabled) {
              skippedChannels.telegram = 'platform_telegram_disabled';
              return false;
            }
            return true;
          }
          if (ch === 'push') {
            if (!pushEnabled) {
              skippedChannels.push = 'platform_push_disabled';
              return false;
            }
            return true;
          }
          if (ch === 'email') {
            if (!emailEnabled) {
              skippedChannels.email = 'platform_email_disabled';
              return false;
            }
            return true;
          }
          return true;
        });

        // STEP 2 — Email-only-as-fallback: drop email when push/tg still present.
        if (emailFallbackOnly && channels.includes('email') && channels.some((c: string) => c === 'push' || c === 'telegram')) {
          channels = channels.filter((c: string) => c !== 'email');
          skippedChannels.email = 'email_fallback_only';
        }

        // STEP 3 — Per-user caps (push 5/24h, telegram 5/24h, email 2/7d) +
        // global email 150/24h. Enforced from engagement_send_log so the queue
        // can never push a single user past their target.
        if (channels.includes('push')) {
          const c = await userSendCount(row.user_id, 'push', since24hIso);
          if (c >= PUSH_CAP_24H) {
            channels = channels.filter((x: string) => x !== 'push');
            skippedChannels.push = `cap_push_${c}/${PUSH_CAP_24H}_24h`;
          }
        }
        if (channels.includes('telegram')) {
          const c = await userSendCount(row.user_id, 'telegram', since24hIso);
          if (c >= TG_CAP_24H) {
            channels = channels.filter((x: string) => x !== 'telegram');
            skippedChannels.telegram = `cap_telegram_${c}/${TG_CAP_24H}_24h`;
          }
        }
        if (channels.includes('email')) {
          if (runtimeEmailGlobal24h >= EMAIL_GLOBAL_24H) {
            channels = channels.filter((x: string) => x !== 'email');
            skippedChannels.email = `cap_email_global_${runtimeEmailGlobal24h}/${EMAIL_GLOBAL_24H}_24h`;
          } else {
            const c = await userSendCount(row.user_id, 'email', since7dIso);
            if (c >= EMAIL_CAP_7D) {
              channels = channels.filter((x: string) => x !== 'email');
              skippedChannels.email = `cap_email_${c}/${EMAIL_CAP_7D}_7d`;
            }
          }
        }
        for (const [ch, reason] of Object.entries(skippedChannels)) {
          channelResults[ch] = {
            ok: false,
            skipped: true,
            error: reason
          };
        }
        for (const ch of channels) {
          try {
            if (ch === 'push') {
              await pace('push');
              const {
                data: tokens
              } = await supabase.from('push_subscriptions').select('player_id:fcm_token').eq('user_id', row.user_id).eq('enabled', true);
              const playerIds = (tokens || []).map((t: any) => t.player_id).filter(Boolean);
              if (!playerIds.length) {
                channelResults.push = {
                  ok: false,
                  error: 'no_tokens'
                };
              } else {
                const payload: any = {
                  app_id: oneSignalAppId,
                  include_subscription_ids: playerIds,
                  headings: {
                    en: row.title || 'Reminder'
                  },
                  contents: {
                    en: row.message
                  },
                  chrome_web_icon: getSocialChromeIcon(row) || await getBrandLogoUrl(supabase),
                  chrome_web_badge: `${WEBSITE_DOMAIN}/icons/notification-badge.png`,
                  small_icon: 'ic_stat_onesignal_default',
                  large_icon: await getBrandLogoUrl(supabase),
                  priority: 10
                };
                const fullUrl = ensureFullUrl(row.action_url) || WEBSITE_DOMAIN;
                const btnLabel = row.button_text && String(row.button_text).trim() || 'View';
                payload.url = fullUrl;
                payload.data = {
                  url: fullUrl,
                  action_url: fullUrl
                };
                payload.web_buttons = [{
                  id: 'view',
                  text: btnLabel,
                  url: fullUrl
                }];
                payload.buttons = [{
                  id: 'view',
                  text: btnLabel,
                  url: fullUrl
                }];
                // Rich-media image (banner/card) on Android, iOS, Web, Huawei
                // Size-capped via wsrv.nl so each device downloads ~50-90 KB, not the full original.
                const img = capPushImageUrl(row.image_url || (row.attachment_url && /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(row.attachment_url) ? row.attachment_url : null));
                if (img) {
                  payload.big_picture = img;
                  payload.chrome_web_image = img;
                  payload.huawei_big_picture = img;
                  payload.ios_attachments = {
                    card: img
                  };
                }
                const r = await legacyFetchCompat(supabase, payload);
                const j = await r.json().catch(() => ({}));
                channelResults.push = {
                  ok: r.ok,
                  response: j,
                  error: r.ok ? undefined : JSON.stringify(j)
                };
              }
            } else if (ch === 'email') {
              {
                await pace('email');
                const {
                  data: profile
                } = await supabase.from('profiles').select('email, full_name').eq('user_id', row.user_id).maybeSingle();
                let recipientEmail = profile?.email;
                const recipientName = profile?.full_name || 'User';
                if (!recipientEmail) {
                  const {
                    data: au
                  } = await supabase.auth.admin.getUserById(row.user_id);
                  recipientEmail = au?.user?.email;
                }
                if (!recipientEmail) {
                  channelResults.email = {
                    ok: false,
                    error: 'no_email'
                  };
                } else {
                  // Route through unified the unified send-email endpoint — single source of truth.
                  // Branded shell + dynamic social icons added automatically.
                  const social = await loadSocialLinks(supabase);
                  let bodyHtml = row.html_body && row.html_body.trim().length > 0 ? row.html_body : `<p style="font-size:15px;color:#222;line-height:1.55">${String(row.message).replace(/\n/g, '<br/>')}</p>`;
                  const sent = await sendBrandedEmail({
                    to: recipientEmail,
                    toName: recipientName,
                    subject: row.title || 'Your Reminder',
                    bodyHtml,
                    attachmentUrl: row.attachment_url || undefined,
                    attachmentName: row.attachment_name || undefined,
                    footerNote: 'Scheduled reminder by Workly AI',
                    socialMap: social
                  });
                  channelResults.email = {
                    ok: sent.ok,
                    response: sent.response,
                    error: sent.ok ? undefined : JSON.stringify(sent.response)
                  };
                }
              }
            } else if (ch === 'telegram') {
              if (!TELEGRAM_BOT_TOKEN) {
                channelResults.telegram = {
                  ok: false,
                  error: 'telegram_not_configured'
                };
              } else {
                await pace('telegram', String(row.user_id));
                let chatId: number | null = null;
                const {
                  data: profile
                } = await supabase.from('profiles').select('telegram_chat_id').eq('user_id', row.user_id).maybeSingle();
                if (profile?.telegram_chat_id) chatId = Number(profile.telegram_chat_id);
                if (!chatId) {
                  const {
                    data: company
                  } = await supabase.from('companies').select('telegram_chat_id').eq('user_id', row.user_id).maybeSingle();
                  if (company?.telegram_chat_id) chatId = Number(company.telegram_chat_id);
                }
                if (!chatId) {
                  channelResults.telegram = {
                    ok: false,
                    error: 'telegram_not_connected'
                  };
                } else {
                  const base = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
                  let endpoint = '/sendMessage';
                  const text = `<b>${row.title || 'Reminder'}</b>\n\n${row.message}\n\n— Workly AI`;
                  let tgPayload: any = {
                    chat_id: chatId,
                    parse_mode: 'HTML'
                  };
                  if (row.attachment_url) {
                    const lower = String(row.attachment_url).toLowerCase().split('?')[0];
                    if (/\.(png|jpe?g|webp|gif)$/i.test(lower)) {
                      endpoint = '/sendPhoto';
                      tgPayload.photo = row.attachment_url;
                      tgPayload.caption = text.slice(0, 1000);
                    } else {
                      endpoint = '/sendDocument';
                      tgPayload.document = row.attachment_url;
                      tgPayload.caption = text.slice(0, 1000);
                    }
                  } else {
                    tgPayload.text = text.slice(0, 4000);
                  }
                  const r = await fetch(base + endpoint, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(tgPayload)
                  });
                  const j = await r.json().catch(() => ({}));
                  channelResults.telegram = {
                    ok: r.ok && j?.ok !== false,
                    response: j,
                    error: r.ok ? undefined : JSON.stringify(j)
                  };
                }
              }
            } else if (ch === 'mailbox') {
              // Scheduled email from the USER'S OWN connected mailbox
              // (Gmail OAuth or domain IMAP/SMTP). Queued by the AI chat's
              // schedule_mailbox_email tool.
              const toList: string[] = (row.mailbox_to || []).filter(Boolean);
              if (!toList.length) {
                channelResults.mailbox = {
                  ok: false,
                  error: 'no_recipients'
                };
              } else {
                const opts = {
                  cc: row.mailbox_cc || [],
                  bcc: row.mailbox_bcc || [],
                  html: row.mailbox_html || row.html_body || undefined,
                  attachments: Array.isArray(row.mailbox_attachments) ? row.mailbox_attachments : []
                };
                const subject = row.mailbox_subject || row.title || '(no subject)';
                const text = row.message || '';
                const provider = String(row.mailbox_provider || 'gmail').toLowerCase();
                const sendRes = provider === 'domain' ? await sendCustomEmailForUser(row.user_id, toList.join(', '), subject, text, opts) : await sendGmailForUser(row.user_id, toList.join(', '), subject, text, opts);
                channelResults.mailbox = {
                  ok: sendRes?.sent === true || sendRes?.success === true,
                  response: sendRes,
                  error: sendRes?.error
                };
              }
            } else if (ch === 'inapp' || ch === 'in_app') {
              const {
                error: insErr
              } = await supabase.from('notifications').insert({
                user_id: row.user_id,
                title: row.title || 'Reminder',
                message: row.message,
                action_url: row.action_url || null,
                type: 'scheduled_reminder',
                is_read: false
              });
              channelResults.inapp = {
                ok: !insErr,
                error: insErr?.message
              };
            }
          } catch (e) {
            channelResults[ch] = {
              ok: false,
              error: String((e as Error)?.message || e)
            };
          }
        }

        // STEP 4 — Audit log: write one row per real (non-inapp) channel attempt
        // into engagement_send_log so per-user caps + the owner audit page work.
        // Skipped channels are also logged so we can see WHY a send was withheld.
        const auditRows: any[] = [];
        for (const [ch, res] of Object.entries(channelResults)) {
          if (ch === 'inapp' || ch === 'in_app') continue;
          const r: any = res;
          const status = r?.ok ? 'sent' : r?.skipped ? 'skipped' : 'failed';
          auditRows.push({
            user_id: row.user_id,
            channel: ch,
            status,
            reason: r?.error ? String(r.error).slice(0, 240) : 'scheduled_dispatch',
            ai_subject: row.title || null,
            ai_message_preview: String(row.message || '').slice(0, 200),
            send_date: new Date().toISOString().slice(0, 10),
            sent_at: new Date().toISOString()
          });
          if (ch === 'email' && r?.ok) runtimeEmailGlobal24h += 1;
        }
        if (auditRows.length > 0) {
          await supabase.from('engagement_send_log').insert(auditRows);
        }

        // Determine final row status. A row that produced ZERO real sends
        // because every channel was skipped by toggles/caps is marked 'sent'
        // with channelResults preserved (so it's not retried forever).
        const realChannelResults = Object.entries(channelResults).filter(([ch]) => ch !== 'inapp' && ch !== 'in_app');
        const anyOk = Object.values(channelResults).some((r: any) => r?.ok);
        const allSkipped = realChannelResults.length > 0 && realChannelResults.every(([_, r]: any) => r?.skipped);
        const finalStatus = anyOk || allSkipped ? 'sent' : (row.attempts || 0) + 1 >= 5 ? 'failed' : 'pending';
        await supabase.from('user_scheduled_notifications').update({
          status: finalStatus,
          result: channelResults,
          last_error: anyOk ? null : Object.entries(channelResults).map(([c, r]: any) => `${c}:${r?.error || '?'}`).join(' | '),
          sent_at: anyOk ? new Date().toISOString() : null
        }).eq('id', row.id);
        results.push({
          id: row.id,
          status: finalStatus,
          channelResults
        });
      }
      return new Response(JSON.stringify({
        ok: true,
        processed: rows.length,
        duration_ms: Date.now() - startedAt,
        results
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      });
    }

    // ==========================================
    // ACTION: test_send_all - Send all event templates to a target email
    // ==========================================
    if (action === 'test_send_all') {
      const targetEmail = body.email || "gohilvishal7600@gmail.com";
      const audience: Audience = body.audience === "employer" ? "employer" : "user";
      const recipient = audience === "employer" ? await supabase.from("companies").select("user_id, company_name, email").eq("email", targetEmail).maybeSingle().then((r: any) => r.data) : await supabase.from("profiles").select("user_id, full_name, email").eq("email", targetEmail).maybeSingle().then((r: any) => r.data);
      if (!recipient) {
        return new Response(JSON.stringify({
          ok: false,
          error: `No ${audience} found with email ${targetEmail}`
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 404
        });
      }
      const events = Object.entries(EVENT_CATALOG).filter(([_, v]) => v.audience === audience && v.channels.includes("email")).map(([k]) => k);
      const log: any[] = [];
      for (const eventType of events) {
        const fakeRow = {
          id: crypto.randomUUID(),
          event_type: eventType,
          user_id: recipient.user_id,
          user_type: audience === "employer" ? "employer" : "website_user",
          metadata: {
            test: true
          }
        };
        const r = await processOne(supabase, fakeRow, requestId);
        log.push({
          event: eventType,
          ...r
        });
        await new Promise(res => setTimeout(res, 600));
      }
      return new Response(JSON.stringify({
        ok: true,
        target: targetEmail,
        audience,
        events_tested: log.length,
        results: log
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      });
    }

    // ==========================================
    // ACTION: card_image — merged from notification-card-image
    // Generates 1200x630 SVG social card, uploads to storage (cached by hash)
    // ==========================================
    if (action === 'card_image' || action === 'generate_card_image' || action === 'notification_card_image') {
      const result = await generateNotificationCardImage(supabase, body);
      return new Response(JSON.stringify(result.payload), {
        status: result.status,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // ACTION: send_test_email — sends one branded email through unified the unified send-email endpoint
    if (action === 'send_test_email') {
      const recipientEmail = String(body.email || '').trim();
      if (!recipientEmail) {
        return new Response(JSON.stringify({
          ok: false,
          error: 'email_required'
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 400
        });
      }
      const recipientName = String(body.name || 'Friend');
      const titleRaw = String(body.title || '✅ Test Email from Workly India');
      const messageRaw = String(body.message || 'Yeh ek test email hai naye branded template ko verify karne ke liye. Agar yeh sahi dikh raha hai — header gradient, action buttons, social icons aur footer links — toh sab kuch perfect chal raha hai!');
      const safeTitle = titleRaw.replace(/[<>]/g, '');
      const social = await loadSocialLinks(supabase);
      const sent = await sendBrandedEmail({
        to: recipientEmail,
        toName: recipientName,
        subject: safeTitle,
        bodyHtml: `<p style="font-size:15px;color:#222;line-height:1.6;margin:0 0 12px">${messageRaw.replace(/\n/g, '<br/>')}</p>`,
        socialMap: social
      });
      return new Response(JSON.stringify({
        ok: sent.ok,
        status: sent.status,
        response: sent.response
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: sent.ok ? 200 : 502
      });
    }

    // push_config is handled earlier (before credential validation).

    // Legacy OneSignal-only admin actions were removed with the Firebase migration.

    if (action === 'onesignal_full_test' || action === 'agent_tool') {
      return new Response(JSON.stringify({
        status: 'error',
        error: 'This action was removed. Push now runs on Firebase Cloud Messaging (use send_push / send_push_direct).'
      }), {
        status: 410,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // Festival / holiday greetings (AI written) — push + telegram + email,
    // for job seekers and employers. Runs daily from cron.
    if (action === 'festival_greetings') {
      const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      const result = await runFestivalGreetings(svc, body || {});
      return new Response(JSON.stringify(result), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: (result as any)?.success === false ? 500 : 200
      });
    }

    // Birthday greetings (AI written, per user) — push + telegram + email,
    // JOB SEEKERS ONLY. Runs daily from cron.
    if (action === 'birthday_greetings') {
      const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      const result = await runBirthdayGreetings(svc, body || {});
      return new Response(JSON.stringify(result), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: (result as any)?.success === false ? 500 : 200
      });
    }

    // Daily time-of-day greetings (AI written) — PUSH ONLY,
    // job seekers + employers. Runs from cron 4 times a day (IST).
    if (action === 'daily_greetings') {
      const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      const result = await runDailyGreetings(svc, body || {});
      return new Response(JSON.stringify(result), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: (result as any)?.success === false ? 500 : 200
      });
    }
    throw new Error(`Unknown action: ${action}`);
  } catch (error: any) {
    const executionTime = Date.now() - startTime;
    console.error(`[${requestId}] ❌ Error (${executionTime}ms):`, error);
    return new Response(JSON.stringify({
      status: 'error',
      error: error.message || 'Failed to process notification',
      execution_time_ms: executionTime
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});