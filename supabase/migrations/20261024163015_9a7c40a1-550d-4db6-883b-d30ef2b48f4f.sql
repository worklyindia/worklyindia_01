ALTER FUNCTION public.get_public_pricing() SECURITY INVOKER;
GRANT SELECT ON public.job_posting_settings, public.boost_packages, public.verification_packages, public.ai_chat_plans, public.app_settings, public.recruitment_packages, public.domain_pricing_settings TO anon, authenticated;
GRANT SELECT ON public.interview_pricing_settings TO anon;
CREATE POLICY "Public can view active interview prices" ON public.interview_pricing_settings FOR SELECT TO anon USING (is_active=true);