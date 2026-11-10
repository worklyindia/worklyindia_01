-- Create function to sync company profile completion status
CREATE OR REPLACE FUNCTION public.sync_company_profile_completion()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Update is_profile_complete based on actual field completion
  UPDATE companies SET
    is_profile_complete = (
      company_name IS NOT NULL AND company_name != '' AND
      legal_name IS NOT NULL AND legal_name != '' AND
      email IS NOT NULL AND email != '' AND
      phone IS NOT NULL AND phone != '' AND
      hr_contact_name IS NOT NULL AND hr_contact_name != ''
    ),
    updated_at = now()
  WHERE is_profile_complete != (
    company_name IS NOT NULL AND company_name != '' AND
    legal_name IS NOT NULL AND legal_name != '' AND
    email IS NOT NULL AND email != '' AND
    phone IS NOT NULL AND phone != '' AND
    hr_contact_name IS NOT NULL AND hr_contact_name != ''
  );
END;
$$;

-- Create trigger function to auto-update profile completion status
CREATE OR REPLACE FUNCTION public.update_company_profile_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Auto-calculate and set is_profile_complete based on required fields
  NEW.is_profile_complete = (
    NEW.company_name IS NOT NULL AND NEW.company_name != '' AND
    NEW.legal_name IS NOT NULL AND NEW.legal_name != '' AND
    NEW.email IS NOT NULL AND NEW.email != '' AND
    NEW.phone IS NOT NULL AND NEW.phone != '' AND
    NEW.hr_contact_name IS NOT NULL AND NEW.hr_contact_name != ''
  );
  
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create trigger for companies table
DROP TRIGGER IF EXISTS trigger_update_company_profile_completion ON companies;
CREATE TRIGGER trigger_update_company_profile_completion
  BEFORE INSERT OR UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_company_profile_completion();

-- Run the sync function to fix existing data
SELECT public.sync_company_profile_completion();