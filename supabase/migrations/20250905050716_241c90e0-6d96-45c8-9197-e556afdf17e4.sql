-- Recreate the RPC function with proper grants and error handling
DROP FUNCTION IF EXISTS public.get_job_applicants_with_emails(uuid);

CREATE OR REPLACE FUNCTION public.get_job_applicants_with_emails(p_job_id uuid)
 RETURNS TABLE(
   application_id uuid, 
   job_id uuid, 
   user_id uuid, 
   applied_at timestamp with time zone, 
   status text, 
   cover_letter text, 
   resume_url text, 
   reviewed_at timestamp with time zone, 
   email text, 
   full_name text, 
   phone text, 
   location text, 
   current_position text, 
   company text, 
   skills text[], 
   profile_image_url text, 
   bio text, 
   education text, 
   experience_years integer, 
   experience_level integer, 
   preferred_location text, 
   job_type text, 
   industry text, 
   whatsapp_number text, 
   instagram_link text, 
   facebook_link text, 
   youtube_link text, 
   linkedin_link text, 
   precise_address text, 
   city text, 
   state text, 
   country text, 
   postal_code text, 
   languages text[]
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Verify the job exists and the caller has access
  IF NOT EXISTS (
    SELECT 1 FROM public.jobs j 
    JOIN public.companies c ON j.company_id = c.id 
    WHERE j.id = p_job_id AND c.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Job not found or access denied';
  END IF;

  RETURN QUERY
  SELECT 
    ja.id as application_id,
    ja.job_id,
    ja.user_id,
    ja.applied_at,
    ja.status,
    ja.cover_letter,
    ja.resume_url,
    ja.reviewed_at,
    au.email,
    p.full_name,
    p.phone,
    p.location,
    p.current_position,
    p.company,
    p.skills,
    p.profile_image_url,
    p.bio,
    p.education,
    p.experience_years,
    p.experience_level,
    p.preferred_location,
    p.job_type,
    p.industry,
    p.whatsapp_number,
    p.instagram_link,
    p.facebook_link,
    p.youtube_link,
    p.linkedin_link,
    p.precise_address,
    p.city,
    p.state,
    p.country,
    p.postal_code,
    p.languages
  FROM public.job_applications ja
  LEFT JOIN public.profiles p ON ja.user_id = p.user_id
  LEFT JOIN auth.users au ON ja.user_id = au.id
  WHERE ja.job_id = p_job_id
  ORDER BY ja.applied_at DESC;
END;
$function$;

-- Grant execute permissions to both anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.get_job_applicants_with_emails(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_job_applicants_with_emails(uuid) TO authenticated;