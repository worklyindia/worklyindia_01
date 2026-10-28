-- Create telegram_campaigns table
CREATE TABLE public.telegram_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  message_content TEXT NOT NULL,
  media_url TEXT,
  media_type TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  scheduled_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  total_recipients INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create telegram_audience_segments table
CREATE TABLE public.telegram_audience_segments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  filter_criteria JSONB DEFAULT '{}',
  member_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create telegram_triggers table
CREATE TABLE public.telegram_triggers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL,
  trigger_event TEXT NOT NULL,
  message_template TEXT NOT NULL,
  media_url TEXT,
  is_active BOOLEAN DEFAULT true,
  conditions JSONB DEFAULT '{}',
  execution_count INTEGER DEFAULT 0,
  last_executed_at TIMESTAMP WITH TIME ZONE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create telegram_trigger_logs table
CREATE TABLE public.telegram_trigger_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trigger_id UUID REFERENCES public.telegram_triggers(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL,
  user_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  message_sent TEXT,
  error_message TEXT,
  executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create telegram_message_templates table
CREATE TABLE public.telegram_message_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  content TEXT NOT NULL,
  media_url TEXT,
  media_type TEXT,
  variables JSONB DEFAULT '[]',
  use_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create telegram_analytics table for daily stats
CREATE TABLE public.telegram_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  messages_sent INTEGER DEFAULT 0,
  messages_received INTEGER DEFAULT 0,
  new_conversations INTEGER DEFAULT 0,
  active_users INTEGER DEFAULT 0,
  media_sent INTEGER DEFAULT 0,
  campaign_messages INTEGER DEFAULT 0,
  trigger_messages INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.telegram_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_audience_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_trigger_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_analytics ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for admin access
CREATE POLICY "Admins can manage telegram_campaigns" ON public.telegram_campaigns FOR ALL USING (true);
CREATE POLICY "Admins can manage telegram_audience_segments" ON public.telegram_audience_segments FOR ALL USING (true);
CREATE POLICY "Admins can manage telegram_triggers" ON public.telegram_triggers FOR ALL USING (true);
CREATE POLICY "Admins can manage telegram_trigger_logs" ON public.telegram_trigger_logs FOR ALL USING (true);
CREATE POLICY "Admins can manage telegram_message_templates" ON public.telegram_message_templates FOR ALL USING (true);
CREATE POLICY "Admins can manage telegram_analytics" ON public.telegram_analytics FOR ALL USING (true);

-- Create indexes for better performance
CREATE INDEX idx_telegram_campaigns_status ON public.telegram_campaigns(status);
CREATE INDEX idx_telegram_triggers_active ON public.telegram_triggers(is_active);
CREATE INDEX idx_telegram_trigger_logs_trigger_id ON public.telegram_trigger_logs(trigger_id);
CREATE INDEX idx_telegram_analytics_date ON public.telegram_analytics(date);