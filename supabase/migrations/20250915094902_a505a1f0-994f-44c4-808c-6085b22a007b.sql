-- Complete the remaining database functions and RLS fixes

-- Fix admin_update_company_verification function
CREATE OR REPLACE FUNCTION public.admin_update_company_verification(
  p_company_id uuid,
  p_is_verified boolean,
  p_badge_color text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check if user has admin role
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- Update company verification
  UPDATE public.companies 
  SET 
    is_verified = p_is_verified,
    badge_color = CASE 
      WHEN p_badge_color IS NOT NULL THEN p_badge_color
      WHEN p_is_verified THEN COALESCE(badge_color, 'gold')
      ELSE NULL
    END,
    updated_at = now()
  WHERE id = p_company_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Company not found';
  END IF;
END;
$$;

-- Fix jobs table RLS policy for INSERT
DROP POLICY IF EXISTS "Users can create jobs for their own company" ON public.jobs;

CREATE POLICY "Users can create jobs for their own company" 
ON public.jobs 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.companies c 
    WHERE c.id = jobs.company_id 
    AND c.user_id = auth.uid()
    AND c.account_status = 'active'
  )
);

-- Create security definer function for admin role checking
CREATE OR REPLACE FUNCTION public.is_admin_user(check_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = check_user_id 
    AND role IN ('admin', 'owner')
  );
END;
$$;

-- Create function to get company by user
CREATE OR REPLACE FUNCTION public.get_user_company(p_user_id uuid DEFAULT auth.uid())
RETURNS TABLE(
  id uuid,
  company_name text,
  is_profile_complete boolean,
  account_status text
)
LANGUAGE plpgsql
SECURITY DEFINER  
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.company_name,
    c.is_profile_complete,
    c.account_status
  FROM public.companies c
  WHERE c.user_id = p_user_id;
END;
$$;