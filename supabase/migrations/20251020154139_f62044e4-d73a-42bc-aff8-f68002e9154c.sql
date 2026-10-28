-- Fix boost calculation formula from * 1.10 to * 100
-- This migration updates the boost calculation to use the correct multiplier

-- Drop existing function to recreate with correct formula
DROP FUNCTION IF EXISTS public.calculate_trending_score();

-- Recreate calculate_trending_score with correct boost multiplier (* 100 instead of * 1.10)
CREATE OR REPLACE FUNCTION public.calculate_trending_score()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  job_record RECORD;
  base_score NUMERIC;
  boost_bonus NUMERIC;
  final_score NUMERIC;
BEGIN
  FOR job_record IN
    SELECT id, views_count, applications_count, is_boosted, boost_level
    FROM public.jobs
    WHERE status = 'active'
  LOOP
    -- Base Score = (views × 0.10) + (applications × 1.0)
    base_score := (COALESCE(job_record.views_count, 0) * 0.10) + (COALESCE(job_record.applications_count, 0) * 1.0);
    
    -- Boost bonus: boost_level × 100 (1x = +100, 2x = +200, etc.)
    IF job_record.is_boosted AND job_record.boost_level > 0 THEN
      boost_bonus := job_record.boost_level * 100;
    ELSE
      boost_bonus := 0;
    END IF;
    
    -- Final Score = Base Score + Boost Bonus
    final_score := base_score + boost_bonus;
    
    -- Update the job with new scores
    UPDATE public.jobs
    SET 
      trending_score = final_score,
      boost_bonus_applied = boost_bonus
    WHERE id = job_record.id;
  END LOOP;
END;
$$;

-- Drop and recreate the trigger function with correct formula
DROP FUNCTION IF EXISTS public.auto_update_trending_score() CASCADE;

CREATE OR REPLACE FUNCTION public.auto_update_trending_score()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  base_score NUMERIC;
  boost_bonus NUMERIC;
BEGIN
  -- Base Score = (views × 0.10) + (applications × 1.0)
  base_score := (COALESCE(NEW.views_count, 0) * 0.10) + (COALESCE(NEW.applications_count, 0) * 1.0);
  
  -- Boost bonus: boost_level × 100 (1x = +100, 2x = +200, etc.)
  IF NEW.is_boosted AND NEW.boost_level > 0 THEN
    boost_bonus := NEW.boost_level * 100;
  ELSE
    boost_bonus := 0;
  END IF;
  
  -- Final Score = Base Score + Boost Bonus
  NEW.trending_score := base_score + boost_bonus;
  NEW.boost_bonus_applied := boost_bonus;
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS trigger_auto_update_trending_score ON public.jobs;

CREATE TRIGGER trigger_auto_update_trending_score
  BEFORE INSERT OR UPDATE OF views_count, applications_count, is_boosted, boost_level
  ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_update_trending_score();

-- Recalculate all existing jobs with the correct formula
UPDATE public.jobs
SET 
  boost_bonus_applied = CASE 
    WHEN is_boosted AND boost_level > 0 THEN (boost_level * 100)
    ELSE 0
  END,
  trending_score = (
    (COALESCE(views_count, 0) * 0.10) + 
    (COALESCE(applications_count, 0) * 1.0) + 
    CASE 
      WHEN is_boosted AND boost_level > 0 THEN (boost_level * 100)
      ELSE 0
    END
  )
WHERE status = 'active';

-- Log the migration
DO $$
BEGIN
  RAISE NOTICE 'Boost calculation formula updated: boost_level × 100 (was × 1.10)';
  RAISE NOTICE 'All active jobs recalculated with correct formula';
END $$;