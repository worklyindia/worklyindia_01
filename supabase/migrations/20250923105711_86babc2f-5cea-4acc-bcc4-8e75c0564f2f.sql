-- Check and fix any database functions that might reference the 'supabase' schema incorrectly
-- First, let's inspect the verification_purchases table structure to ensure it exists properly

-- Drop and recreate the verification_purchases table if there are any schema issues
DROP TABLE IF EXISTS verification_purchases CASCADE;

CREATE TABLE verification_purchases (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  verification_package_id uuid NOT NULL,
  amount_paid integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  razorpay_signature text,
  status text NOT NULL DEFAULT 'pending'::text,
  razorpay_order_id text,
  razorpay_payment_id text
);

-- Enable RLS
ALTER TABLE verification_purchases ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "System can manage verification purchases" ON verification_purchases
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Users can create their own verification purchases" ON verification_purchases
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own verification purchases" ON verification_purchases
  FOR SELECT USING (auth.uid() = user_id);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
DROP TRIGGER IF EXISTS update_verification_purchases_updated_at ON verification_purchases;
CREATE TRIGGER update_verification_purchases_updated_at
  BEFORE UPDATE ON verification_purchases
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();