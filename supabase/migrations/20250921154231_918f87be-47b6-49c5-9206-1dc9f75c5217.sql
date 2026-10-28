-- Fix referral commission calculation to use proper decimal arithmetic
CREATE OR REPLACE FUNCTION public.process_referral_commission(p_referred_user_id uuid, p_payment_amount integer, p_payment_id text, p_source_type text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    -- Calculate 50% commission using decimal arithmetic and round to nearest integer
    v_commission_amount := ROUND(p_payment_amount::decimal / 2.0);
    
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
$function$;