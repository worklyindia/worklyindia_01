-- Add two_factor_enabled column to user_settings table
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS two_factor_enabled boolean DEFAULT false;

-- Add two_factor_enabled column to employer_settings table  
ALTER TABLE public.employer_settings
ADD COLUMN IF NOT EXISTS two_factor_enabled boolean DEFAULT false;

-- Create OTP codes table for 2FA verification
CREATE TABLE IF NOT EXISTS public.otp_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on otp_codes
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_otp_codes_user_id ON public.otp_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_otp_codes_expires_at ON public.otp_codes(expires_at);

-- RLS Policies for otp_codes - only allow users to see their own codes
CREATE POLICY "Users can view their own OTP codes" 
ON public.otp_codes 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own OTP codes" 
ON public.otp_codes 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own OTP codes" 
ON public.otp_codes 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own OTP codes" 
ON public.otp_codes 
FOR DELETE 
USING (auth.uid() = user_id);

-- Also add service role access for edge functions
CREATE POLICY "Service role can manage all OTP codes"
ON public.otp_codes
FOR ALL
USING (true)
WITH CHECK (true);