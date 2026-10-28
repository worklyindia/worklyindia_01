import { supabase } from '@/integrations/supabase/client';

/**
 * Interview notifications for job seekers.
 *
 * `interview_employer_joined` is fired from the employer's browser the moment
 * the interviewer opens the interview room. `interview_started` is handled by
 * the database routine `run_interview_start_notifications()` so the candidate
 * is alerted even when nobody has the app open.
 *
 * Both events go through email-api, which delivers the push and
 * fans the same event out to the Email and Telegram templates configured in the
 * Owner Portal. Failures are logged and never break the interview flow.
 */

const IST = 'en-IN';

const istDate = (d = new Date()) =>
  d.toLocaleDateString(IST, { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' });

const istTime = (d = new Date()) =>
  d.toLocaleTimeString(IST, {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).toUpperCase();

export interface EmployerJoinedArgs {
  interviewId: string;
  applicantId: string;
  jobTitle: string;
  companyName: string;
  mode: string;
  scheduledAt?: string | null;
}

/** Tell the candidate (push + email + telegram) that the interviewer has joined. */
export async function notifyEmployerJoined(args: EmployerJoinedArgs): Promise<boolean> {
  const { interviewId, applicantId, jobTitle, companyName, mode } = args;
  if (!interviewId || !applicantId) return false;

  try {
    // One message per interview: claim the row before sending.
    const { data: claimed, error: claimError } = await supabase
      .from('interviews')
      .update({ employer_joined_notified_at: new Date().toISOString() })
      .eq('id', interviewId)
      .is('employer_joined_notified_at', null)
      .select('id');

    if (claimError) {
      console.warn('[interview] join claim failed (non-critical):', claimError.message);
      return false;
    }
    if (!claimed || claimed.length === 0) return false;

    const scheduled = args.scheduledAt ? new Date(args.scheduledAt) : new Date();
    const title = 'Interviewer has joined';
    const message = `${companyName} has joined your interview for ${jobTitle}. Please join now.`;

    const { error } = await supabase.functions.invoke('email-api', {
      body: {
        action: 'send_push',
        user_id: applicantId,
        // The candidate is a job seeker — keep the side explicit so a login that
        // also owns a company still gets it on the job-seeker side.
        audience: 'job_seeker',
        title,
        message,
        action_url: '/activity',
        button_text: 'Join Interview',
        skip_rephrase: true,
        event_type: 'interview_employer_joined',
        variables: {
          job_title: jobTitle,
          company: companyName,
          mode,
          interview_date: istDate(scheduled),
          interview_time: istTime(scheduled),
        },
        data: { type: 'interview_employer_joined', interview_id: interviewId },
      },
    });

    if (error) {
      console.warn('[interview] employer-joined notification failed:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[interview] employer-joined notification threw:', err);
    return false;
  }
}
