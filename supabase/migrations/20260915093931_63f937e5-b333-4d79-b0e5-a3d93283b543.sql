CREATE OR REPLACE FUNCTION public.notify_points_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, net
AS $$
DECLARE
  v_secret text;
BEGIN
  IF NEW.user_id IS NULL OR COALESCE(NEW.points_amount, 0) = 0 THEN
    RETURN NEW;
  END IF;

  SELECT value INTO v_secret FROM public.app_secrets WHERE key = 'points_notify_secret';
  IF v_secret IS NULL OR v_secret = '' THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://jubwzelupbntbetpajqb.supabase.co/functions/v1/unified-notifications-api',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDc3NjIsImV4cCI6MjA3MDQ4Mzc2Mn0.YsA13ya6S-ogDW59wVQ-n1JhVzDSwAuErfG0WZLTqI4',
      'x-points-trigger-secret', v_secret
    ),
    body := jsonb_build_object(
      'action', 'points_ledger_event',
      'id', NEW.id,
      'user_id', NEW.user_id,
      'points_amount', NEW.points_amount,
      'points_balance_after', NEW.points_balance_after,
      'description', NEW.description,
      'transaction_type', NEW.transaction_type
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_points_transaction failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_points_transaction() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_points_transaction() FROM anon;
REVOKE ALL ON FUNCTION public.notify_points_transaction() FROM authenticated;