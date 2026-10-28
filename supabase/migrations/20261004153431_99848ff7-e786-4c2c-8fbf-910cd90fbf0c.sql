ALTER PUBLICATION supabase_realtime ADD TABLE public.api_call_quota;
GRANT SELECT ON public.api_call_quota TO authenticated;