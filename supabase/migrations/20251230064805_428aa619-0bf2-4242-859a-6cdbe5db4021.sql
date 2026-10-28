-- Add policy to allow all authenticated users to READ referral_settings
-- This is needed so users can see the commission percentage on their dashboard
CREATE POLICY "Allow authenticated users to read referral settings"
ON public.referral_settings
FOR SELECT
TO authenticated
USING (true);