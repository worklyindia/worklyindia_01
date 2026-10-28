REVOKE EXECUTE ON FUNCTION public.merge_charged_api_log() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_api_call(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_api_call(uuid) TO service_role;