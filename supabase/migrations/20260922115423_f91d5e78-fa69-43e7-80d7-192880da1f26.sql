UPDATE public.telegram_lifecycle_templates
SET body = replace(body, '+{{mobile_digits}}', '{{mobile}}')
WHERE body LIKE '%+{{mobile_digits}}%';