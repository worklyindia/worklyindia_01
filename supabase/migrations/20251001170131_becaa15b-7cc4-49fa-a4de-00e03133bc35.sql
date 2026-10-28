-- Create table for referral wallet adjustments (Add/Deduct Balance)
CREATE TABLE IF NOT EXISTS public.referral_wallet_adjustments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  admin_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('add', 'deduct')),
  reason TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.referral_wallet_adjustments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own adjustments"
  ON public.referral_wallet_adjustments
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all adjustments"
  ON public.referral_wallet_adjustments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Admins can create adjustments"
  ON public.referral_wallet_adjustments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'owner')
    )
  );

-- Create index for faster queries
CREATE INDEX idx_referral_wallet_adjustments_user_id ON public.referral_wallet_adjustments(user_id);
CREATE INDEX idx_referral_wallet_adjustments_created_at ON public.referral_wallet_adjustments(created_at DESC);

-- Create function to update referral wallet balance
CREATE OR REPLACE FUNCTION public.adjust_referral_wallet_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update referral wallet balance
  IF NEW.adjustment_type = 'add' THEN
    UPDATE public.referral_wallets
    SET 
      balance_amount = balance_amount + NEW.amount,
      updated_at = now()
    WHERE user_id = NEW.user_id;
  ELSE
    UPDATE public.referral_wallets
    SET 
      balance_amount = GREATEST(balance_amount - NEW.amount, 0),
      updated_at = now()
    WHERE user_id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to automatically update wallet when adjustment is made
CREATE TRIGGER on_referral_wallet_adjustment
  AFTER INSERT ON public.referral_wallet_adjustments
  FOR EACH ROW
  EXECUTE FUNCTION public.adjust_referral_wallet_balance();