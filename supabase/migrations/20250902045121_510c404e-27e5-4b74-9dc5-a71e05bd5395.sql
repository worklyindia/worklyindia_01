-- Fix function search path security warnings by updating existing functions
CREATE OR REPLACE FUNCTION public.calculate_trending_score(job_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    job_record RECORD;
    hours_since_posted DECIMAL;
    decay_factor DECIMAL;
    base_score DECIMAL;
    boost_bonus DECIMAL := 0;
    final_score DECIMAL;
BEGIN
    -- Get job data
    SELECT * INTO job_record FROM jobs WHERE id = job_id;
    
    IF job_record.id IS NULL THEN
        RETURN 0;
    END IF;
    
    -- Calculate hours since posted
    hours_since_posted := EXTRACT(EPOCH FROM (NOW() - job_record.created_at)) / 3600;
    
    -- Calculate decay factor (10 points per day)
    decay_factor := (hours_since_posted / 24) * 10;
    
    -- Calculate base score using the formula:
    -- score = (views * 1) + (applies * 5) + (calls * 5) + (shares * 3) + (comments * 2)
    base_score := 
        (COALESCE(job_record.views_count, 0) * 1) +
        (COALESCE(job_record.applications_count, 0) * 5) +
        (COALESCE(job_record.calls_count, 0) * 5) +
        (COALESCE(job_record.shares_count, 0) * 3) +
        (COALESCE(job_record.comments_count, 0) * 2);
    
    -- Calculate boost bonus if job is currently boosted
    IF job_record.is_boosted = true 
       AND job_record.boost_start_date <= NOW() 
       AND job_record.boost_end_date >= NOW() THEN
        boost_bonus := COALESCE(job_record.boost_level, 0) * 100;
    END IF;
    
    -- Apply decay
    final_score := base_score + boost_bonus - decay_factor;
    
    -- New job boost (less than 24 hours = minimum 50 points)
    IF hours_since_posted < 24 THEN
        final_score := GREATEST(final_score, 50);
    END IF;
    
    -- Ensure score is not negative
    final_score := GREATEST(final_score, 0);
    
    RETURN final_score;
END;
$$;

CREATE OR REPLACE FUNCTION public.activate_job_boost(p_job_boost_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    boost_record RECORD;
    package_record RECORD;
BEGIN
    -- Get boost record
    SELECT * INTO boost_record FROM job_boosts WHERE id = p_job_boost_id;
    
    IF boost_record.id IS NULL THEN
        RAISE EXCEPTION 'Job boost not found';
    END IF;
    
    -- Get package details
    SELECT * INTO package_record FROM boost_packages WHERE id = boost_record.boost_package_id;
    
    -- Calculate boost dates
    UPDATE job_boosts SET
        boost_start_date = NOW(),
        boost_end_date = NOW() + (package_record.boost_days || ' days')::INTERVAL,
        status = 'active',
        updated_at = NOW()
    WHERE id = p_job_boost_id;
    
    -- Update job with boost details
    UPDATE jobs SET
        boost_start_date = NOW(),
        boost_end_date = NOW() + (package_record.boost_days || ' days')::INTERVAL,
        boost_level = package_record.boost_level,
        is_boosted = true,
        updated_at = NOW()
    WHERE id = boost_record.job_id;
    
    -- Update trending score
    PERFORM update_job_trending_score(boost_record.job_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_job_boosts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    expired_count INTEGER := 0;
    job_record RECORD;
BEGIN
    -- Update expired boosts
    FOR job_record IN 
        SELECT DISTINCT j.id 
        FROM jobs j 
        WHERE j.is_boosted = true 
        AND j.boost_end_date <= NOW()
    LOOP
        -- Remove boost from job
        UPDATE jobs SET
            boost_start_date = NULL,
            boost_end_date = NULL,
            boost_level = 0,
            is_boosted = false,
            updated_at = NOW()
        WHERE id = job_record.id;
        
        -- Update boost records
        UPDATE job_boosts SET
            status = 'expired',
            updated_at = NOW()
        WHERE job_id = job_record.id 
        AND status = 'active';
        
        -- Update trending score
        PERFORM update_job_trending_score(job_record.id);
        
        expired_count := expired_count + 1;
    END LOOP;
    
    RETURN expired_count;
END;
$$;

-- Fix other existing functions
CREATE OR REPLACE FUNCTION public.increment_job_counter(job_id uuid, counter_type text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

CREATE OR REPLACE FUNCTION public.update_job_trending_score(job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

CREATE OR REPLACE FUNCTION public.update_all_trending_scores()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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