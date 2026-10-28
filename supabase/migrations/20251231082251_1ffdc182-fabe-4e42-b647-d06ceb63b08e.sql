-- Add missing OneSignal templates for complete coverage
INSERT INTO onesignal_automation_rules (trigger_event, name, title_template, message_template, target_user_type, action_url_template, is_active, execution_count, variable_mapping)
VALUES 
-- Missing User Events
('push_signup_welcome', 'User Signup Welcome', 'Welcome to Workly India! 🎉', 'Hi {{user_name}}, start exploring remote jobs tailored for you!', 'website_user', '/jobs', true, 0, '{}'),
('push_profile_complete', 'User Profile Complete', 'Profile Complete! ✅', 'Great job {{user_name}}! Your profile is now complete. Start applying to jobs!', 'website_user', '/jobs', true, 0, '{}'),
('push_profile_incomplete', 'User Profile Incomplete', 'Complete Your Profile 📝', 'Hi {{user_name}}, your profile is {{completion}}% complete. Complete it to get better job matches!', 'website_user', '/profile', true, 0, '{}'),
('push_new_job_match', 'New Job Match', 'New Job Match! 💼', '{{job_title}} at {{company_name}} matches your profile!', 'website_user', '/jobs', true, 0, '{}'),
('push_payment_success', 'User Payment Success', 'Payment Successful! 💰', 'Your payment of {{amount}} for {{plan_name}} has been processed.', 'website_user', '/wallet', true, 0, '{}'),
('push_payment_failed', 'User Payment Failed', 'Payment Failed ❌', 'Your payment of {{amount}} failed. {{reason}}', 'website_user', '/wallet', true, 0, '{}'),
('push_withdrawal_approved', 'Withdrawal Approved', 'Withdrawal Approved! 💸', 'Your withdrawal of {{amount}} has been approved and is being processed.', 'website_user', '/wallet', true, 0, '{}'),
('push_refund_initiated', 'Refund Initiated', 'Refund Initiated 🔄', 'A refund of {{amount}} has been initiated to your account.', 'website_user', '/wallet', true, 0, '{}'),
('push_referral_signup', 'Referral Signup', 'New Referral! 🎁', '{{referred_name}} just signed up using your referral link!', 'website_user', '/referrals', true, 0, '{}'),
-- Missing Employer Events
('push_employer_interview_cancelled', 'Employer Interview Cancelled', 'Interview Cancelled', 'The interview with {{applicant_name}} for {{job_title}} has been cancelled.', 'employer', '/employer/interviews', true, 0, '{}'),
('push_employer_interview_completed', 'Employer Interview Completed', 'Interview Complete! ✔️', 'Your interview with {{applicant_name}} for {{job_title}} is complete.', 'employer', '/employer/interviews', true, 0, '{}'),
('push_employer_payment_failed', 'Employer Payment Failed', 'Payment Failed ❌', 'Your payment of {{amount}} failed. {{reason}}', 'employer', '/employer-portal/billing', true, 0, '{}')
ON CONFLICT (trigger_event) DO NOTHING;