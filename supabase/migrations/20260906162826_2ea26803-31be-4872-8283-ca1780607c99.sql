INSERT INTO public.site_settings (key, value)
VALUES ('passkey_rp_id', '"worklyindia.devs.surf"'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();