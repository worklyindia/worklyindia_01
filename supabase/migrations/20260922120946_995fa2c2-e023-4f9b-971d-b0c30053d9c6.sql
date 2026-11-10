UPDATE public.telegram_lifecycle_templates
SET body = replace(
  body,
  '• Mobile : {{mobile}}',
  '• Mobile : <a href="tg://resolve?phone={{mobile_digits}}">{{mobile}}</a>'
), updated_at = now()
WHERE event_type = 'new_application_received'
  AND body LIKE '%• Mobile : {{mobile}}%';