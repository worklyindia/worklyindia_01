-- lovable-cron-fallback-reviewed: 1440 runs/day; interview start alerts must reach the job seeker within a minute of the scheduled start time, and there is no row change or provider webhook at that moment to react to
ALTER TABLE public.interviews ADD COLUMN IF NOT EXISTS start_notified_at timestamptz;
ALTER TABLE public.interviews ADD COLUMN IF NOT EXISTS employer_joined_notified_at timestamptz;

CREATE OR REPLACE FUNCTION public.run_interview_start_notifications()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_secret text;
  v_anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDc3NjIsImV4cCI6MjA3MDQ4Mzc2Mn0.YsA13ya6S-ogDW59wVQ-n1JhVzDSwAuErfG0WZLTqI4';
  v_url text := 'https://jubwzelupbntbetpajqb.supabase.co/functions/v1/unified-notifications-api';
  r record;
  v_sent int := 0;
BEGIN
  SELECT value INTO v_secret FROM public.app_secrets WHERE key = 'points_notify_secret';

  FOR r IN
    SELECT i.id,
           i.applicant_id,
           i.scheduled_at,
           COALESCE(i.mode, 'online') AS mode,
           COALESCE(j.title, 'the role') AS job_title,
           COALESCE(c.company_name, 'The employer') AS company_name,
           COALESCE(p.full_name, 'there') AS applicant_name
    FROM public.interviews i
    LEFT JOIN public.jobs j ON j.id = i.job_id
    LEFT JOIN public.companies c ON c.id = j.company_id
    LEFT JOIN public.profiles p ON p.user_id = i.applicant_id
    WHERE i.applicant_id IS NOT NULL
      AND i.start_notified_at IS NULL
      AND i.scheduled_at IS NOT NULL
      AND i.scheduled_at <= now()
      AND i.scheduled_at > now() - interval '30 minutes'
      AND COALESCE(i.status, 'scheduled') NOT IN ('cancelled', 'completed', 'rejected')
    LIMIT 100
  LOOP
    DECLARE
      v_claimed int := 0;
      v_date text := to_char(r.scheduled_at AT TIME ZONE 'Asia/Kolkata', 'DD/MM/YYYY');
      v_time text := to_char(r.scheduled_at AT TIME ZONE 'Asia/Kolkata', 'HH12:MI:SS AM');
      v_title text := 'Your interview has started';
      v_message text;
    BEGIN
      UPDATE public.interviews
      SET start_notified_at = now()
      WHERE id = r.id AND start_notified_at IS NULL;
      GET DIAGNOSTICS v_claimed = ROW_COUNT;
      IF v_claimed = 0 THEN
        CONTINUE;
      END IF;

      v_message := r.job_title || ' at ' || r.company_name ||
        ' - your interview time has started. Join now from your Activity section.';

      INSERT INTO public.notifications (user_id, title, message, type, action_url, metadata)
      VALUES (r.applicant_id, v_title, v_message, 'interview_started', '/activity',
              jsonb_build_object('interview_id', r.id, 'job_title', r.job_title));

      PERFORM net.http_post(
        url := v_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_anon,
          'apikey', v_anon,
          'x-points-trigger-secret', COALESCE(v_secret, '')
        ),
        body := jsonb_build_object(
          'action', 'send_push',
          'user_id', r.applicant_id,
          'title', v_title,
          'message', v_message,
          'action_url', '/activity',
          'button_text', 'Join Now',
          'skip_rephrase', true,
          'event_type', 'interview_started',
          'variables', jsonb_build_object(
            'name', r.applicant_name,
            'job_title', r.job_title,
            'company', r.company_name,
            'mode', r.mode,
            'interview_date', v_date,
            'interview_time', v_time
          ),
          'data', jsonb_build_object('type', 'interview_started', 'interview_id', r.id)
        )
      );

      v_sent := v_sent + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object('sent', v_sent, 'ran_at', now());
END;
$fn$;

REVOKE ALL ON FUNCTION public.run_interview_start_notifications() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_interview_start_notifications() TO service_role;

SELECT cron.unschedule('interview-start-notifications')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'interview-start-notifications');

SELECT cron.schedule('interview-start-notifications', '* * * * *', $$SELECT public.run_interview_start_notifications();$$);