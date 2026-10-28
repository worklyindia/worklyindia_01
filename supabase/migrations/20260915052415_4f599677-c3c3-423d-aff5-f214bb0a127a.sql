CREATE TABLE IF NOT EXISTS public.push_lifecycle_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL UNIQUE CHECK (event_type IN ('subscribe','unsubscribe')),
  enabled boolean NOT NULL DEFAULT true,
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  button_text text DEFAULT '',
  button_url text DEFAULT '/',
  image_url text,
  icon_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT ON public.push_lifecycle_templates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_lifecycle_templates TO authenticated;
GRANT ALL ON public.push_lifecycle_templates TO service_role;

ALTER TABLE public.push_lifecycle_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view push lifecycle templates"
  ON public.push_lifecycle_templates FOR SELECT USING (true);

CREATE POLICY "Admins manage push lifecycle templates"
  ON public.push_lifecycle_templates FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

CREATE TRIGGER update_push_lifecycle_templates_updated_at
  BEFORE UPDATE ON public.push_lifecycle_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.push_lifecycle_templates (event_type, title, body, button_text, button_url)
VALUES
  ('subscribe', 'Welcome to Workly India 🎉', 'Notifications on ho gayi! Ab naye jobs sabse pehle aapko milenge.', 'Browse Jobs', '/jobs'),
  ('unsubscribe', 'Notifications band ho gayi 😔', 'Aap ab job alerts miss karenge. Kabhi bhi dobara on kar sakte hain.', 'Turn back on', '/notifications')
ON CONFLICT (event_type) DO NOTHING;