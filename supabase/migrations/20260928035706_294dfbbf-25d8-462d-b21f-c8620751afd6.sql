ALTER TABLE public.whatsapp_audience_accounts DROP CONSTRAINT IF EXISTS whatsapp_audience_accounts_audience_check;
ALTER TABLE public.whatsapp_audience_accounts ADD CONSTRAINT whatsapp_audience_accounts_audience_check CHECK (audience IN ('job_seeker','employer','customer_service'));
INSERT INTO public.whatsapp_audience_accounts(audience) VALUES ('customer_service') ON CONFLICT DO NOTHING;