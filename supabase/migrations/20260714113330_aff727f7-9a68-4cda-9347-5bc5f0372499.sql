CREATE TABLE public.external_job_shortlinks (
  short_id text PRIMARY KEY,
  source text NOT NULL,
  ext_id text NOT NULL,
  payload jsonb NOT NULL,
  click_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX external_job_shortlinks_source_ext_id_key
  ON public.external_job_shortlinks (source, ext_id);

GRANT SELECT ON public.external_job_shortlinks TO anon, authenticated;
GRANT ALL ON public.external_job_shortlinks TO service_role;

ALTER TABLE public.external_job_shortlinks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "external_job_shortlinks_public_read"
  ON public.external_job_shortlinks
  FOR SELECT
  USING (true);