REVOKE EXECUTE ON FUNCTION public.consume_whatsapp_send(text, text, integer, integer, text) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_whatsapp_send_usage(text, text) FROM public, anon, authenticated;
REVOKE ALL ON public.whatsapp_send_windows FROM anon, authenticated;

CREATE POLICY "Server-only access to WhatsApp send windows"
ON public.whatsapp_send_windows
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);