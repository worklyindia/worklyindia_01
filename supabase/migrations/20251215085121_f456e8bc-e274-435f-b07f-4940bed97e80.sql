-- Allow all authenticated users to read telegram bot settings (bot_username, is_active)
-- This is needed so normal users can see the "Connect Telegram" button

CREATE POLICY "Allow authenticated users to read bot settings"
ON public.telegram_bot_settings
FOR SELECT
TO authenticated
USING (true);