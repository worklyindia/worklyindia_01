-- Drop and recreate get_all_employers function with all required fields
DROP FUNCTION IF EXISTS public.get_all_employers(text, text, text, text, integer, integer);

CREATE OR REPLACE FUNCTION public.get_all_employers(
  p_search text DEFAULT ''::text,
  p_location text DEFAULT ''::text,
  p_industry text DEFAULT ''::text,
  p_status text DEFAULT 'all'::text,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  user_id uuid,
  company_name text,
  legal_name text,
  email text,
  phone text,
  whatsapp_number text,
  location text,
  precise_address text,
  city text,
  state text,
  country text,
  postal_code text,
  industry text,
  company_size text,
  website text,
  description text,
  logo_url text,
  hr_contact_name text,
  instagram_link text,
  facebook_link text,
  youtube_link text,
  linkedin_link text,
  is_verified boolean,
  is_profile_complete boolean,
  created_at timestamp with time zone,
  last_sign_in_at timestamp with time zone,
  total_jobs integer,
  active_jobs integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    c.user_id,
    COALESCE(c.company_name, '') as company_name,
    COALESCE(c.legal_name, '') as legal_name,
    COALESCE(c.email, '') as email,
    COALESCE(c.phone, '') as phone,
    COALESCE(c.whatsapp_number, '') as whatsapp_number,
    COALESCE(c.location, '') as location,
    COALESCE(c.precise_address, '') as precise_address,
    COALESCE(c.city, '') as city,
    COALESCE(c.state, '') as state,
    COALESCE(c.country, '') as country,
    COALESCE(c.postal_code, '') as postal_code,
    COALESCE(c.industry, '') as industry,
    COALESCE(c.company_size, '') as company_size,
    COALESCE(c.website, '') as website,
    COALESCE(c.description, '') as description,
    COALESCE(c.logo_url, '') as logo_url,
    COALESCE(c.hr_contact_name, '') as hr_contact_name,
    COALESCE(c.instagram_link, '') as instagram_link,
    COALESCE(c.facebook_link, '') as facebook_link,
    COALESCE(c.youtube_link, '') as youtube_link,
    COALESCE(c.linkedin_link, '') as linkedin_link,
    COALESCE(c.is_verified, false) as is_verified,
    COALESCE(c.is_profile_complete, false) as is_profile_complete,
    c.created_at,
    au.last_sign_in_at,
    COALESCE(
      (SELECT COUNT(*)::integer FROM jobs j WHERE j.company_id = c.id), 
      0
    ) as total_jobs,
    COALESCE(
      (SELECT COUNT(*)::integer FROM jobs j WHERE j.company_id = c.id AND j.status = 'active'), 
      0
    ) as active_jobs
  FROM public.companies c
  LEFT JOIN auth.users au ON au.id = c.user_id
  WHERE 
    (p_search = '' OR (
      c.company_name ILIKE '%' || p_search || '%' OR
      c.email ILIKE '%' || p_search || '%' OR
      c.description ILIKE '%' || p_search || '%'
    ))
    AND (p_location = '' OR c.location ILIKE '%' || p_location || '%')
    AND (p_industry = '' OR c.industry ILIKE '%' || p_industry || '%')
    AND (p_status = 'all' OR 
         (p_status = 'active' AND au.last_sign_in_at > NOW() - INTERVAL '30 days') OR
         (p_status = 'inactive' AND (au.last_sign_in_at IS NULL OR au.last_sign_in_at <= NOW() - INTERVAL '30 days')))
  ORDER BY c.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$function$;