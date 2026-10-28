-- Function to get user profile views (total and last 30 days)
CREATE OR REPLACE FUNCTION public.get_user_profile_views_with_period(p_user_id uuid)
RETURNS TABLE(
  total_views bigint,
  views_last_30_days bigint,
  views_today bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    -- Total profile views
    COUNT(*)::bigint AS total_views,
    -- Views in last 30 days
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::bigint AS views_last_30_days,
    -- Views today
    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::bigint AS views_today
  FROM job_interactions
  WHERE interaction_type = 'profile_view'
    AND metadata->>'profile_user_id' = p_user_id::text;
END;
$$;

-- Function to calculate user response rate correctly
CREATE OR REPLACE FUNCTION public.get_user_application_response_rate(p_user_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  total_applications integer;
  responded_applications integer;
  response_rate numeric;
BEGIN
  -- Get total applications
  SELECT COUNT(*) INTO total_applications
  FROM job_applications
  WHERE user_id = p_user_id;
  
  -- Get applications that received a response (reviewed, shortlisted, interview_scheduled, hired, rejected)
  SELECT COUNT(*) INTO responded_applications
  FROM job_applications
  WHERE user_id = p_user_id
    AND status IN ('reviewed', 'shortlisted', 'interview_scheduled', 'hired', 'rejected');
  
  -- Calculate response rate
  IF total_applications > 0 THEN
    response_rate := ROUND((responded_applications::numeric / total_applications::numeric) * 100, 1);
  ELSE
    response_rate := 0;
  END IF;
  
  RETURN COALESCE(response_rate, 0);
END;
$$;

-- Update log_profile_view function to ensure it tracks correctly
CREATE OR REPLACE FUNCTION public.log_profile_view(
  p_profile_user_id uuid,
  p_viewer_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Insert a profile view interaction
  INSERT INTO job_interactions (
    job_id,
    user_id,
    interaction_type,
    metadata,
    created_at
  ) VALUES (
    NULL,  -- No specific job for profile views
    p_viewer_id,
    'profile_view',
    jsonb_build_object(
      'profile_user_id', p_profile_user_id::text,
      'viewer_id', p_viewer_id::text,
      'viewed_at', NOW()
    ),
    NOW()
  );
END;
$$;