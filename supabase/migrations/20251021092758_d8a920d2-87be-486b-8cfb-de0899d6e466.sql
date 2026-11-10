-- Update trending score calculation to use MULTIPLIER instead of addition
-- Trending Score = Base Score × Boost Multiplier

CREATE OR REPLACE FUNCTION auto_update_trending_score()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate base score from views and applications
  DECLARE
    base_score NUMERIC;
    boost_multiplier NUMERIC;
  BEGIN
    base_score := (COALESCE(NEW.views_count, 0) * 0.10) + (COALESCE(NEW.applications_count, 0) * 1.0);
    
    -- Determine boost multiplier (default 1x if not boosted)
    IF NEW.is_boosted = true AND NEW.boost_end_date > NOW() THEN
      boost_multiplier := COALESCE(NEW.boost_level, 1);
    ELSE
      boost_multiplier := 1;
    END IF;
    
    -- Apply multiplier: Trending Score = Base Score × Boost Multiplier
    NEW.trending_score := base_score * boost_multiplier;
    
    RETURN NEW;
  END;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- Recreate trigger
DROP TRIGGER IF EXISTS trigger_auto_update_trending_score ON jobs;
CREATE TRIGGER trigger_auto_update_trending_score
  BEFORE INSERT OR UPDATE OF views_count, applications_count, is_boosted, boost_level, boost_end_date
  ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION auto_update_trending_score();

-- Update recalculation function to use multiplier
CREATE OR REPLACE FUNCTION recalculate_all_job_scores()
RETURNS void AS $$
BEGIN
  UPDATE public.jobs
  SET trending_score = (
    ((COALESCE(views_count, 0) * 0.10) + (COALESCE(applications_count, 0) * 1.0)) *
    CASE 
      WHEN is_boosted = true AND boost_end_date > NOW() 
      THEN COALESCE(boost_level, 1)
      ELSE 1
    END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Recalculate all existing job scores with new multiplier formula
SELECT recalculate_all_job_scores();