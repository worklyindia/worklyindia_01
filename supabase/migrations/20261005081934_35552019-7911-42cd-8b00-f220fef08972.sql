ALTER TABLE public.api_call_purchases ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'purchase';

CREATE OR REPLACE FUNCTION public.add_purchased_api_calls(_user_id uuid, _calls integer, _amount numeric, _order_id text, _payment_id text, _source text DEFAULT 'purchase')
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.api_call_purchases(user_id, calls, amount, order_id, payment_id, source)
  VALUES (_user_id, _calls, _amount, _order_id, _payment_id, coalesce(nullif(_source,''),'purchase')) ON CONFLICT (payment_id) DO NOTHING;
  IF NOT FOUND THEN RETURN false; END IF;
  PERFORM public.api_quota_refresh(_user_id);
  UPDATE public.api_call_quota SET monthly_limit = monthly_limit + _calls, updated_at = now() WHERE user_id = _user_id;
  RETURN true;
END $function$;

CREATE OR REPLACE FUNCTION public.api_quota_refresh(_user_id uuid)
 RETURNS api_call_quota
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r public.api_call_quota;
  m date := date_trunc('month', (now() AT TIME ZONE 'Asia/Kolkata'))::date;
  free_calls integer := coalesce((SELECT nullif(setting_value,'')::integer FROM public.app_settings WHERE setting_key='api_free_calls' LIMIT 1), 5000);
  active boolean;
BEGIN
  SELECT * INTO r FROM public.api_call_quota WHERE user_id=_user_id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.api_call_quota(user_id, monthly_limit, used, period_start)
    VALUES (_user_id, free_calls, 0, m) RETURNING * INTO r;
    INSERT INTO public.api_call_purchases(user_id, calls, amount, order_id, payment_id, source)
    VALUES (_user_id, free_calls, 0, 'free_' || m::text, 'free_' || _user_id::text || '_' || m::text, 'free')
    ON CONFLICT (payment_id) DO NOTHING;
    RETURN r;
  END IF;
  IF r.period_start < m THEN
    SELECT EXISTS(SELECT 1 FROM public.api_subscriptions
      WHERE user_id=_user_id AND status='active' AND (expires_at IS NULL OR expires_at > now())) INTO active;
    UPDATE public.api_call_quota
    SET monthly_limit = greatest(r.monthly_limit - r.used, 0) + CASE WHEN active THEN free_calls ELSE 0 END,
        used = 0, period_start = m, updated_at = now()
    WHERE user_id=_user_id RETURNING * INTO r;
    IF active THEN
      INSERT INTO public.api_call_purchases(user_id, calls, amount, order_id, payment_id, source)
      VALUES (_user_id, free_calls, 0, 'free_' || m::text, 'free_' || _user_id::text || '_' || m::text, 'free')
      ON CONFLICT (payment_id) DO NOTHING;
    END IF;
  END IF;
  RETURN r;
END $function$;