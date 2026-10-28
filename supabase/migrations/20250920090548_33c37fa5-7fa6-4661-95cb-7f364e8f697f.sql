-- Fix the referral code generation function to use proper random generation
CREATE OR REPLACE FUNCTION public.generate_unique_referral_code(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_code text;
  v_company_name text;
  v_prefix text;
  v_suffix text;
  v_exists boolean;
  v_counter integer := 0;
BEGIN
  -- Get company name for prefix
  SELECT LEFT(UPPER(REGEXP_REPLACE(company_name, '[^A-Za-z0-9]', '', 'g')), 3) INTO v_prefix
  FROM companies 
  WHERE user_id = p_user_id;
  
  IF v_prefix IS NULL OR LENGTH(v_prefix) < 3 THEN
    v_prefix := 'REF';
  END IF;
  
  -- Generate unique code using uuid and substring
  LOOP
    v_suffix := UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 5));
    v_code := v_prefix || v_suffix;
    
    SELECT EXISTS(SELECT 1 FROM referral_codes WHERE referral_code = v_code) INTO v_exists;
    
    -- Safety counter to prevent infinite loop
    v_counter := v_counter + 1;
    IF NOT v_exists OR v_counter > 100 THEN
      EXIT;
    END IF;
  END LOOP;
  
  RETURN v_code;
END;
$function$;

-- Ensure referral_wallets table exists with proper structure
CREATE TABLE IF NOT EXISTS public.referral_wallets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  balance_amount integer NOT NULL DEFAULT 0,
  total_earned integer NOT NULL DEFAULT 0,
  total_withdrawn integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS for referral_wallets
ALTER TABLE public.referral_wallets ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for referral_wallets
CREATE POLICY "Users can view their own referral wallet" ON public.referral_wallets
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own referral wallet" ON public.referral_wallets
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own referral wallet" ON public.referral_wallets
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can manage referral wallets" ON public.referral_wallets
FOR ALL USING (true);

-- Ensure user_referrals table exists with proper structure
CREATE TABLE IF NOT EXISTS public.user_referrals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id uuid NOT NULL,
  referred_user_id uuid NOT NULL,
  referral_code_used text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(referred_user_id)
);

-- Enable RLS for user_referrals
ALTER TABLE public.user_referrals ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_referrals
CREATE POLICY "Users can view their referrals" ON public.user_referrals
FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_user_id);

CREATE POLICY "System can create referrals" ON public.user_referrals
FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update referrals" ON public.user_referrals
FOR UPDATE USING (true);