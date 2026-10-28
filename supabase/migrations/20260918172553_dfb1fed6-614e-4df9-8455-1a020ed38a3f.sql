insert into telegram_lifecycle_templates (event_type, title, body, button_text, button_url, enabled)
values (
  'bot_already_connected_employer',
  '✅ Already Connected!',
  'Hi {{name}}, your Telegram is already linked to your Workly India employer account.

🔔 New applicant alerts and hiring updates will keep arriving right here.
Date : {{date}}
Time : {{time}}',
  'Open Dashboard',
  '/employer/dashboard',
  true
)
on conflict (event_type) do nothing;