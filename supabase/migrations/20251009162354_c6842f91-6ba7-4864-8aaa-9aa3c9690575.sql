-- Create function to calculate organic score (without boost)
CREATE OR REPLACE FUNCTION calculate_organic_score(
  p_views_count integer,
  p_applications_count integer
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (COALESCE(p_views_count, 0) * 0.10) + (COALESCE(p_applications_count, 0) * 1.0);
$$;

-- Create function to get jobs with organic rankings
CREATE OR REPLACE FUNCTION get_jobs_with_organic_ranks()
RETURNS TABLE (
  job_id uuid,
  views_count integer,
  applications_count integer,
  organic_score numeric,
  organic_rank integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH ranked_jobs AS (
    SELECT 
      j.id,
      COALESCE(j.views_count, 0) as views,
      COALESCE(j.applications_count, 0) as apps,
      calculate_organic_score(j.views_count, j.applications_count) as score,
      ROW_NUMBER() OVER (ORDER BY calculate_organic_score(j.views_count, j.applications_count) DESC) as rank
    FROM jobs j
    WHERE j.status = 'active' AND j.visibility = 'public'
  )
  SELECT 
    ranked_jobs.id::uuid,
    ranked_jobs.views::integer,
    ranked_jobs.apps::integer,
    ranked_jobs.score::numeric,
    ranked_jobs.rank::integer
  FROM ranked_jobs
  ORDER BY ranked_jobs.score DESC;
END;
$$;

-- Add organic_score column to jobs table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'jobs' 
    AND column_name = 'organic_score'
  ) THEN
    ALTER TABLE jobs ADD COLUMN organic_score numeric DEFAULT 0;
  END IF;
END $$;

-- Add organic_rank column to jobs table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'jobs' 
    AND column_name = 'organic_rank'
  ) THEN
    ALTER TABLE jobs ADD COLUMN organic_rank integer;
  END IF;
END $$;

-- Create function to update organic scores and ranks
CREATE OR REPLACE FUNCTION update_organic_scores_and_ranks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update organic_score for all active jobs
  UPDATE jobs
  SET organic_score = calculate_organic_score(views_count, applications_count)
  WHERE status = 'active' AND visibility = 'public';
  
  -- Update organic_rank based on organic_score
  WITH ranked AS (
    SELECT 
      id,
      ROW_NUMBER() OVER (ORDER BY organic_score DESC) as rank
    FROM jobs
    WHERE status = 'active' AND visibility = 'public' AND organic_score > 0
  )
  UPDATE jobs j
  SET organic_rank = ranked.rank
  FROM ranked
  WHERE j.id = ranked.id;
  
  -- Clear ranks for non-qualifying jobs
  UPDATE jobs
  SET organic_rank = NULL
  WHERE (status != 'active' OR visibility != 'public' OR organic_score <= 0);
END;
$$;

-- Create trigger function to update organic score on job changes
CREATE OR REPLACE FUNCTION trigger_update_organic_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Calculate organic score for this job
  NEW.organic_score := calculate_organic_score(NEW.views_count, NEW.applications_count);
  
  -- Schedule async rank recalculation (using pg_notify for performance)
  PERFORM pg_notify('recalculate_organic_ranks', NEW.id::text);
  
  RETURN NEW;
END;
$$;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS update_organic_score_on_job_change ON jobs;
CREATE TRIGGER update_organic_score_on_job_change
  BEFORE UPDATE OF views_count, applications_count ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_organic_score();

-- Initial calculation of all organic scores and ranks
SELECT update_organic_scores_and_ranks();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION calculate_organic_score TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_jobs_with_organic_ranks TO authenticated, anon;
GRANT EXECUTE ON FUNCTION update_organic_scores_and_ranks TO authenticated, anon;