-- Create WhatsApp AI Auto-Reply Settings Table
CREATE TABLE public.whatsapp_ai_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    enabled BOOLEAN NOT NULL DEFAULT true,
    welcome_message TEXT DEFAULT 'नमस्ते! 🙏 मैं Workly India का AI Career Assistant हूं। मैं आपकी job search में मदद कर सकता हूं।',
    business_hours_only BOOLEAN NOT NULL DEFAULT false,
    business_hours_start TIME DEFAULT '09:00:00',
    business_hours_end TIME DEFAULT '21:00:00',
    delay_seconds INTEGER DEFAULT 2 CHECK (delay_seconds >= 0 AND delay_seconds <= 30),
    max_responses_per_day INTEGER DEFAULT 100,
    auto_reply_keywords TEXT[] DEFAULT ARRAY['job', 'naukri', 'work', 'help', 'salary', 'remote', 'Workly India'],
    excluded_keywords TEXT[] DEFAULT ARRAY['stop', 'unsubscribe', 'remove'],
    ai_model TEXT DEFAULT 'gemini-2.0-flash',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_ai_settings ENABLE ROW LEVEL SECURITY;

-- Create policy for admin access
CREATE POLICY "Only admins can manage AI settings" 
ON public.whatsapp_ai_settings 
FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM admin_users 
        WHERE admin_users.user_id = auth.uid()
    )
);

-- Allow edge functions to read settings
CREATE POLICY "Service role can read AI settings" 
ON public.whatsapp_ai_settings 
FOR SELECT 
USING (true);

-- Insert default settings
INSERT INTO public.whatsapp_ai_settings (enabled) VALUES (true);

-- Create trigger for updated_at
CREATE TRIGGER update_whatsapp_ai_settings_updated_at
BEFORE UPDATE ON public.whatsapp_ai_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create table to track AI reply usage per phone number (rate limiting)
CREATE TABLE public.whatsapp_ai_reply_log (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    phone_number TEXT NOT NULL,
    message_id UUID,
    user_message TEXT,
    ai_response TEXT,
    response_time_ms INTEGER,
    tokens_used INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_ai_reply_log ENABLE ROW LEVEL SECURITY;

-- Create policy for admin access
CREATE POLICY "Admins can view AI reply logs" 
ON public.whatsapp_ai_reply_log 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM admin_users 
        WHERE admin_users.user_id = auth.uid()
    )
);

-- Create index for rate limiting queries
CREATE INDEX idx_whatsapp_ai_reply_log_phone_date 
ON public.whatsapp_ai_reply_log (phone_number, created_at DESC);