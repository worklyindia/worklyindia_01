-- Update the telegram template content with job-specific link
UPDATE telegram_message_templates 
SET content = '📥 <b>New Application Received!</b>

Hello {{company_name}},

New application for <b>{{job_title}}</b>:

👤 <b>Name:</b> {{applicant_name}}
📱 <b>Phone:</b> {{applicant_phone}}
💬 <b>WhatsApp:</b> {{applicant_phone}}
📧 <b>Email:</b> {{applicant_email}}
📍 <b>Location:</b> {{location}}

Review and respond quickly! ⚡

👉 <a href="https://worklyindia.devs.surf/job/{{job_id}}/applicants">View Application</a>',
    variables = '["company_name", "job_title", "applicant_name", "applicant_phone", "applicant_email", "location", "job_id"]'::jsonb,
    updated_at = now()
WHERE id = '515157d2-c828-4aa6-ab71-91240a30ed91';

-- Update the automation rule variable_mapping to include job_id
UPDATE telegram_automation_rules
SET variable_mapping = '{"applicant_email": "metadata.applicant_email", "applicant_name": "metadata.applicant_name", "applicant_phone": "metadata.applicant_phone", "company_name": "name", "job_title": "metadata.job_title", "location": "metadata.location", "job_id": "metadata.job_id"}'::jsonb,
    updated_at = now()
WHERE id = '69c6474e-3d92-4639-ba46-b42fba86694a';