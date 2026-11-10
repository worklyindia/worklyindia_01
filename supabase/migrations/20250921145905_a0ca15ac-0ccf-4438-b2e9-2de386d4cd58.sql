-- Create function to generate unique referral code
CREATE OR REPLACE FUNCTION public.generate_unique_referral_code(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_code text;
  code_exists boolean := true;
BEGIN
  -- Generate unique referral code
  WHILE code_exists LOOP
    -- Generate a 6-8 character code using letters and numbers
    new_code := upper(
      substring(md5(random()::text || p_user_id::text || now()::text) from 1 for 3) ||
      lpad(floor(random() * 999 + 1)::text, 3, '0') ||
      substring(md5(random()::text) from 1 for 1)
    );
    
    -- Check if code already exists
    SELECT EXISTS (
      SELECT 1 FROM referral_codes 
      WHERE referral_code = new_code
    ) INTO code_exists;
  END LOOP;
  
  RETURN new_code;
END;
$function$;