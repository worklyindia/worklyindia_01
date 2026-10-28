CREATE TABLE IF NOT EXISTS public.email_lifecycle_templates (
  event_type text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  subject text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  button_text text,
  button_url text DEFAULT '/',
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.email_lifecycle_templates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_lifecycle_templates TO authenticated;
GRANT ALL ON public.email_lifecycle_templates TO service_role;

ALTER TABLE public.email_lifecycle_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view email templates"
  ON public.email_lifecycle_templates FOR SELECT USING (true);

CREATE POLICY "Admins manage email templates"
  ON public.email_lifecycle_templates FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

CREATE TRIGGER update_email_lifecycle_templates_updated_at
  BEFORE UPDATE ON public.email_lifecycle_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();