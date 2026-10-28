
CREATE TABLE public.resume_drafts (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resume_drafts TO authenticated;
GRANT ALL ON public.resume_drafts TO service_role;
ALTER TABLE public.resume_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own resume draft" ON public.resume_drafts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.cover_letter_drafts (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cover_letter_drafts TO authenticated;
GRANT ALL ON public.cover_letter_drafts TO service_role;
ALTER TABLE public.cover_letter_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own cover letter draft" ON public.cover_letter_drafts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_resume_drafts_updated BEFORE UPDATE ON public.resume_drafts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_cover_letter_drafts_updated BEFORE UPDATE ON public.cover_letter_drafts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
