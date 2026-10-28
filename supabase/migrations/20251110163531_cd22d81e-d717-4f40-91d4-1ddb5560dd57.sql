-- Fix type casting issue in get_job_applicants_with_emails and get_company_applicants_with_emails
-- The auth.users.email column is varchar(255) but functions return it as text
-- We need to explicitly cast it to text for type matching

-- Drop and recreate get_job_applicants_with_emails with proper type casting
DROP FUNCTION IF EXISTS get_job_applicants_with_emails(uuid);

CREATE OR REPLACE FUNCTION get_job_applicants_with_emails(p_job_id uuid)
RETURNS TABLE (
  id uuid,
  job_id uuid,
  user_id uuid,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  resume_url text,
  cover_letter text,
  applicant_name text,
  applicant_email text,
  applicant_phone text,
  applicant_avatar text,
  applicant_location text,
  applicant_headline text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ja.id,
    ja.job_id,
    ja.applicant_id::uuid as user_id,
    ja.status,
    ja.created_at,
    ja.updated_at,
    ja.resume_url,
    ja.cover_letter,
    p.full_name as applicant_name,
    au.email::text as applicant_email,
    p.phone as applicant_phone,
    p.avatar_url as applicant_avatar,
    p.location as applicant_location,
    p.headline as applicant_headline
  FROM job_applications ja
  LEFT JOIN profiles p ON ja.applicant_id = p.user_id
  LEFT JOIN auth.users au ON ja.applicant_id = au.id
  WHERE ja.job_id = p_job_id
  ORDER BY ja.created_at DESC;
END;
$$;

-- Drop and recreate get_company_applicants_with_emails with proper type casting
DROP FUNCTION IF EXISTS get_company_applicants_with_emails(uuid);

CREATE OR REPLACE FUNCTION get_company_applicants_with_emails(p_company_id uuid)
RETURNS TABLE (
  id uuid,
  job_id uuid,
  user_id uuid,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  resume_url text,
  cover_letter text,
  applicant_name text,
  applicant_email text,
  applicant_phone text,
  applicant_avatar text,
  applicant_location text,
  applicant_headline text,
  job_title text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ja.id,
    ja.job_id,
    ja.applicant_id::uuid as user_id,
    ja.status,
    ja.created_at,
    ja.updated_at,
    ja.resume_url,
    ja.cover_letter,
    p.full_name as applicant_name,
    au.email::text as applicant_email,
    p.phone as applicant_phone,
    p.avatar_url as applicant_avatar,
    p.location as applicant_location,
    p.headline as applicant_headline,
    j.title as job_title
  FROM job_applications ja
  LEFT JOIN profiles p ON ja.applicant_id = p.user_id
  LEFT JOIN auth.users au ON ja.applicant_id = au.id
  LEFT JOIN jobs j ON ja.job_id = j.id
  WHERE j.company_id = p_company_id
  ORDER BY ja.created_at DESC;
END;
$$;