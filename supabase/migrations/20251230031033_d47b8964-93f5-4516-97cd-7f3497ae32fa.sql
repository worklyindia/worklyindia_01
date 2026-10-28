-- Update the new_application_received template to use Email instead of Experience
UPDATE telegram_message_templates 
SET content = '📥 *New Application Received!*

Hello {{company_name}},

New application for *{{job_title}}*:

👤 {{applicant_name}}
📱 {{applicant_phone}}
📧 Email: {{applicant_email}}

Review and respond quickly! ⚡',
    updated_at = NOW()
WHERE name = 'New Application Received';

-- Update the automation rule variable mapping
UPDATE telegram_automation_rules 
SET variable_mapping = variable_mapping - 'experience' || '{"applicant_email": "metadata.applicant_email"}'::jsonb,
    updated_at = NOW()
WHERE trigger_event = 'new_application_received';