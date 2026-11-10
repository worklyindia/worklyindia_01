CREATE OR REPLACE FUNCTION public.merge_charged_api_log()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _id uuid;
BEGIN
  IF NEW.api_key_id IS NULL OR (NEW.request_params ? 'auto_charged') THEN RETURN NEW; END IF;
  SELECT id INTO _id FROM public.api_request_logs
   WHERE api_key_id = NEW.api_key_id AND request_params ? 'auto_charged'
     AND created_at > now() - interval '5 minutes'
   ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF _id IS NULL THEN RETURN NEW; END IF;
  UPDATE public.api_request_logs SET
    endpoint = COALESCE(NEW.endpoint, endpoint),
    method = COALESCE(NEW.method, method),
    status_code = COALESCE(NEW.status_code, status_code),
    response_time_ms = COALESCE(NEW.response_time_ms, response_time_ms),
    request_params = COALESCE(request_params, '{}'::jsonb) || COALESCE(NEW.request_params, '{}'::jsonb),
    response_size_bytes = COALESCE(NEW.response_size_bytes, response_size_bytes),
    ip_address = COALESCE(NEW.ip_address, ip_address),
    user_agent = COALESCE(NEW.user_agent, user_agent),
    error_message = COALESCE(NEW.error_message, error_message)
   WHERE id=_id;
  RETURN NULL;
END $function$;
REVOKE EXECUTE ON FUNCTION public.merge_charged_api_log() FROM PUBLIC, anon, authenticated;