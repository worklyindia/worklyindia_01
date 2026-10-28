-- Add missing templates for withdrawal failure and other events
-- Use owner admin ID for created_by

-- First, check and insert Withdrawal Failed template for users
INSERT INTO telegram_message_templates (id, name, content, category, is_active)
SELECT 
  gen_random_uuid(),
  'Withdrawal Failed',
  '❌ <b>Withdrawal Request Failed</b>

Hi {{name}},

We regret to inform you that your withdrawal request of ₹{{amount}} has failed.

<b>Reason:</b> {{reason}}

The amount has been credited back to your wallet. Please check your payment details and try again.

If you need help, contact our support team.',
  'payment',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM telegram_message_templates WHERE name = 'Withdrawal Failed' AND category = 'payment'
);

-- Insert Employer Withdrawal Failed template
INSERT INTO telegram_message_templates (id, name, content, category, is_active)
SELECT 
  gen_random_uuid(),
  'Employer Withdrawal Failed',
  '❌ <b>Withdrawal Request Failed</b>

Hi {{company_name}},

Your withdrawal request of ₹{{amount}} could not be processed.

<b>Reason:</b> {{reason}}

The amount has been credited back to your wallet. Please verify your bank details and try again.

For assistance, contact our support team.',
  'payment',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM telegram_message_templates WHERE name = 'Employer Withdrawal Failed' AND category = 'payment'
);

-- Get template IDs and create automation rules with created_by
DO $$
DECLARE
  user_withdrawal_failed_template_id UUID;
  employer_withdrawal_failed_template_id UUID;
  admin_user_id UUID := '1769cddb-7244-4b4b-a86f-e0ca3bc028db';
BEGIN
  -- Get User Withdrawal Failed template ID
  SELECT id INTO user_withdrawal_failed_template_id 
  FROM telegram_message_templates 
  WHERE name = 'Withdrawal Failed' AND category = 'payment' 
  LIMIT 1;
  
  -- Get Employer Withdrawal Failed template ID
  SELECT id INTO employer_withdrawal_failed_template_id 
  FROM telegram_message_templates 
  WHERE name = 'Employer Withdrawal Failed' AND category = 'payment' 
  LIMIT 1;
  
  -- Create User Withdrawal Failed automation rule if not exists
  IF user_withdrawal_failed_template_id IS NOT NULL THEN
    INSERT INTO telegram_automation_rules (
      name, description, trigger_event, target_user_type, template_id, 
      variable_mapping, is_active, delay_minutes, created_by
    )
    SELECT 
      'User Withdrawal Failed',
      'Notify user when withdrawal request fails',
      'user_withdrawal_failed',
      'job_seeker',
      user_withdrawal_failed_template_id,
      '{"name": "name", "amount": "metadata.amount", "reason": "metadata.reason"}'::jsonb,
      true,
      0,
      admin_user_id
    WHERE NOT EXISTS (
      SELECT 1 FROM telegram_automation_rules WHERE trigger_event = 'user_withdrawal_failed'
    );
  END IF;
  
  -- Create Employer Withdrawal Failed automation rule if not exists
  IF employer_withdrawal_failed_template_id IS NOT NULL THEN
    INSERT INTO telegram_automation_rules (
      name, description, trigger_event, target_user_type, template_id, 
      variable_mapping, is_active, delay_minutes, created_by
    )
    SELECT 
      'Employer Withdrawal Failed',
      'Notify employer when withdrawal request fails',
      'employer_withdrawal_failed',
      'employer',
      employer_withdrawal_failed_template_id,
      '{"company_name": "name", "amount": "metadata.amount", "reason": "metadata.reason"}'::jsonb,
      true,
      0,
      admin_user_id
    WHERE NOT EXISTS (
      SELECT 1 FROM telegram_automation_rules WHERE trigger_event = 'employer_withdrawal_failed'
    );
  END IF;
END $$;

-- Ensure all existing automation rules are active
UPDATE telegram_automation_rules SET is_active = true WHERE is_active = false;

-- Update variable mappings for key templates to ensure proper data flow
UPDATE telegram_automation_rules 
SET variable_mapping = jsonb_build_object(
  'name', 'name',
  'user_name', 'metadata.user_name',
  'amount', 'metadata.amount',
  'points', 'metadata.points',
  'package_name', 'metadata.package_name'
)
WHERE trigger_event IN ('user_payment_success', 'user_payment_failed');

UPDATE telegram_automation_rules 
SET variable_mapping = jsonb_build_object(
  'company_name', 'name',
  'amount', 'metadata.amount',
  'package_name', 'metadata.package_name'
)
WHERE trigger_event IN ('employer_payment_success', 'employer_payment_failed');

UPDATE telegram_automation_rules 
SET variable_mapping = jsonb_build_object(
  'name', 'name',
  'user_name', 'metadata.user_name',
  'job_title', 'metadata.job_title',
  'company_name', 'metadata.company_name',
  'interview_date', 'metadata.interview_date',
  'interview_time', 'metadata.interview_time',
  'interview_mode', 'metadata.interview_mode'
)
WHERE trigger_event = 'interview_scheduled';

UPDATE telegram_automation_rules 
SET variable_mapping = jsonb_build_object(
  'company_name', 'name',
  'applicant_name', 'metadata.applicant_name',
  'job_title', 'metadata.job_title',
  'interview_date', 'metadata.interview_date',
  'interview_time', 'metadata.interview_time',
  'interview_mode', 'metadata.interview_mode'
)
WHERE trigger_event = 'employer_interview_scheduled';

UPDATE telegram_automation_rules 
SET variable_mapping = jsonb_build_object(
  'name', 'name',
  'user_name', 'metadata.user_name',
  'amount', 'metadata.amount'
)
WHERE trigger_event IN ('user_withdrawal_approved', 'user_withdrawal_failed');

UPDATE telegram_automation_rules 
SET variable_mapping = jsonb_build_object(
  'company_name', 'name',
  'amount', 'metadata.amount'
)
WHERE trigger_event IN ('employer_withdrawal_approved', 'employer_withdrawal_failed');