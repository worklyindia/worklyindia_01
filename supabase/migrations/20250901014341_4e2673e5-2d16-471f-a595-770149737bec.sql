-- Create wallets table for user points balance
CREATE TABLE public.wallets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  balance_points INTEGER NOT NULL DEFAULT 0,
  total_purchased INTEGER NOT NULL DEFAULT 0,
  total_spent INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create transactions table for payment history
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  txn_id TEXT UNIQUE,
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  razorpay_signature TEXT,
  amount INTEGER NOT NULL,
  points INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_method TEXT DEFAULT 'razorpay',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Wallet policies
CREATE POLICY "Users can view their own wallet" 
ON public.wallets 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own wallet" 
ON public.wallets 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own wallet" 
ON public.wallets 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "System can update wallets" 
ON public.wallets 
FOR UPDATE 
USING (true);

-- Transaction policies
CREATE POLICY "Users can view their own transactions" 
ON public.transactions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "System can insert transactions" 
ON public.transactions 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "System can update transactions" 
ON public.transactions 
FOR UPDATE 
USING (true);

-- Function to increment wallet points
CREATE OR REPLACE FUNCTION public.increment_wallet_points(p_user_id UUID, p_points INTEGER, p_amount INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  INSERT INTO public.wallets (user_id, balance_points, total_purchased)
  VALUES (p_user_id, p_points, p_amount)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    balance_points = wallets.balance_points + p_points,
    total_purchased = wallets.total_purchased + p_amount,
    updated_at = now();
END;
$$;

-- Add triggers for updated_at
CREATE TRIGGER update_wallets_updated_at
BEFORE UPDATE ON public.wallets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at
BEFORE UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();