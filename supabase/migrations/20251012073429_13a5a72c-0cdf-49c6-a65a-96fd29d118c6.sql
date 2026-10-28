-- Create referral payment settings table
CREATE TABLE IF NOT EXISTS public.referral_payment_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL UNIQUE,
  mobile TEXT,
  email TEXT,
  bank_name TEXT,
  account_number TEXT,
  ifsc_code TEXT,
  upi_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.referral_payment_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payment settings
CREATE POLICY "Users can view their own payment settings"
  ON public.referral_payment_settings
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own payment settings"
  ON public.referral_payment_settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own payment settings"
  ON public.referral_payment_settings
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all payment settings"
  ON public.referral_payment_settings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Create withdrawal requests table
CREATE TABLE IF NOT EXISTS public.referral_withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  withdrawal_id TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  payment_settings JSONB,
  processed_by UUID REFERENCES auth.users,
  processed_at TIMESTAMPTZ,
  failure_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.referral_withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for withdrawal requests
CREATE POLICY "Users can view their own withdrawal requests"
  ON public.referral_withdrawal_requests
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own withdrawal requests"
  ON public.referral_withdrawal_requests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all withdrawal requests"
  ON public.referral_withdrawal_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Admins can update withdrawal requests"
  ON public.referral_withdrawal_requests
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Function to generate unique withdrawal ID
CREATE OR REPLACE FUNCTION public.generate_withdrawal_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id TEXT;
  counter INTEGER;
  date_part TEXT;
BEGIN
  date_part := TO_CHAR(NOW(), 'YYYYMMDD');
  
  -- Get the count of withdrawals today
  SELECT COUNT(*) + 1 INTO counter
  FROM public.referral_withdrawal_requests
  WHERE DATE(created_at) = CURRENT_DATE;
  
  new_id := 'WD-' || date_part || '-' || LPAD(counter::TEXT, 3, '0');
  
  RETURN new_id;
END;
$$;

-- Function to process successful withdrawal
CREATE OR REPLACE FUNCTION public.process_withdrawal_success(
  p_withdrawal_id TEXT,
  p_admin_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_withdrawal RECORD;
  v_result JSONB;
BEGIN
  -- Check admin permission
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = p_admin_id AND role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- Get withdrawal details
  SELECT * INTO v_withdrawal
  FROM public.referral_withdrawal_requests
  WHERE withdrawal_id = p_withdrawal_id;

  IF v_withdrawal IS NULL THEN
    RAISE EXCEPTION 'Withdrawal request not found';
  END IF;

  IF v_withdrawal.status != 'pending' THEN
    RAISE EXCEPTION 'Withdrawal already processed';
  END IF;

  -- Update withdrawal status
  UPDATE public.referral_withdrawal_requests
  SET 
    status = 'success',
    processed_by = p_admin_id,
    processed_at = NOW(),
    updated_at = NOW()
  WHERE withdrawal_id = p_withdrawal_id;

  -- Add entry to referral commissions as withdrawal record
  INSERT INTO public.referral_commissions (
    referrer_id,
    referred_user_id,
    commission_amount,
    source_payment_amount,
    source_type,
    status,
    created_at,
    updated_at
  ) VALUES (
    v_withdrawal.user_id,
    v_withdrawal.user_id,
    -v_withdrawal.amount,
    v_withdrawal.amount,
    'withdrawal',
    'completed',
    NOW(),
    NOW()
  );

  v_result := jsonb_build_object(
    'success', true,
    'withdrawal_id', p_withdrawal_id,
    'status', 'success'
  );

  RETURN v_result;
END;
$$;

-- Function to process failed withdrawal with refund
CREATE OR REPLACE FUNCTION public.process_withdrawal_failure(
  p_withdrawal_id TEXT,
  p_admin_id UUID,
  p_failure_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_withdrawal RECORD;
  v_result JSONB;
BEGIN
  -- Check admin permission
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = p_admin_id AND role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- Get withdrawal details
  SELECT * INTO v_withdrawal
  FROM public.referral_withdrawal_requests
  WHERE withdrawal_id = p_withdrawal_id;

  IF v_withdrawal IS NULL THEN
    RAISE EXCEPTION 'Withdrawal request not found';
  END IF;

  IF v_withdrawal.status != 'pending' THEN
    RAISE EXCEPTION 'Withdrawal already processed';
  END IF;

  -- Update withdrawal status
  UPDATE public.referral_withdrawal_requests
  SET 
    status = 'failed',
    processed_by = p_admin_id,
    processed_at = NOW(),
    failure_reason = p_failure_reason,
    updated_at = NOW()
  WHERE withdrawal_id = p_withdrawal_id;

  -- Refund balance to referral wallet
  UPDATE public.referral_wallets
  SET 
    balance_amount = balance_amount + v_withdrawal.amount,
    updated_at = NOW()
  WHERE user_id = v_withdrawal.user_id;

  -- Add adjustment record
  INSERT INTO public.referral_wallet_adjustments (
    user_id,
    admin_id,
    amount,
    adjustment_type,
    reason,
    created_at
  ) VALUES (
    v_withdrawal.user_id,
    p_admin_id,
    v_withdrawal.amount,
    'add',
    'Withdrawal refund: ' || p_failure_reason,
    NOW()
  );

  v_result := jsonb_build_object(
    'success', true,
    'withdrawal_id', p_withdrawal_id,
    'status', 'failed',
    'refunded_amount', v_withdrawal.amount
  );

  RETURN v_result;
END;
$$;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_referral_payment_settings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_referral_payment_settings_updated_at
  BEFORE UPDATE ON public.referral_payment_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_referral_payment_settings_updated_at();

CREATE TRIGGER update_referral_withdrawal_requests_updated_at
  BEFORE UPDATE ON public.referral_withdrawal_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_referral_payment_settings_updated_at();