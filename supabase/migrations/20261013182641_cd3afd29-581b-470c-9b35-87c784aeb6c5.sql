DROP INDEX IF EXISTS public.whatsapp_audience_accounts_connected_phone_unique;
CREATE OR REPLACE FUNCTION public.check_whatsapp_phone_unique()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'connected' AND NEW.phone_number_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.phone_number_id, 0));
    IF TG_TABLE_NAME = 'employer_whatsapp_accounts' THEN
      IF EXISTS (
        SELECT 1 FROM public.whatsapp_audience_accounts a
        WHERE a.status='connected' AND a.phone_number_id=NEW.phone_number_id
        AND (a.audience='customer_service' OR NOT EXISTS (
          SELECT 1 FROM public.user_roles r WHERE r.user_id=NEW.user_id AND r.role::text IN ('owner','admin')
        ))
      ) THEN
        RAISE EXCEPTION 'This WhatsApp number is already connected elsewhere';
      END IF;
    ELSE
      IF EXISTS (
        SELECT 1 FROM public.employer_whatsapp_accounts e
        WHERE e.status='connected' AND e.phone_number_id=NEW.phone_number_id
        AND (NEW.audience='customer_service' OR NOT EXISTS (
          SELECT 1 FROM public.user_roles r WHERE r.user_id=e.user_id AND r.role::text IN ('owner','admin')
        ))
      ) THEN
        RAISE EXCEPTION 'Only an authorized Owner or Admin AI Connect number can be reused for notifications; Customer Service cannot take over a company number';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.check_whatsapp_phone_unique() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_whatsapp_phone_unique() TO service_role;
COMMENT ON FUNCTION public.check_whatsapp_phone_unique() IS 'Notification audiences may share platform numbers or authorized owner/admin AI Connect numbers; inbound company and Customer Service ownership stays exclusive.';