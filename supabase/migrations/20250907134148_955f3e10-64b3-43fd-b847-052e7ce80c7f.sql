-- Add verification fields to companies table
ALTER TABLE public.companies 
ADD COLUMN verified_plan_start TIMESTAMP WITH TIME ZONE,
ADD COLUMN verified_plan_end TIMESTAMP WITH TIME ZONE,
ADD COLUMN badge_color TEXT;

-- Create verification packages table
CREATE TABLE public.verification_packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  price_inr INTEGER NOT NULL,
  validity_days INTEGER NOT NULL,
  badge_color TEXT NOT NULL DEFAULT 'gold',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for verification packages
ALTER TABLE public.verification_packages ENABLE ROW LEVEL SECURITY;

-- Create policy for viewing active packages
CREATE POLICY "Anyone can view active verification packages" 
ON public.verification_packages 
FOR SELECT 
USING (is_active = true);

-- Create verification purchases table
CREATE TABLE public.verification_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  verification_package_id UUID NOT NULL,
  amount_paid INTEGER NOT NULL,
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  razorpay_signature TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for verification purchases
ALTER TABLE public.verification_purchases ENABLE ROW LEVEL SECURITY;

-- Create policies for verification purchases
CREATE POLICY "Users can view their own verification purchases" 
ON public.verification_purchases 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own verification purchases" 
ON public.verification_purchases 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can update verification purchases" 
ON public.verification_purchases 
FOR UPDATE 
USING (true);

-- Insert default verification package
INSERT INTO public.verification_packages (
  name,
  price_inr,
  validity_days,
  badge_color,
  is_active,
  sort_order
) VALUES (
  'Verified Employer Badge',
  100,
  30,
  'gold',
  true,
  1
);

-- Create function to activate company verification
CREATE OR REPLACE FUNCTION public.activate_company_verification(
  p_user_id UUID,
  p_verification_package_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  package_record RECORD;
BEGIN
  -- Get package details
  SELECT * INTO package_record FROM verification_packages WHERE id = p_verification_package_id;
  
  IF package_record.id IS NULL THEN
    RAISE EXCEPTION 'Verification package not found';
  END IF;
  
  -- Update company verification status
  UPDATE companies SET
    is_verified = true,
    verified_plan_start = NOW(),
    verified_plan_end = NOW() + (package_record.validity_days || ' days')::INTERVAL,
    badge_color = package_record.badge_color,
    updated_at = NOW()
  WHERE user_id = p_user_id;
  
  -- Mark purchase as active
  UPDATE verification_purchases SET
    status = 'active',
    updated_at = NOW()
  WHERE user_id = p_user_id 
    AND verification_package_id = p_verification_package_id
    AND status = 'pending';
END;
$$;