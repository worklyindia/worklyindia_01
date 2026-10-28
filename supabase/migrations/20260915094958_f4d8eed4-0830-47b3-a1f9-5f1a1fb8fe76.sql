-- 1) Remove duplicate legacy job-application notification triggers
DROP TRIGGER IF EXISTS job_application_notification_trigger ON public.job_applications;
DROP TRIGGER IF EXISTS on_application_submitted ON public.job_applications;
DROP TRIGGER IF EXISTS on_job_application_created ON public.job_applications;
DROP TRIGGER IF EXISTS on_new_job_application ON public.job_applications;
DROP TRIGGER IF EXISTS send_applicant_push_notification_trigger ON public.job_applications;

DROP FUNCTION IF EXISTS public.create_job_application_notification();
DROP FUNCTION IF EXISTS public.create_applicant_submission_notification();
DROP FUNCTION IF EXISTS public.create_employer_job_application_notification_with_push();
DROP FUNCTION IF EXISTS public.create_employer_application_notification();
DROP FUNCTION IF EXISTS public.send_applicant_push_notification();

-- 2) Single trigger -> unified notification hub (instant, works for every apply path)
CREATE OR REPLACE FUNCTION public.notify_job_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'net'
AS $function$
DECLARE
  v_secret text;
BEGIN
  SELECT value INTO v_secret FROM public.app_secrets WHERE key = 'points_notify_secret';

  PERFORM net.http_post(
    url := 'https://jubwzelupbntbetpajqb.supabase.co/functions/v1/unified-notifications-api',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDc3NjIsImV4cCI6MjA3MDQ4Mzc2Mn0.YsA13ya6S-ogDW59wVQ-n1JhVzDSwAuErfG0WZLTqI4',
      'x-points-trigger-secret', COALESCE(v_secret, '')
    ),
    body := jsonb_build_object(
      'action', 'job_application_notification',
      'application_id', NEW.id
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_job_application failed: %', SQLERRM;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS notify_job_application_trigger ON public.job_applications;
CREATE TRIGGER notify_job_application_trigger
AFTER INSERT ON public.job_applications
FOR EACH ROW EXECUTE FUNCTION public.notify_job_application();