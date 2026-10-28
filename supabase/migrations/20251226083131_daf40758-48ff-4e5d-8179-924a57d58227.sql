-- Insert all 32 notification triggers with default templates
-- User Triggers (19 events)

-- User Onboarding (2)
INSERT INTO public.onesignal_automation_rules (name, description, trigger_event, title_template, message_template, action_url_template, is_active, target_user_type)
VALUES 
  ('Signup Welcome', 'Welcome notification when user signs up', 'push_user_signup_welcome', 'Welcome to Workly India! 🎉', 'Thanks for joining us, {{user_name}}! Start exploring work-from-home jobs now.', '/jobs', true, 'website_user'),
  ('Profile Complete', 'Congratulate user on completing profile', 'push_profile_complete', 'Profile Complete! ✅', 'Great job {{user_name}}! Your profile is now complete. You''re ready to apply for jobs.', '/profile', true, 'website_user')
ON CONFLICT (trigger_event) DO UPDATE SET
  title_template = EXCLUDED.title_template,
  message_template = EXCLUDED.message_template,
  action_url_template = EXCLUDED.action_url_template,
  is_active = true;

-- Job Application (4)
INSERT INTO public.onesignal_automation_rules (name, description, trigger_event, title_template, message_template, action_url_template, is_active, target_user_type)
VALUES 
  ('Application Submitted', 'Confirm job application sent', 'push_application_submitted', 'Application Sent! 📨', 'Your application for {{job_title}} has been submitted successfully.', '/applications', true, 'website_user'),
  ('Application Viewed', 'Notify when employer views application', 'push_application_viewed', 'Application Viewed! 👀', 'Good news! {{company_name}} has viewed your application for {{job_title}}.', '/applications', true, 'website_user'),
  ('Application Shortlisted', 'Congratulations on shortlist', 'push_application_shortlisted', 'You''re Shortlisted! 🌟', 'Congratulations! You''ve been shortlisted for {{job_title}} at {{company_name}}.', '/applications', true, 'website_user'),
  ('Application Rejected', 'Polite rejection notification', 'push_application_rejected', 'Application Update', 'Your application for {{job_title}} was not selected. Keep applying!', '/jobs', true, 'website_user')
ON CONFLICT (trigger_event) DO UPDATE SET
  title_template = EXCLUDED.title_template,
  message_template = EXCLUDED.message_template,
  action_url_template = EXCLUDED.action_url_template,
  is_active = true;

-- Interview (4)
INSERT INTO public.onesignal_automation_rules (name, description, trigger_event, title_template, message_template, action_url_template, is_active, target_user_type)
VALUES 
  ('Interview Scheduled', 'Send interview details', 'push_interview_scheduled', 'Interview Scheduled! 📅', 'Your interview for {{job_title}} is scheduled for {{interview_date}}.', '/interviews', true, 'website_user'),
  ('Interview Reminder', 'Reminder before interview', 'push_interview_reminder', 'Interview Reminder ⏰', 'Your interview with {{company_name}} starts in {{time_left}}. Be ready!', '/interviews', true, 'website_user'),
  ('Interview Completed', 'Post interview message', 'push_interview_completed', 'Interview Complete! ✔️', 'Well done! Your interview for {{job_title}} is complete. We''ll notify you soon.', '/interviews', true, 'website_user'),
  ('Interview Cancelled', 'Cancellation notification', 'push_interview_cancelled', 'Interview Cancelled', 'Your interview for {{job_title}} has been cancelled. Check details.', '/interviews', true, 'website_user')
ON CONFLICT (trigger_event) DO UPDATE SET
  title_template = EXCLUDED.title_template,
  message_template = EXCLUDED.message_template,
  action_url_template = EXCLUDED.action_url_template,
  is_active = true;

-- Payment User (4)
INSERT INTO public.onesignal_automation_rules (name, description, trigger_event, title_template, message_template, action_url_template, is_active, target_user_type)
VALUES 
  ('Payment Successful', 'Payment confirmation', 'push_payment_successful', 'Payment Successful! 💰', 'Your payment of ₹{{amount}} has been processed successfully.', '/wallet', true, 'website_user'),
  ('Payment Failed', 'Alert about failed payment', 'push_payment_failed', 'Payment Failed ❌', 'Your payment of ₹{{amount}} could not be processed. Please try again.', '/wallet', true, 'website_user'),
  ('Withdrawal Approved', 'Withdrawal confirmation', 'push_withdrawal_approved', 'Withdrawal Approved! 🏦', 'Your withdrawal of ₹{{amount}} has been approved and will be credited soon.', '/wallet', true, 'website_user'),
  ('Refund Initiated', 'Refund notification', 'push_refund_initiated', 'Refund Initiated 💸', 'Your refund of ₹{{amount}} has been initiated. It will reflect in 3-5 days.', '/wallet', true, 'website_user')
ON CONFLICT (trigger_event) DO UPDATE SET
  title_template = EXCLUDED.title_template,
  message_template = EXCLUDED.message_template,
  action_url_template = EXCLUDED.action_url_template,
  is_active = true;

-- Marketing User (3)
INSERT INTO public.onesignal_automation_rules (name, description, trigger_event, title_template, message_template, action_url_template, is_active, target_user_type)
VALUES 
  ('New Job Match', 'Alert when matching job posted', 'push_new_job_match', 'New Job for You! 🎯', 'A new {{job_title}} position matches your profile. Apply now!', '/jobs', true, 'website_user'),
  ('Profile Incomplete', 'Remind to complete profile', 'push_profile_incomplete', 'Complete Your Profile 📝', 'Your profile is {{completion}}% complete. Finish it to get more job matches!', '/profile/edit', true, 'website_user'),
  ('Inactive User', 'Re-engage inactive users', 'push_inactive_user', 'We Miss You! 👋', 'Hey {{user_name}}, new jobs are waiting for you. Come back and explore!', '/jobs', true, 'website_user')
ON CONFLICT (trigger_event) DO UPDATE SET
  title_template = EXCLUDED.title_template,
  message_template = EXCLUDED.message_template,
  action_url_template = EXCLUDED.action_url_template,
  is_active = true;

-- Referral User (2)
INSERT INTO public.onesignal_automation_rules (name, description, trigger_event, title_template, message_template, action_url_template, is_active, target_user_type)
VALUES 
  ('Referral Reward', 'Referral reward earned', 'push_referral_reward', 'Referral Reward! 🎁', 'Congratulations! You earned ₹{{amount}} for your referral. Keep sharing!', '/referrals', true, 'website_user'),
  ('Referral Signup', 'Someone used your referral', 'push_referral_signup', 'New Referral Signup! 🙌', '{{referred_name}} just signed up using your referral code!', '/referrals', true, 'website_user')
ON CONFLICT (trigger_event) DO UPDATE SET
  title_template = EXCLUDED.title_template,
  message_template = EXCLUDED.message_template,
  action_url_template = EXCLUDED.action_url_template,
  is_active = true;

-- Employer Triggers (13 events)

-- Employer Onboarding (2)
INSERT INTO public.onesignal_automation_rules (name, description, trigger_event, title_template, message_template, action_url_template, is_active, target_user_type)
VALUES 
  ('Company Signup Welcome', 'Welcome notification for company', 'push_employer_signup_welcome', 'Welcome Employer! 🏢', 'Thanks for registering {{company_name}}! Start posting jobs and find the best talent.', '/employer/dashboard', true, 'employer'),
  ('Company Profile Complete', 'Company profile completed', 'push_company_profile_complete', 'Company Profile Complete! ✅', 'Great! {{company_name}}''s profile is now complete. Post your first job now!', '/employer/post-job', true, 'employer')
ON CONFLICT (trigger_event) DO UPDATE SET
  title_template = EXCLUDED.title_template,
  message_template = EXCLUDED.message_template,
  action_url_template = EXCLUDED.action_url_template,
  is_active = true;

-- Job Posting (3)
INSERT INTO public.onesignal_automation_rules (name, description, trigger_event, title_template, message_template, action_url_template, is_active, target_user_type)
VALUES 
  ('Job Posted', 'Confirm job posting', 'push_job_posted', 'Job Posted! 📋', 'Your job "{{job_title}}" is now live and visible to candidates.', '/employer/jobs', true, 'employer'),
  ('Job Expiring Soon', 'Job expiry alert', 'push_job_expiring', 'Job Expiring Soon ⚠️', 'Your job "{{job_title}}" expires in {{days_left}} days. Renew it to keep receiving applications.', '/employer/jobs', true, 'employer'),
  ('New Application Received', 'New application received', 'push_new_application_received', 'New Application! 📬', 'You have a new application for {{job_title}} from {{applicant_name}}.', '/employer/applications', true, 'employer')
ON CONFLICT (trigger_event) DO UPDATE SET
  title_template = EXCLUDED.title_template,
  message_template = EXCLUDED.message_template,
  action_url_template = EXCLUDED.action_url_template,
  is_active = true;

-- Interview Employer (2)
INSERT INTO public.onesignal_automation_rules (name, description, trigger_event, title_template, message_template, action_url_template, is_active, target_user_type)
VALUES 
  ('Employer Interview Scheduled', 'Interview confirmation for employer', 'push_employer_interview_scheduled', 'Interview Scheduled! 📅', 'Interview with {{applicant_name}} for {{job_title}} is set for {{interview_date}}.', '/employer/interviews', true, 'employer'),
  ('Employer Interview Reminder', 'Interview reminder for employer', 'push_employer_interview_reminder', 'Interview Reminder ⏰', 'Your interview with {{applicant_name}} starts in {{time_left}}.', '/employer/interviews', true, 'employer')
ON CONFLICT (trigger_event) DO UPDATE SET
  title_template = EXCLUDED.title_template,
  message_template = EXCLUDED.message_template,
  action_url_template = EXCLUDED.action_url_template,
  is_active = true;

-- Payment Employer (3)
INSERT INTO public.onesignal_automation_rules (name, description, trigger_event, title_template, message_template, action_url_template, is_active, target_user_type)
VALUES 
  ('Employer Payment Successful', 'Payment confirmation for employer', 'push_employer_payment_successful', 'Payment Received! 💰', 'Your payment of ₹{{amount}} for {{plan_name}} has been processed.', '/employer/billing', true, 'employer'),
  ('Low Balance Alert', 'Low point balance warning', 'push_low_balance', 'Low Balance Alert! ⚠️', 'Your point balance is low ({{balance}} points). Top up to continue posting jobs.', '/employer/billing', true, 'employer'),
  ('Subscription Expiring', 'Subscription renewal reminder', 'push_subscription_expiring', 'Subscription Expiring! 📆', 'Your {{plan_name}} subscription expires in {{days_left}} days. Renew now!', '/employer/billing', true, 'employer')
ON CONFLICT (trigger_event) DO UPDATE SET
  title_template = EXCLUDED.title_template,
  message_template = EXCLUDED.message_template,
  action_url_template = EXCLUDED.action_url_template,
  is_active = true;

-- Marketing Employer (2)
INSERT INTO public.onesignal_automation_rules (name, description, trigger_event, title_template, message_template, action_url_template, is_active, target_user_type)
VALUES 
  ('Employer Profile Incomplete', 'Remind to complete company profile', 'push_employer_profile_incomplete', 'Complete Your Profile 📝', 'Your company profile is {{completion}}% complete. A complete profile attracts more applicants!', '/employer/profile', true, 'employer'),
  ('Inactive Employer', 'Re-engage inactive employers', 'push_inactive_employer', 'We Miss You! 👋', 'Hey {{company_name}}, talented candidates are waiting. Post a job today!', '/employer/post-job', true, 'employer')
ON CONFLICT (trigger_event) DO UPDATE SET
  title_template = EXCLUDED.title_template,
  message_template = EXCLUDED.message_template,
  action_url_template = EXCLUDED.action_url_template,
  is_active = true;

-- Referral Employer (1)
INSERT INTO public.onesignal_automation_rules (name, description, trigger_event, title_template, message_template, action_url_template, is_active, target_user_type)
VALUES 
  ('Employer Referral Reward', 'Referral reward for employer', 'push_employer_referral_reward', 'Referral Bonus! 🎁', 'You earned {{bonus_points}} bonus points for referring a new employer!', '/employer/referrals', true, 'employer')
ON CONFLICT (trigger_event) DO UPDATE SET
  title_template = EXCLUDED.title_template,
  message_template = EXCLUDED.message_template,
  action_url_template = EXCLUDED.action_url_template,
  is_active = true;