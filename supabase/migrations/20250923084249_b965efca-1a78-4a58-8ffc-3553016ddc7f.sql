-- Step 1: Data Cleanup - Fix inconsistent boost statuses
-- First, let's create a function to clean up expired boosts and inconsistent data

CREATE OR REPLACE FUNCTION expire_job_boosts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  expired_count INTEGER := 0;
BEGIN
  -- Mark expired job boosts as expired
  UPDATE job_boosts 
  SET status = 'expired', updated_at = now()
  WHERE status = 'active' 
    AND boost_end_date <= now();
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  
  -- Update jobs table to remove boost flags for expired boosts
  UPDATE jobs 
  SET 
    is_boosted = false,
    boost_level = 0,
    boost_end_date = null,
    updated_at = now()
  WHERE is_boosted = true 
    AND (boost_end_date <= now() OR boost_end_date IS NULL);
  
  -- Fix orphaned boost records (jobs marked as boosted but no active boost record)
  UPDATE jobs 
  SET 
    is_boosted = false,
    boost_level = 0,
    boost_end_date = null,
    updated_at = now()
  WHERE is_boosted = true 
    AND NOT EXISTS (
      SELECT 1 FROM job_boosts jb 
      WHERE jb.job_id = jobs.id 
        AND jb.status IN ('active', 'completed', 'paid')
        AND (jb.boost_end_date IS NULL OR jb.boost_end_date > now())
    );
  
  RETURN expired_count;
END;
$$;

-- Step 2: Improve activate_job_boost function with better validation
CREATE OR REPLACE FUNCTION activate_job_boost(p_job_boost_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  boost_record RECORD;
  package_record RECORD;
  job_record RECORD;
BEGIN
  -- Get boost record with job and package details
  SELECT jb.*, bp.boost_days, bp.boost_level, j.id as job_id, j.title
  INTO boost_record
  FROM job_boosts jb
  JOIN boost_packages bp ON bp.id = jb.boost_package_id
  JOIN jobs j ON j.id = jb.job_id
  WHERE jb.id = p_job_boost_id;
  
  IF boost_record.id IS NULL THEN
    RAISE EXCEPTION 'Job boost record not found';
  END IF;
  
  -- Check if job is already boosted by another active boost
  IF EXISTS (
    SELECT 1 FROM job_boosts jb2
    WHERE jb2.job_id = boost_record.job_id 
      AND jb2.status = 'active'
      AND jb2.id != p_job_boost_id
      AND (jb2.boost_end_date IS NULL OR jb2.boost_end_date > now())
  ) THEN
    RAISE EXCEPTION 'Job is already boosted by another active boost';
  END IF;
  
  -- Calculate boost end date
  UPDATE job_boosts 
  SET 
    status = 'active',
    boost_start_date = now(),
    boost_end_date = now() + (boost_record.boost_days || ' days')::INTERVAL,
    updated_at = now()
  WHERE id = p_job_boost_id;
  
  -- Update job table
  UPDATE jobs 
  SET 
    is_boosted = true,
    boost_level = boost_record.boost_level,
    boost_end_date = now() + (boost_record.boost_days || ' days')::INTERVAL,
    updated_at = now()
  WHERE id = boost_record.job_id;
  
  -- Log the activation
  RAISE NOTICE 'Job boost activated: job_id=%, boost_id=%, days=%', 
    boost_record.job_id, p_job_boost_id, boost_record.boost_days;
END;
$$;

-- Step 3: Add function to check active boost status
CREATE OR REPLACE FUNCTION check_job_boost_status(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  result jsonb;
  job_boosted boolean;
  active_boost_count integer;
  boost_end_date timestamp with time zone;
BEGIN
  -- Get job boost status
  SELECT j.is_boosted, j.boost_end_date
  INTO job_boosted, boost_end_date
  FROM jobs j
  WHERE j.id = p_job_id;
  
  -- Count active boosts
  SELECT COUNT(*)
  INTO active_boost_count
  FROM job_boosts jb
  WHERE jb.job_id = p_job_id 
    AND jb.status = 'active'
    AND (jb.boost_end_date IS NULL OR jb.boost_end_date > now());
  
  -- Return comprehensive status
  result := jsonb_build_object(
    'job_id', p_job_id,
    'is_boosted', job_boosted,
    'boost_end_date', boost_end_date,
    'active_boost_count', active_boost_count,
    'has_expired_boost', (job_boosted AND boost_end_date <= now()),
    'has_orphaned_boost', (job_boosted AND active_boost_count = 0),
    'can_boost', (NOT job_boosted OR active_boost_count = 0 OR boost_end_date <= now())
  );
  
  RETURN result;
END;
$$;

-- Step 4: Run initial cleanup
SELECT expire_job_boosts();