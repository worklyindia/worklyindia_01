-- Fix job_applications table - add missing created_at column
ALTER TABLE public.job_applications 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Update existing records that might not have created_at
UPDATE public.job_applications 
SET created_at = applied_at 
WHERE created_at IS NULL;

-- Fix points packages pricing (currently 100x inflated)
UPDATE public.points_packages 
SET price_inr = CASE 
  WHEN name = 'Basic Pack' THEN 100
  WHEN name = 'Value Pack' THEN 240
  WHEN name = 'Popular Pack' THEN 450
  WHEN name = 'Premium Pack' THEN 850
  ELSE price_inr
END
WHERE is_active = true;

-- Create index for better performance on job_applications
CREATE INDEX IF NOT EXISTS idx_job_applications_created_at ON public.job_applications(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_user_status ON public.transactions(user_id, status);

-- Fix function security issues by ensuring proper search path
ALTER FUNCTION public.increment_wallet_points(uuid, integer, integer) SET search_path = 'public';
ALTER FUNCTION public.update_points_balance() SET search_path = 'public';
ALTER FUNCTION public.sync_job_metrics(uuid) SET search_path = 'public';