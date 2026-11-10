-- Update the profile email to match auth email for the specific user
UPDATE profiles
SET email = 'gohilvishal7600@gmail.com'
WHERE user_id = '1769cddb-7244-4b4b-a86f-e0ca3bc028db';

-- Create a function to sync profile email with auth email
CREATE OR REPLACE FUNCTION sync_profile_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Update profile email when auth email changes
  UPDATE profiles
  SET email = NEW.email
  WHERE user_id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically sync email changes
DROP TRIGGER IF EXISTS on_auth_email_change ON auth.users;
CREATE TRIGGER on_auth_email_change
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION sync_profile_email();