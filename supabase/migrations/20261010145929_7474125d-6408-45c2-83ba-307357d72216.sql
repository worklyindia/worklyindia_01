CREATE TABLE public.chat_widgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  public_id text NOT NULL UNIQUE DEFAULT ('wcw_' || replace(gen_random_uuid()::text,'-','')),
  title text NOT NULL DEFAULT 'Chat with us',
  welcome_message text NOT NULL DEFAULT 'Hi! How can we help you today?',
  color text NOT NULL DEFAULT '#2563eb',
  position text NOT NULL DEFAULT 'right',
  ai_enabled boolean NOT NULL DEFAULT true,
  business_info text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_widgets TO authenticated;
GRANT ALL ON public.chat_widgets TO service_role;
ALTER TABLE public.chat_widgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their widget" ON public.chat_widgets FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.chat_widget_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_id uuid NOT NULL REFERENCES public.chat_widgets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  visitor_token text NOT NULL,
  page_url text,
  ai_paused boolean NOT NULL DEFAULT false,
  last_message text,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  unread_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (widget_id, visitor_token)
);
GRANT SELECT, UPDATE, DELETE ON public.chat_widget_conversations TO authenticated;
GRANT ALL ON public.chat_widget_conversations TO service_role;
ALTER TABLE public.chat_widget_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read conversations" ON public.chat_widget_conversations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Owners update conversations" ON public.chat_widget_conversations FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners delete conversations" ON public.chat_widget_conversations FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.chat_widget_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_widget_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  sender text NOT NULL CHECK (sender IN ('visitor','ai','agent')),
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.chat_widget_messages (conversation_id, created_at);
GRANT SELECT ON public.chat_widget_messages TO authenticated;
GRANT ALL ON public.chat_widget_messages TO service_role;
ALTER TABLE public.chat_widget_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read messages" ON public.chat_widget_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_widget_messages;