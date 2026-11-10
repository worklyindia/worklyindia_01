CREATE TABLE public.outlook_send_usage (
  user_id uuid NOT NULL,
  window_start timestamptz NOT NULL,
  window_kind text NOT NULL,
  sent integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, window_kind, window_start)
);
GRANT ALL ON public.outlook_send_usage TO service_role;
ALTER TABLE public.outlook_send_usage ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.reserve_outlook_send(_user_id uuid, _hour_limit int, _day_limit int)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE h timestamptz := date_trunc('hour', now()); d timestamptz := date_trunc('day', now()); hs int; ds int;
BEGIN
  INSERT INTO outlook_send_usage(user_id, window_kind, window_start, sent) VALUES (_user_id,'hour',h,0),(_user_id,'day',d,0) ON CONFLICT DO NOTHING;
  SELECT sent INTO hs FROM outlook_send_usage WHERE user_id=_user_id AND window_kind='hour' AND window_start=h FOR UPDATE;
  SELECT sent INTO ds FROM outlook_send_usage WHERE user_id=_user_id AND window_kind='day' AND window_start=d FOR UPDATE;
  IF hs >= _hour_limit OR ds >= _day_limit THEN RETURN false; END IF;
  UPDATE outlook_send_usage SET sent=sent+1 WHERE user_id=_user_id AND ((window_kind='hour' AND window_start=h) OR (window_kind='day' AND window_start=d));
  DELETE FROM outlook_send_usage WHERE window_start < now() - interval '3 days';
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.reserve_outlook_send(uuid,int,int) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_outlook_send(uuid,int,int) TO service_role;