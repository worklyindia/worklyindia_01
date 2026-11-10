CREATE TABLE public.developer_chat_widgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  widget_id text NOT NULL UNIQUE,
  pin_hash text,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.developer_chat_widgets TO service_role;
ALTER TABLE public.developer_chat_widgets ENABLE ROW LEVEL SECURITY;