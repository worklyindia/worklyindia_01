-- Fix commission calculation by updating data types to NUMERIC for proper decimal handling

-- 1. Update referral_commissions table to use NUMERIC
ALTER TABLE public.referral_commissions 
ALTER COLUMN commission_amount TYPE NUMERIC(10,2) USING commission_amount::numeric;

-- 2. Update referral_wallets table to use NUMERIC  
ALTER TABLE public.referral_wallets 
ALTER COLUMN balance_amount TYPE NUMERIC(10,2) USING balance_amount::numeric,
ALTER COLUMN total_earned TYPE NUMERIC(10,2) USING total_earned::numeric,
ALTER COLUMN total_withdrawn TYPE NUMERIC(10,2) USING total_withdrawn::numeric;

-- 3. Update referral_codes table to use NUMERIC
ALTER TABLE public.referral_codes 
ALTER COLUMN total_commission_earned TYPE NUMERIC(10,2) USING total_commission_earned::numeric;

-- 4. Create the corrected commission processing function
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
  v_commission_amount numeric(10,2);
BEGIN
  -- Get referrer for this user
  SELECT referrer_id INTO v_referrer_id
  FROM user_referrals 
  WHERE referred_user_id = p_referred_user_id AND is_active = true
  LIMIT 1;
  
  IF v_referrer_id IS NOT NULL THEN
    -- Calculate 50% commission using proper decimal arithmetic
    -- Payment amount is in paise, convert to rupees and calculate 50%
    v_commission_amount := ROUND((p_payment_amount::numeric / 100) / 2, 2);
    
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