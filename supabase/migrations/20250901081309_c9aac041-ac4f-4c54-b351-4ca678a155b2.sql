
-- Create table for job posting payments
CREATE TABLE public.job_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
  points_spent INTEGER NOT NULL,
  payment_type TEXT NOT NULL, -- 'job_posting', 'featured_listing', 'boost', etc.
  description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for job_payments
ALTER TABLE public.job_payments ENABLE ROW LEVEL SECURITY;

-- Create policies for job_payments
CREATE POLICY "Users can view their own job payments" 
  ON public.job_payments 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own job payments" 
  ON public.job_payments 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Create table for employer metrics
CREATE TABLE public.employer_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  active_jobs_count INTEGER NOT NULL DEFAULT 0,
  total_applications INTEGER NOT NULL DEFAULT 0,
  monthly_spent_points INTEGER NOT NULL DEFAULT 0,
  total_spent_points INTEGER NOT NULL DEFAULT 0,
  successful_hires INTEGER NOT NULL DEFAULT 0,
  current_month INTEGER NOT NULL DEFAULT EXTRACT(MONTH FROM now()),
  current_year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM now()),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, current_month, current_year)
);

-- Enable RLS for employer_metrics
ALTER TABLE public.employer_metrics ENABLE ROW LEVEL SECURITY;

-- Create policies for employer_metrics
CREATE POLICY "Users can view their own metrics" 
  ON public.employer_metrics 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own metrics" 
  ON public.employer_metrics 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own metrics" 
  ON public.employer_metrics 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- Function to update employer metrics
CREATE OR REPLACE FUNCTION public.update_employer_metrics()
RETURNS TRIGGER AS $$
BEGIN
  -- Update or insert employer metrics
  INSERT INTO public.employer_metrics (
    user_id, 
    active_jobs_count, 
    total_applications,
    monthly_spent_points,
    total_spent_points,
    current_month,
    current_year
  )
  SELECT 
    c.user_id,
    COALESCE(active_jobs.count, 0) as active_jobs_count,
    COALESCE(total_apps.count, 0) as total_applications,
    COALESCE(monthly_spent.points, 0) as monthly_spent_points,
    COALESCE(total_spent.points, 0) as total_spent_points,
    EXTRACT(MONTH FROM now()) as current_month,
    EXTRACT(YEAR FROM now()) as current_year
  FROM public.companies c
  LEFT JOIN (
    SELECT company_id, COUNT(*) as count
    FROM public.jobs 
    WHERE status = 'active'
    GROUP BY company_id
  ) active_jobs ON c.id = active_jobs.company_id
  LEFT JOIN (
    SELECT j.company_id, COUNT(*) as count
    FROM public.job_applications ja
    JOIN public.jobs j ON ja.job_id = j.id
    GROUP BY j.company_id
  ) total_apps ON c.id = total_apps.company_id
  LEFT JOIN (
    SELECT user_id, COALESCE(SUM(points_spent), 0) as points
    FROM public.job_payments
    WHERE EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM now())
    AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM now())
    GROUP BY user_id
  ) monthly_spent ON c.user_id = monthly_spent.user_id
  LEFT JOIN (
    SELECT user_id, COALESCE(SUM(points_spent), 0) as points
    FROM public.job_payments
    GROUP BY user_id
  ) total_spent ON c.user_id = total_spent.user_id
  WHERE c.user_id = COALESCE(NEW.user_id, OLD.user_id)
  ON CONFLICT (user_id, current_month, current_year)
  DO UPDATE SET
    active_jobs_count = EXCLUDED.active_jobs_count,
    total_applications = EXCLUDED.total_applications,
    monthly_spent_points = EXCLUDED.monthly_spent_points,
    total_spent_points = EXCLUDED.total_spent_points,
    updated_at = now();

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers to update metrics
CREATE TRIGGER update_metrics_on_job_payment
  AFTER INSERT OR UPDATE OR DELETE ON public.job_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_employer_metrics();

CREATE TRIGGER update_metrics_on_job_change
  AFTER INSERT OR UPDATE OR DELETE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_employer_metrics();

CREATE TRIGGER update_metrics_on_application
  AFTER INSERT OR UPDATE OR DELETE ON public.job_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_employer_metrics();
