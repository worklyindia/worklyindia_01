import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { composeNotification } from "../../_shared/ai-notification-composer.ts";
import { handleUserBotAction, isUserBotAction } from "../../_shared/userTelegramBot.ts";
import { WEBSITE_DOMAIN } from '../../_shared/domain.ts';
import { enrichTemplateValues } from '../../_shared/lifecycleFanout.ts';
import { escapeHtml as escapeTemplateHtml, renderTelegramTemplateHtml, telegramMessagePayload, templateHasHtml } from '../../_shared/templateHtml.ts';
// All push sending goes through the single email-api hub.
import { sendPushToDevices } from '../../_shared/pushBridge.ts';


/**
 * UNIFIED TELEGRAM API - Consolidated Edge Function
 * 
 * Replaces: telegram-channel-delete, telegram-channel-post, telegram-queue-processor,
 *           telegram-trigger-handler, telegram-webhook
 * 
 * Actions: channel-delete, channel-post, process-queue, trigger, webhook
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_MESSAGES_PER_BATCH = 100;
const BATCH_DELAY_MS = 20;

/**
 * Strip leftover {{placeholder}} tokens so unrendered template variables
 * never reach end users. Keeps message readable.
 */
function sanitizePlaceholders(text: string): string {
  if (!text) return text;
  let out = text
    .replace(/\{\{\s*[\w.]+\s*\}\}/g, '')
    .replace(/(?<![\w<])\{\s*[a-z_][a-z0-9_]{0,40}\s*\}(?![\w>])/gi, '');
  // If a salutation got emptied (e.g. "Hey ," / "Hi !"), drop the line.
  out = out.replace(/^[ \t]*(hey|hi|hello|dear|namaste)\s*[,.!:-]+[ \t]*$/gim, '');
  out = out.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return out;
}

/**
 * A Telegram CHANNEL is a broadcast to many subscribers — never one user.
 * Channel chat_ids are negative (supergroup/channel IDs start with -100...).
 * For channel posts, additionally strip personal-DM patterns: salutations
 * with names ("Hey Rahul,"), single-recipient pronouns, and any remaining
 * {{...}} tokens — replacing them with safe community phrasing.
 */
function isChannelChatId(chatId: unknown): boolean {
  if (chatId === null || chatId === undefined) return false;
  const s = String(chatId);
  return s.startsWith('-100') || s.startsWith('-1');
}

function sanitizeForChannel(text: string): string {
  if (!text) return text;
  let out = text;
  // Drop "Hey {{name}}," / "Hi <name>!" salutations entirely (first line only).
  out = out.replace(
    /^(hey|hi|hello|dear|namaste)\b[^\n]{0,80}[,!.:][ \t]*\n+/i,
    ''
  );
  // Replace any remaining placeholder tokens with empty string.
  out = out
    .replace(/\{\{\s*[\w.]+\s*\}\}/g, '')
    .replace(/(?<![\w<])\{\s*[a-z_][a-z0-9_]{0,40}\s*\}(?![\w>])/gi, '');
  // Collapse "Apply now: " / "Click here:" lines that lost their URL.
  out = out.replace(/(apply now|click here|details|link)\s*[:\-]\s*(?=$|\n)/gim, `$1: ${WEBSITE_DOMAIN}`);
  out = out.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return out;
}

function hasPlaceholderLeak(text: string): boolean {
  if (!text) return false;
  return /\{\{\s*[\w.]+\s*\}\}/.test(text) || /(?<![\w<])\{\s*[a-z_][a-z0-9_]{0,40}\s*\}(?![\w>])/i.test(text);
}

export const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID().substring(0, 8);
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const action = url.searchParams.get('action') || body.action || 'webhook';

    // ---- Per-user bots: each user connects their OWN BotFather bot ----
    // Handled before platform bot lookup; failures return a readable message instead of a 500.
    if (isUserBotAction(action)) {
      let out: unknown;
      try {
        out = await handleUserBotAction(action, req, body, url, supabaseUrl);
      } catch (e) {
        const msg = (e as any)?.message || String(e);
        console.error('[user_bot]', action, msg);
        out = { success: false, error: msg };
      }
      return new Response(JSON.stringify(out), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Audience: job_seeker / employer -> alag bot token
    const rawAudience = (url.searchParams.get('audience') || body.audience || '').toString();
    // Explicit audience (caller ne bheji) -> us side ka bot hi use hota hai.
    const explicitAudience: Audience | null =
      rawAudience === 'employer' ? 'employer' : rawAudience === 'job_seeker' || rawAudience === 'jobseeker' ? 'job_seeker' : null;
    const audience: Audience = explicitAudience || 'job_seeker';
    const audienceToken = await getAudienceBotToken(supabase, audience);

    // Token save karte hi: username fetch + webhook auto set
    if (action === 'bot_setup') {
      const setupToken = (body.token || '').toString().trim();
      const setupAudience: Audience = (body.audience === 'employer') ? 'employer' : 'job_seeker';
      const meRes = await fetch(`https://api.telegram.org/bot${setupToken}/getMe`);
      const me = await meRes.json();
      if (!me?.ok) {
        return new Response(
          JSON.stringify({ success: false, error: me?.description || 'Invalid bot token' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      const webhookUrl = `${supabaseUrl}/functions/v1/email-api/telegram?action=webhook&audience=${setupAudience}`;
      const hookRes = await fetch(`https://api.telegram.org/bot${setupToken}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ['message', 'edited_message', 'callback_query'],
        }),
      });
      const hook = await hookRes.json();
      return new Response(
        JSON.stringify({
          success: true,
          username: me.result?.username,
          name: me.result?.first_name,
          webhookSet: !!hook?.ok,
          webhookUrl,
          webhookError: hook?.ok ? null : (hook?.description || null),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (action === 'bot_info') {
      const probeToken = (body.token || '').toString().trim();
      const meRes = await fetch(`https://api.telegram.org/bot${probeToken}/getMe`);
      const me = await meRes.json();
      return new Response(
        JSON.stringify(
          me?.ok
            ? { success: true, username: me.result?.username, name: me.result?.first_name }
            : { success: false, error: me?.description || 'Invalid bot token' },
        ),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (action === 'configured_bots_status') {
      const statuses = await Promise.all((['job_seeker', 'employer'] as Audience[]).map(async (side) => {
        const token = await getAudienceBotToken(supabase, side);
        if (!token) return { audience: side, configured: false, username: null };
        try {
          const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
          const info = await response.json();
          return {
            audience: side,
            configured: true,
            valid: Boolean(info?.ok),
            username: info?.ok ? info.result?.username || null : null,
          };
        } catch (_error) {
          return { audience: side, configured: true, valid: false, username: null };
        }
      }));
      return new Response(JSON.stringify({ success: true, bots: statuses }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const activeToken = audienceToken || botToken;

    if (!activeToken) {
      return new Response(JSON.stringify({ success: false, error: 'Bot token not configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    // Channel posts hamesha employers bot se jaate hain; configured employer bot
    // na ho to active token hi use hota hai.
    const employerToken = (await getAudienceBotToken(supabase, 'employer')) || activeToken;


    console.log(`[${requestId}] Unified Telegram API - Action: ${action}`);

    let result: any = { action };


    switch (action) {
      case 'channel-delete':
        result = await handleChannelDelete(supabase, employerToken, body, requestId);
        break;
      case 'channel-post':
        result = await handleChannelPost(supabase, employerToken, body, requestId);
        break;
      case 'process-queue':
        result = await handleProcessQueue(supabase, activeToken, body, requestId);
        break;
      case 'trigger':
        result = await handleTrigger(supabase, activeToken, body, requestId);
        break;
      case 'webhook':
        result = await handleWebhook(supabase, activeToken, body, requestId, supabaseUrl, audience);
        break;
      case 'login_verify':
        result = await handleLoginVerify(supabase, activeToken, body);
        break;
      case 'setup':
        result = await handleSetup(supabase, activeToken, body, supabaseUrl);
        break;
      case 'send': {
        const sendToken = await resolveSendToken(supabase, explicitAudience, body.chat_id, activeToken);
        if (!sendToken) {
          console.warn(`[${requestId}] No ${explicitAudience} bot token configured — message skipped.`);
          result = { success: false, error: `No bot token configured for ${explicitAudience}` };
          break;
        }
        result = await handleDirectSend(sendToken, body, supabase);
        break;
      }
      case 'delete_message': {
        const delChatId = Number(body.chat_id);
        const delMessageId = Number(body.message_id);
        if (!delChatId || !delMessageId) {
          result = { success: false, error: 'chat_id and message_id are required' };
          break;
        }
        await deleteTelegramMessage(activeToken, delChatId, delMessageId);
        result = { success: true };
        break;
      }
      case 'send_template': {
        const chatId = body.chat_id;
        const eventType = (body.event_type || '').toString();
        if (!chatId || !eventType) {
          result = { success: false, error: 'chat_id and event_type are required' };
          break;
        }
        // Saved templates use {{name}}, {{email}}, {{mobile}}, {{company}} and
        // date/time; callers rarely send them, so fill from the record first.
        const templateUserId = typeof body.user_id === 'string' ? body.user_id : '';
        const enrichedVars = await enrichTemplateValues(supabase, {
          userId: templateUserId,
          templateKey: eventType,
          employerSide: explicitAudience === 'employer',
          values: (body.variables || {}) as Record<string, unknown>,
        });
        const rendered = await renderTemplate(
          supabase,
          eventType,
          Object.fromEntries(
            Object.entries(enrichedVars)
              .filter(([, v]) => v !== undefined && v !== null)
              .map(([k, v]) => [k, String(v)]),
          ),
        );
        if (!rendered) {
          result = { success: false, error: 'Template not found or inactive' };
          break;
        }
        const templateToken = await resolveSendToken(supabase, explicitAudience, chatId, activeToken);
        if (!templateToken) {
          console.warn(`[${requestId}] No ${explicitAudience} bot token configured — template skipped.`);
          result = { success: false, error: `No bot token configured for ${explicitAudience}` };
          break;
        }
        const messageId = await sendTelegramMessage(templateToken, chatId, rendered);
        result = { success: !!messageId, sent: !!messageId, message_id: messageId };

        break;
      }


      case 'channel_membership':
        result = await handleChannelMembership(supabase, employerToken, body);
        break;

      case 'hourly-broadcast':
        result = await handleHourlyBroadcast(supabase, activeToken, body, requestId, supabaseUrl, supabaseKey);
        break;
      default:
        // Default to webhook handling for direct Telegram updates
        if (body.message || body.callback_query) {
          result = await handleWebhook(supabase, activeToken, body, requestId, supabaseUrl, audience);
        } else {
          result = { error: `Unknown action: ${action}` };
        }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error(`[${requestId}] Error:`, error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
};

// ============ CHANNEL DELETE (from telegram-channel-delete) ============
async function handleChannelDelete(supabase: any, botToken: string, body: any, requestId: string) {
  const { job_id } = body;

  if (!job_id) {
    return { success: false, error: 'job_id is required' };
  }

  const { data: job } = await supabase
    .from('jobs')
    .select('telegram_channel_message_id')
    .eq('id', job_id)
    .single();

  if (!job?.telegram_channel_message_id) {
    return { success: false, error: 'No channel message to delete' };
  }

  const { data: settings } = await supabase
    .from('telegram_bot_settings')
    .select('channel_chat_id')
    .limit(1)
    .maybeSingle();

  const chatTarget = (await getChannelUsername(supabase)) || settings?.channel_chat_id;
  if (!chatTarget) {
    return { success: false, error: 'Channel not configured' };
  }

  const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/deleteMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatTarget,
      message_id: job.telegram_channel_message_id
    })
  });

  const telegramResult = await telegramResponse.json();

  await supabase.from('jobs').update({ telegram_channel_message_id: null }).eq('id', job_id);

  if (!telegramResult.ok) {
    return { success: false, error: telegramResult.description };
  }

  console.log(`[${requestId}] ✅ Message deleted from channel`);
  return { success: true };
}

// ============ CHANNEL POST (from telegram-channel-post) ============
async function handleChannelPost(supabase: any, botToken: string, body: any, requestId: string) {
  const { job_id, title, company_name, location, job_type, salary_min, salary_max, public_slug } = body;

  const { data: settings } = await supabase
    .from('telegram_bot_settings')
    .select('channel_chat_id, channel_enabled, job_channel_template')
    .limit(1)
    .maybeSingle();

  // Owner Portal me save kiya channel username sabse pehle, warna purana chat id.
  const chatTarget = (await getChannelUsername(supabase)) || settings?.channel_chat_id;
  if (!chatTarget) {
    return { success: false, error: 'Channel not configured or disabled' };
  }

  // Format salary
  let salaryText = 'Not Disclosed';
  if (salary_min || salary_max) {
    if (salary_min && salary_max) {
      salaryText = `₹${formatNumber(salary_min)} - ₹${formatNumber(salary_max)}`;
    } else if (salary_min) {
      salaryText = `₹${formatNumber(salary_min)}+`;
    } else if (salary_max) {
      salaryText = `Up to ₹${formatNumber(salary_max)}`;
    }
  }

  const baseUrl = WEBSITE_DOMAIN;
  const jobUrl = public_slug ? `${baseUrl}/job/${public_slug}` : `${baseUrl}/job/${job_id}`;

  // IST date/time
  const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const dd = String(nowIST.getUTCDate()).padStart(2, '0');
  const mm = MONTHS_SHORT[nowIST.getUTCMonth()];
  const yyyy = nowIST.getUTCFullYear();
  let hh = nowIST.getUTCHours();
  const min = String(nowIST.getUTCMinutes()).padStart(2, '0');
  const ampm = hh >= 12 ? 'PM' : 'AM';
  hh = hh % 12 || 12;
  const postDate = `${dd} ${mm} ${yyyy}`;
  const postTime = `${String(hh).padStart(2, '0')}:${min} ${ampm} IST`;

  // Owner Portal → Telegram Templates → "Channel job post" is the source of truth.
  let ownerTemplate: string | null = null;
  try {
    const { data: tpl } = await supabase
      .from('telegram_lifecycle_templates')
      .select('body, enabled')
      .eq('event_type', 'channel_job_post')
      .maybeSingle();
    if (tpl?.enabled !== false && typeof tpl?.body === 'string' && tpl.body.trim()) {
      ownerTemplate = tpl.body;
    }
  } catch (_) { /* fall back below */ }

  let message = ownerTemplate || settings.job_channel_template || `📌 <b>{title}</b>
🏢 {company_name}
📍 {location}
💼 {job_type}
💰 {salary}

🗓️ <b>Post Date:</b> {post_date}
⏰ <b>Post Time:</b> {post_time}

✅ <i>Verified by Workly India</i>
🔗 <a href="{job_url}">View Details &amp; Apply</a>

#WorklyIndia #WorklyIndia #Jobs #Hiring`;

  // Supports both {var} (legacy) and {{var}} (Owner Portal templates).
  const values: Record<string, string> = {
    title: escapeHtml(title || 'Untitled'),
    job_title: escapeHtml(title || 'Untitled'),
    company_name: escapeHtml(company_name || 'Company'),
    company: escapeHtml(company_name || 'Company'),
    location: escapeHtml(location || 'Remote'),
    job_type: escapeHtml(job_type || 'Full Time'),
    salary: salaryText,
    job_url: jobUrl,
    post_date: postDate,
    post_time: postTime,
    date: postDate,
    time: postTime,
  };
  for (const [key, value] of Object.entries(values)) {
    message = message
      .replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), value)
      .replace(new RegExp(`\\{\\s*${key}\\s*\\}`, 'g'), value);
  }
  message = renderTelegramTemplateHtml(sanitizePlaceholders(message));

  // The channel can live on the employer bot rather than the default one, so the
  // token for this chat is resolved the same way every other send resolves it.
  const sendToken = await tokenForChat(supabase, chatTarget, botToken);
  const telegramResponse = await fetch(`https://api.telegram.org/bot${sendToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatTarget,
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: false
    })
  });

  const telegramResult = await telegramResponse.json();

  if (!telegramResult.ok) {
    return { success: false, error: telegramResult.description };
  }

  const messageId = telegramResult.result?.message_id;
  if (messageId && job_id) {
    await supabase.from('jobs').update({ telegram_channel_message_id: messageId }).eq('id', job_id);
  }

  console.log(`[${requestId}] ✅ Message sent to channel`);

  // ============ VIP PUSH BROADCAST to ALL subscribed users ============
  // Same job that just went to the Telegram channel is also broadcast as a
  // rich OneSignal push notification (with image, VIP badge and CTA button)
  // so every subscribed user gets it instantly on web/mobile.
  let pushResult: any = { sent: false };
  try {
    {


      const pushTitle = `💼 New Job: ${title || 'Opportunity'}`;
      const companyPart = company_name ? ` at ${company_name}` : '';
      const locationPart = location ? ` • ${location}` : '';
      const salaryPart = salaryText && salaryText !== 'Not Disclosed' ? ` • ${salaryText}` : '';
      const pushMessage = `⭐ VIP Alert${companyPart}${locationPart}${salaryPart} — Tap to view & apply now!`;

      // Try to fetch a job image for the rich card (optional, best-effort)
      let bigPicture: string | null = null;
      if (job_id) {
        try {
          const { data: img } = await supabase
            .from('job_images')
            .select('image_url')
            .eq('job_id', job_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (img?.image_url) bigPicture = img.image_url;
        } catch (_) { /* ignore */ }
      }

      // Fetch ALL active player_ids from DB (source of truth for who's subscribed)
      // — OneSignal's "Subscribed Users" segment can lag or exclude freshly
      // registered players, so we target subscription IDs directly.
      const { data: tokens, error: tokErr } = await supabase
        .from('push_subscriptions')
        .select('player_id:fcm_token')
        .eq('enabled', true);

      if (tokErr) throw new Error(`Failed to fetch tokens: ${tokErr.message}`);
      const allPlayerIds: string[] = (tokens || [])
        .map((t: any) => t.player_id)
        .filter((p: any) => typeof p === 'string' && p.length > 0);

      if (allPlayerIds.length === 0) {
        pushResult = { sent: false, error: 'No active push subscribers in DB' };
        console.warn(`[${requestId}] ⚠️ No active player_ids — skipping push`);
      } else {
        // Push itself is sent by the single hub (email-api) — chunked.
        const CHUNK = 500;
        const results: any[] = [];
        for (let i = 0; i < allPlayerIds.length; i += CHUNK) {
          const chunk = allPlayerIds.slice(i, i + CHUNK);
          const r = await sendPushToDevices(supabase, {
            player_ids: chunk,
            title: pushTitle,
            message: pushMessage,
            url: jobUrl,
            no_ai: true,
            image: bigPicture || undefined,
            data: { job_id, url: jobUrl, action_url: jobUrl, type: 'new_job_channel' },
            buttons: [
              { id: 'view', text: '👀 View Job', url: jobUrl },
              { id: 'apply', text: '🚀 Apply Now', url: jobUrl },
            ],
          });
          results.push({ ok: r.sent, error: r.error });
        }
        const anyOk = results.some(r => r.ok);
        pushResult = { sent: anyOk, target: 'db_active_tokens', targeted: allPlayerIds.length, chunks: results };
        console.log(`[${requestId}] ${anyOk ? '✅' : '⚠️'} Push → targeted=${allPlayerIds.length}`);
      }
    }
  } catch (pushErr: any) {
    pushResult = { sent: false, error: pushErr?.message || String(pushErr) };
    console.error(`[${requestId}] ❌ Push broadcast error:`, pushErr);
  }

  return { success: true, message_id: messageId, channel_id: chatTarget, push: pushResult };
}

// ============ PROCESS QUEUE (from telegram-queue-processor) ============
async function handleProcessQueue(supabase: any, botToken: string, body: any, requestId: string) {
  const batchSize = Math.min(body.batch_size || MAX_MESSAGES_PER_BATCH, 150);

  const { data: messages, error: fetchError } = await supabase
    .rpc('get_telegram_queue_batch', { p_batch_size: batchSize });

  if (fetchError || !messages || messages.length === 0) {
    console.log(`[${requestId}] 📭 Queue empty`);
    return { success: true, sent: 0, failed: 0, queue_empty: true };
  }

  console.log(`[${requestId}] 📬 Processing ${messages.length} messages`);

  let sent = 0;
  let failed = 0;
  let rateLimited = false;

  // Pre-fetch trigger event types in batch (one query, not N)
  const ruleIds = Array.from(new Set(messages.map((m: any) => m.trigger_rule_id).filter(Boolean)));
  let ruleEventMap: Record<string, string> = {};
  if (ruleIds.length > 0) {
    const { data: rules } = await supabase
      .from('telegram_triggers')
      .select('id, trigger_event')
      .in('id', ruleIds);
    if (rules) ruleEventMap = Object.fromEntries(rules.map((r: any) => [r.id, r.trigger_event]));
  }

  for (const msg of messages) {
    if (rateLimited) break;

    try {
      // 🤖 AI rephrase the queued message for variety
      const evType = ruleEventMap[msg.trigger_rule_id] || 'telegram_notification';
      const meta = (msg.metadata && typeof msg.metadata === 'object') ? msg.metadata : {};
      let finalText = msg.message_content;
      try {
        const composed = await composeNotification({
          eventType: evType,
          channel: 'telegram',
          audience: meta.audience || 'user',
          language: meta.language || 'hinglish',
          variables: meta.variables || {},
          fallbackMessage: msg.message_content,
        });
        if (composed.message) finalText = composed.message;
      } catch (e) {
        console.warn(`[${requestId}] AI compose failed for msg ${msg.id}, using original:`, (e as Error).message);
      }
      finalText = sanitizePlaceholders(finalText);

      // Channel posts (negative chat_id) must never carry personal-DM
      // patterns or unrendered placeholders. Strip them as a final defense.
      if (isChannelChatId(msg.chat_id)) {
        finalText = sanitizeForChannel(finalText);
        if (hasPlaceholderLeak(finalText) || finalText.length < 20) {
          console.warn(`[${requestId}] ❌ blocking channel msg ${msg.id} — placeholder leak / too short`);
          await supabase.rpc('mark_telegram_failed', {
            p_queue_id: msg.id,
            p_error_message: 'Blocked: placeholder leak or empty after channel sanitize',
            p_is_rate_limited: false,
          });
          failed++;
          continue;
        }
      }

      // If metadata has image_url, send as photo with caption (Telegram captions max 1024 chars)
      const imageUrl = typeof meta.image_url === 'string' && meta.image_url.startsWith('http') ? meta.image_url : null;
      const sendToken = await tokenForChat(supabase, msg.chat_id, botToken);
      let telegramResponse: Response;
      if (imageUrl) {
        const caption = finalText.length > 1024 ? finalText.slice(0, 1021) + '...' : finalText;
        telegramResponse = await fetch(`https://api.telegram.org/bot${sendToken}/sendPhoto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: msg.chat_id,
            photo: imageUrl,
            caption,
            parse_mode: msg.parse_mode || 'HTML',
          }),
        });
      } else {
        telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: msg.chat_id,
            text: finalText,
            parse_mode: msg.parse_mode || 'HTML',
            disable_web_page_preview: false,
          }),
        });
      }

      const telegramResult = await telegramResponse.json();

      if (telegramResult.ok) {
        await supabase.rpc('mark_telegram_sent', {
          p_queue_id: msg.id,
          p_telegram_message_id: telegramResult.result?.message_id || null
        });
        sent++;
      } else {
        const errorCode = telegramResult.error_code;
        
        if (errorCode === 429) {
          rateLimited = true;
          await supabase.rpc('mark_telegram_failed', {
            p_queue_id: msg.id,
            p_error_message: 'Rate limited',
            p_is_rate_limited: true
          });
          failed++;
          break;
        }

        if (errorCode === 403 || errorCode === 400) {
          await supabase.rpc('mark_telegram_failed', {
            p_queue_id: msg.id,
            p_error_message: telegramResult.description || 'User blocked',
            p_is_rate_limited: false
          });
          
          if (errorCode === 403) {
            await supabase.from('profiles').update({ telegram_chat_id: null }).eq('telegram_chat_id', msg.chat_id);
            await supabase.from('companies').update({ telegram_chat_id: null }).eq('telegram_chat_id', msg.chat_id);
          }
          failed++;
        } else {
          await supabase.rpc('mark_telegram_failed', {
            p_queue_id: msg.id,
            p_error_message: telegramResult.description || 'Unknown error',
            p_is_rate_limited: false
          });
          failed++;
        }
      }

      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));

    } catch (error: any) {
      await supabase.rpc('mark_telegram_failed', {
        p_queue_id: msg.id,
        p_error_message: error.message || 'Network error',
        p_is_rate_limited: false
      });
      failed++;
    }
  }

  console.log(`[${requestId}] ✅ Complete: ${sent} sent, ${failed} failed`);
  return { success: true, sent, failed, total_processed: sent + failed, rate_limited: rateLimited };
}

// ============ TRIGGER (from telegram-trigger-handler) ============
async function handleTrigger(supabase: any, botToken: string, body: any, requestId: string) {
  const { event_type, user_id, user_type, chat_id, name, metadata } = body;

  console.log(`[${requestId}] 🎯 Trigger event: ${event_type}`);

  // Find matching automation rules
  const { data: rules } = await supabase
    .from('telegram_automation_rules')
    .select('*')
    .eq('trigger_event', event_type)
    .eq('enabled', true);

  if (!rules || rules.length === 0) {
    return { success: true, message: 'No active rules for this event' };
  }

  const results = [];

  for (const rule of rules) {
    // Get template
    const { data: template } = await supabase
      .from('telegram_message_templates')
      .select('*')
      .eq('id', rule.template_id)
      .single();

    if (!template) continue;

    // Get recipient chat ID
    let recipientChatId: number | null = null;
    
    if (chat_id) {
      recipientChatId = typeof chat_id === 'string' ? parseInt(chat_id, 10) : chat_id;
    } else if (user_id) {
      if (user_type === 'employer') {
        const { data: company } = await supabase.from('companies').select('telegram_chat_id').eq('user_id', user_id).maybeSingle();
        recipientChatId = company?.telegram_chat_id;
      } else {
        const { data: profile } = await supabase.from('profiles').select('telegram_chat_id').eq('user_id', user_id).maybeSingle();
        recipientChatId = profile?.telegram_chat_id;
      }
    }

    if (!recipientChatId) continue;

    // Build message content
    let messageContent = template.content;
    const variableMapping = rule.variable_mapping || {};
    
    for (const [varName, sourceField] of Object.entries(variableMapping)) {
      let value = '';
      const fieldName = String(sourceField);

      if (fieldName.startsWith('metadata.')) {
        const metaKey = fieldName.slice('metadata.'.length);
        value = metadata?.[metaKey] ?? '';
      } else if (fieldName === 'name') {
        value = name || metadata?.name || 'User';
      } else {
        value = metadata?.[fieldName] ?? '';
      }

      messageContent = messageContent.replace(new RegExp(`\{\{${varName}\}\}`, 'gi'), String(value));
    }

    // Replace any remaining variables with metadata
    if (metadata) {
      for (const [key, value] of Object.entries(metadata)) {
        messageContent = messageContent.replace(new RegExp(`\{\{${key}\}\}`, 'gi'), String(value));
      }
    }
    messageContent = sanitizePlaceholders(messageContent);
    if (isChannelChatId(recipientChatId)) {
      messageContent = sanitizeForChannel(messageContent);
      if (hasPlaceholderLeak(messageContent) || messageContent.length < 20) {
        console.warn(`[${requestId}] ❌ trigger blocked — placeholder leak / empty for channel ${recipientChatId}`);
        return { success: false, error: 'Placeholder leak / empty after channel sanitize' };
      }
    }

    // High priority for OTP/2FA
    const isHighPriority = ['telegram_2fa_otp', 'employer_telegram_2fa_otp', 'signup_otp'].includes(event_type);

    let success = false;
    let messageId: number | null = null;

    if (isHighPriority) {
      // Direct send for OTP
      const otpToken = await tokenForChat(supabase, recipientChatId, botToken);
      const telegramResponse = await fetch(`https://api.telegram.org/bot${otpToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: recipientChatId, text: messageContent, parse_mode: 'HTML' })
      });

      const telegramResult = await telegramResponse.json();
      success = telegramResult.ok === true;
      messageId = telegramResult.result?.message_id;
    } else {
      // Add to queue
      const { error: queueError } = await supabase.rpc('add_telegram_to_queue', {
        p_chat_id: recipientChatId,
        p_message: messageContent,
        p_priority: rule.delay_minutes > 0 ? 7 : 5,
        p_parse_mode: 'HTML',
        p_metadata: { event_type, user_id, user_type },
        p_trigger_rule_id: rule.id,
        p_trigger_log_id: null
      });

      success = !queueError;
    }

    results.push({
      rule_id: rule.id,
      rule_name: rule.name,
      success,
      message_id: messageId,
      chat_id: recipientChatId
    });
  }

  return { success: true, results };
}

// ============ CHANNEL MEMBERSHIP ============
/**
 * Owner Portal me save kiye hue Telegram channel me user joined hai ya nahi.
 * Body: { telegram_user_id }
 */
async function handleChannelMembership(supabase: any, token: string, body: any) {
  const telegramUserId = String(body?.telegram_user_id || '').trim();
  const channel = await getChannelUsername(supabase); // '@name' | null

  if (!channel) {
    return { success: true, channel: null, joined: false, status: 'not_configured' };
  }
  if (!telegramUserId) {
    return { success: true, channel, joined: false, status: 'unknown' };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getChatMember`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: channel, user_id: Number(telegramUserId) }),
    });
    const data = await res.json();
    if (!data?.ok) {
      return {
        success: true,
        channel,
        joined: false,
        status: 'unknown',
        error: data?.description || null,
      };
    }
    const memberStatus = String(data.result?.status || '');
    const joined = ['creator', 'administrator', 'member', 'restricted'].includes(memberStatus);
    return { success: true, channel, joined, status: memberStatus };
  } catch (e) {
    return {
      success: true,
      channel,
      joined: false,
      status: 'unknown',
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

// ============ WEBHOOK (from telegram-webhook) ============
type Audience = 'job_seeker' | 'employer';

/** Owner Portal me save kiya hua Telegram channel username (employers bot ke saath). */
async function getChannelUsername(supabase: any): Promise<string | null> {
  try {
    const { data } = await supabase
      .from('telegram_audience_bots')
      .select('channel_username')
      .eq('audience', 'employer')
      .maybeSingle();
    const username = (data?.channel_username || '').trim().replace(/^@/, '');
    return username ? `@${username}` : null;
  } catch (_e) {
    return null;
  }
}

async function getAudienceBotToken(supabase: any, audience: Audience): Promise<string | null> {
  try {
    const { data } = await supabase
      .from('telegram_audience_bots')
      .select('bot_token')
      .eq('audience', audience)
      .maybeSingle();
    const token = (data?.bot_token || '').trim();
    return token || null;
  } catch (_e) {
    return null;
  }
}

/**
 * Chat ke hisaab se sahi bot chunta hai:
 * employer (company ya channel) -> employers bot, warna job seekers bot.
 */
const chatAudienceCache = new Map<string, Audience>();

async function tokenForChat(
  supabase: any,
  chatId: number | string | null | undefined,
  fallbackToken: string,
): Promise<string> {
  const id = Number(chatId);
  if (!id || Number.isNaN(id)) return fallbackToken;

  let audience = chatAudienceCache.get(String(id));
  if (!audience) {
    // Channels/groups (negative id) hamesha employers bot se.
    if (id < 0) {
      audience = 'employer';
    } else {
      try {
        const { data: company } = await supabase
          .from('companies')
          .select('id')
          .eq('telegram_chat_id', id)
          .maybeSingle();
        audience = company ? 'employer' : 'job_seeker';
      } catch (_e) {
        audience = 'job_seeker';
      }
    }
    chatAudienceCache.set(String(id), audience);
  }

  const token = await getAudienceBotToken(supabase, audience);
  return token || fallbackToken;
}

/**
 * Jab caller audience bhejta hai (job_seeker / employer) to hamesha usi side ka
 * bot token use hota hai — chat id se guess nahi. Token na ho to null (skip).
 * Audience na mile to purana chat-based fallback.
 */
async function resolveSendToken(
  supabase: any,
  explicitAudience: Audience | null,
  chatId: number | string | null | undefined,
  fallbackToken: string,
): Promise<string | null> {
  if (explicitAudience) {
    return await getAudienceBotToken(supabase, explicitAudience);
  }
  return await tokenForChat(supabase, chatId, fallbackToken);
}

/** Rendered Owner Portal template (text + optional button + optional image). */
interface RenderedTemplate {
  text: string;
  button_text?: string | null;
  button_url?: string | null;
  image_url?: string | null;
  buttons?: TelegramTemplateButton[];
}

interface TelegramTemplateButton {
  id?: string;
  text: string;
  type: 'url' | 'copy_text' | 'web_app';
  value: string;
  row: number;
}

function telegramKeyboard(buttons: TelegramTemplateButton[] | undefined, legacyText?: string | null, legacyUrl?: string | null) {
  const valid = (buttons || []).filter((button) => button?.text?.trim() && button?.value?.trim()).slice(0, 100);
  if (!valid.length && legacyText?.trim() && legacyUrl) {
    return { inline_keyboard: [[{ text: legacyText.trim(), url: absoluteUrl(legacyUrl) }]] };
  }
  const rows = new Map<number, Record<string, unknown>[]>();
  valid.forEach((button) => {
    const row = Number.isInteger(button.row) && button.row >= 0 ? button.row : rows.size;
    const existing = rows.get(row) || [];
    if (existing.length >= 8) return;
    const text = button.text.trim().slice(0, 64);
    const value = button.value.trim();
    if (button.type === 'copy_text') existing.push({ text, copy_text: { text: value.slice(0, 256) } });
    else if (button.type === 'web_app' && /^https:\/\//i.test(value)) existing.push({ text, web_app: { url: value } });
    else {
      const url = absoluteUrl(value);
      if (url) existing.push({ text, url });
    }
    if (existing.length) rows.set(row, existing);
  });
  const inline_keyboard = [...rows.entries()].sort(([a], [b]) => a - b).map(([, row]) => row);
  return inline_keyboard.length ? { inline_keyboard } : undefined;
}

const MONTHS_SHORT = ['January','February','March','April','May','June','July','August','September','October','November','December'];
/** Current date/time in IST as DD Month YYYY and hh:mm:ss AM/PM. */
function istDateTime(): { date: string; time: string; datetime: string } {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const dd = String(ist.getUTCDate()).padStart(2, '0');
  const mon = MONTHS_SHORT[ist.getUTCMonth()];
  const yyyy = ist.getUTCFullYear();
  const rawH = ist.getUTCHours();
  const ampm = rawH >= 12 ? 'PM' : 'AM';
  const hh = String(rawH % 12 || 12).padStart(2, '0');
  const min = String(ist.getUTCMinutes()).padStart(2, '0');
  const sec = String(ist.getUTCSeconds()).padStart(2, '0');
  const date = `${dd} ${mon} ${yyyy}`;
  const time = `${hh}:${min}:${sec} ${ampm}`;
  return { date, time, datetime: `${date} ${time}` };
}

/** Telegram inline buttons need an absolute URL. */
function absoluteUrl(url?: string | null): string | null {
  const value = String(url || '').trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `${WEBSITE_DOMAIN}${value.startsWith('/') ? value : `/${value}`}`;
}

/** Owner Portal ka koi bhi Telegram template render karta hai. */
async function renderTemplate(
  supabase: any,
  eventType: string,
  vars: Record<string, string> = {},
): Promise<RenderedTemplate | null> {
  try {
    const { data } = await supabase
      .from('telegram_lifecycle_templates')
      .select('title, body, button_text, button_url, image_url, buttons, enabled')
      .eq('event_type', eventType)
      .maybeSingle();

    if (data && data.enabled !== false && (data.title || data.body)) {
      const stamp = istDateTime();
      const all: Record<string, string> = { ...stamp, ...vars };
      // Contact rows need dial-ready digits. WhatsApp falls
      // back to the mobile number when no separate WhatsApp number is stored.
      if (!all.whatsapp && all.mobile) all.whatsapp = all.mobile;
      const onlyDigits = (input?: string) => String(input || '').replace(/\D/g, '');
      if (!all.mobile_digits && all.mobile) all.mobile_digits = onlyDigits(all.mobile);
      if (!all.whatsapp_digits && all.whatsapp) all.whatsapp_digits = onlyDigits(all.whatsapp);
      const replace = (input: string | null | undefined, escapeValues = false): string => {
        if (!input) return '';
        return String(input).replace(
          /\{\{\s*([a-z_]+)\s*\}\}/gi,
          (_m, k) => {
            const value = all[String(k).toLowerCase()];
            return value === undefined ? '{{' + String(k).toLowerCase() + '}}' : (escapeValues ? escapeTemplateHtml(String(value)) : String(value));
          },
        );
      };

      // Drop any line that still carries an unresolved {{placeholder}} — but if
      // that would empty the owner's saved text, keep it and strip only the
      // placeholders, so the saved template is what actually goes out.
      const clean = (input: string): string => {
        if (!/\{\{\s*[\w.]+\s*\}\}/.test(input)) return input.trim();
        // Saved bodies separate rows with <br/>, so treat those as line breaks
        // too — otherwise one unfilled row would blank the whole message.
        const kept = input
          .split(/\n|<br\s*\/?>/i)
          .filter((line) => !/\{\{\s*[\w.]+\s*\}\}/.test(line))
          .join('\n')
          .trim();
        return kept || input.replace(/\{\{\s*[\w.]+\s*\}\}/g, '').replace(/[ \t]{2,}/g, ' ').trim();
      };


      const title = clean(replace(data.title));
      const bodyTemplate = data.body || '';
      const body = clean(replace(bodyTemplate, templateHasHtml(bodyTemplate)));
      const text = [title ? `<b>${escapeTemplateHtml(title)}</b>` : '', renderTelegramTemplateHtml(body)].filter(Boolean).join('\n\n');
      if (!text) return null;

      // Buttons are owner-authored too, so they get the same {{variable}} fill as
      // the title and body. A button still carrying an unresolved placeholder is
      // dropped instead of shipping with a literal "{{otp}}" inside it.
      const label = clean(replace(data.button_text)).trim();
      const buttonUrl = label ? absoluteUrl(clean(replace(data.button_url))) : null;
      const renderedButtons = (Array.isArray(data.buttons) ? data.buttons : [])
        .map((button: any) => {
          const buttonText = clean(replace(button?.text));
          if (!buttonText) return null;
          const buttonType = String(button?.type || 'url').toLowerCase();
          const buttonValue = clean(replace(button?.value));
          return {
            ...button,
            text: buttonText,
            value: buttonType === 'copy_text'
              ? buttonValue
              : buttonValue ? absoluteUrl(buttonValue) : '',
          };
        })
        .filter(Boolean);
      return {
        text,
        button_text: label || null,
        button_url: buttonUrl,
        image_url: (data.image_url || '').trim() || null,
        buttons: renderedButtons,
      };
    }
  } catch (_e) {
    // ignore
  }
  return null;
}

async function getStartMessage(
  supabase: any,
  audience: Audience,
  name: string,
): Promise<RenderedTemplate> {
  const eventType = audience === 'employer' ? 'bot_start_employer' : 'bot_start_job_seeker';
  const fallbackCode = audience === 'employer' ? 'E-XYZ789' : 'P-ABC123';
  const fallbackWhere = audience === 'employer'
    ? 'Employer Settings → Telegram Integration'
    : 'Settings → Telegram Integration';

  const rendered = await renderTemplate(supabase, eventType, { name: name || 'there' });
  if (rendered) return rendered;

  const displayName = escapeTemplateHtml(name || 'there');
  return {
    text: `😊 <b>Welcome ${displayName}!</b>

📋 Send your <b>Connect Code</b> here to link your account.

💡 <b>Where to find the code:</b>
${fallbackWhere}

The code looks like this: <code>${fallbackCode}</code>

📱 Just paste the code and send it.`,
  };
}

async function sendInvalidCodeMessage(
  supabase: any,
  botToken: string,
  chatId: number,
  audience: Audience,
  code: string,
) {
  const eventType = audience === 'employer' ? 'bot_invalid_code_employer' : 'bot_invalid_code_job_seeker';
  const rendered = await renderTemplate(supabase, eventType, { code });
  const prefix = audience === 'employer' ? 'E-' : 'P-';
  const stamp = istDateTime();
  const fallback: RenderedTemplate = {
    text: `❌ <b>Invalid Connect Code</b>\n\n<code>${code}</code> does not work on this bot.\n\nA ${
      audience === 'employer' ? 'employer' : 'job seeker'
    } account code starts with <code>${prefix}</code>.\n\nDate : ${stamp.date}\nTime : ${stamp.time}`,
  };
  await sendTelegramMessage(botToken, chatId, rendered || fallback);
}



async function handleWebhook(supabase: any, botToken: string, body: any, requestId: string, supabaseUrl: string, audience: Audience = 'job_seeker') {
  const update = body;

  if (!update.message) {
    return { ok: true };
  }

  const message = update.message;
  const chat = message.chat;
  const from = message.from;
  const text = message.text || '';
  const telegramId = from.id;
  const chatId = chat.id;

  console.log(`[${requestId}] 📩 Message from ${telegramId}: ${text.substring(0, 50)}`);

  // Telegram display name = first name + last name (last name optional)
  const telegramDisplayName = [from.first_name, from.last_name]
    .filter((part) => typeof part === 'string' && part.trim().length > 0)
    .map((part) => part.trim())
    .join(' ');

  // Handle /start command
  if (text.toLowerCase().startsWith('/start') || text.toLowerCase() === 'start') {
    // Already-linked accounts get the "already connected" template instead of the connect-code guide.
    const linkedTable = audience === 'employer' ? 'companies' : 'profiles';
    const linkedNameField = audience === 'employer' ? 'company_name' : 'full_name';
    // telegram_id ya telegram_chat_id dono me se koi bhi match ho to connected maano.
    const { data: linkedRows, error: linkedError } = await supabase
      .from(linkedTable)
      .select(linkedNameField)
      .or(`telegram_id.eq.${telegramId},telegram_chat_id.eq.${chatId}`)
      .limit(1);
    const linkedAccount = linkedRows?.[0] || null;
    console.log(`[${requestId}] /start link check: table=${linkedTable} linked=${!!linkedAccount} error=${linkedError?.message || 'none'}`);

    if (linkedAccount) {
      const linkedName = linkedAccount[linkedNameField] || telegramDisplayName || 'there';
      const alreadyEvent = audience === 'employer'
        ? 'bot_already_connected_employer'
        : 'bot_already_connected_job_seeker';
      const alreadyRendered = await renderTemplate(supabase, alreadyEvent, { name: linkedName });
      await sendTelegramMessage(
        botToken,
        chatId,
        alreadyRendered || {
          text: `✅ <b>Already Connected!</b>\n\nHi ${escapeTemplateHtml(linkedName)}, your Telegram is already linked to your Workly India account.`,
        },
      );
      return { ok: true };
    }

    const welcomeMessage = await getStartMessage(supabase, audience, telegramDisplayName);

    await sendTelegramMessage(botToken, chatId, welcomeMessage);
    return { ok: true };
  }


  // Check for connect code
  const connectCodePattern = /^[PE]-[A-Z0-9]{6}$/i;
  const looksLikeCode = /^[PE]\s*-\s*[A-Z0-9]{2,12}$/i;
  const trimmedText = text.trim().toUpperCase().replace(/\s+/g, '');

  // Anything that looks like a connect code but is malformed -> error template.
  if (!connectCodePattern.test(trimmedText) && looksLikeCode.test(trimmedText)) {
    await sendInvalidCodeMessage(supabase, botToken, chatId, audience, trimmedText);
    return { ok: true };
  }

  if (connectCodePattern.test(trimmedText)) {
    const isProfileCode = trimmedText.startsWith('P-');
    const expectedProfileCode = audience !== 'employer';

    // Job seeker bot accepts only P- codes, employer bot only E- codes.
    if (isProfileCode !== expectedProfileCode) {
      await sendInvalidCodeMessage(supabase, botToken, chatId, audience, trimmedText);
      return { ok: true };
    }


    // "Verifying..." is a temporary status — removed as soon as we have a result.
    const verifyingMessageId = await sendTelegramMessage(
      botToken,
      chatId,
      '⏳ <b>Verifying your code...</b>',
    );
    const clearVerifying = async () => {
      if (verifyingMessageId) await deleteTelegramMessage(botToken, chatId, verifyingMessageId);
    };

    const table = isProfileCode ? 'profiles' : 'companies';
    const idField = isProfileCode ? 'user_id' : 'id';
    const nameField = isProfileCode ? 'full_name' : 'company_name';

    const { data: accountData } = await supabase
      .from(table)
      .select(`${idField}, ${nameField}, telegram_id`)
      .eq('telegram_connect_code', trimmedText)
      .maybeSingle();

    if (accountData) {
      const accountName = accountData[nameField] || telegramDisplayName || 'there';

      if (accountData.telegram_id && accountData.telegram_id === telegramId) {
        await clearVerifying();
        const alreadyEvent = audience === 'employer'
          ? 'bot_already_connected_employer'
          : 'bot_already_connected_job_seeker';
        const rendered = await renderTemplate(supabase, alreadyEvent, { name: accountName });
        await sendTelegramMessage(
          botToken,
          chatId,
          rendered || { text: '✅ <b>Already Connected!</b>\n\nYour Telegram is already linked.' },
        );
        return { ok: true };
      }

      if (accountData.telegram_id && accountData.telegram_id !== telegramId) {
        await clearVerifying();
        const usedEvent = audience === 'employer' ? 'bot_code_used_employer' : 'bot_code_used_job_seeker';
        const rendered = await renderTemplate(supabase, usedEvent, { name: accountName });
        await sendTelegramMessage(
          botToken,
          chatId,
          rendered || {
            text: '⚠️ <b>Code Already Used</b>\n\nThis account is already connected to a different Telegram.',
          },
        );
        return { ok: true };
      }


      await supabase
        .from(table)
        .update({
          telegram_id: telegramId,
          telegram_username: from.username || null,
          telegram_chat_id: chatId,
          telegram_connected_at: new Date().toISOString(),
          telegram_notifications_enabled: true
        })
        .eq(idField, accountData[idField]);

      const name = accountName;
      const connectMessage = await renderTemplate(supabase, 'subscribe', { name });


      await clearVerifying();
      await sendTelegramMessage(
        botToken,
        chatId,
        connectMessage || {
          text: `✅ <b>Success! Account Connected!</b>\n\n🎉 Hello <b>${name}</b>!\n\nYour Telegram is now linked to your <b>${
            isProfileCode ? 'Job Seeker' : 'Employer'
          }</b> account.\n\n🔔 You will now receive notifications here.`,
        },
      );
    } else {
      await clearVerifying();
      await sendInvalidCodeMessage(supabase, botToken, chatId, audience, trimmedText);
    }



    return { ok: true };
  }

  // Store other messages in conversation
  let { data: conversation } = await supabase
    .from('telegram_conversations')
    .select('*')
    .eq('chat_id', chatId)
    .single();

  if (!conversation) {
    const { data: newConv } = await supabase
      .from('telegram_conversations')
      .insert({
        chat_id: chatId,
        username: from.username || null,
        first_name: from.first_name || null,
        last_name: from.last_name || null,
        chat_type: chat.type || 'private',
        last_message_at: new Date().toISOString(),
        last_message_preview: text.substring(0, 100),
        unread_count: 1
      })
      .select()
      .single();
    conversation = newConv;
  } else {
    await supabase
      .from('telegram_conversations')
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: text.substring(0, 100),
        unread_count: (conversation.unread_count || 0) + 1
      })
      .eq('id', conversation.id);
  }

  // Store message
  await supabase.from('telegram_messages').insert({
    conversation_id: conversation?.id,
    telegram_message_id: message.message_id,
    chat_id: chatId,
    direction: 'incoming',
    message_content: text,
    message_type: 'text',
    status: 'received',
    sent_at: new Date(message.date * 1000).toISOString()
  });

  return { ok: true };
}

// ============ SETUP (from telegram-setup-webhook merged into webhook) ============
async function handleSetup(supabase: any, botToken: string, body: any, supabaseUrl: string) {
  const { setup_action } = body;
  
  if (setup_action === 'getMe') {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const result = await response.json();
    return result.ok ? { success: true, bot: result.result } : { success: false, error: result.description };
  }

  if (setup_action === 'setWebhook') {
    const webhookUrl = `${supabaseUrl}/functions/v1/email-api/telegram`;
    const response = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl, allowed_updates: ['message', 'edited_message', 'callback_query'] })
    });
    const result = await response.json();
    
    if (result.ok) {
      const { data: existing } = await supabase.from('telegram_bot_settings').select('id').single();
      if (existing) {
        await supabase.from('telegram_bot_settings').update({ webhook_url: webhookUrl, is_active: true }).eq('id', existing.id);
      } else {
        await supabase.from('telegram_bot_settings').insert({ webhook_url: webhookUrl, is_active: true });
      }
    }
    
    return result.ok ? { success: true, webhook_url: webhookUrl } : { success: false, error: result.description };
  }

  if (setup_action === 'deleteWebhook') {
    await fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook`);
    await supabase.from('telegram_bot_settings').update({ is_active: false, webhook_url: null }).neq('id', '00000000-0000-0000-0000-000000000000');
    return { success: true };
  }

  if (setup_action === 'getWebhookInfo') {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
    const result = await response.json();
    return { success: true, info: result.result };
  }

  return { success: false, error: 'Invalid setup_action' };
}

// ============ DIRECT SEND ============
async function handleDirectSend(botToken: string, body: any, supabase: any) {
  const { chat_id, text, reply_to_message_id, parse_mode, photo_url, button_text, button_url, copy_text, buttons } = body;

  if (!chat_id || !text) {
    return { success: false, error: 'chat_id and text are required' };
  }

  const reply_markup = Array.isArray(buttons) && buttons.length
    ? telegramKeyboard(buttons)
    : copy_text
    ? { inline_keyboard: [[{ text: String(button_text || 'Copy code'), copy_text: { text: String(copy_text) } }]] }
    : button_text && button_url
      ? { inline_keyboard: [[{ text: String(button_text), url: String(button_url) }]] }
      : undefined;
  const safeText = renderTelegramTemplateHtml(String(text));
  const formatted = telegramMessagePayload(safeText);
  const useEntities = !parse_mode || String(parse_mode).toUpperCase() === 'HTML';

  const method = photo_url ? 'sendPhoto' : 'sendMessage';
  const payload: Record<string, unknown> = photo_url
    ? useEntities
      ? { chat_id, photo: photo_url, caption: formatted.text, caption_entities: formatted.entities, reply_markup }
      : { chat_id, photo: photo_url, caption: safeText, parse_mode, reply_markup }
    : useEntities
      ? { chat_id, text: formatted.text, entities: formatted.entities, reply_to_message_id, reply_markup, link_preview_options: { is_disabled: true } }
      : { chat_id, text: safeText, reply_to_message_id, parse_mode, reply_markup, link_preview_options: { is_disabled: true } };

  // Caller ne already sahi audience ka bot token resolve kiya hai.
  const sendToken = botToken || (await tokenForChat(supabase, chat_id, botToken));
  const telegramResponse = await fetch(`https://api.telegram.org/bot${sendToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const result = await telegramResponse.json();

  if (!result.ok) {
    return { success: false, error: result.description };
  }

  return { success: true, message_id: result.result.message_id };
}


// ============ HELPER FUNCTIONS ============

/**
 * Sends plain text or a full template (text + image + inline button).
 * Returns the Telegram message_id so temporary messages can be deleted later.
 */
async function sendTelegramMessage(
  botToken: string,
  chatId: number,
  message: string | RenderedTemplate,
): Promise<number | null> {
  const tpl: RenderedTemplate = typeof message === 'string' ? { text: message } : message;
  const reply_markup = telegramKeyboard(tpl.buttons, tpl.button_text, tpl.button_url);
  const photo = (tpl.image_url || '').trim();
  const safeText = renderTelegramTemplateHtml(tpl.text);
  const formatted = telegramMessagePayload(safeText);

  const send = async (method: string, payload: Record<string, unknown>) => {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await response.json();
  };

  try {
    if (photo) {
      const result = await send('sendPhoto', {
        chat_id: chatId,
        photo,
        caption: formatted.text,
        caption_entities: formatted.entities,
        reply_markup,
      });
      if (result?.ok) return result.result?.message_id ?? null;
      console.error('sendPhoto failed, falling back to text:', result?.description);
    }

    const result = await send('sendMessage', {
      chat_id: chatId,
      text: formatted.text,
      entities: formatted.entities,
      reply_markup,
      link_preview_options: { is_disabled: true },
    });
    if (!result?.ok) {
      console.error('sendMessage failed:', result?.description);
      return null;
    }
    return result.result?.message_id ?? null;
  } catch (error) {
    console.error('Error sending message:', error);
    return null;
  }
}

/** Removes a message (used for the temporary "Verifying your code..." status). */
async function deleteTelegramMessage(botToken: string, chatId: number, messageId: number): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/deleteMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
    });
  } catch (error) {
    console.error('Error deleting message:', error);
  }
}


function formatNumber(num: number): string {
  if (num >= 100000) return (num / 100000).toFixed(1).replace(/\.0$/, '') + 'L';
  if (num >= 1000) return (num / 1000).toFixed(0) + 'K';
  return num.toString();
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ============ HOURLY CHANNEL BROADCAST ============
// - IST 9:00–17:00 gate (bahar hone par skip)
// - Priority 1: website `jobs` jo abhi tak channel me nahi gayi
// - Fallback: Adzuna / Jooble / Careerjet se ek fresh job, worklyindia.devs.surf par
//   short-link details page ke through (external apply URL kabhi channel me nahi jayegi)
// - Har external job (source, ext_id) `telegram_channel_external_log` me dedup hoti hai
async function handleHourlyBroadcast(
  supabase: any,
  botToken: string,
  body: any,
  requestId: string,
  supabaseUrl: string,
  serviceKey: string
) {
  const force = body?.force === true;

  // IST hour check (UTC + 5:30)
  const now = new Date();
  const istMs = now.getTime() + (5 * 60 + 30) * 60 * 1000;
  const istHour = new Date(istMs).getUTCHours();
  if (!force && (istHour < 9 || istHour >= 17)) {
    console.log(`[${requestId}] ⏸ Outside IST 9-17 (hour=${istHour}), skipping`);
    return { success: true, skipped: true, reason: 'outside-ist-window', ist_hour: istHour };
  }

  // Channel settings
  const { data: settings } = await supabase
    .from('telegram_bot_settings')
    .select('channel_chat_id, channel_enabled, job_channel_template')
    .limit(1)
    .maybeSingle();

  const channelTarget = (await getChannelUsername(supabase)) || settings?.channel_chat_id;
  if (!channelTarget) {
    return { success: false, error: 'Channel not configured or disabled' };
  }

  // ============ Step 1: Website job first ============
  const { data: websiteJob } = await supabase
    .from('jobs')
    .select('id, title, company_name, location, job_type, salary_min, salary_max, public_slug, short_id, description, telegram_channel_message_id, status, visibility')
    .eq('status', 'active')
    .eq('visibility', 'public')
    .is('telegram_channel_message_id', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (websiteJob) {
    console.log(`[${requestId}] 🌐 Website job available: ${websiteJob.id}`);
    const res = await handleChannelPost(supabase, botToken, {
      job_id: websiteJob.id,
      title: websiteJob.title,
      company_name: websiteJob.company_name,
      location: websiteJob.location,
      job_type: websiteJob.job_type,
      salary_min: websiteJob.salary_min,
      salary_max: websiteJob.salary_max,
      public_slug: websiteJob.public_slug,
    }, requestId);
    return { ...res, source: 'website' };
  }

  // ============ Step 2: External fallback ============
  console.log(`[${requestId}] 🔁 No website job — trying external sources`);
  const sources = ['adzuna', 'jooble', 'careerjet'];
  const baseUrl = WEBSITE_DOMAIN;

  for (const src of sources) {
    try {
      const resp = await fetch(`${supabaseUrl}/functions/v1/get-job-feed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': serviceKey,
        },
        body: JSON.stringify({ action: src, query: '', location: 'India', page: 1, limit: 20 }),
      });

      if (!resp.ok) {
        console.warn(`[${requestId}] ${src} fetch failed: ${resp.status}`);
        continue;
      }
      const data = await resp.json();
      const jobs: any[] = Array.isArray(data?.jobs) ? data.jobs : [];
      if (jobs.length === 0) continue;

      // Get already-posted ext_ids for this source
      const extIds = jobs.map(j => j.external_id || `${src}_${j.id}`);
      const { data: already } = await supabase
        .from('telegram_channel_external_log')
        .select('ext_id')
        .eq('source', src)
        .in('ext_id', extIds);
      const seen = new Set((already || []).map((r: any) => r.ext_id));

      const fresh = jobs.find(j => !seen.has(j.external_id || `${src}_${j.id}`));
      if (!fresh) {
        console.log(`[${requestId}] ${src}: all ${jobs.length} already posted`);
        continue;
      }

      const extId = fresh.external_id || `${src}_${fresh.id}`;

      // Create short link (details page on worklyindia.devs.surf — NEVER external apply URL)
      let shortId: string | undefined;
      try {
        const slResp = await fetch(`${supabaseUrl}/functions/v1/external-job-shorten`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
            'apikey': serviceKey,
          },
          body: JSON.stringify({ source: src, ext_id: extId, payload: fresh }),
        });
        if (slResp.ok) {
          const sl = await slResp.json();
          shortId = sl.short_id;
        }
      } catch (e) {
        console.error(`[${requestId}] short-link failed`, e);
      }

      const detailsUrl = shortId
        ? `${baseUrl}/ej/s/${shortId}`
        : `${baseUrl}/jobs?src=${src}&ext=${encodeURIComponent(extId)}`;

      // Salary
      let salaryText = 'Not Disclosed';
      if (fresh.salary && typeof fresh.salary === 'string' && fresh.salary.trim()) {
        salaryText = fresh.salary.trim();
      }

      const sourceLabel = String(fresh.source || src).replace(/^\w/, c => c.toUpperCase());

      // Use the job's actual posting date (fresh.updated) — fallback to now if missing.
      // fresh.updated is an ISO/parsable string coming from the external provider.
      const postedAt = fresh.updated ? new Date(fresh.updated) : new Date();
      const postedIST = isNaN(postedAt.getTime())
        ? new Date(Date.now() + 5.5 * 60 * 60 * 1000)
        : new Date(postedAt.getTime() + 5.5 * 60 * 60 * 1000);
      const dd = String(postedIST.getUTCDate()).padStart(2, '0');
      const mm = MONTHS_SHORT[postedIST.getUTCMonth()];
      const yyyy = postedIST.getUTCFullYear();
      let hh = postedIST.getUTCHours();
      const min = String(postedIST.getUTCMinutes()).padStart(2, '0');
      const ampm = hh >= 12 ? 'PM' : 'AM';
      hh = hh % 12 || 12;
      const postDate = `${dd} ${mm} ${yyyy}`;
      const postTime = `${String(hh).padStart(2, '0')}:${min} ${ampm} IST`;

      const categoryText = (fresh.category && String(fresh.category).trim()) || '';

      const message = `📌 <b>${escapeHtml(fresh.title || 'Job Opening')}</b>
🏢 ${escapeHtml(fresh.company || 'Company')}
📍 ${escapeHtml(fresh.location || 'India')}
💼 ${escapeHtml(fresh.type || fresh.employment || 'Full Time')}
💰 ${escapeHtml(salaryText)}${categoryText ? `\n🏷️ <b>Category:</b> ${escapeHtml(categoryText)}` : ''}

🗓️ <b>Post Date:</b> ${postDate}
⏰ <b>Post Time:</b> ${postTime}

✅ <i>Curated by Workly India</i>
🔗 <a href="${detailsUrl}">View Details &amp; Apply</a>

<i>via ${escapeHtml(sourceLabel)} • Workly India</i>
#WorklyIndia #WorklyIndia #Jobs #Hiring`;

      const tgResp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: channelTarget,
          text: message,
          parse_mode: 'HTML',
          disable_web_page_preview: false,
        }),
      });
      const tgResult = await tgResp.json();

      if (!tgResult.ok) {
        console.error(`[${requestId}] Telegram error:`, tgResult.description);
        continue;
      }

      const messageId = tgResult.result?.message_id;
      await supabase.from('telegram_channel_external_log').insert({
        source: src,
        ext_id: extId,
        title: fresh.title || null,
        company: fresh.company || null,
        channel_message_id: messageId || null,
      });

      console.log(`[${requestId}] ✅ Posted external ${src} job to channel`);
      return {
        success: true,
        source: src,
        message_id: messageId,
        ext_id: extId,
        details_url: detailsUrl,
      };
    } catch (err: any) {
      console.error(`[${requestId}] ${src} error:`, err?.message || err);
    }
  }

  return { success: true, skipped: true, reason: 'no-jobs-available' };
}


// ============ LOGIN VERIFY (Telegram Login Widget) ============
// The widget hands the browser a signed payload. We re-check that signature with
// the side's own bot token before saving the chat id, so nobody can claim
// somebody else's Telegram account.
async function verifyTelegramLoginHash(botToken: string, user: Record<string, unknown>): Promise<boolean> {
  const { hash, ...rest } = user as Record<string, any>;
  if (!hash) return false;
  const checkString = Object.keys(rest)
    .filter((k) => rest[k] !== undefined && rest[k] !== null)
    .sort()
    .map((k) => `${k}=${rest[k]}`)
    .join('\n');
  const enc = new TextEncoder();
  const secret = await crypto.subtle.digest('SHA-256', enc.encode(botToken));
  const key = await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(checkString));
  const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return hex === String(hash).toLowerCase();
}

async function handleLoginVerify(supabase: any, fallbackToken: string, body: any) {
  const tgUser = body?.telegramUser || body?.telegram_user;
  const userType = body?.userType === 'company' ? 'company' : 'profile';
  const userId = typeof body?.userId === 'string' ? body.userId : '';
  const companyId = typeof body?.companyId === 'string' ? body.companyId : '';

  if (!tgUser?.id) return { success: false, error: 'telegramUser is required' };
  if (userType === 'profile' && !userId) return { success: false, error: 'userId is required' };
  if (userType === 'company' && !companyId) return { success: false, error: 'companyId is required' };

  // Each side runs its own bot, so verify against that side's token first.
  const sideToken =
    (await getAudienceBotToken(supabase, userType === 'company' ? 'employer' : 'job_seeker')) || fallbackToken;
  if (!sideToken) {
    return { success: false, error: 'No bot token configured for this side' };
  }

  const authDate = Number(tgUser.auth_date || 0);
  if (authDate && Date.now() / 1000 - authDate > 86400) {
    return { success: false, error: 'Login link expired, please try again' };
  }

  const valid = await verifyTelegramLoginHash(sideToken, tgUser);
  if (!valid) return { success: false, error: 'Telegram signature check failed' };

  const patch: Record<string, unknown> = {
    telegram_id: Number(tgUser.id),
    telegram_username: tgUser.username ?? null,
    telegram_chat_id: Number(tgUser.id),
    telegram_notifications_enabled: true,
  };

  const { error } = userType === 'company'
    ? await supabase.from('companies').update(patch).eq('id', companyId)
    : await supabase.from('profiles').update(patch).eq('user_id', userId);

  if (error) return { success: false, error: error.message };

  return { success: true, telegram_id: Number(tgUser.id), telegram_username: tgUser.username ?? null };
}
