INSERT INTO public.push_lifecycle_templates (event_type, enabled, title, body, button_text, button_url)
VALUES ('marketing_referral', true, 'Refer friends, earn rewards', 'Hello {{name}}, share your Workly India referral code and earn rewards for every friend who joins.', 'Share Now', '/referral')
ON CONFLICT (event_type) DO NOTHING;

INSERT INTO public.email_lifecycle_templates (event_type, enabled, subject, body, button_text, button_url)
VALUES ('marketing_referral', true, 'Refer friends and earn rewards', 'Hello {{name}},<br><br>Share your Workly India referral code with friends. Every friend who joins using your code brings you rewards.', 'Share Now', '/referral')
ON CONFLICT (event_type) DO NOTHING;

INSERT INTO public.telegram_lifecycle_templates (event_type, enabled, title, body, button_text, button_url)
VALUES ('marketing_referral', true, 'Refer friends, earn rewards', 'Hello {{name}}, share your Workly India referral code and earn rewards for every friend who joins.', 'Share Now', '/referral')
ON CONFLICT (event_type) DO NOTHING;