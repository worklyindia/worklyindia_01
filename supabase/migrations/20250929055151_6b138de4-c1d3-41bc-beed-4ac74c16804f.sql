-- Create a distinct function to avoid overloaded RPC ambiguity
CREATE OR REPLACE FUNCTION public.admin_update_jobseeker_profile_full(
  p_user_id uuid,
  p_full_name text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_location text DEFAULT NULL,
  p_current_position text DEFAULT NULL,
  p_company text DEFAULT NULL,
  p_industry text DEFAULT NULL,
  p_bio text DEFAULT NULL,
  p_skills text[] DEFAULT NULL,
  p_languages text[] DEFAULT NULL,
  p_experience_years integer DEFAULT NULL,
  p_preferred_location text DEFAULT NULL,
  p_job_type text DEFAULT NULL,
  p_whatsapp_number text DEFAULT NULL,
  p_instagram_link text DEFAULT NULL,
  p_facebook_link text DEFAULT NULL,
  p_youtube_link text DEFAULT NULL,
  p_linkedin_link text DEFAULT NULL,
  p_precise_address text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_country text DEFAULT NULL,
  p_postal_code text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ensure only admins/owners can update
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  UPDATE public.profiles
  SET
    full_name = COALESCE(p_full_name, full_name),
    phone = COALESCE(p_phone, phone),
    location = COALESCE(p_location, location),
    current_position = COALESCE(p_current_position, current_position),
    company = COALESCE(p_company, company),
    industry = COALESCE(p_industry, industry),
    bio = COALESCE(p_bio, bio),
    skills = COALESCE(p_skills, skills),
    languages = COALESCE(p_languages, languages),
    experience_years = COALESCE(p_experience_years, experience_years),
    preferred_location = COALESCE(p_preferred_location, preferred_location),
    job_type = COALESCE(p_job_type, job_type),
    whatsapp_number = COALESCE(p_whatsapp_number, whatsapp_number),
    instagram_link = COALESCE(p_instagram_link, instagram_link),
    facebook_link = COALESCE(p_facebook_link, facebook_link),
    youtube_link = COALESCE(p_youtube_link, youtube_link),
    linkedin_link = COALESCE(p_linkedin_link, linkedin_link),
    precise_address = COALESCE(p_precise_address, precise_address),
    city = COALESCE(p_city, city),
    state = COALESCE(p_state, state),
    country = COALESCE(p_country, country),
    postal_code = COALESCE(p_postal_code, postal_code),
    updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;