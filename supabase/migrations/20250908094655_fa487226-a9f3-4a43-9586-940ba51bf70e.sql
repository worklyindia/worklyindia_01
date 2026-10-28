-- Create function to log profile views when employers view applicant profiles
CREATE OR REPLACE FUNCTION public.log_profile_view(p_profile_user_id uuid, p_viewer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    -- Only log if viewer is different from profile owner
    IF p_viewer_id != p_profile_user_id THEN
        -- Check if view already exists today to avoid spam
        IF NOT EXISTS (
            SELECT 1 FROM job_interactions 
            WHERE user_id = p_viewer_id 
            AND interaction_type = 'profile_view'
            AND metadata->>'profile_user_id' = p_profile_user_id::text
            AND created_at >= CURRENT_DATE
        ) THEN
            -- Insert profile view interaction
            INSERT INTO job_interactions (
                job_id, 
                user_id, 
                interaction_type, 
                metadata
            ) VALUES (
                NULL, -- No specific job for profile views
                p_viewer_id,
                'profile_view',
                jsonb_build_object(
                    'profile_user_id', p_profile_user_id,
                    'timestamp', NOW(),
                    'view_type', 'applicant_profile'
                )
            );
        END IF;
    END IF;
END;
$function$;

-- Create function to get user profile views count
CREATE OR REPLACE FUNCTION public.get_user_profile_views(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    profile_views INTEGER := 0;
BEGIN
    -- Count unique profile views for this user
    SELECT COUNT(DISTINCT user_id) INTO profile_views
    FROM job_interactions 
    WHERE interaction_type = 'profile_view'
    AND metadata->>'profile_user_id' = p_user_id::text;
    
    RETURN COALESCE(profile_views, 0);
END;
$function$;

-- Create function to calculate application response rate
CREATE OR REPLACE FUNCTION public.get_user_response_rate(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    total_applications INTEGER := 0;
    responded_applications INTEGER := 0;
    response_rate INTEGER := 0;
BEGIN
    -- Count total applications by user
    SELECT COUNT(*) INTO total_applications
    FROM job_applications 
    WHERE user_id = p_user_id;
    
    -- Count applications that got employer response (status changed from 'applied')
    SELECT COUNT(*) INTO responded_applications
    FROM job_applications 
    WHERE user_id = p_user_id 
    AND status != 'applied'
    AND reviewed_at IS NOT NULL;
    
    -- Calculate response rate percentage
    IF total_applications > 0 THEN
        response_rate := ROUND((responded_applications::DECIMAL / total_applications::DECIMAL) * 100);
    END IF;
    
    RETURN COALESCE(response_rate, 0);
END;
$function$;