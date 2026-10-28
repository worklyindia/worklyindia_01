CREATE TABLE public.social_meta_message_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL,
  owner_id text NOT NULL,
  mid text NOT NULL,
  kind text NOT NULL,
  actor_id text NOT NULL DEFAULT '',
  reply_to_mid text,
  emoji text,
  attachments jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform, mid, kind, actor_id)
);
GRANT ALL ON public.social_meta_message_events TO service_role;
ALTER TABLE public.social_meta_message_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX social_meta_message_events_owner_idx ON public.social_meta_message_events (platform, owner_id, created_at DESC);