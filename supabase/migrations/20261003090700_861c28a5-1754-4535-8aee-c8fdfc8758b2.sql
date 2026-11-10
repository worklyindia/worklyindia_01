CREATE TABLE public.api_call_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  calls integer NOT NULL,
  amount numeric NOT NULL,
  order_id text,
  payment_id text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.api_call_purchases TO authenticated;
GRANT ALL ON public.api_call_purchases TO service_role;
ALTER TABLE public.api_call_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own API call purchases" ON public.api_call_purchases FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.add_purchased_api_calls(_user_id uuid, _calls integer, _amount numeric, _order_id text, _payment_id text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.api_call_purchases(user_id, calls, amount, order_id, payment_id)
  VALUES (_user_id, _calls, _amount, _order_id, _payment_id) ON CONFLICT (payment_id) DO NOTHING;
  IF NOT FOUND THEN RETURN false; END IF;
  PERFORM public.api_quota_refresh(_user_id);
  UPDATE public.api_call_quota SET monthly_limit = monthly_limit + _calls, updated_at = now() WHERE user_id = _user_id;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.add_purchased_api_calls(uuid, integer, numeric, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_purchased_api_calls(uuid, integer, numeric, text, text) TO service_role;

INSERT INTO public.app_settings(setting_key, setting_value, description)
SELECT 'api_call_price', '0.25', 'Price in INR for one extra developer API call'
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE setting_key='api_call_price');