-- ai_chat_subscriptions
DROP POLICY IF EXISTS "Service role can manage all subscriptions" ON public.ai_chat_subscriptions;
CREATE POLICY "Service role can manage all subscriptions" ON public.ai_chat_subscriptions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ai_chat_usage
DROP POLICY IF EXISTS "Service role can manage all usage" ON public.ai_chat_usage;
CREATE POLICY "Service role can manage all usage" ON public.ai_chat_usage FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ai_data_access_logs
DROP POLICY IF EXISTS "Service role can insert ai_data_access_logs" ON public.ai_data_access_logs;
CREATE POLICY "Service role can insert ai_data_access_logs" ON public.ai_data_access_logs FOR INSERT TO service_role WITH CHECK (true);

-- ai_response_cache
DROP POLICY IF EXISTS "Authenticated users can read cache" ON public.ai_response_cache;

-- api_health_checks
DROP POLICY IF EXISTS "Health checks are viewable by everyone" ON public.api_health_checks;
CREATE POLICY "Authenticated users can view health checks" ON public.api_health_checks FOR SELECT TO authenticated USING (true);

-- api_request_logs
DROP POLICY IF EXISTS "Service role can insert API request logs" ON public.api_request_logs;
CREATE POLICY "Service role can insert API request logs" ON public.api_request_logs FOR INSERT TO service_role WITH CHECK (true);

-- cached_audio
DROP POLICY IF EXISTS "Service role can manage cached audio" ON public.cached_audio;
CREATE POLICY "Service role can manage cached audio" ON public.cached_audio FOR ALL TO service_role USING (true) WITH CHECK (true);

-- cleanup_execution_logs
DROP POLICY IF EXISTS "Admins can insert cleanup logs" ON public.cleanup_execution_logs;
CREATE POLICY "Admins can insert cleanup logs" ON public.cleanup_execution_logs FOR INSERT TO service_role WITH CHECK (true);

-- cleanup_logs
DROP POLICY IF EXISTS "Allow cleanup log reads" ON public.cleanup_logs;
DROP POLICY IF EXISTS "Allow cleanup log inserts" ON public.cleanup_logs;
CREATE POLICY "Service role can manage cleanup logs" ON public.cleanup_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- company_statistics (keep public SELECT, fix system ALL)
DROP POLICY IF EXISTS "System can manage company statistics" ON public.company_statistics;
CREATE POLICY "System can manage company statistics" ON public.company_statistics FOR ALL TO service_role USING (true) WITH CHECK (true);

-- device_info_logs
DROP POLICY IF EXISTS "Service role full access" ON public.device_info_logs;
CREATE POLICY "Service role full access" ON public.device_info_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- employer_notifications
DROP POLICY IF EXISTS "System can create employer notifications" ON public.employer_notifications;
CREATE POLICY "System can create employer notifications" ON public.employer_notifications FOR INSERT TO service_role WITH CHECK (true);

-- engagement_skip_log
DROP POLICY IF EXISTS "Service role can insert skip log" ON public.engagement_skip_log;
CREATE POLICY "Service role can insert skip log" ON public.engagement_skip_log FOR INSERT TO service_role WITH CHECK (true);

-- google_calendar_api
DROP POLICY IF EXISTS "Public read access to google calendar api" ON public.google_calendar_api;
CREATE POLICY "Service role can read google calendar api" ON public.google_calendar_api FOR SELECT TO service_role USING (true);

-- google_indexing_queue
DROP POLICY IF EXISTS "Service role full access" ON public.google_indexing_queue;
CREATE POLICY "Service role full access" ON public.google_indexing_queue FOR ALL TO service_role USING (true) WITH CHECK (true);

-- indexing_daily_quota / slots / error_logs
DROP POLICY IF EXISTS "Service role has full access to indexing_daily_quota" ON public.indexing_daily_quota;
CREATE POLICY "Service role has full access to indexing_daily_quota" ON public.indexing_daily_quota FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Service role full access to indexing_daily_slots" ON public.indexing_daily_slots;
CREATE POLICY "Service role full access to indexing_daily_slots" ON public.indexing_daily_slots FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Service role has full access to indexing_error_logs" ON public.indexing_error_logs;
CREATE POLICY "Service role has full access to indexing_error_logs" ON public.indexing_error_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- interview_cleanup_logs / interview_participants
DROP POLICY IF EXISTS "System can manage cleanup logs" ON public.interview_cleanup_logs;
CREATE POLICY "System can manage cleanup logs" ON public.interview_cleanup_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "System can update participants" ON public.interview_participants;
CREATE POLICY "System can update participants" ON public.interview_participants FOR UPDATE TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "System can insert participants" ON public.interview_participants;
CREATE POLICY "System can insert participants" ON public.interview_participants FOR INSERT TO service_role WITH CHECK (true);

-- job_boosts / job_payments
DROP POLICY IF EXISTS "System can manage job boosts" ON public.job_boosts;
CREATE POLICY "System can manage job boosts" ON public.job_boosts FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "System can manage job payments" ON public.job_payments;
CREATE POLICY "System can manage job payments" ON public.job_payments FOR ALL TO service_role USING (true) WITH CHECK (true);

-- notifications
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;
CREATE POLICY "System can create notifications" ON public.notifications FOR INSERT TO service_role WITH CHECK (true);

-- password_reset_tokens
DROP POLICY IF EXISTS "Service role can manage password reset tokens" ON public.password_reset_tokens;
CREATE POLICY "Service role can manage password reset tokens" ON public.password_reset_tokens FOR ALL TO service_role USING (true) WITH CHECK (true);

-- points_transactions
DROP POLICY IF EXISTS "System can manage points transactions" ON public.points_transactions;
CREATE POLICY "System can manage points transactions" ON public.points_transactions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- push_notification_logs
DROP POLICY IF EXISTS "System can manage push notification logs" ON public.push_notification_logs;
CREATE POLICY "System can manage push notification logs" ON public.push_notification_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- rate_limits / traffic_stats
DROP POLICY IF EXISTS "Allow rate limit operations" ON public.rate_limits;
DROP POLICY IF EXISTS "System can manage rate limits" ON public.rate_limits;
CREATE POLICY "Service role manages rate limits" ON public.rate_limits FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow traffic stats operations" ON public.traffic_stats;
CREATE POLICY "Service role manages traffic stats" ON public.traffic_stats FOR ALL TO service_role USING (true) WITH CHECK (true);

-- referral_commissions / referral_wallets / user_referrals
DROP POLICY IF EXISTS "System can update commissions" ON public.referral_commissions;
CREATE POLICY "System can update commissions" ON public.referral_commissions FOR UPDATE TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "System can create commissions" ON public.referral_commissions;
CREATE POLICY "System can create commissions" ON public.referral_commissions FOR INSERT TO service_role WITH CHECK (true);
DROP POLICY IF EXISTS "System can manage referral wallets" ON public.referral_wallets;
CREATE POLICY "System can manage referral wallets" ON public.referral_wallets FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "System can update referral wallets" ON public.referral_wallets;
DROP POLICY IF EXISTS "System can create referral relationships" ON public.user_referrals;
CREATE POLICY "System can create referral relationships" ON public.user_referrals FOR INSERT TO service_role WITH CHECK (true);
DROP POLICY IF EXISTS "System can manage user referrals" ON public.user_referrals;
CREATE POLICY "System can manage user referrals" ON public.user_referrals FOR ALL TO service_role USING (true) WITH CHECK (true);

-- referral_competition_leaderboard system rule (keep public view)
DROP POLICY IF EXISTS "System can manage leaderboard" ON public.referral_competition_leaderboard;
CREATE POLICY "System can manage leaderboard" ON public.referral_competition_leaderboard FOR ALL TO service_role USING (true) WITH CHECK (true);

-- service_health_checks / service_incidents
DROP POLICY IF EXISTS "Service can insert health checks" ON public.service_health_checks;
CREATE POLICY "Service can insert health checks" ON public.service_health_checks FOR INSERT TO service_role WITH CHECK (true);
DROP POLICY IF EXISTS "Allow insert for service role" ON public.service_incidents;
CREATE POLICY "Allow insert for service role" ON public.service_incidents FOR INSERT TO service_role WITH CHECK (true);
DROP POLICY IF EXISTS "Allow update for service role" ON public.service_incidents;
CREATE POLICY "Allow update for service role" ON public.service_incidents FOR UPDATE TO service_role USING (true) WITH CHECK (true);

-- sitemap_cache
DROP POLICY IF EXISTS "Allow service role full access" ON public.sitemap_cache;
CREATE POLICY "Allow service role full access" ON public.sitemap_cache FOR ALL TO service_role USING (true) WITH CHECK (true);

-- supabase_usage_stats
DROP POLICY IF EXISTS "Admins can insert usage stats" ON public.supabase_usage_stats;
CREATE POLICY "Admins can insert usage stats" ON public.supabase_usage_stats FOR INSERT TO service_role WITH CHECK (true);

-- telegram tables
DROP POLICY IF EXISTS "Service can insert telegram ai logs" ON public.telegram_ai_reply_log;
CREATE POLICY "Service can insert telegram ai logs" ON public.telegram_ai_reply_log FOR INSERT TO service_role WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated can view telegram ai settings" ON public.telegram_ai_settings;
CREATE POLICY "Service role can view telegram ai settings" ON public.telegram_ai_settings FOR SELECT TO service_role USING (true);
DROP POLICY IF EXISTS "Admins can manage telegram_analytics" ON public.telegram_analytics;
CREATE POLICY "Admins can manage telegram_analytics" ON public.telegram_analytics FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Admins can manage telegram_audience_segments" ON public.telegram_audience_segments;
CREATE POLICY "Admins can manage telegram_audience_segments" ON public.telegram_audience_segments FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow authenticated users to read bot settings" ON public.telegram_bot_settings;
CREATE POLICY "Service role can read bot settings" ON public.telegram_bot_settings FOR SELECT TO service_role USING (true);
DROP POLICY IF EXISTS "Admins can manage telegram_campaigns" ON public.telegram_campaigns;
CREATE POLICY "Admins can manage telegram_campaigns" ON public.telegram_campaigns FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Admins can manage telegram_message_templates" ON public.telegram_message_templates;
CREATE POLICY "Admins can manage telegram_message_templates" ON public.telegram_message_templates FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Admins can manage telegram_trigger_logs" ON public.telegram_trigger_logs;
CREATE POLICY "Admins can manage telegram_trigger_logs" ON public.telegram_trigger_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Admins can manage telegram_triggers" ON public.telegram_triggers;
CREATE POLICY "Admins can manage telegram_triggers" ON public.telegram_triggers FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Service role full access to queue" ON public.telegram_message_queue;
CREATE POLICY "Service role full access to queue" ON public.telegram_message_queue FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Service role full access to queue stats" ON public.telegram_queue_stats;
CREATE POLICY "Service role full access to queue stats" ON public.telegram_queue_stats FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Service role full access to rate limits" ON public.telegram_rate_limits;
CREATE POLICY "Service role full access to rate limits" ON public.telegram_rate_limits FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Service can manage telegram cache" ON public.telegram_response_cache;
CREATE POLICY "Service can manage telegram cache" ON public.telegram_response_cache FOR ALL TO service_role USING (true) WITH CHECK (true);

-- lifecycle templates (public read -> service role)
DROP POLICY IF EXISTS "Anyone can view email templates" ON public.email_lifecycle_templates;
CREATE POLICY "Service role can view email templates" ON public.email_lifecycle_templates FOR SELECT TO service_role USING (true);
DROP POLICY IF EXISTS "Anyone can view push lifecycle templates" ON public.push_lifecycle_templates;
CREATE POLICY "Service role can view push lifecycle templates" ON public.push_lifecycle_templates FOR SELECT TO service_role USING (true);
DROP POLICY IF EXISTS "Anyone can view telegram lifecycle templates" ON public.telegram_lifecycle_templates;
CREATE POLICY "Service role can view telegram lifecycle templates" ON public.telegram_lifecycle_templates FOR SELECT TO service_role USING (true);

-- totp_verification
DROP POLICY IF EXISTS "Service role can manage totp_verification" ON public.totp_verification;
CREATE POLICY "Service role can manage totp_verification" ON public.totp_verification FOR ALL TO service_role USING (true) WITH CHECK (true);

-- transactions
DROP POLICY IF EXISTS "System can manage transactions" ON public.transactions;
CREATE POLICY "System can manage transactions" ON public.transactions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- user_preferences_tracking
DROP POLICY IF EXISTS "System can insert preferences" ON public.user_preferences_tracking;
CREATE POLICY "System can insert preferences" ON public.user_preferences_tracking FOR INSERT TO service_role WITH CHECK (true);

-- auto_scale_settings
DROP POLICY IF EXISTS "Allow auto scale reads" ON public.auto_scale_settings;
CREATE POLICY "Service role can read auto scale settings" ON public.auto_scale_settings FOR SELECT TO service_role USING (true);

-- daily_unique_visitors public read (keep anonymous insert/update for tracking)
DROP POLICY IF EXISTS "Allow read for analytics" ON public.daily_unique_visitors;
CREATE POLICY "Service role can read visitor analytics" ON public.daily_unique_visitors FOR SELECT TO service_role USING (true);