GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_gmail_autoreply_settings TO authenticated;
GRANT ALL ON public.user_gmail_autoreply_settings TO service_role;
GRANT SELECT, DELETE ON public.user_gmail_reply_log TO authenticated;
GRANT ALL ON public.user_gmail_reply_log TO service_role;
GRANT ALL ON public.app_user_connections TO service_role;

DROP POLICY IF EXISTS "Users manage own gmail settings" ON public.user_gmail_autoreply_settings;
CREATE POLICY "Users manage own gmail settings"
ON public.user_gmail_autoreply_settings FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users view own gmail reply log" ON public.user_gmail_reply_log;
CREATE POLICY "Users view own gmail reply log"
ON public.user_gmail_reply_log FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own gmail reply log" ON public.user_gmail_reply_log;
CREATE POLICY "Users delete own gmail reply log"
ON public.user_gmail_reply_log FOR DELETE TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users view own connection metadata" ON public.app_user_connections;
CREATE POLICY "Users view own connection metadata"
ON public.app_user_connections FOR SELECT TO authenticated
USING (auth.uid() = user_id);