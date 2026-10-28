-- Fix ambiguous user_id error in get_all_website_users function
-- Add admin security check and qualify column references properly

-- Drop the broken function
DROP FUNCTION IF EXISTS public.get_all_website_users(text, text, text, text, integer, integer);

-- Recreate with proper column qualification and admin check
CREATE OR REPLACE FUNCTION public.get_all_website_users(
  p_search text DEFAULT '',
  p_location text DEFAULT '',
  p_industry text DEFAULT '',
  p_status text DEFAULT '',
  p_limit integer DEFAULT 50,
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
  total_applications bigint,
  account_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Add admin check (like get_team_members)
  IF NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = auth.uid() 
    AND admin_users.role IN ('owner', 'admin', 'moderator')
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.'
      USING ERRCODE = 'PERM1';
  END IF;
  
  RETURN QUERY
  SELECT 
    p.user_id,
    p.full_name,
    au.email,
    p.phone,
    p.location,
    p.industry,
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
    p.is_profile_complete,
    p.created_at,
    au.last_sign_in_at,
    COALESCE(app_count.total, 0) as total_applications,
    COALESCE(p.account_status, 'active') as account_status
  FROM profiles p
  LEFT JOIN auth.users au ON p.user_id = au.id
  LEFT JOIN (
    -- Fix: Explicitly qualify the column in subquery to avoid ambiguity
    SELECT ja.user_id as ja_user_id, COUNT(*) as total
    FROM job_applications ja
    GROUP BY ja.user_id
  ) app_count ON p.user_id = app_count.ja_user_id
  WHERE 
    (p_search = '' OR 
     p.full_name ILIKE '%' || p_search || '%' OR
     au.email ILIKE '%' || p_search || '%' OR
     p.phone ILIKE '%' || p_search || '%' OR
     p.user_id::text ILIKE '%' || p_search || '%' OR
     p.current_position ILIKE '%' || p_search || '%' OR
     EXISTS (SELECT 1 FROM unnest(p.skills) s WHERE s ILIKE '%' || p_search || '%'))
    AND (p_location = '' OR p.location = p_location)
    AND (p_industry = '' OR p.industry = p_industry)
    AND (p_status = '' OR COALESCE(p.account_status, 'active') = p_status)
  ORDER BY p.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_all_website_users(text, text, text, text, integer, integer) TO authenticated;