-- Add telegram connect code columns to profiles and companies
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS telegram_connect_code TEXT UNIQUE;

ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS telegram_connect_code TEXT UNIQUE;

-- Create function to generate random 8-character alphanumeric code with prefix
CREATE OR REPLACE FUNCTION generate_telegram_connect_code(prefix TEXT DEFAULT 'P')
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := prefix || '-';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger function to auto-generate connect code for profiles
CREATE OR REPLACE FUNCTION auto_generate_profile_connect_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.telegram_connect_code IS NULL THEN
    NEW.telegram_connect_code := generate_telegram_connect_code('P');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger function to auto-generate connect code for companies
CREATE OR REPLACE FUNCTION auto_generate_company_connect_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.telegram_connect_code IS NULL THEN
    NEW.telegram_connect_code := generate_telegram_connect_code('E');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_auto_profile_connect_code ON public.profiles;
CREATE TRIGGER trigger_auto_profile_connect_code
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_profile_connect_code();

DROP TRIGGER IF EXISTS trigger_auto_company_connect_code ON public.companies;
CREATE TRIGGER trigger_auto_company_connect_code
  BEFORE INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_company_connect_code();

-- Generate codes for existing profiles without codes
UPDATE public.profiles 
SET telegram_connect_code = generate_telegram_connect_code('P')
WHERE telegram_connect_code IS NULL;

-- Generate codes for existing companies without codes
UPDATE public.companies 
SET telegram_connect_code = generate_telegram_connect_code('E')
WHERE telegram_connect_code IS NULL;