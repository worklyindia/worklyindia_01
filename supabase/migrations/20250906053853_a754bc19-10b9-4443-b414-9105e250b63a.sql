-- Create employer_settings table for employer preferences
CREATE TABLE public.employer_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  
  -- Notification preferences
  new_applications BOOLEAN NOT NULL DEFAULT true,
  interview_reminders BOOLEAN NOT NULL DEFAULT true,
  weekly_reports BOOLEAN NOT NULL DEFAULT true,
  job_expiry_alerts BOOLEAN NOT NULL DEFAULT true,
  boost_notifications BOOLEAN NOT NULL DEFAULT true,
  email_notifications BOOLEAN NOT NULL DEFAULT true,
  push_notifications BOOLEAN NOT NULL DEFAULT true,
  sms_notifications BOOLEAN NOT NULL DEFAULT false,
  
  -- Privacy settings
  company_visibility BOOLEAN NOT NULL DEFAULT true,
  contact_visibility BOOLEAN NOT NULL DEFAULT true,
  job_posting_visibility BOOLEAN NOT NULL DEFAULT true,
  logo_visibility BOOLEAN NOT NULL DEFAULT true,
  show_in_directory BOOLEAN NOT NULL DEFAULT true,
  allow_direct_contact BOOLEAN NOT NULL DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.employer_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for employer settings
CREATE POLICY "Users can view their own employer settings" 
ON public.employer_settings 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own employer settings" 
ON public.employer_settings 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own employer settings" 
ON public.employer_settings 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_employer_settings_updated_at
BEFORE UPDATE ON public.employer_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create unique constraint to ensure one settings record per user
ALTER TABLE public.employer_settings 
ADD CONSTRAINT unique_user_employer_settings 
UNIQUE (user_id);