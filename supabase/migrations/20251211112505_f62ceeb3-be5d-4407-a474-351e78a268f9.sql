-- Drop existing restrictive INSERT policy
DROP POLICY IF EXISTS "Service role can insert OTP" ON whatsapp_otp_verifications;

-- Create new permissive INSERT policy for signup/verification OTPs
CREATE POLICY "Anyone can insert OTP" 
ON whatsapp_otp_verifications 
FOR INSERT 
TO anon, authenticated 
WITH CHECK (true);

-- Drop existing restrictive UPDATE policy
DROP POLICY IF EXISTS "Service role can update OTP" ON whatsapp_otp_verifications;

-- Create new permissive UPDATE policy for OTP verification attempts
CREATE POLICY "Anyone can update OTP" 
ON whatsapp_otp_verifications 
FOR UPDATE 
TO anon, authenticated 
USING (true)
WITH CHECK (true);