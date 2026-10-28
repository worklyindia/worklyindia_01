REVOKE EXECUTE ON FUNCTION public.check_whatsapp_phone_unique() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_company_owner(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_company_owner(uuid) TO authenticated;