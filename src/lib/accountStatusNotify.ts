// =============================================================================
// Account ban / restore notifications
// -----------------------------------------------------------------------------
// When an admin bans, restores, or restricts an account from Auth Users,
// Website Users or the Employers page, the affected job seeker / employer is
// notified on every channel (Push + Email + Telegram) using the owner-editable
// templates in Owner Portal → Push / Email / Telegram Templates.
// Never throws — a delivery failure must not break the admin action.
// =============================================================================

import { supabase } from '@/integrations/supabase/client';

export type AccountStatusEvent =
  | 'account_banned_job_seeker'
  | 'account_unbanned_job_seeker'
  | 'account_banned_employer'
  | 'account_unbanned_employer'
  | 'job_apply_banned'
  | 'job_apply_unbanned'
  | 'job_posting_banned'
  | 'job_posting_unbanned';

const FALLBACK: Record<AccountStatusEvent, { title: string; message: string }> = {
  account_banned_job_seeker: {
    title: 'Your account has been suspended',
    message: 'Your Workly India account has been suspended by our team. Contact support if you think this is a mistake.',
  },
  account_unbanned_job_seeker: {
    title: 'Your account is active again',
    message: 'The suspension on your Workly India account has been removed. You can sign in and apply to jobs again.',
  },
  account_banned_employer: {
    title: 'Your employer account has been suspended',
    message: 'Your Workly India employer account has been suspended by our team. Contact support if you think this is a mistake.',
  },
  account_unbanned_employer: {
    title: 'Your employer account is active again',
    message: 'The suspension on your Workly India employer account has been removed. You can post jobs and manage applications again.',
  },
  job_apply_banned: {
    title: 'Job applications paused on your account',
    message: 'You can no longer apply to jobs on Workly India. Contact support if you think this is a mistake.',
  },
  job_apply_unbanned: {
    title: 'You can apply to jobs again',
    message: 'The job application restriction on your Workly India account has been removed.',
  },
  job_posting_banned: {
    title: 'Job posting paused for your company',
    message: 'Your company cannot publish new jobs on Workly India right now. Existing jobs stay visible.',
  },
  job_posting_unbanned: {
    title: 'You can post jobs again',
    message: 'Job posting has been enabled again for your company on Workly India.',
  },
};

const ACTION_URL: Partial<Record<AccountStatusEvent, string>> = {
  account_banned_job_seeker: '/contact',
  account_banned_employer: '/contact',
  job_apply_banned: '/contact',
  job_posting_banned: '/contact',
  account_unbanned_job_seeker: '/jobs',
  job_apply_unbanned: '/jobs',
  account_unbanned_employer: '/employer/dashboard',
  job_posting_unbanned: '/employer/post-job',
};

const DEFAULT_REASON = 'Reviewed by the Workly India team';

export interface AccountStatusNotifyOptions {
  userId: string;
  event: AccountStatusEvent;
  name?: string | null;
  company?: string | null;
  email?: string | null;
  reason?: string | null;
}

/**
 * Fire-and-forget: sends the push and lets the notifications hub fan the same
 * event out to the Email and Telegram templates.
 */
export async function notifyAccountStatus(options: AccountStatusNotifyOptions): Promise<void> {
  const { userId, event } = options;
  if (!userId) return;

  const fallback = FALLBACK[event];
  const variables: Record<string, string> = {
    reason: (options.reason || '').trim() || DEFAULT_REASON,
  };
  if (options.name) variables.name = options.name;
  if (options.company) variables.company = options.company;
  if (options.email) variables.email = options.email;

  try {
    const { error } = await supabase.functions.invoke('email-api', {
      body: {
        action: 'send_push',
        user_id: userId,
        event_type: event,
        title: fallback.title,
        message: fallback.message,
        action_url: ACTION_URL[event] || '/',
        variables,
        data: { type: event },
      },
    });
    if (error) console.error(`[accountStatusNotify] ${event} failed:`, error.message);
  } catch (err) {
    console.error(`[accountStatusNotify] ${event} threw:`, err);
  }
}

const hasProfileBan = (status?: string | null) => status === 'banned' || status === 'fully_banned';
const hasJobBan = (status?: string | null) => status === 'job_banned' || status === 'fully_banned';

export interface AccountStatusChangeOptions {
  userId: string;
  previousStatus?: string | null;
  nextStatus?: string | null;
  audience: 'job_seeker' | 'employer';
  name?: string | null;
  company?: string | null;
  email?: string | null;
  reason?: string | null;
}

/**
 * Compares the old and new account_status and sends the matching
 * ban / restore messages (profile ban and job ban are tracked separately).
 */
export async function notifyAccountStatusChange(options: AccountStatusChangeOptions): Promise<void> {
  const { userId, previousStatus, nextStatus, audience } = options;
  const base = { userId, name: options.name, company: options.company, email: options.email, reason: options.reason };
  const events: AccountStatusEvent[] = [];

  if (hasProfileBan(previousStatus) !== hasProfileBan(nextStatus)) {
    const banned = hasProfileBan(nextStatus);
    events.push(
      audience === 'employer'
        ? (banned ? 'account_banned_employer' : 'account_unbanned_employer')
        : (banned ? 'account_banned_job_seeker' : 'account_unbanned_job_seeker'),
    );
  }

  if (hasJobBan(previousStatus) !== hasJobBan(nextStatus)) {
    const banned = hasJobBan(nextStatus);
    events.push(
      audience === 'employer'
        ? (banned ? 'job_posting_banned' : 'job_posting_unbanned')
        : (banned ? 'job_apply_banned' : 'job_apply_unbanned'),
    );
  }

  for (const event of events) {
    await notifyAccountStatus({ ...base, event });
  }
}

// ---------------------------------------------------------------- DELETIONS --

export interface AccountDeletedNotifyOptions {
  userId: string;
  audience: 'job_seeker' | 'employer';
  name?: string | null;
  email?: string | null;
}

/**
 * Sends the "account deleted" Email + Telegram templates.
 * Call this BEFORE the delete runs so the name and email are still available.
 * Never throws — a delivery failure must not break the admin action.
 */
export async function notifyAccountDeleted(options: AccountDeletedNotifyOptions): Promise<void> {
  const { userId, audience } = options;
  if (!userId || !options.email) return;

  try {
    const { error } = await supabase.functions.invoke('email-api/account-deleted', {
      body: {
        user_id: userId,
        audience,
        name: options.name || 'User',
        email: options.email,
      },
    });
    if (error) console.error('[notifyAccountDeleted] failed:', error.message);
  } catch (err) {
    console.error('[notifyAccountDeleted] threw:', err);
  }
}
