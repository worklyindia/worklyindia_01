-- Add whatsapp_verified column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS whatsapp_verified boolean DEFAULT false;

-- Add whatsapp_verified column to companies table
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS whatsapp_verified boolean DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.whatsapp_verified IS 'Tracks if the WhatsApp number has been verified via OTP';
COMMENT ON COLUMN public.companies.whatsapp_verified IS 'Tracks if the company WhatsApp number has been verified via OTP';