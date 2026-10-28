ALTER TABLE public.employer_whatsapp_accounts DROP CONSTRAINT IF EXISTS employer_whatsapp_accounts_company_id_key;
ALTER TABLE public.employer_whatsapp_accounts ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;
UPDATE public.employer_whatsapp_accounts SET is_default = true;
CREATE UNIQUE INDEX IF NOT EXISTS employer_whatsapp_accounts_company_phone_key ON public.employer_whatsapp_accounts (company_id, phone_number_id);

ALTER TABLE public.employer_whatsapp_tokens ADD COLUMN IF NOT EXISTS phone_number_id text NOT NULL DEFAULT '';
UPDATE public.employer_whatsapp_tokens t SET phone_number_id = coalesce(a.phone_number_id,'')
  FROM public.employer_whatsapp_accounts a WHERE a.company_id = t.company_id;
ALTER TABLE public.employer_whatsapp_tokens DROP CONSTRAINT employer_whatsapp_tokens_pkey;
ALTER TABLE public.employer_whatsapp_tokens ADD PRIMARY KEY (company_id, phone_number_id);