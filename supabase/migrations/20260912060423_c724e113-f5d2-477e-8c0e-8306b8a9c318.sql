INSERT INTO public.app_settings (setting_key, setting_value)
VALUES ('ai_only_mode', 'false')
ON CONFLICT (setting_key) DO NOTHING;