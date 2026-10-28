import { WEBSITE_DOMAIN } from './domain.ts';
/**
 * Shared helper: Enforce AI Chat plan limits across reply channels
 * (Telegram, WhatsApp, Email). All three consume the SAME pool that
 * powers the in-app AI Chat page, so users never get "free" AI
 * responses by routing through messaging.
 *
 * Usage:
 *   const check = await checkAiChatLimit(supabase, userId);
 *   if (!check.allowed) { send(check.upgradeMessage); return; }
 *   // ... generate + send AI reply ...
 *   await incrementAiChatUsage(supabase, userId);
 */

export interface LimitCheckResult {
  allowed: boolean;
  plan?: string;
  limit?: number;
  used?: number;
  remaining?: number;
  /** Hinglish message to send back when limit is reached. */
  upgradeMessage: string;
  /** Plain-text upgrade reason for logs. */
  reason?: string;
}

const UPGRADE_URL = `${WEBSITE_DOMAIN}/ai-assistant/pricing`;

/**
 * Build the "limit khatm" message tailored to the channel's formatting.
 * channel: 'telegram' (HTML), 'whatsapp' (asterisk-bold), 'email-text', 'email-html'
 */
function buildUpgradeMessage(
  channel: 'telegram' | 'whatsapp' | 'email-text' | 'email-html',
  info: { plan?: string; used?: number; limit?: number }
): string {
  const planLine = info.plan
    ? `Aapka current plan: ${info.plan} (${info.used ?? 0}/${info.limit ?? 0} messages used this month).`
    : 'Aapki AI message limit poori ho chuki hai.';

  const intro = `🙏 Namaste! ${planLine}`;
  const body = `Is mahine ke liye AI replies khatm ho gaye hain. Naya plan lene ke baad turant AI fir se aapke saath baat karega.`;
  const cta = `Plan dekhne / upgrade karne ke liye:`;

  switch (channel) {
    case 'telegram':
      return `${intro}\n\n${body}\n\n${cta}\n<a href="${UPGRADE_URL}">${UPGRADE_URL}</a>\n\n— Workly India 💼`;
    case 'whatsapp':
      return `${intro}\n\n${body}\n\n${cta}\n${UPGRADE_URL}\n\n— *Workly India* 💼`;
    case 'email-text':
      return `${intro}\n\n${body}\n\n${cta}\n${UPGRADE_URL}\n\n— Workly India`;
    case 'email-html':
      return `
        <div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#222;">
          <p>${intro}</p>
          <p>${body}</p>
          <p>${cta}<br/>
            <a href="${UPGRADE_URL}" style="color:#2563eb;">${UPGRADE_URL}</a>
          </p>
          <p style="color:#666;font-size:13px;">— Workly India 💼</p>
        </div>`;
  }
}

/**
 * Calls the SQL function `check_ai_chat_usage_only` for usage_type='message'.
 * If the user has no plan / limit reached, returns allowed=false with a ready
 * upgradeMessage formatted for the requested channel.
 *
 * If userId is null/empty (unlinked user), allows the reply but doesn't
 * count it (caller decides whether to enforce).
 */
export async function checkAiChatLimit(
  supabase: any,
  userId: string | null | undefined,
  channel: 'telegram' | 'whatsapp' | 'email-text' | 'email-html'
): Promise<LimitCheckResult> {
  if (!userId) {
    return {
      allowed: true,
      upgradeMessage: buildUpgradeMessage(channel, {}),
      reason: 'unlinked_user',
    };
  }

  try {
    const { data, error } = await supabase.rpc('check_ai_chat_usage_only', {
      p_user_id: userId,
      p_usage_type: 'message',
    });

    if (error) {
      console.error('⚠️ check_ai_chat_usage_only error:', error.message);
      // Fail-open so a DB hiccup doesn't break replies
      return {
        allowed: true,
        upgradeMessage: buildUpgradeMessage(channel, {}),
        reason: 'rpc_error_fail_open',
      };
    }

    const allowed = data?.allowed === true;
    return {
      allowed,
      plan: data?.plan,
      limit: data?.limit,
      used: data?.used,
      remaining: data?.remaining,
      upgradeMessage: buildUpgradeMessage(channel, {
        plan: data?.plan,
        used: data?.used,
        limit: data?.limit,
      }),
      reason: allowed ? 'within_limit' : (data?.error || 'limit_reached'),
    };
  } catch (e: any) {
    console.error('⚠️ checkAiChatLimit threw:', e?.message);
    return {
      allowed: true,
      upgradeMessage: buildUpgradeMessage(channel, {}),
      reason: 'exception_fail_open',
    };
  }
}

/**
 * Increment the user's AI chat message count.
 * Safe to call after a successful reply — fails silently on errors.
 */
export async function incrementAiChatUsage(
  supabase: any,
  userId: string | null | undefined,
  approxTokens = 0
): Promise<void> {
  if (!userId) return;
  try {
    await supabase.rpc('increment_ai_chat_usage', {
      p_user_id: userId,
      p_usage_type: 'message',
      p_tokens: approxTokens,
    });
  } catch (e: any) {
    console.error('⚠️ increment_ai_chat_usage failed:', e?.message);
  }
}

/**
 * Atomically reserve one message before generating an automated reply.
 * The database serializes reservations per user, so concurrent channels
 * cannot exceed the shared monthly plan limit.
 */
export async function reserveAiChatMessage(
  supabase: any,
  userId: string | null | undefined,
  channel: 'telegram' | 'whatsapp' | 'email-text' | 'email-html',
): Promise<LimitCheckResult> {
  if (!userId) {
    return {
      allowed: false,
      upgradeMessage: buildUpgradeMessage(channel, {}),
      reason: 'unlinked_user',
    };
  }

  try {
    const { data, error } = await supabase.rpc('increment_ai_chat_usage', {
      p_user_id: userId,
      p_usage_type: 'message',
      p_tokens: 0,
    });
    if (error) {
      console.error('reserve AI message failed:', error.message);
      return {
        allowed: false,
        upgradeMessage: buildUpgradeMessage(channel, {}),
        reason: 'usage_unavailable',
      };
    }

    const allowed = data?.allowed === true;
    const used = Number(data?.current ?? 0);
    const limit = Number(data?.limit ?? 0);
    return {
      allowed,
      plan: data?.plan,
      limit,
      used,
      remaining: Number(data?.remaining ?? 0),
      upgradeMessage: buildUpgradeMessage(channel, { plan: data?.plan, used, limit }),
      reason: allowed ? 'reserved' : (data?.error || 'limit_reached'),
    };
  } catch (e: any) {
    console.error('reserveAiChatMessage threw:', e?.message);
    return {
      allowed: false,
      upgradeMessage: buildUpgradeMessage(channel, {}),
      reason: 'usage_unavailable',
    };
  }
}
