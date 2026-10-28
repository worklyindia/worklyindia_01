-- Add public SELECT policy for signup OTP triggers
-- This allows unauthenticated users to check if signup OTP is required
CREATE POLICY "Allow public read for signup triggers"
ON whatsapp_automation_rules
FOR SELECT
TO public
USING (trigger_event IN ('user_signup_otp', 'company_signup_otp'));