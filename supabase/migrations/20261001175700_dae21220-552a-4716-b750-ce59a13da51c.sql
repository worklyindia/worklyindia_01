CREATE TABLE IF NOT EXISTS public.email_api_inbox_state (
  user_id uuid PRIMARY KEY,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.email_api_inbox_state TO service_role;
ALTER TABLE public.email_api_inbox_state ENABLE ROW LEVEL SECURITY;