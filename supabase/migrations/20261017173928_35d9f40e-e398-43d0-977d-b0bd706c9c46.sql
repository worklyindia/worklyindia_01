CREATE OR REPLACE FUNCTION public.check_whatsapp_phone_unique()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'connected' AND NEW.phone_number_id IS NOT NULL THEN
    -- Only company accounts carry user_id. Never read it from audience records.
    IF TG_TABLE_NAME = 'employer_whatsapp_accounts' THEN
      IF NEW.user_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.user_roles r
        WHERE r.user_id = NEW.user_id AND r.role::text IN ('owner','admin')
      ) THEN RETURN NEW; END IF;
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.phone_number_id, 0));
    IF TG_TABLE_NAME = 'employer_whatsapp_accounts' THEN
      IF EXISTS (SELECT 1 FROM public.whatsapp_audience_accounts a WHERE a.status = 'connected' AND a.phone_number_id = NEW.phone_number_id) THEN
        RAISE EXCEPTION 'This WhatsApp number is already connected elsewhere';
      END IF;
      IF EXISTS (SELECT 1 FROM public.employer_whatsapp_accounts e WHERE e.status = 'connected' AND e.phone_number_id = NEW.phone_number_id AND e.id <> NEW.id) THEN
        RAISE EXCEPTION 'This WhatsApp number is already connected to another account';
      END IF;
    ELSE
      IF EXISTS (SELECT 1 FROM public.employer_whatsapp_accounts e WHERE e.status = 'connected' AND e.phone_number_id = NEW.phone_number_id) THEN
        RAISE EXCEPTION 'This WhatsApp number is already connected to a company account';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END
$function$;
-- Regression: exercise the actual Customer Service trigger, then roll back the test write.
DO $test$
DECLARE test_phone text := 'test-' || gen_random_uuid()::text;
BEGIN
  BEGIN
    INSERT INTO public.whatsapp_audience_accounts (audience, status, phone_number_id)
    VALUES ('customer_service', 'connected', test_phone)
    ON CONFLICT (audience) DO UPDATE SET status = EXCLUDED.status, phone_number_id = EXCLUDED.phone_number_id;
    IF NOT EXISTS (SELECT 1 FROM public.whatsapp_audience_accounts WHERE audience = 'customer_service' AND status = 'connected' AND phone_number_id = test_phone) THEN
      RAISE EXCEPTION 'Customer Service connection regression';
    END IF;
    RAISE EXCEPTION USING ERRCODE = 'ZX001', MESSAGE = 'rollback regression fixture';
  EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
  END;
  IF EXISTS (SELECT 1 FROM public.whatsapp_audience_accounts WHERE phone_number_id = test_phone) THEN
    RAISE EXCEPTION 'Regression fixture was not rolled back';
  END IF;
END
$test$;