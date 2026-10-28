-- lovable-cron-fallback-reviewed: 96 runs/day; Microsoft Graph does not provide a simple inbox webhook in this custom Supabase OAuth setup, so 15-minute polling preserves the expected automatic reply window.
DO $$
DECLARE
  source_command text;
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'outlook-autoreply-every-15-min') THEN
    PERFORM cron.unschedule('outlook-autoreply-every-15-min');
  END IF;

  SELECT command
  INTO source_command
  FROM cron.job
  WHERE command LIKE '%"action": "gmail_autoreply_cron"%'
  ORDER BY jobid
  LIMIT 1;

  IF source_command IS NULL THEN
    RAISE EXCEPTION 'Existing protected Gmail auto-reply schedule was not found';
  END IF;

  source_command := replace(
    source_command,
    '"action": "gmail_autoreply_cron"',
    '"action": "outlook_autoreply_cron"'
  );

  PERFORM cron.schedule(
    'outlook-autoreply-every-15-min',
    '10,25,40,55 * * * *',
    source_command
  );
END
$$;