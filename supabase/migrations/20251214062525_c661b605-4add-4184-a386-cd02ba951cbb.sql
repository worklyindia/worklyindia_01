-- Add telegram_chat_id column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telegram_chat_id BIGINT;

-- Add telegram_chat_id column to companies table
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS telegram_chat_id BIGINT;