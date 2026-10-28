CREATE OR REPLACE FUNCTION public.sync_whatsapp_from_phone()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.phone IS NOT NULL AND btrim(NEW.phone) <> '' THEN
    NEW.whatsapp_number := NEW.phone;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_sync_whatsapp_from_phone ON public.profiles;
CREATE TRIGGER profiles_sync_whatsapp_from_phone BEFORE INSERT OR UPDATE OF phone, whatsapp_number ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_whatsapp_from_phone();

DROP TRIGGER IF EXISTS companies_sync_whatsapp_from_phone ON public.companies;
CREATE TRIGGER companies_sync_whatsapp_from_phone BEFORE INSERT OR UPDATE OF phone, whatsapp_number ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.sync_whatsapp_from_phone();

UPDATE public.profiles SET whatsapp_number = phone WHERE phone IS NOT NULL AND btrim(phone) <> '' AND whatsapp_number IS DISTINCT FROM phone;
UPDATE public.companies SET whatsapp_number = phone WHERE phone IS NOT NULL AND btrim(phone) <> '' AND whatsapp_number IS DISTINCT FROM phone;