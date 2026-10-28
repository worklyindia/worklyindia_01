CREATE TABLE IF NOT EXISTS public.notification_dedupe (
  dedupe_key text PRIMARY KEY,
  user_id uuid,
  channel text NOT NULL,
  template_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_dedupe_created_at ON public.notification_dedupe (created_at);

GRANT ALL ON public.notification_dedupe TO service_role;
ALTER TABLE public.notification_dedupe ENABLE ROW LEVEL SECURITY;