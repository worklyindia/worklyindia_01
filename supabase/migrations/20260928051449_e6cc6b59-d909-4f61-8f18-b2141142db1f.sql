CREATE OR REPLACE FUNCTION public.is_company_message_owner(_message_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.whatsapp_messages m JOIN public.companies c ON c.id = m.company_id
    WHERE m.id = _message_id AND c.user_id = auth.uid()
  )
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_messages TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.whatsapp_message_reactions TO authenticated;

CREATE POLICY "Company owner creates own WhatsApp conversations" ON public.whatsapp_conversations
  FOR INSERT TO authenticated WITH CHECK (company_id IS NOT NULL AND public.is_company_owner(company_id));
CREATE POLICY "Company owner deletes own WhatsApp conversations" ON public.whatsapp_conversations
  FOR DELETE TO authenticated USING (company_id IS NOT NULL AND public.is_company_owner(company_id));
CREATE POLICY "Company owner updates own WhatsApp messages" ON public.whatsapp_messages
  FOR UPDATE TO authenticated USING (company_id IS NOT NULL AND public.is_company_owner(company_id))
  WITH CHECK (company_id IS NOT NULL AND public.is_company_owner(company_id));
CREATE POLICY "Company owner deletes own WhatsApp messages" ON public.whatsapp_messages
  FOR DELETE TO authenticated USING (company_id IS NOT NULL AND public.is_company_owner(company_id));
CREATE POLICY "Company owner views reactions on own messages" ON public.whatsapp_message_reactions
  FOR SELECT TO authenticated USING (public.is_company_message_owner(message_id));
CREATE POLICY "Company owner adds reactions on own messages" ON public.whatsapp_message_reactions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_company_message_owner(message_id));
CREATE POLICY "Company owner removes own reactions" ON public.whatsapp_message_reactions
  FOR DELETE TO authenticated USING (user_id = auth.uid() AND public.is_company_message_owner(message_id));