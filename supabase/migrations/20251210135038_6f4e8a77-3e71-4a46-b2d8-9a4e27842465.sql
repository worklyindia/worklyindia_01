-- Create WhatsApp trigger logs table for delivery tracking
CREATE TABLE public.whatsapp_trigger_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trigger_event TEXT NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('user', 'employer')),
  recipient_phone TEXT NOT NULL,
  recipient_name TEXT,
  recipient_user_id UUID,
  template_name TEXT NOT NULL,
  template_variables JSONB,
  
  -- Delivery tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'skipped')),
  msg91_request_id TEXT,
  msg91_response JSONB,
  error_message TEXT,
  error_code TEXT,
  
  -- 24h window tracking
  has_active_session BOOLEAN DEFAULT false,
  session_check_result JSONB,
  delivery_channel TEXT DEFAULT 'whatsapp' CHECK (delivery_channel IN ('whatsapp', 'sms', 'skipped')),
  
  -- Metadata
  triggered_by TEXT, -- 'auto', 'manual_test', 'system'
  trigger_source TEXT, -- page/component that triggered
  metadata JSONB,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for efficient querying
CREATE INDEX idx_trigger_logs_event ON public.whatsapp_trigger_logs(trigger_event);
CREATE INDEX idx_trigger_logs_status ON public.whatsapp_trigger_logs(status);
CREATE INDEX idx_trigger_logs_recipient ON public.whatsapp_trigger_logs(recipient_phone);
CREATE INDEX idx_trigger_logs_user_id ON public.whatsapp_trigger_logs(recipient_user_id);
CREATE INDEX idx_trigger_logs_created ON public.whatsapp_trigger_logs(created_at DESC);
CREATE INDEX idx_trigger_logs_template ON public.whatsapp_trigger_logs(template_name);

-- Enable RLS
ALTER TABLE public.whatsapp_trigger_logs ENABLE ROW LEVEL SECURITY;

-- Policy for admin access only
CREATE POLICY "Only admins can view trigger logs"
ON public.whatsapp_trigger_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE admin_users.user_id = auth.uid()
  )
);

-- Policy for edge functions to insert logs (using service role)
CREATE POLICY "Service role can insert trigger logs"
ON public.whatsapp_trigger_logs
FOR INSERT
WITH CHECK (true);

-- Policy for edge functions to update logs
CREATE POLICY "Service role can update trigger logs"
ON public.whatsapp_trigger_logs
FOR UPDATE
USING (true);

-- Create user session tracking table for 24h window
CREATE TABLE public.whatsapp_user_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL,
  user_id UUID,
  last_interaction_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  interaction_type TEXT NOT NULL, -- 'otp_sent', 'otp_verified', 'message_sent', 'user_initiated'
  session_expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '24 hours'),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for quick session lookup
CREATE INDEX idx_user_sessions_phone ON public.whatsapp_user_sessions(phone_number);
CREATE INDEX idx_user_sessions_expires ON public.whatsapp_user_sessions(session_expires_at);
CREATE INDEX idx_user_sessions_user ON public.whatsapp_user_sessions(user_id);

-- Enable RLS
ALTER TABLE public.whatsapp_user_sessions ENABLE ROW LEVEL SECURITY;

-- Service role policies for sessions
CREATE POLICY "Service role can manage sessions"
ON public.whatsapp_user_sessions
FOR ALL
USING (true)
WITH CHECK (true);

-- Function to check if user has active 24h session
CREATE OR REPLACE FUNCTION public.check_whatsapp_session(p_phone TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.whatsapp_user_sessions
    WHERE phone_number = p_phone
    AND session_expires_at > now()
  );
END;
$$;

-- Function to update/create session on interaction
CREATE OR REPLACE FUNCTION public.update_whatsapp_session(
  p_phone TEXT,
  p_user_id UUID DEFAULT NULL,
  p_interaction_type TEXT DEFAULT 'message_sent'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.whatsapp_user_sessions (phone_number, user_id, interaction_type, last_interaction_at, session_expires_at)
  VALUES (p_phone, p_user_id, p_interaction_type, now(), now() + interval '24 hours')
  ON CONFLICT (phone_number) 
  DO UPDATE SET 
    last_interaction_at = now(),
    session_expires_at = now() + interval '24 hours',
    interaction_type = p_interaction_type,
    user_id = COALESCE(EXCLUDED.user_id, whatsapp_user_sessions.user_id),
    updated_at = now();
END;
$$;

-- Add unique constraint on phone for upsert
ALTER TABLE public.whatsapp_user_sessions ADD CONSTRAINT unique_phone_session UNIQUE (phone_number);

-- Cleanup old sessions (can be run periodically)
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.whatsapp_user_sessions
  WHERE session_expires_at < now() - interval '7 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;