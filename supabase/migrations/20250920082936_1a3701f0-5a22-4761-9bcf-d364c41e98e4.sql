-- Create referral codes table
CREATE TABLE public.referral_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  referral_code TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  total_referrals INTEGER NOT NULL DEFAULT 0,
  total_commission_earned INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user referrals table
CREATE TABLE public.user_referrals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID NOT NULL,
  referred_user_id UUID NOT NULL,
  referral_code_used TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create referral commissions table
CREATE TABLE public.referral_commissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID NOT NULL,
  referred_user_id UUID NOT NULL,
  payment_id TEXT,
  commission_amount INTEGER NOT NULL,
  source_payment_amount INTEGER NOT NULL,
  source_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create referral wallets table
CREATE TABLE public.referral_wallets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  balance_amount INTEGER NOT NULL DEFAULT 0,
  total_earned INTEGER NOT NULL DEFAULT 0,
  total_withdrawn INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_wallets ENABLE ROW LEVEL SECURITY;

-- RLS Policies for referral_codes
CREATE POLICY "Users can view their own referral codes" 
ON public.referral_codes FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own referral codes" 
ON public.referral_codes FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own referral codes" 
ON public.referral_codes FOR UPDATE 
USING (auth.uid() = user_id);

-- RLS Policies for user_referrals
CREATE POLICY "Users can view referrals they made" 
ON public.user_referrals FOR SELECT 
USING (auth.uid() = referrer_id);

CREATE POLICY "System can create referral relationships" 
ON public.user_referrals FOR INSERT 
WITH CHECK (true);

-- RLS Policies for referral_commissions
CREATE POLICY "Users can view their own commissions" 
ON public.referral_commissions FOR SELECT 
USING (auth.uid() = referrer_id);

CREATE POLICY "System can create commissions" 
ON public.referral_commissions FOR INSERT 
WITH CHECK (true);

CREATE POLICY "System can update commissions" 
ON public.referral_commissions FOR UPDATE 
USING (true);

-- RLS Policies for referral_wallets
CREATE POLICY "Users can view their own referral wallet" 
ON public.referral_wallets FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own referral wallet" 
ON public.referral_wallets FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can update referral wallets" 
ON public.referral_wallets FOR UPDATE 
USING (true);

-- Create function to generate unique referral code
CREATE OR REPLACE FUNCTION public.generate_unique_referral_code(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_company_name text;
  v_prefix text;
  v_suffix text;
  v_exists boolean;
BEGIN
  -- Get company name for prefix
  SELECT LEFT(UPPER(company_name), 3) INTO v_prefix
  FROM companies 
  WHERE user_id = p_user_id;
  
  IF v_prefix IS NULL THEN
    v_prefix := 'REF';
  END IF;
  
  -- Generate unique code
  LOOP
    v_suffix := UPPER(substring(encode(gen_random_bytes(3), 'base64'), 1, 5));
    v_code := v_prefix || v_suffix;
    
    SELECT EXISTS(SELECT 1 FROM referral_codes WHERE referral_code = v_code) INTO v_exists;
    
    IF NOT v_exists THEN
      EXIT;
    END IF;
  END LOOP;
  
  RETURN v_code;
END;
$$;

-- Create function to validate referral code
CREATE OR REPLACE FUNCTION public.validate_referral_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_referrer_id uuid;
  v_company_name text;
BEGIN
  -- Check if code exists and is active
  SELECT rc.user_id, c.company_name
  INTO v_referrer_id, v_company_name
  FROM referral_codes rc
  LEFT JOIN companies c ON c.user_id = rc.user_id
  WHERE rc.referral_code = p_code AND rc.is_active = true;
  
  IF v_referrer_id IS NULL THEN
    v_result := jsonb_build_object(
      'valid', false,
      'message', 'Invalid referral code'
    );
  ELSE
    v_result := jsonb_build_object(
      'valid', true,
      'referrer_id', v_referrer_id,
      'company_name', COALESCE(v_company_name, 'Company')
    );
  END IF;
  
  RETURN v_result;
END;
$$;

-- Create function to process referral commission
CREATE OR REPLACE FUNCTION public.process_referral_commission(
  p_referred_user_id uuid,
  p_payment_amount integer,
  p_payment_id text,
  p_source_type text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_id uuid;
  v_commission_amount integer;
BEGIN
  -- Get referrer for this user
  SELECT referrer_id INTO v_referrer_id
  FROM user_referrals 
  WHERE referred_user_id = p_referred_user_id AND is_active = true
  LIMIT 1;
  
  IF v_referrer_id IS NOT NULL THEN
    -- Calculate 50% commission
    v_commission_amount := p_payment_amount / 2;
    
    -- Create commission record
    INSERT INTO referral_commissions (
      referrer_id,
      referred_user_id,
      payment_id,
      commission_amount,
      source_payment_amount,
      source_type,
      status
    ) VALUES (
      v_referrer_id,
      p_referred_user_id,
      p_payment_id,
      v_commission_amount,
      p_payment_amount,
      p_source_type,
      'completed'
    );
    
    -- Update referral wallet
    INSERT INTO referral_wallets (user_id, balance_amount, total_earned)
    VALUES (v_referrer_id, v_commission_amount, v_commission_amount)
    ON CONFLICT (user_id)
    DO UPDATE SET
      balance_amount = referral_wallets.balance_amount + v_commission_amount,
      total_earned = referral_wallets.total_earned + v_commission_amount,
      updated_at = now();
    
    -- Update referral code stats
    UPDATE referral_codes SET
      total_commission_earned = total_commission_earned + v_commission_amount,
      updated_at = now()
    WHERE user_id = v_referrer_id;
  END IF;
END;
$$;