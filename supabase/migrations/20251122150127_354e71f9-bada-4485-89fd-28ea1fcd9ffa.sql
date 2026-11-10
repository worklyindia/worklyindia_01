-- Add AI chat verification settings to app_settings table
INSERT INTO app_settings (setting_key, setting_value, description)
VALUES 
  ('ai_support_verification_enabled', 'true', 'Enable/disable verification badge for AI support chat'),
  ('ai_support_verification_color', 'gold', 'Verification badge color (gold, blue, green, silver)')
ON CONFLICT (setting_key) DO NOTHING;