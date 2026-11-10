-- First, let's create the activate_job_boost function properly
CREATE OR REPLACE FUNCTION public.activate_job_boost(p_job_boost_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  boost_record RECORD;
  job_record RECORD;
BEGIN
  -- Get boost details
  SELECT jb.*, bp.boost_days, bp.boost_level
  INTO boost_record
  FROM job_boosts jb
  JOIN boost_packages bp ON bp.id = jb.boost_package_id
  WHERE jb.id = p_job_boost_id
  AND jb.status = 'paid';
  
  IF boost_record.id IS NULL THEN
    RAISE EXCEPTION 'Job boost not found or not in paid status';
  END IF;
  
  -- Get job details to ensure it exists
  SELECT * INTO job_record
  FROM jobs 
  WHERE id = boost_record.job_id;
  
  IF job_record.id IS NULL THEN
    RAISE EXCEPTION 'Job not found';
  END IF;
  
  -- Activate the boost
  UPDATE job_boosts SET
    status = 'active',
    boost_start_date = NOW(),
    boost_end_date = NOW() + (boost_record.boost_days || ' days')::INTERVAL,
    updated_at = NOW()
  WHERE id = p_job_boost_id;
  
  -- Update job with boost information
  UPDATE jobs SET
    is_boosted = true,
    boost_level = boost_record.boost_level,
    boost_end_date = NOW() + (boost_record.boost_days || ' days')::INTERVAL,
    updated_at = NOW()
  WHERE id = boost_record.job_id;
  
  -- Log the activation
  RAISE NOTICE 'Job boost % activated for job %', p_job_boost_id, boost_record.job_id;
END;
$$;