-- Create admin RPC to update company profile securely
CREATE OR REPLACE FUNCTION public.admin_update_company_profile(
  p_user_id uuid,
  p_company_name text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_whatsapp_number text DEFAULT NULL,
  p_website text DEFAULT NULL,
  p_legal_name text DEFAULT NULL,
  p_hr_contact_name text DEFAULT NULL,
  p_precise_address text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_country text DEFAULT NULL,
  p_postal_code text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean;
BEGIN
  -- Verify caller is admin/owner
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = auth.uid() AND role IN ('admin','owner')
  ) INTO is_admin;

  IF NOT is_admin THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- Update only provided fields
  UPDATE public.companies SET
    company_name     = COALESCE(p_company_name, company_name),
    email            = COALESCE(p_email, email),
    phone            = COALESCE(p_phone, phone),
    whatsapp_number  = COALESCE(p_whatsapp_number, whatsapp_number),
    website          = COALESCE(p_website, website),
    legal_name       = COALESCE(p_legal_name, legal_name),
    hr_contact_name  = COALESCE(p_hr_contact_name, hr_contact_name),
    precise_address  = COALESCE(p_precise_address, precise_address),
    city             = COALESCE(p_city, city),
    state            = COALESCE(p_state, state),
    country          = COALESCE(p_country, country),
    postal_code      = COALESCE(p_postal_code, postal_code),
    updated_at       = now()
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Company not found for user_id: %', p_user_id;
  END IF;

  -- Ensure profile completion flag stays in sync
  PERFORM public.sync_company_profile_completion();

  RETURN true;
END;
$$;