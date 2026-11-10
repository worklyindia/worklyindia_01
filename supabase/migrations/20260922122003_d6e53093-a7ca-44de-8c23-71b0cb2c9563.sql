UPDATE public.telegram_lifecycle_templates
SET body = replace(
  body,
  '<a href="tg://resolve?phone={{mobile_digits}}">{{mobile}}</a>',
  '{{mobile}}'
),
updated_at = now()
WHERE event_type = 'new_application_received'
  AND body LIKE '%tg://resolve?phone={{mobile_digits}}%';