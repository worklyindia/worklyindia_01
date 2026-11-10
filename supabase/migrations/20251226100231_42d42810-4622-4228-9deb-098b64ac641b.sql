-- First add unique constraint on name if not exists, then insert templates
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'telegram_message_templates_name_unique') THEN
    CREATE UNIQUE INDEX telegram_message_templates_name_unique ON public.telegram_message_templates(name);
  END IF;
END $$;

-- Create essential Telegram message templates for Users
INSERT INTO public.telegram_message_templates (name, content, category, variables, is_active) VALUES
('Signup OTP Code', '🔐 *Welcome to RojgarSetu!*

Your OTP for signup verification is: *{{otp_code}}*

Valid for 10 minutes. Do not share with anyone.

👉 Start your job search journey with us!', 'verification', '["otp_code"]', true)
ON CONFLICT (name) DO UPDATE SET content = EXCLUDED.content, variables = EXCLUDED.variables, is_active = true, updated_at = now();

INSERT INTO public.telegram_message_templates (name, content, category, variables, is_active) VALUES
('Profile Telegram Verify', '✅ *Telegram Verification*

Hello {{user_name}}! Your Telegram is now connected to RojgarSetu.

You will receive:
• Job recommendations
• Application updates
• Interview notifications

🔔 Stay connected for opportunities!', 'verification', '["user_name"]', true)
ON CONFLICT (name) DO UPDATE SET content = EXCLUDED.content, variables = EXCLUDED.variables, is_active = true, updated_at = now();

INSERT INTO public.telegram_message_templates (name, content, category, variables, is_active) VALUES
('Application Submitted', '📤 *Application Submitted Successfully!*

Hello {{user_name}},

Your application for *{{job_title}}* at *{{company_name}}* has been submitted.

📍 Location: {{location}}
💰 Salary: {{salary_range}}

Good luck! 🍀', 'application', '["user_name", "job_title", "company_name", "location", "salary_range"]', true)
ON CONFLICT (name) DO UPDATE SET content = EXCLUDED.content, variables = EXCLUDED.variables, is_active = true, updated_at = now();

INSERT INTO public.telegram_message_templates (name, content, category, variables, is_active) VALUES
('Application Viewed', '👀 *Your Application Was Viewed!*

Hello {{user_name}},

Great news! *{{company_name}}* has viewed your application for *{{job_title}}*.

Keep your phone ready for updates! 📱', 'application', '["user_name", "company_name", "job_title"]', true)
ON CONFLICT (name) DO UPDATE SET content = EXCLUDED.content, variables = EXCLUDED.variables, is_active = true, updated_at = now();

INSERT INTO public.telegram_message_templates (name, content, category, variables, is_active) VALUES
('Application Shortlisted', '🎉 *Congratulations! You are Shortlisted!*

Hello {{user_name}},

*{{company_name}}* has shortlisted you for *{{job_title}}*.

Next steps will be shared soon. Stay prepared! 💪', 'application', '["user_name", "company_name", "job_title"]', true)
ON CONFLICT (name) DO UPDATE SET content = EXCLUDED.content, variables = EXCLUDED.variables, is_active = true, updated_at = now();

INSERT INTO public.telegram_message_templates (name, content, category, variables, is_active) VALUES
('Application Rejected', '📋 *Application Update*

Hello {{user_name}},

Unfortunately, your application for *{{job_title}}* at *{{company_name}}* was not selected this time.

Do not lose hope! New opportunities await. Keep applying! 🌟', 'application', '["user_name", "job_title", "company_name"]', true)
ON CONFLICT (name) DO UPDATE SET content = EXCLUDED.content, variables = EXCLUDED.variables, is_active = true, updated_at = now();

INSERT INTO public.telegram_message_templates (name, content, category, variables, is_active) VALUES
('Interview Scheduled', '📅 *Interview Scheduled!*

Hello {{user_name}},

Your interview for *{{job_title}}* at *{{company_name}}* is confirmed.

🗓 Date: {{interview_date}}
⏰ Time: {{interview_time}}
📍 Mode: {{interview_mode}}
{{interview_location}}

Good luck! Prepare well! 🎯', 'interview', '["user_name", "job_title", "company_name", "interview_date", "interview_time", "interview_mode", "interview_location"]', true)
ON CONFLICT (name) DO UPDATE SET content = EXCLUDED.content, variables = EXCLUDED.variables, is_active = true, updated_at = now();

INSERT INTO public.telegram_message_templates (name, content, category, variables, is_active) VALUES
('Interview Reminder', '⏰ *Interview Reminder!*

Hello {{user_name}},

Your interview is coming up {{time_until}}!

📌 *{{job_title}}* at *{{company_name}}*
🗓 {{interview_date}} at {{interview_time}}

Be ready and confident! 💪', 'interview', '["user_name", "job_title", "company_name", "interview_date", "interview_time", "time_until"]', true)
ON CONFLICT (name) DO UPDATE SET content = EXCLUDED.content, variables = EXCLUDED.variables, is_active = true, updated_at = now();

INSERT INTO public.telegram_message_templates (name, content, category, variables, is_active) VALUES
('User Payment Successful', '✅ *Payment Successful!*

Hello {{user_name}},

Your payment of ₹{{amount}} has been received.

📦 Package: {{package_name}}
🎯 Points Added: {{points}}
💳 Transaction ID: {{transaction_id}}

Thank you for choosing RojgarSetu! 🙏', 'payment', '["user_name", "amount", "package_name", "points", "transaction_id"]', true)
ON CONFLICT (name) DO UPDATE SET content = EXCLUDED.content, variables = EXCLUDED.variables, is_active = true, updated_at = now();

INSERT INTO public.telegram_message_templates (name, content, category, variables, is_active) VALUES
('New Job Match', '🎯 *New Job Match Found!*

Hello {{user_name}},

A new job matching your profile:

*{{job_title}}*
🏢 {{company_name}}
📍 {{location}}
💰 {{salary_range}}

👉 Apply now before it is gone!', 'job_alert', '["user_name", "job_title", "company_name", "location", "salary_range"]', true)
ON CONFLICT (name) DO UPDATE SET content = EXCLUDED.content, variables = EXCLUDED.variables, is_active = true, updated_at = now();

INSERT INTO public.telegram_message_templates (name, content, category, variables, is_active) VALUES
('Company Signup OTP', '🔐 *Welcome to RojgarSetu for Employers!*

Your OTP for company registration: *{{otp_code}}*

Valid for 10 minutes. Do not share.

🏢 Start hiring the best talent today!', 'verification', '["otp_code"]', true)
ON CONFLICT (name) DO UPDATE SET content = EXCLUDED.content, variables = EXCLUDED.variables, is_active = true, updated_at = now();

INSERT INTO public.telegram_message_templates (name, content, category, variables, is_active) VALUES
('Company Telegram Verify', '✅ *Telegram Connected!*

Hello {{company_name}}!

Your Telegram is now linked to RojgarSetu.

You will receive:
• New application alerts
• Interview reminders
• Payment notifications

📱 Manage hiring on-the-go!', 'verification', '["company_name"]', true)
ON CONFLICT (name) DO UPDATE SET content = EXCLUDED.content, variables = EXCLUDED.variables, is_active = true, updated_at = now();

INSERT INTO public.telegram_message_templates (name, content, category, variables, is_active) VALUES
('Job Posted Successfully', '✅ *Job Posted Successfully!*

Hello {{company_name}},

Your job *{{job_title}}* is now live!

📍 Location: {{location}}
💰 Salary: {{salary_range}}
📅 Expires: {{expiry_date}}

Applications will start coming soon! 🎯', 'job', '["company_name", "job_title", "location", "salary_range", "expiry_date"]', true)
ON CONFLICT (name) DO UPDATE SET content = EXCLUDED.content, variables = EXCLUDED.variables, is_active = true, updated_at = now();

INSERT INTO public.telegram_message_templates (name, content, category, variables, is_active) VALUES
('New Application Received', '📥 *New Application Received!*

Hello {{company_name}},

New application for *{{job_title}}*:

👤 {{applicant_name}}
📱 {{applicant_phone}}
🎓 Experience: {{experience}}

Review and respond quickly! ⚡', 'application', '["company_name", "job_title", "applicant_name", "applicant_phone", "experience"]', true)
ON CONFLICT (name) DO UPDATE SET content = EXCLUDED.content, variables = EXCLUDED.variables, is_active = true, updated_at = now();

INSERT INTO public.telegram_message_templates (name, content, category, variables, is_active) VALUES
('Employer Payment Successful', '✅ *Payment Received!*

Hello {{company_name}},

Payment of ₹{{amount}} confirmed.

📦 Package: {{package_name}}
🎯 Points Added: {{points}}
💳 Transaction ID: {{transaction_id}}

Happy Hiring! 🚀', 'payment', '["company_name", "amount", "package_name", "points", "transaction_id"]', true)
ON CONFLICT (name) DO UPDATE SET content = EXCLUDED.content, variables = EXCLUDED.variables, is_active = true, updated_at = now();

INSERT INTO public.telegram_message_templates (name, content, category, variables, is_active) VALUES
('Low Balance Alert', '⚠️ *Low Balance Alert!*

Hello {{company_name}},

Your points balance is low: *{{current_balance}} points*

Recharge now to continue:
• Posting jobs
• Viewing applications
• Scheduling interviews

👉 Top up today!', 'alert', '["company_name", "current_balance"]', true)
ON CONFLICT (name) DO UPDATE SET content = EXCLUDED.content, variables = EXCLUDED.variables, is_active = true, updated_at = now();