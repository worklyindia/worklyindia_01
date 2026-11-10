-- Create a settings table for job posting costs
CREATE TABLE IF NOT EXISTS public.job_posting_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  points_required_per_job INTEGER NOT NULL DEFAULT 50,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.job_posting_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for job posting settings
CREATE POLICY "Admins can manage job posting settings" ON public.job_posting_settings
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'owner')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'owner')
    )
  );

-- Insert default setting
INSERT INTO public.job_posting_settings (points_required_per_job) 
VALUES (50) 
ON CONFLICT DO NOTHING;

-- Create edge function for wallet job posting
-- This will handle the wallet deduction when posting jobs