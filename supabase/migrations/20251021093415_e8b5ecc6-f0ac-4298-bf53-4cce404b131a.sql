-- Update trending score calculation to use ADDITION instead of multiplication
-- Trending Score = Base Score + Boost Value
-- Boost values: 1x=+100, 2x=+200, 3x=+300, 4x=+400, 5x=+500

CREATE OR REPLACE FUNCTION auto_update_trending_score()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate base score from views and applications
  DECLARE
    base_score NUMERIC;
    boost_value NUMERIC;
  BEGIN
    base_score := (COALESCE(NEW.views_count, 0) * 0.10) + (COALESCE(NEW.applications_count, 0) * 1.0);
    
    -- Determine boost value (0 if not boosted)
    IF NEW.is_boosted = true AND NEW.boost_end_date > NOW() THEN
      boost_value := COALESCE(NEW.boost_level, 1) * 100;
    ELSE
      boost_value := 0;
    END IF;
    
    -- Apply boost: Trending Score = Base Score + Boost Value
    NEW.trending_score := base_score + boost_value;
    
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

-- Update recalculation function to use addition
CREATE OR REPLACE FUNCTION recalculate_all_job_scores()
RETURNS void AS $$
BEGIN
  UPDATE public.jobs
  SET trending_score = (
    ((COALESCE(views_count, 0) * 0.10) + (COALESCE(applications_count, 0) * 1.0)) +
    CASE 
      WHEN is_boosted = true AND boost_end_date > NOW() 
      THEN COALESCE(boost_level, 1) * 100
      ELSE 0
    END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Recalculate all existing job scores with new addition formula
SELECT recalculate_all_job_scores();