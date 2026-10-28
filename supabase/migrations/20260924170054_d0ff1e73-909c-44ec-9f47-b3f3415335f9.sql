GRANT SELECT ON public.job_alert_sent_jobs, public.job_alert_daily_digests TO authenticated;
CREATE POLICY "Users view own sent job alerts" ON public.job_alert_sent_jobs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users view own daily digests" ON public.job_alert_daily_digests FOR SELECT TO authenticated USING (auth.uid() = user_id);