-- Create referral settings table
CREATE TABLE public.referral_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  commission_percentage NUMERIC(5,2) NOT NULL DEFAULT 50.00,
  is_active BOOLEAN NOT NULL DEFAULT true,
  minimum_commission_amount NUMERIC(10,2) DEFAULT 1.00,
  maximum_commission_amount NUMERIC(10,2) DEFAULT 1000.00,
  commission_calculation_method TEXT NOT NULL DEFAULT 'percentage',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Constraints
  CONSTRAINT commission_percentage_valid CHECK (commission_percentage >= 0 AND commission_percentage <= 100),
  CONSTRAINT commission_amounts_valid CHECK (minimum_commission_amount >= 0 AND maximum_commission_amount >= minimum_commission_amount)
);

-- Enable RLS
ALTER TABLE public.referral_settings ENABLE ROW LEVEL SECURITY;

-- Create policies - only admins can manage referral settings
CREATE POLICY "Only admins can manage referral settings"
ON public.referral_settings
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'owner')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'owner')
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_referral_settings_updated_at
  BEFORE UPDATE ON public.referral_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default settings
INSERT INTO public.referral_settings (
  commission_percentage,
  is_active,
  commission_calculation_method,
  created_by
) VALUES (
  50.00,
  true,
  'percentage',
  (SELECT user_id FROM public.admin_users WHERE role = 'owner' LIMIT 1)
);

-- Update the commission calculation function to use dynamic settings
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
    -- Payment amount is in paise, convert to rupees and calculate percentage
    v_commission_amount := ROUND(
      (p_payment_amount::numeric / 100) * (v_commission_percentage / 100), 
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