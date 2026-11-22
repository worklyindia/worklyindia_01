-- Separate ChatWork release channel. Workly India Android releases remain untouched.
CREATE TABLE IF NOT EXISTS public.chatwork_app_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_code bigint NOT NULL UNIQUE CHECK (version_code > 0),
  version_name text NOT NULL,
  apk_path text NOT NULL,
  apk_size_bytes bigint NOT NULL CHECK (apk_size_bytes > 0),
  release_notes text NOT NULL DEFAULT '',
  min_supported_version_code bigint NOT NULL DEFAULT 1,
  published_at timestamptz,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chatwork_app_releases_public_version_idx
  ON public.chatwork_app_releases (is_published, version_code DESC);

ALTER TABLE public.chatwork_app_releases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.chatwork_app_releases FROM anon, authenticated, service_role;
GRANT SELECT ON TABLE public.chatwork_app_releases TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.chatwork_app_releases TO authenticated;
GRANT ALL ON TABLE public.chatwork_app_releases TO service_role;

CREATE POLICY "Public can read published ChatWork releases"
  ON public.chatwork_app_releases FOR SELECT TO anon, authenticated
  USING (is_published = true OR public.has_role(auth.uid(), 'owner'::public.app_role));

CREATE POLICY "Owners manage ChatWork releases"
  ON public.chatwork_app_releases FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'owner'::public.app_role));
