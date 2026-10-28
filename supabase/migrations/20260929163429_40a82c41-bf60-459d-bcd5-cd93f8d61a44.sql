CREATE TABLE public.social_meta_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  platform text NOT NULL,
  page_id text NOT NULL,
  ig_user_id text,
  name text,
  username text,
  picture_url text,
  status text NOT NULL DEFAULT 'connected',
  ai_reply_comments boolean NOT NULL DEFAULT true,
  ai_reply_messages boolean NOT NULL DEFAULT true,
  ai_tone text DEFAULT 'friendly',
  ai_language text DEFAULT 'auto',
  ai_reply_length text DEFAULT 'short',
  ai_business_info text,
  ai_custom_instructions text,
  ai_signature text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, platform)
);
CREATE INDEX social_meta_accounts_page_idx ON public.social_meta_accounts(page_id);
CREATE INDEX social_meta_accounts_ig_idx ON public.social_meta_accounts(ig_user_id);
GRANT SELECT, UPDATE, DELETE ON public.social_meta_accounts TO authenticated;
GRANT ALL ON public.social_meta_accounts TO service_role;
ALTER TABLE public.social_meta_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own meta accounts" ON public.social_meta_accounts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own meta accounts" ON public.social_meta_accounts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own meta accounts" ON public.social_meta_accounts FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.social_meta_tokens (
  account_id uuid PRIMARY KEY REFERENCES public.social_meta_accounts(id) ON DELETE CASCADE,
  page_access_token text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.social_meta_tokens TO service_role;
ALTER TABLE public.social_meta_tokens ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.social_meta_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.social_meta_accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  platform text NOT NULL,
  kind text NOT NULL,
  event_id text NOT NULL UNIQUE,
  sender_id text,
  incoming_text text,
  reply_text text,
  status text NOT NULL DEFAULT 'sent',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX social_meta_replies_user_idx ON public.social_meta_replies(user_id, created_at DESC);
GRANT SELECT ON public.social_meta_replies TO authenticated;
GRANT ALL ON public.social_meta_replies TO service_role;
ALTER TABLE public.social_meta_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own meta replies" ON public.social_meta_replies FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.social_meta_touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER social_meta_accounts_updated BEFORE UPDATE ON public.social_meta_accounts FOR EACH ROW EXECUTE FUNCTION public.social_meta_touch_updated_at();