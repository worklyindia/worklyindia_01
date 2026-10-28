INSERT INTO public.email_lifecycle_templates (event_type, subject, body, button_text, button_url, enabled) VALUES
('refund_initiated','Refund started 🔄','Amount : {{amount}}
Order ID : {{order_id}}
Date : {{date}}
It will reach your account in 5-7 working days.','View Wallet','/wallet',true),
('subscription_expiring','Your plan is ending soon 📆','Plan : {{plan}}
Ends on : {{expiry_date}}
Renew now to keep your benefits.','Renew Plan','/employer-portal',true),
('weekly_digest','Your weekly jobs are here 📬','Hi {{name}}, new jobs were posted this week. Top pick : {{job_title}} ({{location}})','See Jobs','/jobs',true)
ON CONFLICT (event_type) DO NOTHING;
INSERT INTO public.push_lifecycle_templates (event_type, title, body, button_text, button_url, enabled)
SELECT event_type, subject, body, button_text, button_url, true FROM public.email_lifecycle_templates
WHERE event_type IN ('refund_initiated','subscription_expiring','weekly_digest','jobseeker_2fa_otp','employer_2fa_otp')
ON CONFLICT (event_type) DO NOTHING;
INSERT INTO public.telegram_lifecycle_templates (event_type, title, body, button_text, button_url, enabled)
SELECT event_type, subject, body, button_text, button_url, true FROM public.email_lifecycle_templates
WHERE event_type IN ('refund_initiated','subscription_expiring','weekly_digest','jobseeker_2fa_otp','employer_2fa_otp')
ON CONFLICT (event_type) DO NOTHING;