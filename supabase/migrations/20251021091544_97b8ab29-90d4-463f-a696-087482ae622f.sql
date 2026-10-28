-- Recalculate trending_score for all jobs using correct formula
-- Base Score = (views_count × 0.10) + (applications_count × 1.0)
-- Trending Score = Base Score + (boost_level × 100 if is_boosted)

UPDATE jobs
SET trending_score = (
  (COALESCE(views_count, 0) * 0.10) + 
  (COALESCE(applications_count, 0) * 1.0) +
  CASE 
    WHEN is_boosted = true AND boost_end_date > NOW() 
    THEN COALESCE(boost_level, 0) * 100 
    ELSE 0 
  END
);

-- Ensure the trigger function exists and is correct
CREATE OR REPLACE FUNCTION auto_update_trending_score()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate base score from views and applications
  NEW.trending_score := (COALESCE(NEW.views_count, 0) * 0.10) + (COALESCE(NEW.applications_count, 0) * 1.0);
  
  -- Add boost multiplier if boosted and not expired
  IF NEW.is_boosted = true AND NEW.boost_end_date > NOW() THEN
    NEW.trending_score := NEW.trending_score + (COALESCE(NEW.boost_level, 0) * 100);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger to ensure it's active
DROP TRIGGER IF EXISTS trigger_auto_update_trending_score ON jobs;
CREATE TRIGGER trigger_auto_update_trending_score
  BEFORE INSERT OR UPDATE OF views_count, applications_count, is_boosted, boost_level, boost_end_date
  ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION auto_update_trending_score();

-- Add a manual refresh function for admin use
CREATE OR REPLACE FUNCTION recalculate_all_job_scores()
RETURNS void AS $$
BEGIN
  UPDATE jobs
  SET trending_score = (
    (COALESCE(views_count, 0) * 0.10) + 
    (COALESCE(applications_count, 0) * 1.0) +
    CASE 
      WHEN is_boosted = true AND boost_end_date > NOW() 
      THEN COALESCE(boost_level, 0) * 100 
      ELSE 0 
    END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;