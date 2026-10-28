CREATE TABLE IF NOT EXISTS public.owner_support_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  brand_name TEXT NOT NULL DEFAULT 'Workly India',
  tone TEXT NOT NULL DEFAULT 'friendly',
  language TEXT NOT NULL DEFAULT 'auto',
  business_info TEXT NOT NULL DEFAULT '',
  custom_instructions TEXT NOT NULL DEFAULT '',
  signature TEXT NOT NULL DEFAULT '',
  max_replies_per_run INTEGER NOT NULL DEFAULT 5,
  only_unread BOOLEAN NOT NULL DEFAULT true,
  skip_promotions BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  last_run_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_support_settings TO authenticated;
GRANT ALL ON public.owner_support_settings TO service_role;

ALTER TABLE public.owner_support_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own support desk settings" ON public.owner_support_settings;
CREATE POLICY "Users manage their own support desk settings"
ON public.owner_support_settings FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);