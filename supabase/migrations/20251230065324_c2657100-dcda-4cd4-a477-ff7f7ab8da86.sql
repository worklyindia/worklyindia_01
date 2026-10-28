-- Fix: Update process_referral_commission to handle amount in RUPEES (not paise)
-- The edge functions are sending amount in rupees, so we should NOT divide by 100

CREATE OR REPLACE FUNCTION public.process_referral_commission(
  p_referred_user_id uuid,
  p_payment_amount numeric,
  p_payment_id text,
  p_source_type text DEFAULT 'points_purchase'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_id uuid;
  v_commission_amount numeric(10,2);
  v_commission_percentage numeric(5,2);
  v_settings_record RECORD;
BEGIN
  -- Get current referral settings
  SELECT * INTO v_settings_record
  FROM referral_settings 
  WHERE is_active = true
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Default to 50% if no settings found
  v_commission_percentage := COALESCE(v_settings_record.commission_percentage, 50.00);
  
  -- Get referrer for this user
  SELECT referrer_id INTO v_referrer_id
  FROM user_referrals 
  WHERE referred_user_id = p_referred_user_id AND is_active = true
  LIMIT 1;
  
  IF v_referrer_id IS NOT NULL THEN
    -- Calculate commission using dynamic percentage
    -- FIXED: Payment amount is now in RUPEES (not paise), so don't divide by 100
    v_commission_amount := ROUND(
      p_payment_amount::numeric * (v_commission_percentage / 100), 
      2
    );
    
    -- Apply minimum and maximum limits if set
    IF v_settings_record.minimum_commission_amount IS NOT NULL THEN
      v_commission_amount := GREATEST(v_commission_amount, v_settings_record.minimum_commission_amount);
    END IF;
    
    IF v_settings_record.maximum_commission_amount IS NOT NULL THEN
      v_commission_amount := LEAST(v_commission_amount, v_settings_record.maximum_commission_amount);
    END IF;
    
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