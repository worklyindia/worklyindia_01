ALTER TABLE public.interviews ADD COLUMN IF NOT EXISTS start_notified_at timestamptz;

INSERT INTO public.push_lifecycle_templates (event_type, title, body, button_text, button_url, enabled)
VALUES
  ('interview_employer_joined', '🎥 Interviewer has joined', '{{company}} has joined your interview for {{job_title}}.
Please join now.
Mode: {{mode}}
Date: {{date}}
Time: {{time}}', 'Join Interview', '/activity', true),
  ('interview_started', '🔴 Your interview has started', '{{job_title}} at {{company}}
Your interview time has started — join now.
Date: {{interview_date}}
Time: {{interview_time}}
Mode: {{mode}}', 'Join Now', '/activity', true)
ON CONFLICT (event_type) DO NOTHING;

INSERT INTO public.telegram_lifecycle_templates (event_type, title, body, button_text, button_url, enabled)
VALUES
  ('interview_employer_joined', '🎥 Interviewer Has Joined', '💼 {{job_title}}
🏢 {{company}}
💻 Mode: {{mode}}
🗓️ {{date}}  ⏰ {{time}}

The interviewer is waiting in the interview room. Join now from your Activity section, and keep your resume and ID ready.', 'Join Interview', '/activity', true),
  ('interview_started', '🔴 Your Interview Has Started', '💼 {{job_title}}
🏢 {{company}}
🗓️ {{interview_date}}
⏰ {{interview_time}}
💻 Mode: {{mode}}

Your interview time has begun. Join right away — check your internet, camera and microphone if it is a video interview.', 'Join Now', '/activity', true)
ON CONFLICT (event_type) DO NOTHING;

INSERT INTO public.email_lifecycle_templates (event_type, subject, body, button_text, button_url, enabled)
VALUES
  ('interview_employer_joined', '{{company}} has joined your interview for {{job_title}}', 'Hi {{name}},

The interviewer from {{company}} has joined your interview room. Please join now so the interview can begin on time.

Interview details
Position: {{job_title}}
Company: {{company}}
Mode: {{mode}}
Joined on: {{date}} at {{time}}

Before you join
• Open the interview from the Activity section of your account.
• For a video interview, check your internet, camera and microphone and sit in a quiet, well-lit place.
• Keep your resume, a valid ID and any certificates within reach.
• Speak clearly and be ready to explain your experience and why you suit this role.

If you are unable to join right now, inform the employer immediately so they can wait or arrange another slot.

All the best,
Team Workly India', 'Join Interview', '/activity', true),
  ('interview_started', 'Your interview for {{job_title}} has started', 'Hi {{name}},

Your interview time has arrived and the interview is now open. Please join right away.

Interview details
Position: {{job_title}}
Company: {{company}}
Date: {{interview_date}}
Time: {{interview_time}}
Mode: {{mode}}

Quick checklist
• Join from the Activity section of your Workly India account.
• Test your internet, camera and microphone if it is a video interview.
• Keep your resume, ID and certificates ready.
• Joining late leaves a poor impression, so join now even if you are a few minutes behind.

If something urgent prevents you from attending, inform the employer at once so another slot can be arranged.

Best of luck,
Team Workly India', 'Join Interview Now', '/activity', true)
ON CONFLICT (event_type) DO NOTHING;