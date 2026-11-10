-- Fix Trending Score Calculation Bug
-- This migration cleans up conflicting triggers and recalculates all scores correctly

-- Step 1: Drop all redundant/conflicting trending score triggers
DROP TRIGGER IF EXISTS trigger_auto_update_trending_score ON public.jobs;
DROP TRIGGER IF EXISTS trigger_update_job_trending_score ON public.jobs;
DROP TRIGGER IF EXISTS calculate_trending_score_trigger ON public.jobs;

-- Step 2: Drop the incorrect standalone function (if exists)
DROP FUNCTION IF EXISTS public.calculate_trending_score(uuid);
DROP FUNCTION IF EXISTS public.update_job_trending_score();
DROP FUNCTION IF EXISTS public.auto_update_trending_score();

-- Step 3: Create ONE master trigger function with correct formula
CREATE OR REPLACE FUNCTION public.calculate_job_trending_score()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  base_score NUMERIC;
  boost_value NUMERIC;
BEGIN
  -- Calculate base score: (views × 0.10) + (applications × 1.0)
  base_score := (COALESCE(NEW.views_count, 0) * 0.10) + (COALESCE(NEW.applications_count, 0) * 1.0);
  
  -- Calculate boost value: boost_level × 100 (only if boosted and not expired)
  IF NEW.is_boosted = true AND (NEW.boost_end_date IS NULL OR NEW.boost_end_date > NOW()) THEN
    boost_value := COALESCE(NEW.boost_level, 0) * 100;
  ELSE
    boost_value := 0;
  END IF;
  
  -- Final trending score = base score + boost value
  NEW.trending_score := base_score + boost_value;
  
  RETURN NEW;
END;
$$;

-- Step 4: Create ONE master trigger
CREATE TRIGGER calculate_trending_score_on_change
  BEFORE INSERT OR UPDATE OF views_count, applications_count, is_boosted, boost_level, boost_end_date
  ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_job_trending_score();

-- Step 5: Recalculate all existing trending scores for active jobs
UPDATE public.jobs
SET trending_score = (
  -- Base score
  (COALESCE(views_count, 0) * 0.10) + (COALESCE(applications_count, 0) * 1.0) +
  -- Boost value (only if boosted and not expired)
  CASE 
    WHEN is_boosted = true AND (boost_end_date IS NULL OR boost_end_date > NOW()) 
    THEN COALESCE(boost_level, 0) * 100
    ELSE 0
  END
)
WHERE status = 'active' AND visibility = 'public';

-- Step 6: Add index for better performance on trending_score ordering
CREATE INDEX IF NOT EXISTS idx_jobs_trending_score ON public.jobs(trending_score DESC) WHERE status = 'active' AND visibility = 'public';