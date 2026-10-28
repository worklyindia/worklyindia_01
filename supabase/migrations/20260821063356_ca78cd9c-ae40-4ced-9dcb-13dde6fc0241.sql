CREATE TABLE IF NOT EXISTS public.mail_attachment_links (
  key text PRIMARY KEY,
  user_id uuid NOT NULL,
  storage_path text NOT NULL,
  filename text NOT NULL,
  mime_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.mail_attachment_links TO service_role;
ALTER TABLE public.mail_attachment_links ENABLE ROW LEVEL SECURITY;