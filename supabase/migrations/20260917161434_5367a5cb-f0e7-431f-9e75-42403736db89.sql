CREATE OR REPLACE FUNCTION public.get_telegram_bot_username(p_audience text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT bot_username
  FROM public.telegram_audience_bots
  WHERE audience = p_audience
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_telegram_bot_username(text) TO anon, authenticated, service_role;