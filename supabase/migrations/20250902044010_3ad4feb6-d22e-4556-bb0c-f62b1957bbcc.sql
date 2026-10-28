-- Create database functions for job trending system

-- Function to increment job counters
CREATE OR REPLACE FUNCTION increment_job_counter(job_id UUID, counter_type TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF counter_type = 'views_count' THEN
    UPDATE jobs SET views_count = COALESCE(views_count, 0) + 1 WHERE id = job_id;
  ELSIF counter_type = 'applications_count' THEN
    UPDATE jobs SET applications_count = COALESCE(applications_count, 0) + 1 WHERE id = job_id;
  ELSIF counter_type = 'calls_count' THEN
    UPDATE jobs SET calls_count = COALESCE(calls_count, 0) + 1 WHERE id = job_id;
  ELSIF counter_type = 'shares_count' THEN
    UPDATE jobs SET shares_count = COALESCE(shares_count, 0) + 1 WHERE id = job_id;
  ELSIF counter_type = 'comments_count' THEN
    UPDATE jobs SET comments_count = COALESCE(comments_count, 0) + 1 WHERE id = job_id;
  END IF;
END;
$$;

-- Function to update a single job's trending score
CREATE OR REPLACE FUNCTION update_job_trending_score(job_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_score NUMERIC;
BEGIN
  -- Calculate and update the trending score for this specific job
  SELECT calculate_trending_score(job_id) INTO new_score;
  
  UPDATE jobs 
  SET trending_score = new_score, updated_at = now() 
  WHERE id = job_id;
END;
$$;

-- Function to update all job trending scores (for scheduled updates)
CREATE OR REPLACE FUNCTION update_all_trending_scores()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count INTEGER := 0;
  job_record RECORD;
BEGIN
  -- Update trending scores for all active jobs
  FOR job_record IN 
    SELECT id FROM jobs WHERE status = 'active'
  LOOP
    PERFORM update_job_trending_score(job_record.id);
    updated_count := updated_count + 1;
  END LOOP;
  
  RETURN updated_count;
END;
$$;