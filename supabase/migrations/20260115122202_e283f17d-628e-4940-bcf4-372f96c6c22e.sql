-- =============================================
-- GOOGLE INDEXING SYSTEM - FIX (Part 2)
-- Drop and recreate function with new signature
-- =============================================

-- Drop the existing function first
DROP FUNCTION IF EXISTS get_jobs_due_for_verification(integer);

-- Recreate with updated logic
CREATE OR REPLACE FUNCTION get_jobs_due_for_verification(p_limit INTEGER DEFAULT 20)
RETURNS TABLE (
  id uuid,
  job_id uuid,
  url text,
  google_status text,
  verification_attempt_count integer,
  max_verification_attempts integer,
  google_submitted_at timestamptz,
  next_verification_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    jis.id,
    jis.job_id,
    jis.url,
    jis.google_status,
    COALESCE(jis.verification_attempt_count, 0) as verification_attempt_count,
    COALESCE(jis.max_verification_attempts, 5) as max_verification_attempts,
    jis.google_submitted_at,
    jis.next_verification_at
  FROM job_indexing_status jis
  WHERE jis.google_status IN ('submitted', 'scheduled')
    AND jis.is_google_public = false
    AND COALESCE(jis.verification_attempt_count, 0) < COALESCE(jis.max_verification_attempts, 5)
    AND (
      -- Check if 24 hours have passed since last verification
      jis.next_verification_at IS NULL 
      OR jis.next_verification_at <= NOW()
    )
    AND (
      -- Only check if at least 24 hours since submission
      jis.google_submitted_at IS NULL 
      OR jis.google_submitted_at <= NOW() - INTERVAL '24 hours'
    )
  ORDER BY jis.google_submitted_at ASC NULLS LAST
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create function to get user's pending job status with expected date
CREATE OR REPLACE FUNCTION get_job_indexing_status_for_user(p_job_id uuid)
RETURNS TABLE (
  job_id uuid,
  google_status text,
  bing_status text,
  is_google_public boolean,
  is_bing_public boolean,
  expected_index_date date,
  queue_position bigint,
  estimated_days_remaining integer
) AS $$
DECLARE
  v_queue_pos BIGINT;
  v_expected_date DATE;
  v_jobs_ahead INTEGER;
  v_daily_limit INTEGER := 200;
  v_estimated_days INTEGER;
BEGIN
  -- Get queue position
  SELECT gq.queue_position, gq.queue_date INTO v_queue_pos, v_expected_date
  FROM google_indexing_queue gq
  WHERE gq.job_id = p_job_id
    AND gq.status = 'pending'
  LIMIT 1;
  
  IF v_queue_pos IS NOT NULL THEN
    -- Count jobs ahead
    SELECT COUNT(*) INTO v_jobs_ahead
    FROM google_indexing_queue
    WHERE status = 'pending'
      AND queue_position < v_queue_pos;
    
    v_estimated_days := CEIL(v_jobs_ahead::numeric / v_daily_limit);
  ELSE
    v_estimated_days := 0;
  END IF;
  
  RETURN QUERY
  SELECT 
    jis.job_id,
    jis.google_status,
    jis.bing_status,
    jis.is_google_public,
    jis.is_bing_public,
    COALESCE(v_expected_date, CURRENT_DATE) as expected_index_date,
    v_queue_pos as queue_position,
    v_estimated_days as estimated_days_remaining
  FROM job_indexing_status jis
  WHERE jis.job_id = p_job_id
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Recalculate all queue dates now
SELECT recalculate_all_queue_dates();