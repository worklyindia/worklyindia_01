-- Fix the remaining template with wfhindia.app (without trailing slash)
UPDATE telegram_message_templates 
SET content = REPLACE(content, 'https://wfhindia.app', 'https://worklyindia.devs.surf'),
    updated_at = NOW()
WHERE content LIKE '%wfhindia.app%';