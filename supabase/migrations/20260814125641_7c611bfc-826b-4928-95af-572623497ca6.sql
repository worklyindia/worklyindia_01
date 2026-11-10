CREATE TABLE public.ai_task_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id text NOT NULL UNIQUE,
  user_id uuid,
  phase text NOT NULL DEFAULT 'started',
  message text NOT NULL DEFAULT '',
  progress integer NOT NULL DEFAULT 0,
  lang text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_task_status_user_created ON public.ai_task_status (user_id, created_at DESC);

GRANT SELECT ON public.ai_task_status TO authenticated;
GRANT ALL ON public.ai_task_status TO service_role;

ALTER TABLE public.ai_task_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own AI task status"
ON public.ai_task_status
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER trg_ai_task_status_updated_at
BEFORE UPDATE ON public.ai_task_status
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.ai_task_status REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_task_status;