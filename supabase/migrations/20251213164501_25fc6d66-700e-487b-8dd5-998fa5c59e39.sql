-- Update telegram_bot_settings with the bot username
UPDATE public.telegram_bot_settings 
SET bot_username = 'WFH_IN_Bot', 
    is_active = true,
    updated_at = now()
WHERE id = (SELECT id FROM public.telegram_bot_settings LIMIT 1);

-- If no row exists, insert one
INSERT INTO public.telegram_bot_settings (bot_username, is_active)
SELECT 'WFH_IN_Bot', true
WHERE NOT EXISTS (SELECT 1 FROM public.telegram_bot_settings);