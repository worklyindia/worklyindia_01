DROP FUNCTION IF EXISTS public.set_employer_whatsapp_ai_reply(boolean);
GRANT UPDATE (ai_auto_reply) ON public.employer_whatsapp_accounts TO authenticated;
CREATE POLICY "Company owner toggles own WhatsApp AI reply" ON public.employer_whatsapp_accounts
  FOR UPDATE TO authenticated USING (public.is_company_owner(company_id)) WITH CHECK (public.is_company_owner(company_id));