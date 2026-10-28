-- Add password_changed_at column to user_settings table
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP WITH TIME ZONE;

-- Add password_changed_at column to employer_settings table
ALTER TABLE public.employer_settings 
ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP WITH TIME ZONE;