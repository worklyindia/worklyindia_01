-- Insert automation rule for user 2FA OTP (using known admin user ID)
INSERT INTO telegram_automation_rules (name, trigger_event, template_id, variable_mapping, is_active, created_by)
SELECT 
  'User 2FA OTP via Telegram',
  'telegram_2fa_otp',
  t.id,
  '{"otp": "otp", "name": "name"}'::jsonb,
  true,
  '1769cddb-7244-4b4b-a86f-e0ca3bc028db'::uuid
FROM telegram_message_templates t
WHERE t.name = '2FA OTP Verification'
AND NOT EXISTS (
  SELECT 1 FROM telegram_automation_rules WHERE trigger_event = 'telegram_2fa_otp'
);

-- Insert automation rule for employer 2FA OTP
INSERT INTO telegram_automation_rules (name, trigger_event, template_id, variable_mapping, is_active, created_by)
SELECT 
  'Employer 2FA OTP via Telegram',
  'employer_telegram_2fa_otp',
  t.id,
  '{"otp": "otp", "name": "name"}'::jsonb,
  true,
  '1769cddb-7244-4b4b-a86f-e0ca3bc028db'::uuid
FROM telegram_message_templates t
WHERE t.name = '2FA OTP Verification'
AND NOT EXISTS (
  SELECT 1 FROM telegram_automation_rules WHERE trigger_event = 'employer_telegram_2fa_otp'
);