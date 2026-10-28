CREATE OR REPLACE FUNCTION public.run_expiry_reminders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDc3NjIsImV4cCI6MjA3MDQ4Mzc2Mn0.YsA13ya6S-ogDW59wVQ-n1JhVzDSwAuErfG0WZLTqI4';
  v_request_id bigint;
BEGIN
  -- All expiry reminders are now composed from the owner's saved templates
  -- inside the expiry-reminders edge function (push + email + telegram,
  -- with the correct audience for each profile side).
  SELECT net.http_post(
    url := 'https://jubwzelupbntbetpajqb.supabase.co/functions/v1/expiry-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon,
      'apikey', v_anon
    ),
    body := '{}'::jsonb
  ) INTO v_request_id;

  RETURN jsonb_build_object('dispatched', true, 'request_id', v_request_id, 'ran_at', now());
END;
$function$;