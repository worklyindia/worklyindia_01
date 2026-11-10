-- Drop and recreate function to get user location statistics with city
DROP FUNCTION IF EXISTS public.get_user_location_statistics();

CREATE OR REPLACE FUNCTION public.get_user_location_statistics()
RETURNS TABLE (
  country TEXT,
  state TEXT,
  city TEXT,
  total_members BIGINT,
  active_members BIGINT,
  profile_complete_members BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is admin
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  RETURN QUERY
  SELECT 
    COALESCE(NULLIF(TRIM(p.country), ''), 'Unknown') as country,
    COALESCE(NULLIF(TRIM(p.state), ''), 'Unknown') as state,
    COALESCE(NULLIF(TRIM(p.city), ''), 'Unknown') as city,
    COUNT(*)::BIGINT as total_members,
    COUNT(*) FILTER (WHERE p.account_status = 'active')::BIGINT as active_members,
    COUNT(*) FILTER (WHERE p.is_profile_complete = true)::BIGINT as profile_complete_members
  FROM public.profiles p
  GROUP BY p.country, p.state, p.city
  HAVING COUNT(*) > 0
  ORDER BY 
    CASE WHEN p.country IS NULL OR TRIM(p.country) = '' THEN 1 ELSE 0 END,
    country,
    CASE WHEN p.state IS NULL OR TRIM(p.state) = '' THEN 1 ELSE 0 END,
    state,
    CASE WHEN p.city IS NULL OR TRIM(p.city) = '' THEN 1 ELSE 0 END,
    city,
    total_members DESC;
END;
$$;