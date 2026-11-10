GRANT SELECT ON public.ai_chat_plans, public.job_posting_settings, public.referral_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_chat_plans, public.job_posting_settings, public.referral_settings TO authenticated;
GRANT ALL ON public.ai_chat_plans, public.job_posting_settings, public.referral_settings TO service_role;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_chat_plans, public.job_posting_settings, public.referral_settings;