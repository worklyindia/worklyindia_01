CREATE TABLE IF NOT EXISTS public.telegram_lifecycle_templates (
  event_type text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  button_text text,
  button_url text DEFAULT '/',
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.telegram_lifecycle_templates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_lifecycle_templates TO authenticated;
GRANT ALL ON public.telegram_lifecycle_templates TO service_role;

ALTER TABLE public.telegram_lifecycle_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view telegram lifecycle templates"
ON public.telegram_lifecycle_templates FOR SELECT USING (true);

CREATE POLICY "Admins manage telegram lifecycle templates"
ON public.telegram_lifecycle_templates FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

CREATE TRIGGER update_telegram_lifecycle_templates_updated_at
BEFORE UPDATE ON public.telegram_lifecycle_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();