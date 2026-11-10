CREATE OR REPLACE FUNCTION public.get_public_pricing()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
SELECT jsonb_build_object(
 'jobs', (SELECT jsonb_build_object('points_required_per_job',points_required_per_job,'duration_packages',duration_packages) FROM public.job_posting_settings WHERE is_active=true ORDER BY updated_at DESC LIMIT 1),
 'boost', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name,'price_inr',price_inr,'boost_days',boost_days,'boost_level',boost_level,'most_popular',most_popular) ORDER BY price_inr,sort_order) FROM public.boost_packages WHERE is_active=true),'[]'::jsonb),
 'verification', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name,'price_inr',price_inr,'validity_days',validity_days,'badge_color',badge_color,'most_popular',most_popular) ORDER BY price_inr,sort_order) FROM public.verification_packages WHERE is_active=true AND validity_days>0),'[]'::jsonb),
 'interview', (SELECT jsonb_build_object('points_per_interview',points_per_interview,'points_per_minute',points_per_minute,'minimum_points',minimum_points,'enable_duration_pricing',enable_duration_pricing) FROM public.interview_pricing_settings WHERE is_active=true ORDER BY updated_at DESC LIMIT 1),
 'ai', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name,'price_inr',price_inr,'messages_per_month',messages_per_month,'voice_playback_per_month',voice_playback_per_month,'voice_input_per_month',voice_input_per_month,'image_analysis_per_month',image_analysis_per_month,'ai_image_generation_per_month',ai_image_generation_per_month,'ai_model_tier',ai_model_tier,'priority_support',priority_support,'features',features) ORDER BY price_inr,display_order) FROM public.ai_chat_plans WHERE is_active=true),'[]'::jsonb),
 'settings', COALESCE((SELECT jsonb_object_agg(setting_key,setting_value) FROM public.app_settings WHERE setting_key IN ('api_subscription_price','api_trial_days','api_free_calls','api_call_price','search_engine_indexing_price')),'{}'::jsonb),
 'recruitment', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name,'price',price,'period',period,'description',description,'features',features,'is_recommended',is_recommended) ORDER BY display_order) FROM public.recruitment_packages WHERE is_active=true),'[]'::jsonb),
 'domain', (SELECT jsonb_build_object('sales_enabled',sales_enabled,'protection_price_per_year',protection_price_per_year,'currency',currency) FROM public.domain_pricing_settings ORDER BY updated_at DESC LIMIT 1)
);
$$;
REVOKE ALL ON FUNCTION public.get_public_pricing() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_pricing() TO anon, authenticated, service_role;
COMMENT ON FUNCTION public.get_public_pricing() IS 'Read-only public commercial catalog. Only allowlisted prices and plan details; no customer data, credentials or provider costs.';