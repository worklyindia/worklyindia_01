-- Fix the generate_unique_referral_code function to use available PostgreSQL functions
CREATE OR REPLACE FUNCTION public.generate_unique_referral_code(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_code text;
  v_company_name text;
  v_prefix text;
  v_suffix text;
  v_exists boolean;
  v_random_num integer;
  v_timestamp_part text;
BEGIN
  -- Get company name for prefix
  SELECT LEFT(UPPER(REGEXP_REPLACE(company_name, '[^A-Za-z0-9]', '', 'g')), 3) INTO v_prefix
  FROM companies 
  WHERE user_id = p_user_id;
  
  IF v_prefix IS NULL OR v_prefix = '' THEN
    v_prefix := 'REF';
  END IF;
  
  -- Generate unique code using available functions
  LOOP
    -- Generate random number and timestamp-based suffix
    v_random_num := floor(random() * 999999)::integer;
    v_timestamp_part := RIGHT(EXTRACT(EPOCH FROM now())::text, 6);
    
    -- Create suffix using MD5 hash of random components
    v_suffix := UPPER(LEFT(MD5(v_random_num::text || v_timestamp_part || p_user_id::text), 5));
    
    -- Ensure suffix contains only alphanumeric characters
    v_suffix := REGEXP_REPLACE(v_suffix, '[^A-Z0-9]', '', 'g');
    
    -- If suffix is too short, pad with random characters
    IF LENGTH(v_suffix) < 5 THEN
      v_suffix := v_suffix || UPPER(LEFT(MD5(random()::text), 5 - LENGTH(v_suffix)));
    END IF;
    
    v_code := v_prefix || LEFT(v_suffix, 5);
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM referral_codes WHERE referral_code = v_code) INTO v_exists;
    
    IF NOT v_exists THEN
      EXIT;
    END IF;
  END LOOP;
  
  RETURN v_code;
END;
$function$;

-- Create missing referral tables if they don't exist
CREATE TABLE IF NOT EXISTS public.referral_wallets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  balance_amount integer NOT NULL DEFAULT 0,
  total_earned integer NOT NULL DEFAULT 0,
  total_withdrawn integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_referrals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id uuid NOT NULL,
  referred_user_id uuid NOT NULL,
  referral_code_used text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on referral tables
ALTER TABLE public.referral_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_referrals ENABLE ROW LEVEL SECURITY;