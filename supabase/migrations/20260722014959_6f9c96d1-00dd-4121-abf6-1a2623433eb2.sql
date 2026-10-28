CREATE TABLE IF NOT EXISTS public.browser_login_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_type text NOT NULL CHECK (user_type IN ('job_seeker','employer')),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '60 days'),
  last_used_at timestamptz,
  revoked_at timestamptz,
  user_agent text,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.browser_login_tokens TO service_role;

ALTER TABLE public.browser_login_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own browser tokens"
  ON public.browser_login_tokens
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_browser_login_tokens_user
  ON public.browser_login_tokens(user_id, user_type)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_browser_login_tokens_hash
  ON public.browser_login_tokens(token_hash)
  WHERE revoked_at IS NULL;

CREATE OR REPLACE FUNCTION public.tg_browser_login_tokens_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS browser_login_tokens_updated_at ON public.browser_login_tokens;
CREATE TRIGGER browser_login_tokens_updated_at
BEFORE UPDATE ON public.browser_login_tokens
FOR EACH ROW EXECUTE FUNCTION public.tg_browser_login_tokens_updated_at();