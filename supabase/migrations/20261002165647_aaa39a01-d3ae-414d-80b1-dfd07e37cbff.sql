DO $$
DECLARE
  r RECORD;
  new_def text;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'notify_points_transaction',
        'notify_job_application',
        'create_application_status_notification',
        'notify_interview_status_change',
        'send_referral_push',
        'run_interview_start_notifications',
        'calculate_and_award_competition_prizes'
      )
      AND pg_get_functiondef(p.oid) LIKE '%unified-notifications-api%'
  LOOP
    new_def := replace(pg_get_functiondef(r.oid), '/functions/v1/unified-notifications-api', '/functions/v1/email-api');
    EXECUTE new_def;
  END LOOP;
END $$;