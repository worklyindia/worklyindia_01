import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { BRAND_CONFIG } from '../../_shared/brandConfig.ts';
import { checkAiChatLimit, reserveAiChatMessage } from '../../_shared/aiChatLimit.ts';
import { buildUserDiagnosticSnapshot, fetchRecentPlatformErrors } from '../../_shared/aiSupabaseInspector.ts';
import { renderEmailTemplate, type TemplateStyle } from '../../_shared/engagementEmailTemplates.ts';
import { handleGmailAction, isGmailAction } from '../../_shared/userGmail.ts';
import { handleOutlookAction, isOutlookAction } from '../../_shared/userOutlook.ts';
import { handleCustomEmailAction, isCustomEmailAction } from '../../_shared/userCustomEmail.ts';
import { handleSupportAction, isSupportAction } from '../../_shared/supportDesk.ts';
import { handleSupportMailAction, isSupportMailAction } from '../../_shared/supportMailChat.ts';
import { WEBSITE_DOMAIN } from '../../_shared/domain.ts';
import { runAiChain, buildAiGateways } from '../../_shared/aiChain.ts';
import { enrichTemplateValues } from '../../_shared/lifecycleFanout.ts';


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY') || '';
const TELEGRAM_API_KEY = Deno.env.get('TELEGRAM_API_KEY') || '';
const TELEGRAM_GATEWAY = 'https://connector-gateway.lovable.dev/telegram';

// ============================================================
// RE-ENGAGEMENT SCHEDULER (AI-driven, multi-channel)
// ============================================================

interface Settings {
  enabled: boolean;
  daily_email_cap: number;
  daily_telegram_cap: number;
  inactivity_days: number[];
  max_touchpoints: number;
  cooldown_hours: number;
}

async function loadEngagementSettings(supabase: any): Promise<Settings> {
  const { data } = await supabase.from('engagement_settings').select('setting_key, setting_value');
  const map: any = {};
  for (const row of data || []) map[row.setting_key] = row.setting_value;
  return {
    enabled: map.enabled ?? true,
    daily_email_cap: map.daily_email_cap ?? 150,
    daily_telegram_cap: map.daily_telegram_cap ?? 5000,
    inactivity_days: map.inactivity_days ?? [7, 14, 30],
    max_touchpoints: map.max_touchpoints ?? 3,
    cooldown_hours: map.cooldown_hours ?? 24,
  };
}

async function getTodayCounts(supabase: any) {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from('engagement_send_log')
    .select('channel, status')
    .eq('send_date', today)
    .eq('status', 'sent');
  let email = 0, telegram = 0;
  for (const r of data || []) {
    if (r.channel === 'email') email++;
    else if (r.channel === 'telegram') telegram++;
  }
  return { email, telegram };
}

interface AIMessageResult {
  subject: string;
  message: string;
  template_style: TemplateStyle;
  cta_text?: string;
  cta_url?: string;
  html_body?: string;  // AI-generated full HTML body when template_style === 'ai_custom'
}

// AI message writing REMOVED. Re-engagement nudges now use fixed, saved
// English copy per intent — no AI text generation of any kind.
function buildEngagementMessage(user: any, _stage: number, _channel: string, intent: string = 'reengagement'): AIMessageResult {
  const skills = (user.skills || []).slice(0, 3).join(', ') || 'your field';
  const name = user.full_name || user.company_name || 'there';
  const userType = user.user_type;

  let cta = WEBSITE_DOMAIN;
  if (userType === 'employer') {
    if (intent === 'post_job_nudge' || intent === 'free_trial') cta = `${WEBSITE_DOMAIN}/post-job`;
    else if (intent === 'profile_complete') cta = `${WEBSITE_DOMAIN}/Employer/Profile/Edit/1`;
    else cta = `${WEBSITE_DOMAIN}/employer-dashboard`;
  } else {
    cta = intent === 'profile_complete' ? `${WEBSITE_DOMAIN}/profile` : `${WEBSITE_DOMAIN}/jobs`;
  }

  const templates: Record<string, AIMessageResult> = {
    post_job_nudge: {
      subject: `${name}, post a new job — 75k+ candidates waiting`,
      message: `Hi ${name},\n\nIt's been a while since your last job posting. 75,000+ active candidates are searching right now.`,
      template_style: 'hero_cta', cta_text: 'Post a job', cta_url: cta,
    },
    new_applicants: {
      subject: `${name}, new applications waiting for review`,
      message: `Hi ${name},\n\nYou have new applicants on your job posts. Review them before they accept other offers.`,
      template_style: 'alert_banner', cta_text: 'Review applicants', cta_url: cta,
    },
    profile_complete: {
      subject: `${name}, complete your ${userType === 'employer' ? 'company ' : ''}profile`,
      message: `Hi ${name},\n\nFinish your profile setup to get ${userType === 'employer' ? 'better candidates' : '3x more visibility'}.`,
      template_style: 'minimal_card', cta_text: 'Complete profile', cta_url: cta,
    },
    free_trial: {
      subject: `${name}, your FREE job posting is waiting`,
      message: `Hi ${name},\n\nYou haven't used your FREE first job posting yet. Full features, no card needed.`,
      template_style: 'hero_cta', cta_text: 'Claim free posting', cta_url: cta,
    },
    reengagement: {
      subject: `Hi ${name}, new opportunities on Workly India`,
      message: userType === 'employer'
        ? `Hi ${name},\n\nNew candidates are available in your industry. Come back to post jobs or review applications.`
        : `Hi ${name},\n\nNew jobs matching ${skills} are waiting for you on Workly India.`,
      template_style: 'newsletter', cta_text: 'Visit site', cta_url: cta,
    },
  };

  return templates[intent] || templates.reengagement;
}


function pickChannel(state: any, hasEmail: boolean, hasTelegram: boolean, emailCapLeft: number, telegramCapLeft: number): 'email' | 'telegram' | null {
  if (state?.preferred_channel === 'email' && hasEmail && emailCapLeft > 0) return 'email';
  if (state?.preferred_channel === 'telegram' && hasTelegram && telegramCapLeft > 0) return 'telegram';
  if (state?.preferred_channel === 'none') return null;

  const emailRate = state?.total_emails_sent > 0 ? state.email_response_count / state.total_emails_sent : 0;
  const telegramRate = state?.total_telegram_sent > 0 ? state.telegram_response_count / state.total_telegram_sent : 0;

  if (state?.total_emails_sent >= 2 || state?.total_telegram_sent >= 2) {
    if (emailRate > telegramRate && hasEmail && emailCapLeft > 0) return 'email';
    if (telegramRate > emailRate && hasTelegram && telegramCapLeft > 0) return 'telegram';
  }

  if (hasTelegram && telegramCapLeft > 0) return 'telegram';
  if (hasEmail && emailCapLeft > 0) return 'email';
  return null;
}

async function sendEngagementEmail(
  supabase: any,
  email: string,
  name: string,
  ai: AIMessageResult,
  audience: 'jobseeker' | 'employer' = 'jobseeker',
): Promise<boolean> {
  try {
    const html = renderEmailTemplate(ai.template_style, {
      recipientName: name,
      subject: ai.subject,
      message: ai.message,
      ctaText: ai.cta_text,
      ctaUrl: ai.cta_url,
      brandName: 'Workly India',
      brandColor: '#4F46E5',
      preheader: ai.subject,
      htmlBody: ai.html_body,
    });
    const { error } = await supabase.functions.invoke('email-api/send-email', {
      body: {
        to: email,
        toName: name,
        subject: ai.subject,
        htmlContent: html,
        textContent: ai.message,
        audience,
      },
    });
    return !error;
  } catch (e) {
    console.error('Email send error:', e);
    return false;
  }
}

async function sendEngagementTelegram(chatId: number, message: string): Promise<boolean> {
  if (!TELEGRAM_API_KEY) return false;
  try {
    const res = await fetch(`${TELEGRAM_GATEWAY}/sendMessage`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': TELEGRAM_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML', disable_web_page_preview: false }),
    });
    return res.ok;
  } catch (e) {
    console.error('Telegram send error:', e);
    return false;
  }
}

async function runReEngagement(supabase: any, requestId: string) {
  const result: any = { processed: 0, sent_email: 0, sent_telegram: 0, skipped: 0, errors: 0 };
  const settings = await loadEngagementSettings(supabase);
  if (!settings.enabled) return { ok: false, reason: 'disabled', ...result };

  const counts = await getTodayCounts(supabase);
  let emailCapLeft = settings.daily_email_cap - counts.email;
  let telegramCapLeft = settings.daily_telegram_cap - counts.telegram;
  console.log(`[${requestId}] re-engage caps: email ${emailCapLeft}/${settings.daily_email_cap}, telegram ${telegramCapLeft}/${settings.daily_telegram_cap}`);

  if (emailCapLeft <= 0 && telegramCapLeft <= 0) {
    return { ok: true, reason: 'caps_exhausted', ...result };
  }

  const now = Date.now();
  const stages = settings.inactivity_days;
  const earliestCutoff = new Date(now - stages[stages.length - 1] * 86400000 * 2).toISOString();
  const latestCutoff = new Date(now - stages[0] * 86400000).toISOString();

  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, email, full_name, skills, updated_at, telegram_chat_id')
    .lte('updated_at', latestCutoff)
    .gte('updated_at', earliestCutoff)
    .limit(200);

  // Companies: include profile completion + free-trial flag for richer intent detection.
  // Use COALESCE-style filter via two queries OR with `or` filter on last_interaction_at/updated_at.
  const { data: companies } = await supabase
    .from('companies')
    .select('id, user_id, email, company_name, last_interaction_at, updated_at, created_at, telegram_chat_id, is_profile_complete, free_trial_used')
    .or(`last_interaction_at.lte.${latestCutoff},and(last_interaction_at.is.null,updated_at.lte.${latestCutoff})`)
    .limit(200);

  const candidates: any[] = [
    ...(profiles || []).map((p: any) => ({ ...p, user_type: 'jobseeker', last_active: p.updated_at })),
    ...(companies || []).map((c: any) => ({
      ...c,
      user_type: 'employer',
      full_name: c.company_name,
      last_active: c.last_interaction_at || c.updated_at || c.created_at,
    })),
  ];
  console.log(`[${requestId}] candidates: ${candidates.length} (jobseekers: ${profiles?.length || 0}, employers: ${companies?.length || 0})`);

  for (const user of candidates) {
    if (emailCapLeft <= 0 && telegramCapLeft <= 0) break;
    result.processed++;

    const daysInactive = Math.floor((now - new Date(user.last_active).getTime()) / 86400000);
    let stage = 0;
    if (daysInactive >= stages[2]) stage = 3;
    else if (daysInactive >= stages[1]) stage = 2;
    else if (daysInactive >= stages[0]) stage = 1;
    if (stage === 0) { result.skipped++; continue; }

    const { data: stateRow } = await supabase
      .from('user_engagement_state')
      .select('*')
      .eq('user_id', user.user_id)
      .maybeSingle();

    if (stateRow?.is_unsubscribed) { result.skipped++; continue; }
    if (stateRow && stateRow.inactivity_stage >= stage) { result.skipped++; continue; }

    if (stateRow?.last_contacted_at) {
      const hoursSince = (now - new Date(stateRow.last_contacted_at).getTime()) / 3600000;
      if (hoursSince < settings.cooldown_hours) { result.skipped++; continue; }
    }

    const totalSent = (stateRow?.total_emails_sent || 0) + (stateRow?.total_telegram_sent || 0);
    if (totalSent >= settings.max_touchpoints * 2) { result.skipped++; continue; }

    const hasEmail = !!user.email;
    const hasTelegram = !!user.telegram_chat_id;
    const channel = pickChannel(stateRow, hasEmail, hasTelegram, emailCapLeft, telegramCapLeft);

    if (!channel) {
      await supabase.from('engagement_send_log').insert({
        user_id: user.user_id, channel: 'email', status: 'skipped', reason: 'no_channel',
      });
      result.skipped++;
      continue;
    }

    // ---- Intent detection (employer-aware) ----
    let intent = 'reengagement';
    const meta: any = {};

    if (user.user_type === 'employer') {
      // Check for pending applications on their jobs
      const { data: jobIds } = await supabase
        .from('jobs').select('id, created_at').eq('company_id', user.id).order('created_at', { ascending: false }).limit(20);

      const lastJobAt = jobIds && jobIds.length > 0 ? new Date(jobIds[0].created_at).getTime() : null;
      const daysSinceLastJob = lastJobAt ? Math.floor((now - lastJobAt) / 86400000) : null;
      meta.days_since_last_job = daysSinceLastJob ?? 'never';
      meta.free_trial_used = user.free_trial_used;

      let pendingCount = 0;
      if (jobIds && jobIds.length > 0) {
        const { count } = await supabase
          .from('job_applications')
          .select('id', { count: 'exact', head: true })
          .in('job_id', jobIds.map((j: any) => j.id))
          .eq('status', 'pending');
        pendingCount = count || 0;
      }
      meta.pending_applications = pendingCount;

      // Priority: new applicants > free trial > profile incomplete > post job nudge > reengagement
      if (pendingCount >= 3) intent = 'new_applicants';
      else if (user.free_trial_used === false && (!jobIds || jobIds.length === 0)) intent = 'free_trial';
      else if (user.is_profile_complete === false) intent = 'profile_complete';
      else if (daysSinceLastJob === null || daysSinceLastJob >= 14) intent = 'post_job_nudge';
      else intent = 'reengagement';
    } else {
      // Jobseeker
      if (user.is_profile_complete === false) intent = 'profile_complete';
    }

    user.meta = meta;
    const ai = buildEngagementMessage(user, stage, channel, intent);
    let success = false;

    if (channel === 'email') {
      success = await sendEngagementEmail(
        supabase,
        user.email,
        user.full_name || 'there',
        ai,
        user.user_type === 'employer' ? 'employer' : 'jobseeker',
      );
      if (success) { emailCapLeft--; result.sent_email++; }
    } else {
      success = await sendEngagementTelegram(user.telegram_chat_id, ai.message);
      if (success) { telegramCapLeft--; result.sent_telegram++; }
    }

    await supabase.from('engagement_send_log').insert({
      user_id: user.user_id,
      channel,
      status: success ? 'sent' : 'failed',
      ai_subject: ai.subject,
      ai_message_preview: ai.message.slice(0, 200),
      reason: intent,
    });

    const updates: any = {
      user_id: user.user_id,
      user_type: user.user_type,
      email: user.email,
      telegram_chat_id: user.telegram_chat_id,
      last_active_at: user.last_active,
      last_contacted_at: new Date().toISOString(),
      last_channel: channel,
      inactivity_stage: stage,
      updated_at: new Date().toISOString(),
    };
    if (success) {
      if (channel === 'email') updates.total_emails_sent = (stateRow?.total_emails_sent || 0) + 1;
      else updates.total_telegram_sent = (stateRow?.total_telegram_sent || 0) + 1;
    } else {
      result.errors++;
    }
    await supabase.from('user_engagement_state').upsert(updates, { onConflict: 'user_id' });
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`[${requestId}] re-engage done:`, result);
  return { ok: true, ...result };
}

// ============================================================
// INBOUND EMAIL → AI REPLY (merged from email-inbound-reply)
// ============================================================

const INBOUND_SYSTEM_PROMPT = `You are ${BRAND_CONFIG.name}'s AI Career Assistant replying by EMAIL.

🎯 ROLE:
- Help the user with their job search / employer questions
- Be warm, concise, and actionable
- Reference their profile/company data only when relevant

🇮🇳 LANGUAGE:
- Reply in Hinglish if their email is in Hindi/Hinglish, English otherwise
- Keep replies friendly and human (200–350 words max)

✉️ EMAIL FORMATTING:
- Plain text — it is wrapped in HTML automatically
- Use short paragraphs and bullet lists
- Always sign off as "Workly India Team"
- Include the website link once: ${BRAND_CONFIG.canonicalUrl}

🔐 PRIVACY:
- Only share THIS user's data
- If user is not registered, encourage signup at ${BRAND_CONFIG.canonicalUrl}

💼 PLATFORM CONTEXT:
- India's #1 Workly India job portal
- 75,000+ active job seekers, 15,000+ jobs, 2,000+ verified companies
- Job seekers NEVER pay any fees`;

function extractReplyBody(item: any): string {
  const candidates = [item.ExtractedMarkdownMessage, item.ExtractedHtmlMessage, item.RawTextBody, item.TextBody, item.HtmlBody];
  let raw = '';
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length > 0) { raw = c; break; }
  }
  raw = raw.replace(/^On\s.+wrote:[\s\S]*$/m, '').trim();
  raw = raw.split('\n').filter((line) => !line.trim().startsWith('>')).join('\n').trim();
  raw = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return raw.slice(0, 4000);
}

function detectInboundLanguage(text: string): 'hi' | 'en' {
  const hindi = /[\u0900-\u097F]|kya|hai|hain|kaise|kab|kahan|naukri|chahiye|karni|karna|mujhe|mera|mere|kuch|batao|bolo/i;
  return hindi.test(text) ? 'hi' : 'en';
}

async function findInboundUserByEmail(supabase: any, email: string) {
  const lower = email.trim().toLowerCase();
  const result: any = { profile: null, company: null, userId: null, name: null };
  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id, full_name, email, city, state, current_position, experience_years, skills, profile_completion_percentage')
    .ilike('email', lower).limit(1).maybeSingle();
  if (profile) { result.profile = profile; result.userId = profile.user_id; result.name = profile.full_name; }
  const { data: company } = await supabase
    .from('companies')
    .select('user_id, company_name, email, industry, city, state, is_verified')
    .ilike('email', lower).limit(1).maybeSingle();
  if (company) {
    result.company = company;
    if (!result.userId) { result.userId = company.user_id; result.name = company.company_name; }
  }
  return result;
}

// Multi-provider / multi-model chain (same routing as the AI chat page).
async function callInboundAi(systemPrompt: string, userPrompt: string): Promise<{ text: string; model: string } | null> {
  const result = await runAiChain(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    { label: 'inbound-email-ai', maxTokens: 600, temperature: 0.7 },
  );
  if (!result) return null;
  return { text: result.text, model: `${result.gateway} / ${result.model}` };
}

async function sendInboundEmailReply(supabaseUrl: string, serviceKey: string, to: string, toName: string | null, subject: string, htmlContent: string, textContent: string) {
  const res = await fetch(`${supabaseUrl}/functions/v1/email-api/send-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify({ to, toName: toName || to, subject, htmlContent, textContent }),
  });
  return res.json().catch(() => ({ success: false }));
}

function inboundHtmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inboundAiTextToHtml(text: string): string {
  const safe = inboundHtmlEscape(text);
  const paragraphs = safe.split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`).join('');
  return `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#222;">
    ${paragraphs}
    <p style="color:#666;font-size:13px;margin-top:18px;">— Workly India Team<br/>
      <a href="${BRAND_CONFIG.canonicalUrl}" style="color:#2563eb;">${BRAND_CONFIG.canonicalDomain}</a>
    </p>
  </div>`;
}

async function handleInboundReply(supabase: any, payload: any, requestId: string) {
  const startTime = Date.now();
  if (buildAiGateways().length === 0) {
    console.error(`[${requestId}] ❌ no AI provider key configured (LOVABLE_API_KEY etc.)`);
    return { success: false, error: 'AI not configured' };
  }
  const items: any[] = Array.isArray(payload?.items) ? payload.items : Array.isArray(payload) ? payload : [payload];
  const results: any[] = [];

  for (const item of items) {
    const fromEmail = item?.From?.Address || item?.from?.email || item?.sender?.email || '';
    const fromName = item?.From?.Name || item?.from?.name || item?.sender?.name || null;
    const subjectRaw: string = item?.Subject || item?.subject || '(no subject)';
    const replyText = extractReplyBody(item);

    console.log(`[${requestId}] 📧 Inbound:`, { from: fromEmail ? fromEmail.slice(0, 3) + '***' : 'unknown', subject: subjectRaw.slice(0, 60), bodyLen: replyText.length });

    if (!fromEmail || !replyText) { results.push({ skipped: true, reason: 'missing_from_or_body' }); continue; }
    if (/mailer-daemon|no-?reply|do-?not-?reply|postmaster|bounce/i.test(fromEmail) ||
        /auto[-\s]?reply|out of office|vacation|delivery (failure|status)/i.test(subjectRaw)) {
      results.push({ skipped: true, reason: 'auto_or_bounce' }); continue;
    }

    const matched = await findInboundUserByEmail(supabase, fromEmail);
    const limit = matched.userId
      ? await reserveAiChatMessage(supabase, matched.userId, 'email-html')
      : await checkAiChatLimit(supabase, matched.userId, 'email-html');
    const subject = /^re:/i.test(subjectRaw) ? subjectRaw : `Re: ${subjectRaw}`;

    if (matched.userId && !limit.allowed) {
      const upgradeText = limit.upgradeMessage.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      const sendRes = await sendInboundEmailReply(SUPABASE_URL, SERVICE_KEY, fromEmail, fromName || matched.name, subject, limit.upgradeMessage, upgradeText);
      try {
        await supabase.from('ai_chat_email_log').insert({
          user_id: matched.userId, recipient_email: fromEmail, subject,
          status: sendRes?.success ? 'limit_nudge_sent' : 'limit_nudge_failed',
          error_message: sendRes?.success ? null : JSON.stringify(sendRes).slice(0, 400),
        });
      } catch (e) { console.error('⚠️ ai_chat_email_log insert failed:', e); }
      results.push({ from: fromEmail, status: 'limit_reached', plan: limit.plan, used: limit.used, limit: limit.limit, sent: !!sendRes?.success });
      continue;
    }

    const lang = detectInboundLanguage(replyText);
    let userContext = '';
    if (matched.profile) {
      const p = matched.profile;
      userContext = `\n\nUSER (Job Seeker):\n- Name: ${p.full_name || 'N/A'}\n- Location: ${p.city || ''} ${p.state || ''}\n- Current role: ${p.current_position || 'N/A'}\n- Experience: ${p.experience_years || 0} yrs\n- Skills: ${(p.skills || []).slice(0, 6).join(', ') || 'N/A'}\n- Profile completion: ${p.profile_completion_percentage || 0}%`;
    } else if (matched.company) {
      const c = matched.company;
      userContext = `\n\nUSER (Employer):\n- Company: ${c.company_name}\n- Industry: ${c.industry || 'N/A'}\n- Location: ${c.city || ''} ${c.state || ''}\n- Verified: ${c.is_verified ? 'Yes' : 'No'}`;
    } else {
      userContext = `\n\nUSER NOT REGISTERED. Politely guide them to sign up at ${BRAND_CONFIG.canonicalUrl}.`;
    }

    // 🔍 Inject Supabase diagnostic snapshot for smarter AI replies
    try {
      const diag = await buildUserDiagnosticSnapshot(supabase, matched.userId, {
        channel: 'email',
        identifier: fromEmail,
      });
      const platformHealth = diag.hasIssues ? await fetchRecentPlatformErrors(supabase) : '';
      userContext += `\n\n🔍 SUPABASE DIAGNOSTIC (use to give precise help):\n${diag.summary}`;
      if (platformHealth) userContext += `\n\n${platformHealth}`;
    } catch (e) {
      console.warn('⚠️ email diagnostic failed:', e);
    }

    const userPrompt = `Language: ${lang === 'hi' ? 'Hindi/Hinglish' : 'English'}\nOriginal subject: ${subjectRaw}\n\nTheir reply:\n${replyText}${userContext}`;
    const ai = await callInboundAi(INBOUND_SYSTEM_PROMPT, userPrompt);

    if (!ai) {
      const fallbackText = lang === 'hi'
        ? `Namaste${matched.name ? ' ' + matched.name : ''}!\n\nAapka message mil gaya. Hum jaldi hi aapko reply karenge.\n\n— Workly India Team\n${BRAND_CONFIG.canonicalUrl}`
        : `Hello${matched.name ? ' ' + matched.name : ''}!\n\nThanks for your reply — we received it and will get back to you shortly.\n\n— Workly India Team\n${BRAND_CONFIG.canonicalUrl}`;
      await sendInboundEmailReply(SUPABASE_URL, SERVICE_KEY, fromEmail, fromName || matched.name, subject, inboundAiTextToHtml(fallbackText), fallbackText);
      results.push({ from: fromEmail, status: 'fallback_sent' });
      continue;
    }

    const html = inboundAiTextToHtml(ai.text);
    const sendRes = await sendInboundEmailReply(SUPABASE_URL, SERVICE_KEY, fromEmail, fromName || matched.name, subject, html, ai.text);

    try {
      await supabase.from('ai_chat_email_log').insert({
        user_id: matched.userId || '00000000-0000-0000-0000-000000000000',
        recipient_email: fromEmail, subject,
        status: sendRes?.success ? 'sent' : 'failed',
        error_message: sendRes?.success ? null : JSON.stringify(sendRes).slice(0, 400),
      });
    } catch (e) { console.error('⚠️ ai_chat_email_log insert failed:', e); }

    results.push({ from: fromEmail, status: sendRes?.success ? 'replied' : 'send_failed', model: ai.model, matched_user: !!matched.userId });
  }

  return { success: true, processed: results.length, elapsed_ms: Date.now() - startTime, results };
}

// ============================================================
// OUTBOUND EVENT WEBHOOK (delivered, opened, click, bounce, spam, ...)
// ============================================================

// Map raw provider event → normalized type stored in DB
function normalizeEmailEvent(ev: string): string {
  const e = (ev || '').toLowerCase().trim();
  if (e === 'click') return 'clicked';
  if (e === 'open' || e === 'opened' || e === 'unique_opened') return 'opened';
  if (e === 'delivered' || e === 'request' || e === 'sent') return 'delivered';
  if (e === 'hard_bounce' || e === 'soft_bounce' || e === 'bounce') return 'bounced';
  if (e === 'spam' || e === 'complaint') return 'spam';
  if (e === 'unsubscribed' || e === 'list_addition' || e === 'unsubscribe') return 'unsubscribed';
  if (e === 'blocked') return 'blocked';
  if (e === 'deferred') return 'deferred';
  if (e === 'invalid_email' || e === 'error') return 'error';
  return e || 'unknown';
}

async function findUserIdByEmailLite(supabase: any, email: string): Promise<{ user_id: string | null; user_type: string | null }> {
  const lower = (email || '').trim().toLowerCase();
  if (!lower) return { user_id: null, user_type: null };
  const { data: profile } = await supabase
    .from('profiles').select('user_id').ilike('email', lower).limit(1).maybeSingle();
  if (profile?.user_id) return { user_id: profile.user_id, user_type: 'jobseeker' };
  const { data: company } = await supabase
    .from('companies').select('user_id').ilike('email', lower).limit(1).maybeSingle();
  if (company?.user_id) return { user_id: company.user_id, user_type: 'employer' };
  return { user_id: null, user_type: null };
}

async function handleOutboundEvents(supabase: any, payload: any, requestId: string) {
  const startTime = Date.now();
  // Payload can be a single object OR { events: [...] } OR plain array
  const events: any[] = Array.isArray(payload?.events)
    ? payload.events
    : Array.isArray(payload)
    ? payload
    : [payload];

  const inserted: any[] = [];
  let unsubCount = 0;
  let bounceCount = 0;
  let spamCount = 0;
  let openedCount = 0;
  let clickedCount = 0;

  for (const ev of events) {
    const recipient: string = (ev?.email || ev?.recipient || ev?.to || '').toString().trim().toLowerCase();
    const rawEvent: string = ev?.event || ev?.event_type || ev?.type || '';
    if (!recipient || !rawEvent) {
      inserted.push({ skipped: true, reason: 'missing_email_or_event' });
      continue;
    }

    const eventType = normalizeEmailEvent(rawEvent);
    const subject: string | null = ev?.subject || ev?.['X-Mailin-custom']?.subject || null;
    const messageId: string | null = ev?.['message-id'] || ev?.message_id || ev?.messageId || null;
    const clickedLink: string | null = ev?.link || ev?.url || null;
    const bounceReason: string | null = ev?.reason || ev?.bounce_reason || null;
    const eventAtRaw = ev?.date || ev?.ts_event || ev?.ts || ev?.timestamp;
    let eventAt: string;
    try {
      eventAt = eventAtRaw ? new Date(typeof eventAtRaw === 'number' ? eventAtRaw * 1000 : eventAtRaw).toISOString() : new Date().toISOString();
    } catch { eventAt = new Date().toISOString(); }

    const { user_id, user_type } = await findUserIdByEmailLite(supabase, recipient);

    const { error: insErr } = await supabase.from('email_outbound_events').insert({
      recipient_email: recipient,
      event_type: eventType,
      subject,
      message_id: messageId,
      clicked_link: clickedLink,
      bounce_reason: bounceReason,
      user_id,
      user_type,
      raw_payload: ev,
      event_at: eventAt,
    });
    if (insErr) {
      console.error(`[${requestId}] ⚠️ outbound insert failed:`, insErr.message);
      inserted.push({ recipient, event: eventType, error: insErr.message });
      continue;
    }

    // Update engagement state so AI re-engagement scheduler is aware
    if (user_id) {
      try {
        if (eventType === 'opened') {
          openedCount++;
          await supabase.from('user_engagement_state').upsert({
            user_id, email: recipient,
            email_response_count: 1, // best-effort marker; existing rows will keep their count via merge logic below
            last_email_opened_at: eventAt,
            updated_at: new Date().toISOString(),
          } as any, { onConflict: 'user_id', ignoreDuplicates: false }).catch(() => {});
        } else if (eventType === 'clicked') {
          clickedCount++;
          await supabase.from('user_engagement_state').upsert({
            user_id, email: recipient,
            last_email_clicked_at: eventAt,
            updated_at: new Date().toISOString(),
          } as any, { onConflict: 'user_id' }).catch(() => {});
        } else if (eventType === 'unsubscribed') {
          unsubCount++;
          await supabase.from('user_engagement_state').upsert({
            user_id, email: recipient,
            is_unsubscribed: true,
            unsubscribed_at: eventAt,
            updated_at: new Date().toISOString(),
          } as any, { onConflict: 'user_id' }).catch(() => {});
        } else if (eventType === 'spam') {
          spamCount++;
          await supabase.from('user_engagement_state').upsert({
            user_id, email: recipient,
            is_unsubscribed: true,
            preferred_channel: 'none',
            updated_at: new Date().toISOString(),
          } as any, { onConflict: 'user_id' }).catch(() => {});
        } else if (eventType === 'bounced' || eventType === 'blocked') {
          bounceCount++;
          // Hard bounce → stop emailing; soft we still track but don't block.
          const isHard = (rawEvent || '').toLowerCase().includes('hard') || eventType === 'blocked';
          if (isHard) {
            await supabase.from('user_engagement_state').upsert({
              user_id, email: recipient,
              preferred_channel: 'telegram',
              email_bounced_at: eventAt,
              updated_at: new Date().toISOString(),
            } as any, { onConflict: 'user_id' }).catch(() => {});
          }
        }
      } catch (e: any) {
        console.warn(`[${requestId}] engagement state update failed:`, e?.message);
      }
    }

    inserted.push({ recipient, event: eventType, matched_user: !!user_id });
  }

  console.log(`[${requestId}] 📊 outbound events: opened=${openedCount} clicked=${clickedCount} unsub=${unsubCount} spam=${spamCount} bounce=${bounceCount}`);

  return {
    success: true,
    processed: inserted.length,
    elapsed_ms: Date.now() - startTime,
    summary: { opened: openedCount, clicked: clickedCount, unsubscribed: unsubCount, spam: spamCount, bounced: bounceCount },
    results: inserted,
  };
}

// ============================================================
// MAIN HANDLER (routes: automation rules, re-engagement, inbound reply, outbound events)
// ============================================================

export const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const requestId = crypto.randomUUID().substring(0, 8);
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const body = await req.json().catch(() => ({}));

    if (isSupportMailAction(body?.action)) {
      try {
        const out = await handleSupportMailAction(body.action, req, body);
        return new Response(JSON.stringify(out), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Support email request failed';
        console.error('[support-mail] action failed', message);
        return new Response(JSON.stringify({ success: false, error: message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }
    }

    // ---- ACTION: owner customer-service desk (its own mailboxes + persona) ----
    if (isSupportAction(body?.action)) {
      try {
        const out = await handleSupportAction(body.action, req, body);
        return new Response(JSON.stringify(out), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Customer service request failed';
        console.error('[support-desk] action failed', message);
        return new Response(JSON.stringify({ success: false, error: message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }
    }

    // ---- ACTION: per-user Gmail AI auto-reply (each user's own inbox) ----
    if (isGmailAction(body?.action)) {
      const out = await handleGmailAction(body.action, req, body);
      // Reuse the existing protected hourly check: support mailboxes otherwise
      // never participate in personal Gmail/Outlook/domain schedules.
      if (body.action === 'gmail_autoreply_cron' && out?.success === true) {
        const support = await handleSupportAction('support_autoreply_cron', req, body);
        return new Response(JSON.stringify({ ...out, support }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
        });
      }
      return new Response(JSON.stringify(out), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // ---- ACTION: per-user Outlook AI auto-reply (each user's own mailbox) ----
    if (isOutlookAction(body?.action)) {
      try {
        const out = await handleOutlookAction(body.action, req, body);
        return new Response(JSON.stringify(out), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Outlook request failed';
        console.error('[user-outlook] action failed', message);
        return new Response(JSON.stringify({ success: false, error: message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }
    }

    // ---- ACTION: per-user custom / domain mailbox AI auto-reply (IMAP + SMTP) ----
    if (isCustomEmailAction(body?.action)) {
      try {
        const out = await handleCustomEmailAction(body.action, req, body);
        return new Response(JSON.stringify(out), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Custom email request failed';
        console.error('[custom-email] action failed', message);
        return new Response(JSON.stringify({ success: false, error: message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }
    }


    // ---- ACTION: inbound email reply (mailbox webhook) ----
    // Auto-detect: explicit action OR inbound payload shape (items[] / From / RawTextBody)
    const looksLikeInbound =
      body?.action === 'inbound_reply' ||
      Array.isArray(body?.items) ||
      body?.From?.Address ||
      body?.RawTextBody !== undefined ||
      body?.ExtractedMarkdownMessage !== undefined;

    if (looksLikeInbound) {
      console.log(`[${requestId}] 📨 Inbound email reply triggered`);
      const out = await handleInboundReply(supabase, body, requestId);
      return new Response(JSON.stringify(out), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // ---- ACTION: outbound email events ----
    // Auto-detect outbound events: payload has `event` field (delivered, opened, click, bounce, etc.)
    // OR an `events: [...]` array. NOT to be confused with our internal `event_type` automation trigger.
    const looksLikeOutbound =
      body?.action === 'outbound_event' ||
      Array.isArray(body?.events) ||
      (typeof body?.event === 'string' && (body?.email || body?.recipient)) ||
      (Array.isArray(body) && body.length > 0 && typeof body[0]?.event === 'string');

    if (looksLikeOutbound) {
      console.log(`[${requestId}] 📊 Outbound email events triggered`);
      const out = await handleOutboundEvents(supabase, body, requestId);
      return new Response(JSON.stringify(out), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const action = body.action || (body.event_type ? 'event' : 'event');

    // ---- ACTION: re-engagement scheduler ----
    if (action === 'run_re_engagement') {
      return new Response(JSON.stringify({ ok: false, reason: 'removed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 410,
      });
    }

    // ---- ACTION: quick test send for engagement templates (debugging mobile width) ----
    if (action === 'test_send_engagement') {
      const email = body.email;
      const name = body.name || 'Vishal';
      const style = body.template_style || 'hero_cta';
      const subject = body.subject || `[${style}] Full-width mobile test`;
      const message = body.message || `Hi ${name},\n\nThis is a full-width edge-to-edge mobile email test. Aap is email ko mobile pe kholiye — kinare se kinare tak content fill hona chahiye, jaise Bajaj wala email tha.\n\nAgar dono side gap dikhe to template fix nahi hua.`;
      const htmlBody = body.html_body || `
        <div style="background:#1E40AF;padding:32px 24px;color:#ffffff;width:100%;">
          <div style="font-size:13px;letter-spacing:1.5px;text-transform:uppercase;opacity:.85;">Workly India</div>
          <div style="font-size:22px;font-weight:700;margin-top:6px;line-height:1.3;">Bajaj-style full-width test</div>
        </div>
        <div style="padding:24px;color:#222;font-size:16px;line-height:1.6;width:100%;">
          <p style="margin:0 0 14px;">Hi ${name},</p>
          <p style="margin:0 0 14px;">Yeh email ka hero banner edge-to-edge hona chahiye — koi white gap nahi.</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;width:100%;margin:16px 0;">
            <tr><td style="padding:16px;color:#374151;font-size:14px;">Inner section bhi full-width — sirf 16-24px text padding.</td></tr>
          </table>
          <div style="text-align:center;margin:24px 0;">
            <a href="${WEBSITE_DOMAIN}" style="background:#1E40AF;color:#fff;padding:14px 28px;text-decoration:none;font-weight:600;display:inline-block;">Visit Workly</a>
          </div>
        </div>`;
      const ai = {
        subject,
        message,
        template_style: style as TemplateStyle,
        cta_text: 'Visit site',
        cta_url: WEBSITE_DOMAIN,
        html_body: style === 'ai_custom' ? htmlBody : undefined,
      };
      const ok = await sendEngagementEmail(
        supabase,
        email,
        name,
        ai,
        body.audience === 'employer' ? 'employer' : 'jobseeker',
      );
      return new Response(JSON.stringify({ success: ok, sent_to: email, template_style: style }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
      });
    }

    // ---- ACTION: original event-driven email automation ----
    console.log(`[${requestId}] 📧 Email trigger handler invoked`);
    const {
      event_type, user_id, email: directEmail, user_type, name, metadata = {},
    } = body;

    if (!event_type) {
      return new Response(JSON.stringify({ success: false, error: 'event_type is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
      });
    }

    const { data: rule, error: ruleError } = await supabase
      .from('email_automation_rules')
      .select('*, email_templates(*)')
      .eq('trigger_event', event_type)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (ruleError) {
      console.error(`[${requestId}] ❌ rule fetch error:`, ruleError);
      return new Response(JSON.stringify({ success: false, error: 'rule fetch failed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
      });
    }

    if (!rule) {
      return new Response(JSON.stringify({ success: false, error: `No active rule for: ${event_type}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
      });
    }

    const template = rule.email_templates;
    if (!template) {
      return new Response(JSON.stringify({ success: false, error: 'No template linked' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
      });
    }

    let recipientEmail = directEmail;
    let recipientName = name || 'User';

    if (!recipientEmail && user_id) {
      if (user_type === 'employer') {
        const { data: company } = await supabase
          .from('companies').select('email, company_name').eq('user_id', user_id).maybeSingle();
        recipientEmail = company?.email;
        recipientName = name || company?.company_name || 'Employer';
      } else {
        const { data: profile } = await supabase
          .from('profiles').select('email, full_name').eq('user_id', user_id).maybeSingle();
        recipientEmail = profile?.email;
        recipientName = name || profile?.full_name || 'User';
      }
    }

    if (!recipientEmail) {
      return new Response(JSON.stringify({ success: false, error: 'No recipient email' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
      });
    }

    let subject = template.subject || '';
    let htmlContent = template.html_content || '';
    // Fill from every value we can actually resolve (profile/company record +
    // clock), not just the name, and support both {key} and {{key}} styles.
    const enriched = user_id
      ? await enrichTemplateValues(supabase, {
          userId: user_id,
          employerSide: user_type === 'employer',
          values: { name: recipientName, user_name: recipientName, email: recipientEmail, ...metadata },
        })
      : { name: recipientName, user_name: recipientName, email: recipientEmail, ...metadata };
    const variables: Record<string, string> = {};
    for (const [k, v] of Object.entries(enriched)) {
      if (v !== undefined && v !== null && String(v).trim() !== '') variables[k] = String(v);
    }
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = new RegExp(`\\{\\{?\\s*${key}\\s*\\}?\\}`, 'gi');
      subject = subject.replace(placeholder, value);
      htmlContent = htmlContent.replace(placeholder, value);
    }

    // Saved template only — no AI rewriting.


    const { error: emailError } = await supabase.functions.invoke('email-api/send-email', {
      body: {
        to: recipientEmail,
        toName: recipientName,
        subject,
        htmlContent,
        textContent: template.text_content || '',
        audience: user_type === 'employer' ? 'employer' : 'jobseeker',
      },
    });

    if (emailError) {
      console.error(`[${requestId}] ❌ email error:`, emailError);
      return new Response(JSON.stringify({ success: false, error: 'send failed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
      });
    }

    await supabase.from('email_automation_rules').update({
      execution_count: (rule.execution_count || 0) + 1,
      last_executed_at: new Date().toISOString(),
    }).eq('id', rule.id);

    console.log(`[${requestId}] ✅ Email sent to ${recipientEmail} for ${event_type}`);
    return new Response(JSON.stringify({
      success: true, message: `Email sent to ${recipientEmail}`, event_type, template_name: template.name,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

  } catch (error: any) {
    console.error(`[${requestId}] ❌ fatal:`, error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    });
  }
};
