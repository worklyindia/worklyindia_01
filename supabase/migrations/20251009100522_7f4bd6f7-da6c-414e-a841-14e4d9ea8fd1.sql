-- Add boost_bonus_applied column to jobs table to track the boost value added to score
ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS boost_bonus_applied INTEGER DEFAULT 0;

-- Update calculate_trending_score function to properly include boost value
CREATE OR REPLACE FUNCTION public.calculate_trending_score(job_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_score numeric;
  boost_bonus numeric;
  final_score numeric;
  job_record RECORD;
BEGIN
  -- Get job details
  SELECT 
    views_count,
    applications_count,
    is_boosted,
    boost_level
  INTO job_record
  FROM public.jobs
  WHERE id = job_id;
  
  -- Calculate base score: (views × 0.10) + (applications × 1.0)
  base_score := (COALESCE(job_record.views_count, 0) * 0.10) + (COALESCE(job_record.applications_count, 0) * 1.0);
  
  -- Add boost bonus if job is boosted
  IF job_record.is_boosted = true AND job_record.boost_level > 0 THEN
    boost_bonus := job_record.boost_level * 1.10;
    final_score := base_score + boost_bonus;
    
    -- Update boost_bonus_applied column
    UPDATE public.jobs 
    SET boost_bonus_applied = boost_bonus::integer
    WHERE id = job_id;
  ELSE
    final_score := base_score;
  END IF;
  
  RETURN final_score;
END;
$$;

-- Update auto_update_trending_score trigger function
CREATE OR REPLACE FUNCTION public.auto_update_trending_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_score numeric;
  boost_bonus numeric;
  final_score numeric;
BEGIN
  -- Calculate base score
  base_score := (COALESCE(NEW.views_count, 0) * 0.10) + (COALESCE(NEW.applications_count, 0) * 1.0);
  
  -- Add boost bonus if job is boosted
  IF NEW.is_boosted = true AND NEW.boost_level > 0 THEN
    boost_bonus := NEW.boost_level * 1.10;
    final_score := base_score + boost_bonus;
    NEW.boost_bonus_applied := boost_bonus::integer;
  ELSE
    final_score := base_score;
    NEW.boost_bonus_applied := 0;
  END IF;
  
  NEW.trending_score := final_score;
  NEW.updated_at := now();
  
  RETURN NEW;
END;
$$;

-- Recreate trigger if it exists
DROP TRIGGER IF EXISTS auto_update_trending_score_trigger ON public.jobs;
CREATE TRIGGER auto_update_trending_score_trigger
  BEFORE INSERT OR UPDATE OF views_count, applications_count, is_boosted, boost_level
  ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_update_trending_score();

-- Update existing boosted jobs to apply the boost bonus
UPDATE public.jobs
SET 
  boost_bonus_applied = (boost_level * 1.10)::integer,
  trending_score = ((COALESCE(views_count, 0) * 0.10) + (COALESCE(applications_count, 0) * 1.0)) + (boost_level * 1.10)
WHERE is_boosted = true AND boost_level > 0;