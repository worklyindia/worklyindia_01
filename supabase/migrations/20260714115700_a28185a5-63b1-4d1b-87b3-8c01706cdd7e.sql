
CREATE TABLE public.telegram_channel_external_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL,
  ext_id TEXT NOT NULL,
  title TEXT,
  company TEXT,
  channel_message_id BIGINT,
  posted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT telegram_channel_external_log_source_ext_id_key UNIQUE (source, ext_id)
);

CREATE INDEX idx_tg_ch_ext_log_posted_at ON public.telegram_channel_external_log (posted_at DESC);

GRANT ALL ON public.telegram_channel_external_log TO service_role;

ALTER TABLE public.telegram_channel_external_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view external channel log"
ON public.telegram_channel_external_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
