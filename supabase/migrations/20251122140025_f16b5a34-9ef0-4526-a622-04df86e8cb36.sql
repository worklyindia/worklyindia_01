-- Insert default AI chat settings
INSERT INTO app_settings (setting_key, setting_value, description)
VALUES 
  ('ai_support_name', 'Workly India Support', 'AI Career Chat display name'),
  ('ai_support_tagline', 'AI Career Assistant', 'AI Career Chat tagline'),
  ('ai_support_avatar', '', 'AI Career Chat avatar URL')
ON CONFLICT (setting_key) DO NOTHING;