-- Update all existing company_reviews to use the current full_name from profiles
UPDATE company_reviews cr
SET reviewer_name = p.full_name
FROM profiles p
WHERE cr.user_id = p.user_id
AND cr.reviewer_name != p.full_name
AND p.full_name IS NOT NULL;

-- Create a function to automatically update reviewer_name when profile full_name changes
CREATE OR REPLACE FUNCTION sync_reviewer_name_on_profile_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Update all reviews by this user with the new full_name
  UPDATE company_reviews
  SET reviewer_name = NEW.full_name
  WHERE user_id = NEW.user_id
  AND NEW.full_name IS NOT NULL;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to sync reviewer_name when profile full_name is updated
DROP TRIGGER IF EXISTS trigger_sync_reviewer_name ON profiles;
CREATE TRIGGER trigger_sync_reviewer_name
AFTER UPDATE OF full_name ON profiles
FOR EACH ROW
WHEN (OLD.full_name IS DISTINCT FROM NEW.full_name)
EXECUTE FUNCTION sync_reviewer_name_on_profile_update();