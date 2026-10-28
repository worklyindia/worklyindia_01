-- Fix security warning for generate_job_slug function
CREATE OR REPLACE FUNCTION generate_job_slug()
RETURNS text AS $$
BEGIN
  RETURN encode(gen_random_bytes(12), 'base64url');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;