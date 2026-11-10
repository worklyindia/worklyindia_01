-- Add boost_bonus_applied column to track the boost value added to score
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS boost_bonus_applied INTEGER DEFAULT 0;

-- Function to calculate trending score for a job
CREATE OR REPLACE FUNCTION calculate_trending_score(job_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  job_record RECORD;
  base_score NUMERIC := 0;
  boost_bonus NUMERIC := 0;
  final_score NUMERIC := 0;
BEGIN
  -- Get job details
  SELECT * INTO job_record FROM jobs WHERE id = job_id;
  
  IF job_record IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Calculate base score: (views × 0.10) + (applications × 1.0)
  base_score := (COALESCE(job_record.views_count, 0) * 0.10) + (COALESCE(job_record.applications_count, 0) * 1.0);
  
  -- Check if boost is active
  IF job_record.is_boosted AND job_record.boost_end_date > NOW() THEN
    -- Active boost: add boost value
    boost_bonus := COALESCE(job_record.boost_level, 0);
  END IF;
  
  -- Final score = BaseScore + BoostValue
  final_score := base_score + boost_bonus;
  
  RETURN final_score;
END;
$$ LANGUAGE plpgsql;

-- Function to expire job boosts and update scores
CREATE OR REPLACE FUNCTION expire_job_boosts()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER := 0;
  job_record RECORD;
BEGIN
  -- Find all jobs with expired boosts
  FOR job_record IN 
    SELECT id, boost_bonus_applied, trending_score
    FROM jobs 
    WHERE is_boosted = true 
    AND boost_end_date <= NOW()
  LOOP
    -- Update job: remove boost
    UPDATE jobs SET
      is_boosted = false,
      boost_level = 0,
      trending_score = calculate_trending_score(job_record.id),
      boost_bonus_applied = 0,
      updated_at = NOW()
    WHERE id = job_record.id;
    
    expired_count := expired_count + 1;
  END LOOP;
  
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update trending_score when views/applications change
CREATE OR REPLACE FUNCTION update_job_trending_score()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalculate trending score
  NEW.trending_score := calculate_trending_score(NEW.id);
  
  -- Track boost bonus applied
  IF NEW.is_boosted AND NEW.boost_end_date > NOW() THEN
    NEW.boost_bonus_applied := COALESCE(NEW.boost_level, 0);
  ELSE
    NEW.boost_bonus_applied := 0;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for trending score updates
DROP TRIGGER IF EXISTS trigger_update_job_trending_score ON jobs;
CREATE TRIGGER trigger_update_job_trending_score
  BEFORE INSERT OR UPDATE OF views_count, applications_count, is_boosted, boost_level, boost_end_date
  ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_job_trending_score();