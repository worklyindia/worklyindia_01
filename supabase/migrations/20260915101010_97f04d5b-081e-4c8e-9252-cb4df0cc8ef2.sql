CREATE OR REPLACE FUNCTION public.create_application_status_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'net'
AS $function$
DECLARE
  v_secret text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT value INTO v_secret FROM public.app_secrets WHERE key = 'points_notify_secret';

    PERFORM net.http_post(
      url := 'https://jubwzelupbntbetpajqb.supabase.co/functions/v1/unified-notifications-api',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDc3NjIsImV4cCI6MjA3MDQ4Mzc2Mn0.YsA13ya6S-ogDW59wVQ-n1JhVzDSwAuErfG0WZLTqI4',
        'x-points-trigger-secret', COALESCE(v_secret, '')
      ),
      body := jsonb_build_object(
        'action', 'application_status_notification',
        'application_id', NEW.id,
        'new_status', NEW.status
      )
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'create_application_status_notification failed: %', SQLERRM;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_application_status_notification ON public.job_applications;
DROP TRIGGER IF EXISTS trigger_application_status_notification ON public.job_applications;
CREATE TRIGGER trg_application_status_notification
AFTER UPDATE OF status ON public.job_applications
FOR EACH ROW EXECUTE FUNCTION public.create_application_status_notification();

CREATE OR REPLACE FUNCTION public.notify_interview_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'net'
AS $function$
DECLARE
  v_secret text;
  v_user_id uuid;
  v_job_title text;
  v_status text;
  v_title text;
  v_message text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.applicant_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(p.user_id, NEW.applicant_id) INTO v_user_id
  FROM public.profiles p WHERE p.id = NEW.applicant_id;
  v_user_id := COALESCE(v_user_id, NEW.applicant_id);

  SELECT j.title INTO v_job_title FROM public.jobs j WHERE j.id = NEW.job_id;
  v_job_title := COALESCE(v_job_title, 'your job application');
  v_status := lower(COALESCE(NEW.status, ''));

  IF v_status IN ('scheduled', 'upcoming') THEN
    v_title := '📅 Interview Scheduled';
    v_message := 'Your interview for ' || v_job_title || ' is scheduled. Check your activity page for details.';
  ELSIF v_status IN ('live', 'in_progress', 'ongoing') THEN
    v_title := '🔴 Interview Is Live';
    v_message := 'Your interview for ' || v_job_title || ' is live now. Join immediately.';
  ELSIF v_status = 'rescheduled' THEN
    v_title := '🔁 Interview Rescheduled';
    v_message := 'Your interview for ' || v_job_title || ' has been rescheduled. Check the new time.';
  ELSIF v_status = 'completed' THEN
    v_title := '✅ Interview Completed';
    v_message := 'Your interview for ' || v_job_title || ' is complete. We will update you soon.';
  ELSIF v_status = 'cancelled' THEN
    v_title := '⚠️ Interview Cancelled';
    v_message := 'Your interview for ' || v_job_title || ' has been cancelled.';
  ELSE
    v_title := '📋 Interview Update';
    v_message := 'Your interview for ' || v_job_title || ' is now ' || replace(v_status, '_', ' ') || '.';
  END IF;

  SELECT value INTO v_secret FROM public.app_secrets WHERE key = 'points_notify_secret';

  BEGIN
    INSERT INTO public.notifications (user_id, title, message, type, action_url)
    VALUES (v_user_id, v_title, v_message, 'interview', '/activity');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  PERFORM net.http_post(
    url := 'https://jubwzelupbntbetpajqb.supabase.co/functions/v1/unified-notifications-api',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDc3NjIsImV4cCI6MjA3MDQ4Mzc2Mn0.YsA13ya6S-ogDW59wVQ-n1JhVzDSwAuErfG0WZLTqI4',
      'x-points-trigger-secret', COALESCE(v_secret, '')
    ),
    body := jsonb_build_object(
      'action', 'send_push',
      'user_id', v_user_id,
      'title', v_title,
      'message', v_message,
      'action_url', '/activity',
      'button_text', 'View Activity',
      'skip_rephrase', true,
      'data', jsonb_build_object('type', 'interview_status_update', 'interview_id', NEW.id, 'job_id', NEW.job_id, 'status', v_status)
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_interview_status_change failed: %', SQLERRM;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_interview_status_notification ON public.interviews;
CREATE TRIGGER trg_interview_status_notification
AFTER INSERT OR UPDATE OF status ON public.interviews
FOR EACH ROW EXECUTE FUNCTION public.notify_interview_status_change();