-- Create guest_transactions table for guest payments
CREATE TABLE public.guest_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  razorpay_order_id TEXT NOT NULL UNIQUE,
  razorpay_payment_id TEXT,
  razorpay_signature TEXT,
  amount INTEGER NOT NULL,
  points_amount INTEGER NOT NULL DEFAULT 0,
  package_name TEXT NOT NULL,
  mobile TEXT NOT NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable Row Level Security
ALTER TABLE public.guest_transactions ENABLE ROW LEVEL SECURITY;

-- Create policy for guest transactions (allow read/write for all since these are guest payments)
CREATE POLICY "Allow guest transaction operations" 
ON public.guest_transactions 
FOR ALL 
USING (true);

-- Create index for better performance
CREATE INDEX idx_guest_transactions_order_id ON public.guest_transactions(razorpay_order_id);
CREATE INDEX idx_guest_transactions_status ON public.guest_transactions(status);
CREATE INDEX idx_guest_transactions_created_at ON public.guest_transactions(created_at);