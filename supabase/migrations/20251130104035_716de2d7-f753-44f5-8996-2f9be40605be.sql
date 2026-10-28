-- Fix get_all_website_users function: change ja.user_id to ja.applicant_id
CREATE OR REPLACE FUNCTION public.get_all_website_users(p_search text DEFAULT ''::text, p_location text DEFAULT ''::text, p_industry text DEFAULT ''::text, p_status text DEFAULT ''::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS TABLE(user_id uuid, full_name text, email text, phone text, location text, industry text, current_position text, company text, skills text[], profile_image_url text, bio text, education text, experience_years integer, experience_level integer, preferred_location text, job_type text, whatsapp_number text, instagram_link text, facebook_link text, youtube_link text, linkedin_link text, precise_address text, city text, state text, country text, postal_code text, languages text[], is_profile_complete boolean, created_at timestamp with time zone, last_sign_in_at timestamp with time zone, total_applications bigint, account_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if user has admin role
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
    p.full_name::text,
    au.email::text,
    p.phone::text,
    p.location::text,
    p.industry::text,
    p.current_position::text,
    p.company::text,
    p.skills,
    p.profile_image_url::text,
    p.bio::text,
    p.education::text,
    p.experience_years,
    p.experience_level,
    p.preferred_location::text,
    p.job_type::text,
    p.whatsapp_number::text,
    p.instagram_link::text,
    p.facebook_link::text,
    p.youtube_link::text,
    p.linkedin_link::text,
    p.precise_address::text,
    p.city::text,
    p.state::text,
    p.country::text,
    p.postal_code::text,
    p.languages,
    p.is_profile_complete,
    p.created_at,
    au.last_sign_in_at,
    COALESCE(app_count.total, 0::bigint) AS total_applications,
    p.account_status::text
  FROM profiles p
  LEFT JOIN auth.users au ON p.user_id = au.id
  LEFT JOIN (
    SELECT ja.applicant_id AS ja_user_id, COUNT(*)::bigint AS total
    FROM job_applications ja
    GROUP BY ja.applicant_id
  ) app_count ON p.user_id = app_count.ja_user_id
  WHERE 
    (p_search = '' OR 
      p.full_name::text ILIKE '%' || p_search || '%' OR
      au.email::text ILIKE '%' || p_search || '%' OR
      p.phone::text ILIKE '%' || p_search || '%' OR
      p.user_id::text ILIKE '%' || p_search || '%' OR
      p.current_position::text ILIKE '%' || p_search || '%' OR
      EXISTS (SELECT 1 FROM unnest(p.skills) s WHERE s ILIKE '%' || p_search || '%'))
    AND (p_location = '' OR p.location::text = p_location)
    AND (p_industry = '' OR p.industry::text = p_industry)
    AND (p_status = '' OR p.account_status::text = p_status)
  ORDER BY p.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$function$;