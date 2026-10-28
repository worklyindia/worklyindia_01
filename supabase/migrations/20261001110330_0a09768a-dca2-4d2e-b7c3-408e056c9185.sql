-- whatsapp_otp_verifications: keep anon INSERT (OTP request flow), lock down read/update
DROP POLICY IF EXISTS "Anyone can update OTP" ON public.whatsapp_otp_verifications;
CREATE POLICY "Service role can update OTP" ON public.whatsapp_otp_verifications FOR UPDATE TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Anyone can verify OTP" ON public.whatsapp_otp_verifications;
CREATE POLICY "Service role can read OTP" ON public.whatsapp_otp_verifications FOR SELECT TO service_role USING (true);

-- storage: cached-voice-audio delete/insert only via server
DROP POLICY IF EXISTS "Service role can delete cached audio" ON storage.objects;
CREATE POLICY "Service role can delete cached audio" ON storage.objects FOR DELETE TO service_role USING (bucket_id = 'cached-voice-audio'::text);
DROP POLICY IF EXISTS "Service role can insert cached audio" ON storage.objects;
CREATE POLICY "Service role can insert cached audio" ON storage.objects FOR INSERT TO service_role WITH CHECK (bucket_id = 'cached-voice-audio'::text);