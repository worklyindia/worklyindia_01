CREATE OR REPLACE FUNCTION public.payment_mobile_taken(_mobile text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.payment_profiles
    WHERE mobile IS NOT NULL AND user_id <> auth.uid()
      AND right(regexp_replace(mobile, '\D', '', 'g'), 10) = right(regexp_replace(_mobile, '\D', '', 'g'), 10));
$$;
REVOKE EXECUTE ON FUNCTION public.payment_mobile_taken(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.payment_mobile_taken(text) TO authenticated;