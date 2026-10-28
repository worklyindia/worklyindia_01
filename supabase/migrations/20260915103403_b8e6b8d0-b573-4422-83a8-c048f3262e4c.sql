
CREATE TABLE IF NOT EXISTS public.expiry_notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  user_id uuid NOT NULL,
  stage text NOT NULL,
  expires_at timestamptz NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS expiry_notification_log_unique
  ON public.expiry_notification_log (entity_type, entity_id, stage, expires_at);
CREATE INDEX IF NOT EXISTS expiry_notification_log_user_idx
  ON public.expiry_notification_log (user_id, sent_at DESC);

GRANT SELECT ON public.expiry_notification_log TO authenticated;
GRANT ALL ON public.expiry_notification_log TO service_role;

ALTER TABLE public.expiry_notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own expiry reminders"
  ON public.expiry_notification_log FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
