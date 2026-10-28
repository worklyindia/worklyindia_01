INSERT INTO public.app_settings (setting_key, setting_value)
VALUES ('fb_whatsapp_es_config_id', '')
ON CONFLICT (setting_key) DO NOTHING;