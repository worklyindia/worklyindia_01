ALTER TABLE public.employer_whatsapp_accounts ADD COLUMN IF NOT EXISTS referred_by_developer uuid;
CREATE INDEX IF NOT EXISTS idx_ewa_referred_dev ON public.employer_whatsapp_accounts(referred_by_developer);
CREATE POLICY "Developers view referred whatsapp connections" ON public.employer_whatsapp_accounts FOR SELECT TO authenticated USING (referred_by_developer = auth.uid());
CREATE OR REPLACE FUNCTION public.developer_referred_whatsapp_users()
RETURNS TABLE(company_id uuid, company_name text, website text, company_email text, company_phone text, full_name text, email text, phone text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.company_name, c.website, c.email, c.phone, p.full_name, p.email, p.phone
  FROM public.companies c LEFT JOIN public.profiles p ON p.id = c.user_id
  WHERE c.id IN (SELECT a.company_id FROM public.employer_whatsapp_accounts a WHERE a.referred_by_developer = auth.uid())
$$;
GRANT EXECUTE ON FUNCTION public.developer_referred_whatsapp_users() TO authenticated;