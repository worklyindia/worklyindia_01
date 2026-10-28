CREATE TABLE public.api_call_quota (
  user_id uuid PRIMARY KEY,
  monthly_limit integer NOT NULL DEFAULT 0,
  used integer NOT NULL DEFAULT 0,
  period_start date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.api_call_quota TO authenticated;
GRANT ALL ON public.api_call_quota TO service_role;
ALTER TABLE public.api_call_quota ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own API quota" ON public.api_call_quota FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Lazily starts a new monthly period on/after the 1st (IST). First period ever: everyone gets free calls; later months: only active subscribers.
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
    INSERT INTO public.api_call_quota(user_id, monthly_limit, used, period_start) VALUES (_user_id, free_calls, 0, m) RETURNING * INTO r;
    RETURN r;
  END IF;
  IF r.period_start < m THEN
    SELECT EXISTS(SELECT 1 FROM public.api_subscriptions WHERE user_id=_user_id AND status='active' AND (expires_at IS NULL OR expires_at > now())) INTO active;
    UPDATE public.api_call_quota SET monthly_limit = CASE WHEN active THEN free_calls ELSE 0 END, used=0, period_start=m, updated_at=now()
      WHERE user_id=_user_id RETURNING * INTO r;
  END IF;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.consume_api_call(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.api_call_quota;
BEGIN
  r := public.api_quota_refresh(_user_id);
  IF r.used >= r.monthly_limit THEN
    RETURN jsonb_build_object('allowed', false, 'used', r.used, 'limit', r.monthly_limit, 'remaining', 0);
  END IF;
  UPDATE public.api_call_quota SET used = used + 1, updated_at = now() WHERE user_id=_user_id RETURNING * INTO r;
  RETURN jsonb_build_object('allowed', true, 'used', r.used, 'limit', r.monthly_limit, 'remaining', r.monthly_limit - r.used);
END $$;

CREATE OR REPLACE FUNCTION public.get_my_api_quota()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.api_call_quota;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  r := public.api_quota_refresh(auth.uid());
  RETURN jsonb_build_object('used', r.used, 'limit', r.monthly_limit, 'remaining', greatest(r.monthly_limit - r.used, 0), 'period_start', r.period_start);
END $$;

REVOKE ALL ON FUNCTION public.api_quota_refresh(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_api_call(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_api_call(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.api_quota_refresh(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.get_my_api_quota() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_api_quota() TO authenticated;