import { supabase } from '@/integrations/supabase/client';

/**
 * Website notifications.
 *
 * Every call goes through the single notification hub with an `event_type` (so
 * the owner-saved Push / Email / Telegram template decides the wording) and an
 * explicit `audience`, so an account that owns both a job-seeker profile and a
 * company always gets the message on the right side instead of one side being
 * skipped.
 */
type Audience = 'job_seeker' | 'employer';

async function sendEvent(args: {
  eventType?: string;
  audience: Audience;
  title: string;
  message: string;
  actionUrl?: string;
  buttonText?: string;
  variables?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.functions.invoke('email-api', {
      body: {
        action: 'send_push',
        user_id: user.id,
        audience: args.audience,
        ...(args.eventType ? { event_type: args.eventType } : {}),
        title: args.title,
        message: args.message,
        action_url: args.actionUrl || '/activity',
        ...(args.buttonText ? { button_text: args.buttonText } : {}),
        skip_rephrase: true,
        variables: args.variables ?? {},
        data: { type: args.eventType ?? 'notification', ...(args.variables ?? {}) },
      },
    });

    if (error) console.error(`[notify] ${args.eventType ?? args.title} failed:`, error.message);
  } catch (error) {
    console.error(`[notify] ${args.eventType ?? args.title} threw:`, error);
  }
}

export class NotificationService {
  static async sendPaymentSuccessNotification(points: number): Promise<void> {
    await sendEvent({
      eventType: 'payment_success',
      audience: 'job_seeker',
      title: '🎉 Payment Successful!',
      message: `Great! ${points} points have been added to your wallet.`,
      actionUrl: '/employer-portal',
      buttonText: 'Open Portal',
      variables: { points },
    });
  }

  static async sendJobApplicationNotification(jobTitle: string): Promise<void> {
    await sendEvent({
      eventType: 'application_submitted',
      audience: 'job_seeker',
      title: 'Application Submitted',
      message: `Your application for ${jobTitle} has been submitted successfully.`,
      variables: { job_title: jobTitle },
    });
  }

  static async sendInterviewScheduledNotification(jobTitle: string, scheduledAt: string): Promise<void> {
    await sendEvent({
      eventType: 'application_interview_scheduled',
      audience: 'job_seeker',
      title: 'Interview Scheduled',
      message: `Your interview for ${jobTitle} has been scheduled.`,
      variables: { job_title: jobTitle, interview_date: scheduledAt },
    });
  }

  static async sendJobMatchNotification(jobTitle: string, jobId: string): Promise<void> {
    await sendEvent({
      eventType: 'new_job_match',
      audience: 'job_seeker',
      title: 'New Job Match!',
      message: `A new job opportunity "${jobTitle}" matches your profile.`,
      actionUrl: `/job/${jobId}`,
      variables: { job_title: jobTitle },
    });
  }

  static async sendJobExtensionNotification(jobTitle: string, durationMonths: number, pointsCost: number): Promise<void> {
    await sendEvent({
      audience: 'employer',
      title: '🎉 Job Extended Successfully!',
      message: `Your job "${jobTitle}" has been extended by ${durationMonths} month${durationMonths > 1 ? 's' : ''} using ${pointsCost} wallet points.`,
      actionUrl: '/employer-portal',
      variables: { job_title: jobTitle, points: pointsCost },
    });
  }
}
