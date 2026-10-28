-- Create a function to log profile views for the tracking functionality
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
  -- Insert profile view record
  INSERT INTO profile_views (
    profile_user_id,
    viewer_id,
    viewed_at
  ) VALUES (
    p_profile_user_id,
    p_viewer_id,
    NOW()
  )
  ON CONFLICT (profile_user_id, viewer_id, DATE(viewed_at)) 
  DO UPDATE SET viewed_at = NOW();
  
  -- Update profile views count
  UPDATE profiles 
  SET profile_views_count = COALESCE(profile_views_count, 0) + 1
  WHERE user_id = p_profile_user_id;
END;
$$;