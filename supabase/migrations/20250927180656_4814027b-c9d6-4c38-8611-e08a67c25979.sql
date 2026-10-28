-- Drop all existing overloaded versions of get_all_website_users to remove ambiguity
DROP FUNCTION IF EXISTS public.get_all_website_users();
DROP FUNCTION IF EXISTS public.get_all_website_users(text);
DROP FUNCTION IF EXISTS public.get_all_website_users(text, text);
DROP FUNCTION IF EXISTS public.get_all_website_users(text, text, text);
DROP FUNCTION IF EXISTS public.get_all_website_users(text, text, text, text);
DROP FUNCTION IF EXISTS public.get_all_website_users(text, text, text, text, integer);
DROP FUNCTION IF EXISTS public.get_all_website_users(text, text, text, text, integer, integer);

-- Create a single, robust function with precise return type matching WebsiteUser interface
CREATE OR REPLACE FUNCTION public.get_all_website_users(
  p_search text DEFAULT '',
  p_location text DEFAULT '',
  p_industry text DEFAULT '',
  p_status text DEFAULT '',
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  user_id uuid,
  full_name text,
  email text,
  phone text,
  location text,
  industry text,
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
  is_profile_complete boolean,
  created_at timestamp with time zone,
  last_sign_in_at timestamp with time zone,
  total_applications integer,
  account_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user has admin role
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users au 
    WHERE au.user_id = auth.uid() 
    AND au.role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  RETURN QUERY
  SELECT 
    p.user_id::uuid,
    COALESCE(p.full_name, '')::text,
    COALESCE(au.email, '')::text,
    COALESCE(p.phone, '')::text,
    COALESCE(p.location, '')::text,
    COALESCE(p.industry, '')::text,
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
    COALESCE(p.languages, ARRAY[]::text[])::text[],
    COALESCE(p.is_profile_complete, false)::boolean,
    p.created_at::timestamp with time zone,
    au.last_sign_in_at::timestamp with time zone,
    COALESCE(
      (SELECT COUNT(*)::integer FROM job_applications ja WHERE ja.user_id = p.user_id), 
      0
    )::integer as total_applications,
    CASE 
      WHEN au.last_sign_in_at > NOW() - INTERVAL '30 days' THEN 'active'::text
      ELSE 'inactive'::text
    END as account_status
  FROM public.profiles p
  LEFT JOIN auth.users au ON au.id = p.user_id
  WHERE 
    -- Real email filtering to exclude fake emails
    au.email IS NOT NULL 
    AND au.email <> '' 
    AND au.email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
    AND NOT au.email ~* '@(mailinator|tempmail|10minutemail|guerrillamail|yopmail|sharklasers|trashmail)\.'
    AND NOT LOWER(SPLIT_PART(au.email, '@', 1)) ~ '(test|fake|demo|sample|asdf|qwerty|noemail)'
    -- Search filters
    AND (
      p_search = '' OR (
        p.full_name ILIKE '%' || p_search || '%' OR
        au.email ILIKE '%' || p_search || '%' OR
        p.current_position ILIKE '%' || p_search || '%' OR
        EXISTS (
          SELECT 1 FROM unnest(COALESCE(p.skills, ARRAY[]::text[])) s
          WHERE s ILIKE '%' || p_search || '%'
        )
      )
    )
    -- Location filter
    AND (p_location = '' OR p.location ILIKE '%' || p_location || '%')
    -- Industry filter
    AND (p_industry = '' OR p.industry ILIKE '%' || p_industry || '%')
    -- Status filter
    AND (
      p_status = '' OR p_status = 'all' OR 
      (p_status = 'active' AND au.last_sign_in_at > NOW() - INTERVAL '30 days') OR
      (p_status = 'inactive' AND (au.last_sign_in_at IS NULL OR au.last_sign_in_at <= NOW() - INTERVAL '30 days'))
    )
  ORDER BY p.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;