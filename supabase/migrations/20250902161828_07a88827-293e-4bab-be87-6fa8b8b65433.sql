-- Add unique constraint to prevent duplicate interactions from same user
ALTER TABLE public.job_interactions 
DROP CONSTRAINT IF EXISTS job_interactions_unique_user_job_type;

-- Add unique constraint on (job_id, user_id, interaction_type) where user_id is not null
-- This prevents same user from having multiple view records for same job
ALTER TABLE public.job_interactions 
ADD CONSTRAINT job_interactions_unique_user_job_type 
UNIQUE (job_id, user_id, interaction_type);

-- Create function to get unique view count for a job
CREATE OR REPLACE FUNCTION public.get_unique_view_count(p_job_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  unique_views INTEGER := 0;
BEGIN
  -- Count unique authenticated user views + anonymous views
  SELECT 
    COUNT(DISTINCT COALESCE(user_id::text, id::text)) INTO unique_views
  FROM public.job_interactions 
  WHERE job_id = p_job_id 
    AND interaction_type = 'view';
  
  RETURN COALESCE(unique_views, 0);
END;
$function$;

-- Update calculate_trending_score function to use unique view count
CREATE OR REPLACE FUNCTION public.calculate_trending_score(job_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    job_record RECORD;
    hours_since_posted DECIMAL;
    decay_factor DECIMAL;
    base_score DECIMAL;
    boost_bonus DECIMAL := 0;
    final_score DECIMAL;
    unique_views INTEGER;
BEGIN
    -- Get job data
    SELECT * INTO job_record FROM jobs WHERE id = job_id;
    
    IF job_record.id IS NULL THEN
        RETURN 0;
    END IF;
    
    -- Get unique view count
    SELECT get_unique_view_count(job_id) INTO unique_views;
    
    -- Calculate hours since posted
    hours_since_posted := EXTRACT(EPOCH FROM (NOW() - job_record.created_at)) / 3600;
    
    -- Calculate decay factor (10 points per day)
    decay_factor := (hours_since_posted / 24) * 10;
    
    -- Calculate base score using unique views instead of total views
    base_score := 
        (unique_views * 1) +
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
$function$;