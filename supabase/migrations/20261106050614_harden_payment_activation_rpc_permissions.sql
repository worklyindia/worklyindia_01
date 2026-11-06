-- Restrict payment fulfilment RPCs to trusted server-side service_role callers.
-- The Edge Functions verify user ownership and captured Razorpay payments before invoking these functions.

REVOKE ALL ON FUNCTION public.activate_company_verification(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_company_verification(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.activate_company_verification(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_company_verification(uuid, uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.activate_job_boost(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_job_boost(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.activate_job_boost(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_job_boost(uuid, uuid, uuid) TO service_role;
