CREATE OR REPLACE FUNCTION public.is_company_owner(_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.companies WHERE id = _company_id AND user_id = auth.uid())
$$;

CREATE TABLE public.employer_whatsapp_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  waba_id text,
  phone_number_id text,
  display_phone text,
  verified_name text,
  business_name text,
  quality_rating text,
  status text NOT NULL DEFAULT 'disconnected',
  connected_via text,
  connected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.employer_whatsapp_accounts TO authenticated;
GRANT ALL ON public.employer_whatsapp_accounts TO service_role;
ALTER TABLE public.employer_whatsapp_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company owner views own WhatsApp account" ON public.employer_whatsapp_accounts
  FOR SELECT TO authenticated USING (public.is_company_owner(company_id));
CREATE UNIQUE INDEX employer_whatsapp_connected_phone_unique ON public.employer_whatsapp_accounts(phone_number_id)
  WHERE status = 'connected' AND phone_number_id IS NOT NULL;

CREATE TABLE public.employer_whatsapp_tokens (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  token_type text,
  expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.employer_whatsapp_tokens TO service_role;
ALTER TABLE public.employer_whatsapp_tokens ENABLE ROW LEVEL SECURITY;

-- A phone number may be connected in only one place (owner audiences or one employer)
CREATE OR REPLACE FUNCTION public.check_whatsapp_phone_unique()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'connected' AND NEW.phone_number_id IS NOT NULL THEN
    IF TG_TABLE_NAME = 'employer_whatsapp_accounts' THEN
      IF EXISTS (SELECT 1 FROM whatsapp_audience_accounts WHERE status='connected' AND phone_number_id = NEW.phone_number_id) THEN
        RAISE EXCEPTION 'This WhatsApp number is already connected elsewhere';
      END IF;
    ELSE
      IF EXISTS (SELECT 1 FROM employer_whatsapp_accounts WHERE status='connected' AND phone_number_id = NEW.phone_number_id) THEN
        RAISE EXCEPTION 'This WhatsApp number is already connected by an employer';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER employer_whatsapp_phone_unique BEFORE INSERT OR UPDATE ON public.employer_whatsapp_accounts
  FOR EACH ROW EXECUTE FUNCTION public.check_whatsapp_phone_unique();
CREATE TRIGGER audience_whatsapp_phone_unique BEFORE INSERT OR UPDATE ON public.whatsapp_audience_accounts
  FOR EACH ROW EXECUTE FUNCTION public.check_whatsapp_phone_unique();

ALTER TABLE public.whatsapp_conversations ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_company ON public.whatsapp_conversations(company_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_company ON public.whatsapp_messages(company_id);

DROP INDEX IF EXISTS public.idx_whatsapp_conversations_phone_audience;
CREATE UNIQUE INDEX idx_whatsapp_conversations_phone_audience_company
  ON public.whatsapp_conversations(phone_number, COALESCE(audience, ''), COALESCE(company_id::text, ''));

CREATE POLICY "Company owner views own WhatsApp conversations" ON public.whatsapp_conversations
  FOR SELECT TO authenticated USING (company_id IS NOT NULL AND public.is_company_owner(company_id));
CREATE POLICY "Company owner updates own WhatsApp conversations" ON public.whatsapp_conversations
  FOR UPDATE TO authenticated USING (company_id IS NOT NULL AND public.is_company_owner(company_id))
  WITH CHECK (company_id IS NOT NULL AND public.is_company_owner(company_id));
CREATE POLICY "Company owner views own WhatsApp messages" ON public.whatsapp_messages
  FOR SELECT TO authenticated USING (company_id IS NOT NULL AND public.is_company_owner(company_id));

CREATE TRIGGER update_employer_whatsapp_accounts_updated_at BEFORE UPDATE ON public.employer_whatsapp_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();