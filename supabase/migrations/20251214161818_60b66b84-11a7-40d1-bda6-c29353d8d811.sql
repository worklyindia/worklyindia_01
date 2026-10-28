
-- Insert Telegram OTP template
INSERT INTO telegram_message_templates (name, category, content, variables, is_active, created_by)
VALUES (
  '2FA OTP Code',
  'security',
  '🔐 Your Workly India verification code is: {{otp}}

This code will expire in {{expiry_minutes}} minutes.

Do not share this code with anyone.',
  '["otp", "expiry_minutes", "name"]'::jsonb,
  true,
  '1769cddb-7244-4b4b-a86f-e0ca3bc028db'
);

-- Get the template ID and create automation rules
DO $$
DECLARE
  template_uuid uuid;
BEGIN
  SELECT id INTO template_uuid FROM telegram_message_templates WHERE name = '2FA OTP Code' LIMIT 1;
  
  -- Rule for job seeker 2FA OTP
  INSERT INTO telegram_automation_rules (name, description, trigger_event, template_id, variable_mapping, is_active, target_user_type, created_by)
  VALUES (
    'Job Seeker 2FA OTP',
    'Sends OTP code to job seekers for Telegram 2FA verification',
    'telegram_2fa_otp',
    template_uuid,
    '{"otp": "metadata.otp", "name": "name", "expiry_minutes": "metadata.expiry_minutes"}'::jsonb,
    true,
    'job_seeker',
    '1769cddb-7244-4b4b-a86f-e0ca3bc028db'
  );
  
  -- Rule for employer 2FA OTP
  INSERT INTO telegram_automation_rules (name, description, trigger_event, template_id, variable_mapping, is_active, target_user_type, created_by)
  VALUES (
    'Employer 2FA OTP',
    'Sends OTP code to employers for Telegram 2FA verification',
    'employer_telegram_2fa_otp',
    template_uuid,
    '{"otp": "metadata.otp", "name": "name", "expiry_minutes": "metadata.expiry_minutes"}'::jsonb,
    true,
    'employer',
    '1769cddb-7244-4b4b-a86f-e0ca3bc028db'
  );
END $$;
