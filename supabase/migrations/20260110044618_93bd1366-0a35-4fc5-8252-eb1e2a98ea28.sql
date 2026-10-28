-- Create url_clicks table for tracking short URL clicks
CREATE TABLE IF NOT EXISTS public.url_clicks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  short_id TEXT NOT NULL,
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
  clicked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  referrer TEXT,
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_url_clicks_short_id ON public.url_clicks(short_id);
CREATE INDEX IF NOT EXISTS idx_url_clicks_job_id ON public.url_clicks(job_id);
CREATE INDEX IF NOT EXISTS idx_url_clicks_clicked_at ON public.url_clicks(clicked_at);

-- Enable RLS
ALTER TABLE public.url_clicks ENABLE ROW LEVEL SECURITY;

-- Allow edge functions to insert clicks (using service role)
CREATE POLICY "Service role can insert clicks"
ON public.url_clicks
FOR INSERT
WITH CHECK (true);

-- Allow admins to view clicks
CREATE POLICY "Admins can view all clicks"
ON public.url_clicks
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = auth.uid()
  )
);

-- Allow employers to view clicks on their jobs
CREATE POLICY "Employers can view clicks on their jobs"
ON public.url_clicks
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    JOIN public.companies c ON j.company_id = c.id
    WHERE j.id = url_clicks.job_id
    AND c.user_id = auth.uid()
  )
);