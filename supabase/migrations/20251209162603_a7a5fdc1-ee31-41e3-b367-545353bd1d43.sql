-- Create AI Data Access Logs table for monitoring AI access to user data
CREATE TABLE public.ai_data_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_type TEXT NOT NULL, -- 'whatsapp_ai' or 'career_chat_ai'
  access_type TEXT NOT NULL, -- 'profile', 'employer', 'applications', 'wallet', 'all', 'website_user'
  user_identifier TEXT NOT NULL, -- phone number OR user_id
  matched_user_id UUID, -- actual user_id found (if any)
  matched_user_name TEXT, -- user's name for display
  matched_user_type TEXT, -- 'website_user', 'employer', or 'both'
  data_accessed JSONB DEFAULT '{}', -- summary of what data was accessed
  request_metadata JSONB DEFAULT '{}', -- additional context
  response_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_data_access_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view logs
CREATE POLICY "Only admins can view ai_data_access_logs" 
ON public.ai_data_access_logs 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM admin_users 
  WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
));

-- Service role can insert logs (from edge functions)
CREATE POLICY "Service role can insert ai_data_access_logs" 
ON public.ai_data_access_logs 
FOR INSERT 
WITH CHECK (true);

-- Create indexes for efficient querying
CREATE INDEX idx_ai_data_access_logs_ai_type ON public.ai_data_access_logs(ai_type);
CREATE INDEX idx_ai_data_access_logs_created_at ON public.ai_data_access_logs(created_at DESC);
CREATE INDEX idx_ai_data_access_logs_user_identifier ON public.ai_data_access_logs(user_identifier);
CREATE INDEX idx_ai_data_access_logs_matched_user_id ON public.ai_data_access_logs(matched_user_id);