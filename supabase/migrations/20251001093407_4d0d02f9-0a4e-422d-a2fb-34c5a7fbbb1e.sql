-- Create admin function to get company ID bypassing RLS
CREATE OR REPLACE FUNCTION public.admin_get_company_id(p_user_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.companies
  WHERE user_id = p_user_id
  ORDER BY created_at DESC
  LIMIT 1;
$$;