-- Fix the RPC function by ensuring exact type matching
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
    ja.id::uuid as application_id,
    ja.job_id::uuid,
    ja.user_id::uuid,
    ja.applied_at::timestamp with time zone,
    COALESCE(ja.status, 'applied')::text,
    ja.cover_letter::text,
    ja.resume_url::text,
    ja.reviewed_at::timestamp with time zone,
    COALESCE(au.email, '')::text,
    COALESCE(p.full_name, '')::text,
    COALESCE(p.phone, '')::text,
    COALESCE(p.location, '')::text,
    COALESCE(p.current_position, '')::text,
    COALESCE(p.company, '')::text,
    COALESCE(p.skills, ARRAY[]::text[])::text[],
    COALESCE(p.profile_image_url, '')::text,
    COALESCE(p.bio, '')::text,
    COALESCE(p.education, '')::text,
    COALESCE(p.experience_years, 0)::integer,
    COALESCE(p.experience_level, 0)::integer,
    COALESCE(p.preferred_location, '')::text,
    COALESCE(p.job_type, '')::text,
    COALESCE(p.industry, '')::text,
    COALESCE(p.whatsapp_number, '')::text,
    COALESCE(p.instagram_link, '')::text,
    COALESCE(p.facebook_link, '')::text,
    COALESCE(p.youtube_link, '')::text,
    COALESCE(p.linkedin_link, '')::text,
    COALESCE(p.precise_address, '')::text,
    COALESCE(p.city, '')::text,
    COALESCE(p.state, '')::text,
    COALESCE(p.country, '')::text,
    COALESCE(p.postal_code, '')::text,
    COALESCE(p.languages, ARRAY[]::text[])::text[]
  FROM public.job_applications ja
  LEFT JOIN public.profiles p ON ja.user_id = p.user_id
  LEFT JOIN auth.users au ON ja.user_id = au.id
  WHERE ja.job_id = p_job_id
  ORDER BY ja.applied_at DESC;
END;
$function$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_job_applicants_with_emails(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_job_applicants_with_emails(uuid) TO authenticated;