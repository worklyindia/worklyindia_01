-- Drop existing calculate_trending_score function if exists
DROP FUNCTION IF EXISTS public.calculate_trending_score(uuid);

-- Create new calculate_trending_score function with simple formula
-- Score = (views_count * 0.10) + (applications_count * 1)
CREATE OR REPLACE FUNCTION public.calculate_trending_score(job_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  score numeric;
  view_count integer;
  app_count integer;
BEGIN
  -- Get current views and applications count
  SELECT 
    COALESCE(views_count, 0),
    COALESCE(applications_count, 0)
  INTO view_count, app_count
  FROM jobs
  WHERE id = job_id;
  
  -- Calculate score: views * 0.10 + applications * 1
  score := (view_count * 0.10) + (app_count * 1.0);
  
  RETURN score;
END;
$$;

-- Create trigger function to auto-update trending score
CREATE OR REPLACE FUNCTION public.auto_update_trending_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_score numeric;
BEGIN
  -- Calculate new score
  new_score := (COALESCE(NEW.views_count, 0) * 0.10) + (COALESCE(NEW.applications_count, 0) * 1.0);
  
  -- Update trending_score
  NEW.trending_score := new_score;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_auto_update_trending_score ON public.jobs;

-- Create trigger to automatically update trending_score when views_count or applications_count changes
CREATE TRIGGER trigger_auto_update_trending_score
BEFORE INSERT OR UPDATE OF views_count, applications_count ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.auto_update_trending_score();

-- Update all existing jobs with the new score calculation
UPDATE public.jobs
SET trending_score = (COALESCE(views_count, 0) * 0.10) + (COALESCE(applications_count, 0) * 1.0)
WHERE trending_score != (COALESCE(views_count, 0) * 0.10) + (COALESCE(applications_count, 0) * 1.0);