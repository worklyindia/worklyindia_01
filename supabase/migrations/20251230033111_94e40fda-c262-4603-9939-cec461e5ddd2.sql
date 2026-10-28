-- Activate ALL WhatsApp automation rules
UPDATE whatsapp_automation_rules SET is_active = true WHERE is_active = false;

-- Also ensure Telegram automation rules are active
UPDATE telegram_automation_rules SET is_active = true WHERE is_active = false;