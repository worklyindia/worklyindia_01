-- Add account status columns to profiles table for user ban functionality
ALTER TABLE public.profiles 
ADD COLUMN account_status text NOT NULL DEFAULT 'active',
ADD COLUMN account_status_reason text;

-- Create index for faster queries
CREATE INDEX idx_profiles_account_status ON public.profiles(account_status);

-- Create admin function to ban/unban users
CREATE OR REPLACE FUNCTION public.admin_update_user_status(
  p_user_id uuid,
  p_action text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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

  -- Update user status based on action
  IF p_action = 'ban' THEN
    UPDATE public.profiles 
    SET account_status = 'banned', 
        account_status_reason = 'Banned by administrator',
        updated_at = now()
    WHERE user_id = p_user_id;
  ELSIF p_action = 'unban' THEN
    UPDATE public.profiles 
    SET account_status = 'active', 
        account_status_reason = NULL,
        updated_at = now()
    WHERE user_id = p_user_id;
  ELSE
    RAISE EXCEPTION 'Invalid action. Use "ban" or "unban".';
  END IF;
END;
$$;

-- Update get_all_jobseekers function to include account_status
CREATE OR REPLACE FUNCTION public.get_all_jobseekers(
  p_search text DEFAULT '',
  p_location text DEFAULT '',
  p_industry text DEFAULT '',
  p_status text DEFAULT 'all',
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  user_id uuid,
  full_name text,
  email text,
  phone text,
  location text,
  current_position text,
  company text,
  industry text,
  bio text,
  skills text[],
  languages text[],
  experience_years integer,
  profile_image_url text,
  is_profile_complete boolean,
  created_at timestamp with time zone,
  last_sign_in_at timestamp with time zone,
  total_applications integer,
  account_status text,
  account_status_reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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
    p.user_id,
    COALESCE(p.full_name, '') as full_name,
    COALESCE(au.email, '') as email,
    COALESCE(p.phone, '') as phone,
    COALESCE(p.location, '') as location,
    COALESCE(p.current_position, '') as current_position,
    COALESCE(p.company, '') as company,
    COALESCE(p.industry, '') as industry,
    COALESCE(p.bio, '') as bio,
    COALESCE(p.skills, array[]::text[]) as skills,
    COALESCE(p.languages, array[]::text[]) as languages,
    COALESCE(p.experience_years, 0) as experience_years,
    COALESCE(p.profile_image_url, '') as profile_image_url,
    COALESCE(p.is_profile_complete, false) as is_profile_complete,
    p.created_at,
    au.last_sign_in_at,
    COALESCE(
      (SELECT COUNT(*)::integer FROM job_applications ja WHERE ja.user_id = p.user_id), 
      0
    ) as total_applications,
    COALESCE(p.account_status, 'active') as account_status,
    p.account_status_reason
  FROM public.profiles p
  LEFT JOIN auth.users au ON au.id = p.user_id
  WHERE 
    (p_search = '' OR (
      p.full_name ILIKE '%' || p_search || '%' OR
      au.email ILIKE '%' || p_search || '%' OR
      p.current_position ILIKE '%' || p_search || '%' OR
      exists (
        select 1 from unnest(coalesce(p.skills, array[]::text[])) s
        where s ilike '%' || p_search || '%'
      )
    ))
    AND (p_location = '' OR p.location ILIKE '%' || p_location || '%')
    AND (p_industry = '' OR p.industry ILIKE '%' || p_industry || '%')
    AND (p_status = 'all' OR 
         (p_status = 'active' AND p.account_status = 'active') OR
         (p_status = 'banned' AND p.account_status = 'banned') OR
         (p_status = 'inactive' AND au.last_sign_in_at <= NOW() - INTERVAL '30 days'))
  ORDER BY p.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;