-- Update all Telegram message templates to use correct domain
-- Replace wfhindia.app with worklyindia.devs.surf

UPDATE telegram_message_templates 
SET content = REPLACE(content, 'https://wfhindia.app/', 'https://worklyindia.devs.surf/'),
    updated_at = NOW()
WHERE content LIKE '%wfhindia.app%';