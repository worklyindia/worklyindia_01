CREATE OR REPLACE FUNCTION public.api_quota_refresh(_user_id uuid)
RETURNS public.api_call_quota
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    RETURN r;
  END IF;
  IF r.period_start < m THEN
    SELECT EXISTS(SELECT 1 FROM public.api_subscriptions
      WHERE user_id=_user_id AND status='active' AND (expires_at IS NULL OR expires_at > now())) INTO active;
    -- Carry forward unused calls; grant the new monthly allowance only when subscribed.
    -- Reset the period's used count, never the unused balance.
    UPDATE public.api_call_quota
    SET monthly_limit = greatest(r.monthly_limit - r.used, 0) + CASE WHEN active THEN free_calls ELSE 0 END,
        used = 0, period_start = m, updated_at = now()
    WHERE user_id=_user_id RETURNING * INTO r;
  END IF;
  RETURN r;
END $$;

REVOKE ALL ON FUNCTION public.api_quota_refresh(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_quota_refresh(uuid) TO service_role;