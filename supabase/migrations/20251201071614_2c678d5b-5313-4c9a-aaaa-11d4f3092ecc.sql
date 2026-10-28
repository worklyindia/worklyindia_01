-- Create whatsapp_messages table for MSG91 WhatsApp integration
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_phone TEXT NOT NULL,
  recipient_name TEXT,
  recipient_type TEXT DEFAULT 'jobseeker', -- 'jobseeker', 'employer', 'custom'
  recipient_user_id UUID REFERENCES auth.users(id),
  template_name TEXT NOT NULL,
  template_variables JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'read', 'failed'
  msg91_message_id TEXT,
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  delivered_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_status ON public.whatsapp_messages(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_sent_at ON public.whatsapp_messages(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_recipient_phone ON public.whatsapp_messages(recipient_phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_template_name ON public.whatsapp_messages(template_name);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_recipient_user_id ON public.whatsapp_messages(recipient_user_id);

-- Enable Row Level Security
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- Create policy for admin access only
CREATE POLICY "Only admins can view whatsapp messages" 
ON public.whatsapp_messages 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = auth.uid() 
    AND admin_users.role IN ('admin', 'owner')
  )
);

CREATE POLICY "Only admins can insert whatsapp messages" 
ON public.whatsapp_messages 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = auth.uid() 
    AND admin_users.role IN ('admin', 'owner')
  )
);

CREATE POLICY "Only admins can update whatsapp messages" 
ON public.whatsapp_messages 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = auth.uid() 
    AND admin_users.role IN ('admin', 'owner')
  )
);

-- Create whatsapp_templates table for template management
CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  category TEXT DEFAULT 'utility', -- 'utility', 'marketing', 'authentication'
  language TEXT DEFAULT 'en',
  content_preview TEXT,
  variables TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  msg91_template_id TEXT,
  total_sent INTEGER DEFAULT 0,
  total_delivered INTEGER DEFAULT 0,
  total_read INTEGER DEFAULT 0,
  total_failed INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for templates
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view whatsapp templates" 
ON public.whatsapp_templates 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = auth.uid() 
    AND admin_users.role IN ('admin', 'owner')
  )
);

CREATE POLICY "Only admins can manage whatsapp templates" 
ON public.whatsapp_templates 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = auth.uid() 
    AND admin_users.role IN ('admin', 'owner')
  )
);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_whatsapp_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_whatsapp_messages_timestamp
BEFORE UPDATE ON public.whatsapp_messages
FOR EACH ROW
EXECUTE FUNCTION update_whatsapp_messages_updated_at();

CREATE TRIGGER update_whatsapp_templates_timestamp
BEFORE UPDATE ON public.whatsapp_templates
FOR EACH ROW
EXECUTE FUNCTION update_whatsapp_messages_updated_at();

-- Insert some default templates (user can customize)
INSERT INTO public.whatsapp_templates (name, display_name, category, content_preview, variables) VALUES
('job_alert', 'Job Alert Notification', 'utility', 'New job matching your profile: {{job_title}} at {{company_name}}', ARRAY['job_title', 'company_name', 'location', 'salary']),
('application_status', 'Application Status Update', 'utility', 'Your application for {{job_title}} has been {{status}}', ARRAY['job_title', 'company_name', 'status']),
('interview_reminder', 'Interview Reminder', 'utility', 'Reminder: Interview for {{job_title}} at {{company_name}} on {{date}} at {{time}}', ARRAY['job_title', 'company_name', 'date', 'time']),
('welcome_employer', 'Welcome Employer', 'utility', 'Welcome to Workly India! Start posting jobs and find the best talent.', ARRAY['company_name']),
('welcome_jobseeker', 'Welcome Job Seeker', 'utility', 'Welcome to Workly India! Find your dream work-from-home job today.', ARRAY['name'])
ON CONFLICT (name) DO NOTHING;