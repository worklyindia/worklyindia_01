CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

INSERT INTO public.app_secrets (key, value)
VALUES ('points_notify_secret', encode(extensions.gen_random_bytes(32), 'hex'))
ON CONFLICT (key) DO NOTHING;

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
    url := 'https://jubwzelupbntbetpajqb.supabase.co/functions/v1/points-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-points-trigger-secret', v_secret
    ),
    body := jsonb_build_object(
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

DROP TRIGGER IF EXISTS trg_notify_points_transaction ON public.points_transactions;
CREATE TRIGGER trg_notify_points_transaction
AFTER INSERT ON public.points_transactions
FOR EACH ROW EXECUTE FUNCTION public.notify_points_transaction();