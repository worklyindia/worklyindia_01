-- Fix search_path for the update_app_reviews_updated_at function
CREATE OR REPLACE FUNCTION update_app_reviews_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;