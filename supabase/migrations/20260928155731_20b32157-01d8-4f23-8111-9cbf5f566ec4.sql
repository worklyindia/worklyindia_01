ALTER TABLE public.employer_whatsapp_accounts ADD COLUMN IF NOT EXISTS ai_auto_reply boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.set_employer_whatsapp_ai_reply(_enabled boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.employer_whatsapp_accounts a SET ai_auto_reply = _enabled
  WHERE EXISTS (SELECT 1 FROM public.companies c WHERE c.id = a.company_id AND c.user_id = auth.uid());
  RETURN _enabled;
END $$;
REVOKE ALL ON FUNCTION public.set_employer_whatsapp_ai_reply(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_employer_whatsapp_ai_reply(boolean) TO authenticated;