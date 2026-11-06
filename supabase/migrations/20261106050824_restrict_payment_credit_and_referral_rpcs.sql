-- These SECURITY DEFINER functions mutate paid API quota and referral-wallet balances.
-- Only trusted Edge Functions running with service_role may invoke them.

REVOKE ALL ON FUNCTION public.add_purchased_api_calls(uuid, integer, numeric, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_purchased_api_calls(uuid, integer, numeric, text, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.process_referral_commission(uuid, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_referral_commission(uuid, integer, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.process_referral_commission(uuid, numeric, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_referral_commission(uuid, numeric, text, text) TO service_role;
