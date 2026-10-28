-- Drop existing policy that uses 'public' role
DROP POLICY IF EXISTS "Allow public read for signup triggers" ON whatsapp_automation_rules;

-- Create new policy with explicit anon role for sign-up triggers
CREATE POLICY "Allow anon read for signup triggers"
ON whatsapp_automation_rules
FOR SELECT
TO anon
USING (trigger_event IN ('user_signup_otp', 'company_signup_otp'));