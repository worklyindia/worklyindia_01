-- Add email column to profiles table for application-submitted emails
-- This allows API users to provide custom email addresses when submitting applications

-- Add email column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email TEXT;

-- Create index for faster email lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Update the RPC function to use profiles.email first, fallback to auth.users.email
CREATE OR REPLACE FUNCTION public.get_job_applicants_with_emails(p_job_id uuid)
RETURNS TABLE(
  application_id uuid, 
  job_id uuid, 
  user_id uuid, 
  status text, 
  applied_at timestamp with time zone, 
  reviewed_at timestamp with time zone, 
  resume_url text, 
  cover_letter text, 
  full_name text, 
  email text, 
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
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    ja.id as application_id,
    ja.job_id,
    p.user_id::uuid as user_id,
    ja.status,
    ja.created_at as applied_at,
    ja.reviewed_at as reviewed_at,
    ja.resume_url,
    ja.cover_letter,
    p.full_name,
    -- Use profiles.email if available, otherwise fallback to auth.users.email
    COALESCE(p.email, au.email)::text as email,
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
  FROM job_applications ja
  LEFT JOIN profiles p ON ja.applicant_id = p.id
  LEFT JOIN auth.users au ON p.user_id = au.id
  WHERE ja.job_id = p_job_id
  ORDER BY ja.created_at DESC;
END;
$function$;