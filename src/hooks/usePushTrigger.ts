import { supabase } from '@/integrations/supabase/client';
import { resolveTemplateKey } from '@/config/pushTemplateCatalog';

export type PushAudience = 'website_user' | 'employer' | 'owner';

type Copy = { title: string; body: string; url?: string };

const titleize = (key: string) =>
  key
    .replace(/^push_/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Event copy for push notifications. Unknown keys fall back to a readable
 * title generated from the event key itself.
 */
const EVENT_COPY: Record<string, Copy> = {
  push_signup_welcome: { title: 'Welcome to Workly India 🎉', body: 'Complete your profile to start applying for jobs.', url: '/profile' },
  push_employer_signup_welcome: { title: 'Welcome to Workly India 🎉', body: 'Post your first job and start hiring today.', url: '/employer-portal' },
  push_profile_complete: { title: 'Profile complete ✅', body: 'You can now apply to jobs with one tap.', url: '/jobs' },
  push_application_submitted: { title: 'Application sent ✅', body: 'Your application was submitted successfully.', url: '/applications' },
  push_new_application_received: { title: 'New application received', body: 'A candidate just applied to your job.', url: '/employer-portal/applications' },
  push_application_viewed: { title: 'Your application was viewed 👀', body: 'An employer just reviewed your application.', url: '/applications' },
  push_application_shortlisted: { title: 'You have been shortlisted 🎯', body: 'An employer shortlisted your application.', url: '/applications' },
  push_application_rejected: { title: 'Application update', body: 'There is an update on one of your applications.', url: '/applications' },
  push_interview_scheduled: { title: 'Interview scheduled 📅', body: 'An employer scheduled an interview with you.', url: '/applications' },
  push_interview_cancelled: { title: 'Interview cancelled', body: 'Your scheduled interview was cancelled.', url: '/applications' },
  push_employer_interview_cancelled: { title: 'Interview cancelled', body: 'A scheduled interview was cancelled.', url: '/employer-portal/applications' },
  push_interview_completed: { title: 'Interview completed', body: 'Your interview has been marked as completed.', url: '/applications' },
  push_employer_interview_completed: { title: 'Interview completed', body: 'The interview was marked as completed.', url: '/employer-portal/applications' },
  push_payment_success: { title: 'Payment successful ✅', body: 'Your payment was received.', url: '/wallet' },
  push_payment_failed: { title: 'Payment failed', body: 'Your payment could not be processed.', url: '/wallet' },
  push_new_job_match: { title: 'New job match 🔥', body: 'A new job matching your profile is available.', url: '/jobs' },
};

const asText = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);

/**
 * Fire-and-forget push notification for an app event (Firebase / FCM).
 * Never throws — push failures must not break the calling flow.
 */
export async function triggerPushEvent(
  eventKey: string,
  userId: string,
  audience: PushAudience = 'website_user',
  recipientName?: string,
  data: Record<string, unknown> = {},
): Promise<boolean> {
  if (!userId) return false;

  const copy = EVENT_COPY[eventKey] ?? { title: titleize(eventKey), body: 'You have a new update on Workly India.' };
  const title = asText(data.title) ?? copy.title;
  const body = asText(data.body) ?? asText(data.message) ?? copy.body;
  const url = asText(data.actionUrl) ?? asText(data.url) ?? copy.url ?? '/notifications';

  // Owner Portal → Push Templates stores keys without the `push_` prefix, and
  // several app events share one template (see PUSH_EVENT_ALIASES).
  const templateKey = resolveTemplateKey(eventKey);

  try {
    const { error } = await supabase.functions.invoke('email-api', {
      body: {
        action: 'send_push',
        user_id: userId,
        title,
        message: body,
        action_url: url,
        skip_rephrase: true,
        audience: audience === 'employer' ? 'employer' : 'job_seeker',
        event_type: templateKey,
        variables: { name: recipientName ?? '', ...data },
        data: { event: eventKey, type: templateKey, ...data },
      },
    });
    if (error) {
      console.warn('[push] send failed (non-critical):', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[push] send threw (non-critical):', err);
    return false;
  }
}

export const usePushTrigger = () => ({ triggerPushEvent });
