INSERT INTO public.push_lifecycle_templates (event_type, enabled, title, body, button_text, button_url)
VALUES
  ('profile_viewed', true, 'Your profile was viewed', 'Hello {{name}}, a company just viewed your profile on Workly India. Keep your profile updated to get more views.', 'View Profile', '/profile'),
  ('inactive_user', true, 'We missed you, {{name}}', 'New jobs have been posted on Workly India since your last visit. Come back and check the latest openings.', 'See New Jobs', '/jobs'),
  ('employer_low_balance', true, 'Low wallet balance', 'Hello {{name}}, your Workly India wallet balance is running low. Add points to keep posting jobs without interruption.', 'Add Points', '/wallet')
ON CONFLICT (event_type) DO NOTHING;

INSERT INTO public.email_lifecycle_templates (event_type, enabled, subject, body, button_text, button_url)
VALUES
  ('profile_viewed', true, 'A company viewed your profile', 'Hello {{name}},<br><br>A company just viewed your profile on Workly India. Keep your profile complete and updated to get more views from employers.', 'View Profile', '/profile'),
  ('inactive_user', true, 'New jobs are waiting for you', 'Hello {{name}},<br><br>New jobs have been posted on Workly India since your last visit. Come back and apply to the latest openings that match your profile.', 'See New Jobs', '/jobs'),
  ('employer_low_balance', true, 'Your wallet balance is low', 'Hello {{name}},<br><br>Your Workly India wallet balance is running low. Add points now so your job postings and services continue without interruption.', 'Add Points', '/wallet')
ON CONFLICT (event_type) DO NOTHING;

INSERT INTO public.telegram_lifecycle_templates (event_type, enabled, title, body, button_text, button_url)
VALUES
  ('profile_viewed', true, 'Your profile was viewed', 'Hello {{name}}, a company just viewed your profile on Workly India. Keep your profile updated to get more views.', 'View Profile', '/profile'),
  ('inactive_user', true, 'We missed you', 'Hello {{name}}, new jobs have been posted on Workly India since your last visit. Come back and check the latest openings.', 'See New Jobs', '/jobs'),
  ('employer_low_balance', true, 'Low wallet balance', 'Hello {{name}}, your Workly India wallet balance is running low. Add points to keep posting jobs without interruption.', 'Add Points', '/wallet')
ON CONFLICT (event_type) DO NOTHING;