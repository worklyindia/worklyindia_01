-- Add Telegram columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS telegram_id BIGINT UNIQUE,
ADD COLUMN IF NOT EXISTS telegram_username TEXT,
ADD COLUMN IF NOT EXISTS telegram_connected_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS telegram_notifications_enabled BOOLEAN DEFAULT true;

-- Add Telegram columns to companies table
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS telegram_id BIGINT UNIQUE,
ADD COLUMN IF NOT EXISTS telegram_username TEXT,
ADD COLUMN IF NOT EXISTS telegram_connected_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS telegram_notifications_enabled BOOLEAN DEFAULT true;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_telegram_id ON public.profiles(telegram_id) WHERE telegram_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_companies_telegram_id ON public.companies(telegram_id) WHERE telegram_id IS NOT NULL;