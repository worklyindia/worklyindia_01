UPDATE public.site_settings
SET value = replace(value::text, 'wfh.india.24x7@gmail.com', 'worklyindia@outlook.com')::jsonb,
    updated_at = now()
WHERE key = 'contact_us_info';