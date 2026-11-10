CREATE TABLE IF NOT EXISTS public.ai_mail_context (
  user_id UUID NOT NULL PRIMARY KEY,
  list_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  pool_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT ALL ON public.ai_mail_context TO service_role;

ALTER TABLE public.ai_mail_context ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own mail context"
ON public.ai_mail_context FOR SELECT TO authenticated
USING (auth.uid() = user_id);