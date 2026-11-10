
-- Fix existing rules
UPDATE onesignal_automation_rules SET target_user_type = 'website_user' WHERE trigger_event IN ('new_job_posted', 'job_application_status_changed', 'job_saved', 'profile_view', 'new_message_received', 'interview_scheduled');
UPDATE onesignal_automation_rules SET target_user_type = 'employer' WHERE trigger_event IN ('new_application_received', 'applicant_shortlisted', 'job_expired', 'company_profile_viewed', 'interview_completed', 'candidate_hired');

-- Add marketing events for Users
INSERT INTO onesignal_automation_rules (name, trigger_event, target_user_type, is_active, title_template, message_template, action_url_template)
VALUES 
  ('Welcome Back - User', 'welcome_back', 'website_user', true, 'हम आपको याद कर रहे हैं! 🔔', 'नई नौकरियां आपका इंतज़ार कर रही हैं!', '/jobs'),
  ('Weekly Digest - User', 'weekly_digest', 'website_user', true, '📋 साप्ताहिक जॉब रिपोर्ट', 'इस हफ्ते नई जॉब्स मिलीं!', '/jobs'),
  ('Promotional Offer - User', 'promotional_offer', 'website_user', true, '🎉 विशेष ऑफर!', 'सीमित समय के लिए छूट!', '/pricing'),
  ('Festival Greeting - User', 'festival_greeting', 'website_user', true, '🎊 शुभकामनाएं!', 'Workly India की ओर से शुभकामनाएं।', '/')
ON CONFLICT DO NOTHING;

-- Add marketing events for Employers
INSERT INTO onesignal_automation_rules (name, trigger_event, target_user_type, is_active, title_template, message_template, action_url_template)
VALUES 
  ('Welcome Back - Employer', 'welcome_back', 'employer', true, 'जॉब पोस्टिंग्स का इंतज़ार है! 📊', 'नए आवेदन आपके रिव्यू का इंतज़ार कर रहे हैं।', '/employer/applications'),
  ('Weekly Digest - Employer', 'weekly_digest', 'employer', true, '📈 साप्ताहिक हायरिंग रिपोर्ट', 'इस हफ्ते की हायरिंग प्रगति।', '/employer/dashboard'),
  ('Promotional Offer - Employer', 'promotional_offer', 'employer', true, '💼 एम्प्लॉयर ऑफर!', 'जॉब पोस्टिंग पर छूट!', '/employer/pricing'),
  ('Festival Greeting - Employer', 'festival_greeting', 'employer', true, '🎊 शुभकामनाएं!', 'Workly India आपके साथ है।', '/employer/dashboard')
ON CONFLICT DO NOTHING;

-- Add Telegram templates for marketing
INSERT INTO telegram_message_templates (name, category, content, variables, is_active)
VALUES 
  ('welcome_back_user', 'marketing', '🔔 *हम आपको याद कर रहे हैं!*\n\nनई जॉब्स आपका इंतज़ार कर रही हैं!\n\n👉 अभी देखें', '[]'::jsonb, true),
  ('weekly_digest_user', 'marketing', '📋 *साप्ताहिक जॉब रिपोर्ट*\n\nइस हफ्ते की टॉप जॉब्स देखें!', '[]'::jsonb, true),
  ('promotional_offer_user', 'marketing', '🎉 *विशेष ऑफर!*\n\nसीमित समय के लिए छूट!', '[]'::jsonb, true),
  ('festival_greeting_user', 'marketing', '🎊 *शुभकामनाएं!*\n\nWorkly India की ओर से।', '[]'::jsonb, true),
  ('welcome_back_employer', 'marketing', '📊 *जॉब पोस्टिंग्स का इंतज़ार है!*\n\nनए आवेदन देखें!', '[]'::jsonb, true),
  ('weekly_digest_employer', 'marketing', '📈 *साप्ताहिक हायरिंग रिपोर्ट*\n\nइस हफ्ते की प्रगति।', '[]'::jsonb, true),
  ('promotional_offer_employer', 'marketing', '💼 *एम्प्लॉयर ऑफर!*\n\nजॉब पोस्टिंग पर छूट!', '[]'::jsonb, true),
  ('festival_greeting_employer', 'marketing', '🎊 *शुभकामनाएं!*\n\nWorkly India आपके साथ।', '[]'::jsonb, true)
ON CONFLICT DO NOTHING;

-- Create marketing_campaigns table
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  campaign_type TEXT NOT NULL,
  target_user_type TEXT NOT NULL,
  message_title TEXT NOT NULL,
  message_body TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  sent_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage campaigns" ON marketing_campaigns FOR ALL USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));
