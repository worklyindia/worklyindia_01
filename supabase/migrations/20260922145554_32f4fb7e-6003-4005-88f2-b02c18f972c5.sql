DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT jobid, command FROM cron.job WHERE command LIKE '%/functions/v1/email-trigger-handler%' LOOP
    PERFORM cron.alter_job(r.jobid, command => replace(r.command, '/functions/v1/email-trigger-handler', '/functions/v1/unified-notifications-api/email-trigger'));
  END LOOP;
END $$;