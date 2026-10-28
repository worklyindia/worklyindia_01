INSERT INTO public.push_lifecycle_templates (event_type, enabled, title, body, button_text, button_url)
VALUES ('birthday_greeting_employer', true, '🎂 Happy Birthday, {{name}}!', 'Wishing you a wonderful year ahead and great hiring success for your team.', 'Open Dashboard', '/employer/dashboard')
ON CONFLICT (event_type) DO NOTHING;

INSERT INTO public.telegram_lifecycle_templates (event_type, enabled, title, body, button_text, button_url)
VALUES ('birthday_greeting_employer', true, 'Happy Birthday', 'Happy Birthday, {{name}}! 🎂

Wishing you a year full of good health, happiness and strong business growth.

May this new year of your life bring your team the right talent and great results.

Warm wishes from the Workly India team 🎉', 'Open Dashboard', '/employer/dashboard')
ON CONFLICT (event_type) DO NOTHING;

INSERT INTO public.email_lifecycle_templates (event_type, enabled, subject, body)
VALUES ('birthday_greeting_employer', true, 'Happy Birthday, {{name}}', '<p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:1px;color:#3B5CE4;">HAPPY BIRTHDAY</p><h1 style="margin:0 0 14px;font-size:20px;line-height:1.3;font-weight:700;color:#0f1b33;">Happy Birthday, {{name}}</h1><p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#374151;">Dear {{name}},</p><p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#374151;">Wishing you a wonderful year ahead, full of growth for you and your team.</p><p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#374151;">May this year bring your business the right talent and steady growth.</p><p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#374151;">With warm wishes,<br/><strong style="color:#0f1b33;">Team Workly India</strong></p><div style="margin:6px 0 18px;border-top:1px solid #e3e8f2;"></div><p style="margin:4px 0 8px;text-align:center;line-height:1.2;"><a href="https://worklyindia.devs.surf/employer/dashboard" style="display:inline-block;padding:14px 30px;border-radius:10px;background-color:#3B5CE4;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;line-height:1.2;">Open Dashboard</a></p>')
ON CONFLICT (event_type) DO NOTHING;