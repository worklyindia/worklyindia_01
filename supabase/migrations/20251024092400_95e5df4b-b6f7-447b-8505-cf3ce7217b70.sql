-- Create job_alert_preferences table
CREATE TABLE IF NOT EXISTS public.job_alert_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  phone TEXT,
  job_categories TEXT[] DEFAULT '{}',
  locations TEXT[] DEFAULT '{}',
  experience_levels TEXT[] DEFAULT '{}',
  salary_ranges TEXT[] DEFAULT '{}',
  email_alerts BOOLEAN DEFAULT true,
  sms_alerts BOOLEAN DEFAULT false,
  push_notifications BOOLEAN DEFAULT true,
  instant_alerts BOOLEAN DEFAULT false,
  daily_digest BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.job_alert_preferences ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own job alerts" 
ON public.job_alert_preferences 
FOR SELECT 
USING (auth.uid() = user_id OR email = auth.jwt()->>'email');

CREATE POLICY "Users can create their own job alerts" 
ON public.job_alert_preferences 
FOR INSERT 
WITH CHECK (auth.uid() = user_id OR auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own job alerts" 
ON public.job_alert_preferences 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own job alerts" 
ON public.job_alert_preferences 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_job_alert_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_job_alert_preferences_updated_at
BEFORE UPDATE ON public.job_alert_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_job_alert_preferences_updated_at();

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_job_alert_preferences_user_id ON public.job_alert_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_job_alert_preferences_email ON public.job_alert_preferences(email);
CREATE INDEX IF NOT EXISTS idx_job_alert_preferences_is_active ON public.job_alert_preferences(is_active);