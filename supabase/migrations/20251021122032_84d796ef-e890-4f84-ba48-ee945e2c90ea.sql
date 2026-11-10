-- Drop existing function first
DROP FUNCTION IF EXISTS calculate_trending_score() CASCADE;

-- Create function to calculate trending score
CREATE OR REPLACE FUNCTION calculate_trending_score()
RETURNS TRIGGER AS $$
BEGIN
  -- Base Score = (views × 0.10) + (applications × 1.0)
  NEW.trending_score := (COALESCE(NEW.views_count, 0) * 0.10) + (COALESCE(NEW.applications_count, 0) * 1.0);
  
  -- Add boost value if job is boosted
  IF NEW.is_boosted = true AND NEW.boost_level IS NOT NULL THEN
    NEW.trending_score := NEW.trending_score + (NEW.boost_level * 100);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically calculate trending_score
CREATE TRIGGER calculate_trending_score_trigger
  BEFORE INSERT OR UPDATE OF views_count, applications_count, is_boosted, boost_level
  ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION calculate_trending_score();

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_jobs_trending_score 
ON jobs(trending_score DESC) 
WHERE status = 'active' AND visibility = 'public';

CREATE INDEX IF NOT EXISTS idx_jobs_created_at 
ON jobs(created_at DESC) 
WHERE status = 'active';

-- Backfill trending_score for existing jobs
UPDATE jobs SET trending_score = (COALESCE(views_count, 0) * 0.10) + (COALESCE(applications_count, 0) * 1.0) + 
  (CASE WHEN is_boosted = true THEN COALESCE(boost_level, 0) * 100 ELSE 0 END);