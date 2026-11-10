-- Update calculate_trending_score to return ONLY base score (no boost)
CREATE OR REPLACE FUNCTION public.calculate_trending_score(job_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  base_score numeric;
BEGIN
  -- Calculate ONLY base score: (views × 0.10) + (applications × 1.0)
  -- NO boost bonus included
  SELECT 
    (COALESCE(views_count, 0) * 0.10) + (COALESCE(applications_count, 0) * 1.0)
  INTO base_score
  FROM public.jobs
  WHERE id = job_id;
  
  RETURN base_score;
END;
$$;

-- Update trigger function to calculate pure base score
CREATE OR REPLACE FUNCTION public.auto_update_trending_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Calculate ONLY base score, ignore boost
  NEW.trending_score := (COALESCE(NEW.views_count, 0) * 0.10) + 
                        (COALESCE(NEW.applications_count, 0) * 1.0);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Update all existing jobs to have pure base scores
UPDATE public.jobs
SET trending_score = (COALESCE(views_count, 0) * 0.10) + 
                     (COALESCE(applications_count, 0) * 1.0),
    boost_bonus_applied = 0
WHERE status = 'active';