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
  -- Keep the key's own last-used time and usage in step with the logs, for every service.
  IF _key IS NOT NULL THEN
    UPDATE public.api_keys SET last_used_at = now(), usage_count = COALESCE(usage_count, 0) + 1 WHERE id = _key;
  END IF;
  INSERT INTO public.api_request_logs(api_key_id, endpoint, method, status_code, response_time_ms, request_params)
  VALUES (_key, 'api-call', 'POST', 200, 0, jsonb_build_object('auto_charged', true, 'user_id', _user_id));
  RETURN jsonb_build_object('allowed', true, 'used', r.used, 'limit', r.monthly_limit, 'remaining', r.monthly_limit - r.used);
END $function$;

REVOKE EXECUTE ON FUNCTION public.consume_api_call(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_api_call(uuid) TO service_role;