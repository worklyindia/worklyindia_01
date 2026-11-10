-- Delete the old Workly India company record that's causing duplicate number issues
DELETE FROM companies WHERE id = '1dcfd822-a947-4a83-a7dc-c1956c00f407';

-- Create a function to automatically delete company when profile is deleted
-- This ensures orphan company records don't remain in the database
CREATE OR REPLACE FUNCTION public.delete_company_on_profile_deletion()
RETURNS TRIGGER AS $$
BEGIN
  -- When a profile is deleted, also delete the associated company
  DELETE FROM public.companies WHERE user_id = OLD.user_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_delete_company_on_profile_deletion ON public.profiles;

-- Create trigger to fire before profile deletion
CREATE TRIGGER trigger_delete_company_on_profile_deletion
  BEFORE DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_company_on_profile_deletion();