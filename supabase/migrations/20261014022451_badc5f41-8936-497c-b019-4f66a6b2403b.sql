CREATE OR REPLACE FUNCTION public.check_social_account_unique()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(NEW.user_id, 'owner') OR public.has_role(NEW.user_id, 'admin') THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'social_meta_accounts' THEN
    IF NEW.status = 'connected' AND EXISTS (
      SELECT 1 FROM public.social_meta_accounts a
      WHERE a.id <> NEW.id
        AND a.user_id <> NEW.user_id
        AND a.status = 'connected'
        AND a.platform = NEW.platform
        AND (a.page_id = NEW.page_id OR (NEW.ig_user_id IS NOT NULL AND a.ig_user_id = NEW.ig_user_id))
    ) THEN
      RAISE EXCEPTION 'This % account is already connected elsewhere.', NEW.platform;
    END IF;
  ELSIF TG_TABLE_NAME = 'social_connections' THEN
    IF NEW.account_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.social_connections c
      WHERE c.id <> NEW.id
        AND c.user_id <> NEW.user_id
        AND c.platform = NEW.platform
        AND c.account_id = NEW.account_id
    ) THEN
      RAISE EXCEPTION 'This % account is already connected elsewhere.', NEW.platform;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.check_social_account_unique() FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.check_social_account_unique() TO service_role;

DROP TRIGGER IF EXISTS social_meta_accounts_unique_check ON public.social_meta_accounts;
CREATE TRIGGER social_meta_accounts_unique_check
  BEFORE INSERT OR UPDATE ON public.social_meta_accounts
  FOR EACH ROW EXECUTE FUNCTION public.check_social_account_unique();

DROP TRIGGER IF EXISTS social_connections_unique_check ON public.social_connections;
CREATE TRIGGER social_connections_unique_check
  BEFORE INSERT OR UPDATE ON public.social_connections
  FOR EACH ROW EXECUTE FUNCTION public.check_social_account_unique();