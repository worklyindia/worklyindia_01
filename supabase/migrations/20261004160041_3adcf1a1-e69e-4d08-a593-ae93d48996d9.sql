CREATE OR REPLACE FUNCTION public.consume_api_call(_user_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r public.api_call_quota; _key uuid;
BEGIN
  r := public.api_quota_refresh(_user_id);
  IF r.used >= r.monthly_limit THEN
    RETURN jsonb_build_object('allowed', false, 'used', r.used, 'limit', r.monthly_limit, 'remaining', 0);
  END IF;
  UPDATE public.api_call_quota SET used = used + 1, updated_at = now() WHERE user_id=_user_id RETURNING * INTO r;
  -- Every charged call gets a log row, so any service is visible even if it never logs itself.
  SELECT id INTO _key FROM public.api_keys WHERE user_id=_user_id ORDER BY created_at DESC LIMIT 1;
  INSERT INTO public.api_request_logs(api_key_id, endpoint, method, status_code, response_time_ms, request_params)
  VALUES (_key, 'api-call', 'POST', 200, 0, jsonb_build_object('auto_charged', true, 'user_id', _user_id));
  RETURN jsonb_build_object('allowed', true, 'used', r.used, 'limit', r.monthly_limit, 'remaining', r.monthly_limit - r.used);
END $function$;

-- When a service writes its own detailed log, merge it into the pending charged row instead of duplicating.
CREATE OR REPLACE FUNCTION public.merge_charged_api_log()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _id uuid;
BEGIN
  IF NEW.api_key_id IS NULL OR (NEW.request_params ? 'auto_charged') THEN RETURN NEW; END IF;
  SELECT id INTO _id FROM public.api_request_logs
   WHERE api_key_id = NEW.api_key_id AND request_params ? 'auto_charged'
     AND created_at > now() - interval '5 minutes'
   ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF _id IS NULL THEN RETURN NEW; END IF;
  UPDATE public.api_request_logs SET endpoint=NEW.endpoint, method=NEW.method, status_code=NEW.status_code,
    response_time_ms=NEW.response_time_ms, request_params=NEW.request_params, response_size_bytes=NEW.response_size_bytes,
    ip_address=NEW.ip_address, user_agent=NEW.user_agent, error_message=NEW.error_message
   WHERE id=_id;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_merge_charged_api_log ON public.api_request_logs;
CREATE TRIGGER trg_merge_charged_api_log BEFORE INSERT ON public.api_request_logs
FOR EACH ROW EXECUTE FUNCTION public.merge_charged_api_log();