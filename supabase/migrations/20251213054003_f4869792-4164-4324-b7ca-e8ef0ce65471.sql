-- Telegram Bot Settings
CREATE TABLE public.telegram_bot_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_username TEXT,
  bot_name TEXT,
  webhook_url TEXT,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Telegram Conversations
CREATE TABLE public.telegram_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id BIGINT NOT NULL UNIQUE,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  chat_type TEXT DEFAULT 'private',
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_message_preview TEXT,
  unread_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  linked_user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Telegram Messages
CREATE TABLE public.telegram_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES public.telegram_conversations(id) ON DELETE CASCADE,
  telegram_message_id BIGINT,
  chat_id BIGINT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'outgoing',
  message_content TEXT,
  message_type TEXT DEFAULT 'text',
  status TEXT DEFAULT 'sent',
  metadata JSONB,
  is_starred BOOLEAN DEFAULT false,
  reply_to_message_id UUID,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Telegram Templates (Quick Replies)
CREATE TABLE public.telegram_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.telegram_bot_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Admin access)
CREATE POLICY "Admin full access to telegram_bot_settings" 
ON public.telegram_bot_settings FOR ALL 
USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));

CREATE POLICY "Admin full access to telegram_conversations" 
ON public.telegram_conversations FOR ALL 
USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));

CREATE POLICY "Admin full access to telegram_messages" 
ON public.telegram_messages FOR ALL 
USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));

CREATE POLICY "Admin full access to telegram_templates" 
ON public.telegram_templates FOR ALL 
USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));

-- Indexes for performance
CREATE INDEX idx_telegram_conversations_chat_id ON public.telegram_conversations(chat_id);
CREATE INDEX idx_telegram_messages_conversation_id ON public.telegram_messages(conversation_id);
CREATE INDEX idx_telegram_messages_chat_id ON public.telegram_messages(chat_id);
CREATE INDEX idx_telegram_messages_sent_at ON public.telegram_messages(sent_at DESC);

-- Trigger for updated_at
CREATE TRIGGER update_telegram_bot_settings_updated_at
BEFORE UPDATE ON public.telegram_bot_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_telegram_conversations_updated_at
BEFORE UPDATE ON public.telegram_conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_telegram_templates_updated_at
BEFORE UPDATE ON public.telegram_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();