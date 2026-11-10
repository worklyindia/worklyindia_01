DROP INDEX IF EXISTS public.idx_whatsapp_conversations_phone;
DROP INDEX IF EXISTS public.whatsapp_conversations_phone_audience_unique;
DROP INDEX IF EXISTS public.idx_whatsapp_conversations_phone_audience;
DROP INDEX IF EXISTS public.idx_whatsapp_conversations_phone_audience_company;
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_conversations_number_scope_unique
ON public.whatsapp_conversations (phone_number, COALESCE(audience, ''), COALESCE(company_id::text, ''), COALESCE(whatsapp_phone_number_id, ''));
-- Unattributed legacy conversations remain separate; ownership is never inferred from recipient phone.