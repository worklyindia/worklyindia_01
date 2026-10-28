-- Fix search_path security issue for the sync function
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;