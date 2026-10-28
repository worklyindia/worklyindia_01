-- ============================================
-- FIX ALL TELEGRAM AUTOMATION RULES VARIABLE MAPPINGS
-- ============================================

-- =====================
-- JOB SEEKER RULES (23)
-- =====================

-- 1. User Signup OTP - template expects: name, otp
UPDATE telegram_automation_rules
SET variable_mapping = jsonb_build_object(
  'name', 'name',
  'otp', 'metadata.otp'
)
WHERE trigger_event = 'user_signup_otp_sent' AND target_user_type = 'job_seeker';

-- 2. User Telegram Connected - template expects: user_name
UPDATE telegram_automation_rules
SET variable_mapping = jsonb_build_object(
  'user_name', 'name'
)
WHERE trigger_event = 'user_telegram_connected' AND target_user_type = 'job_seeker';

-- 3. Application Submitted - template expects: user_name, job_title, company_name, location, salary_range
UPDATE telegram_automation_rules
SET variable_mapping = jsonb_build_object(
  'user_name', 'name',
  'job_title', 'metadata.job_title',
  'company_name', 'metadata.company_name',
  'location', 'metadata.location',
  'salary_range', 'metadata.salary_range'
)
WHERE trigger_event = 'application_submitted' AND target_user_type = 'job_seeker';

-- 4. Application Viewed - template expects: user_name, company_name, job_title
UPDATE telegram_automation_rules
SET variable_mapping = jsonb_build_object(
  'user_name', 'name',
  'company_name', 'metadata.company_name',
  'job_title', 'metadata.job_title'
)
WHERE trigger_event = 'application_viewed' AND target_user_type = 'job_seeker';

-- 5. Application Shortlisted - template expects: user_name, company_name, job_title
UPDATE telegram_automation_rules
SET variable_mapping = jsonb_build_object(
  'user_name', 'name',
  'company_name', 'metadata.company_name',
  'job_title', 'metadata.job_title'
)
WHERE trigger_event = 'application_shortlisted' AND target_user_type = 'job_seeker';

-- 6. Application Rejected - template expects: user_name, job_title, company_name
UPDATE telegram_automation_rules
SET variable_mapping = jsonb_build_object(
  'user_name', 'name',
  'job_title', 'metadata.job_title',
  'company_name', 'metadata.company_name'
)
WHERE trigger_event = 'application_rejected' AND target_user_type = 'job_seeker';

-- 7. Interview Scheduled - template expects: user_name, job_title, company_name, interview_date, interview_time, interview_mode, interview_location
UPDATE telegram_automation_rules
SET variable_mapping = jsonb_build_object(
  'user_name', 'name',
  'job_title', 'metadata.job_title',
  'company_name', 'metadata.company_name',
  'interview_date', 'metadata.interview_date',
  'interview_time', 'metadata.interview_time',
  'interview_mode', 'metadata.interview_mode',
  'interview_location', 'metadata.interview_location',
  'meeting_link', 'metadata.meeting_link'
)
WHERE trigger_event = 'interview_scheduled' AND target_user_type = 'job_seeker';

-- 8. Interview Reminder - template expects: user_name, job_title, company_name, interview_date, interview_time, time_until
UPDATE telegram_automation_rules
SET variable_mapping = jsonb_build_object(
  'user_name', 'name',
  'job_title', 'metadata.job_title',
  'company_name', 'metadata.company_name',
  'interview_date', 'metadata.interview_date',
  'interview_time', 'metadata.interview_time',
  'time_until', 'metadata.time_until',
  'meeting_link', 'metadata.meeting_link',
  'mode', 'metadata.interview_mode'
)
WHERE trigger_event = 'interview_reminder' AND target_user_type = 'job_seeker';

-- 9. Interview Cancelled - template expects: name, job_title, company_name, reason
UPDATE telegram_automation_rules
SET variable_mapping = jsonb_build_object(
  'name', 'name',
  'job_title', 'metadata.job_title',
  'company_name', 'metadata.company_name',
  'reason', 'metadata.reason',
  'original_date', 'metadata.original_date'
)
WHERE trigger_event = 'interview_cancelled' AND target_user_type = 'job_seeker';

-- 10. Interview Completed - template expects: name, job_title, company_name
UPDATE telegram_automation_rules
SET variable_mapping = jsonb_build_object(
  'name', 'name',
  'job_title', 'metadata.job_title',
  'company_name', 'metadata.company_name'
)
WHERE trigger_event = 'interview_completed' AND target_user_type = 'job_seeker';

-- 11. User Payment Success - template expects: user_name, amount, package_name, points, transaction_id
UPDATE telegram_automation_rules
SET variable_mapping = jsonb_build_object(
  'user_name', 'name',
  'amount', 'metadata.amount',
  'package_name', 'metadata.package_name',
  'points', 'metadata.points',
  'transaction_id', 'metadata.transaction_id'
)
WHERE trigger_event = 'user_payment_success' AND target_user_type = 'job_seeker';

-- 12. Payment Failed - template expects: name, amount, reason
UPDATE telegram_automation_rules
SET variable_mapping = jsonb_build_object(
  'name', 'name',
  'amount', 'metadata.amount',
  'reason', 'metadata.error_message'
)
WHERE trigger_event = 'user_payment_failed' AND target_user_type = 'job_seeker';

-- 13. New Job Match / Job Recommendation - template expects: user_name, job_title, company_name, location, salary_range
UPDATE telegram_automation_rules
SET variable_mapping = jsonb_build_object(
  'user_name', 'name',
  'job_title', 'metadata.job_title',
  'company_name', 'metadata.company_name',
  'location', 'metadata.location',
  'salary_range', 'metadata.salary_range',
  'match_percentage', 'metadata.match_percentage'
)
WHERE trigger_event = 'job_recommendation' AND target_user_type = 'job_seeker';

-- 14. Profile Incomplete - template expects: name, completion_percent, missing_sections
UPDATE telegram_automation_rules
SET variable_mapping = jsonb_build_object(
  'name', 'name',
  'completion_percent', 'metadata.profile_completion',
  'missing_sections', 'metadata.missing_fields'
)
WHERE trigger_event = 'profile_incomplete' AND target_user_type = 'job_seeker';

-- 15. Inactive User - template expects: name, days_inactive, new_jobs_count, new_companies, hot_jobs
UPDATE telegram_automation_rules
SET variable_mapping = jsonb_build_object(
  'name', 'name',
  'days_inactive', 'metadata.days_inactive',
  'new_jobs_count', 'metadata.new_jobs_count',
  'new_companies', 'metadata.new_companies',
  'hot_jobs', 'metadata.hot_jobs'
)
WHERE trigger_event = 'inactive_user' AND target_user_type = 'job_seeker';

-- 16. Job Seeker 2FA OTP - template expects: otp, expiry_minutes, name
UPDATE telegram_automation_rules
SET variable_mapping = jsonb_build_object(
  'name', 'name',
  'otp', 'metadata.otp',
  'expiry_minutes', 'metadata.expiry_minutes'
)
WHERE trigger_event = 'telegram_2fa_otp' AND target_user_type = 'job_seeker';

-- 17. User Profile Viewed - template expects: user_name, company_name, job_title
UPDATE telegram_automation_rules
SET variable_mapping = jsonb_build_object(
  'user_name', 'name',
  'company_name', 'metadata.company_name',
  'job_title', 'metadata.job_title'
)
WHERE trigger_event = 'user_profile_viewed' AND target_user_type = 'job_seeker';

-- 18. Referral Invite - template expects: name, referral_code, reward_amount, total_referrals, pending_rewards
UPDATE telegram_automation_rules
SET variable_mapping = jsonb_build_object(
  'name', 'name',
  'referral_code', 'metadata.referral_code',
  'referral_link', 'metadata.referral_link',
  'reward_amount', 'metadata.reward_amount',
  'total_referrals', 'metadata.total_referrals',
  'pending_rewards', 'metadata.pending_rewards'
)
WHERE trigger_event = 'user_referral_invite' AND target_user_type = 'job_seeker';

-- 19. Referral Reward - template expects: name, referred_name, reward_amount, date, total_earnings, total_referrals
UPDATE telegram_automation_rules
SET variable_mapping = jsonb_build_object(
  'name', 'name',
  'referred_name', 'metadata.referred_name',
  'reward_amount', 'metadata.reward_amount',
  'date', 'metadata.date',
  'total_earnings', 'metadata.total_earnings',
  'total_referrals', 'metadata.total_referrals'
)
WHERE trigger_event = 'user_referral_reward' AND target_user_type = 'job_seeker';

-- 20. Refund Initiated - template expects: name, amount, reference_id, date
UPDATE telegram_automation_rules
SET variable_mapping = jsonb_build_object(
  'name', 'name',
  'amount', 'metadata.amount',
  'reference_id', 'metadata.refund_id',
  'date', 'metadata.date'
)
WHERE trigger_event = 'user_refund_initiated' AND target_user_type = 'job_seeker';

-- 21. Subscription Expiring - template expects: name, plan_name, expiry_date, days_left, plan_benefits, discount
UPDATE telegram_automation_rules
SET variable_mapping = jsonb_build_object(
  'name', 'name',
  'plan_name', 'metadata.plan_name',
  'expiry_date', 'metadata.expiry_date',
  'days_left', 'metadata.days_remaining',
  'plan_benefits', 'metadata.plan_benefits',
  'discount', 'metadata.discount'
)
WHERE trigger_event = 'user_subscription_expiring' AND target_user_type = 'job_seeker';

-- 22. Withdrawal Approved - template expects: name, amount, transaction_id, date
UPDATE telegram_automation_rules
SET variable_mapping = jsonb_build_object(
  'name', 'name',
  'amount', 'metadata.amount',
  'transaction_id', 'metadata.transaction_id',
  'date', 'metadata.date'
)
WHERE trigger_event = 'user_withdrawal_approved' AND target_user_type = 'job_seeker';

-- 23. Weekly Digest - template expects: name, new_jobs_count, profile_views, applications_count, matching_jobs, top_jobs
UPDATE telegram_automation_rules
SET variable_mapping = jsonb_build_object(
  'name', 'name',
  'new_jobs_count', 'metadata.new_jobs_count',
  'profile_views', 'metadata.profile_views',
  'applications_count', 'metadata.applications_count',
  'matching_jobs', 'metadata.matching_jobs',
  'top_jobs', 'metadata.top_jobs'
)
WHERE trigger_event = 'weekly_digest' AND target_user_type = 'job_seeker';

-- =====================
-- EMPLOYER RULES (16)
-- =====================

-- 1. Employer Signup OTP - template expects: otp_code
UPDATE telegram_automation_rules
SET variable_mapping = jsonb_build_object(
  'otp_code', 'metadata.otp'
)
WHERE trigger_event = 'employer_signup_otp_sent' AND target_user_type = 'employer';

-- 2. Employer Telegram Connected - template expects: company_name
UPDATE telegram_automation_rules
SET variable_mapping = jsonb_build_object(
  'company_name', 'name'
)
WHERE trigger_event = 'employer_telegram_connected' AND target_user_type = 'employer';

-- 3. Job Posted - template expects: company_name, job_title, location, salary_range, expiry_date
UPDATE telegram_automation_rules
SET variable_mapping = jsonb_build_object(
  'company_name', 'name',
  'job_title', 'metadata.job_title',
  'location', 'metadata.location',
  'salary_range', 'metadata.salary_range',
  'expiry_date', 'metadata.expiry_date'
)
WHERE trigger_event = 'job_posted' AND target_user_type = 'employer';

-- 4. New Application Received - template expects: company_name, job_title, applicant_name, applicant_phone, experience
UPDATE telegram_automation_rules
SET variable_mapping = jsonb_build_object(
  'company_name', 'name',
  'job_title', 'metadata.job_title',
  'applicant_name', 'metadata.applicant_name',
  'applicant_phone', 'metadata.applicant_phone',
  'experience', 'metadata.experience'
)
WHERE trigger_event = 'new_application_received' AND target_user_type = 'employer';

-- 5. Employer Interview Scheduled - template expects: name, candidate_name, job_title, date, time, mode, meeting_link
UPDATE telegram_automation_rules
SET variable_mapping = jsonb_build_object(
  'name', 'name',
  'candidate_name', 'metadata.candidate_name',
  'job_title', 'metadata.job_title',
  'date', 'metadata.interview_date',
  'time', 'metadata.interview_time',
  'mode', 'metadata.interview_mode',
  'meeting_link', 'metadata.meeting_link'
)
WHERE trigger_event = 'employer_interview_scheduled' AND target_user_type = 'employer';

-- 6. Employer Interview Reminder - template expects: name, candidate_name, job_title, time, mode, meeting_link
UPDATE telegram_automation_rules
SET variable_mapping = jsonb_build_object(
  'name', 'name',
  'candidate_name', 'metadata.candidate_name',
  'job_title', 'metadata.job_title',
  'time', 'metadata.interview_time',
  'mode', 'metadata.interview_mode',
  'meeting_link', 'metadata.meeting_link'
)
WHERE trigger_event = 'employer_interview_reminder' AND target_user_type = 'employer';

-- 7. Employer Interview Cancelled - template expects: name, job_title, company_name, reason
UPDATE telegram_automation_rules
SET variable_mapping = jsonb_build_object(
  'name', 'metadata.candidate_name',
  'job_title', 'metadata.job_title',
  'company_name', 'name',
  'reason', 'metadata.reason'
)
WHERE trigger_event = 'employer_interview_cancelled' AND target_user_type = 'employer';

-- 8. Employer Interview Completed - template expects: name, job_title, company_name
UPDATE telegram_automation_rules
SET variable_mapping = jsonb_build_object(
  'name', 'metadata.candidate_name',
  'job_title', 'metadata.job_title',
  'company_name', 'name'
)
WHERE trigger_event = 'employer_interview_completed' AND target_user_type = 'employer';

-- 9. Employer Payment Success - template expects: company_name, amount, package_name, points, transaction_id
UPDATE telegram_automation_rules
SET variable_mapping = jsonb_build_object(
  'company_name', 'name',
  'amount', 'metadata.amount',
  'package_name', 'metadata.package_name',
  'points', 'metadata.points',
  'transaction_id', 'metadata.transaction_id'
)
WHERE trigger_event = 'employer_payment_success' AND target_user_type = 'employer';

-- 10. Employer Payment Failed - template expects: name, amount, package_name, date, failure_reason
UPDATE telegram_automation_rules
SET variable_mapping = jsonb_build_object(
  'name', 'name',
  'amount', 'metadata.amount',
  'package_name', 'metadata.package_name',
  'date', 'metadata.date',
  'failure_reason', 'metadata.error_message'
)
WHERE trigger_event = 'employer_payment_failed' AND target_user_type = 'employer';

-- 11. Job Expiring Soon - template expects: name, job_title, expiry_date, days_left, applications_count, views_count
UPDATE telegram_automation_rules
SET variable_mapping = jsonb_build_object(
  'name', 'name',
  'job_title', 'metadata.job_title',
  'expiry_date', 'metadata.expiry_date',
  'days_left', 'metadata.days_remaining',
  'applications_count', 'metadata.applications_count',
  'views_count', 'metadata.views_count'
)
WHERE trigger_event = 'employer_job_expiring' AND target_user_type = 'employer';

-- 12. Low Balance Alert - template expects: company_name, current_balance
UPDATE telegram_automation_rules
SET variable_mapping = jsonb_build_object(
  'company_name', 'name',
  'current_balance', 'metadata.current_balance'
)
WHERE trigger_event = 'employer_low_balance' AND target_user_type = 'employer';

-- 13. Employer Profile Incomplete - template expects: name, completion_percent, missing_sections
UPDATE telegram_automation_rules
SET variable_mapping = jsonb_build_object(
  'name', 'name',
  'completion_percent', 'metadata.profile_completion',
  'missing_sections', 'metadata.missing_fields'
)
WHERE trigger_event = 'employer_profile_incomplete' AND target_user_type = 'employer';

-- 14. Employer 2FA OTP - template expects: otp, expiry_minutes, name
UPDATE telegram_automation_rules
SET variable_mapping = jsonb_build_object(
  'name', 'name',
  'otp', 'metadata.otp',
  'expiry_minutes', 'metadata.expiry_minutes'
)
WHERE trigger_event = 'employer_telegram_2fa_otp' AND target_user_type = 'employer';

-- 15. Employer Referral Invite - template expects: name, referral_code, reward_amount, total_referrals, pending_rewards
UPDATE telegram_automation_rules
SET variable_mapping = jsonb_build_object(
  'name', 'name',
  'referral_code', 'metadata.referral_code',
  'referral_link', 'metadata.referral_link',
  'reward_amount', 'metadata.reward_amount',
  'total_referrals', 'metadata.total_referrals',
  'pending_rewards', 'metadata.pending_rewards'
)
WHERE trigger_event = 'employer_referral_invite' AND target_user_type = 'employer';

-- 16. Employer Referral Reward - template expects: name, referred_company, reward_amount, date, total_earnings, total_referrals
UPDATE telegram_automation_rules
SET variable_mapping = jsonb_build_object(
  'name', 'name',
  'referred_company', 'metadata.referred_company',
  'reward_amount', 'metadata.reward_amount',
  'date', 'metadata.date',
  'total_earnings', 'metadata.total_earnings',
  'total_referrals', 'metadata.total_referrals'
)
WHERE trigger_event = 'employer_referral_reward' AND target_user_type = 'employer';

-- =====================
-- VERIFY ALL RULES ARE ACTIVE
-- =====================
UPDATE telegram_automation_rules SET is_active = true WHERE is_active = false;