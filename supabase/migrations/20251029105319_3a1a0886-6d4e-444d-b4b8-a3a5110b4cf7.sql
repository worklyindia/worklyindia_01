-- Create RPC function for job location statistics
CREATE OR REPLACE FUNCTION get_job_location_statistics()
RETURNS TABLE (
  country TEXT,
  state TEXT,
  city TEXT,
  total_jobs BIGINT,
  active_jobs BIGINT,
  public_jobs BIGINT,
  draft_jobs BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.country,
    j.state,
    j.city,
    COUNT(*) as total_jobs,
    COUNT(CASE WHEN j.status = 'active' THEN 1 END) as active_jobs,
    COUNT(CASE WHEN j.visibility = 'public' THEN 1 END) as public_jobs,
    COUNT(CASE WHEN j.status = 'draft' THEN 1 END) as draft_jobs
  FROM jobs j
  WHERE j.country IS NOT NULL 
    AND j.state IS NOT NULL 
    AND j.city IS NOT NULL
  GROUP BY j.country, j.state, j.city
  ORDER BY total_jobs DESC;
END;
$$;

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_jobs_location ON jobs(country, state, city);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_visibility ON jobs(visibility);