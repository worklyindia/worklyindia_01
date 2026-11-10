REVOKE ALL ON FUNCTION public.adjust_wallet_points(uuid, integer, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.adjust_wallet_points(uuid, integer, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.adjust_wallet_points(uuid, integer, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_wallet_points(uuid, integer, text, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.admin_get_comprehensive_wallet_history(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_get_comprehensive_wallet_history(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_get_comprehensive_wallet_history(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_comprehensive_wallet_history(uuid) TO service_role;