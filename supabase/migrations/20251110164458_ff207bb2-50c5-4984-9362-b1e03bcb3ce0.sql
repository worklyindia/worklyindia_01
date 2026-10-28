-- Fix column reference in applicant functions
-- Change ja.updated_at to ja.reviewed_at (the correct column name)

DROP FUNCTION IF EXISTS get_job_applicants_with_emails(uuid);

CREATE OR REPLACE FUNCTION get_job_applicants_with_emails(p_job_id uuid)
RETURNS TABLE (
  application_id uuid,
  job_id uuid,
  user_id uuid,
  status text,
  applied_at timestamptz,
  reviewed_at timestamptz,
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
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ja.id as application_id,
    ja.job_id,
    ja.applicant_id::uuid as user_id,
    ja.status,
    ja.created_at as applied_at,
    ja.reviewed_at as reviewed_at,
    ja.resume_url,
    ja.cover_letter,
    p.full_name,
    au.email::text,
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
  LEFT JOIN profiles p ON ja.applicant_id = p.user_id
  LEFT JOIN auth.users au ON ja.applicant_id = au.id
  WHERE ja.job_id = p_job_id
  ORDER BY ja.created_at DESC;
END;
$$;

DROP FUNCTION IF EXISTS get_company_applicants_with_emails(uuid);

CREATE OR REPLACE FUNCTION get_company_applicants_with_emails(p_company_id uuid)
RETURNS TABLE (
  application_id uuid,
  job_id uuid,
  user_id uuid,
  status text,
  applied_at timestamptz,
  reviewed_at timestamptz,
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
  languages text[],
  job_title text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ja.id as application_id,
    ja.job_id,
    ja.applicant_id::uuid as user_id,
    ja.status,
    ja.created_at as applied_at,
    ja.reviewed_at as reviewed_at,
    ja.resume_url,
    ja.cover_letter,
    p.full_name,
    au.email::text,
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
    p.languages,
    j.title as job_title
  FROM job_applications ja
  LEFT JOIN profiles p ON ja.applicant_id = p.user_id
  LEFT JOIN auth.users au ON ja.applicant_id = au.id
  LEFT JOIN jobs j ON ja.job_id = j.id
  WHERE j.company_id = p_company_id
  ORDER BY ja.created_at DESC;
END;
$$;