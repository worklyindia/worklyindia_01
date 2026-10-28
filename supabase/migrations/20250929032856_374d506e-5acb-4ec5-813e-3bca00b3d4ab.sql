-- Drop existing functions and recreate them with proper variable names
DROP FUNCTION IF EXISTS public.grant_admin_access();
DROP FUNCTION IF EXISTS public.get_all_website_users(text, text, text, text, integer, integer);

-- 1) Create admin grant function
CREATE OR REPLACE FUNCTION public.grant_admin_access()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  auth_user_id uuid;
  new_role text := 'admin';
  user_email text;
BEGIN
  auth_user_id := auth.uid();
  IF auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- If already admin/owner, return
  IF EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = auth_user_id AND role IN ('admin','owner')
  ) THEN
    RETURN 'already_admin';
  END IF;

  -- Owner shortcut for special account (optional)
  SELECT email INTO user_email FROM auth.users WHERE id = auth_user_id;
  IF user_email = 'gohilvishal7600@gmail.com' THEN
    new_role := 'owner';
  END IF;

  -- Upsert without assuming unique index
  IF EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth_user_id) THEN
    UPDATE public.admin_users SET role = new_role WHERE user_id = auth_user_id;
  ELSE
    INSERT INTO public.admin_users (user_id, role) VALUES (auth_user_id, new_role);
  END IF;

  RETURN new_role;
END;
$$;

-- 2) Create unified get_all_website_users function expected by UI
CREATE OR REPLACE FUNCTION public.get_all_website_users(
  p_search   text DEFAULT ''::text,
  p_location text DEFAULT ''::text,
  p_industry text DEFAULT ''::text,
  p_status   text DEFAULT ''::text,
  p_limit    integer DEFAULT 10000,
  p_offset   integer DEFAULT 0
)
RETURNS TABLE (
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
  created_at timestamptz,
  last_sign_in_at timestamptz,
  total_applications integer,
  account_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Admin/Owner check
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = auth.uid() AND role IN ('admin','owner')
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  RETURN QUERY
  SELECT 
    p.user_id,
    COALESCE(p.full_name, '')::text AS full_name,
    COALESCE(au.email, '')::text AS email,
    COALESCE(p.phone, '')::text AS phone,
    COALESCE(p.location, '')::text AS location,
    COALESCE(p.industry, '')::text AS industry,
    COALESCE(p.current_position, '')::text AS current_position,
    COALESCE(p.company, '')::text AS company,
    COALESCE(p.skills, ARRAY[]::text[])::text[] AS skills,
    COALESCE(p.profile_image_url, '')::text AS profile_image_url,
    COALESCE(p.bio, '')::text AS bio,
    COALESCE(p.education, '')::text AS education,
    COALESCE(p.experience_years, 0)::integer AS experience_years,
    COALESCE(p.experience_level, 0)::integer AS experience_level,
    COALESCE(p.preferred_location, '')::text AS preferred_location,
    COALESCE(p.job_type, '')::text AS job_type,
    COALESCE(p.whatsapp_number, '')::text AS whatsapp_number,
    COALESCE(p.instagram_link, '')::text AS instagram_link,
    COALESCE(p.facebook_link, '')::text AS facebook_link,
    COALESCE(p.youtube_link, '')::text AS youtube_link,
    COALESCE(p.linkedin_link, '')::text AS linkedin_link,
    COALESCE(p.precise_address, '')::text AS precise_address,
    COALESCE(p.city, '')::text AS city,
    COALESCE(p.state, '')::text AS state,
    COALESCE(p.country, '')::text AS country,
    COALESCE(p.postal_code, '')::text AS postal_code,
    COALESCE(p.languages, ARRAY[]::text[])::text[] AS languages,
    COALESCE(p.is_profile_complete, false)::boolean AS is_profile_complete,
    p.created_at,
    au.last_sign_in_at,
    COALESCE((SELECT COUNT(*) FROM public.job_applications ja WHERE ja.user_id = p.user_id), 0)::integer AS total_applications,
    COALESCE(p.account_status, 'active')::text AS account_status
  FROM public.profiles p
  LEFT JOIN auth.users au ON au.id = p.user_id
  WHERE 
    (p_search = '' OR 
      p.full_name ILIKE '%' || p_search || '%' OR
      au.email ILIKE '%' || p_search || '%' OR
      p.current_position ILIKE '%' || p_search || '%' OR
      EXISTS (
        SELECT 1 FROM unnest(COALESCE(p.skills, ARRAY[]::text[])) s
        WHERE s ILIKE '%' || p_search || '%'
      )
    )
    AND (p_location = '' OR p.location ILIKE '%' || p_location || '%')
    AND (p_industry = '' OR p.industry ILIKE '%' || p_industry || '%')
    AND (p_status = '' OR p_status = 'all' OR p.account_status = p_status)
  ORDER BY p.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;