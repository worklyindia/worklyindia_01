-- Create tables for points system to replace wallet system
CREATE TABLE IF NOT EXISTS public.user_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points_balance INTEGER NOT NULL DEFAULT 0,
  total_points_purchased INTEGER NOT NULL DEFAULT 0,
  total_points_spent INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create points transaction history table
CREATE TABLE IF NOT EXISTS public.points_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('purchase', 'spend', 'expire')),
  points_amount INTEGER NOT NULL,
  points_balance_after INTEGER NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '12 months'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create points packages table for fixed packs
CREATE TABLE IF NOT EXISTS public.points_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  points_amount INTEGER NOT NULL,
  price_inr INTEGER NOT NULL, -- price in paise (1 rupee = 100 paise)
  discount_percentage INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default points packages
INSERT INTO public.points_packages (name, points_amount, price_inr, discount_percentage, sort_order) VALUES
('Basic Pack', 100, 10000, 0, 1),
('Value Pack', 250, 24000, 4, 2),
('Popular Pack', 500, 45000, 10, 3),
('Premium Pack', 1000, 85000, 15, 4)
ON CONFLICT DO NOTHING;

-- Enable RLS
ALTER TABLE public.user_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.points_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.points_packages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_points
CREATE POLICY "Users can view their own points" ON public.user_points
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own points" ON public.user_points
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own points" ON public.user_points
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for points_transactions
CREATE POLICY "Users can view their own transactions" ON public.points_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert transactions" ON public.points_transactions
  FOR INSERT WITH CHECK (true);

-- RLS Policies for points_packages (public read)
CREATE POLICY "Anyone can view active packages" ON public.points_packages
  FOR SELECT USING (is_active = true);

-- Create function to handle points balance updates
CREATE OR REPLACE FUNCTION public.update_points_balance()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_user_points_timestamp
  BEFORE UPDATE ON public.user_points
  FOR EACH ROW
  EXECUTE FUNCTION public.update_points_balance();

-- Create function to handle points expiry (for future cron job)
CREATE OR REPLACE FUNCTION public.expire_old_points()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER := 0;
BEGIN
  -- This function can be called by a cron job to expire points
  -- For now, it just marks transactions as expired
  UPDATE public.points_transactions
  SET metadata = metadata || '{"expired": true}'::jsonb
  WHERE expires_at <= now() 
  AND transaction_type = 'purchase'
  AND (metadata->>'expired')::boolean IS NOT TRUE;
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;