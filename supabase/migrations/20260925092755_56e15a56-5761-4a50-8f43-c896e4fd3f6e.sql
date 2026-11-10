ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS audience text,
  ADD COLUMN IF NOT EXISTS whatsapp_phone_number_id text;

ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS audience text,
  ADD COLUMN IF NOT EXISTS whatsapp_phone_number_id text;

ALTER TABLE public.whatsapp_audience_tokens
  ADD COLUMN IF NOT EXISTS token_type text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_messages_wamid_unique
  ON public.whatsapp_messages (msg91_message_id)
  WHERE msg91_message_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_conversations_phone_audience_unique
  ON public.whatsapp_conversations (phone_number, audience)
  WHERE audience IS NOT NULL;

CREATE INDEX IF NOT EXISTS whatsapp_conversations_phone_number_id_idx
  ON public.whatsapp_conversations (whatsapp_phone_number_id);

CREATE INDEX IF NOT EXISTS whatsapp_messages_audience_idx
  ON public.whatsapp_messages (audience, created_at DESC);