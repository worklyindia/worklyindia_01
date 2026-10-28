-- Create automation rule for user 2FA OTP
INSERT INTO telegram_automation_rules (
  name,
  description,
  trigger_event,
  template_id,
  is_active,
  variable_mapping,
  delay_minutes,
  trigger_conditions,
  created_by
)
SELECT 
  'User 2FA OTP',
  'Sends 2FA verification OTP to users via Telegram',
  'telegram_2fa_otp',
  t.id,
  true,
  '{"otp": "otp", "name": "name"}'::jsonb,
  0,
  '{}'::jsonb,
  '1769cddb-7244-4b4b-a86f-e0ca3bc028db'::uuid
FROM telegram_message_templates t
WHERE t.name = '2FA OTP Verification'
AND NOT EXISTS (
  SELECT 1 FROM telegram_automation_rules 
  WHERE trigger_event = 'telegram_2fa_otp'
);

-- Create automation rule for employer 2FA OTP
INSERT INTO telegram_automation_rules (
  name,
  description,
  trigger_event,
  template_id,
  is_active,
  variable_mapping,
  delay_minutes,
  trigger_conditions,
  created_by
)
SELECT 
  'Employer 2FA OTP',
  'Sends 2FA verification OTP to employers via Telegram',
  'employer_telegram_2fa_otp',
  t.id,
  true,
  '{"otp": "otp", "name": "name"}'::jsonb,
  0,
  '{}'::jsonb,
  '1769cddb-7244-4b4b-a86f-e0ca3bc028db'::uuid
FROM telegram_message_templates t
WHERE t.name = '2FA OTP Verification'
AND NOT EXISTS (
  SELECT 1 FROM telegram_automation_rules 
  WHERE trigger_event = 'employer_telegram_2fa_otp'
);