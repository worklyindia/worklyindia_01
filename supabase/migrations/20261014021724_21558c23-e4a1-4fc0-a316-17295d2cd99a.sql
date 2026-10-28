DROP INDEX IF EXISTS public.employer_whatsapp_connected_phone_unique;

CREATE OR REPLACE FUNCTION public.check_whatsapp_phone_unique()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'connected' AND NEW.phone_number_id IS NOT NULL THEN
    -- Owner/admin users have no restriction: they may reuse any number anywhere.
    IF NEW.user_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.user_roles r
      WHERE r.user_id = NEW.user_id AND r.role::text IN ('owner','admin')
    ) THEN
      RETURN NEW;
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.phone_number_id, 0));

    IF TG_TABLE_NAME = 'employer_whatsapp_accounts' THEN
      IF EXISTS (
        SELECT 1 FROM public.whatsapp_audience_accounts a
        WHERE a.status = 'connected' AND a.phone_number_id = NEW.phone_number_id
      ) THEN
        RAISE EXCEPTION 'This WhatsApp number is already connected elsewhere';
      END IF;
      IF EXISTS (
        SELECT 1 FROM public.employer_whatsapp_accounts e
        WHERE e.status = 'connected' AND e.phone_number_id = NEW.phone_number_id
          AND e.id <> NEW.id
      ) THEN
        RAISE EXCEPTION 'This WhatsApp number is already connected to another account';
      END IF;
    ELSE
      IF EXISTS (
        SELECT 1 FROM public.employer_whatsapp_accounts e
        WHERE e.status = 'connected' AND e.phone_number_id = NEW.phone_number_id
      ) THEN
        RAISE EXCEPTION 'This WhatsApp number is already connected to a company account';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION public.check_whatsapp_phone_unique() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_whatsapp_phone_unique() TO service_role;