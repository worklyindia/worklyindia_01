CREATE TABLE public.developer_oauth_apps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id text NOT NULL UNIQUE,
  client_name text NOT NULL,
  redirect_uris text[] NOT NULL DEFAULT '{}',
  client_type text NOT NULL DEFAULT 'confidential',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.developer_oauth_apps TO authenticated;
GRANT ALL ON public.developer_oauth_apps TO service_role;
ALTER TABLE public.developer_oauth_apps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own apps select" ON public.developer_oauth_apps FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own apps insert" ON public.developer_oauth_apps FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own apps delete" ON public.developer_oauth_apps FOR DELETE TO authenticated USING (auth.uid() = user_id);