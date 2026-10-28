-- Clean up duplicate company records and add unique constraint
-- Step 1: Create a helper function to get the latest company for each user
CREATE OR REPLACE FUNCTION get_latest_company_for_user(p_user_id UUID)
RETURNS SETOF companies AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM companies 
  WHERE user_id = p_user_id 
  ORDER BY created_at DESC, updated_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Clean up duplicate companies - keep only the latest one for each user
WITH duplicates_to_delete AS (
  SELECT c.id
  FROM companies c
  WHERE EXISTS (
    SELECT 1 
    FROM companies c2 
    WHERE c2.user_id = c.user_id 
    AND (c2.created_at > c.created_at OR (c2.created_at = c.created_at AND c2.id > c.id))
  )
)
DELETE FROM companies 
WHERE id IN (SELECT id FROM duplicates_to_delete);

-- Step 3: Add unique constraint to prevent future duplicates
ALTER TABLE companies ADD CONSTRAINT companies_user_id_unique UNIQUE (user_id);

-- Step 4: Update RLS policies to ensure better data consistency
DROP POLICY IF EXISTS "Company owners can view full company data" ON companies;
DROP POLICY IF EXISTS "Users can view basic company info" ON companies;

CREATE POLICY "Company owners can view full company data" ON companies
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view basic company info" ON companies
  FOR SELECT USING (
    account_status = 'active' AND 
    (is_profile_complete = true OR auth.uid() = user_id)
  );