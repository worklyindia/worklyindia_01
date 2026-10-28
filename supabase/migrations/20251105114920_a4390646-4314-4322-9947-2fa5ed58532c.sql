-- Fix is_admin_or_owner() to use SECURITY DEFINER
-- Drop CASCADE to remove dependent RLS policies, then recreate everything

DROP FUNCTION IF EXISTS is_admin_or_owner() CASCADE;

CREATE OR REPLACE FUNCTION is_admin_or_owner()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER  -- Changed from SECURITY INVOKER to bypass RLS
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'owner')
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION is_admin_or_owner() TO authenticated;

-- Recreate the RLS policies that were dropped

-- Policy for education_entries
DROP POLICY IF EXISTS "Admins can view all education entries" ON education_entries;
CREATE POLICY "Admins can view all education entries"
ON education_entries FOR SELECT
USING (is_admin_or_owner());

-- Policy for certifications
DROP POLICY IF EXISTS "Admins can view all certifications" ON certifications;
CREATE POLICY "Admins can view all certifications"
ON certifications FOR SELECT
USING (is_admin_or_owner());

-- Policy for professional_experiences
DROP POLICY IF EXISTS "Admins can view all professional experiences" ON professional_experiences;
CREATE POLICY "Admins can view all professional experiences"
ON professional_experiences FOR SELECT
USING (is_admin_or_owner());