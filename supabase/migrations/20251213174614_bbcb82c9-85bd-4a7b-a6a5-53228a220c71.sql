-- Create telegram_quick_replies table (similar to whatsapp_quick_replies)
CREATE TABLE IF NOT EXISTS public.telegram_quick_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_keywords TEXT[] NOT NULL,
  response_hindi TEXT NOT NULL,
  response_english TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  priority INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  use_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create telegram_human_handoff table
CREATE TABLE IF NOT EXISTS public.telegram_human_handoff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id BIGINT NOT NULL,
  username TEXT,
  reason TEXT,
  resolved BOOLEAN DEFAULT false,
  resolved_by UUID,
  resolved_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create telegram_ai_reply_log table
CREATE TABLE IF NOT EXISTS public.telegram_ai_reply_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id BIGINT NOT NULL,
  username TEXT,
  message_id BIGINT,
  user_message TEXT NOT NULL,
  ai_response TEXT NOT NULL,
  response_time_ms INTEGER,
  tokens_used INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create telegram_response_cache table
CREATE TABLE IF NOT EXISTS public.telegram_response_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_hash TEXT UNIQUE NOT NULL,
  normalized_message TEXT,
  ai_response TEXT NOT NULL,
  use_count INTEGER DEFAULT 1,
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create telegram_ai_settings table
CREATE TABLE IF NOT EXISTS public.telegram_ai_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled BOOLEAN DEFAULT true,
  max_responses_per_day INTEGER DEFAULT 100,
  delay_seconds INTEGER DEFAULT 0,
  business_hours_only BOOLEAN DEFAULT false,
  business_hours_start TIME DEFAULT '09:00:00',
  business_hours_end TIME DEFAULT '21:00:00',
  blacklisted_chat_ids BIGINT[] DEFAULT '{}',
  excluded_keywords TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert default AI settings if not exists
INSERT INTO public.telegram_ai_settings (id, enabled) 
VALUES (gen_random_uuid(), true)
ON CONFLICT DO NOTHING;

-- Copy quick replies from WhatsApp to Telegram (if any exist)
INSERT INTO public.telegram_quick_replies (trigger_keywords, response_hindi, response_english, category, priority, enabled)
SELECT trigger_keywords, response_hindi, response_english, category, priority, enabled
FROM public.whatsapp_quick_replies
WHERE NOT EXISTS (SELECT 1 FROM public.telegram_quick_replies LIMIT 1);

-- Enable RLS
ALTER TABLE public.telegram_quick_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_human_handoff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_ai_reply_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_response_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_ai_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for telegram_quick_replies
CREATE POLICY "Admins can manage telegram quick replies" ON public.telegram_quick_replies
FOR ALL USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND role IN ('admin', 'owner')));

CREATE POLICY "Public can view enabled quick replies" ON public.telegram_quick_replies
FOR SELECT USING (enabled = true);

-- RLS Policies for telegram_human_handoff
CREATE POLICY "Admins can manage telegram handoff" ON public.telegram_human_handoff
FOR ALL USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND role IN ('admin', 'owner')));

-- RLS Policies for telegram_ai_reply_log
CREATE POLICY "Admins can view telegram ai logs" ON public.telegram_ai_reply_log
FOR SELECT USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND role IN ('admin', 'owner')));

CREATE POLICY "Service can insert telegram ai logs" ON public.telegram_ai_reply_log
FOR INSERT WITH CHECK (true);

-- RLS Policies for telegram_response_cache
CREATE POLICY "Service can manage telegram cache" ON public.telegram_response_cache
FOR ALL USING (true) WITH CHECK (true);

-- RLS Policies for telegram_ai_settings
CREATE POLICY "Admins can manage telegram ai settings" ON public.telegram_ai_settings
FOR ALL USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND role IN ('admin', 'owner')));

CREATE POLICY "Authenticated can view telegram ai settings" ON public.telegram_ai_settings
FOR SELECT USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_telegram_handoff_chat_id ON public.telegram_human_handoff(chat_id);
CREATE INDEX IF NOT EXISTS idx_telegram_ai_log_chat_id ON public.telegram_ai_reply_log(chat_id);
CREATE INDEX IF NOT EXISTS idx_telegram_ai_log_created ON public.telegram_ai_reply_log(created_at);
CREATE INDEX IF NOT EXISTS idx_telegram_cache_hash ON public.telegram_response_cache(message_hash);