-- Update ALL OneSignal automation rules with improved templates and proper variable_mapping

-- ============================================
-- JOB SEEKER (USER) TEMPLATES - 19 Events
-- ============================================

-- 1. Signup Welcome
UPDATE onesignal_automation_rules SET
  title_template = 'Welcome to Workly India! 🎉',
  message_template = 'Hi {{name}}, your work-from-home journey starts now! Explore thousands of remote jobs and find your perfect match.',
  action_url_template = '/jobs',
  variable_mapping = '{"name": "user.name"}',
  is_active = true
WHERE trigger_event = 'push_signup_welcome' AND target_user_type = 'user';

-- 2. Profile Complete
UPDATE onesignal_automation_rules SET
  title_template = 'Profile Complete! ✅',
  message_template = 'Great job {{name}}! Your profile is now 100% complete and visible to top employers. Start applying to jobs now!',
  action_url_template = '/jobs',
  variable_mapping = '{"name": "user.name"}',
  is_active = true
WHERE trigger_event = 'push_profile_complete' AND target_user_type = 'user';

-- 3. Profile Incomplete Reminder
UPDATE onesignal_automation_rules SET
  title_template = 'Complete Your Profile 📝',
  message_template = 'Hi {{name}}, you''re {{completion}}% done. Complete your profile to get 3x more job matches!',
  action_url_template = '/profile',
  variable_mapping = '{"name": "user.name", "completion": "profile.completion_percentage"}',
  is_active = true
WHERE trigger_event = 'push_profile_incomplete' AND target_user_type = 'user';

-- 4. Application Submitted
UPDATE onesignal_automation_rules SET
  title_template = 'Application Sent! 📤',
  message_template = 'Your application for {{job_title}} at {{company_name}} has been submitted. Good luck! 🍀',
  action_url_template = '/applications',
  variable_mapping = '{"job_title": "job.title", "company_name": "company.name"}',
  is_active = true
WHERE trigger_event = 'push_application_submitted' AND target_user_type = 'user';

-- 5. Application Viewed
UPDATE onesignal_automation_rules SET
  title_template = 'Your Application Was Viewed! 👀',
  message_template = '{{company_name}} just viewed your application for {{job_title}}. Keep your fingers crossed!',
  action_url_template = '/applications',
  variable_mapping = '{"job_title": "job.title", "company_name": "company.name"}',
  is_active = true
WHERE trigger_event = 'push_application_viewed' AND target_user_type = 'user';

-- 6. Application Shortlisted
UPDATE onesignal_automation_rules SET
  title_template = 'Congratulations! You''re Shortlisted! 🌟',
  message_template = 'Great news {{name}}! You''ve been shortlisted for {{job_title}} at {{company_name}}. Check your email for next steps!',
  action_url_template = '/applications',
  variable_mapping = '{"name": "user.name", "job_title": "job.title", "company_name": "company.name"}',
  is_active = true
WHERE trigger_event = 'push_application_shortlisted' AND target_user_type = 'user';

-- 7. Application Rejected
UPDATE onesignal_automation_rules SET
  title_template = 'Application Update',
  message_template = 'Your application for {{job_title}} at {{company_name}} wasn''t selected this time. Don''t give up - new opportunities await!',
  action_url_template = '/jobs',
  variable_mapping = '{"job_title": "job.title", "company_name": "company.name"}',
  is_active = true
WHERE trigger_event = 'push_application_rejected' AND target_user_type = 'user';

-- 8. Interview Scheduled
UPDATE onesignal_automation_rules SET
  title_template = 'Interview Scheduled! 📅',
  message_template = 'Your interview for {{job_title}} at {{company_name}} is scheduled for {{interview_date}} at {{interview_time}}. Prepare well!',
  action_url_template = '/interviews',
  variable_mapping = '{"job_title": "job.title", "company_name": "company.name", "interview_date": "interview.date", "interview_time": "interview.time"}',
  is_active = true
WHERE trigger_event = 'push_interview_scheduled' AND target_user_type = 'user';

-- 9. Interview Reminder
UPDATE onesignal_automation_rules SET
  title_template = 'Interview Reminder ⏰',
  message_template = 'Your interview for {{job_title}} at {{company_name}} starts in {{time_left}}. Be ready and good luck!',
  action_url_template = '/interviews',
  variable_mapping = '{"job_title": "job.title", "company_name": "company.name", "time_left": "interview.time_until"}',
  is_active = true
WHERE trigger_event = 'push_interview_reminder' AND target_user_type = 'user';

-- 10. Interview Cancelled
UPDATE onesignal_automation_rules SET
  title_template = 'Interview Cancelled',
  message_template = 'Your interview for {{job_title}} at {{company_name}} has been cancelled. Check your email for details.',
  action_url_template = '/interviews',
  variable_mapping = '{"job_title": "job.title", "company_name": "company.name"}',
  is_active = true
WHERE trigger_event = 'push_interview_cancelled' AND target_user_type = 'user';

-- 11. Interview Completed
UPDATE onesignal_automation_rules SET
  title_template = 'Interview Complete! ✔️',
  message_template = 'Great job completing your interview for {{job_title}}! {{company_name}} will update you soon with their decision.',
  action_url_template = '/interviews',
  variable_mapping = '{"job_title": "job.title", "company_name": "company.name"}',
  is_active = true
WHERE trigger_event = 'push_interview_completed' AND target_user_type = 'user';

-- 12. Payment Success
UPDATE onesignal_automation_rules SET
  title_template = 'Payment Successful! 💰',
  message_template = '₹{{amount}} payment received for {{plan_name}}. Thank you for choosing Workly India!',
  action_url_template = '/wallet',
  variable_mapping = '{"amount": "payment.amount", "plan_name": "payment.plan_name"}',
  is_active = true
WHERE trigger_event = 'push_payment_success' AND target_user_type = 'user';

-- 13. Payment Failed
UPDATE onesignal_automation_rules SET
  title_template = 'Payment Failed ❌',
  message_template = 'Your payment of ₹{{amount}} failed. Please try again or use a different payment method.',
  action_url_template = '/wallet',
  variable_mapping = '{"amount": "payment.amount"}',
  is_active = true
WHERE trigger_event = 'push_payment_failed' AND target_user_type = 'user';

-- 14. Withdrawal Approved
UPDATE onesignal_automation_rules SET
  title_template = 'Withdrawal Approved! 💳',
  message_template = '₹{{amount}} withdrawal approved! Amount will be credited to your bank account within 2-3 business days.',
  action_url_template = '/wallet',
  variable_mapping = '{"amount": "withdrawal.amount"}',
  is_active = true
WHERE trigger_event = 'push_withdrawal_approved' AND target_user_type = 'user';

-- 15. Refund Initiated
UPDATE onesignal_automation_rules SET
  title_template = 'Refund Processing 🔄',
  message_template = '₹{{amount}} refund has been initiated. It will reflect in your account within 5-7 business days.',
  action_url_template = '/wallet',
  variable_mapping = '{"amount": "refund.amount"}',
  is_active = true
WHERE trigger_event = 'push_refund_initiated' AND target_user_type = 'user';

-- 16. New Job Match
UPDATE onesignal_automation_rules SET
  title_template = 'New Job Match! 💼',
  message_template = '{{job_title}} at {{company_name}} matches your profile perfectly! Apply now before it''s gone.',
  action_url_template = '/jobs/{{job_id}}',
  variable_mapping = '{"job_title": "job.title", "company_name": "company.name", "job_id": "job.id"}',
  is_active = true
WHERE trigger_event = 'push_new_job_match' AND target_user_type = 'user';

-- 17. Inactive User
UPDATE onesignal_automation_rules SET
  title_template = 'We Miss You! 👋',
  message_template = 'Hi {{name}}, {{new_jobs_count}} new work-from-home jobs posted since your last visit. Come back and apply!',
  action_url_template = '/jobs',
  variable_mapping = '{"name": "user.name", "new_jobs_count": "stats.new_jobs"}',
  is_active = true
WHERE trigger_event = 'push_inactive_user' AND target_user_type = 'user';

-- 18. Referral Signup
UPDATE onesignal_automation_rules SET
  title_template = 'Referral Success! 🎁',
  message_template = 'Great news! {{referred_name}} just joined Workly India using your referral link. Your bonus is on its way!',
  action_url_template = '/referrals',
  variable_mapping = '{"referred_name": "referral.referred_name"}',
  is_active = true
WHERE trigger_event = 'push_referral_signup' AND target_user_type = 'user';

-- 19. Referral Reward
UPDATE onesignal_automation_rules SET
  title_template = 'Bonus Earned! 🎉',
  message_template = 'You''ve earned {{bonus_points}} points for your successful referral! Keep sharing and earning.',
  action_url_template = '/referrals',
  variable_mapping = '{"bonus_points": "referral.bonus_points"}',
  is_active = true
WHERE trigger_event = 'push_referral_reward' AND target_user_type = 'user';

-- ============================================
-- EMPLOYER TEMPLATES - 16 Events
-- ============================================

-- 1. Employer Signup Welcome
UPDATE onesignal_automation_rules SET
  title_template = 'Welcome to Workly India! 🏢',
  message_template = 'Welcome {{company_name}}! Start hiring top remote talent today. Complete your profile to get started.',
  action_url_template = '/employer/dashboard',
  variable_mapping = '{"company_name": "company.name"}',
  is_active = true
WHERE trigger_event = 'push_employer_signup_welcome' AND target_user_type = 'employer';

-- 2. Company Profile Complete
UPDATE onesignal_automation_rules SET
  title_template = 'Company Profile Complete! ✅',
  message_template = '{{company_name}} profile is now complete! You''re ready to post jobs and attract top candidates.',
  action_url_template = '/employer/jobs/new',
  variable_mapping = '{"company_name": "company.name"}',
  is_active = true
WHERE trigger_event = 'push_company_profile_complete' AND target_user_type = 'employer';

-- 3. Employer Profile Incomplete
UPDATE onesignal_automation_rules SET
  title_template = 'Complete Your Company Profile 📝',
  message_template = 'Your profile is {{completion}}% complete. A complete profile gets 3x more applications!',
  action_url_template = '/employer/company',
  variable_mapping = '{"completion": "profile.completion_percentage"}',
  is_active = true
WHERE trigger_event = 'push_employer_profile_incomplete' AND target_user_type = 'employer';

-- 4. Job Posted
UPDATE onesignal_automation_rules SET
  title_template = 'Job Posted Successfully! 📋',
  message_template = '"{{job_title}}" is now live! Candidates can start applying. Track applications in your dashboard.',
  action_url_template = '/employer/jobs',
  variable_mapping = '{"job_title": "job.title"}',
  is_active = true
WHERE trigger_event = 'push_job_posted' AND target_user_type = 'employer';

-- 5. Job Expiring Soon
UPDATE onesignal_automation_rules SET
  title_template = 'Job Expiring Soon ⚠️',
  message_template = '"{{job_title}}" expires in {{days_left}} days. Renew now to keep receiving applications!',
  action_url_template = '/employer/jobs',
  variable_mapping = '{"job_title": "job.title", "days_left": "job.days_until_expiry"}',
  is_active = true
WHERE trigger_event = 'push_job_expiring' AND target_user_type = 'employer';

-- 6. New Application Received
UPDATE onesignal_automation_rules SET
  title_template = 'New Application! 📬',
  message_template = '{{applicant_name}} just applied for {{job_title}}. Review their profile and take action!',
  action_url_template = '/employer/applications',
  variable_mapping = '{"applicant_name": "applicant.name", "job_title": "job.title"}',
  is_active = true
WHERE trigger_event = 'push_new_application_received' AND target_user_type = 'employer';

-- 7. Employer Interview Scheduled
UPDATE onesignal_automation_rules SET
  title_template = 'Interview Scheduled! 📅',
  message_template = 'Interview with {{applicant_name}} for {{job_title}} scheduled on {{interview_date}} at {{interview_time}}.',
  action_url_template = '/employer/interviews',
  variable_mapping = '{"applicant_name": "applicant.name", "job_title": "job.title", "interview_date": "interview.date", "interview_time": "interview.time"}',
  is_active = true
WHERE trigger_event = 'push_employer_interview_scheduled' AND target_user_type = 'employer';

-- 8. Employer Interview Reminder
UPDATE onesignal_automation_rules SET
  title_template = 'Interview Reminder ⏰',
  message_template = 'Interview with {{applicant_name}} for {{job_title}} starts in {{time_left}}. Be prepared!',
  action_url_template = '/employer/interviews',
  variable_mapping = '{"applicant_name": "applicant.name", "job_title": "job.title", "time_left": "interview.time_until"}',
  is_active = true
WHERE trigger_event = 'push_employer_interview_reminder' AND target_user_type = 'employer';

-- 9. Employer Interview Cancelled
UPDATE onesignal_automation_rules SET
  title_template = 'Interview Cancelled',
  message_template = 'Interview with {{applicant_name}} for {{job_title}} has been cancelled.',
  action_url_template = '/employer/interviews',
  variable_mapping = '{"applicant_name": "applicant.name", "job_title": "job.title"}',
  is_active = true
WHERE trigger_event = 'push_employer_interview_cancelled' AND target_user_type = 'employer';

-- 10. Employer Interview Completed
UPDATE onesignal_automation_rules SET
  title_template = 'Interview Completed ✔️',
  message_template = 'Interview with {{applicant_name}} for {{job_title}} is complete. Don''t forget to provide feedback!',
  action_url_template = '/employer/interviews',
  variable_mapping = '{"applicant_name": "applicant.name", "job_title": "job.title"}',
  is_active = true
WHERE trigger_event = 'push_employer_interview_completed' AND target_user_type = 'employer';

-- 11. Employer Payment Successful
UPDATE onesignal_automation_rules SET
  title_template = 'Payment Received! 💰',
  message_template = '₹{{amount}} payment for {{plan_name}} processed successfully. Thank you for choosing Workly India!',
  action_url_template = '/employer/billing',
  variable_mapping = '{"amount": "payment.amount", "plan_name": "payment.plan_name"}',
  is_active = true
WHERE trigger_event = 'push_employer_payment_successful' AND target_user_type = 'employer';

-- 12. Employer Payment Failed
UPDATE onesignal_automation_rules SET
  title_template = 'Payment Failed ❌',
  message_template = 'Your payment of ₹{{amount}} failed. Please update your payment method to continue hiring.',
  action_url_template = '/employer/billing',
  variable_mapping = '{"amount": "payment.amount"}',
  is_active = true
WHERE trigger_event = 'push_employer_payment_failed' AND target_user_type = 'employer';

-- 13. Employer Low Balance
UPDATE onesignal_automation_rules SET
  title_template = 'Low Balance Warning ⚠️',
  message_template = 'Only {{balance}} points left in your account. Top up now to keep your jobs active!',
  action_url_template = '/employer/billing',
  variable_mapping = '{"balance": "account.balance"}',
  is_active = true
WHERE trigger_event = 'push_employer_low_balance' AND target_user_type = 'employer';

-- 14. Subscription Expiring
UPDATE onesignal_automation_rules SET
  title_template = 'Subscription Ending Soon 📆',
  message_template = 'Your {{plan_name}} subscription expires in {{days_left}} days. Renew now to avoid interruption!',
  action_url_template = '/employer/billing',
  variable_mapping = '{"plan_name": "subscription.plan_name", "days_left": "subscription.days_until_expiry"}',
  is_active = true
WHERE trigger_event = 'push_subscription_expiring' AND target_user_type = 'employer';

-- 15. Employer Inactive
UPDATE onesignal_automation_rules SET
  title_template = 'We Miss You! 👋',
  message_template = '{{active_candidates}} talented candidates are looking for jobs like yours. Post a job today!',
  action_url_template = '/employer/jobs/new',
  variable_mapping = '{"active_candidates": "stats.active_candidates"}',
  is_active = true
WHERE trigger_event = 'push_employer_inactive' AND target_user_type = 'employer';

-- 16. Employer Referral Reward
UPDATE onesignal_automation_rules SET
  title_template = 'Referral Bonus! 🎁',
  message_template = 'You''ve earned {{bonus_points}} points for referring a new employer. Keep sharing and earning!',
  action_url_template = '/employer/referrals',
  variable_mapping = '{"bonus_points": "referral.bonus_points"}',
  is_active = true
WHERE trigger_event = 'push_employer_referral_reward' AND target_user_type = 'employer';

-- Reset execution count to track fresh
UPDATE onesignal_automation_rules SET execution_count = 0, updated_at = NOW();