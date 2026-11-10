-- url_clicks
DROP POLICY IF EXISTS "Service role can insert clicks" ON public.url_clicks;
CREATE POLICY "Service role can insert clicks" ON public.url_clicks FOR INSERT TO service_role WITH CHECK (true);

-- verification_purchases
DROP POLICY IF EXISTS "System can manage verification purchases" ON public.verification_purchases;
CREATE POLICY "System can manage verification purchases" ON public.verification_purchases FOR ALL TO service_role USING (true) WITH CHECK (true);

-- wallets
DROP POLICY IF EXISTS "System can manage all wallets" ON public.wallets;
CREATE POLICY "System can manage all wallets" ON public.wallets FOR ALL TO service_role USING (true) WITH CHECK (true);

-- whatsapp_ai_settings
DROP POLICY IF EXISTS "Service role can read AI settings" ON public.whatsapp_ai_settings;
CREATE POLICY "Service role can read AI settings" ON public.whatsapp_ai_settings FOR SELECT TO service_role USING (true);

-- whatsapp_conversations
DROP POLICY IF EXISTS "Service role can manage conversations" ON public.whatsapp_conversations;
CREATE POLICY "Service role can manage conversations" ON public.whatsapp_conversations FOR ALL TO service_role USING (true) WITH CHECK (true);

-- whatsapp_human_handoff
DROP POLICY IF EXISTS "Service role can manage handoffs" ON public.whatsapp_human_handoff;
CREATE POLICY "Service role can manage handoffs" ON public.whatsapp_human_handoff FOR ALL TO service_role USING (true) WITH CHECK (true);

-- whatsapp_quick_replies
DROP POLICY IF EXISTS "Service role read access" ON public.whatsapp_quick_replies;
CREATE POLICY "Service role read access" ON public.whatsapp_quick_replies FOR SELECT TO service_role USING (true);

-- whatsapp_trigger_logs
DROP POLICY IF EXISTS "Service role can update trigger logs" ON public.whatsapp_trigger_logs;
CREATE POLICY "Service role can update trigger logs" ON public.whatsapp_trigger_logs FOR UPDATE TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Service role can insert trigger logs" ON public.whatsapp_trigger_logs;
CREATE POLICY "Service role can insert trigger logs" ON public.whatsapp_trigger_logs FOR INSERT TO service_role WITH CHECK (true);

-- whatsapp_user_sessions
DROP POLICY IF EXISTS "Service role can manage sessions" ON public.whatsapp_user_sessions;
CREATE POLICY "Service role can manage sessions" ON public.whatsapp_user_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);