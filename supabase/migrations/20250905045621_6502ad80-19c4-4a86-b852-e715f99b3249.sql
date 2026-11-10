-- Create a function to get job applicants with email data from auth.users
CREATE OR REPLACE FUNCTION public.get_job_applicants_with_emails(p_job_id UUID)
RETURNS TABLE (
  application_id UUID,
  job_id UUID,
  user_id UUID,
  applied_at TIMESTAMP WITH TIME ZONE,
  status TEXT,
  cover_letter TEXT,
  resume_url TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  email TEXT,
  full_name TEXT,
  phone TEXT,
  location TEXT,
  current_position TEXT,
  company TEXT,
  skills TEXT[],
  profile_image_url TEXT,
  bio TEXT,
  education TEXT,
  experience_years INTEGER,
  experience_level INTEGER,
  preferred_location TEXT,
  job_type TEXT,
  industry TEXT,
  whatsapp_number TEXT,
  instagram_link TEXT,
  facebook_link TEXT,
  youtube_link TEXT,
  linkedin_link TEXT,
  precise_address TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  postal_code TEXT,
  languages TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
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
$$;