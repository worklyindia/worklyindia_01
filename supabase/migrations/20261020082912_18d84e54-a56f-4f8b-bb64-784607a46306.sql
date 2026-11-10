GRANT SELECT ON public.job_posting_settings TO anon;
GRANT SELECT ON public.referral_settings TO anon;

CREATE POLICY "Public can read active job posting settings"
ON public.job_posting_settings
FOR SELECT
TO anon, authenticated
USING (is_active = true);

CREATE POLICY "Public can read active referral settings"
ON public.referral_settings
FOR SELECT
TO anon, authenticated
USING (is_active = true);