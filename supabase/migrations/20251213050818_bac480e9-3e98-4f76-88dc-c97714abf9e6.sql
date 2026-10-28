-- Create table to store user resume references linked to Reactive Resume
CREATE TABLE public.user_resumes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  reactive_resume_id TEXT, -- ID from Reactive Resume API
  name TEXT NOT NULL DEFAULT 'Untitled Resume',
  template TEXT DEFAULT 'professional',
  resume_data JSONB, -- Local cache of resume data
  external_api_url TEXT, -- URL of the Reactive Resume instance
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_resumes ENABLE ROW LEVEL SECURITY;

-- Users can only access their own resumes
CREATE POLICY "Users can view their own resumes" 
ON public.user_resumes FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own resumes" 
ON public.user_resumes FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own resumes" 
ON public.user_resumes FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own resumes" 
ON public.user_resumes FOR DELETE 
USING (auth.uid() = user_id);

-- Add index for faster queries
CREATE INDEX idx_user_resumes_user_id ON public.user_resumes(user_id);

-- Trigger for updated_at
CREATE TRIGGER update_user_resumes_updated_at
BEFORE UPDATE ON public.user_resumes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create table to store Reactive Resume API configuration
CREATE TABLE public.reactive_resume_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  api_url TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Allow anyone to read config (it's just the API URL)
ALTER TABLE public.reactive_resume_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read reactive resume config"
ON public.reactive_resume_config FOR SELECT
USING (true);